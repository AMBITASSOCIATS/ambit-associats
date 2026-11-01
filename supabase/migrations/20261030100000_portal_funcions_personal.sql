-- Funcions SECURITY DEFINER del portal que es podien cridar amb qualsevol
-- sessió authenticated (també un usuari de la Zona Professionals) sense
-- comprovar que fos personal d'ÀMBIT.
--
-- No es pot revocar l'EXECUTE a authenticated: el personal és authenticated i
-- les fa servir des de la web, les polítiques RLS i els triggers SECURITY
-- INVOKER (valida_estat, kyc_validacio_regles, contracte_contrafirma_regles...).
-- Per això cada funció comprova qui la crida:
--   · personal actiu (portal.is_staff()), o
--   · el servidor: service_role (Edge Functions) o una connexió directa sense
--     JWT (pg_cron, portal_purga, migracions).
-- Qualsevol altre rol (authenticated que no és personal, anon...) queda fora.
--
-- · Funcions que retornen dades d'una sol·licitud: error 42501.
-- · Funcions de bloqueig (es fan servir a les polítiques): retornen «bloquejat»,
--   que a totes les polítiques vol dir denegar; així no es trenca cap consulta
--   de la Zona Professionals i no es revela res.
-- · es_signant_ambit: retorna false.
-- · el_meu_rol i firma_ambit_meva no canvien: no tenen paràmetres i només
--   retornen dades del mateix personal que les crida (res per a qui no ho és).
-- Els cossos de les funcions són els d'abans; només s'hi afegeix la comprovació.

create function portal.personal_o_servei()
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select portal.is_staff() or coalesce(auth.role(), '') in ('', 'service_role');
$$;

create function portal.exigeix_personal_o_servei()
  returns void
  language plpgsql
  stable
  set search_path = ''
as $$
begin
  if not portal.personal_o_servei() then
    raise exception 'Només el personal d''ÀMBIT' using errcode = '42501';
  end if;
end;
$$;

revoke all on function portal.personal_o_servei(), portal.exigeix_personal_o_servei() from public, anon, authenticated, service_role;

-- ─── Bloqueig (polítiques RLS i auditoria) ──────────────────────────────────

create or replace function portal.request_bloquejada(p_request_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not portal.personal_o_servei()
      or exists (select 1 from portal.requests where id = p_request_id and bloquejat_at is not null);
$$;

create or replace function portal.client_bloquejat(p_client_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not portal.personal_o_servei()
      or (exists (select 1 from portal.requests where client_id = p_client_id)
          and not exists (select 1 from portal.requests where client_id = p_client_id and bloquejat_at is null));
$$;

create or replace function portal.perceptor_bloquejat(p_perceptor_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not portal.personal_o_servei()
      or (exists (select 1 from portal.irpf_comunicacions k where k.perceptor_id = p_perceptor_id)
          and not exists (select 1 from portal.irpf_comunicacions k
                          join portal.requests r on r.id = k.request_id
                          where k.perceptor_id = p_perceptor_id and r.bloquejat_at is null));
$$;

create or replace function portal.cami_bloquejat(p_cami text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not portal.personal_o_servei() or case
    when split_part(p_cami, '/', 2) ~ '^[0-9a-f-]{36}$'
      then portal.request_bloquejada(split_part(p_cami, '/', 2)::uuid)
    else false
  end;
$$;

create or replace function portal.auditoria_bloquejada(p_entitat text, p_entitat_id uuid, p_accio text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not portal.personal_o_servei() or p_accio in ('INSERT', 'UPDATE', 'DELETE') and case p_entitat
    when 'requests'               then portal.request_bloquejada(p_entitat_id)
    when 'clients'                then portal.client_bloquejat(p_entitat_id)
    when 'autoritzacions_carrec'  then exists (select 1 from portal.autoritzacions_carrec x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'signatures'             then exists (select 1 from portal.signatures x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'documents'              then exists (select 1 from portal.documents x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'access_tokens'          then exists (select 1 from portal.access_tokens x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'otps'                   then exists (select 1 from portal.otps x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'kyc_formularis'         then exists (select 1 from portal.kyc_formularis x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'kyc_adjunts'            then exists (select 1 from portal.kyc_adjunts x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'kyc_validacions'        then exists (select 1 from portal.kyc_validacions x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'pdp_consentiments'      then exists (select 1 from portal.pdp_consentiments x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'irpf_comunicacions'     then exists (select 1 from portal.irpf_comunicacions x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'irpf_recepcions'        then exists (select 1 from portal.irpf_recepcions x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'irpf_calculs'           then exists (select 1 from portal.irpf_calculs x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'irpf_perceptors'        then portal.perceptor_bloquejat(p_entitat_id)
    when 'irpf_pagadors'          then exists (select 1 from portal.irpf_pagadors x where x.id = p_entitat_id and portal.client_bloquejat(x.client_id))
    when 'contractes'             then exists (select 1 from portal.contractes x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'contracte_originals'    then exists (select 1 from portal.contracte_originals x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'contracte_signants'     then exists (select 1 from portal.contracte_signants x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'contracte_contrafirmes' then exists (select 1 from portal.contracte_contrafirmes x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    else false
  end;
$$;


-- ─── Firma d'ÀMBIT ──────────────────────────────────────────────────────────
-- Amb p_user es podia preguntar per qualsevol usuari.

create or replace function portal.es_signant_ambit(p_user uuid default null)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.personal_o_servei() and exists (
    select 1
    from portal.staff_profiles s
    join auth.users u on u.id = s.user_id
    join portal.firmes_ambit f on f.user_id = s.user_id
    where s.user_id = coalesce(p_user, auth.uid()) and s.actiu and s.role = 'ocic'
      and lower(u.email) = portal.correu_signant_ambit());
$$;

-- ─── Funcions que retornen dades d'una sol·licitud ──────────────────────────

create or replace function portal.contracte_recompte(p_request_id uuid)
  returns TABLE(total integer, signats integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  select count(*)::int, count(signat_at)::int from portal.contracte_signants where request_id = p_request_id;
$$;

create or replace function portal.empremta_contrafirma(p_request_id uuid, p_nom text, p_carrec text, p_firma_sha256 text, p_signat_at timestamp with time zone)
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  select encode(sha256(convert_to(jsonb_build_object(
    'request_id',       r.id,
    'template_version', r.template_version,
    'original_sha256',  o.sha256,
    'signants', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'empremta', s.empremta_dades) order by s.ordre), '[]'::jsonb)
                 from portal.contracte_signants s where s.request_id = r.id),
    'ambit', jsonb_build_object('nom', p_nom, 'carrec', p_carrec, 'firma_sha256', p_firma_sha256, 'signat_at', p_signat_at)
  )::text, 'UTF8')), 'hex')
  from portal.requests r
  join portal.contracte_originals o on o.request_id = r.id
  where r.id = p_request_id and r.document_type = 'contracte';
$$;

create or replace function portal.irpf_declaracions_completes(p_request_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  select coalesce((
    select k.dades #>> '{declaracions,d1}' = 'true' and k.dades #>> '{declaracions,d2}' = 'true'
       and k.dades #>> '{declaracions,d3}' = 'true' and k.dades #>> '{declaracions,d4}' = 'true'
       and (not portal.irpf_requereix_consentiment(k.dades) or k.dades #>> '{declaracions,consentiment}' = 'true')
    from portal.irpf_comunicacions k
    where k.request_id = p_request_id), false);
$$;

create or replace function portal.irpf_parametres_json(p_exercici integer)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  select to_jsonb(p) - 'id' - 'actualitzat_per' - 'created_at' - 'updated_at'
  from portal.irpf_parametres p where p.exercici = p_exercici;
$$;

create or replace function portal.kyc_participacions(p_request_id uuid)
  returns TABLE(nom text, percentatge numeric)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  with recursive s as (
    select x ->> 'id' as id, x ->> 'nom' as nom, x ->> 'tipus' as tipus, x ->> 'soci_de' as soci_de,
           case when replace(coalesce(x ->> 'percentatge', ''), ',', '.') ~ '^\d+(\.\d+)?$'
                then replace(x ->> 'percentatge', ',', '.')::numeric end as pc
    from portal.kyc_formularis k
    cross join jsonb_array_elements(portal.llista_json(k.dades -> 'socis')) x
    where k.request_id = p_request_id
  ),
  cami as (
    select s.id, s.nom, s.tipus, s.pc as efectiu, 0 as prof from s where s.soci_de is null and s.pc > 0
    union all
    select f.id, f.nom, f.tipus, c.efectiu * f.pc / 100, c.prof + 1
    from cami c join s f on f.soci_de = c.id
    where c.tipus = 'pj' and f.pc > 0 and c.prof < 10
  )
  select min(c.nom), round(sum(c.efectiu), 2)
  from cami c
  where c.tipus = 'pf' and portal.nom_normal(c.nom) <> ''
  group by portal.nom_normal(c.nom)
  order by 2 desc;
$$;

create or replace function portal.kyc_be_no_declarats(p_request_id uuid)
  returns TABLE(nom text, percentatge numeric)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  select p.nom, p.percentatge
  from portal.kyc_participacions(p_request_id) p
  where p.percentatge > 25
    and not exists (
      select 1 from portal.kyc_formularis k
      cross join jsonb_array_elements(portal.llista_json(k.dades -> 'beneficiaris')) b
      where k.request_id = p_request_id and portal.nom_normal(b ->> 'nom') = portal.nom_normal(p.nom));
$$;

create or replace function portal.kyc_declaracions_completes(p_request_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  select coalesce((
    select k.dades #>> '{declaracions,d1}' = 'true' and k.dades #>> '{declaracions,d2}' = 'true'
       and k.dades #>> '{declaracions,d3}' = 'true' and k.dades #>> '{declaracions,d4}' = 'true'
       and (r.document_type = 'kyc_pf' or k.dades #>> '{declaracio_beneficiaris}' = 'true')
    from portal.kyc_formularis k join portal.requests r on r.id = k.request_id
    where k.request_id = p_request_id), false);
$$;

create or replace function portal.kyc_documents_requerits(p_request_id uuid)
  returns TABLE(tipus text, persona text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  with f as (
    select k.dades as d, r.document_type as t
    from portal.kyc_formularis k join portal.requests r on r.id = k.request_id
    where k.request_id = p_request_id
  )
  -- Persona física (apartat 9)
  select x.tipus, null::text
  from f, lateral (values
    ('identitat', true),
    ('domicili', true),
    -- Targeta o permís de residència: resident a Andorra sense nacionalitat andorrana
    ('residencia', f.d #>> '{identificacio,pais_residencia}' = 'AD'
                   and not coalesce(portal.llista_json(f.d #> '{identificacio,nacionalitats}') ? 'AD', false)),
    ('activitat', coalesce(f.d #>> '{activitat,tipus}', '') <> 'sense'),
    ('fons', true),
    ('representacio', coalesce(f.d #>> '{representacio,actua}' = 'true', false)),
    ('patrimoni', coalesce(f.d #>> '{ppe,exerceix}' = 'true', false) or coalesce(f.d #>> '{ppe,familiar}' = 'true', false))
  ) x(tipus, cal)
  where f.t = 'kyc_pf' and x.cal
  union all
  -- Persona jurídica (apartat 11): documents de la societat
  select x.tipus, null::text
  from f, lateral (values
    ('escriptura', true),
    ('vigencia', true),
    ('registre_be', true),
    ('nrt', true),
    -- Origen dels fons: obligatori llevat de societats de nova constitució (menys de 12 mesos)
    ('fons', coalesce(portal.data_segura(f.d #>> '{societat,data_constitucio}') <= portal.avui() - interval '12 months', true)),
    ('trust', coalesce(f.d #>> '{trust,forma_part}' = 'true', false))
  ) x(tipus, cal)
  where f.t = 'kyc_pj' and x.cal
  union all
  -- Document d'identitat de cada representant i poder dels apoderats
  select 'identitat', p ->> 'id' from f, jsonb_array_elements(portal.llista_json(f.d -> 'representants')) p
  where f.t = 'kyc_pj'
  union all
  select 'poder', p ->> 'id' from f, jsonb_array_elements(portal.llista_json(f.d -> 'representants')) p
  where f.t = 'kyc_pj' and p ->> 'actua_com' = 'apoderat'
  union all
  -- Document d'identitat de cada beneficiari efectiu i origen del patrimoni dels PPE
  -- (si és la mateixa persona que un representant, n'hi ha prou amb el document del representant)
  select 'identitat', b ->> 'id' from f, jsonb_array_elements(portal.llista_json(f.d -> 'beneficiaris')) b
  where f.t = 'kyc_pj'
    and not exists (select 1 from jsonb_array_elements(portal.llista_json(f.d -> 'representants')) r
                    where r ->> 'id' = b ->> 'representant_id')
  union all
  select 'patrimoni', b ->> 'id' from f, jsonb_array_elements(portal.llista_json(f.d -> 'beneficiaris')) b
  where f.t = 'kyc_pj'
    and (coalesce(b #>> '{ppe,exerceix}' = 'true', false) or coalesce(b #>> '{ppe,familiar}' = 'true', false));
$$;

create or replace function portal.kyc_documents_pendents(p_request_id uuid)
  returns TABLE(tipus text, persona text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
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
  select portal.exigeix_personal_o_servei();
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

create or replace function portal.kyc_paisos(p_request_id uuid)
  returns TABLE(pais text, origen text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  with f as (
    select k.dades as d, r.document_type as t
    from portal.kyc_formularis k join portal.requests r on r.id = k.request_id
    where k.request_id = p_request_id
  )
  select n, 'nacionalitat' from f, jsonb_array_elements_text(portal.llista_json(f.d #> '{identificacio,nacionalitats}')) n
  where f.t = 'kyc_pf'
  union all
  select f.d #>> '{identificacio,pais_residencia}', 'residència fiscal' from f where f.t = 'kyc_pf'
  union all
  select f.d #>> '{societat,pais_constitucio}', 'país de constitució' from f where f.t = 'kyc_pj'
  union all
  select f.d #>> '{societat,pais_activitat}', 'país d''establiment de l''activitat' from f where f.t = 'kyc_pj'
  union all
  select n, 'nacionalitat del beneficiari efectiu ' || coalesce(b ->> 'nom', '')
  from f, jsonb_array_elements(portal.llista_json(f.d -> 'beneficiaris')) b,
       jsonb_array_elements_text(portal.llista_json(b -> 'nacionalitats')) n
  where f.t = 'kyc_pj'
  union all
  select b ->> 'pais_residencia', 'residència del beneficiari efectiu ' || coalesce(b ->> 'nom', '')
  from f, jsonb_array_elements(portal.llista_json(f.d -> 'beneficiaris')) b
  where f.t = 'kyc_pj';
$$;

create or replace function portal.kyc_marques(p_request_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_d   jsonb;
  v_t   portal.document_type;
  v_out jsonb := '[]'::jsonb;
  v     record;
begin
  perform portal.exigeix_personal_o_servei();
  select k.dades, r.document_type into v_d, v_t
  from portal.kyc_formularis k join portal.requests r on r.id = k.request_id
  where k.request_id = p_request_id;
  if not found then
    return v_out;
  end if;

  -- PPE, familiar o persona afí
  if v_t = 'kyc_pf' and (v_d #>> '{ppe,exerceix}' = 'true' or v_d #>> '{ppe,familiar}' = 'true') then
    v_out := v_out || jsonb_build_object('codi', 'ppe', 'detall',
      case when v_d #>> '{ppe,exerceix}' = 'true' then 'El client és PPE' else 'El client és familiar o persona afí d''una PPE' end);
  end if;
  if v_t = 'kyc_pj' then
    for v in select b ->> 'nom' as nom, b #>> '{ppe,exerceix}' = 'true' as ppe
             from jsonb_array_elements(portal.llista_json(v_d -> 'beneficiaris')) b
             where b #>> '{ppe,exerceix}' = 'true' or b #>> '{ppe,familiar}' = 'true' loop
      v_out := v_out || jsonb_build_object('codi', 'ppe', 'detall',
        'Beneficiari efectiu ' || coalesce(v.nom, '') || case when v.ppe then ': PPE' else ': familiar o persona afí d''una PPE' end);
    end loop;
  end if;

  -- Països a les llistes vigents
  for v in select distinct p.pais, p.origen, l.llista, l.referencia, l.categoria, l.nom
           from portal.kyc_paisos(p_request_id) p
           join portal.paisos_risc l on l.pais = p.pais and l.baixa_at is null
           order by l.categoria desc, p.pais, l.llista loop
    v_out := v_out || jsonb_build_object(
      'codi', case when v.categoria = 'prohibicio_total' then 'prohibicio_total' else 'pais_risc' end,
      'pais', v.pais, 'llista', v.llista, 'referencia', v.referencia,
      'detall', v.nom || ' (' || v.origen || ') · ' || v.referencia ||
                case when v.categoria = 'prohibicio_total' then ' · prohibició total' else '' end);
  end loop;

  -- Rússia o Belarús: respostes afirmatives o país declarat
  if v_d #>> '{sancions,residencia_ru_by}' = 'true' or v_d #>> '{sancions,actua_ru_by}' = 'true'
     or v_d #>> '{sancions,establert_ru_by}' = 'true'
     or exists (select 1 from portal.kyc_paisos(p_request_id) p where p.pais in ('RU', 'BY')) then
    v_out := v_out || jsonb_build_object('codi', 'russia_belarus', 'detall',
      'Vincle amb la Federació Russa o la República de Belarús');
  end if;

  -- Persones de més del 25 % no declarades com a beneficiari efectiu
  if v_t = 'kyc_pj' then
    for v in select * from portal.kyc_be_no_declarats(p_request_id) loop
      v_out := v_out || jsonb_build_object('codi', 'be_no_declarat', 'detall',
        v.nom || ': ' || rtrim(rtrim(v.percentatge::text, '0'), '.') || ' % directe i indirecte, no declarat com a beneficiari efectiu');
    end loop;
  end if;

  -- Trust a l'estructura
  if v_t = 'kyc_pj' and v_d #>> '{trust,forma_part}' = 'true' then
    v_out := v_out || jsonb_build_object('codi', 'trust', 'detall', 'Fideïcomís (trust) o instrument anàleg a l''estructura');
  end if;

  return v_out;
end;
$$;

create or replace function portal.llistes_vigents()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.exigeix_personal_o_servei();
  select jsonb_build_object(
    'UE',   (select coalesce(jsonb_agg(distinct referencia), '[]'::jsonb) from portal.paisos_risc where llista = 'UE' and baixa_at is null),
    'GAFI', (select coalesce(jsonb_agg(distinct referencia), '[]'::jsonb) from portal.paisos_risc where llista = 'GAFI' and baixa_at is null),
    'versio_at', (select max(greatest(alta_at, coalesce(baixa_at, alta_at))) from portal.paisos_risc));
$$;
