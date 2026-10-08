-- =============================================================================
-- Portal de signatura · KYC i protecció de dades (2 de 2)
--
-- Una sol·licitud "KYC i protecció de dades" són DUES sol·licituds enllaçades
-- (portal.requests), amb un sol enllaç per al client:
--   · el KYC (kyc_pf o kyc_pj), que porta el token i el formulari;
--   · la informació sobre protecció de dades (pdp).
-- Cadascuna té la seva signatura, el seu PDF amb full d'evidències i el seu
-- termini de conservació (Llei 14/2017 per al KYC; Llei 29/2021 per a la PDP).
--
-- Cicle del KYC: esborrany → enviat → en_curs → signat ("pendent de
-- validació de l'OCIC") → actiu ("validat"). Només l'OCIC valida i anul·la.
--
-- Les regles de les fases 1 a 3 i de la conservació es mantenen; aquesta
-- migració només hi afegeix comprovacions i amplia les funcions per als tipus
-- nous. No toca cap taula de public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configuració
-- -----------------------------------------------------------------------------

-- Terminis de conservació (mòdul existent)
alter table portal.config_conservacio
  -- KYC: cinc anys des de la fi de la relació (art. 37.1 Llei 14/2017); després, destrucció
  add column termini_kyc interval not null default interval '5 years' check (termini_kyc >= interval '0'),
  -- Protecció de dades: relació + sis anys; després, el bloqueig general (termini_bloqueig)
  add column termini_pdp interval not null default interval '6 years' check (termini_pdp >= interval '0');

-- Revisió periòdica del KYC segons el risc (CT-01/2023). Una sola fila; es
-- canvia amb una migració: update portal.config_kyc set revisio_risc_alt = interval '6 months';
create table portal.config_kyc (
  id                  uuid primary key default gen_random_uuid(),
  unica               boolean not null default true unique check (unica),
  revisio_risc_reduit interval not null default interval '5 years' check (revisio_risc_reduit > interval '0'),
  revisio_risc_normal interval not null default interval '3 years' check (revisio_risc_normal > interval '0'),
  revisio_risc_alt    interval not null default interval '1 year'  check (revisio_risc_alt > interval '0'),
  dies_avis_revisio   int not null default 90 check (dies_avis_revisio between 1 and 730),
  updated_at          timestamptz not null default now()
);
insert into portal.config_kyc default values;
create trigger set_updated_at before update on portal.config_kyc
  for each row execute function portal.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Client: fi de la relació (la fixa l'OCIC) i consentiment comercial
-- -----------------------------------------------------------------------------
alter table portal.clients
  add column data_fi_relacio            date,
  add column consentiment_comercial     boolean,
  add column consentiment_comercial_at  timestamptz,
  add column consentiment_retirat_el    date,
  add column consentiment_retirada_nota text,
  add constraint clients_consentiment_coherent
    check ((consentiment_comercial is null) = (consentiment_comercial_at is null)),
  add constraint clients_retirada_coherent
    check (consentiment_retirat_el is null or consentiment_comercial is true);

-- · data_fi_relacio: només l'OCIC (sessió authenticated) o les migracions.
-- · consentiment_comercial(_at): només el servei del portal, en signar la PDP.
-- · consentiment_retirat_el / nota: el personal (anotar la retirada).
-- SECURITY INVOKER a propòsit: current_user ha de ser el rol real.
create function portal.camps_restringits_client()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  vell jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  nou  jsonb := to_jsonb(new);
  canvia boolean;
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if (nou -> 'data_fi_relacio') is distinct from coalesce(vell -> 'data_fi_relacio', 'null'::jsonb)
     and not (current_user = 'authenticated' and portal.is_ocic()) then
    raise exception 'Només l''OCIC pot fixar la data de fi de la relació' using errcode = '42501';
  end if;

  canvia := (nou -> 'consentiment_comercial') is distinct from coalesce(vell -> 'consentiment_comercial', 'null'::jsonb)
         or (nou -> 'consentiment_comercial_at') is distinct from coalesce(vell -> 'consentiment_comercial_at', 'null'::jsonb);
  if canvia and current_user <> 'service_role' then
    raise exception 'El consentiment comercial només el registra el client en signar la informació de protecció de dades'
      using errcode = '42501';
  end if;

  canvia := (nou -> 'consentiment_retirat_el') is distinct from coalesce(vell -> 'consentiment_retirat_el', 'null'::jsonb)
         or (nou -> 'consentiment_retirada_nota') is distinct from coalesce(vell -> 'consentiment_retirada_nota', 'null'::jsonb);
  if canvia and not (current_user = 'service_role'
                     or (current_user = 'authenticated' and portal.is_staff())) then
    raise exception 'Només el personal d''ÀMBIT pot anotar la retirada del consentiment' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger camps_restringits_client
  before insert or update on portal.clients
  for each row execute function portal.camps_restringits_client();

-- -----------------------------------------------------------------------------
-- 3. Llistes de països de risc (comunicats tècnics de la UIFAND)
--    Versionada per períodes: no s'esborra mai cap fila; treure un país
--    n'informa la baixa. La llista vigent són les files sense baixa.
-- -----------------------------------------------------------------------------
create table portal.paisos_risc (
  id          uuid primary key default gen_random_uuid(),
  llista      text not null check (llista in ('UE', 'GAFI')),
  referencia  text not null check (btrim(referencia) <> ''),   -- p. ex. CT-01/2026
  pais        text not null check (pais ~ '^[A-Z]{2}$'),       -- ISO 3166-1 alfa-2
  nom         text not null check (btrim(nom) <> ''),          -- tal com surt al comunicat
  categoria   text not null check (categoria in ('risc', 'prohibicio_total')),
  alta_at     timestamptz not null default now(),
  alta_per    uuid references auth.users (id) on delete restrict,
  baixa_at    timestamptz,
  baixa_per   uuid references auth.users (id) on delete restrict,
  motiu_baixa text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (baixa_at is null or btrim(coalesce(motiu_baixa, '')) <> ''),
  check (categoria = 'risc' or llista = 'GAFI')
);
create unique index paisos_risc_un_vigent on portal.paisos_risc (llista, pais) where baixa_at is null;
create trigger set_updated_at before update on portal.paisos_risc
  for each row execute function portal.set_updated_at();

-- Una fila només pot rebre la baixa (una vegada); la resta no canvia mai
create function portal.paisos_risc_nomes_baixa()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if old.baixa_at is not null
     or (new.id, new.llista, new.referencia, new.pais, new.nom, new.categoria, new.alta_at, new.alta_per, new.created_at)
        is distinct from
        (old.id, old.llista, old.referencia, old.pais, old.nom, old.categoria, old.alta_at, old.alta_per, old.created_at) then
    raise exception 'Les llistes de països són versionades: només es pot donar de baixa un país vigent'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger paisos_risc_nomes_baixa before update on portal.paisos_risc
  for each row execute function portal.paisos_risc_nomes_baixa();

-- Contingut inicial: comunicats tècnics vigents a 08/10/2026
--  · CT-01/2026 (29/01/2026): llista de països de risc de la Unió Europea
--  · CT-03/2026 (22/06/2026): llista del GAFI; prohibició total per a
--    Corea del Nord, Iran i Myanmar
insert into portal.paisos_risc (llista, referencia, pais, nom, categoria) values
  ('UE', 'CT-01/2026', 'KP', 'República Democràtica de Corea del Nord', 'risc'),
  ('UE', 'CT-01/2026', 'IR', 'Iran', 'risc'),
  ('UE', 'CT-01/2026', 'AF', 'Afganistan', 'risc'),
  ('UE', 'CT-01/2026', 'DZ', 'Algèria', 'risc'),
  ('UE', 'CT-01/2026', 'AO', 'Angola', 'risc'),
  ('UE', 'CT-01/2026', 'BO', 'Bolívia', 'risc'),
  ('UE', 'CT-01/2026', 'CM', 'Camerun', 'risc'),
  ('UE', 'CT-01/2026', 'CI', 'Costa de Marfil', 'risc'),
  ('UE', 'CT-01/2026', 'RU', 'Federació Russa', 'risc'),
  ('UE', 'CT-01/2026', 'HT', 'Haití', 'risc'),
  ('UE', 'CT-01/2026', 'YE', 'Iemen', 'risc'),
  ('UE', 'CT-01/2026', 'VG', 'Illes Verges Britàniques', 'risc'),
  ('UE', 'CT-01/2026', 'KE', 'Kènia', 'risc'),
  ('UE', 'CT-01/2026', 'LA', 'Laos', 'risc'),
  ('UE', 'CT-01/2026', 'LB', 'Líban', 'risc'),
  ('UE', 'CT-01/2026', 'MC', 'Mònaco', 'risc'),
  ('UE', 'CT-01/2026', 'MM', 'Myanmar', 'risc'),
  ('UE', 'CT-01/2026', 'NA', 'Namíbia', 'risc'),
  ('UE', 'CT-01/2026', 'NP', 'Nepal', 'risc'),
  ('UE', 'CT-01/2026', 'CD', 'República Democràtica del Congo', 'risc'),
  ('UE', 'CT-01/2026', 'SY', 'Síria', 'risc'),
  ('UE', 'CT-01/2026', 'SS', 'Sudan del Sud', 'risc'),
  ('UE', 'CT-01/2026', 'TT', 'Trinitat i Tobago', 'risc'),
  ('UE', 'CT-01/2026', 'VU', 'Vanuatu', 'risc'),
  ('UE', 'CT-01/2026', 'VE', 'Veneçuela', 'risc'),
  ('UE', 'CT-01/2026', 'VN', 'Vietnam', 'risc'),
  ('GAFI', 'CT-03/2026', 'KP', 'República Democràtica de Corea del Nord', 'prohibicio_total'),
  ('GAFI', 'CT-03/2026', 'IR', 'Iran', 'prohibicio_total'),
  ('GAFI', 'CT-03/2026', 'MM', 'Myanmar', 'prohibicio_total'),
  ('GAFI', 'CT-03/2026', 'AO', 'Angola', 'risc'),
  ('GAFI', 'CT-03/2026', 'BO', 'Bolívia', 'risc'),
  ('GAFI', 'CT-03/2026', 'BA', 'Bòsnia i Hercegovina', 'risc'),
  ('GAFI', 'CT-03/2026', 'BG', 'Bulgària', 'risc'),
  ('GAFI', 'CT-03/2026', 'CM', 'Camerun', 'risc'),
  ('GAFI', 'CT-03/2026', 'CI', 'Costa de Marfil', 'risc'),
  ('GAFI', 'CT-03/2026', 'HT', 'Haití', 'risc'),
  ('GAFI', 'CT-03/2026', 'YE', 'Iemen', 'risc'),
  ('GAFI', 'CT-03/2026', 'VG', 'Illes Verges Britàniques', 'risc'),
  ('GAFI', 'CT-03/2026', 'IQ', 'Iraq', 'risc'),
  ('GAFI', 'CT-03/2026', 'KE', 'Kènia', 'risc'),
  ('GAFI', 'CT-03/2026', 'KW', 'Kuwait', 'risc'),
  ('GAFI', 'CT-03/2026', 'LB', 'Líban', 'risc'),
  ('GAFI', 'CT-03/2026', 'MC', 'Mònaco', 'risc'),
  ('GAFI', 'CT-03/2026', 'NP', 'Nepal', 'risc'),
  ('GAFI', 'CT-03/2026', 'PG', 'Papua Nova Guinea', 'risc'),
  ('GAFI', 'CT-03/2026', 'LA', 'República Popular Democràtica de Laos', 'risc'),
  -- Al comunicat hi diu "República Popular Democràtica del Congo": és la R. D. del Congo (CD)
  ('GAFI', 'CT-03/2026', 'CD', 'República Popular Democràtica del Congo', 'risc'),
  ('GAFI', 'CT-03/2026', 'SY', 'Síria', 'risc'),
  ('GAFI', 'CT-03/2026', 'SS', 'Sudan del Sud', 'risc'),
  ('GAFI', 'CT-03/2026', 'VE', 'Veneçuela', 'risc'),
  ('GAFI', 'CT-03/2026', 'VN', 'Vietnam', 'risc');

-- -----------------------------------------------------------------------------
-- 4. Formulari KYC
-- -----------------------------------------------------------------------------
create table portal.kyc_formularis (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null unique references portal.requests (id) on delete restrict,
  -- Sol·licitud PDP enllaçada. Sense clau forana a propòsit: la PDP i el KYC
  -- tenen terminis de conservació diferents i s'han de poder destruir per separat.
  pdp_request_id uuid not null unique,
  revisio_de     uuid,          -- KYC validat anterior (revisió periòdica); sense clau forana pel mateix motiu
  motiu_revisio  text,          -- intern: mai no es mostra al client (art. 26 Llei 14/2017)
  dades          jsonb not null default '{}'::jsonb check (jsonb_typeof(dades) = 'object'),
  desat_at       timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger set_updated_at before update on portal.kyc_formularis
  for each row execute function portal.set_updated_at();

-- Documents que adjunta el client, per tipus (i per persona, en persona jurídica)
create table portal.kyc_adjunts (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references portal.requests (id) on delete restrict,
  document_id uuid not null unique references portal.documents (id) on delete restrict,
  tipus       text not null check (tipus ~ '^[a-z_]{2,30}$'),
  persona     text check (persona is null or persona ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  nom_fitxer  text check (nom_fitxer is null or length(nom_fitxer) <= 200),
  retirat_at  timestamptz,      -- el client l'ha tret abans de signar (no s'esborra mai)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on portal.kyc_adjunts (request_id);
create trigger set_updated_at before update on portal.kyc_adjunts
  for each row execute function portal.set_updated_at();

-- Consentiment de comunicacions comercials, tal com s'ha signat a la PDP
create table portal.pdp_consentiments (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid not null unique references portal.requests (id) on delete restrict,
  consentiment_comercial boolean not null,
  created_at             timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. Validació de l'OCIC
-- -----------------------------------------------------------------------------
create type portal.nivell_diligencia as enum ('simplificada', 'normal', 'reforcada');
create type portal.via_verificacio   as enum ('presencial', 'copia_notarial', 'certificat_qualificat');

create table portal.kyc_validacions (
  id                    uuid primary key default gen_random_uuid(),
  request_id            uuid not null unique references portal.requests (id) on delete restrict,
  nivell                portal.nivell_diligencia not null,
  justificacio          text not null check (btrim(justificacio) <> ''),
  verificacio_via       portal.via_verificacio not null,
  verificacio_data      date not null,
  verificacio_persona   text not null check (btrim(verificacio_persona) <> ''),
  sancions_data         date not null,
  -- Llistes fixes marcades (totes obligatòries, portal.llistes_sancions) i altres
  -- llistes opcionals. sancions_llistes és el text complet; el fixa el trigger.
  sancions_llistes_marcades text[] not null default '{}',
  sancions_altres       text,
  sancions_llistes      text not null check (btrim(sancions_llistes) <> ''),
  sancions_resultat     text not null check (btrim(sancions_resultat) <> ''),
  sancions_evidencia_id uuid not null references portal.documents (id) on delete restrict,
  rbe_data              date,
  rbe_resultat          text,
  alta_direccio_nom     text,
  alta_direccio_data    date,
  -- Els fixa el trigger (s'ignora el que arribi a la petició)
  marques               jsonb not null default '[]'::jsonb,
  llistes               jsonb not null default '{}'::jsonb,
  propera_revisio       date,
  validat_per           uuid references auth.users (id) on delete restrict,
  validat_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

-- Firma manuscrita de cada OCIC: la imatge és al bucket privat portal-firmes,
-- al qual només accedeix el servei. Es fa servir només en validar un KYC.
create table portal.firmes_ocic (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete restrict,
  nom         text not null check (btrim(nom) <> ''),
  imatge_path text not null check (imatge_path ~ '^ocic/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg)$'),
  sha256      text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on portal.firmes_ocic
  for each row execute function portal.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-firmes', 'portal-firmes', false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
-- Sense cap política a storage.objects per a portal-firmes: ni el personal ni
-- els usuaris de la web hi poden llegir ni escriure; només service_role.

-- Un sol PDF final (validat) per KYC
create unique index documents_un_validat on portal.documents (request_id) where kind = 'validat';

-- -----------------------------------------------------------------------------
-- 6. Auxiliars
-- -----------------------------------------------------------------------------
create function portal.es_kyc(t portal.document_type)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select t in ('kyc_pf', 'kyc_pj');
$$;

-- Data d'un text AAAA-MM-DD o null si no és vàlida (mai no falla)
create function portal.data_segura(t text)
  returns date
  language plpgsql
  immutable
  set search_path = ''
as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return t::date;
exception when others then
  return null;
end;
$$;

-- Avui a Andorra
create function portal.avui()
  returns date
  language sql
  stable
  set search_path = ''
as $$
  select (now() at time zone 'Europe/Andorra')::date;
$$;

-- Llista JSON segura (array o buida)
create function portal.llista_json(j jsonb)
  returns jsonb
  language sql
  immutable
  set search_path = ''
as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Documents obligatoris segons les respostes (font única: el portal-kyc i
--    el panell els demanen aquí, i valida_estat no deixa signar si en falta cap)
-- -----------------------------------------------------------------------------
create function portal.kyc_documents_requerits(p_request_id uuid)
  returns table (tipus text, persona text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
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

create function portal.kyc_documents_pendents(p_request_id uuid)
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
      and a.persona is not distinct from q.persona and a.retirat_at is null);
$$;

-- Declaracions obligatòries marcades (apartat 8 PF, 5 i 10 PJ)
create function portal.kyc_declaracions_completes(p_request_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce((
    select k.dades #>> '{declaracions,d1}' = 'true' and k.dades #>> '{declaracions,d2}' = 'true'
       and k.dades #>> '{declaracions,d3}' = 'true' and k.dades #>> '{declaracions,d4}' = 'true'
       and (r.document_type = 'kyc_pf' or k.dades #>> '{declaracio_beneficiaris}' = 'true')
    from portal.kyc_formularis k join portal.requests r on r.id = k.request_id
    where k.request_id = p_request_id), false);
$$;

-- -----------------------------------------------------------------------------
-- 8. Marques automàtiques que veu l'OCIC
--    PPE · país de risc (CT UE o GAFI vigents) · prohibició total · Rússia o
--    Belarús · trust. Es calculen sempre amb les llistes vigents; en validar,
--    se'n desa una còpia a kyc_validacions.
-- -----------------------------------------------------------------------------
create function portal.kyc_paisos(p_request_id uuid)
  returns table (pais text, origen text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
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

-- Percentatge directe + indirecte de cada persona física de l'estructura de
-- propietat (mateix càlcul que kyc-regles.js): el percentatge de cada soci
-- persona física multiplicat pels de les societats per sobre seu; si la mateixa
-- persona hi surt més d'un cop, se sumen.
create function portal.nom_normal(n text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(n, '')), '\s+', ' ', 'g'));
$$;

create function portal.kyc_participacions(p_request_id uuid)
  returns table (nom text, percentatge numeric)
  language sql
  stable
  security definer
  set search_path = ''
as $$
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

-- Persones de més del 25 % que no són a la llista de beneficiaris efectius
create function portal.kyc_be_no_declarats(p_request_id uuid)
  returns table (nom text, percentatge numeric)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.nom, p.percentatge
  from portal.kyc_participacions(p_request_id) p
  where p.percentatge > 25
    and not exists (
      select 1 from portal.kyc_formularis k
      cross join jsonb_array_elements(portal.llista_json(k.dades -> 'beneficiaris')) b
      where k.request_id = p_request_id and portal.nom_normal(b ->> 'nom') = portal.nom_normal(p.nom));
$$;

create function portal.kyc_marques(p_request_id uuid)
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

-- Referències de les llistes vigents (es desen amb cada validació)
create function portal.llistes_vigents()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object(
    'UE',   (select coalesce(jsonb_agg(distinct referencia), '[]'::jsonb) from portal.paisos_risc where llista = 'UE' and baixa_at is null),
    'GAFI', (select coalesce(jsonb_agg(distinct referencia), '[]'::jsonb) from portal.paisos_risc where llista = 'GAFI' and baixa_at is null),
    'versio_at', (select max(greatest(alta_at, coalesce(baixa_at, alta_at))) from portal.paisos_risc));
$$;

-- -----------------------------------------------------------------------------
-- 9. valida_estat: la de la conservació, més:
--    · KYC i PDP: anul·lar només l'OCIC i amb motiu;
--    · KYC → signat: documents obligatoris i declaracions completes;
--    · PDP → signat: consentiment registrat;
--    · KYC signat → actiu (validar): només l'OCIC i amb la validació desada;
--    · la PDP no s'activa ni es retira; el KYC no es retira.
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
      if exists (select 1 from portal.kyc_documents_pendents(new.id)) then
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
-- 10. Regles de les taules noves
-- -----------------------------------------------------------------------------

-- Formulari: es crea en esborrany (personal), l'omple el client (service_role)
-- mentre és en curs i, un cop signat, ja no canvia mai.
-- SECURITY INVOKER a propòsit: current_user ha de ser el rol real.
create function portal.kyc_formulari_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req  portal.requests;
  v_pdp  portal.requests;
  v_tipus portal.party_type;
  canviats text[];
begin
  select * into v_req from portal.requests where id = new.request_id;

  if tg_op = 'INSERT' then
    select * into v_pdp from portal.requests where id = new.pdp_request_id;
    select party_type into v_tipus from portal.clients where id = v_req.client_id;
    if v_req.document_type not in ('kyc_pf', 'kyc_pj') or v_req.status <> 'esborrany' then
      raise exception 'El formulari KYC s''ha de crear amb una sol·licitud KYC en esborrany' using errcode = '23514';
    end if;
    if v_pdp.id is null or v_pdp.document_type <> 'pdp' or v_pdp.status <> 'esborrany'
       or v_pdp.client_id <> v_req.client_id then
      raise exception 'La sol·licitud de protecció de dades no és vàlida per a aquest KYC' using errcode = '23514';
    end if;
    if (v_req.document_type = 'kyc_pf') <> (v_tipus = 'pf') then
      raise exception 'El tipus de KYC no correspon al tipus de client' using errcode = '23514';
    end if;
    if exists (select 1 from portal.kyc_formularis where request_id = new.pdp_request_id or pdp_request_id = new.request_id) then
      raise exception 'Sol·licituds ja enllaçades' using errcode = '23505';
    end if;
    new.desat_at := null;
    return new;
  end if;

  select array_agg(e.key order by e.key) into canviats
  from jsonb_each(to_jsonb(new)) e
  where e.key not in ('dades', 'desat_at', 'updated_at')
    and e.value is distinct from to_jsonb(old) -> e.key;
  if canviats is not null then
    raise exception 'Del formulari KYC només es poden modificar les respostes (s''ha intentat canviar %)', array_to_string(canviats, ', ')
      using errcode = '42501';
  end if;

  if (new.dades, new.desat_at) is distinct from (old.dades, old.desat_at) then
    if exists (select 1 from portal.signatures s where s.request_id = old.request_id)
       or v_req.status not in ('enviat', 'en_curs') then
      raise exception 'El formulari KYC està en estat "%" i ja no es pot modificar', v_req.status
        using errcode = '42501';
    end if;
    if current_user <> 'service_role' then
      raise exception 'Les respostes del formulari KYC les omple el client; només el servei del portal les pot desar'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger kyc_formulari_regles
  before insert or update on portal.kyc_formularis
  for each row execute function portal.kyc_formulari_regles();

-- Adjunts del client: els registra el servei mentre el KYC és en curs (o en
-- esborrany, quan es copien d'una revisió). Després de signar, res no canvia.
-- SECURITY INVOKER a propòsit: current_user ha de ser el rol real.
create function portal.kyc_adjunt_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_status portal.request_status;
  v_tipus  portal.document_type;
begin
  if current_user <> 'service_role' then
    raise exception 'Els documents del KYC només els registra el servei del portal' using errcode = '42501';
  end if;
  select r.status, r.document_type into v_status, v_tipus from portal.requests r where r.id = new.request_id;
  if v_tipus not in ('kyc_pf', 'kyc_pj')
     or exists (select 1 from portal.signatures s where s.request_id = new.request_id) then
    raise exception 'Aquest KYC ja no admet canvis en els documents' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if v_status not in ('esborrany', 'en_curs') then
      raise exception 'Aquest KYC ja no admet documents nous' using errcode = '42501';
    end if;
    if not exists (select 1 from portal.documents d
                   where d.id = new.document_id and d.request_id = new.request_id and d.kind = 'adjunt') then
      raise exception 'El document no pertany a aquesta sol·licitud' using errcode = '23514';
    end if;
    new.retirat_at := null;
    return new;
  end if;

  if v_status <> 'en_curs' or old.retirat_at is not null
     or (new.id, new.request_id, new.document_id, new.tipus, new.persona, new.nom_fitxer, new.created_at)
        is distinct from (old.id, old.request_id, old.document_id, old.tipus, old.persona, old.nom_fitxer, old.created_at) then
    raise exception 'D''un document del KYC només es pot indicar que el client l''ha tret' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger kyc_adjunt_regles
  before insert or update on portal.kyc_adjunts
  for each row execute function portal.kyc_adjunt_regles();

-- PDF final validat: només el servei, només si el KYC està validat
create function portal.document_validat_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.kind = 'validat' then
    if current_user <> 'service_role' then
      raise exception 'El PDF validat només el genera el servei del portal' using errcode = '42501';
    end if;
    if not exists (select 1 from portal.kyc_validacions v
                   join portal.requests r on r.id = v.request_id
                   where v.request_id = new.request_id and r.status = 'actiu') then
      raise exception 'El KYC no està validat per l''OCIC' using errcode = '42501';
    end if;
    if new.storage_path !~ ('^requests/' || new.request_id || '/validat/[0-9a-f-]{36}\.pdf$') then
      raise exception 'Camí del PDF validat no vàlid' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger document_validat_regles
  before insert on portal.documents
  for each row execute function portal.document_validat_regles();

-- Llistes de sancions que cal comprovar sempre (totes obligatòries). El mateix
-- text surt al panell i al PDF final (kyc-regles.js, LLISTES_SANCIONS).
create function portal.llistes_sancions()
  returns table (ordre int, codi text, nom text)
  language sql
  immutable
  set search_path = ''
as $$
  values
    (1, 'onu', 'Llista consolidada del Consell de Seguretat de l''ONU'),
    (2, 'cp_1_2026', 'Resolució 1/2026 de la Comissió Permanent (capítol novè de la Llei 14/2017)'),
    (3, 'decret_182_2026', 'Decret 182/2026, annexos 1 i 2 (Llei 5/2022)'),
    (4, 'ct_02_2016', 'Comunicat tècnic CT-02/2016, annex');
$$;

-- Validació: totes les regles a la base (també si s'insereix directament).
-- SECURITY INVOKER a propòsit: només l'OCIC amb la seva sessió.
create function portal.kyc_validacio_regles()
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

create trigger kyc_validacio_regles
  before insert on portal.kyc_validacions
  for each row execute function portal.kyc_validacio_regles();

-- La validació i el pas a 'actiu' van sempre junts (portal.valida_kyc)
create function portal.kyc_validacio_amb_estat()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not exists (select 1 from portal.requests where id = new.request_id and status = 'actiu') then
    raise exception 'La validació del KYC s''ha de fer amb portal.valida_kyc()' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger kyc_validacio_amb_estat
  after insert on portal.kyc_validacions
  deferrable initially deferred
  for each row execute function portal.kyc_validacio_amb_estat();

-- Consentiment PDP: només el servei, en signar
create function portal.pdp_consentiment_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'El consentiment el registra el client en signar' using errcode = '42501';
  end if;
  if not exists (select 1 from portal.requests r where r.id = new.request_id and r.document_type = 'pdp' and r.status = 'en_curs') then
    raise exception 'La sol·licitud de protecció de dades no està pendent de signatura' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pdp_consentiment_regles
  before insert on portal.pdp_consentiments
  for each row execute function portal.pdp_consentiment_regles();

-- -----------------------------------------------------------------------------
-- 11. Auditoria, prohibició d'esborrat i immutabilitat
-- -----------------------------------------------------------------------------

-- Les respostes del formulari no es copien senceres a cada desada automàtica:
-- al registre hi queda la seva empremta (sha256). La resta, com fins ara.
create or replace function portal.redacta(j jsonb)
  returns jsonb
  language sql
  immutable
  set search_path = ''
as $$
  select coalesce(jsonb_object_agg(
           key,
           case when key in ('iban_xifrat', 'token_hash', 'codi_hash') and value <> 'null'::jsonb
                  then to_jsonb('[ocult]'::text)
                when key = 'dades' and value <> 'null'::jsonb
                  then to_jsonb('sha256:' || encode(sha256(convert_to(value::text, 'UTF8')), 'hex'))
                else value end), '{}'::jsonb)
  from jsonb_each(j);
$$;

do $$
declare
  t text;
begin
  foreach t in array array['kyc_formularis', 'kyc_adjunts', 'pdp_consentiments', 'kyc_validacions',
                           'paisos_risc', 'firmes_ocic', 'config_kyc'] loop
    execute format('create trigger audita after insert or update or delete on portal.%I for each row execute function portal.audita()', t);
    execute format('create trigger impedeix_delete before delete on portal.%I for each row execute function portal.impedeix_canvi()', t);
    execute format('create trigger impedeix_truncate before truncate on portal.%I for each statement execute function portal.impedeix_canvi()', t);
    execute format('alter table portal.%I enable row level security', t);
  end loop;
end;
$$;

-- Validacions i consentiments no admeten UPDATE (com signatures i documents)
create trigger impedeix_update before update on portal.kyc_validacions   for each row execute function portal.impedeix_canvi();
create trigger impedeix_update before update on portal.pdp_consentiments for each row execute function portal.impedeix_canvi();

-- -----------------------------------------------------------------------------
-- 12. RLS
-- -----------------------------------------------------------------------------
create policy personal_select on portal.kyc_formularis for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_insert on portal.kyc_formularis for insert to authenticated
  with check (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_select on portal.kyc_adjunts for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_select on portal.pdp_consentiments for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_select on portal.kyc_validacions for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy ocic_insert on portal.kyc_validacions for insert to authenticated
  with check (portal.is_ocic() and not portal.request_bloquejada(request_id));
create policy personal_select on portal.paisos_risc for select to authenticated using (portal.is_staff());
create policy personal_select on portal.config_kyc  for select to authenticated using (portal.is_staff());
-- firmes_ocic: cap política per a authenticated (només service_role)

do $$
declare
  t text;
begin
  foreach t in array array['kyc_formularis', 'kyc_adjunts', 'pdp_consentiments', 'kyc_validacions'] loop
    execute format('create policy purga on portal.%I for all to portal_purga using (true) with check (true)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Funcions del client (Edge Function pública portal-kyc, service_role)
-- -----------------------------------------------------------------------------

-- Estat dels documents d'un KYC (per al formulari del client i el panell)
create function portal.kyc_estat_documents(p_request_id uuid)
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
                             'mime', d.mime, 'mida', d.mida_bytes, 'sha256', d.sha256, 'created_at', a.created_at)
                             order by a.created_at)
                           from portal.kyc_adjunts a join portal.documents d on d.id = a.document_id
                           where a.request_id = p_request_id and a.retirat_at is null), '[]'::jsonb));
$$;

-- Valida el token d'un KYC i, el primer cop, passa el KYC i la PDP a en_curs.
-- Retorna null si el token no és vàlid (la funció respon sempre igual).
create function portal.obre_kyc_per_token(p_token_hash text)
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
    'desat_at',         v_kyc.desat_at,
    'documents',        portal.kyc_estat_documents(v_req.id)
  );
end;
$$;

-- Comprova un token de KYC per a les accions d'escriptura del client
create function portal.kyc_token_vigent(p_token_id uuid)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok portal.access_tokens;
  v_req portal.requests;
begin
  select * into v_tok from portal.access_tokens where id = p_token_id for update;
  if not found or v_tok.revocat_at is not null or v_tok.usat_at is not null or v_tok.expira_at <= now() then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;
  select * into v_req from portal.requests where id = v_tok.request_id;
  if v_req.document_type not in ('kyc_pf', 'kyc_pj') or v_req.status <> 'en_curs' or v_req.bloquejat_at is not null then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;
  return v_req.id;
end;
$$;

-- Desada automàtica de les respostes. Retorna l'estat dels documents.
create function portal.kyc_desa(p_token_id uuid, p_dades jsonb)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_request uuid := portal.kyc_token_vigent(p_token_id);
begin
  if jsonb_typeof(p_dades) <> 'object' or length(p_dades::text) > 300000 then
    raise exception 'Respostes no vàlides' using errcode = '22023';
  end if;
  update portal.kyc_formularis set dades = p_dades, desat_at = now() where request_id = v_request;
  return portal.kyc_estat_documents(v_request);
end;
$$;

-- Tipus de document admesos per a cada tipus de KYC
create function portal.kyc_tipus_document_valid(p_tipus portal.document_type, p_codi text, p_persona text)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select case p_tipus
    when 'kyc_pf' then p_persona is null
                   and p_codi in ('identitat', 'domicili', 'residencia', 'activitat', 'fons', 'representacio', 'patrimoni')
    when 'kyc_pj' then (p_persona is null and p_codi in ('escriptura', 'vigencia', 'registre_be', 'nrt', 'comerc', 'fons', 'organigrama', 'trust'))
                    or (p_persona is not null and p_codi in ('identitat', 'poder', 'patrimoni'))
    else false
  end;
$$;

-- Registra un document que el client ja ha pujat (el servei n'ha comprovat
-- el format i n'ha calculat l'empremta)
create function portal.kyc_registra_adjunt(
  p_token_id uuid, p_path text, p_sha256 text, p_mida bigint, p_mime text,
  p_tipus text, p_persona text, p_nom_fitxer text
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
  insert into portal.kyc_adjunts (request_id, document_id, tipus, persona, nom_fitxer)
  values (v_request, v_doc, p_tipus, p_persona, nullif(left(p_nom_fitxer, 200), ''));
  return portal.kyc_estat_documents(v_request);
end;
$$;

create function portal.kyc_retira_adjunt(p_token_id uuid, p_adjunt_id uuid)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_request uuid := portal.kyc_token_vigent(p_token_id);
begin
  update portal.kyc_adjunts set retirat_at = now()
   where id = p_adjunt_id and request_id = v_request and retirat_at is null;
  if not found then
    raise exception 'Document inexistent' using errcode = 'P0002';
  end if;
  return portal.kyc_estat_documents(v_request);
end;
$$;

-- Empremtes SHA-256 de les dades que se signen (KYC i PDP). Es calculen
-- sempre aquí perquè el PDF i la comprovació final facin servir exactament
-- la mateixa forma. No hi entra referencia_client.
create function portal.empremta_kyc(p_request_id uuid, p_signatari_nom text, p_signatari_carrec text, p_lloc text)
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
    'client', jsonb_build_object('id', c.id, 'party_type', c.party_type, 'nom_mostrat', c.nom_mostrat),
    'pdp_request_id',   k.pdp_request_id,
    'dades',            k.dades,
    'documents', coalesce((select jsonb_agg(jsonb_build_object('tipus', a.tipus, 'persona', a.persona, 'sha256', d.sha256)
                                            order by a.tipus, a.persona nulls first, d.sha256)
                           from portal.kyc_adjunts a join portal.documents d on d.id = a.document_id
                           where a.request_id = r.id and a.retirat_at is null), '[]'::jsonb),
    'signant', jsonb_build_object('nom', p_signatari_nom, 'carrec', p_signatari_carrec, 'lloc', p_lloc)
  )::text, 'UTF8')), 'hex')
  from portal.requests r
  join portal.clients c on c.id = r.client_id
  join portal.kyc_formularis k on k.request_id = r.id
  where r.id = p_request_id;
$$;

create function portal.empremta_pdp(p_request_id uuid, p_signatari_nom text, p_signatari_carrec text, p_lloc text, p_consentiment boolean)
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
    'client', jsonb_build_object('id', c.id, 'party_type', c.party_type, 'nom_mostrat', c.nom_mostrat),
    'kyc_request_id',   k.request_id,
    'consentiment_comercial', p_consentiment,
    'signant', jsonb_build_object('nom', p_signatari_nom, 'carrec', p_signatari_carrec, 'lloc', p_lloc)
  )::text, 'UTF8')), 'hex')
  from portal.requests r
  join portal.clients c on c.id = r.client_id
  join portal.kyc_formularis k on k.pdp_request_id = r.id
  where r.id = p_request_id and r.document_type = 'pdp';
$$;

-- Registra les dues signatures (KYC i PDP) en una sola transacció: comprova
-- el token i les empremtes, crea les firmes i els documents, desa el
-- consentiment, passa les dues sol·licituds a 'signat' i consumeix el token.
-- SECURITY INVOKER a propòsit: valida_estat exigeix current_user = service_role.
-- p_kyc i p_pdp: empremta, signatari_nom, signatari_carrec, lloc,
-- imatge_path, imatge_sha256, imatge_mida, pdf_path, pdf_sha256, pdf_mida
-- (i a p_pdp, consentiment_comercial).
create function portal.registra_signatura_kyc(
  p_token_id   uuid,
  p_signat_at  timestamptz,
  p_ip         inet,
  p_user_agent text,
  p_kyc        jsonb,
  p_pdp        jsonb
)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok     portal.access_tokens;
  v_req     portal.requests;
  v_kyc     portal.kyc_formularis;
  v_pdp     portal.requests;
  v_consent boolean := (p_pdp ->> 'consentiment_comercial')::boolean;
  v_kyc_pdf uuid;
  v_pdp_pdf uuid;
begin
  select * into v_tok from portal.access_tokens where id = p_token_id for update;
  if not found or v_tok.revocat_at is not null or v_tok.usat_at is not null or v_tok.expira_at <= now() then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;

  select * into v_req from portal.requests where id = v_tok.request_id for update;
  select * into v_kyc from portal.kyc_formularis where request_id = v_req.id;
  select * into v_pdp from portal.requests where id = v_kyc.pdp_request_id for update;
  if v_req.document_type not in ('kyc_pf', 'kyc_pj') or v_req.status <> 'en_curs'
     or v_pdp.id is null or v_pdp.status <> 'en_curs' then
    raise exception 'La sol·licitud no està pendent de signatura' using errcode = '42501';
  end if;

  if p_signat_at is null or p_signat_at < now() - interval '10 minutes' or p_signat_at > now() + interval '1 minute' then
    raise exception 'Data de signatura no vàlida' using errcode = '22023';
  end if;
  if v_consent is null then
    raise exception 'Falta la resposta sobre les comunicacions comercials' using errcode = '22023';
  end if;
  -- Dues signatures diferents
  if p_kyc ->> 'imatge_sha256' = p_pdp ->> 'imatge_sha256' then
    raise exception 'La signatura de la protecció de dades ha de ser diferent de la del KYC' using errcode = '22023';
  end if;

  if p_kyc ->> 'empremta' is distinct from
     portal.empremta_kyc(v_req.id, p_kyc ->> 'signatari_nom', p_kyc ->> 'signatari_carrec', p_kyc ->> 'lloc') then
    raise exception 'Les dades han canviat des que s''ha generat el document; no es pot signar' using errcode = '40001';
  end if;
  if p_pdp ->> 'empremta' is distinct from
     portal.empremta_pdp(v_pdp.id, p_pdp ->> 'signatari_nom', p_pdp ->> 'signatari_carrec', p_pdp ->> 'lloc', v_consent) then
    raise exception 'Les dades han canviat des que s''ha generat el document; no es pot signar' using errcode = '40001';
  end if;

  -- KYC
  insert into portal.signatures (request_id, signatari_nom, signatari_carrec, lloc, signat_at,
                                 imatge_path, ip, user_agent, empremta_dades)
  values (v_req.id, p_kyc ->> 'signatari_nom', p_kyc ->> 'signatari_carrec', p_kyc ->> 'lloc', p_signat_at,
          p_kyc ->> 'imatge_path', p_ip, p_user_agent, p_kyc ->> 'empremta');
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_req.id, 'evidencies', p_kyc ->> 'imatge_path', p_kyc ->> 'imatge_sha256', (p_kyc ->> 'imatge_mida')::bigint, 'image/png');
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_req.id, 'signat', p_kyc ->> 'pdf_path', p_kyc ->> 'pdf_sha256', (p_kyc ->> 'pdf_mida')::bigint, 'application/pdf')
  returning id into v_kyc_pdf;
  update portal.requests set status = 'signat', signat_at = p_signat_at where id = v_req.id;

  -- PDP
  insert into portal.pdp_consentiments (request_id, consentiment_comercial) values (v_pdp.id, v_consent);
  insert into portal.signatures (request_id, signatari_nom, signatari_carrec, lloc, signat_at,
                                 imatge_path, ip, user_agent, empremta_dades)
  values (v_pdp.id, p_pdp ->> 'signatari_nom', p_pdp ->> 'signatari_carrec', p_pdp ->> 'lloc', p_signat_at,
          p_pdp ->> 'imatge_path', p_ip, p_user_agent, p_pdp ->> 'empremta');
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_pdp.id, 'evidencies', p_pdp ->> 'imatge_path', p_pdp ->> 'imatge_sha256', (p_pdp ->> 'imatge_mida')::bigint, 'image/png');
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_pdp.id, 'signat', p_pdp ->> 'pdf_path', p_pdp ->> 'pdf_sha256', (p_pdp ->> 'pdf_mida')::bigint, 'application/pdf')
  returning id into v_pdp_pdf;
  update portal.requests set status = 'signat', signat_at = p_signat_at where id = v_pdp.id;

  -- Consentiment comercial al client (el darrer signat és el vigent)
  update portal.clients
     set consentiment_comercial = v_consent, consentiment_comercial_at = p_signat_at,
         consentiment_retirat_el = null, consentiment_retirada_nota = null
   where id = v_req.client_id;

  update portal.access_tokens set usat_at = now() where id = p_token_id;

  return jsonb_build_object('kyc_pdf_id', v_kyc_pdf, 'pdp_pdf_id', v_pdp_pdf);
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. Funcions del personal
-- -----------------------------------------------------------------------------

-- Crea una sol·licitud "KYC i protecció de dades" (dues sol·licituds
-- enllaçades i el formulari). Amb p_revisio_de, el formulari es preomple amb
-- les respostes del KYC validat indicat (sense les declaracions, que el
-- client ha de tornar a fer). SECURITY INVOKER: permisos i RLS de qui crida.
create function portal.crea_kyc(p_client_id uuid, p_revisio_de uuid default null, p_motiu text default null)
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
          case v_tipus when 'pf' then 'KYC-PF v1' else 'KYC-PJ v1' end, 'ca')
  returning id into v_kyc;
  insert into portal.requests (client_id, document_type, template_version, idioma)
  values (p_client_id, 'pdp', 'PDP v1', 'ca')
  returning id into v_pdp;
  insert into portal.kyc_formularis (request_id, pdp_request_id, revisio_de, motiu_revisio, dades)
  values (v_kyc, v_pdp, p_revisio_de, nullif(btrim(coalesce(p_motiu, '')), ''), v_dades);
  return v_kyc;
end;
$$;

-- Documents del KYC anterior que es copien a una revisió: els que no
-- caduquen ràpidament. No es copien mai el justificant de domicili, el de
-- l'origen dels fons, el certificat de vigència ni l'extracte del Registre de
-- beneficiaris efectius; tampoc el document d'identitat (PF) si ha caducat.
create function portal.kyc_adjunts_a_copiar(p_actor uuid, p_request_id uuid)
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
    order by a.created_at;
end;
$$;

-- Registra la còpia (ja feta a Storage pel servei) d'un document a la revisió
create function portal.kyc_copia_adjunt(p_actor uuid, p_request_id uuid, p_document_origen uuid, p_nou_path text)
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
  insert into portal.kyc_adjunts (request_id, document_id, tipus, persona, nom_fitxer)
  values (p_request_id, v_nou, v_adj.tipus, v_adj.persona, v_adj.nom_fitxer);
end;
$$;

-- Anul·la un KYC (només OCIC, amb motiu) i la PDP enllaçada si no està signada
create function portal.anulla_kyc(p_request_id uuid, p_motiu text)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_pdp uuid;
begin
  select pdp_request_id into v_pdp from portal.kyc_formularis where request_id = p_request_id;
  if v_pdp is null then
    raise exception 'KYC inexistent' using errcode = 'P0002';
  end if;
  update portal.requests set status = 'anullat', motiu_anullacio = btrim(coalesce(p_motiu, ''))
   where id = p_request_id;
  update portal.requests set status = 'anullat', motiu_anullacio = btrim(coalesce(p_motiu, ''))
   where id = v_pdp and status in ('esborrany', 'enviat', 'en_curs');
end;
$$;

-- Validació de l'OCIC (sessió authenticated). Si hi ha un país de prohibició
-- total, no valida i en deixa constància a audit_log (VALIDACIO_DENEGADA).
create function portal.registra_validacio_denegada(p_request_id uuid, p_marques jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC' using errcode = '42501';
  end if;
  insert into portal.audit_log (actor, accio, entitat, entitat_id, detalls)
  values (auth.uid(), 'VALIDACIO_DENEGADA', 'requests', p_request_id,
          jsonb_build_object('motiu', 'País de prohibició total (CT-03/2026)',
                             'marques', (select coalesce(jsonb_agg(m), '[]'::jsonb) from jsonb_array_elements(p_marques) m
                                         where m ->> 'codi' = 'prohibicio_total')));
end;
$$;

create function portal.valida_kyc(p_request_id uuid, p jsonb)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_marq jsonb;
  v_id   uuid;
begin
  if not (current_user = 'authenticated' and portal.is_ocic()) then
    raise exception 'Només l''OCIC pot validar un KYC' using errcode = '42501';
  end if;
  v_marq := portal.kyc_marques(p_request_id);
  if exists (select 1 from jsonb_array_elements(v_marq) m where m ->> 'codi' = 'prohibicio_total') then
    perform portal.registra_validacio_denegada(p_request_id, v_marq);
    return jsonb_build_object('ok', false, 'motiu', 'prohibicio_total',
      'error', 'No es pot validar: hi ha un país de prohibició total (CT-03/2026). Ha quedat registrat.');
  end if;

  insert into portal.kyc_validacions (
    request_id, nivell, justificacio, verificacio_via, verificacio_data, verificacio_persona,
    sancions_data, sancions_llistes_marcades, sancions_altres, sancions_llistes, sancions_resultat, sancions_evidencia_id,
    rbe_data, rbe_resultat, alta_direccio_nom, alta_direccio_data)
  values (
    p_request_id, (p ->> 'nivell')::portal.nivell_diligencia, btrim(coalesce(p ->> 'justificacio', '')),
    (p ->> 'verificacio_via')::portal.via_verificacio, (p ->> 'verificacio_data')::date, btrim(coalesce(p ->> 'verificacio_persona', '')),
    (p ->> 'sancions_data')::date,
    coalesce((select array_agg(x) from jsonb_array_elements_text(portal.llista_json(p -> 'sancions_llistes_marcades')) x), '{}'),
    p ->> 'sancions_altres', '-', btrim(coalesce(p ->> 'sancions_resultat', '')),
    (p ->> 'sancions_evidencia_id')::uuid,
    (p ->> 'rbe_data')::date, nullif(btrim(coalesce(p ->> 'rbe_resultat', '')), ''),
    nullif(btrim(coalesce(p ->> 'alta_direccio_nom', '')), ''), (p ->> 'alta_direccio_data')::date)
  returning id into v_id;

  update portal.requests set status = 'actiu' where id = p_request_id;
  return jsonb_build_object('ok', true, 'validacio_id', v_id);
end;
$$;

-- Dades per generar el PDF final (Edge Function, service_role): només per a
-- l'OCIC que l'ha validat i si encara no hi ha PDF final.
create function portal.kyc_dades_pdf_validat(p_actor uuid, p_request_id uuid)
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
  if exists (select 1 from portal.documents where request_id = p_request_id and kind = 'validat') then
    raise exception 'El PDF final ja existeix' using errcode = '23505';
  end if;
  return jsonb_build_object(
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

create function portal.registra_pdf_validat(p_actor uuid, p_request_id uuid, p_path text, p_sha256 text, p_mida bigint)
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
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, 'validat', p_path, p_sha256, p_mida, 'application/pdf')
  returning id into v_id;
  return v_id;
end;
$$;

-- Evidència de la comprovació a les llistes de sancions (la puja l'OCIC des
-- del panell; el servei en comprova el format i en calcula l'empremta)
create function portal.kyc_registra_evidencia(p_actor uuid, p_request_id uuid, p_path text, p_sha256 text, p_mida bigint, p_mime text)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform portal.actua_com(p_actor, 'ocic');
  if not exists (select 1 from portal.requests
                 where id = p_request_id and document_type in ('kyc_pf', 'kyc_pj') and status = 'signat' and bloquejat_at is null) then
    raise exception 'Només es poden adjuntar evidències a un KYC pendent de validació' using errcode = '23514';
  end if;
  if p_path !~ ('^requests/' || p_request_id || '/ocic/[0-9a-f-]{36}\.(pdf|jpg|png)$') then
    raise exception 'Camí no vàlid' using errcode = '22023';
  end if;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, 'adjunt', p_path, p_sha256, p_mida, p_mime)
  returning id into v_id;
  return v_id;
end;
$$;

-- L'OCIC connectat té la firma manuscrita registrada?
create function portal.tinc_firma_ocic()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.is_ocic() and exists (select 1 from portal.firmes_ocic where user_id = auth.uid());
$$;

-- Fi de la relació (només OCIC; ho comprova el trigger)
create function portal.fixa_fi_relacio(p_client_id uuid, p_data date)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  if p_data is not null and p_data > portal.avui() then
    raise exception 'La data de fi de la relació no pot ser futura' using errcode = '23514';
  end if;
  update portal.clients set data_fi_relacio = p_data where id = p_client_id;
  if not found then
    raise exception 'Client inexistent' using errcode = 'P0002';
  end if;
end;
$$;

-- Anotar la retirada del consentiment de comunicacions comercials
create function portal.anota_retirada_consentiment(p_client_id uuid, p_data date, p_nota text)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  if p_data is null or p_data > portal.avui() then
    raise exception 'Cal indicar la data de la retirada (no futura)' using errcode = '23514';
  end if;
  update portal.clients
     set consentiment_retirat_el = p_data, consentiment_retirada_nota = nullif(btrim(coalesce(p_nota, '')), '')
   where id = p_client_id and consentiment_comercial is true and consentiment_retirat_el is null;
  if not found then
    raise exception 'Aquest client no té cap consentiment vigent' using errcode = 'P0002';
  end if;
end;
$$;

-- Revisions KYC (només OCIC): darrer KYC validat de cada client amb la
-- relació vigent, vençut o que venç en p_dies (per defecte, config_kyc)
create function portal.revisions_kyc(p_dies int default null)
  returns table (client_id uuid, nom_mostrat text, referencia_client text, request_id uuid,
                 nivell portal.nivell_diligencia, validat_at timestamptz, propera_revisio date,
                 vencuda boolean, revisio_en_curs uuid, revisio_estat portal.request_status)
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_dies int := coalesce(p_dies, (select dies_avis_revisio from portal.config_kyc));
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC' using errcode = '42501';
  end if;
  return query
    with darrer as (
      select distinct on (r.client_id) r.client_id, r.id, v.nivell, v.validat_at, v.propera_revisio
      from portal.requests r join portal.kyc_validacions v on v.request_id = r.id
      where r.status = 'actiu' and r.bloquejat_at is null
      order by r.client_id, v.validat_at desc
    )
    select c.id, c.nom_mostrat, c.referencia_client::text, d.id, d.nivell, d.validat_at, d.propera_revisio,
           d.propera_revisio <= portal.avui(),
           n.id, n.status
    from darrer d
    join portal.clients c on c.id = d.client_id
    left join lateral (
      select r2.id, r2.status from portal.requests r2
      where r2.client_id = d.client_id and r2.document_type in ('kyc_pf', 'kyc_pj')
        and r2.created_at > d.validat_at and r2.status in ('esborrany', 'enviat', 'en_curs', 'signat')
      order by r2.created_at desc limit 1) n on true
    where c.data_fi_relacio is null
      and d.propera_revisio <= portal.avui() + v_dies
    order by d.propera_revisio;
end;
$$;

-- Llistes de països (només OCIC). Cada canvi queda a audit_log.
create function portal.afegeix_pais_risc(p_llista text, p_referencia text, p_pais text, p_nom text, p_categoria text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC pot modificar les llistes de països' using errcode = '42501';
  end if;
  insert into portal.paisos_risc (llista, referencia, pais, nom, categoria, alta_per)
  values (p_llista, btrim(p_referencia), upper(btrim(p_pais)), btrim(p_nom), p_categoria, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create function portal.treu_pais_risc(p_id uuid, p_motiu text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC pot modificar les llistes de països' using errcode = '42501';
  end if;
  update portal.paisos_risc set baixa_at = now(), baixa_per = auth.uid(), motiu_baixa = btrim(coalesce(p_motiu, ''))
   where id = p_id and baixa_at is null;
  if not found then
    raise exception 'País inexistent o ja donat de baixa' using errcode = 'P0002';
  end if;
end;
$$;

-- Nova versió sencera d'una llista (un comunicat nou que substitueix
-- l'anterior): dona de baixa tota la llista vigent i hi posa la nova.
-- p_paisos: [{"pais": "XX", "nom": "...", "categoria": "risc"|"prohibicio_total"}, ...]
create function portal.nova_versio_llista(p_llista text, p_referencia text, p_paisos jsonb)
  returns int
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  n int;
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC pot modificar les llistes de països' using errcode = '42501';
  end if;
  if jsonb_typeof(p_paisos) <> 'array' or jsonb_array_length(p_paisos) = 0 then
    raise exception 'La llista nova no pot ser buida' using errcode = '22023';
  end if;
  update portal.paisos_risc set baixa_at = now(), baixa_per = auth.uid(),
         motiu_baixa = 'Substituïda per ' || btrim(p_referencia)
   where llista = p_llista and baixa_at is null;
  insert into portal.paisos_risc (llista, referencia, pais, nom, categoria, alta_per)
  select p_llista, btrim(p_referencia), upper(btrim(x ->> 'pais')), btrim(x ->> 'nom'), coalesce(x ->> 'categoria', 'risc'), auth.uid()
  from jsonb_array_elements(p_paisos) x;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- 15. Conservació (integrada al mòdul existent)
--     · KYC signat o validat: data de fi de la relació + termini_kyc (5 anys);
--       després, destrucció sense bloqueig (Llei 14/2017, no LQPD). La
--       retenció existent atura la destrucció si la UIFAND amplia el termini
--       (art. 37.2), i al KYC es pot activar abans que venci.
--     · PDP signada: fi de la relació + termini_pdp (6 anys); després, el
--       bloqueig general de 3 anys i destrucció.
--     · KYC o PDP signats i anul·lats: com els signats, comptant des de la fi
--       de la relació o, si no n'hi ha, des de l'anul·lació.
--     · No signats (esborrany, enllaç caducat, anul·lats sense signar): com
--       fins ara.
-- -----------------------------------------------------------------------------
create or replace function portal.venciments(p_ara timestamptz default now())
  returns table (request_id uuid, client_id uuid, status portal.request_status, causa text, vencut_el timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with cfg as (select termini_no_signades as t, termini_kyc as tk, termini_pdp as tp from portal.config_conservacio),
  base as (
    select r.id, r.client_id, r.status,
      case
        when r.document_type in ('kyc_pf', 'kyc_pj', 'pdp') and s.id is not null
          then case when r.document_type = 'pdp' then 'fi de la relació (protecció de dades)' else 'fi de la relació (KYC)' end
        when r.status = 'retirat' then 'retirada'
        when r.status = 'anullat' then 'anul·lació'
        when r.status = 'esborrany' then 'esborrany sense canvis'
        else 'enllaç caducat'
      end as causa,
      case
        -- KYC i PDP signats (també validats o anul·lats després de signar)
        when r.document_type in ('kyc_pf', 'kyc_pj', 'pdp') and s.id is not null then
          case when c.data_fi_relacio is not null
                 then (c.data_fi_relacio::timestamp at time zone 'Europe/Andorra')
               when r.status = 'anullat'
                 then coalesce(r.anullat_at, r.updated_at)
          end + case when r.document_type = 'pdp' then (select tp from cfg) else (select tk from cfg) end
        when r.status = 'retirat' then (a.conservar_fins::timestamp at time zone 'Europe/Andorra')
        when r.status = 'anullat' then coalesce(r.anullat_at, r.updated_at) + (select t from cfg)
        when r.status = 'esborrany' then greatest(r.updated_at, coalesce(a.updated_at, r.updated_at)) + (select t from cfg)
        when r.status = 'enviat' then coalesce((select max(t.expira_at) from portal.access_tokens t where t.request_id = r.id), r.updated_at) + (select t from cfg)
        when r.status = 'en_curs' then coalesce((select max(t.expira_at) from portal.access_tokens t where t.request_id = r.id), r.updated_at) + (select t from cfg)
      end as vencut_el
    from portal.requests r
    join portal.clients c on c.id = r.client_id
    left join portal.autoritzacions_carrec a on a.request_id = r.id
    left join portal.signatures s on s.request_id = r.id
    where r.bloquejat_at is null
      and (r.status in ('retirat', 'anullat', 'esborrany', 'enviat', 'en_curs')
           or (r.document_type in ('kyc_pf', 'kyc_pj', 'pdp') and r.status in ('signat', 'actiu')))
      -- enviat / en_curs: només si no hi ha cap enllaç vigent a p_ara.
      -- La PDP no té token propi: segueix el del KYC enllaçat.
      and not (r.status in ('enviat', 'en_curs') and exists (
            select 1 from portal.access_tokens t
            where t.request_id = coalesce((select k.request_id from portal.kyc_formularis k where k.pdp_request_id = r.id), r.id)
              and t.revocat_at is null and t.usat_at is null and t.expira_at > p_ara))
  )
  select id, client_id, status, causa, vencut_el from base where vencut_el is not null;
$$;

-- Termini de bloqueig de cada tipus de document: el KYC no té bloqueig
create function portal.termini_bloqueig_de(p_request_id uuid)
  returns interval
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select case when r.document_type in ('kyc_pf', 'kyc_pj') and exists (select 1 from portal.signatures s where s.request_id = r.id)
              then interval '0'
              else (select termini_bloqueig from portal.config_conservacio) end
  from portal.requests r where r.id = p_request_id;
$$;

-- bloqueja_vencudes (propietari portal_purga): ara amb el termini de cada sol·licitud
grant portal_purga to postgres with set true;

create or replace function portal.bloqueja_vencudes(p_simulacio boolean default true)
  returns table (request_id uuid, causa text, vencut_el timestamptz, destruir_despres_de timestamptz)
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v record;
  v_termini interval;
begin
  perform set_config('portal.mode', 'bloqueig', true);
  for v in select * from portal.venciments(now()) x where x.vencut_el <= now() order by x.vencut_el loop
    v_termini := portal.termini_bloqueig_de(v.request_id);
    if not p_simulacio then
      update portal.requests
         set bloquejat_at = now(), destruir_despres_de = now() + v_termini
       where id = v.request_id and bloquejat_at is null;
    end if;
    request_id := v.request_id;
    causa := v.causa;
    vencut_el := v.vencut_el;
    destruir_despres_de := now() + v_termini;
    return next;
  end loop;
  perform set_config('portal.mode', '', true);
end;
$$;

-- destrueix_solicitud (propietari portal_purga): també les taules del KYC
create or replace function portal.destrueix_solicitud(p_request_id uuid, p_altres_fitxers int default 0)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_req       portal.requests;
  v_ids       uuid[];
  v_fitxers   jsonb;
  v_files     jsonb;
  v_client    boolean := false;
  n           int;
  v_purgades  int;
  v_resultat  jsonb;
begin
  select * into v_req from portal.requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('request_id', p_request_id, 'ja_destruida', true);
  end if;
  if v_req.bloquejat_at is null or v_req.destruir_despres_de > now() then
    raise exception 'La sol·licitud no ha arribat al final del termini de bloqueig' using errcode = '42501';
  end if;
  if exists (select 1 from portal.retencions where request_id = p_request_id and retirada_at is null) then
    raise exception 'La sol·licitud té una retenció activa' using errcode = '42501';
  end if;
  if portal.fitxers_restants(p_request_id) > 0 then
    raise exception 'Encara hi ha fitxers de la sol·licitud a portal-docs' using errcode = '55000';
  end if;

  perform set_config('portal.mode', 'purga', true);

  -- Identificadors de totes les files i empremtes dels fitxers (abans d'esborrar)
  select array_agg(x) into v_ids from (
    select v_req.id union all
    select id from portal.autoritzacions_carrec where request_id = p_request_id union all
    select id from portal.kyc_validacions       where request_id = p_request_id union all
    select id from portal.kyc_adjunts           where request_id = p_request_id union all
    select id from portal.kyc_formularis        where request_id = p_request_id union all
    select id from portal.pdp_consentiments     where request_id = p_request_id union all
    select id from portal.signatures            where request_id = p_request_id union all
    select id from portal.documents             where request_id = p_request_id union all
    select id from portal.access_tokens         where request_id = p_request_id union all
    select id from portal.otps                  where request_id = p_request_id union all
    select id from portal.retencions            where request_id = p_request_id
  ) s(x);

  select coalesce(jsonb_agg(jsonb_build_object('tipus', kind, 'sha256', sha256) order by created_at), '[]'::jsonb)
    into v_fitxers from portal.documents where request_id = p_request_id;

  v_files := '{}'::jsonb;
  delete from portal.autoritzacions_carrec where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('autoritzacions_carrec', n);
  delete from portal.kyc_validacions       where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('kyc_validacions', n);
  delete from portal.kyc_adjunts           where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('kyc_adjunts', n);
  delete from portal.kyc_formularis        where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('kyc_formularis', n);
  delete from portal.pdp_consentiments     where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('pdp_consentiments', n);
  delete from portal.signatures            where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('signatures', n);
  delete from portal.documents             where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('documents', n);
  delete from portal.access_tokens         where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('access_tokens', n);
  delete from portal.otps                  where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('otps', n);
  delete from portal.retencions            where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('retencions', n);
  delete from portal.requests              where id = p_request_id;         get diagnostics n = row_count; v_files := v_files || jsonb_build_object('requests', n);

  -- El client, si ja no li queda cap sol·licitud
  if not exists (select 1 from portal.requests where client_id = v_req.client_id) then
    v_ids := v_ids || v_req.client_id;
    delete from portal.clients where id = v_req.client_id;
    v_client := true;
  end if;
  v_files := v_files || jsonb_build_object('clients', case when v_client then 1 else 0 end);

  -- audit_log: detalls de totes aquestes entitats → {"purgat": true}
  update portal.audit_log
     set detalls = '{"purgat": true}'::jsonb
   where entitat_id = any (v_ids)
     and entitat in ('requests', 'clients', 'autoritzacions_carrec', 'signatures', 'documents',
                     'access_tokens', 'otps', 'retencions',
                     'kyc_formularis', 'kyc_adjunts', 'kyc_validacions', 'pdp_consentiments')
     and detalls is distinct from '{"purgat": true}'::jsonb;
  get diagnostics v_purgades = row_count;

  v_resultat := jsonb_build_object(
    'request_id',          p_request_id,
    'client_id',           case when v_client then v_req.client_id end,
    'bloquejat_at',        v_req.bloquejat_at,
    'destruir_despres_de', v_req.destruir_despres_de,
    'destruit_at',         now(),
    'files_esborrades',    v_files,
    'fitxers_destruits',   jsonb_array_length(v_fitxers) + greatest(coalesce(p_altres_fitxers, 0), 0),
    'fitxers',             v_fitxers,
    'entrades_audit_purgades', v_purgades
  );

  insert into portal.audit_log (actor, accio, entitat, entitat_id, detalls)
  values (null, 'DESTRUCCIO', 'requests', p_request_id, v_resultat);

  perform set_config('portal.mode', '', true);
  return v_resultat;
end;
$$;

revoke portal_purga from postgres;

-- Retencions: al KYC signat també abans que venci (ampliació de la UIFAND)
create or replace function portal.activa_retencio(p_request_id uuid, p_motiu text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC pot gestionar retencions' using errcode = '42501';
  end if;
  if btrim(coalesce(p_motiu, '')) = '' then
    raise exception 'Cal indicar el motiu de la retenció' using errcode = '23514';
  end if;
  perform 1 from portal.requests r
   where r.id = p_request_id
     and (r.bloquejat_at is not null
          or (r.document_type in ('kyc_pf', 'kyc_pj')
              and exists (select 1 from portal.signatures s where s.request_id = r.id)))
   for update;
  if not found then
    raise exception 'Només es poden retenir sol·licituds bloquejades o KYC signats' using errcode = 'P0002';
  end if;
  if exists (select 1 from portal.retencions where request_id = p_request_id and retirada_at is null) then
    raise exception 'Aquesta sol·licitud ja té una retenció activa' using errcode = '23505';
  end if;

  insert into portal.retencions (request_id, motiu, activada_per)
  values (p_request_id, btrim(p_motiu), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Auditoria de les sol·licituds bloquejades: també les taules del KYC
create or replace function portal.auditoria_bloquejada(p_entitat text, p_entitat_id uuid, p_accio text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p_accio in ('INSERT', 'UPDATE', 'DELETE') and case p_entitat
    when 'requests'              then portal.request_bloquejada(p_entitat_id)
    when 'clients'               then portal.client_bloquejat(p_entitat_id)
    when 'autoritzacions_carrec' then exists (select 1 from portal.autoritzacions_carrec x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'signatures'            then exists (select 1 from portal.signatures x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'documents'             then exists (select 1 from portal.documents x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'access_tokens'         then exists (select 1 from portal.access_tokens x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'otps'                  then exists (select 1 from portal.otps x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'kyc_formularis'        then exists (select 1 from portal.kyc_formularis x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'kyc_adjunts'           then exists (select 1 from portal.kyc_adjunts x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'kyc_validacions'       then exists (select 1 from portal.kyc_validacions x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'pdp_consentiments'     then exists (select 1 from portal.pdp_consentiments x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    else false
  end;
$$;

-- Accés per requeriment: també les dades del KYC i de la PDP
create or replace function portal.acces_requeriment(
  p_actor      uuid,
  p_request_id uuid,
  p_motiu      text,
  p_autoritat  text,
  p_ip         inet,
  p_user_agent text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_req portal.requests;
begin
  perform portal.actua_com(p_actor, 'ocic');

  if btrim(coalesce(p_motiu, '')) = '' then
    raise exception 'Cal indicar el motiu de l''accés' using errcode = '23514';
  end if;
  if btrim(coalesce(p_autoritat, '')) = '' then
    raise exception 'Cal indicar l''autoritat requeridora' using errcode = '23514';
  end if;

  select * into v_req from portal.requests where id = p_request_id;
  if not found or v_req.bloquejat_at is null then
    raise exception 'Aquest accés només és per a sol·licituds bloquejades' using errcode = 'P0002';
  end if;

  insert into portal.audit_log (actor, accio, entitat, entitat_id, ip, user_agent, detalls)
  values (p_actor, 'ACCES_REQUERIMENT', 'requests', p_request_id, p_ip, p_user_agent,
          jsonb_build_object('motiu', btrim(p_motiu), 'autoritat', btrim(p_autoritat)));

  return jsonb_build_object(
    'request', (select to_jsonb(r) from portal.requests r where r.id = p_request_id),
    'client', (select to_jsonb(c) from portal.clients c where c.id = v_req.client_id),
    'autoritzacio', (select to_jsonb(a) - 'iban_xifrat' from portal.autoritzacions_carrec a where a.request_id = p_request_id),
    'kyc', (select to_jsonb(k) from portal.kyc_formularis k where k.request_id = p_request_id),
    'kyc_validacio', (select to_jsonb(v) from portal.kyc_validacions v where v.request_id = p_request_id),
    'pdp_consentiment', (select to_jsonb(p) from portal.pdp_consentiments p where p.request_id = p_request_id),
    'signatura', (select to_jsonb(s) from portal.signatures s where s.request_id = p_request_id),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from portal.documents d where d.request_id = p_request_id), '[]'::jsonb),
    'retencions', coalesce((select jsonb_agg(to_jsonb(x) order by x.activada_at) from portal.retencions x where x.request_id = p_request_id), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 16. Permisos
-- -----------------------------------------------------------------------------
revoke all on table portal.config_kyc, portal.paisos_risc, portal.kyc_formularis, portal.kyc_adjunts,
                    portal.pdp_consentiments, portal.kyc_validacions, portal.firmes_ocic
  from public, anon, authenticated, service_role;

-- Personal (authenticated + RLS)
grant select on portal.config_kyc, portal.paisos_risc, portal.kyc_formularis, portal.kyc_adjunts,
                portal.pdp_consentiments, portal.kyc_validacions to authenticated;
grant insert on portal.kyc_formularis, portal.kyc_validacions to authenticated;

-- Servei del portal (Edge Functions)
grant select on portal.config_kyc, portal.paisos_risc, portal.kyc_validacions to service_role;
grant select, update (dades, desat_at, updated_at) on portal.kyc_formularis to service_role;
grant select, insert, update (retirat_at, updated_at) on portal.kyc_adjunts to service_role;
grant select, insert on portal.pdp_consentiments to service_role;
grant select, insert, update on portal.firmes_ocic to service_role;

-- Destrucció
grant select, delete on portal.kyc_formularis, portal.kyc_adjunts, portal.pdp_consentiments,
                        portal.kyc_validacions to portal_purga;

revoke all on function
  portal.camps_restringits_client(), portal.paisos_risc_nomes_baixa(),
  portal.es_kyc(portal.document_type), portal.data_segura(text), portal.avui(), portal.llista_json(jsonb),
  portal.kyc_documents_requerits(uuid), portal.kyc_documents_pendents(uuid), portal.kyc_declaracions_completes(uuid),
  portal.kyc_paisos(uuid), portal.kyc_marques(uuid), portal.llistes_vigents(),
  portal.nom_normal(text), portal.kyc_participacions(uuid), portal.kyc_be_no_declarats(uuid), portal.llistes_sancions(),
  portal.kyc_formulari_regles(), portal.kyc_adjunt_regles(), portal.document_validat_regles(),
  portal.kyc_validacio_regles(), portal.kyc_validacio_amb_estat(), portal.pdp_consentiment_regles(),
  portal.kyc_estat_documents(uuid), portal.obre_kyc_per_token(text), portal.kyc_token_vigent(uuid),
  portal.kyc_desa(uuid, jsonb), portal.kyc_tipus_document_valid(portal.document_type, text, text),
  portal.kyc_registra_adjunt(uuid, text, text, bigint, text, text, text, text), portal.kyc_retira_adjunt(uuid, uuid),
  portal.empremta_kyc(uuid, text, text, text), portal.empremta_pdp(uuid, text, text, text, boolean),
  portal.registra_signatura_kyc(uuid, timestamptz, inet, text, jsonb, jsonb),
  portal.crea_kyc(uuid, uuid, text), portal.kyc_adjunts_a_copiar(uuid, uuid), portal.kyc_copia_adjunt(uuid, uuid, uuid, text),
  portal.anulla_kyc(uuid, text), portal.registra_validacio_denegada(uuid, jsonb), portal.valida_kyc(uuid, jsonb),
  portal.kyc_dades_pdf_validat(uuid, uuid), portal.registra_pdf_validat(uuid, uuid, text, text, bigint),
  portal.kyc_registra_evidencia(uuid, uuid, text, text, bigint, text),
  portal.tinc_firma_ocic(), portal.fixa_fi_relacio(uuid, date), portal.anota_retirada_consentiment(uuid, date, text),
  portal.revisions_kyc(int), portal.afegeix_pais_risc(text, text, text, text, text), portal.treu_pais_risc(uuid, text),
  portal.nova_versio_llista(text, text, jsonb), portal.termini_bloqueig_de(uuid)
from public, anon, authenticated, service_role;

-- Funcions que fan servir els triggers i les polítiques (s'executen amb el rol de qui fa la petició)
grant execute on function
  portal.es_kyc(portal.document_type), portal.data_segura(text), portal.avui(), portal.llista_json(jsonb),
  portal.kyc_documents_requerits(uuid), portal.kyc_documents_pendents(uuid), portal.kyc_declaracions_completes(uuid),
  portal.kyc_paisos(uuid), portal.kyc_marques(uuid), portal.llistes_vigents(), portal.kyc_estat_documents(uuid),
  portal.nom_normal(text), portal.kyc_participacions(uuid), portal.kyc_be_no_declarats(uuid), portal.llistes_sancions()
to authenticated, service_role;

-- Panell del personal (cada funció comprova el rol)
grant execute on function
  portal.crea_kyc(uuid, uuid, text), portal.anulla_kyc(uuid, text), portal.valida_kyc(uuid, jsonb),
  portal.registra_validacio_denegada(uuid, jsonb), portal.tinc_firma_ocic(),
  portal.fixa_fi_relacio(uuid, date), portal.anota_retirada_consentiment(uuid, date, text),
  portal.revisions_kyc(int), portal.afegeix_pais_risc(text, text, text, text, text),
  portal.treu_pais_risc(uuid, text), portal.nova_versio_llista(text, text, jsonb)
to authenticated;

-- Edge Functions (portal-kyc i portal-kyc-personal)
grant execute on function
  portal.obre_kyc_per_token(text), portal.kyc_token_vigent(uuid), portal.kyc_desa(uuid, jsonb),
  portal.kyc_tipus_document_valid(portal.document_type, text, text),
  portal.kyc_registra_adjunt(uuid, text, text, bigint, text, text, text, text), portal.kyc_retira_adjunt(uuid, uuid),
  portal.empremta_kyc(uuid, text, text, text), portal.empremta_pdp(uuid, text, text, text, boolean),
  portal.registra_signatura_kyc(uuid, timestamptz, inet, text, jsonb, jsonb),
  portal.kyc_adjunts_a_copiar(uuid, uuid), portal.kyc_copia_adjunt(uuid, uuid, uuid, text),
  portal.kyc_dades_pdf_validat(uuid, uuid), portal.registra_pdf_validat(uuid, uuid, text, text, bigint),
  portal.kyc_registra_evidencia(uuid, uuid, text, text, bigint, text)
to service_role;

-- Funcions que criden les de portal_purga
grant execute on function portal.termini_bloqueig_de(uuid) to portal_purga;
