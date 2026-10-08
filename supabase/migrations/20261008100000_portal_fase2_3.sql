-- =============================================================================
-- Portal de signatura de clients ÀMBIT · Fases 2 i 3
-- Circuit complet de l'autorització de càrrec en compte: enllaç amb token,
-- formulari del client, signatura, activació, remesa i gestió del personal.
--
-- Les regles de la fase 1 es mantenen: transicions d'estat, immutabilitat del
-- que s'ha signat i camps del client només per a service_role. Aquesta
-- migració només hi afegeix comprovacions.
-- No toca cap taula de public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnes noves
-- -----------------------------------------------------------------------------

-- El personal pot preomplir només una part de les dades del titular mentre la
-- sol·licitud és un esborrany. La completesa s'exigeix en passar a 'signat'
-- (vegeu valida_estat més avall). Els check de "no en blanc" es mantenen.
alter table portal.autoritzacions_carrec
  alter column titular_nom         drop not null,
  alter column titular_adreca      drop not null,
  alter column titular_cp_poblacio drop not null,
  alter column entitat             drop not null,
  -- Persona jurídica: si el signant no és administrador, cal adjuntar el poder.
  add column signant_es_administrador boolean;

-- Un token es consumeix en signar (usat_at) o es revoca en regenerar-lo (revocat_at).
alter table portal.access_tokens
  add column usat_at timestamptz;

-- Com a màxim un token vigent per sol·licitud.
create unique index access_tokens_un_vigent
  on portal.access_tokens (request_id)
  where revocat_at is null and usat_at is null;

alter table portal.access_tokens
  add constraint access_tokens_hash_format check (token_hash ~ '^[0-9a-f]{64}$');

-- Empremta SHA-256 de les dades signades (la mateixa que surt al PDF).
alter table portal.signatures
  add column empremta_dades text check (empremta_dades is null or empremta_dades ~ '^[0-9a-f]{64}$');

-- -----------------------------------------------------------------------------
-- 2. Camps del client: s'hi afegeix signant_es_administrador
--    (mateixa funció de la fase 1, amb un camp més a la llista)
-- -----------------------------------------------------------------------------
create or replace function portal.camps_client_nomes_servei()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_status portal.request_status;
  canviats text[];
begin
  if current_user = 'service_role' then
    return new;
  end if;

  select r.status into v_status from portal.requests r where r.id = new.request_id;
  if v_status not in ('enviat', 'en_curs') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'La sol·licitud està en estat "%": les dades del titular les omple el client; només service_role pot crear l''autorització', v_status
      using errcode = '42501';
  end if;

  select array_agg(e.key order by e.key) into canviats
  from jsonb_each(to_jsonb(new)) e
  where e.key in ('titular_nom', 'titular_adreca', 'titular_cp_poblacio', 'entitat', 'iban_xifrat',
                  'iban_ultims4', 'client_facturat_nom', 'poder_adjunt_id', 'signant_es_administrador')
    and e.value is distinct from to_jsonb(old) -> e.key;

  if canviats is not null then
    raise exception 'La sol·licitud està en estat "%": % ho omple el client i només ho pot modificar service_role', v_status, array_to_string(canviats, ', ')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. valida_estat: la de la fase 1, més una comprovació en passar a 'signat':
--    l'autorització ha de tenir totes les dades obligatòries (titular, entitat,
--    IBAN xifrat) i, si el client és persona jurídica i el signant no és
--    administrador, el poder adjunt.
-- -----------------------------------------------------------------------------
create or replace function portal.valida_estat()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  qui    text;  -- 'personal' o 'servei': qui pot fer la transició
  falten text[] := '{}';
  v_aut  portal.autoritzacions_carrec;
  v_tipus portal.party_type;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'esborrany' then
      raise exception 'Una sol·licitud nova ha de començar en esborrany (s''ha rebut %)', new.status
        using errcode = '23514';
    end if;
    new.activat_at  := null;
    new.activat_per := null;
    return new;
  end if;

  new.activat_at  := old.activat_at;
  new.activat_per := old.activat_per;

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
    when old.status = 'signat'    and new.status = 'actiu'   then 'personal'
    when old.status = 'actiu'     and new.status = 'retirat' then 'personal'
    when old.status in ('esborrany', 'enviat', 'en_curs') and new.status = 'anullat' then 'personal'
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

  if qui = 'servei' and current_user <> 'service_role' then
    raise exception 'La transició % → % només la pot fer el servei del portal (service_role)', old.status, new.status
      using errcode = '42501';
  end if;

  if new.status = 'signat'
     and not exists (select 1 from portal.signatures s where s.request_id = new.id) then
    raise exception 'No es pot passar a signat: no hi ha cap firma registrada'
      using errcode = '23514';
  end if;

  -- Nou a la fase 2: dades completes abans de signar
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

    if cardinality(falten) > 0 then
      raise exception 'No es pot activar la sol·licitud: falta %', array_to_string(falten, ', ')
        using errcode = '23514';
    end if;

    new.activat_at  := now();
    new.activat_per := auth.uid();
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Auditoria: actor de les accions del personal fetes amb service_role
--
-- Les Edge Functions del personal escriuen amb service_role (auth.uid() és
-- nul). Les funcions d'aquesta migració fixen l'actor real a la variable
-- local portal.actor després de comprovar que és personal actiu. Només es fa
-- cas d'aquesta variable si la petició és de service_role.
-- -----------------------------------------------------------------------------
create or replace function portal.audita()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  nou      jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  vell     jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  capcal   jsonb;
  v_ip     inet;
  v_detall jsonb;
  v_actor  uuid := auth.uid();
begin
  if auth.role() = 'service_role' then
    v_actor := coalesce(nullif(current_setting('portal.actor', true), '')::uuid, v_actor);
  end if;

  begin
    capcal := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := nullif(btrim(split_part(capcal ->> 'x-forwarded-for', ',', 1)), '')::inet;
  exception when others then
    v_ip := null;
  end;

  v_detall := case tg_op
    when 'INSERT' then jsonb_build_object('nou', portal.redacta(nou))
    when 'DELETE' then jsonb_build_object('anterior', portal.redacta(vell))
    else jsonb_build_object('canvis', (
      select coalesce(jsonb_object_agg(e.key, jsonb_build_object(
               'abans',   portal.redacta(jsonb_build_object(e.key, vell -> e.key)) -> e.key,
               'despres', portal.redacta(jsonb_build_object(e.key, e.value)) -> e.key)), '{}'::jsonb)
      from jsonb_each(nou) e
      where e.value is distinct from vell -> e.key and e.key <> 'updated_at'))
  end;

  insert into portal.audit_log (actor, accio, entitat, entitat_id, ip, user_agent, detalls)
  values (
    v_actor,
    tg_op,
    tg_table_name,
    (coalesce(nou, vell) ->> 'id')::uuid,
    v_ip,
    capcal ->> 'user-agent',
    v_detall
  );
  return null;
end;
$$;

-- Comprova que p_actor és personal actiu (i OCIC si p_nivell = 'ocic') i el
-- fixa com a actor de l'auditoria fins al final de la transacció.
create function portal.actua_com(p_actor uuid, p_nivell text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if p_actor is null or not exists (
       select 1 from portal.staff_profiles
       where user_id = p_actor and actiu and (p_nivell = 'personal' or role = 'ocic')) then
    raise exception 'Només el personal actiu d''ÀMBIT%', case when p_nivell = 'ocic' then ' amb rol OCIC' else '' end
      using errcode = '42501';
  end if;
  perform set_config('portal.actor', p_actor::text, true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Funcions per al panell del personal (authenticated + RLS)
-- -----------------------------------------------------------------------------

-- Rol de l'usuari connectat al portal (null si no és personal actiu).
create function portal.el_meu_rol()
  returns portal.staff_role
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select role from portal.staff_profiles where user_id = auth.uid() and actiu;
$$;

-- Token vigent d'una sol·licitud (sense el hash): per mostrar-ne la caducitat.
create function portal.estat_enllac(p_request_id uuid)
  returns table (creat_at timestamptz, expira_at timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select t.created_at, t.expira_at
  from portal.access_tokens t
  where portal.is_staff()
    and t.request_id = p_request_id
    and t.revocat_at is null and t.usat_at is null
    and t.expira_at > now();
$$;

-- Activació des del panell: informa data_alta i passa a 'actiu' en una sola
-- transacció. SECURITY INVOKER: s'apliquen els permisos i l'RLS de qui la crida.
create function portal.activa_autoritzacio(p_request_id uuid, p_data_alta date)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  if p_data_alta is null then
    raise exception 'Cal indicar la data d''alta' using errcode = '23514';
  end if;

  update portal.autoritzacions_carrec set data_alta = p_data_alta where request_id = p_request_id;
  if not found then
    raise exception 'No hi ha cap autorització de càrrec per a la sol·licitud %', p_request_id
      using errcode = 'P0002';
  end if;

  update portal.requests set status = 'actiu' where id = p_request_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Enllaç del client (Edge Function portal-enllac, service_role)
--    El pas esborrany → enviat el fa abans la mateixa Edge Function amb la
--    sessió del personal (authenticated), com exigeix valida_estat.
-- -----------------------------------------------------------------------------
create function portal.crea_token(p_actor uuid, p_request_id uuid, p_token_hash text, p_expira_at timestamptz)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_status portal.request_status;
  v_id     uuid;
begin
  perform portal.actua_com(p_actor, 'personal');

  select status into v_status from portal.requests where id = p_request_id for update;
  if not found then
    raise exception 'Sol·licitud inexistent' using errcode = 'P0002';
  end if;
  if v_status not in ('enviat', 'en_curs') then
    raise exception 'No es pot generar l''enllaç: la sol·licitud està en "%"', v_status
      using errcode = '23514';
  end if;
  if p_expira_at <= now() or p_expira_at > now() + interval '7 days 1 minute' then
    raise exception 'Caducitat no vàlida' using errcode = '22023';
  end if;

  -- Regenerar revoca l'anterior
  update portal.access_tokens set revocat_at = now()
   where request_id = p_request_id and revocat_at is null and usat_at is null;

  insert into portal.access_tokens (request_id, token_hash, expira_at)
  values (p_request_id, p_token_hash, p_expira_at)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Client (Edge Function pública portal-signar, service_role)
-- -----------------------------------------------------------------------------

-- Valida el token i, si és el primer cop, passa enviat → en_curs.
-- Retorna null si el token no és vàlid (la funció respon sempre igual).
create function portal.obre_per_token(p_token_hash text)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok portal.access_tokens;
  v_req portal.requests;
  v_cli portal.clients;
  v_aut portal.autoritzacions_carrec;
begin
  select * into v_tok from portal.access_tokens where token_hash = p_token_hash for update;
  if not found or v_tok.revocat_at is not null or v_tok.usat_at is not null or v_tok.expira_at <= now() then
    return null;
  end if;

  select * into v_req from portal.requests where id = v_tok.request_id for update;
  if v_req.status not in ('enviat', 'en_curs') then
    return null;
  end if;

  if v_req.status = 'enviat' then
    update portal.requests set status = 'en_curs' where id = v_req.id;
  end if;

  select * into v_cli from portal.clients where id = v_req.client_id;
  select * into v_aut from portal.autoritzacions_carrec where request_id = v_req.id;

  return jsonb_build_object(
    'token_id',          v_tok.id,
    'request_id',        v_req.id,
    'document_type',     v_req.document_type,
    'template_version',  v_req.template_version,
    'idioma',            v_req.idioma,
    'expira_at',         v_tok.expira_at,
    'client_nom',        v_cli.nom_mostrat,
    'party_type',        v_cli.party_type,
    'titular_nom',         v_aut.titular_nom,
    'titular_adreca',      v_aut.titular_adreca,
    'titular_cp_poblacio', v_aut.titular_cp_poblacio,
    'client_facturat_nom', v_aut.client_facturat_nom
  );
end;
$$;

-- Empremta SHA-256 de les dades que se signen. Es calcula sempre aquí perquè
-- el PDF i la comprovació final facin servir exactament la mateixa forma.
-- No hi entra referencia_client (l'assigna ÀMBIT, també després de signar).
create function portal.empremta_dades(
  p_request_id       uuid,
  p_signatari_nom    text,
  p_signatari_carrec text,
  p_lloc             text
)
  returns text
  language sql
  stable
  set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'request_id',       r.id,
    'document_type',    r.document_type,
    'template_version', r.template_version,
    'idioma',           r.idioma,
    'client', jsonb_build_object(
      'id',          c.id,
      'party_type',  c.party_type,
      'nom_mostrat', c.nom_mostrat),
    'autoritzacio', jsonb_build_object(
      'titular_nom',              a.titular_nom,
      'titular_adreca',           a.titular_adreca,
      'titular_cp_poblacio',      a.titular_cp_poblacio,
      'entitat',                  a.entitat,
      'iban_xifrat',              encode(a.iban_xifrat, 'hex'),
      'iban_ultims4',             a.iban_ultims4,
      'client_facturat_nom',      a.client_facturat_nom,
      'signant_es_administrador', a.signant_es_administrador,
      'poder_sha256',             d.sha256),
    'signant', jsonb_build_object(
      'nom',    p_signatari_nom,
      'carrec', p_signatari_carrec,
      'lloc',   p_lloc)
  )::text, 'UTF8')), 'hex')
  from portal.requests r
  join portal.clients c on c.id = r.client_id
  left join portal.autoritzacions_carrec a on a.request_id = r.id
  left join portal.documents d on d.id = a.poder_adjunt_id
  where r.id = p_request_id;
$$;

-- Registra la signatura en una sola transacció: comprova el token i que
-- l'empremta de les dades no ha canviat, crea la firma i els documents, passa
-- en_curs → signat i consumeix el token.
-- SECURITY INVOKER a propòsit: valida_estat exigeix current_user = service_role.
create function portal.registra_signatura(
  p_token_id         uuid,
  p_empremta         text,
  p_signatari_nom    text,
  p_signatari_carrec text,
  p_lloc             text,
  p_signat_at        timestamptz,
  p_ip               inet,
  p_user_agent       text,
  p_imatge_path      text,
  p_imatge_sha256    text,
  p_imatge_mida      bigint,
  p_pdf_path         text,
  p_pdf_sha256       text,
  p_pdf_mida         bigint
)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok    portal.access_tokens;
  v_status portal.request_status;
  v_pdf_id uuid;
begin
  select * into v_tok from portal.access_tokens where id = p_token_id for update;
  if not found or v_tok.revocat_at is not null or v_tok.usat_at is not null or v_tok.expira_at <= now() then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;

  select status into v_status from portal.requests where id = v_tok.request_id for update;
  if v_status <> 'en_curs' then
    raise exception 'La sol·licitud no està pendent de signatura' using errcode = '42501';
  end if;

  if p_signat_at is null or p_signat_at < now() - interval '10 minutes' or p_signat_at > now() + interval '1 minute' then
    raise exception 'Data de signatura no vàlida' using errcode = '22023';
  end if;

  if p_empremta is distinct from portal.empremta_dades(v_tok.request_id, p_signatari_nom, p_signatari_carrec, p_lloc) then
    raise exception 'Les dades han canviat des que s''ha generat el document; no es pot signar'
      using errcode = '40001';
  end if;

  insert into portal.signatures (request_id, signatari_nom, signatari_carrec, lloc, signat_at,
                                 imatge_path, ip, user_agent, empremta_dades)
  values (v_tok.request_id, p_signatari_nom, p_signatari_carrec, p_lloc, p_signat_at,
          p_imatge_path, p_ip, p_user_agent, p_empremta);

  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_tok.request_id, 'evidencies', p_imatge_path, p_imatge_sha256, p_imatge_mida, 'image/png');

  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_tok.request_id, 'signat', p_pdf_path, p_pdf_sha256, p_pdf_mida, 'application/pdf')
  returning id into v_pdf_id;

  update portal.requests set status = 'signat', signat_at = p_signat_at where id = v_tok.request_id;

  update portal.access_tokens set usat_at = now() where id = p_token_id;

  return v_pdf_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Remesa (Edge Function portal-remesa, service_role)
--    Retorna les autoritzacions actives amb l'IBAN xifrat (el desxifra la
--    funció) i deixa constància de l'exportació a audit_log.
-- -----------------------------------------------------------------------------
create function portal.remesa_exporta(p_actor uuid, p_ip inet, p_user_agent text)
  returns table (request_id uuid, referencia_client text, titular_nom text, entitat text, iban_xifrat bytea)
  language plpgsql
  set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform portal.actua_com(p_actor, 'personal');

  select coalesce(array_agg(r.id order by c.referencia_client), '{}') into v_ids
  from portal.requests r
  join portal.clients c on c.id = r.client_id
  join portal.autoritzacions_carrec a on a.request_id = r.id
  where r.status = 'actiu' and r.document_type = 'autoritzacio_carrec';

  insert into portal.audit_log (actor, accio, entitat, entitat_id, ip, user_agent, detalls)
  values (p_actor, 'EXPORT', 'remesa', null, p_ip, p_user_agent,
          jsonb_build_object('files', cardinality(v_ids), 'requests', to_jsonb(v_ids)));

  return query
    select r.id, c.referencia_client::text, a.titular_nom, a.entitat, a.iban_xifrat
    from portal.requests r
    join portal.clients c on c.id = r.client_id
    join portal.autoritzacions_carrec a on a.request_id = r.id
    where r.id = any (v_ids)
    order by c.referencia_client;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Personal del portal (Edge Function portal-personal, només OCIC)
--    SECURITY DEFINER per llegir auth.users. Alta i baixa només de gestors;
--    els OCIC es donen d'alta per migració. Ningú es pot gestionar a si mateix.
-- -----------------------------------------------------------------------------
create function portal.llista_personal(p_actor uuid)
  returns table (user_id uuid, email text, role portal.staff_role, actiu boolean, created_at timestamptz)
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform portal.actua_com(p_actor, 'ocic');
  return query
    select s.user_id, u.email::text, s.role, s.actiu, s.created_at
    from portal.staff_profiles s
    join auth.users u on u.id = s.user_id
    order by s.actiu desc, u.email;
end;
$$;

create function portal.alta_gestor(p_actor uuid, p_email text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user uuid;
  v_role portal.staff_role;
begin
  perform portal.actua_com(p_actor, 'ocic');

  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No existeix cap usuari de la web amb aquest correu' using errcode = 'P0002';
  end if;
  if v_user = p_actor then
    raise exception 'No et pots gestionar a tu mateix' using errcode = '42501';
  end if;

  select role into v_role from portal.staff_profiles where user_id = v_user for update;
  if v_role = 'ocic' then
    raise exception 'Aquest usuari és OCIC; només es gestiona per migració' using errcode = '42501';
  elsif v_role = 'gestor' then
    update portal.staff_profiles set actiu = true where user_id = v_user and not actiu;
  else
    insert into portal.staff_profiles (user_id, role) values (v_user, 'gestor');
  end if;
  return v_user;
end;
$$;

create function portal.baixa_gestor(p_actor uuid, p_email text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user uuid;
  v_role portal.staff_role;
begin
  perform portal.actua_com(p_actor, 'ocic');

  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No existeix cap usuari de la web amb aquest correu' using errcode = 'P0002';
  end if;
  if v_user = p_actor then
    raise exception 'No et pots gestionar a tu mateix' using errcode = '42501';
  end if;

  select role into v_role from portal.staff_profiles where user_id = v_user for update;
  if v_role is null then
    raise exception 'Aquest usuari no és personal del portal' using errcode = 'P0002';
  elsif v_role = 'ocic' then
    raise exception 'Aquest usuari és OCIC; només es gestiona per migració' using errcode = '42501';
  end if;

  update portal.staff_profiles set actiu = false where user_id = v_user and actiu;
  return v_user;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Límit d'intents per IP de la funció pública
--     Taula tècnica: guarda el hash de la IP (no la IP), no s'audita i és
--     l'única del portal que admet esborrat (neteja de finestres de més d'un
--     dia, feta per la mateixa funció).
-- -----------------------------------------------------------------------------
create table portal.limit_intents (
  clau     text not null,
  finestra timestamptz not null,
  intents  int not null default 0,
  primary key (clau, finestra)
);
alter table portal.limit_intents enable row level security;

create function portal.registra_intent(p_clau text, p_maxim int, p_segons int)
  returns boolean
  language plpgsql
  set search_path = ''
as $$
declare
  v_finestra timestamptz := to_timestamp(floor(extract(epoch from now()) / p_segons) * p_segons);
  v_intents  int;
begin
  insert into portal.limit_intents (clau, finestra, intents)
  values (p_clau, v_finestra, 1)
  on conflict (clau, finestra) do update set intents = portal.limit_intents.intents + 1
  returning intents into v_intents;

  if random() < 0.02 then
    delete from portal.limit_intents where finestra < now() - interval '1 day';
  end if;

  return v_intents <= p_maxim;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Permisos
-- -----------------------------------------------------------------------------
revoke all on table portal.limit_intents from public, anon, authenticated;
grant select, insert, update, delete on table portal.limit_intents to service_role;

revoke all on function
  portal.actua_com(uuid, text),
  portal.el_meu_rol(),
  portal.estat_enllac(uuid),
  portal.activa_autoritzacio(uuid, date),
  portal.crea_token(uuid, uuid, text, timestamptz),
  portal.obre_per_token(text),
  portal.empremta_dades(uuid, text, text, text),
  portal.registra_signatura(uuid, text, text, text, text, timestamptz, inet, text, text, text, bigint, text, text, bigint),
  portal.remesa_exporta(uuid, inet, text),
  portal.llista_personal(uuid),
  portal.alta_gestor(uuid, text),
  portal.baixa_gestor(uuid, text),
  portal.registra_intent(text, int, int)
from public, anon, authenticated, service_role;

-- Panell del personal
grant execute on function
  portal.el_meu_rol(),
  portal.estat_enllac(uuid),
  portal.activa_autoritzacio(uuid, date)
to authenticated;

-- Edge Functions
grant execute on function
  portal.actua_com(uuid, text),
  portal.crea_token(uuid, uuid, text, timestamptz),
  portal.obre_per_token(text),
  portal.empremta_dades(uuid, text, text, text),
  portal.registra_signatura(uuid, text, text, text, text, timestamptz, inet, text, text, text, bigint, text, text, bigint),
  portal.remesa_exporta(uuid, inet, text),
  portal.llista_personal(uuid),
  portal.alta_gestor(uuid, text),
  portal.baixa_gestor(uuid, text),
  portal.registra_intent(text, int, int)
to service_role;

-- Les funcions que valida_estat i camps_client_nomes_servei criden internament
-- (is_staff) ja tenen permís des de la fase 1.
