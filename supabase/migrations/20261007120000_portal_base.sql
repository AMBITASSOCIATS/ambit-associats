-- =============================================================================
-- Portal de signatura de clients ÀMBIT · Fase 1 · Pas C
-- Base comuna: esquema portal, enums i taules genèriques.
-- No toca cap taula de public.
-- =============================================================================

create schema if not exists portal;

-- Ningú té accés a l'esquema per defecte; els permisos es donen al pas E.
revoke all on schema portal from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type portal.staff_role     as enum ('ocic', 'gestor');
create type portal.party_type     as enum ('pf', 'pj');
create type portal.document_type  as enum ('autoritzacio_carrec');
create type portal.request_status as enum ('esborrany', 'enviat', 'en_curs', 'signat', 'actiu', 'retirat', 'anullat');
create type portal.doc_kind       as enum ('signat', 'evidencies', 'adjunt');

-- -----------------------------------------------------------------------------
-- updated_at automàtic
-- -----------------------------------------------------------------------------
create function portal.set_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- staff_profiles: personal d'ÀMBIT amb accés al portal
-- -----------------------------------------------------------------------------
create table portal.staff_profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete restrict,
  role       portal.staff_role not null,
  actiu      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
create table portal.clients (
  id                uuid primary key default gen_random_uuid(),
  party_type        portal.party_type not null,
  nom_mostrat       text not null check (btrim(nom_mostrat) <> ''),
  -- Camp "Referència" d'ABA-01: màxim 14 caràcters, únic, l'assigna només ÀMBIT.
  referencia_client varchar(14) unique
                    check (referencia_client is null or btrim(referencia_client) <> ''),
  creat_per         uuid references auth.users (id) on delete restrict,  -- el fixa un trigger
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- requests: una sol·licitud de signatura d'un document per a un client
-- -----------------------------------------------------------------------------
create table portal.requests (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references portal.clients (id) on delete restrict,
  document_type    portal.document_type not null,
  template_version text not null,
  idioma           text not null check (idioma in ('ca', 'es', 'en', 'fr')),
  status           portal.request_status not null default 'esborrany',
  creat_per        uuid references auth.users (id) on delete restrict,  -- el fixa un trigger
  enviat_at        timestamptz,
  signat_at        timestamptz,
  activat_at       timestamptz,
  activat_per      uuid references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on portal.requests (client_id);

-- -----------------------------------------------------------------------------
-- access_tokens: només el hash, mai el token
-- -----------------------------------------------------------------------------
create table portal.access_tokens (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references portal.requests (id) on delete restrict,
  token_hash text not null unique,
  expira_at  timestamptz not null,
  revocat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on portal.access_tokens (request_id);

-- -----------------------------------------------------------------------------
-- otps: codis de verificació (només el hash)
-- -----------------------------------------------------------------------------
create table portal.otps (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references portal.requests (id) on delete restrict,
  codi_hash  text not null,
  expira_at  timestamptz not null,
  intents    int not null default 0 check (intents >= 0),
  usat_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on portal.otps (request_id);

-- -----------------------------------------------------------------------------
-- signatures: una per sol·licitud
-- -----------------------------------------------------------------------------
create table portal.signatures (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null unique references portal.requests (id) on delete restrict,
  signatari_nom    text not null check (btrim(signatari_nom) <> ''),
  signatari_carrec text,
  lloc             text not null,
  signat_at        timestamptz not null default now(),
  imatge_path      text,
  email_verificat  text,  -- adreça on s'ha enviat i validat l'OTP
  ip               inet,
  user_agent       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- documents: fitxers del bucket portal-docs
-- -----------------------------------------------------------------------------
create table portal.documents (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references portal.requests (id) on delete restrict,
  kind         portal.doc_kind not null,
  storage_path text not null unique,
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mida_bytes   bigint not null check (mida_bytes >= 0),
  mime         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on portal.documents (request_id);

-- -----------------------------------------------------------------------------
-- audit_log: registre immutable (el bloqueig d'UPDATE/DELETE és al pas E)
-- -----------------------------------------------------------------------------
create table portal.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid,
  accio      text not null,
  entitat    text not null,
  entitat_id uuid,
  ip         inet,
  user_agent text,
  detalls    jsonb,
  at         timestamptz not null default now()
);
create index on portal.audit_log (entitat, entitat_id);
create index on portal.audit_log (at);

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on portal.staff_profiles for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.clients        for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.requests       for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.access_tokens  for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.otps           for each row execute function portal.set_updated_at();
-- signatures i documents no admeten UPDATE (pas E), per això no tenen aquest trigger.

-- -----------------------------------------------------------------------------
-- creat_per: sempre l'usuari real (auth.uid()), s'ignori el que arribi a la petició,
-- i no es pot canviar després.
-- -----------------------------------------------------------------------------
create function portal.fixa_creat_per()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creat_per := auth.uid();
  else
    new.creat_per := old.creat_per;
  end if;
  return new;
end;
$$;

create trigger fixa_creat_per before insert or update on portal.clients  for each row execute function portal.fixa_creat_per();
create trigger fixa_creat_per before insert or update on portal.requests for each row execute function portal.fixa_creat_per();
