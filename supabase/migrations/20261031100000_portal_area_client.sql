-- =============================================================================
-- Portal ÀMBIT · Àrea de client (fase 1)
--
-- Comptes de client: un tipus d'usuari nou, separat del personal del portal
-- (portal.staff_profiles) i dels usuaris de la Zona Professionals
-- (public.profiles). Un usuari de client no té ni pot tenir cap fila en
-- aquestes dues taules, i a l'inrevés (triggers de les tres taules).
--
-- SEPARACIÓ: els usuaris de client no fan servir mai el rol authenticated.
-- El hook de Supabase Auth portal.hook_token_client() els posa el rol
-- portal_client al JWT, i PostgREST hi executa les seves peticions. Aquest rol
-- no té cap permís dels que té authenticated: només els d'aquesta migració
-- (vegeu la secció 11). Per això cap política ni funció existent per a
-- authenticated o public no li dona accés a res. A més:
--   · si algun dia el hook fallés i el client entrés com a authenticated, no
--     podria crear-se cap fitxa a public.profiles (trigger) i continuaria
--     sense ser personal; l'àrea de client queda tancada (les polítiques són
--     només per a portal_client i les Edge Functions exigeixen aquest rol);
--   · tota la informació de l'àrea exigeix sessió amb segon factor (aal2),
--     registrada per l'Edge Function d'accés, activa en els darrers 30 minuts,
--     amb l'usuari actiu i les condicions vigents acceptades
--     (portal.client_usuari_actual(), a les polítiques i al servidor).
--
-- Enviaments: el client envia documents a un destinatari de la llista
-- (portal.client_destinataris). Cada enviament només el veuen el seu
-- destinatari i l'OCIC. Fitxers al bucket privat client-enviaments.
--
-- Conservació (mòdul existent, Edge Function portal-purga):
--   · fitxers dels enviaments: es destrueixen als 30 dies de "Descarregat i
--     arxivat" i, en tot cas, als 90 dies de rebre'ls; en queda un registre
--     mínim sense dades personals (dates, nombre de fitxers, empremtes);
--   · usuaris revocats i el seu registre d'accessos: termini_revocats després
--     de la revocació (per defecte 3 anys; vegeu les decisions).
--
-- Única regla existent que es modifica: portal.destrueix_solicitud() (la
-- darrera versió, de la migració dels contractes, sense canviar res del que
-- feia) també esborra els vincles de l'àrea de client quan destrueix un
-- client, i no destrueix el client mentre en quedi algun enviament amb fitxers.
-- A public només s'hi afegeix el trigger de separació de comptes de
-- public.profiles: cap política ni permís de public no canvia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rol dels usuaris de client
-- -----------------------------------------------------------------------------
create role portal_client nologin noinherit;
-- PostgREST hi canvia quan el JWT porta role = portal_client
grant portal_client to authenticator;
grant usage on schema portal to portal_client;

-- -----------------------------------------------------------------------------
-- 2. Configuració (una sola fila; es canvia amb una migració)
-- -----------------------------------------------------------------------------
create table portal.config_area_client (
  id                uuid primary key default gen_random_uuid(),
  unica             boolean not null default true unique check (unica),
  -- Tancament de la sessió per inactivitat
  inactivitat       interval not null default interval '30 minutes' check (inactivitat > interval '0'),
  -- Intents fallits (contrasenya o codi) abans de bloquejar l'accés, i durada del bloqueig
  intents_maxims    int not null default 5 check (intents_maxims between 3 and 20),
  durada_bloqueig   interval not null default interval '15 minutes' check (durada_bloqueig > interval '0'),
  -- Enllaços d'activació i de restabliment
  caducitat_enllac  interval not null default interval '7 days' check (caducitat_enllac > interval '0'),
  -- Fitxers dels enviaments
  termini_arxivats  interval not null default interval '30 days' check (termini_arxivats >= interval '0'),
  termini_maxim     interval not null default interval '90 days' check (termini_maxim >= interval '0'),
  termini_pujada    interval not null default interval '1 day' check (termini_pujada > interval '0'),
  -- Usuaris revocats i el seu registre d'accessos (punt 6 de les condicions)
  termini_revocats  interval not null default interval '3 years' check (termini_revocats >= interval '0'),
  updated_at        timestamptz not null default now()
);
insert into portal.config_area_client default values;

-- -----------------------------------------------------------------------------
-- 3. Taules
-- -----------------------------------------------------------------------------
create type portal.estat_usuari_client as enum ('pendent', 'actiu', 'suspes', 'revocat');
create type portal.estat_enviament     as enum ('pujant', 'enviat', 'arxivat', 'rebutjat', 'destruit');

-- Versions de les condicions d'ús. Una sola vigent: si es publica una versió
-- nova, cal acceptar-la en el següent accés.
create table portal.client_condicions (
  versio       text primary key check (btrim(versio) <> ''),
  vigent       boolean not null default false,
  publicada_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index client_condicions_una_vigent on portal.client_condicions (vigent) where vigent;
insert into portal.client_condicions (versio, vigent) values ('CONDICIONS-AREA v1', true);

create table portal.client_usuaris (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users (id) on delete restrict,
  nom               text not null check (btrim(nom) <> '' and char_length(nom) <= 200),
  email             text not null unique
                    check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  estat             portal.estat_usuari_client not null default 'pendent',
  -- Darrera versió de les condicions acceptada (l'historial és a client_acceptacions)
  condicions_versio text references portal.client_condicions (versio) on delete restrict,
  condicions_at     timestamptz,
  activat_at        timestamptz,
  -- Sessió creada amb l'enllaç; només aquesta pot completar l'activació
  sessio_activacio  uuid,
  intents_fallits   int not null default 0 check (intents_fallits >= 0),
  bloquejat_fins    timestamptz,
  suspes_at         timestamptz,
  revocat_at        timestamptz,
  creat_per         uuid references auth.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((estat = 'revocat') = (revocat_at is not null)),
  check (estat <> 'suspes' or suspes_at is not null)
);

-- Un usuari pot estar vinculat a diversos clients, i un client pot tenir diversos usuaris
create table portal.client_vincles (
  id         uuid primary key default gen_random_uuid(),
  usuari_id  uuid not null references portal.client_usuaris (id) on delete restrict,
  client_id  uuid not null references portal.clients (id) on delete restrict,
  creat_per  uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  baixa_at   timestamptz,
  baixa_per  uuid references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now()
);
create unique index client_vincles_un_actiu on portal.client_vincles (usuari_id, client_id) where baixa_at is null;
create index on portal.client_vincles (client_id);

-- Enllaços d'activació i de restabliment: només el hash, d'un sol ús
create table portal.client_tokens (
  id         uuid primary key default gen_random_uuid(),
  usuari_id  uuid not null references portal.client_usuaris (id) on delete restrict,
  motiu      text not null check (motiu in ('invitacio', 'restabliment')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expira_at  timestamptz not null,
  usat_at    timestamptz,
  revocat_at timestamptz,
  creat_per  uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on portal.client_tokens (usuari_id);

-- Sessions de l'àrea de client (registre d'accessos). Només compten les que
-- obre l'Edge Function d'accés; una sessió d'Auth oberta per una altra via
-- no dona accés a res.
create table portal.client_sessions (
  id               uuid primary key default gen_random_uuid(),
  usuari_id        uuid not null references portal.client_usuaris (id) on delete restrict,
  session_id       uuid not null unique,
  tipus            text not null check (tipus in ('acces', 'activacio')),
  creada_at        timestamptz not null default now(),
  mfa_at           timestamptz,
  ultima_activitat timestamptz not null default now(),
  tancada_at       timestamptz,
  motiu_tancament  text check (motiu_tancament in ('sortida', 'inactivitat', 'restabliment', 'suspensio', 'revocacio')),
  ip               inet,
  user_agent       text,
  updated_at       timestamptz not null default now()
);
create index on portal.client_sessions (usuari_id);

create table portal.client_acceptacions (
  id           uuid primary key default gen_random_uuid(),
  usuari_id    uuid not null references portal.client_usuaris (id) on delete restrict,
  versio       text not null references portal.client_condicions (versio) on delete restrict,
  acceptada_at timestamptz not null default now(),
  ip           inet,
  user_agent   text
);
create index on portal.client_acceptacions (usuari_id);

-- Destinataris dels enviaments. Un destinatari actiu ha de tenir usuari al
-- portal (personal actiu): ho exigeixen la restricció i el trigger.
create table portal.client_destinataris (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (email = lower(btrim(email))),
  nom             text not null check (btrim(nom) <> ''),
  actiu           boolean not null default false,
  user_id         uuid unique references portal.staff_profiles (user_id) on delete restrict,
  -- Sufix de la variable FORMSPREE_FORM_ID_<clau> de l'avís
  clau_formspree  text not null unique check (clau_formspree ~ '^[A-Z0-9_]+$'),
  ordre           int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint client_destinatari_actiu_amb_usuari check (not actiu or user_id is not null)
);

create table portal.client_enviaments (
  id                   uuid primary key default gen_random_uuid(),
  -- usuari_id, client_id, assumpte i comentari queden buits quan es destrueixen els fitxers
  usuari_id            uuid references portal.client_usuaris (id) on delete restrict,
  client_id            uuid references portal.clients (id) on delete restrict,
  destinatari_id       uuid not null references portal.client_destinataris (id) on delete restrict,
  assumpte             text check (assumpte is null or (btrim(assumpte) <> '' and char_length(assumpte) <= 120)),
  comentari            text check (comentari is null or char_length(comentari) <= 2000),
  estat                portal.estat_enviament not null default 'pujant',
  n_fitxers            int not null check (n_fitxers between 1 and 20),
  mida_total           bigint not null check (mida_total between 1 and 104857600),  -- 100 MB
  created_at           timestamptz not null default now(),
  enviat_at            timestamptz,
  arxivat_at           timestamptz,
  arxivat_per          uuid references auth.users (id) on delete restrict,
  fitxers_destruits_at timestamptz,
  updated_at           timestamptz not null default now(),
  check (estat = 'destruit' or (usuari_id is not null and client_id is not null and assumpte is not null)),
  check ((estat = 'destruit') = (fitxers_destruits_at is not null))
);
create index on portal.client_enviaments (usuari_id);
create index on portal.client_enviaments (destinatari_id);

create table portal.client_enviament_fitxers (
  id           uuid primary key default gen_random_uuid(),
  enviament_id uuid not null references portal.client_enviaments (id) on delete restrict,
  ordre        int not null check (ordre between 1 and 20),
  -- nom_fitxer i storage_path queden buits quan es destrueix el fitxer
  nom_fitxer   text check (nom_fitxer is null or (btrim(nom_fitxer) <> '' and char_length(nom_fitxer) <= 200)),
  extensio     text not null check (extensio in ('pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'docx', 'doc', 'csv')),
  mime         text not null,
  mida_bytes   bigint not null check (mida_bytes between 1 and 20971520),  -- 20 MB
  sha256       text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text unique,
  verificat_at timestamptz,
  destruit_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (enviament_id, ordre)
);

-- Comptes d'Auth d'usuaris destruïts, pendents d'esborrar per l'Edge Function
-- portal-purga (Admin API). Només l'identificador.
create table portal.client_comptes_a_esborrar (
  user_id    uuid primary key,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. updated_at, auditoria i prohibició d'esborrat
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['config_area_client', 'client_condicions', 'client_usuaris', 'client_vincles',
                           'client_tokens', 'client_sessions', 'client_destinataris', 'client_enviaments',
                           'client_enviament_fitxers'] loop
    execute format('create trigger set_updated_at before update on portal.%I for each row execute function portal.set_updated_at()', t);
  end loop;
  foreach t in array array['config_area_client', 'client_condicions', 'client_usuaris', 'client_vincles',
                           'client_tokens', 'client_sessions', 'client_acceptacions', 'client_destinataris',
                           'client_enviaments', 'client_enviament_fitxers', 'client_comptes_a_esborrar'] loop
    execute format('create trigger audita after insert or update or delete on portal.%I for each row execute function portal.audita()', t);
    execute format('create trigger impedeix_delete before delete on portal.%I for each row execute function portal.impedeix_canvi()', t);
    execute format('create trigger impedeix_truncate before truncate on portal.%I for each statement execute function portal.impedeix_canvi()', t);
  end loop;
end;
$$;

-- Les acceptacions no es modifiquen mai
create trigger impedeix_update before update on portal.client_acceptacions
  for each row execute function portal.impedeix_canvi();

-- Empremtes i dades dels fitxers: no canvien un cop verificats. Fora de la
-- destrucció només es pot verificar un fitxer pendent (sha256, mida real i
-- verificat_at), una sola vegada.
create function portal.protegeix_fitxer_enviament()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if portal.en_purga() then
    if (new.id, new.enviament_id, new.ordre, new.extensio, new.mime, new.mida_bytes, new.sha256, new.created_at)
       is not distinct from (old.id, old.enviament_id, old.ordre, old.extensio, old.mime, old.mida_bytes, old.sha256, old.created_at)
       and new.nom_fitxer is null and new.storage_path is null and new.destruit_at is not null then
      return new;
    end if;
    raise exception 'La destrucció només buida el nom i el camí del fitxer' using errcode = '42501';
  end if;
  if (new.id, new.enviament_id, new.ordre, new.nom_fitxer, new.extensio, new.mime, new.storage_path, new.destruit_at, new.created_at)
     is distinct from (old.id, old.enviament_id, old.ordre, old.nom_fitxer, old.extensio, old.mime, old.storage_path, old.destruit_at, old.created_at)
     or old.verificat_at is not null or new.verificat_at is null or new.sha256 is null then
    raise exception 'Les dades d''un fitxer enviat no es poden modificar' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger protegeix_fitxer before update on portal.client_enviament_fitxers
  for each row execute function portal.protegeix_fitxer_enviament();

-- Enviaments: transicions pujant → enviat | rebutjat; enviat → arxivat;
-- (enviat | arxivat | pujant | rebutjat) → destruit, aquesta només a la destrucció.
-- Les dades del client no es modifiquen mai fora de la destrucció.
create function portal.valida_enviament()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if portal.en_purga() then
    if new.estat = 'destruit' and new.usuari_id is null and new.client_id is null
       and new.assumpte is null and new.comentari is null and new.fitxers_destruits_at is not null
       and (new.id, new.destinatari_id, new.n_fitxers, new.mida_total, new.created_at, new.enviat_at, new.arxivat_at, new.arxivat_per)
           is not distinct from
           (old.id, old.destinatari_id, old.n_fitxers, old.mida_total, old.created_at, old.enviat_at, old.arxivat_at, old.arxivat_per) then
      return new;
    end if;
    raise exception 'La destrucció només buida les dades de l''enviament' using errcode = '42501';
  end if;

  if (new.id, new.usuari_id, new.client_id, new.destinatari_id, new.assumpte, new.comentari, new.n_fitxers, new.mida_total, new.created_at)
     is distinct from
     (old.id, old.usuari_id, old.client_id, old.destinatari_id, old.assumpte, old.comentari, old.n_fitxers, old.mida_total, old.created_at)
     or new.fitxers_destruits_at is distinct from old.fitxers_destruits_at then
    raise exception 'Les dades d''un enviament no es poden modificar' using errcode = '42501';
  end if;

  if new.estat is distinct from old.estat then
    if not ((old.estat = 'pujant' and new.estat in ('enviat', 'rebutjat'))
            or (old.estat = 'enviat' and new.estat = 'arxivat')) then
      raise exception 'Transició no permesa: % → %', old.estat, new.estat using errcode = '42501';
    end if;
    if new.estat = 'enviat' then
      new.enviat_at := now();
    elsif new.estat = 'arxivat' then
      new.arxivat_at := now();
      new.arxivat_per := auth.uid();
    end if;
  else
    new.enviat_at := old.enviat_at;
    new.arxivat_at := old.arxivat_at;
    new.arxivat_per := old.arxivat_per;
  end if;
  return new;
end;
$$;
create trigger valida_enviament before update on portal.client_enviaments
  for each row execute function portal.valida_enviament();

-- Un destinatari actiu ha de ser personal actiu del portal
create function portal.valida_destinatari()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.actiu and not exists (select 1 from portal.staff_profiles where user_id = new.user_id and actiu) then
    raise exception 'Per activar un destinatari cal que tingui usuari actiu al portal' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger valida_destinatari before insert or update on portal.client_destinataris
  for each row execute function portal.valida_destinatari();

-- -----------------------------------------------------------------------------
-- 5. Separació de comptes: un mateix usuari d'Auth no pot ser alhora usuari de
--    client i personal del portal o usuari de la Zona Professionals.
--    El bloqueig consultiu evita que dues altes simultànies se saltin la comprovació.
-- -----------------------------------------------------------------------------
create function portal.separa_comptes()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user uuid := (to_jsonb(new) ->> case when tg_table_name = 'profiles' then 'id' else 'user_id' end)::uuid;
begin
  if v_user is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('portal.tipus_compte:' || v_user::text, 0));
  if tg_table_name = 'client_usuaris' then
    if exists (select 1 from public.profiles where id = v_user)
       or exists (select 1 from portal.staff_profiles where user_id = v_user) then
      raise exception 'Aquest compte és del personal o de la Zona Professionals; un usuari de client necessita un compte propi'
        using errcode = '42501';
    end if;
  elsif exists (select 1 from portal.client_usuaris where user_id = v_user) then
    raise exception 'Aquest compte és un usuari de l''àrea de client; no pot ser personal ni usuari de la Zona Professionals'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function portal.separa_comptes() from public, anon, authenticated, service_role;

create trigger separa_comptes before insert or update of user_id on portal.client_usuaris
  for each row execute function portal.separa_comptes();
create trigger separa_comptes before insert or update of user_id on portal.staff_profiles
  for each row execute function portal.separa_comptes();
create trigger portal_separa_comptes before insert or update of id on public.profiles
  for each row execute function portal.separa_comptes();

-- -----------------------------------------------------------------------------
-- 6. Hook de Supabase Auth (Custom Access Token): rol portal_client per als
--    usuaris de client. Els altres usuaris no canvien. Si fallés, retorna les
--    dades sense tocar (ningú es queda sense poder entrar) i l'àrea de client
--    queda tancada per a aquell usuari (exigeix el rol portal_client).
-- -----------------------------------------------------------------------------
create function portal.hook_token_client(event jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  if exists (select 1 from portal.client_usuaris where user_id = (event ->> 'user_id')::uuid) then
    return jsonb_set(event, '{claims,role}', '"portal_client"');
  end if;
  return event;
exception when others then
  return event;
end;
$$;
revoke all on function portal.hook_token_client(jsonb) from public, anon, authenticated, service_role;
grant usage on schema portal to supabase_auth_admin;
grant execute on function portal.hook_token_client(jsonb) to supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- 7. Sessió de l'àrea de client (polítiques i funcions)
--    Usuari de client actual si: rol portal_client, aal2, usuari actiu i no
--    bloquejat, condicions vigents acceptades i sessió registrada, verificada
--    amb el segon factor, oberta i amb activitat en el termini d'inactivitat.
-- -----------------------------------------------------------------------------
create function portal.client_usuari_actual()
  returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select u.id
  from portal.client_usuaris u
  join portal.client_sessions s on s.usuari_id = u.id
  cross join portal.config_area_client c
  where u.user_id = auth.uid()
    and coalesce(auth.jwt() ->> 'role', '') = 'portal_client'
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and u.estat = 'actiu'
    and (u.bloquejat_fins is null or u.bloquejat_fins <= now())
    and u.condicions_versio = (select versio from portal.client_condicions where vigent)
    and s.session_id::text = auth.jwt() ->> 'session_id'
    and s.mfa_at is not null
    and s.tancada_at is null
    and s.ultima_activitat > now() - c.inactivitat;
$$;

-- Estat de bloqueig real d'un client, per a les funcions de l'àrea que criden
-- amb el rol portal_client. portal.client_bloquejat respon sempre «bloquejat»
-- a qui no és personal ni servidor (20261030100000); aquesta no té permís
-- d'execució per a ningú (bloc de revocacions de més avall) i només la fan
-- servir funcions SECURITY DEFINER que ja han comprovat l'usuari.
create function portal.client_bloquejat_intern(p_client_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from portal.requests where client_id = p_client_id)
     and not exists (select 1 from portal.requests where client_id = p_client_id and bloquejat_at is null);
$$;

create or replace function portal.client_bloquejat(p_client_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not portal.personal_o_servei() or portal.client_bloquejat_intern(p_client_id);
$$;

-- Client vinculat a l'usuari actual (i no destruït per conservació)
create function portal.client_vinculat(p_client_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from portal.client_vincles v
    where v.client_id = p_client_id and v.baixa_at is null
      and v.usuari_id = portal.client_usuari_actual())
    and not portal.client_bloquejat_intern(p_client_id);
$$;

-- Destinatari que es pot triar: actiu i amb el seu usuari del portal actiu
create function portal.destinatari_disponible(p_destinatari_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from portal.client_destinataris d
    join portal.staff_profiles s on s.user_id = d.user_id and s.actiu
    where d.id = p_destinatari_id and d.actiu);
$$;

-- Enviament visible per al personal: el seu destinatari o l'OCIC
create function portal.enviament_visible(p_enviament_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select portal.is_ocic() or (portal.is_staff() and exists (
    select 1 from portal.client_enviaments e
    join portal.client_destinataris d on d.id = e.destinatari_id
    where e.id = p_enviament_id and d.user_id = auth.uid()));
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------
alter table portal.config_area_client        enable row level security;
alter table portal.client_condicions         enable row level security;
alter table portal.client_usuaris            enable row level security;
alter table portal.client_vincles            enable row level security;
alter table portal.client_tokens             enable row level security;
alter table portal.client_sessions           enable row level security;
alter table portal.client_acceptacions       enable row level security;
alter table portal.client_destinataris       enable row level security;
alter table portal.client_enviaments         enable row level security;
alter table portal.client_enviament_fitxers  enable row level security;
alter table portal.client_comptes_a_esborrar enable row level security;

-- Usuari de client (rol portal_client): només el seu
create policy client_select on portal.client_vincles for select to portal_client
  using (usuari_id = portal.client_usuari_actual() and baixa_at is null);
create policy client_select on portal.clients for select to portal_client
  using (portal.client_vinculat(id));
create policy client_select on portal.client_destinataris for select to portal_client
  using (portal.client_usuari_actual() is not null);
create policy client_select on portal.client_enviaments for select to portal_client
  using (usuari_id = portal.client_usuari_actual() and estat <> 'pujant' and portal.client_vinculat(client_id));
create policy client_select on portal.client_condicions for select to portal_client
  using (portal.client_usuari_actual() is not null);

-- Personal (authenticated): usuaris, vincles, accessos i condicions
create policy personal_select on portal.client_usuaris      for select to authenticated using (portal.is_staff());
create policy personal_select on portal.client_vincles      for select to authenticated using (portal.is_staff());
create policy personal_select on portal.client_sessions     for select to authenticated using (portal.is_staff());
create policy personal_select on portal.client_acceptacions for select to authenticated using (portal.is_staff());
create policy personal_select on portal.client_condicions   for select to authenticated using (portal.is_staff());
create policy personal_select on portal.client_destinataris for select to authenticated using (portal.is_staff());
-- Enviaments: només el destinatari i l'OCIC
create policy destinatari_select on portal.client_enviaments for select to authenticated
  using (portal.enviament_visible(id));
create policy destinatari_select on portal.client_enviament_fitxers for select to authenticated
  using (portal.enviament_visible(enviament_id));

-- Rol portal_purga (funcions de destrucció)
do $$
declare
  t text;
begin
  foreach t in array array['client_usuaris', 'client_vincles', 'client_tokens', 'client_sessions', 'client_acceptacions',
                           'client_enviaments', 'client_enviament_fitxers', 'client_comptes_a_esborrar'] loop
    execute format('create policy purga on portal.%I for all to portal_purga using (true) with check (true)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Storage: bucket privat dels enviaments. Sense cap política: el client hi
--    puja amb URL signades de pujada i el personal en descarrega amb URL
--    signades de curta durada (sempre generades per les Edge Functions).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-enviaments', 'client-enviaments', false, 20971520,  -- 20 MB
        array['application/pdf', 'image/jpeg', 'image/png',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
              'text/csv'])
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 10. Funcions
-- -----------------------------------------------------------------------------

-- Auxiliar: actor de l'auditoria per a les accions del mateix usuari de client
-- fetes pel servei (Edge Function d'accés)
create function portal.client_actor(p_usuari_id uuid)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  select set_config('portal.actor', (select user_id::text from portal.client_usuaris where id = p_usuari_id), true);
$$;

create function portal.client_registre(p_accio text, p_entitat text, p_id uuid, p_ip inet, p_user_agent text, p_detalls jsonb default null)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  insert into portal.audit_log (actor, accio, entitat, entitat_id, ip, user_agent, detalls)
  values (coalesce(nullif(current_setting('portal.actor', true), '')::uuid, auth.uid()),
          p_accio, p_entitat, p_id, p_ip, left(p_user_agent, 500), p_detalls);
$$;

-- IP i navegador de la petició en curs (capçaleres de PostgREST), si n'hi ha
create function portal.ip_peticio()
  returns inet
  language plpgsql
  stable
  set search_path = ''
as $$
begin
  return nullif(btrim(split_part(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ',', 1)), '')::inet;
exception when others then
  return null;
end;
$$;

create function portal.navegador_peticio()
  returns text
  language plpgsql
  stable
  set search_path = ''
as $$
begin
  return left(nullif(current_setting('request.headers', true), '')::jsonb ->> 'user-agent', 500);
exception when others then
  return null;
end;
$$;

-- ─── 10.1 Personal (Edge Function portal-client-personal, service_role) ──────

-- Correu sense cap compte a Auth (per crear un usuari de client nou)
create function portal.client_correu_lliure(p_email text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not exists (select 1 from auth.users where lower(email) = lower(btrim(p_email)));
$$;

-- Usuaris d'un client, amb el darrer accés
create function portal.client_usuaris_llista(p_actor uuid, p_client_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform portal.actua_com(p_actor, 'personal');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'usuari_id', u.id, 'nom', u.nom, 'email', u.email, 'estat', u.estat,
             'activat_at', u.activat_at, 'suspes_at', u.suspes_at, 'revocat_at', u.revocat_at,
             'condicions_versio', u.condicions_versio, 'bloquejat_fins', u.bloquejat_fins,
             'darrer_acces', (select max(s.mfa_at) from portal.client_sessions s where s.usuari_id = u.id),
             'altres_clients', (select count(*) from portal.client_vincles w where w.usuari_id = u.id and w.baixa_at is null and w.client_id <> p_client_id),
             'enllac', (select jsonb_build_object('motiu', t.motiu, 'expira_at', t.expira_at)
                          from portal.client_tokens t
                         where t.usuari_id = u.id and t.usat_at is null and t.revocat_at is null and t.expira_at > now()
                         order by t.created_at desc limit 1))
           order by u.nom)
    from portal.client_vincles v
    join portal.client_usuaris u on u.id = v.usuari_id
    where v.client_id = p_client_id and v.baixa_at is null), '[]'::jsonb);
end;
$$;

-- Alta d'un usuari (nou) o vincle d'un usuari existent a un altre client
create function portal.client_usuari_afegeix(p_actor uuid, p_client_id uuid, p_nom text, p_email text, p_user_id uuid default null)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_usuari portal.client_usuaris;
  v_email  text := lower(btrim(p_email));
begin
  perform portal.actua_com(p_actor, 'personal');
  if not exists (select 1 from portal.clients where id = p_client_id) or portal.client_bloquejat(p_client_id) then
    raise exception 'Client inexistent' using errcode = 'P0002';
  end if;

  select * into v_usuari from portal.client_usuaris where email = v_email for update;
  if v_usuari.id is null then
    if p_user_id is null then
      raise exception 'Falta el compte de l''usuari' using errcode = '22023';
    end if;
    if not exists (select 1 from auth.users where id = p_user_id and lower(email) = v_email) then
      raise exception 'El compte no correspon al correu' using errcode = '22023';
    end if;
    insert into portal.client_usuaris (user_id, nom, email, creat_per)
    values (p_user_id, btrim(p_nom), v_email, p_actor)
    returning * into v_usuari;
  elsif v_usuari.estat = 'revocat' then
    raise exception 'Aquest usuari està revocat; no es pot tornar a vincular' using errcode = '42501';
  end if;

  if exists (select 1 from portal.client_vincles where usuari_id = v_usuari.id and client_id = p_client_id and baixa_at is null) then
    raise exception 'Aquest usuari ja està vinculat a aquest client' using errcode = '23505';
  end if;
  insert into portal.client_vincles (usuari_id, client_id, creat_per) values (v_usuari.id, p_client_id, p_actor);
  return v_usuari.id;
end;
$$;

create function portal.client_desvincula(p_actor uuid, p_usuari_id uuid, p_client_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform portal.actua_com(p_actor, 'personal');
  update portal.client_vincles set baixa_at = now(), baixa_per = p_actor
   where usuari_id = p_usuari_id and client_id = p_client_id and baixa_at is null;
  if not found then
    raise exception 'Aquest usuari no està vinculat a aquest client' using errcode = 'P0002';
  end if;
end;
$$;

-- Enllaç d'activació (invitació) o de restabliment. Revoca els anteriors.
create function portal.client_crea_token(p_actor uuid, p_usuari_id uuid, p_motiu text, p_token_hash text, p_expira_at timestamptz)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_usuari portal.client_usuaris;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_usuari from portal.client_usuaris where id = p_usuari_id for update;
  if v_usuari.id is null then
    raise exception 'Usuari inexistent' using errcode = 'P0002';
  end if;
  if not exists (select 1 from portal.client_vincles where usuari_id = p_usuari_id and baixa_at is null) then
    raise exception 'L''usuari no està vinculat a cap client' using errcode = '42501';
  end if;
  if p_motiu = 'invitacio' then
    if v_usuari.estat <> 'pendent' or v_usuari.activat_at is not null then
      raise exception 'Aquest usuari ja s''ha activat; feu servir «Restablir l''accés»' using errcode = '42501';
    end if;
  elsif p_motiu = 'restabliment' then
    if v_usuari.activat_at is null or v_usuari.estat not in ('actiu', 'pendent') then
      raise exception 'Només es pot restablir l''accés d''un usuari activat i no suspès ni revocat' using errcode = '42501';
    end if;
  else
    raise exception 'Motiu no vàlid' using errcode = '22023';
  end if;
  if p_expira_at <= now() or p_expira_at > now() + (select caducitat_enllac from portal.config_area_client) + interval '1 minute' then
    raise exception 'Caducitat no vàlida' using errcode = '22023';
  end if;

  update portal.client_tokens set revocat_at = now()
   where usuari_id = p_usuari_id and usat_at is null and revocat_at is null;
  insert into portal.client_tokens (usuari_id, motiu, token_hash, expira_at, creat_per)
  values (p_usuari_id, p_motiu, p_token_hash, p_expira_at, p_actor);
end;
$$;

-- Suspendre, reactivar o revocar. Retorna el user_id (l'Edge Function bloqueja o
-- desbloqueja el compte d'Auth).
create function portal.client_canvia_estat(p_actor uuid, p_usuari_id uuid, p_accio text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_usuari portal.client_usuaris;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_usuari from portal.client_usuaris where id = p_usuari_id for update;
  if v_usuari.id is null then
    raise exception 'Usuari inexistent' using errcode = 'P0002';
  end if;
  if v_usuari.estat = 'revocat' then
    raise exception 'Aquest usuari ja està revocat' using errcode = '42501';
  end if;

  if p_accio = 'suspen' then
    if v_usuari.estat = 'suspes' then
      raise exception 'Aquest usuari ja està suspès' using errcode = '42501';
    end if;
    update portal.client_usuaris set estat = 'suspes', suspes_at = now() where id = p_usuari_id;
  elsif p_accio = 'reactiva' then
    if v_usuari.estat <> 'suspes' then
      raise exception 'Només es pot reactivar un usuari suspès' using errcode = '42501';
    end if;
    -- Torna a l'estat que tenia: actiu si s'havia activat, pendent si no
    update portal.client_usuaris
       set estat = case when activat_at is not null and sessio_activacio is null then 'actiu'::portal.estat_usuari_client
                        else 'pendent'::portal.estat_usuari_client end,
           suspes_at = null
     where id = p_usuari_id;
  elsif p_accio = 'revoca' then
    update portal.client_usuaris set estat = 'revocat', revocat_at = now() where id = p_usuari_id;
    update portal.client_vincles set baixa_at = now(), baixa_per = p_actor where usuari_id = p_usuari_id and baixa_at is null;
  else
    raise exception 'Acció no vàlida' using errcode = '22023';
  end if;

  if p_accio in ('suspen', 'revoca') then
    update portal.client_tokens set revocat_at = now() where usuari_id = p_usuari_id and usat_at is null and revocat_at is null;
    update portal.client_sessions
       set tancada_at = now(), motiu_tancament = case when p_accio = 'suspen' then 'suspensio' else 'revocacio' end
     where usuari_id = p_usuari_id and tancada_at is null;
  end if;
  return v_usuari.user_id;
end;
$$;

-- Descàrrega d'un fitxer rebut (el permís el comprova l'Edge Function amb la
-- sessió del personal i RLS; aquí es torna a comprovar i es registra)
create function portal.client_registra_descarrega(p_actor uuid, p_fitxer_id uuid, p_ip inet, p_user_agent text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_f portal.client_enviament_fitxers;
begin
  perform portal.actua_com(p_actor, 'personal');
  select f.* into v_f
  from portal.client_enviament_fitxers f
  join portal.client_enviaments e on e.id = f.enviament_id
  join portal.client_destinataris d on d.id = e.destinatari_id
  where f.id = p_fitxer_id and f.verificat_at is not null and f.storage_path is not null
    and e.estat in ('enviat', 'arxivat')
    and (d.user_id = p_actor or exists (select 1 from portal.staff_profiles s where s.user_id = p_actor and s.actiu and s.role = 'ocic'));
  if v_f.id is null then
    raise exception 'Fitxer no disponible' using errcode = 'P0002';
  end if;
  perform portal.client_registre('DESCARREGA', 'client_enviament_fitxers', v_f.id, p_ip, p_user_agent);
  return jsonb_build_object('storage_path', v_f.storage_path, 'nom_fitxer', v_f.nom_fitxer, 'sha256', v_f.sha256);
end;
$$;

-- ─── 10.2 Personal (panell, authenticated) ───────────────────────────────────

-- "Descarregat i arxivat": el destinatari o l'OCIC
create function portal.client_enviament_arxiva(p_enviament_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform portal.exigeix_personal_o_servei();
  if not portal.enviament_visible(p_enviament_id) then
    raise exception 'Només el destinatari de l''enviament o l''OCIC' using errcode = '42501';
  end if;
  update portal.client_enviaments set estat = 'arxivat' where id = p_enviament_id and estat = 'enviat';
  if not found then
    raise exception 'Aquest enviament no està pendent d''arxivar' using errcode = '42501';
  end if;
end;
$$;

-- Destinataris (només OCIC): activar o desactivar, i associar-hi l'usuari del
-- portal pel seu correu
create function portal.client_destinatari_actualitza(p_id uuid, p_actiu boolean, p_email_personal text default null)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC' using errcode = '42501';
  end if;
  if p_email_personal is not null then
    select s.user_id into v_user from portal.staff_profiles s join auth.users u on u.id = s.user_id
     where lower(u.email) = lower(btrim(p_email_personal)) and s.actiu;
    if v_user is null then
      raise exception 'Aquest correu no és de cap usuari actiu del portal' using errcode = 'P0002';
    end if;
    update portal.client_destinataris set user_id = v_user where id = p_id;
  end if;
  update portal.client_destinataris set actiu = p_actiu where id = p_id;
  if not found then
    raise exception 'Destinatari inexistent' using errcode = 'P0002';
  end if;
end;
$$;

-- ─── 10.3 Accés (Edge Function portal-client-acces, service_role) ────────────

-- Enllaç vàlid: no usat, no revocat, no caducat; usuari no suspès ni revocat
create function portal.client_obre_token(p_token_hash text)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object('usuari_id', u.id, 'user_id', u.user_id, 'nom', u.nom, 'email', u.email,
                            'motiu', t.motiu, 'expira_at', t.expira_at,
                            'condicions', (select versio from portal.client_condicions where vigent))
  from portal.client_tokens t
  join portal.client_usuaris u on u.id = t.usuari_id
  where t.token_hash = p_token_hash
    and t.usat_at is null and t.revocat_at is null and t.expira_at > now()
    and u.estat in ('pendent', 'actiu')
    and (t.motiu = 'restabliment' or u.activat_at is null)
    and exists (select 1 from portal.client_vincles v where v.usuari_id = u.id and v.baixa_at is null);
$$;

-- Consumeix l'enllaç un cop fixada la contrasenya. Registra l'acceptació de
-- les condicions i la sessió d'activació (sense segon factor encara). L'usuari
-- queda pendent fins que configura el segon factor (client_completa_activacio).
create function portal.client_consumeix_token(p_token_hash text, p_session_id uuid, p_versio text, p_ip inet, p_user_agent text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_t portal.client_tokens;
  v_u portal.client_usuaris;
begin
  select * into v_t from portal.client_tokens where token_hash = p_token_hash for update;
  if v_t.id is null or v_t.usat_at is not null or v_t.revocat_at is not null or v_t.expira_at <= now() then
    raise exception 'Enllaç no vàlid' using errcode = '42501';
  end if;
  select * into v_u from portal.client_usuaris where id = v_t.usuari_id for update;
  if v_u.estat not in ('pendent', 'actiu') or (v_t.motiu = 'invitacio' and v_u.activat_at is not null)
     or not exists (select 1 from portal.client_vincles v where v.usuari_id = v_u.id and v.baixa_at is null) then
    raise exception 'Enllaç no vàlid' using errcode = '42501';
  end if;
  if p_versio is distinct from (select versio from portal.client_condicions where vigent) then
    raise exception 'Cal acceptar les condicions d''ús vigents' using errcode = '23514';
  end if;

  perform portal.client_actor(v_u.id);
  update portal.client_tokens set usat_at = now() where id = v_t.id;
  update portal.client_tokens set revocat_at = now() where usuari_id = v_u.id and usat_at is null and revocat_at is null;
  update portal.client_sessions set tancada_at = now(), motiu_tancament = 'restabliment'
   where usuari_id = v_u.id and tancada_at is null;
  insert into portal.client_sessions (usuari_id, session_id, tipus, ip, user_agent)
  values (v_u.id, p_session_id, 'activacio', p_ip, left(p_user_agent, 500));
  insert into portal.client_acceptacions (usuari_id, versio, ip, user_agent)
  values (v_u.id, p_versio, p_ip, left(p_user_agent, 500));
  update portal.client_usuaris
     set estat = 'pendent', sessio_activacio = p_session_id, intents_fallits = 0, bloquejat_fins = null,
         condicions_versio = p_versio, condicions_at = now()
   where id = v_u.id;
  return jsonb_build_object('usuari_id', v_u.id, 'user_id', v_u.user_id, 'motiu', v_t.motiu);
end;
$$;

-- Segon factor configurat (l'Edge Function ha comprovat aal2 i el factor TOTP
-- verificat): l'usuari queda actiu. Només amb la sessió d'activació.
create function portal.client_completa_activacio(p_user_id uuid, p_session_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_u portal.client_usuaris;
begin
  select * into v_u from portal.client_usuaris where user_id = p_user_id for update;
  if v_u.id is null or v_u.estat <> 'pendent' or v_u.sessio_activacio is distinct from p_session_id then
    raise exception 'Activació no vàlida' using errcode = '42501';
  end if;
  if v_u.condicions_versio is distinct from (select versio from portal.client_condicions where vigent) then
    raise exception 'Cal acceptar les condicions d''ús vigents' using errcode = '23514';
  end if;
  perform portal.client_actor(v_u.id);
  update portal.client_sessions set mfa_at = now(), ultima_activitat = now()
   where session_id = p_session_id and usuari_id = v_u.id and tancada_at is null;
  if not found then
    raise exception 'Activació no vàlida' using errcode = '42501';
  end if;
  update portal.client_usuaris
     set estat = 'actiu', activat_at = coalesce(activat_at, now()), sessio_activacio = null
   where id = v_u.id;
end;
$$;

-- Dades per a l'inici de sessió (per correu). Null si no és usuari de client.
create function portal.client_prepara_acces(p_email text)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object('usuari_id', u.id, 'user_id', u.user_id, 'estat', u.estat,
                            'bloquejat_fins', case when u.bloquejat_fins > now() then u.bloquejat_fins end)
  from portal.client_usuaris u where u.email = lower(btrim(p_email));
$$;

-- Intent fallit (contrasenya o codi). En arribar al màxim, bloqueja l'accés
-- durant durada_bloqueig. Retorna el bloqueig, si n'hi ha.
create function portal.client_registra_fallada(p_usuari_id uuid, p_pas text, p_ip inet, p_user_agent text)
  returns timestamptz
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_c portal.config_area_client;
  v_n int;
  v_fins timestamptz;
begin
  select * into v_c from portal.config_area_client;
  perform portal.client_actor(p_usuari_id);
  update portal.client_usuaris set intents_fallits = intents_fallits + 1
   where id = p_usuari_id returning intents_fallits into v_n;
  if v_n is null then
    return null;
  end if;
  if v_n >= v_c.intents_maxims then
    v_fins := now() + v_c.durada_bloqueig;
    update portal.client_usuaris set intents_fallits = 0, bloquejat_fins = v_fins where id = p_usuari_id;
  end if;
  perform portal.client_registre('ACCES_FALLIT', 'client_usuaris', p_usuari_id, p_ip, p_user_agent,
                                 jsonb_build_object('pas', p_pas, 'bloquejat_fins', v_fins));
  return v_fins;
end;
$$;

-- Sessió nova després de la contrasenya; encara sense segon factor
create function portal.client_obre_sessio(p_usuari_id uuid, p_session_id uuid, p_ip inet, p_user_agent text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not exists (select 1 from portal.client_usuaris
                  where id = p_usuari_id and estat = 'actiu' and (bloquejat_fins is null or bloquejat_fins <= now())) then
    raise exception 'Accés no permès' using errcode = '42501';
  end if;
  perform portal.client_actor(p_usuari_id);
  insert into portal.client_sessions (usuari_id, session_id, tipus, ip, user_agent)
  values (p_usuari_id, p_session_id, 'acces', p_ip, left(p_user_agent, 500));
end;
$$;

-- Segon factor verificat a la sessió (l'Edge Function ho ha comprovat)
create function portal.client_sessio_mfa(p_user_id uuid, p_session_id uuid, p_ip inet, p_user_agent text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_u portal.client_usuaris;
  v_s uuid;
begin
  select * into v_u from portal.client_usuaris where user_id = p_user_id;
  if v_u.id is null or v_u.estat <> 'actiu' or (v_u.bloquejat_fins is not null and v_u.bloquejat_fins > now()) then
    raise exception 'Accés no permès' using errcode = '42501';
  end if;
  perform portal.client_actor(v_u.id);
  update portal.client_sessions set mfa_at = now(), ultima_activitat = now()
   where session_id = p_session_id and usuari_id = v_u.id and tipus = 'acces' and mfa_at is null and tancada_at is null
  returning id into v_s;
  if v_s is null then
    raise exception 'Sessió no vàlida' using errcode = '42501';
  end if;
  update portal.client_usuaris set intents_fallits = 0, bloquejat_fins = null where id = v_u.id;
  perform portal.client_registre('ACCES', 'client_sessions', v_s, p_ip, p_user_agent);
end;
$$;

-- Estat de la sessió per a cada petició de l'àrea de client. Si és vàlida,
-- n'actualitza l'activitat (p_toca); si ha passat el termini d'inactivitat, la tanca.
-- motiu: ok | condicions | inactivitat | sessio | usuari | bloquejat
create function portal.client_estat_sessio(p_user_id uuid, p_session_id uuid, p_toca boolean default true)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_u portal.client_usuaris;
  v_s portal.client_sessions;
  v_c portal.config_area_client;
  v_vigent text := (select versio from portal.client_condicions where vigent);
begin
  select * into v_c from portal.config_area_client;
  select * into v_u from portal.client_usuaris where user_id = p_user_id;
  if v_u.id is null or v_u.estat <> 'actiu' then
    return jsonb_build_object('ok', false, 'motiu', 'usuari');
  end if;
  if v_u.bloquejat_fins is not null and v_u.bloquejat_fins > now() then
    return jsonb_build_object('ok', false, 'motiu', 'bloquejat');
  end if;
  select * into v_s from portal.client_sessions
   where session_id = p_session_id and usuari_id = v_u.id and mfa_at is not null and tancada_at is null
   for update;
  if v_s.id is null then
    return jsonb_build_object('ok', false, 'motiu', 'sessio');
  end if;
  if v_s.ultima_activitat <= now() - v_c.inactivitat then
    perform portal.client_actor(v_u.id);
    update portal.client_sessions set tancada_at = now(), motiu_tancament = 'inactivitat' where id = v_s.id;
    return jsonb_build_object('ok', false, 'motiu', 'inactivitat');
  end if;
  if p_toca then
    update portal.client_sessions set ultima_activitat = now() where id = v_s.id;
  end if;
  if v_u.condicions_versio is distinct from v_vigent then
    return jsonb_build_object('ok', false, 'motiu', 'condicions', 'usuari_id', v_u.id, 'versio', v_vigent);
  end if;
  return jsonb_build_object('ok', true, 'motiu', 'ok', 'usuari_id', v_u.id, 'versio', v_vigent);
end;
$$;

create function portal.client_tanca_sessio(p_user_id uuid, p_session_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_u uuid := (select id from portal.client_usuaris where user_id = p_user_id);
begin
  if v_u is null then
    return;
  end if;
  perform portal.client_actor(v_u);
  update portal.client_sessions set tancada_at = now(), motiu_tancament = 'sortida'
   where session_id = p_session_id and usuari_id = v_u and tancada_at is null;
end;
$$;

-- Acceptació d'una versió nova de les condicions (sessió verificada)
create function portal.client_registra_acceptacio(p_user_id uuid, p_session_id uuid, p_versio text, p_ip inet, p_user_agent text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_e jsonb := portal.client_estat_sessio(p_user_id, p_session_id, true);
  v_u uuid;
begin
  if v_e ->> 'motiu' not in ('ok', 'condicions') then
    raise exception 'Sessió no vàlida' using errcode = '42501';
  end if;
  if p_versio is distinct from (select versio from portal.client_condicions where vigent) then
    raise exception 'Cal acceptar les condicions d''ús vigents' using errcode = '23514';
  end if;
  v_u := (v_e ->> 'usuari_id')::uuid;
  perform portal.client_actor(v_u);
  insert into portal.client_acceptacions (usuari_id, versio, ip, user_agent)
  values (v_u, p_versio, p_ip, left(p_user_agent, 500));
  update portal.client_usuaris set condicions_versio = p_versio, condicions_at = now() where id = v_u;
end;
$$;

-- ─── 10.4 Àrea de client (rol portal_client; cada funció exigeix la sessió) ──

create function portal.client_inici()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_u uuid := portal.client_usuari_actual();
begin
  if v_u is null then
    raise exception 'Accés no autoritzat' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'usuari', (select jsonb_build_object('nom', nom, 'email', email) from portal.client_usuaris where id = v_u),
    'condicions', (select versio from portal.client_condicions where vigent),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom_mostrat) order by c.nom_mostrat)
      from portal.client_vincles v join portal.clients c on c.id = v.client_id
      where v.usuari_id = v_u and v.baixa_at is null and not portal.client_bloquejat_intern(c.id)), '[]'::jsonb),
    'destinataris', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'nom', d.nom, 'email', d.email,
                                          'disponible', portal.destinatari_disponible(d.id))
                       order by d.ordre, d.email)
      from portal.client_destinataris d), '[]'::jsonb));
end;
$$;

create function portal.client_enviaments_llista(p_client_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_u uuid := portal.client_usuari_actual();
begin
  if v_u is null or not portal.client_vinculat(p_client_id) then
    raise exception 'Accés no autoritzat' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', e.id, 'data', e.enviat_at, 'assumpte', e.assumpte, 'destinatari', d.email,
             'n_fitxers', e.n_fitxers, 'estat', case when e.estat = 'arxivat' then 'rebut' else 'enviat' end)
           order by e.enviat_at desc)
    from portal.client_enviaments e
    join portal.client_destinataris d on d.id = e.destinatari_id
    where e.usuari_id = v_u and e.client_id = p_client_id and e.estat in ('enviat', 'arxivat')), '[]'::jsonb);
end;
$$;

-- Els meus documents: NOMÉS aquests tipus, del client vinculat:
--   · contracte final signat                (contracte,            signat)
--   · "Còpia per al client" del KYC         (kyc_pf / kyc_pj,      copia_client)
--   · informació de protecció de dades      (pdp,                  signat)
--   · autorització de càrrec signada        (autoritzacio_carrec,  signat)
-- Mai la versió interna del KYC (validat, intern), ni res de l'IRPF, ni les
-- evidències, els originals o els adjunts. Sense sol·licituds anul·lades ni
-- bloquejades per conservació.
create function portal.client_document_permes(p_document_type portal.document_type, p_kind portal.doc_kind)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select (p_document_type = 'contracte'           and p_kind = 'signat')
      or (p_document_type in ('kyc_pf', 'kyc_pj') and p_kind = 'copia_client')
      or (p_document_type = 'pdp'                 and p_kind = 'signat')
      or (p_document_type = 'autoritzacio_carrec' and p_kind = 'signat');
$$;

create function portal.client_documents_llista(p_client_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  if portal.client_usuari_actual() is null or not portal.client_vinculat(p_client_id) then
    raise exception 'Accés no autoritzat' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'tipus', r.document_type, 'data', d.created_at,
             'titol', (select k.titol from portal.contractes k where k.request_id = r.id))
           order by d.created_at desc)
    from portal.documents d
    join portal.requests r on r.id = d.request_id
    where r.client_id = p_client_id
      and r.bloquejat_at is null
      and r.status <> 'anullat'
      and r.document_type <> 'irpf_comunicacio'
      and d.kind not in ('intern', 'validat')
      and portal.client_document_permes(r.document_type, d.kind)), '[]'::jsonb);
end;
$$;

-- Camí d'un document permès (l'Edge Function en genera la URL signada) i registre
create function portal.client_document_cami(p_document_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_d   portal.documents;
  v_r   portal.requests;
begin
  if portal.client_usuari_actual() is null then
    raise exception 'Accés no autoritzat' using errcode = '42501';
  end if;
  select * into v_d from portal.documents where id = p_document_id;
  select * into v_r from portal.requests where id = v_d.request_id;
  if v_d.id is null or not portal.client_vinculat(v_r.client_id) or v_r.bloquejat_at is not null
     or v_r.status = 'anullat' or v_r.document_type = 'irpf_comunicacio' or v_d.kind in ('intern', 'validat')
     or not portal.client_document_permes(v_r.document_type, v_d.kind) then
    raise exception 'Document no disponible' using errcode = 'P0002';
  end if;
  perform portal.client_registre('DESCARREGA_CLIENT', 'documents', v_d.id, portal.ip_peticio(), portal.navegador_peticio());
  return jsonb_build_object('storage_path', v_d.storage_path, 'tipus', v_r.document_type, 'data', v_d.created_at);
end;
$$;

-- Enviament nou (pendent de pujar els fitxers). Comprova destinatari, assumpte,
-- comentari, tipus i mides declarades; el contingut real el comprova l'Edge
-- Function abans de client_enviament_registra.
create function portal.client_enviament_crea(p_client_id uuid, p_destinatari_id uuid, p_assumpte text, p_comentari text, p_fitxers jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_u     uuid := portal.client_usuari_actual();
  v_id    uuid;
  v_total bigint;
  v_n     int;
  v_f     jsonb;
  v_ext   text;
  v_fid   uuid;
  v_out   jsonb := '[]'::jsonb;
  i       int := 0;
  v_mimes constant jsonb := '{"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xls": "application/vnd.ms-excel",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "doc": "application/msword",
    "csv": "text/csv"}';
begin
  if v_u is null or not portal.client_vinculat(p_client_id) then
    raise exception 'Accés no autoritzat' using errcode = '42501';
  end if;
  if not portal.destinatari_disponible(p_destinatari_id) then
    raise exception 'Destinatari no disponible' using errcode = '23514';
  end if;
  if btrim(coalesce(p_assumpte, '')) = '' or char_length(btrim(p_assumpte)) > 120 then
    raise exception 'L''assumpte és obligatori (màxim 120 caràcters)' using errcode = '23514';
  end if;
  if jsonb_typeof(p_fitxers) <> 'array' then
    raise exception 'Fitxers no vàlids' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_fitxers);
  if v_n < 1 or v_n > 20 then
    raise exception 'Cal entre 1 i 20 fitxers' using errcode = '23514';
  end if;
  select sum((x ->> 'mida')::bigint) into v_total from jsonb_array_elements(p_fitxers) x;
  if v_total > 104857600 then
    raise exception 'L''enviament supera els 100 MB' using errcode = '23514';
  end if;

  insert into portal.client_enviaments (usuari_id, client_id, destinatari_id, assumpte, comentari, n_fitxers, mida_total)
  values (v_u, p_client_id, p_destinatari_id, btrim(p_assumpte), nullif(btrim(coalesce(p_comentari, '')), ''), v_n, v_total)
  returning id into v_id;

  for v_f in select * from jsonb_array_elements(p_fitxers) loop
    i := i + 1;
    v_ext := lower(v_f ->> 'extensio');
    if not (v_mimes ? v_ext) then
      raise exception 'Tipus de fitxer no admès' using errcode = '23514';
    end if;
    v_fid := gen_random_uuid();
    insert into portal.client_enviament_fitxers (id, enviament_id, ordre, nom_fitxer, extensio, mime, mida_bytes, storage_path)
    values (v_fid, v_id, i, btrim(v_f ->> 'nom'), v_ext, v_mimes ->> v_ext, (v_f ->> 'mida')::bigint,
            'enviaments/' || v_id || '/' || v_fid || '.' || v_ext);
    v_out := v_out || jsonb_build_object('id', v_fid, 'ordre', i, 'storage_path', 'enviaments/' || v_id || '/' || v_fid || '.' || v_ext,
                                         'mime', v_mimes ->> v_ext);
  end loop;
  return jsonb_build_object('enviament_id', v_id, 'fitxers', v_out);
end;
$$;

-- ─── 10.5 Enviaments (Edge Function portal-client-area, service_role) ────────

-- Fitxers verificats (contingut real, mida i empremta): l'enviament queda enviat.
-- Retorna la clau de Formspree del destinatari.
create function portal.client_enviament_registra(p_user_id uuid, p_enviament_id uuid, p_fitxers jsonb)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_e portal.client_enviaments;
  v_f jsonb;
  v_total bigint := 0;
begin
  select e.* into v_e from portal.client_enviaments e join portal.client_usuaris u on u.id = e.usuari_id
   where e.id = p_enviament_id and u.user_id = p_user_id for update of e;
  if v_e.id is null or v_e.estat <> 'pujant' then
    raise exception 'Enviament no vàlid' using errcode = '42501';
  end if;
  if not portal.destinatari_disponible(v_e.destinatari_id) then
    raise exception 'Destinatari no disponible' using errcode = '23514';
  end if;
  if jsonb_array_length(p_fitxers) <> v_e.n_fitxers then
    raise exception 'Falten fitxers' using errcode = '23514';
  end if;
  perform portal.client_actor(v_e.usuari_id);
  for v_f in select * from jsonb_array_elements(p_fitxers) loop
    if (v_f ->> 'mida')::bigint > 20971520 then
      raise exception 'Un fitxer supera els 20 MB' using errcode = '23514';
    end if;
    update portal.client_enviament_fitxers
       set sha256 = v_f ->> 'sha256', mida_bytes = (v_f ->> 'mida')::bigint, verificat_at = now()
     where id = (v_f ->> 'id')::uuid and enviament_id = p_enviament_id and verificat_at is null;
    if not found then
      raise exception 'Fitxer no vàlid' using errcode = '23514';
    end if;
    v_total := v_total + (v_f ->> 'mida')::bigint;
  end loop;
  if v_total > 104857600 then
    raise exception 'L''enviament supera els 100 MB' using errcode = '23514';
  end if;
  update portal.client_enviaments set estat = 'enviat' where id = p_enviament_id;
  return (select clau_formspree from portal.client_destinataris where id = v_e.destinatari_id);
end;
$$;

-- Contingut no vàlid: l'enviament queda rebutjat (els fitxers ja s'han esborrat
-- o els esborrarà la conservació)
create function portal.client_enviament_rebutja(p_user_id uuid, p_enviament_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_e portal.client_enviaments;
begin
  select e.* into v_e from portal.client_enviaments e join portal.client_usuaris u on u.id = e.usuari_id
   where e.id = p_enviament_id and u.user_id = p_user_id for update of e;
  if v_e.id is null or v_e.estat <> 'pujant' then
    raise exception 'Enviament no vàlid' using errcode = '42501';
  end if;
  perform portal.client_actor(v_e.usuari_id);
  update portal.client_enviaments set estat = 'rebutjat' where id = p_enviament_id;
end;
$$;

-- ─── 10.6 Conservació (Edge Function portal-purga, service_role) ─────────────

-- Enviaments amb fitxers a destruir:
--   · arxivats fa més de termini_arxivats;
--   · rebuts fa més de termini_maxim (sigui quin sigui l'estat);
--   · pujades no acabades fa més de termini_pujada, i rebutjats.
create function portal.client_venciments_enviaments(p_ara timestamptz default now())
  returns table (enviament_id uuid, causa text, vencut_el timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select e.id,
         case when e.estat = 'rebutjat' then 'rebutjat'
              when e.estat = 'pujant' then 'pujada no acabada'
              when e.arxivat_at is not null and e.arxivat_at + c.termini_arxivats <= e.created_at + c.termini_maxim
                then 'arxivat' else 'termini màxim' end,
         case when e.estat = 'rebutjat' then e.updated_at
              when e.estat = 'pujant' then e.created_at + c.termini_pujada
              else least(coalesce(e.arxivat_at + c.termini_arxivats, 'infinity'), e.created_at + c.termini_maxim) end
  from portal.client_enviaments e
  cross join portal.config_area_client c
  where e.estat <> 'destruit';
$$;

create function portal.client_enviaments_a_destruir()
  returns table (enviament_id uuid, causa text, fitxers text[])
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select v.enviament_id, v.causa,
         coalesce((select array_agg(o.name order by o.name) from storage.objects o
                   where o.bucket_id = 'client-enviaments' and o.name like 'enviaments/' || v.enviament_id || '/%'), '{}')
  from portal.client_venciments_enviaments(now()) v
  where v.vencut_el <= now();
$$;

-- Usuaris revocats fa més de termini_revocats
create function portal.client_usuaris_a_destruir()
  returns table (usuari_id uuid, revocat_at timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select u.id, u.revocat_at
  from portal.client_usuaris u cross join portal.config_area_client c
  where u.estat = 'revocat' and u.revocat_at + c.termini_revocats <= now();
$$;

-- Fitxers que queden d'un enviament al bucket (portal_purga no llegeix storage)
create function portal.client_fitxers_restants(p_enviament_id uuid)
  returns int
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select count(*)::int from storage.objects
  where bucket_id = 'client-enviaments' and name like 'enviaments/' || p_enviament_id || '/%';
$$;

create function portal.client_compte_existeix(p_user_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from auth.users where id = p_user_id);
$$;

create function portal.client_comptes_pendents()
  returns setof uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select user_id from portal.client_comptes_a_esborrar order by created_at;
$$;

create function portal.client_simula_conservacio()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object(
    'enviaments_a_destruir', coalesce((select jsonb_agg(jsonb_build_object('enviament_id', d.enviament_id, 'causa', d.causa, 'fitxers', cardinality(d.fitxers)))
                                       from portal.client_enviaments_a_destruir() d), '[]'::jsonb),
    'usuaris_a_destruir', coalesce((select jsonb_agg(jsonb_build_object('usuari_id', u.usuari_id, 'revocat_at', u.revocat_at))
                                    from portal.client_usuaris_a_destruir() u), '[]'::jsonb));
$$;

-- Destrucció dels fitxers d'un enviament (propietari portal_purga). Exigeix
-- que ja no en quedi cap fitxer al bucket. En queda un registre mínim sense
-- dades personals: dates, nombre de fitxers, mides i empremtes.
create function portal.client_destrueix_enviament(p_enviament_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_e     portal.client_enviaments;
  v_ids   uuid[];
  v_res   jsonb;
begin
  select * into v_e from portal.client_enviaments where id = p_enviament_id for update;
  if v_e.id is null or v_e.estat = 'destruit' then
    return jsonb_build_object('enviament_id', p_enviament_id, 'ja_destruit', true);
  end if;
  if not exists (select 1 from portal.client_venciments_enviaments(now()) v where v.enviament_id = p_enviament_id and v.vencut_el <= now()) then
    raise exception 'L''enviament no ha arribat al final del termini' using errcode = '42501';
  end if;
  if portal.client_fitxers_restants(p_enviament_id) > 0 then
    raise exception 'Encara hi ha fitxers de l''enviament' using errcode = '55000';
  end if;

  perform set_config('portal.mode', 'purga', true);

  v_ids := array[p_enviament_id] || coalesce((select array_agg(id) from portal.client_enviament_fitxers where enviament_id = p_enviament_id), '{}');

  update portal.client_enviament_fitxers
     set nom_fitxer = null, storage_path = null, destruit_at = now()
   where enviament_id = p_enviament_id;
  update portal.client_enviaments
     set usuari_id = null, client_id = null, assumpte = null, comentari = null,
         estat = 'destruit', fitxers_destruits_at = now()
   where id = p_enviament_id;

  -- audit_log: detalls d'aquestes entitats → {"purgat": true}
  update portal.audit_log set detalls = '{"purgat": true}'::jsonb
   where entitat_id = any (v_ids)
     and entitat in ('client_enviaments', 'client_enviament_fitxers')
     and detalls is distinct from '{"purgat": true}'::jsonb;

  v_res := jsonb_build_object(
    'enviament_id', p_enviament_id,
    'rebut_at', v_e.created_at, 'enviat_at', v_e.enviat_at, 'arxivat_at', v_e.arxivat_at, 'destruit_at', now(),
    'n_fitxers', v_e.n_fitxers,
    'fitxers', (select coalesce(jsonb_agg(jsonb_build_object('sha256', f.sha256, 'mida', f.mida_bytes) order by f.ordre), '[]'::jsonb)
                  from portal.client_enviament_fitxers f where f.enviament_id = p_enviament_id));
  insert into portal.audit_log (actor, accio, entitat, entitat_id, detalls)
  values (null, 'DESTRUCCIO', 'client_enviaments', p_enviament_id, v_res);

  perform set_config('portal.mode', '', true);
  return v_res;
end;
$$;

-- Destrucció d'un usuari revocat i del seu registre d'accessos (propietari
-- portal_purga). El compte d'Auth s'esborra després (Admin API) des de
-- client_comptes_a_esborrar.
create function portal.client_destrueix_usuari(p_usuari_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_u   portal.client_usuaris;
  v_ids uuid[];
  v_res jsonb;
begin
  select * into v_u from portal.client_usuaris where id = p_usuari_id;
  if v_u.id is null then
    return jsonb_build_object('usuari_id', p_usuari_id, 'ja_destruit', true);
  end if;
  if not exists (select 1 from portal.client_usuaris_a_destruir() d where d.usuari_id = p_usuari_id) then
    raise exception 'L''usuari no ha arribat al final del termini' using errcode = '42501';
  end if;
  if exists (select 1 from portal.client_enviaments where usuari_id = p_usuari_id) then
    raise exception 'Encara hi ha enviaments de l''usuari amb dades' using errcode = '55000';
  end if;

  perform set_config('portal.mode', 'purga', true);

  select array_agg(x) into v_ids from (
    select v_u.id union all
    select id from portal.client_vincles      where usuari_id = p_usuari_id union all
    select id from portal.client_tokens       where usuari_id = p_usuari_id union all
    select id from portal.client_sessions     where usuari_id = p_usuari_id union all
    select id from portal.client_acceptacions where usuari_id = p_usuari_id
  ) s(x);

  delete from portal.client_vincles      where usuari_id = p_usuari_id;
  delete from portal.client_tokens       where usuari_id = p_usuari_id;
  delete from portal.client_sessions     where usuari_id = p_usuari_id;
  delete from portal.client_acceptacions where usuari_id = p_usuari_id;
  delete from portal.client_usuaris      where id = p_usuari_id;
  insert into portal.client_comptes_a_esborrar (user_id) values (v_u.user_id) on conflict do nothing;

  update portal.audit_log set detalls = '{"purgat": true}'::jsonb
   where ((entitat_id = any (v_ids)
           and entitat in ('client_usuaris', 'client_vincles', 'client_tokens', 'client_sessions', 'client_acceptacions'))
          or (actor = v_u.user_id and entitat in ('client_usuaris', 'client_sessions', 'documents', 'client_enviaments', 'client_enviament_fitxers')))
     and detalls is distinct from '{"purgat": true}'::jsonb;

  v_res := jsonb_build_object('usuari_id', p_usuari_id, 'revocat_at', v_u.revocat_at, 'destruit_at', now());
  insert into portal.audit_log (actor, accio, entitat, entitat_id, detalls)
  values (null, 'DESTRUCCIO', 'client_usuaris', p_usuari_id, v_res);

  perform set_config('portal.mode', '', true);
  return v_res;
end;
$$;

-- Compte d'Auth ja esborrat (propietari portal_purga)
create function portal.client_compte_esborrat(p_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if portal.client_compte_existeix(p_user_id) then
    raise exception 'El compte encara existeix' using errcode = '55000';
  end if;
  perform set_config('portal.mode', 'purga', true);
  delete from portal.client_comptes_a_esborrar where user_id = p_user_id;
  perform set_config('portal.mode', '', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 10.7 destrueix_solicitud: la de la migració dels contractes, sense canvis,
--      més: no destrueix el client mentre en quedi algun enviament amb dades, i
--      quan el destrueix, n'esborra els vincles de l'àrea de client.
-- -----------------------------------------------------------------------------
grant portal_purga to postgres with set true;

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
  v_perceptor uuid;
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

  select perceptor_id into v_perceptor from portal.irpf_comunicacions where request_id = p_request_id;

  -- Identificadors de totes les files i empremtes dels fitxers (abans d'esborrar)
  select array_agg(x) into v_ids from (
    select v_req.id union all
    select id from portal.autoritzacions_carrec  where request_id = p_request_id union all
    select id from portal.kyc_validacions        where request_id = p_request_id union all
    select id from portal.kyc_adjunts            where request_id = p_request_id union all
    select id from portal.kyc_formularis         where request_id = p_request_id union all
    select id from portal.pdp_consentiments      where request_id = p_request_id union all
    select id from portal.irpf_calculs           where request_id = p_request_id union all
    select id from portal.irpf_recepcions        where request_id = p_request_id union all
    select id from portal.irpf_comunicacions     where request_id = p_request_id union all
    select id from portal.contracte_contrafirmes where request_id = p_request_id union all
    select id from portal.contracte_originals    where request_id = p_request_id union all
    select id from portal.contracte_signants     where request_id = p_request_id union all
    select id from portal.contractes             where request_id = p_request_id union all
    select id from portal.signatures             where request_id = p_request_id union all
    select id from portal.documents              where request_id = p_request_id union all
    select id from portal.access_tokens          where request_id = p_request_id union all
    select id from portal.otps                   where request_id = p_request_id union all
    select id from portal.retencions             where request_id = p_request_id
  ) s(x);

  select coalesce(jsonb_agg(jsonb_build_object('tipus', kind, 'sha256', sha256) order by created_at), '[]'::jsonb)
    into v_fitxers from portal.documents where request_id = p_request_id;

  v_files := '{}'::jsonb;
  delete from portal.autoritzacions_carrec  where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('autoritzacions_carrec', n);
  delete from portal.kyc_validacions        where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('kyc_validacions', n);
  delete from portal.kyc_adjunts            where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('kyc_adjunts', n);
  delete from portal.kyc_formularis         where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('kyc_formularis', n);
  delete from portal.pdp_consentiments      where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('pdp_consentiments', n);
  delete from portal.irpf_calculs           where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('irpf_calculs', n);
  delete from portal.irpf_recepcions        where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('irpf_recepcions', n);
  delete from portal.irpf_comunicacions     where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('irpf_comunicacions', n);
  delete from portal.contracte_contrafirmes where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('contracte_contrafirmes', n);
  delete from portal.contracte_originals    where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('contracte_originals', n);
  delete from portal.contractes             where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('contractes', n);
  delete from portal.signatures             where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('signatures', n);
  delete from portal.documents              where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('documents', n);
  delete from portal.access_tokens          where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('access_tokens', n);
  delete from portal.contracte_signants     where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('contracte_signants', n);
  delete from portal.otps                   where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('otps', n);
  delete from portal.retencions             where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('retencions', n);
  delete from portal.requests               where id = p_request_id;         get diagnostics n = row_count; v_files := v_files || jsonb_build_object('requests', n);

  -- El perceptor, si ja no li queda cap comunicació ni cap càlcul
  if v_perceptor is not null
     and not exists (select 1 from portal.irpf_comunicacions where perceptor_id = v_perceptor)
     and not exists (select 1 from portal.irpf_calculs where perceptor_id = v_perceptor) then
    v_ids := v_ids || v_perceptor;
    delete from portal.irpf_perceptors where id = v_perceptor;
    v_files := v_files || jsonb_build_object('irpf_perceptors', 1);
  end if;

  -- El client (i les dades de pagador), si ja no li queda cap sol·licitud
  -- (àrea de client: ni cap enviament amb dades; els seus vincles s'esborren)
  if not exists (select 1 from portal.requests where client_id = v_req.client_id)
     and not exists (select 1 from portal.irpf_perceptors where client_id = v_req.client_id)
     and not exists (select 1 from portal.client_enviaments where client_id = v_req.client_id) then
    v_ids := v_ids || v_req.client_id;
    v_ids := v_ids || coalesce((select array_agg(id) from portal.irpf_pagadors where client_id = v_req.client_id), '{}');
    v_ids := v_ids || coalesce((select array_agg(id) from portal.client_vincles where client_id = v_req.client_id), '{}');
    delete from portal.irpf_pagadors where client_id = v_req.client_id;
    delete from portal.client_vincles where client_id = v_req.client_id;
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
                     'kyc_formularis', 'kyc_adjunts', 'kyc_validacions', 'pdp_consentiments',
                     'irpf_comunicacions', 'irpf_recepcions', 'irpf_calculs', 'irpf_perceptors', 'irpf_pagadors',
                     'contractes', 'contracte_originals', 'contracte_signants', 'contracte_contrafirmes',
                     'client_vincles')
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

-- Propietari portal_purga per a les funcions que esborren o buiden dades
grant create on schema portal to portal_purga;
alter function portal.client_destrueix_enviament(uuid) owner to portal_purga;
alter function portal.client_destrueix_usuari(uuid) owner to portal_purga;
alter function portal.client_compte_esborrat(uuid) owner to portal_purga;
revoke create on schema portal from portal_purga;
-- (abans de retirar portal_purga a postgres: un cop retirat, ja no en pot canviar els permisos)
revoke all on function portal.client_destrueix_enviament(uuid), portal.client_destrueix_usuari(uuid),
                       portal.client_compte_esborrat(uuid)
  from public, anon, authenticated, service_role, portal_client;
grant execute on function portal.client_destrueix_enviament(uuid), portal.client_destrueix_usuari(uuid),
                          portal.client_compte_esborrat(uuid)
  to service_role;

grant select, update (nom_fitxer, storage_path, destruit_at) on portal.client_enviament_fitxers to portal_purga;
grant select, update (usuari_id, client_id, assumpte, comentari, estat, fitxers_destruits_at) on portal.client_enviaments to portal_purga;
grant select, delete on portal.client_usuaris, portal.client_vincles, portal.client_tokens, portal.client_sessions,
                        portal.client_acceptacions to portal_purga;
grant select, insert, delete on portal.client_comptes_a_esborrar to portal_purga;
grant execute on function portal.client_venciments_enviaments(timestamptz), portal.client_usuaris_a_destruir(),
                          portal.client_fitxers_restants(uuid), portal.client_compte_existeix(uuid)
  to portal_purga;

revoke portal_purga from postgres;

-- -----------------------------------------------------------------------------
-- 11. Permisos
-- -----------------------------------------------------------------------------
revoke all on table portal.config_area_client, portal.client_condicions, portal.client_usuaris, portal.client_vincles,
                    portal.client_tokens, portal.client_sessions, portal.client_acceptacions, portal.client_destinataris,
                    portal.client_enviaments, portal.client_enviament_fitxers, portal.client_comptes_a_esborrar
  from public, anon, authenticated, service_role;

do $$
declare
  f text;
begin
  -- Cap funció nova per defecte
  for f in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'portal' and p.proowner = 'postgres'::regrole
      and p.proname <> 'client_bloquejat'  -- existent (conservació): no es toca
      and (p.proname like 'client\_%' or p.proname in
          ('protegeix_fitxer_enviament', 'valida_enviament', 'valida_destinatari', 'destinatari_disponible', 'enviament_visible',
           'ip_peticio', 'navegador_peticio'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, portal_client', f);
  end loop;
end;
$$;

-- ─── portal_client (usuari de client): només això ────────────────────────────
grant select (id, client_id)                        on portal.client_vincles      to portal_client;
grant select (id, nom_mostrat)                      on portal.clients             to portal_client;
grant select (id, nom, email, actiu, ordre)         on portal.client_destinataris to portal_client;
grant select (id, client_id, destinatari_id, assumpte, estat, n_fitxers, enviat_at)
                                                    on portal.client_enviaments   to portal_client;
grant select (versio, vigent)                       on portal.client_condicions   to portal_client;
-- Funcions de les polítiques i de l'àrea (cadascuna exigeix la sessió)
grant execute on function portal.client_usuari_actual(), portal.client_vinculat(uuid),
                          portal.client_inici(), portal.client_enviaments_llista(uuid),
                          portal.client_documents_llista(uuid), portal.client_document_cami(uuid),
                          portal.client_enviament_crea(uuid, uuid, text, text, jsonb)
  to portal_client;

-- ─── Personal (authenticated + RLS) ──────────────────────────────────────────
grant select on portal.client_usuaris, portal.client_vincles, portal.client_sessions, portal.client_acceptacions,
                portal.client_condicions, portal.client_destinataris, portal.client_enviaments,
                portal.client_enviament_fitxers
  to authenticated;
grant execute on function portal.enviament_visible(uuid), portal.client_enviament_arxiva(uuid),
                          portal.client_destinatari_actualitza(uuid, boolean, text)
  to authenticated;

-- ─── service_role (Edge Functions) ───────────────────────────────────────────
grant select on portal.config_area_client, portal.client_condicions, portal.client_usuaris, portal.client_vincles,
                portal.client_destinataris, portal.client_enviaments, portal.client_enviament_fitxers
  to service_role;
grant execute on function
  portal.client_correu_lliure(text), portal.client_usuaris_llista(uuid, uuid),
  portal.client_usuari_afegeix(uuid, uuid, text, text, uuid), portal.client_desvincula(uuid, uuid, uuid),
  portal.client_crea_token(uuid, uuid, text, text, timestamptz), portal.client_canvia_estat(uuid, uuid, text),
  portal.client_registra_descarrega(uuid, uuid, inet, text),
  portal.client_obre_token(text), portal.client_consumeix_token(text, uuid, text, inet, text),
  portal.client_completa_activacio(uuid, uuid), portal.client_prepara_acces(text),
  portal.client_registra_fallada(uuid, text, inet, text), portal.client_obre_sessio(uuid, uuid, inet, text),
  portal.client_sessio_mfa(uuid, uuid, inet, text), portal.client_estat_sessio(uuid, uuid, boolean),
  portal.client_tanca_sessio(uuid, uuid), portal.client_registra_acceptacio(uuid, uuid, text, inet, text),
  portal.client_enviament_registra(uuid, uuid, jsonb), portal.client_enviament_rebutja(uuid, uuid),
  portal.client_enviaments_a_destruir(), portal.client_usuaris_a_destruir(), portal.client_comptes_pendents(),
  portal.client_simula_conservacio()
  to service_role;

-- -----------------------------------------------------------------------------
-- 12. Destinataris inicials. info@ i mpaleari@ actius si tenen usuari actiu al
--     portal; mdelsoto@ inactiu i sense usuari (per activar-lo caldrà donar-li
--     usuari al portal).
-- -----------------------------------------------------------------------------
insert into portal.client_destinataris (email, nom, actiu, user_id, clau_formspree, ordre)
select d.email, d.nom, s.user_id is not null and d.actiu, s.user_id, d.clau, d.ordre
from (values
  ('info@ambit.ad',     'ÀMBIT Associats (info@ambit.ad)', true,  'INFO',     1),
  ('mpaleari@ambit.ad', 'Martín Paleari',                  true,  'MPALEARI', 2),
  ('mdelsoto@ambit.ad', 'Mariona del Soto',                false, 'MDELSOTO', 3)
) as d (email, nom, actiu, clau, ordre)
left join auth.users u on lower(u.email) = d.email and d.actiu
left join portal.staff_profiles s on s.user_id = u.id and s.actiu;
