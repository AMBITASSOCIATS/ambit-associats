-- =============================================================================
-- Portal · KYC, correccions (2 de 2)
--
-- 1. Documentació: "l'aporta el client" (com fins ara) o "ja la té ÀMBIT".
--    Amb "ja la té ÀMBIT", el client no està obligat a adjuntar documents per
--    signar; abans de validar, el personal hi adjunta els obligatoris que
--    faltin (data del document i "rebut el"). L'OCIC no pot validar mentre en
--    falti cap, sigui qui sigui qui l'aporti.
-- 2. Vigència dels documents (plantilles v2): el document d'identitat ha de
--    ser vigent i, en persona jurídica, el certificat de vigència i l'extracte
--    del Registre de beneficiaris efectius han de tenir menys de 3 mesos.
-- 3. Còpia per al client (doc_kind 'copia_client') en validar.
-- 4. Plantilles KYC-PF v2 i KYC-PJ v2. Els expedients signats conserven la
--    seva versió i els seus PDF; els esborranys v1 passen a v2.
--
-- Cap regla existent es debilita: els documents que va adjuntar el client i
-- tot el que s'ha signat continuen sent immutables. L'única ampliació és que
-- el personal pot afegir documents nous (marcats "aportat per ÀMBIT") fins
-- que el KYC es valida.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnes noves
-- -----------------------------------------------------------------------------
alter table portal.kyc_formularis
  -- La tria el personal en crear la sol·licitud; després ja no canvia
  -- (kyc_formulari_regles només deixa modificar les respostes)
  add column documentacio_ambit boolean not null default false;

alter table portal.kyc_adjunts
  add column aportat_per_ambit boolean not null default false,
  add column aportat_per       uuid references auth.users (id) on delete restrict,
  add column rebut_el          date,
  add column data_document     date,
  add column data_caducitat    date,
  add constraint kyc_adjunts_aportat_coherent
    check ((aportat_per_ambit and aportat_per is not null and rebut_el is not null and data_document is not null)
           or (not aportat_per_ambit and aportat_per is null and rebut_el is null));

-- -----------------------------------------------------------------------------
-- 2. Vigència d'un document (plantilles v2; les v1 conserven les seves regles)
-- -----------------------------------------------------------------------------
create function portal.kyc_adjunt_valid(p_tipus text, p_data_document date, p_data_caducitat date, p_versio text)
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select case
    when p_versio like '% v1' then true
    -- Document d'identitat: ha de ser vigent (caducat no serveix)
    when p_tipus = 'identitat' then p_data_caducitat is not null and p_data_caducitat >= portal.avui()
    -- Certificat de vigència i extracte del Registre de beneficiaris efectius: menys de 3 mesos
    when p_tipus in ('vigencia', 'registre_be') then p_data_document is not null
         and p_data_document <= portal.avui() and p_data_document > (portal.avui() - interval '3 months')::date
    else true
  end;
$$;

-- Documents pendents: un document caducat o massa antic no compta
create or replace function portal.kyc_documents_pendents(p_request_id uuid)
  returns table (tipus text, persona text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select distinct q.tipus, q.persona
  from portal.kyc_documents_requerits(p_request_id) q
  where not exists (
    select 1 from portal.kyc_adjunts a
    where a.request_id = p_request_id and a.tipus = q.tipus
      and a.persona is not distinct from q.persona and a.retirat_at is null
      and portal.kyc_adjunt_valid(a.tipus, a.data_document, a.data_caducitat,
                                  (select r.template_version from portal.requests r where r.id = p_request_id)));
$$;

create or replace function portal.kyc_estat_documents(p_request_id uuid)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object(
    'requerits', coalesce((select jsonb_agg(jsonb_build_object('tipus', q.tipus, 'persona', q.persona) order by q.tipus, q.persona)
                           from (select distinct * from portal.kyc_documents_requerits(p_request_id)) q), '[]'::jsonb),
    'pendents',  coalesce((select jsonb_agg(jsonb_build_object('tipus', q.tipus, 'persona', q.persona) order by q.tipus, q.persona)
                           from portal.kyc_documents_pendents(p_request_id) q), '[]'::jsonb),
    'adjunts',   coalesce((select jsonb_agg(jsonb_build_object(
                             'id', a.id, 'tipus', a.tipus, 'persona', a.persona, 'nom_fitxer', a.nom_fitxer,
                             'mime', d.mime, 'mida', d.mida_bytes, 'sha256', d.sha256, 'created_at', a.created_at,
                             'aportat_per_ambit', a.aportat_per_ambit, 'rebut_el', a.rebut_el,
                             'data_document', a.data_document, 'data_caducitat', a.data_caducitat,
                             'valid', portal.kyc_adjunt_valid(a.tipus, a.data_document, a.data_caducitat, r.template_version))
                             order by a.created_at)
                           from portal.kyc_adjunts a join portal.documents d on d.id = a.document_id
                           join portal.requests r on r.id = a.request_id
                           where a.request_id = p_request_id and a.retirat_at is null), '[]'::jsonb),
    'documentacio_ambit', coalesce((select k.documentacio_ambit from portal.kyc_formularis k where k.request_id = p_request_id), false));
$$;

-- -----------------------------------------------------------------------------
-- 3. Regles dels adjunts
--    · Del client: com fins ara (només mentre és en curs i abans de signar).
--    · Aportats per ÀMBIT: el servei en nom del personal (portal.actor), fins
--      que el KYC es valida; amb data del document i data de recepció.
--    En tots dos casos, després només es pot indicar que s'ha tret.
-- -----------------------------------------------------------------------------
create or replace function portal.kyc_adjunt_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req     portal.requests;
  v_signat  boolean;
  v_validat boolean;
begin
  if current_user <> 'service_role' then
    raise exception 'Els documents del KYC només els registra el servei del portal' using errcode = '42501';
  end if;
  select * into v_req from portal.requests r where r.id = new.request_id;
  if v_req.document_type not in ('kyc_pf', 'kyc_pj') then
    raise exception 'Aquest KYC ja no admet canvis en els documents' using errcode = '42501';
  end if;
  v_signat  := exists (select 1 from portal.signatures s where s.request_id = new.request_id);
  v_validat := exists (select 1 from portal.kyc_validacions v where v.request_id = new.request_id);

  if tg_op = 'INSERT' then
    if not exists (select 1 from portal.documents d
                   where d.id = new.document_id and d.request_id = new.request_id and d.kind = 'adjunt') then
      raise exception 'El document no pertany a aquesta sol·licitud' using errcode = '23514';
    end if;
    if new.data_document > portal.avui() then
      raise exception 'La data del document no pot ser futura' using errcode = '23514';
    end if;
    if new.aportat_per_ambit then
      if v_validat or v_req.bloquejat_at is not null
         or v_req.status not in ('esborrany', 'enviat', 'en_curs', 'signat') then
        raise exception 'Aquest KYC ja no admet documents nous' using errcode = '42501';
      end if;
      if new.rebut_el is null or new.data_document is null then
        raise exception 'Cal indicar la data del document i la data de recepció' using errcode = '23514';
      end if;
      if new.rebut_el > portal.avui() then
        raise exception 'La data de recepció no pot ser futura' using errcode = '23514';
      end if;
      if new.tipus = 'identitat' and new.data_caducitat is null then
        raise exception 'Cal la data de caducitat del document d''identitat' using errcode = '23514';
      end if;
    else
      if v_signat or v_req.status not in ('esborrany', 'en_curs') then
        raise exception 'Aquest KYC ja no admet documents nous' using errcode = '42501';
      end if;
    end if;
    new.retirat_at := null;
    return new;
  end if;

  if old.retirat_at is not null
     or new.retirat_at is null
     or (new.id, new.request_id, new.document_id, new.tipus, new.persona, new.nom_fitxer, new.created_at,
         new.aportat_per_ambit, new.aportat_per, new.rebut_el, new.data_document, new.data_caducitat)
        is distinct from
        (old.id, old.request_id, old.document_id, old.tipus, old.persona, old.nom_fitxer, old.created_at,
         old.aportat_per_ambit, old.aportat_per, old.rebut_el, old.data_document, old.data_caducitat) then
    raise exception 'D''un document del KYC només es pot indicar que s''ha tret' using errcode = '42501';
  end if;
  if old.aportat_per_ambit then
    if v_validat or v_req.status not in ('esborrany', 'enviat', 'en_curs', 'signat') then
      raise exception 'Aquest KYC ja no admet canvis en els documents' using errcode = '42501';
    end if;
  elsif v_signat or v_req.status <> 'en_curs' then
    raise exception 'Aquest KYC ja no admet canvis en els documents' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. valida_estat: la de la migració del KYC; amb "ja la té ÀMBIT" el client
--    pot signar sense els documents obligatoris.
-- -----------------------------------------------------------------------------
create or replace function portal.valida_estat()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  qui    text;  -- 'personal', 'servei' o 'ocic': qui pot fer la transició
  falten text[] := '{}';
  v_aut  portal.autoritzacions_carrec;
  v_tipus portal.party_type;
  v_kyc  boolean := new.document_type in ('kyc_pf', 'kyc_pj', 'pdp');
begin
  if tg_op = 'INSERT' then
    if new.status <> 'esborrany' then
      raise exception 'Una sol·licitud nova ha de començar en esborrany (s''ha rebut %)', new.status
        using errcode = '23514';
    end if;
    new.activat_at          := null;
    new.activat_per         := null;
    new.anullat_at          := null;
    new.motiu_anullacio     := null;
    new.bloquejat_at        := null;
    new.destruir_despres_de := null;
    return new;
  end if;

  new.activat_at  := old.activat_at;
  new.activat_per := old.activat_per;
  new.anullat_at  := old.anullat_at;
  if not ((old.status = 'signat' or v_kyc) and new.status = 'anullat' and old.status <> 'anullat') then
    new.motiu_anullacio := old.motiu_anullacio;
  end if;
  if not portal.en_bloqueig() then
    new.bloquejat_at        := old.bloquejat_at;
    new.destruir_despres_de := old.destruir_despres_de;
  end if;

  if old.bloquejat_at is not null and new.status is distinct from old.status then
    raise exception 'La sol·licitud està bloquejada per conservació i no pot canviar d''estat'
      using errcode = '42501';
  end if;

  if old.status <> 'esborrany'
     and (new.client_id, new.document_type, new.template_version, new.idioma)
         is distinct from (old.client_id, old.document_type, old.template_version, old.idioma) then
    raise exception 'La sol·licitud està en estat "%": client_id, document_type, template_version i idioma ja no es poden modificar', old.status
      using errcode = '42501';
  end if;

  if new.status = old.status then
    return new;
  end if;

  qui := case
    when old.status = 'esborrany' and new.status = 'enviat'  then 'personal'
    when old.status = 'enviat'    and new.status = 'en_curs' then 'servei'
    when old.status = 'en_curs'   and new.status = 'signat'  then 'servei'
    when old.status = 'signat'    and new.status = 'actiu'   and new.document_type = 'pdp' then null
    when old.status = 'signat'    and new.status = 'actiu'   and new.document_type in ('kyc_pf', 'kyc_pj') then 'ocic'
    when old.status = 'signat'    and new.status = 'actiu'   then 'personal'
    when old.status = 'actiu'     and new.status = 'retirat' and v_kyc then null
    when old.status = 'actiu'     and new.status = 'retirat' then 'personal'
    when old.status in ('esborrany', 'enviat', 'en_curs') and new.status = 'anullat' and v_kyc then 'ocic'
    when old.status in ('esborrany', 'enviat', 'en_curs') and new.status = 'anullat' then 'personal'
    when old.status = 'signat'    and new.status = 'anullat' then 'ocic'
  end;

  if qui is null then
    raise exception 'Transició d''estat no permesa: % → %', old.status, new.status
      using errcode = '23514';
  end if;

  -- Personal = sessió authenticated d'un usuari actiu a staff_profiles. No n'hi ha prou
  -- amb el JWT: service_role amb la sessió d'un gestor no compta com a personal.
  if qui = 'personal' and not (current_user = 'authenticated' and portal.is_staff()) then
    raise exception 'La transició % → % només la pot fer el personal d''ÀMBIT', old.status, new.status
      using errcode = '42501';
  end if;

  -- Només l'OCIC (sessió authenticated): anul·lar una sol·licitud signada o
  -- qualsevol KYC/PDP, i validar un KYC
  if qui = 'ocic' then
    if not (current_user = 'authenticated' and portal.is_ocic()) then
      if new.status = 'actiu' then
        raise exception 'Només l''OCIC pot validar un KYC' using errcode = '42501';
      elsif v_kyc then
        raise exception 'Només l''OCIC pot anul·lar un KYC o una informació de protecció de dades' using errcode = '42501';
      elsif old.status = 'signat' then
        raise exception 'Només l''OCIC pot anul·lar una autorització signada' using errcode = '42501';
      end if;
    end if;
    if new.status = 'anullat' and btrim(coalesce(new.motiu_anullacio, '')) = '' then
      raise exception 'Cal indicar el motiu de l''anul·lació' using errcode = '23514';
    end if;
  end if;

  if qui = 'servei' and current_user <> 'service_role' then
    raise exception 'La transició % → % només la pot fer el servei del portal (service_role)', old.status, new.status
      using errcode = '42501';
  end if;

  if new.status = 'signat'
     and not exists (select 1 from portal.signatures s where s.request_id = new.id) then
    raise exception 'No es pot passar a signat: no hi ha cap firma registrada'
      using errcode = '23514';
  end if;

  -- Fase 2: dades completes abans de signar
  if new.status = 'signat' and new.document_type = 'autoritzacio_carrec' then
    select * into v_aut from portal.autoritzacions_carrec a where a.request_id = new.id;
    select c.party_type into v_tipus from portal.clients c where c.id = new.client_id;

    if v_aut.id is null then
      falten := array_append(falten, 'autorització');
    else
      if v_aut.titular_nom is null         then falten := array_append(falten, 'titular_nom'); end if;
      if v_aut.titular_adreca is null      then falten := array_append(falten, 'titular_adreca'); end if;
      if v_aut.titular_cp_poblacio is null then falten := array_append(falten, 'titular_cp_poblacio'); end if;
      if v_aut.entitat is null             then falten := array_append(falten, 'entitat'); end if;
      if v_aut.iban_xifrat is null or v_aut.iban_ultims4 is null then
        falten := array_append(falten, 'IBAN');
      end if;
      if v_tipus = 'pj' and v_aut.signant_es_administrador is null then
        falten := array_append(falten, 'signant_es_administrador');
      end if;
      if v_tipus = 'pj' and v_aut.signant_es_administrador is false and v_aut.poder_adjunt_id is null then
        falten := array_append(falten, 'poder adjunt');
      end if;
    end if;

    if cardinality(falten) > 0 then
      raise exception 'No es pot passar a signat: falta %', array_to_string(falten, ', ')
        using errcode = '23514';
    end if;
  end if;

  -- KYC: no es pot signar si falta cap document obligatori o cap declaració
  if new.status = 'signat' and new.document_type in ('kyc_pf', 'kyc_pj') then
    if not exists (select 1 from portal.kyc_formularis k where k.request_id = new.id) then
      falten := array_append(falten, 'formulari');
    else
      -- Amb "documentació: ja la té ÀMBIT", el client pot signar sense adjuntar-los
      -- (els aportarà ÀMBIT; l'OCIC no pot validar mentre en falti cap)
      if not coalesce((select k.documentacio_ambit from portal.kyc_formularis k where k.request_id = new.id), false)
         and exists (select 1 from portal.kyc_documents_pendents(new.id)) then
        falten := array_append(falten, 'documents obligatoris (' ||
          (select string_agg(p.tipus, ', ' order by p.tipus) from portal.kyc_documents_pendents(new.id) p) || ')');
      end if;
      if not portal.kyc_declaracions_completes(new.id) then
        falten := array_append(falten, 'declaracions');
      end if;
      if exists (select 1 from portal.kyc_be_no_declarats(new.id)) then
        falten := array_append(falten, 'beneficiaris efectius no declarats (més del 25 %)');
      end if;
    end if;
    if cardinality(falten) > 0 then
      raise exception 'No es pot passar a signat: falta %', array_to_string(falten, ', ')
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'signat' and new.document_type = 'pdp'
     and not exists (select 1 from portal.pdp_consentiments p where p.request_id = new.id) then
    raise exception 'No es pot passar a signat: falta la resposta sobre les comunicacions comercials'
      using errcode = '23514';
  end if;

  if new.status = 'retirat'
     and new.document_type = 'autoritzacio_carrec'
     and not exists (select 1 from portal.autoritzacions_carrec a
                     where a.request_id = new.id and a.data_retirada is not null) then
    raise exception 'No es pot retirar: falta data_retirada a l''autorització'
      using errcode = '23514';
  end if;

  if new.status = 'actiu' then
    if not exists (select 1 from portal.signatures s where s.request_id = new.id) then
      falten := array_append(falten, 'firma registrada');
    end if;

    if not exists (select 1 from portal.clients c
                   where c.id = new.client_id and c.referencia_client is not null) then
      falten := array_append(falten, 'referencia_client');
    end if;

    if new.document_type = 'autoritzacio_carrec'
       and not exists (select 1 from portal.autoritzacions_carrec a
                       where a.request_id = new.id and a.data_alta is not null) then
      falten := array_append(falten, 'data_alta');
    end if;

    if new.document_type in ('kyc_pf', 'kyc_pj')
       and not exists (select 1 from portal.kyc_validacions v where v.request_id = new.id) then
      falten := array_append(falten, 'validació de l''OCIC');
    end if;

    if cardinality(falten) > 0 then
      raise exception 'No es pot activar la sol·licitud: falta %', array_to_string(falten, ', ')
        using errcode = '23514';
    end if;

    new.activat_at  := now();
    new.activat_per := auth.uid();
  end if;

  -- Conservació: data d'anul·lació (no editable)
  if new.status = 'anullat' then
    new.anullat_at := now();
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Validació de l'OCIC: cap document obligatori pendent ni caducat
-- -----------------------------------------------------------------------------
create or replace function portal.kyc_validacio_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req    portal.requests;
  v_marq   jsonb;
  v_codis  text[];
  v_cfg    portal.config_kyc;
  v_alta   boolean;
begin
  if not (current_user = 'authenticated' and portal.is_ocic()) then
    raise exception 'Només l''OCIC pot validar un KYC' using errcode = '42501';
  end if;

  select * into v_req from portal.requests where id = new.request_id for update;
  if v_req.id is null or v_req.document_type not in ('kyc_pf', 'kyc_pj') then
    raise exception 'Sol·licitud KYC inexistent' using errcode = 'P0002';
  end if;
  if v_req.status <> 'signat' or v_req.bloquejat_at is not null then
    raise exception 'Només es pot validar un KYC signat pendent de validació (estat actual: %)', v_req.status
      using errcode = '23514';
  end if;

  v_marq := portal.kyc_marques(new.request_id);
  select coalesce(array_agg(distinct m ->> 'codi'), '{}') into v_codis from jsonb_array_elements(v_marq) m;

  if 'prohibicio_total' = any (v_codis) then
    raise exception 'No es pot validar: hi ha un país de prohibició total (CT-03/2026)' using errcode = '42501';
  end if;
  -- Tots els documents obligatoris, vigents, els hagi aportat el client o ÀMBIT
  if exists (select 1 from portal.kyc_documents_pendents(new.request_id)) then
    raise exception 'No es pot validar: falten documents obligatoris o no són vigents (%)',
      (select string_agg(p.tipus, ', ' order by p.tipus) from portal.kyc_documents_pendents(new.request_id) p)
      using errcode = '23514';
  end if;
  if new.nivell = 'simplificada' and cardinality(v_codis) > 0 then
    raise exception 'No es pot aplicar diligència simplificada: l''expedient té marques (%)', array_to_string(v_codis, ', ')
      using errcode = '23514';
  end if;
  if new.verificacio_data > portal.avui() or new.sancions_data > portal.avui() then
    raise exception 'Les dates de verificació i de comprovació de sancions no poden ser futures' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(new.sancions_llistes_marcades) c
             where c not in (select l.codi from portal.llistes_sancions() l)) then
    raise exception 'Llista de sancions desconeguda' using errcode = '22023';
  end if;
  if exists (select 1 from portal.llistes_sancions() l where not (l.codi = any (new.sancions_llistes_marcades))) then
    raise exception 'Cal marcar totes les llistes de sancions obligatòries' using errcode = '23514';
  end if;
  new.sancions_altres := nullif(btrim(coalesce(new.sancions_altres, '')), '');
  new.sancions_llistes := (select string_agg(l.nom, '; ' order by l.ordre) from portal.llistes_sancions() l)
                          || coalesce('; ' || new.sancions_altres, '');
  if not exists (select 1 from portal.documents d
                 where d.id = new.sancions_evidencia_id and d.request_id = new.request_id and d.kind = 'adjunt'
                   and d.storage_path like 'requests/' || new.request_id || '/ocic/%') then
    raise exception 'Cal adjuntar l''evidència de la comprovació a les llistes de sancions' using errcode = '23514';
  end if;
  if v_req.document_type = 'kyc_pj'
     and (new.rbe_data is null or btrim(coalesce(new.rbe_resultat, '')) = '') then
    raise exception 'Persona jurídica: cal la verificació al Registre de beneficiaris efectius (data i resultat)' using errcode = '23514';
  end if;
  if v_req.document_type = 'kyc_pj' and new.rbe_data > portal.avui() then
    raise exception 'La data de verificació al Registre de beneficiaris efectius no pot ser futura' using errcode = '23514';
  end if;

  v_alta := 'ppe' = any (v_codis) or 'pais_risc' = any (v_codis) or new.nivell = 'reforcada';
  if v_alta and (btrim(coalesce(new.alta_direccio_nom, '')) = '' or new.alta_direccio_data is null) then
    raise exception 'Cal l''autorització de l''alta direcció (PPE, país de risc o diligència reforçada)' using errcode = '23514';
  end if;
  if new.alta_direccio_data > portal.avui() then
    raise exception 'La data de l''autorització de l''alta direcció no pot ser futura' using errcode = '23514';
  end if;

  select * into v_cfg from portal.config_kyc;
  new.marques         := v_marq;
  new.llistes         := portal.llistes_vigents();
  new.validat_per     := auth.uid();
  new.validat_at      := now();
  new.created_at      := now();
  new.propera_revisio := (portal.avui() + case new.nivell
                           when 'simplificada' then v_cfg.revisio_risc_reduit
                           when 'normal'       then v_cfg.revisio_risc_normal
                           else v_cfg.revisio_risc_alt end)::date;
  if not v_alta then
    new.alta_direccio_nom  := nullif(btrim(coalesce(new.alta_direccio_nom, '')), '');
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. PDF validat (intern) i còpia per al client: només el servei, només amb
--    el KYC validat, un de cada per sol·licitud
-- -----------------------------------------------------------------------------
create or replace function portal.document_validat_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.kind in ('validat', 'copia_client') then
    if current_user <> 'service_role' then
      raise exception 'El PDF validat només el genera el servei del portal' using errcode = '42501';
    end if;
    if not exists (select 1 from portal.kyc_validacions v
                   join portal.requests r on r.id = v.request_id
                   where v.request_id = new.request_id and r.status = 'actiu') then
      raise exception 'El KYC no està validat per l''OCIC' using errcode = '42501';
    end if;
    if new.storage_path !~ ('^requests/' || new.request_id || '/' ||
                            case new.kind when 'validat' then 'validat' else 'copia-client' end ||
                            '/[0-9a-f-]{36}\.pdf$') then
      raise exception 'Camí del PDF validat no vàlid' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create unique index documents_una_copia_client on portal.documents (request_id) where kind = 'copia_client';

-- -----------------------------------------------------------------------------
-- 7. Creació: tria de qui aporta la documentació; plantilles v2
-- -----------------------------------------------------------------------------
drop function portal.crea_kyc(uuid, uuid, text);
create function portal.crea_kyc(p_client_id uuid, p_revisio_de uuid default null, p_motiu text default null,
                                p_documentacio_ambit boolean default false)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_tipus portal.party_type;
  v_kyc   uuid;
  v_pdp   uuid;
  v_dades jsonb := '{}'::jsonb;
begin
  if not portal.is_staff() then
    raise exception 'Només el personal d''ÀMBIT' using errcode = '42501';
  end if;
  select party_type into v_tipus from portal.clients where id = p_client_id;
  if v_tipus is null then
    raise exception 'Client inexistent' using errcode = 'P0002';
  end if;
  if exists (select 1 from portal.requests r
             where r.client_id = p_client_id and r.document_type in ('kyc_pf', 'kyc_pj')
               and r.status in ('esborrany', 'enviat', 'en_curs')) then
    raise exception 'Aquest client ja té un KYC pendent de signar' using errcode = '23505';
  end if;

  if p_revisio_de is not null then
    select k.dades - 'declaracions' - 'declaracio_beneficiaris' into v_dades
    from portal.kyc_formularis k
    join portal.requests r on r.id = k.request_id
    join portal.kyc_validacions v on v.request_id = r.id
    where k.request_id = p_revisio_de and r.client_id = p_client_id and r.status = 'actiu';
    if v_dades is null then
      raise exception 'La revisió s''ha de fer a partir d''un KYC validat del mateix client' using errcode = '23514';
    end if;
  end if;

  insert into portal.requests (client_id, document_type, template_version, idioma)
  values (p_client_id, case v_tipus when 'pf' then 'kyc_pf'::portal.document_type else 'kyc_pj'::portal.document_type end,
          case v_tipus when 'pf' then 'KYC-PF v2' else 'KYC-PJ v2' end, 'ca')
  returning id into v_kyc;
  insert into portal.requests (client_id, document_type, template_version, idioma)
  values (p_client_id, 'pdp', 'PDP v1', 'ca')
  returning id into v_pdp;
  insert into portal.kyc_formularis (request_id, pdp_request_id, revisio_de, motiu_revisio, dades, documentacio_ambit)
  values (v_kyc, v_pdp, p_revisio_de, nullif(btrim(coalesce(p_motiu, '')), ''), v_dades, coalesce(p_documentacio_ambit, false));
  return v_kyc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Adjunts del client: data del document i de caducitat (quan cal)
-- -----------------------------------------------------------------------------
drop function portal.kyc_registra_adjunt(uuid, text, text, bigint, text, text, text, text);
create function portal.kyc_registra_adjunt(
  p_token_id uuid, p_path text, p_sha256 text, p_mida bigint, p_mime text,
  p_tipus text, p_persona text, p_nom_fitxer text,
  p_data_document date default null, p_data_caducitat date default null
)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_request uuid := portal.kyc_token_vigent(p_token_id);
  v_t       portal.document_type;
  v_doc     uuid;
begin
  select document_type into v_t from portal.requests where id = v_request;
  if not portal.kyc_tipus_document_valid(v_t, p_tipus, p_persona) then
    raise exception 'Tipus de document no vàlid' using errcode = '22023';
  end if;
  if p_path !~ ('^requests/' || v_request || '/adjunts/[0-9a-f-]{36}\.(pdf|jpg|png)$') then
    raise exception 'Camí no vàlid' using errcode = '22023';
  end if;
  if (select count(*) from portal.kyc_adjunts where request_id = v_request and retirat_at is null) >= 60 then
    raise exception 'S''ha arribat al màxim de documents' using errcode = '54000';
  end if;

  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_request, 'adjunt', p_path, p_sha256, p_mida, p_mime)
  returning id into v_doc;
  insert into portal.kyc_adjunts (request_id, document_id, tipus, persona, nom_fitxer, data_document, data_caducitat)
  values (v_request, v_doc, p_tipus, p_persona, nullif(left(p_nom_fitxer, 200), ''), p_data_document, p_data_caducitat);
  return portal.kyc_estat_documents(v_request);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Documents aportats per ÀMBIT (Edge Function portal-kyc-personal, service_role
--    en nom del personal: l'auditoria en registra l'actor)
-- -----------------------------------------------------------------------------
create function portal.kyc_registra_adjunt_ambit(
  p_actor uuid, p_request_id uuid, p_path text, p_sha256 text, p_mida bigint, p_mime text,
  p_tipus text, p_persona text, p_nom_fitxer text,
  p_data_document date, p_rebut_el date, p_data_caducitat date
)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_t   portal.document_type;
  v_doc uuid;
begin
  perform portal.actua_com(p_actor, 'personal');
  select document_type into v_t from portal.requests where id = p_request_id;
  if v_t is null or not portal.kyc_tipus_document_valid(v_t, p_tipus, p_persona) then
    raise exception 'Tipus de document no vàlid' using errcode = '22023';
  end if;
  if p_path !~ ('^requests/' || p_request_id || '/ambit/[0-9a-f-]{36}\.(pdf|jpg|png)$') then
    raise exception 'Camí no vàlid' using errcode = '22023';
  end if;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, 'adjunt', p_path, p_sha256, p_mida, p_mime)
  returning id into v_doc;
  insert into portal.kyc_adjunts (request_id, document_id, tipus, persona, nom_fitxer,
                                  aportat_per_ambit, aportat_per, rebut_el, data_document, data_caducitat)
  values (p_request_id, v_doc, p_tipus, p_persona, nullif(left(p_nom_fitxer, 200), ''),
          true, p_actor, p_rebut_el, p_data_document, p_data_caducitat);
  return portal.kyc_estat_documents(p_request_id);
end;
$$;

create function portal.kyc_retira_adjunt_ambit(p_actor uuid, p_request_id uuid, p_adjunt_id uuid)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
begin
  perform portal.actua_com(p_actor, 'personal');
  update portal.kyc_adjunts set retirat_at = now()
   where id = p_adjunt_id and request_id = p_request_id and aportat_per_ambit and retirat_at is null;
  if not found then
    raise exception 'Document inexistent' using errcode = 'P0002';
  end if;
  return portal.kyc_estat_documents(p_request_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Obrir l'enllaç: el client sap si la documentació és obligatòria
-- -----------------------------------------------------------------------------
create or replace function portal.obre_kyc_per_token(p_token_hash text)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok portal.access_tokens;
  v_req portal.requests;
  v_pdp portal.requests;
  v_cli portal.clients;
  v_kyc portal.kyc_formularis;
begin
  select * into v_tok from portal.access_tokens where token_hash = p_token_hash for update;
  if not found or v_tok.revocat_at is not null or v_tok.usat_at is not null or v_tok.expira_at <= now() then
    return null;
  end if;

  select * into v_req from portal.requests where id = v_tok.request_id for update;
  if v_req.document_type not in ('kyc_pf', 'kyc_pj')
     or v_req.status not in ('enviat', 'en_curs') or v_req.bloquejat_at is not null then
    return null;
  end if;
  select * into v_kyc from portal.kyc_formularis where request_id = v_req.id;
  select * into v_pdp from portal.requests where id = v_kyc.pdp_request_id for update;
  if v_pdp.id is null or v_pdp.status not in ('enviat', 'en_curs') or v_pdp.bloquejat_at is not null then
    return null;
  end if;

  if v_req.status = 'enviat' then
    update portal.requests set status = 'en_curs' where id = v_req.id;
  end if;
  if v_pdp.status = 'enviat' then
    update portal.requests set status = 'en_curs' where id = v_pdp.id;
  end if;

  select * into v_cli from portal.clients where id = v_req.client_id;

  return jsonb_build_object(
    'token_id',         v_tok.id,
    'request_id',       v_req.id,
    'pdp_request_id',   v_pdp.id,
    'document_type',    v_req.document_type,
    'template_version', v_req.template_version,
    'pdp_template_version', v_pdp.template_version,
    'idioma',           v_req.idioma,
    'expira_at',        v_tok.expira_at,
    'client_id',        v_cli.id,
    'client_nom',       v_cli.nom_mostrat,
    'referencia_client', v_cli.referencia_client,
    'party_type',       v_cli.party_type,
    'dades',            v_kyc.dades,
    'documentacio_ambit', v_kyc.documentacio_ambit,
    'desat_at',         v_kyc.desat_at,
    'documents',        portal.kyc_estat_documents(v_req.id)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. PDF finals: el validat (intern) i la còpia per al client
-- -----------------------------------------------------------------------------
create or replace function portal.kyc_dades_pdf_validat(p_actor uuid, p_request_id uuid)
  returns jsonb
  language plpgsql
  stable
  set search_path = ''
as $$
declare
  v_val portal.kyc_validacions;
begin
  perform portal.actua_com(p_actor, 'ocic');
  select * into v_val from portal.kyc_validacions where request_id = p_request_id;
  if v_val.id is null or v_val.validat_per <> p_actor then
    raise exception 'Només l''OCIC que ha validat el KYC pot generar-ne el PDF final' using errcode = '42501';
  end if;
  if exists (select 1 from portal.documents where request_id = p_request_id and kind = 'validat')
     and exists (select 1 from portal.documents where request_id = p_request_id and kind = 'copia_client') then
    raise exception 'El PDF final ja existeix' using errcode = '23505';
  end if;
  return jsonb_build_object(
    'te_validat', exists (select 1 from portal.documents where request_id = p_request_id and kind = 'validat'),
    'te_copia',   exists (select 1 from portal.documents where request_id = p_request_id and kind = 'copia_client'),
    'request',    (select to_jsonb(r) from portal.requests r where r.id = p_request_id),
    'client',     (select to_jsonb(c) from portal.clients c join portal.requests r on r.client_id = c.id where r.id = p_request_id),
    'formulari',  (select to_jsonb(k) from portal.kyc_formularis k where k.request_id = p_request_id),
    'signatura',  (select to_jsonb(s) from portal.signatures s where s.request_id = p_request_id),
    'documents',  (select coalesce(jsonb_agg(jsonb_build_object('kind', d.kind, 'storage_path', d.storage_path, 'sha256', d.sha256)), '[]'::jsonb)
                     from portal.documents d where d.request_id = p_request_id),
    'adjunts',    portal.kyc_estat_documents(p_request_id) -> 'adjunts',
    'validacio',  to_jsonb(v_val),
    'evidencia',  (select to_jsonb(d) from portal.documents d where d.id = v_val.sancions_evidencia_id),
    'firma',      (select jsonb_build_object('nom', f.nom, 'imatge_path', f.imatge_path, 'sha256', f.sha256)
                     from portal.firmes_ocic f where f.user_id = p_actor)
  );
end;
$$;

drop function portal.registra_pdf_validat(uuid, uuid, text, text, bigint);
create function portal.registra_pdf_validat(p_actor uuid, p_request_id uuid, p_path text, p_sha256 text, p_mida bigint,
                                           p_kind text default 'validat')
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform portal.actua_com(p_actor, 'ocic');
  if not exists (select 1 from portal.kyc_validacions where request_id = p_request_id and validat_per = p_actor) then
    raise exception 'Només l''OCIC que ha validat el KYC' using errcode = '42501';
  end if;
  if p_kind not in ('validat', 'copia_client') then
    raise exception 'Tipus de PDF no vàlid' using errcode = '22023';
  end if;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, p_kind::portal.doc_kind, p_path, p_sha256, p_mida, 'application/pdf')
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Revisió: dates i procedència dels documents copiats
-- -----------------------------------------------------------------------------
create or replace function portal.kyc_adjunts_a_copiar(p_actor uuid, p_request_id uuid)
  returns table (document_id uuid, storage_path text, tipus text, persona text, nom_fitxer text, mime text)
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_k portal.kyc_formularis;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_k from portal.kyc_formularis where request_id = p_request_id;
  if v_k.revisio_de is null then
    return;
  end if;
  return query
    select d.id, d.storage_path, a.tipus, a.persona, a.nom_fitxer, d.mime
    from portal.kyc_adjunts a
    join portal.documents d on d.id = a.document_id
    join portal.kyc_formularis ka on ka.request_id = a.request_id
    where a.request_id = v_k.revisio_de and a.retirat_at is null
      and a.tipus not in ('domicili', 'fons', 'vigencia', 'registre_be')
      and not (a.tipus = 'identitat' and a.persona is null
               and coalesce(portal.data_segura(ka.dades #>> '{identificacio,doc_caducitat}') < portal.avui(), true))
      and not (a.tipus = 'identitat' and a.data_caducitat is not null and a.data_caducitat < portal.avui())
    order by a.created_at;
end;
$$;

create or replace function portal.kyc_copia_adjunt(p_actor uuid, p_request_id uuid, p_document_origen uuid, p_nou_path text)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_k   portal.kyc_formularis;
  v_doc portal.documents;
  v_adj portal.kyc_adjunts;
  v_nou uuid;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_k from portal.kyc_formularis where request_id = p_request_id;
  if not exists (select 1 from portal.requests where id = p_request_id and status = 'esborrany') or v_k.revisio_de is null then
    raise exception 'Només es poden copiar documents a una revisió en esborrany' using errcode = '23514';
  end if;
  select * into v_adj from portal.kyc_adjunts
   where document_id = p_document_origen and request_id = v_k.revisio_de and retirat_at is null;
  if v_adj.id is null or not exists (select 1 from portal.kyc_adjunts_a_copiar(p_actor, p_request_id) x where x.document_id = p_document_origen) then
    raise exception 'Aquest document no es pot copiar a la revisió' using errcode = '23514';
  end if;
  if p_nou_path !~ ('^requests/' || p_request_id || '/adjunts/[0-9a-f-]{36}\.(pdf|jpg|png)$') then
    raise exception 'Camí no vàlid' using errcode = '22023';
  end if;
  select * into v_doc from portal.documents where id = p_document_origen;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, 'adjunt', p_nou_path, v_doc.sha256, v_doc.mida_bytes, v_doc.mime)
  returning id into v_nou;
  insert into portal.kyc_adjunts (request_id, document_id, tipus, persona, nom_fitxer,
                                  aportat_per_ambit, aportat_per, rebut_el, data_document, data_caducitat)
  values (p_request_id, v_nou, v_adj.tipus, v_adj.persona, v_adj.nom_fitxer,
          v_adj.aportat_per_ambit, v_adj.aportat_per, v_adj.rebut_el, v_adj.data_document, v_adj.data_caducitat);
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Esborranys de KYC encara no enviats: passen a les plantilles v2 (ningú
--     no els ha vist; els enviats, en curs i signats conserven la seva versió)
-- -----------------------------------------------------------------------------
update portal.requests
   set template_version = case document_type when 'kyc_pf' then 'KYC-PF v2' else 'KYC-PJ v2' end
 where document_type in ('kyc_pf', 'kyc_pj') and status = 'esborrany' and template_version like '% v1';

-- -----------------------------------------------------------------------------
-- 14. Permisos
-- -----------------------------------------------------------------------------
revoke all on function
  portal.kyc_adjunt_valid(text, date, date, text),
  portal.crea_kyc(uuid, uuid, text, boolean),
  portal.kyc_registra_adjunt(uuid, text, text, bigint, text, text, text, text, date, date),
  portal.kyc_registra_adjunt_ambit(uuid, uuid, text, text, bigint, text, text, text, text, date, date, date),
  portal.kyc_retira_adjunt_ambit(uuid, uuid, uuid),
  portal.registra_pdf_validat(uuid, uuid, text, text, bigint, text)
from public, anon, authenticated, service_role;

grant execute on function portal.kyc_adjunt_valid(text, date, date, text) to authenticated, service_role;
grant execute on function portal.crea_kyc(uuid, uuid, text, boolean) to authenticated;
grant execute on function
  portal.kyc_registra_adjunt(uuid, text, text, bigint, text, text, text, text, date, date),
  portal.kyc_registra_adjunt_ambit(uuid, uuid, text, text, bigint, text, text, text, text, date, date, date),
  portal.kyc_retira_adjunt_ambit(uuid, uuid, uuid),
  portal.registra_pdf_validat(uuid, uuid, text, text, bigint, text)
to service_role;
