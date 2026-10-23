-- =============================================================================
-- Portal de signatura · Contractes (2 de 2)
--
-- Tipus nou contracte (pàgines afegides: CONTRACTE v1). El personal, des d'un
-- client, puja el contracte en PDF, n'indica el títol i l'idioma ("Català" o
-- "Català i anglès") i hi afegeix un o més signants del client (nom, correu i
-- qualitat). El PDF original es desa sense modificar amb la seva empremta
-- SHA-256 i no se substitueix mai: si cal canviar-lo, s'anul·la la sol·licitud
-- i se'n crea una altra.
--
-- Cada signant té el seu enllaç i signa en qualsevol ordre: llegeix el
-- contracte, accepta la clàusula addicional de signatura electrònica (amb la
-- seva data i hora, anterior a la signatura) i signa. Quan han signat tots, el
-- contracte queda pendent de la signatura d'ÀMBIT, que només pot fer
-- mpaleari@ambit.ad amb la seva sessió; llavors es genera el PDF final:
-- l'original intacte i, a continuació, les pàgines afegides.
--
-- Estats: esborrany → enviat → parcialment_signat → pendent_ambit → signat.
-- Només l'OCIC anul·la, amb motiu, i només abans de signat.
--
-- Conservació: mentre dura la relació amb el client i sis anys després;
-- després, el bloqueig general de tres anys i la destrucció del mòdul existent.
--
-- Cap regla existent es debilita: les funcions que es substitueixen
-- conserven tot el que feien i només hi afegeixen el tipus nou. L'únic índex
-- que es reemplaça (un sol enllaç vigent per sol·licitud) es manté igual per a
-- tots els tipus existents i, per al contracte, passa a ser un per signant.
-- No toca cap taula de public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configuració
-- -----------------------------------------------------------------------------
alter table portal.config_conservacio
  -- Contracte: fi de la relació + sis anys; després, el bloqueig general (termini_bloqueig)
  add column termini_contracte interval not null default interval '6 years' check (termini_contracte >= interval '0');

-- -----------------------------------------------------------------------------
-- 2. Taules
-- -----------------------------------------------------------------------------

-- Dades del contracte (una per sol·licitud). No canvien mai.
create table portal.contractes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references portal.requests (id) on delete restrict,
  titol      text not null check (btrim(titol) <> '' and length(titol) <= 300),
  -- Idioma de tot el que afegeix el portal: 'ca' (català) o 'ca_en' (català i anglès)
  idioma     text not null check (idioma in ('ca', 'ca_en')),
  created_at timestamptz not null default now()
);

-- PDF original (un per contracte). No canvia mai ni se substitueix.
create table portal.contracte_originals (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null unique references portal.requests (id) on delete restrict,
  document_id uuid not null unique references portal.documents (id) on delete restrict,
  nom_fitxer  text not null check (btrim(nom_fitxer) <> '' and length(nom_fitxer) <= 200),
  pagines     int not null check (pagines between 1 and 2000),
  sha256      text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mida_bytes  bigint not null check (mida_bytes between 1 and 20971520),
  created_at  timestamptz not null default now()
);

-- Signants del client. L'acceptació prèvia i la signatura les registra
-- només el servei, una sola vegada cadascuna; la resta no canvia mai.
create table portal.contracte_signants (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid not null references portal.requests (id) on delete restrict,
  ordre                  int not null check (ordre between 1 and 20),
  nom                    text not null check (btrim(nom) <> '' and length(nom) <= 200),
  email                  text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 200),
  qualitat               text not null check (btrim(qualitat) <> '' and length(qualitat) <= 300),
  -- Acceptació prèvia de la clàusula addicional de signatura electrònica
  acceptat_at            timestamptz,
  acceptacio_ip          inet,
  acceptacio_user_agent  text,
  -- Signatura
  lloc                   text check (lloc is null or (btrim(lloc) <> '' and length(lloc) <= 100)),
  signat_at              timestamptz,
  imatge_path            text,
  imatge_sha256          text check (imatge_sha256 is null or imatge_sha256 ~ '^[0-9a-f]{64}$'),
  ip                     inet,
  user_agent             text,
  empremta_dades         text check (empremta_dades is null or empremta_dades ~ '^[0-9a-f]{64}$'),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (request_id, ordre),
  check ((signat_at is null) = (imatge_path is null)
     and (signat_at is null) = (imatge_sha256 is null)
     and (signat_at is null) = (lloc is null)
     and (signat_at is null) = (empremta_dades is null)),
  -- L'acceptació és sempre anterior a la signatura
  check (signat_at is null or (acceptat_at is not null and acceptat_at < signat_at))
);
create index on portal.contracte_signants (request_id);

-- Firma d'ÀMBIT per als contractes: la mateixa imatge que la firma OCIC de la
-- mateixa persona, amb el nom i el càrrec amb què signa en nom de la societat.
-- La imatge és al bucket privat portal-firmes (només hi accedeix el servei).
create table portal.firmes_ambit (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete restrict,
  nom         text not null check (btrim(nom) <> ''),
  carrec      text not null check (btrim(carrec) <> ''),
  imatge_path text not null check (imatge_path ~ '^ocic/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg)$'),
  sha256      text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Signatura d'ÀMBIT (una per contracte), feta amb la sessió del signant d'ÀMBIT
create table portal.contracte_contrafirmes (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null unique references portal.requests (id) on delete restrict,
  user_id        uuid not null references auth.users (id) on delete restrict,
  nom            text not null,
  carrec         text not null,
  imatge_path    text not null,
  imatge_sha256  text not null check (imatge_sha256 ~ '^[0-9a-f]{64}$'),
  empremta_dades text not null check (empremta_dades ~ '^[0-9a-f]{64}$'),
  signat_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create trigger set_updated_at before update on portal.contracte_signants for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.firmes_ambit       for each row execute function portal.set_updated_at();

-- Un sol PDF original i un sol PDF final per contracte
create unique index documents_un_original on portal.documents (request_id) where kind = 'original';

-- -----------------------------------------------------------------------------
-- 3. Enllaços: un per signant
--    L'índex "com a màxim un token vigent per sol·licitud" es manté igual per
--    a tots els tipus existents (signant_id nul) i, per al contracte, passa a
--    ser un per signant. Un trigger impedeix crear un token de contracte sense
--    signant o un token amb signant per a qualsevol altre tipus.
-- -----------------------------------------------------------------------------
alter table portal.access_tokens
  add column signant_id uuid references portal.contracte_signants (id) on delete restrict;

drop index portal.access_tokens_un_vigent;
create unique index access_tokens_un_vigent
  on portal.access_tokens (request_id)
  where revocat_at is null and usat_at is null and signant_id is null;
create unique index access_tokens_un_vigent_signant
  on portal.access_tokens (signant_id)
  where revocat_at is null and usat_at is null and signant_id is not null;
create index on portal.access_tokens (signant_id);

-- SECURITY INVOKER a propòsit (només llegeix requests i contracte_signants)
create function portal.access_token_signant_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_tipus portal.document_type;
begin
  if tg_op = 'UPDATE' then
    if new.signant_id is distinct from old.signant_id or new.request_id is distinct from old.request_id then
      raise exception 'El signant i la sol·licitud d''un enllaç no es poden canviar' using errcode = '42501';
    end if;
    return new;
  end if;
  select document_type into v_tipus from portal.requests where id = new.request_id;
  if v_tipus = 'contracte' then
    if new.signant_id is null or not exists (select 1 from portal.contracte_signants s
                                             where s.id = new.signant_id and s.request_id = new.request_id) then
      raise exception 'L''enllaç d''un contracte és sempre d''un signant del mateix contracte' using errcode = '23514';
    end if;
  elsif new.signant_id is not null then
    raise exception 'Només els contractes tenen enllaços per signant' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger access_token_signant_regles
  before insert or update on portal.access_tokens
  for each row execute function portal.access_token_signant_regles();

-- -----------------------------------------------------------------------------
-- 4. Auxiliars
-- -----------------------------------------------------------------------------
create function portal.es_contracte(t portal.document_type)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select t = 'contracte';
$$;

-- Única persona que signa els contractes en nom d'ÀMBIT
create function portal.correu_signant_ambit()
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select 'mpaleari@ambit.ad'::text;
$$;

-- L'usuari connectat (o p_user, per al servei) és el signant d'ÀMBIT: OCIC
-- actiu, amb el correu indicat i amb la firma d'ÀMBIT registrada.
create function portal.es_signant_ambit(p_user uuid default null)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from portal.staff_profiles s
    join auth.users u on u.id = s.user_id
    join portal.firmes_ambit f on f.user_id = s.user_id
    where s.user_id = coalesce(p_user, auth.uid()) and s.actiu and s.role = 'ocic'
      and lower(u.email) = portal.correu_signant_ambit());
$$;

-- Signants del contracte: quants n'hi ha i quants han signat
create function portal.contracte_recompte(p_request_id uuid)
  returns table (total int, signats int)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select count(*)::int, count(signat_at)::int from portal.contracte_signants where request_id = p_request_id;
$$;

-- -----------------------------------------------------------------------------
-- 5. valida_estat: la de l'IRPF, més el tipus contracte:
--    · esborrany → enviat (personal): amb el PDF original i un signant o més;
--    · enviat → parcialment_signat, enviat | parcialment_signat → pendent_ambit
--      (servei): segons quants signants han signat;
--    · pendent_ambit → signat: només el signant d'ÀMBIT, amb la seva sessió i
--      la signatura d'ÀMBIT registrada;
--    · anul·lar: només l'OCIC, amb motiu, i només abans de signat;
--    · cap altra transició (ni en_curs, ni actiu, ni retirat).
--    Els tipus existents no poden fer servir els estats nous.
-- -----------------------------------------------------------------------------
create or replace function portal.valida_estat()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  qui    text;  -- 'personal', 'servei', 'ocic' o 'ambit': qui pot fer la transició
  falten text[] := '{}';
  v_aut  portal.autoritzacions_carrec;
  v_tipus portal.party_type;
  v_kyc  boolean := new.document_type in ('kyc_pf', 'kyc_pj', 'pdp');
  v_irpf boolean := new.document_type = 'irpf_comunicacio';
  v_contracte boolean := new.document_type = 'contracte';
  v_com  portal.irpf_comunicacions;
  v_total int;
  v_signats int;
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
  if not ((old.status = 'signat' or v_kyc or v_contracte) and new.status = 'anullat' and old.status <> 'anullat') then
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

  -- El tipus d'una sol·licitud no pot passar a contracte ni deixar de ser-ho
  if (old.document_type = 'contracte') <> (new.document_type = 'contracte') then
    raise exception 'El tipus d''una sol·licitud no pot canviar de contracte a un altre tipus ni al revés'
      using errcode = '42501';
  end if;

  if new.status = old.status then
    return new;
  end if;

  qui := case
    -- Contracte: transicions pròpies; qualsevol altra es rebutja
    when v_contracte and old.status = 'esborrany' and new.status = 'enviat' then 'personal'
    when v_contracte and old.status = 'enviat' and new.status in ('parcialment_signat', 'pendent_ambit') then 'servei'
    when v_contracte and old.status = 'parcialment_signat' and new.status = 'pendent_ambit' then 'servei'
    when v_contracte and old.status = 'pendent_ambit' and new.status = 'signat' then 'ambit'
    when v_contracte and old.status in ('esborrany', 'enviat', 'parcialment_signat', 'pendent_ambit')
                     and new.status = 'anullat' then 'ocic'
    when v_contracte then null
    -- Els estats propis del contracte no són de cap altre tipus
    when old.status in ('parcialment_signat', 'pendent_ambit')
      or new.status in ('parcialment_signat', 'pendent_ambit') then null
    -- IRPF: la recepció pel pagador la registra el servei; no es retira
    when v_irpf and old.status = 'signat' and new.status = 'actiu'   then 'servei'
    when v_irpf and old.status = 'actiu'  and new.status = 'retirat' then null
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

  -- Només l'OCIC (sessió authenticated): anul·lar una sol·licitud signada,
  -- qualsevol KYC/PDP o qualsevol contracte, i validar un KYC
  if qui = 'ocic' then
    if not (current_user = 'authenticated' and portal.is_ocic()) then
      if new.status = 'actiu' then
        raise exception 'Només l''OCIC pot validar un KYC' using errcode = '42501';
      elsif v_contracte then
        raise exception 'Només l''OCIC pot anul·lar un contracte' using errcode = '42501';
      elsif v_kyc then
        raise exception 'Només l''OCIC pot anul·lar un KYC o una informació de protecció de dades' using errcode = '42501';
      elsif v_irpf then
        raise exception 'Només l''OCIC pot anul·lar una comunicació signada' using errcode = '42501';
      elsif old.status = 'signat' then
        raise exception 'Només l''OCIC pot anul·lar una autorització signada' using errcode = '42501';
      end if;
    end if;
    if new.status = 'anullat' and btrim(coalesce(new.motiu_anullacio, '')) = '' then
      raise exception 'Cal indicar el motiu de l''anul·lació' using errcode = '23514';
    end if;
  end if;

  -- Signatura d'ÀMBIT del contracte: només el signant d'ÀMBIT amb la seva sessió
  if qui = 'ambit' and not (current_user = 'authenticated' and portal.es_signant_ambit()) then
    raise exception 'Només % pot signar els contractes en nom d''ÀMBIT, amb la seva sessió', portal.correu_signant_ambit()
      using errcode = '42501';
  end if;

  if qui = 'servei' and current_user <> 'service_role' then
    raise exception 'La transició % → % només la pot fer el servei del portal (service_role)', old.status, new.status
      using errcode = '42501';
  end if;

  -- Una sol·licitud signada té sempre la seva firma registrada. Al contracte,
  -- són les dels signants del client i la d'ÀMBIT (vegeu més avall).
  if new.status = 'signat' and not v_contracte
     and not exists (select 1 from portal.signatures s where s.request_id = new.id) then
    raise exception 'No es pot passar a signat: no hi ha cap firma registrada'
      using errcode = '23514';
  end if;

  -- Contracte: original i signants abans d'enviar; signatures segons l'estat
  if v_contracte then
    select total, signats into v_total, v_signats from portal.contracte_recompte(new.id);
    if new.status = 'enviat' then
      if not exists (select 1 from portal.contracte_originals o where o.request_id = new.id) then
        falten := array_append(falten, 'PDF original');
      end if;
      if v_total < 1 then
        falten := array_append(falten, 'signants');
      end if;
      if cardinality(falten) > 0 then
        raise exception 'No es pot enviar el contracte: falta %', array_to_string(falten, ', ')
          using errcode = '23514';
      end if;
    elsif new.status = 'parcialment_signat' and not (v_signats >= 1 and v_signats < v_total) then
      raise exception 'Parcialment signat vol dir que han signat alguns signants, però no tots' using errcode = '23514';
    elsif new.status = 'pendent_ambit' and not (v_total >= 1 and v_signats = v_total) then
      raise exception 'Encara no han signat tots els signants del client' using errcode = '23514';
    elsif new.status = 'signat' then
      if not (v_total >= 1 and v_signats = v_total) then
        raise exception 'Encara no han signat tots els signants del client' using errcode = '23514';
      end if;
      if not exists (select 1 from portal.contracte_contrafirmes x where x.request_id = new.id) then
        raise exception 'No es pot passar a signat: falta la signatura d''ÀMBIT' using errcode = '23514';
      end if;
    end if;
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

  -- IRPF: formulari, declaracions i data d'efectes; amb doble signatura, també la recepció
  if new.status = 'signat' and v_irpf then
    select * into v_com from portal.irpf_comunicacions k where k.request_id = new.id;
    if v_com.id is null then
      falten := array_append(falten, 'formulari');
    else
      if not portal.irpf_declaracions_completes(new.id) then
        falten := array_append(falten, 'declaracions');
      end if;
      if v_com.data_efectes is null then
        falten := array_append(falten, 'data d''efectes');
      end if;
      if v_com.doble_signatura
         and not exists (select 1 from portal.irpf_recepcions x where x.request_id = new.id) then
        falten := array_append(falten, 'recepció pel pagador');
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

    if not v_irpf and not exists (select 1 from portal.clients c
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

    if v_irpf and not exists (select 1 from portal.irpf_recepcions x where x.request_id = new.id) then
      falten := array_append(falten, 'recepció pel pagador');
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
-- 6. Regles de les taules noves
--    SECURITY INVOKER a propòsit: current_user ha de ser el rol real.
-- -----------------------------------------------------------------------------

-- Contracte: es crea amb la sol·licitud en esborrany (personal). No canvia mai.
create function portal.contracte_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if not exists (select 1 from portal.requests r
                 where r.id = new.request_id and r.document_type = 'contracte' and r.status = 'esborrany') then
    raise exception 'El contracte s''ha de crear amb una sol·licitud de contracte en esborrany' using errcode = '23514';
  end if;
  new.titol := btrim(new.titol);
  new.created_at := now();
  return new;
end;
$$;

create trigger contracte_regles
  before insert on portal.contractes
  for each row execute function portal.contracte_regles();

-- PDF original: només el servei, en nom del personal (portal.actor), amb la
-- sol·licitud en esborrany; ha de coincidir amb el document registrat.
create function portal.contracte_original_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_doc portal.documents;
begin
  if current_user <> 'service_role' or nullif(current_setting('portal.actor', true), '') is null then
    raise exception 'El PDF original només el registra el servei del portal en nom del personal, després de comprovar-lo'
      using errcode = '42501';
  end if;
  if not exists (select 1 from portal.requests r
                 where r.id = new.request_id and r.document_type = 'contracte' and r.status = 'esborrany'
                   and r.bloquejat_at is null) then
    raise exception 'El PDF original només es pot afegir a un contracte en esborrany' using errcode = '23514';
  end if;
  select * into v_doc from portal.documents where id = new.document_id;
  if v_doc.id is null or v_doc.request_id <> new.request_id or v_doc.kind <> 'original'
     or v_doc.sha256 <> new.sha256 or v_doc.mida_bytes <> new.mida_bytes or v_doc.mime <> 'application/pdf' then
    raise exception 'El PDF original no coincideix amb el document registrat' using errcode = '23514';
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger contracte_original_regles
  before insert on portal.contracte_originals
  for each row execute function portal.contracte_original_regles();

-- Signants: es creen amb el contracte en esborrany (personal). Després, només
-- el servei hi registra, una sola vegada, l'acceptació prèvia i la signatura.
-- La identitat del signant (nom, correu i qualitat) no canvia mai.
create function portal.contracte_signant_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req portal.requests;
begin
  select * into v_req from portal.requests where id = new.request_id;

  if tg_op = 'INSERT' then
    if v_req.id is null or v_req.document_type <> 'contracte' or v_req.status <> 'esborrany' then
      raise exception 'Els signants s''afegeixen amb el contracte en esborrany' using errcode = '23514';
    end if;
    new.nom := btrim(new.nom);
    new.email := lower(btrim(new.email));
    new.qualitat := btrim(new.qualitat);
    new.acceptat_at := null; new.acceptacio_ip := null; new.acceptacio_user_agent := null;
    new.lloc := null; new.signat_at := null; new.imatge_path := null; new.imatge_sha256 := null;
    new.ip := null; new.user_agent := null; new.empremta_dades := null;
    return new;
  end if;

  if (new.id, new.request_id, new.ordre, new.nom, new.email, new.qualitat, new.created_at)
     is distinct from (old.id, old.request_id, old.ordre, old.nom, old.email, old.qualitat, old.created_at) then
    raise exception 'Les dades del signant no es poden modificar' using errcode = '42501';
  end if;
  if current_user <> 'service_role' then
    raise exception 'L''acceptació i la signatura les registra el signant al portal' using errcode = '42501';
  end if;
  if v_req.bloquejat_at is not null or v_req.status not in ('enviat', 'parcialment_signat') then
    raise exception 'El contracte està en estat "%" i ja no admet signatures', v_req.status using errcode = '42501';
  end if;
  -- L'acceptació es registra una sola vegada i ja no canvia
  if old.acceptat_at is not null
     and (new.acceptat_at, new.acceptacio_ip, new.acceptacio_user_agent)
         is distinct from (old.acceptat_at, old.acceptacio_ip, old.acceptacio_user_agent) then
    raise exception 'L''acceptació prèvia ja està registrada i no es pot modificar' using errcode = '42501';
  end if;
  -- La signatura es registra una sola vegada i ja no canvia
  if old.signat_at is not null and to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    raise exception 'Aquest signant ja ha signat; la signatura no es pot modificar' using errcode = '42501';
  end if;
  if new.signat_at is not null and old.acceptat_at is null then
    raise exception 'Abans de signar cal l''acceptació prèvia de la signatura electrònica' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger contracte_signant_regles
  before insert or update on portal.contracte_signants
  for each row execute function portal.contracte_signant_regles();

-- Firma d'ÀMBIT: només el signant d'ÀMBIT, amb la seva sessió, quan han
-- signat tots els signants del client. La imatge, el nom i el càrrec surten
-- de portal.firmes_ambit i l'empremta la calcula aquest trigger (s'ignora el
-- que arribi a la petició).
create function portal.contracte_contrafirma_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req   portal.requests;
  v_total int;
  v_signats int;
  v_firma record;
begin
  if not (current_user = 'authenticated' and portal.es_signant_ambit()) then
    raise exception 'Només % pot signar els contractes en nom d''ÀMBIT, amb la seva sessió', portal.correu_signant_ambit()
      using errcode = '42501';
  end if;
  select * into v_req from portal.requests where id = new.request_id for update;
  if v_req.id is null or v_req.document_type <> 'contracte' or v_req.bloquejat_at is not null then
    raise exception 'Contracte inexistent' using errcode = 'P0002';
  end if;
  select total, signats into v_total, v_signats from portal.contracte_recompte(new.request_id);
  if v_req.status <> 'pendent_ambit' or v_total < 1 or v_signats <> v_total then
    raise exception 'El contracte no està pendent de la signatura d''ÀMBIT (estat: %)', v_req.status using errcode = '23514';
  end if;
  select * into v_firma from portal.firma_ambit_meva();
  new.user_id        := auth.uid();
  new.nom            := v_firma.nom;
  new.carrec         := v_firma.carrec;
  new.imatge_path    := v_firma.imatge_path;
  new.imatge_sha256  := v_firma.sha256;
  new.signat_at      := clock_timestamp();
  new.created_at     := now();
  new.empremta_dades := portal.empremta_contrafirma(new.request_id, v_firma.nom, v_firma.carrec, v_firma.sha256, new.signat_at);
  return new;
end;
$$;

create trigger contracte_contrafirma_regles
  before insert on portal.contracte_contrafirmes
  for each row execute function portal.contracte_contrafirma_regles();

-- Documents d'un contracte: només l'original (servei, en esborrany), les
-- imatges de les firmes (servei, en signar) i un sol PDF final (servei, un
-- cop signat per ÀMBIT). Cap altre tipus de document; cap document de tipus
-- 'original' per als altres tipus de sol·licitud.
create function portal.document_contracte_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req portal.requests;
begin
  select * into v_req from portal.requests where id = new.request_id;
  if v_req.document_type is distinct from 'contracte' then
    if new.kind = 'original' then
      raise exception 'Tipus de document no vàlid' using errcode = '23514';
    end if;
    return new;
  end if;

  if current_user <> 'service_role' then
    raise exception 'Els documents del contracte només els registra el servei del portal' using errcode = '42501';
  end if;
  if v_req.bloquejat_at is not null then
    raise exception 'La sol·licitud està bloquejada per conservació' using errcode = '42501';
  end if;

  if new.kind = 'original' then
    if nullif(current_setting('portal.actor', true), '') is null then
      raise exception 'El PDF original només el registra el servei del portal en nom del personal, després de comprovar-lo'
        using errcode = '42501';
    end if;
    if v_req.status <> 'esborrany' or new.mime <> 'application/pdf'
       or new.storage_path !~ ('^requests/' || new.request_id || '/original/[0-9a-f-]{36}\.pdf$') then
      raise exception 'PDF original no vàlid per a aquest contracte' using errcode = '23514';
    end if;
  elsif new.kind = 'evidencies' then
    if v_req.status not in ('enviat', 'parcialment_signat') or new.mime <> 'image/png'
       or new.storage_path !~ ('^requests/' || new.request_id || '/evidencies/[0-9a-f-]{36}-signatura\.png$') then
      raise exception 'Imatge de la firma no vàlida per a aquest contracte' using errcode = '23514';
    end if;
  elsif new.kind = 'signat' then
    if v_req.status <> 'signat'
       or not exists (select 1 from portal.contracte_contrafirmes x where x.request_id = new.request_id)
       or exists (select 1 from portal.documents d where d.request_id = new.request_id and d.kind = 'signat')
       or new.mime <> 'application/pdf'
       or new.storage_path !~ ('^requests/' || new.request_id || '/signat/[0-9a-f-]{36}\.pdf$') then
      raise exception 'El PDF final només es registra un cop, quan ÀMBIT ha signat el contracte' using errcode = '23514';
    end if;
  else
    raise exception 'Tipus de document no vàlid per a un contracte' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger document_contracte_regles
  before insert on portal.documents
  for each row execute function portal.document_contracte_regles();

-- Firma d'ÀMBIT: només la registra una migració (postgres) i no canvia la
-- persona a qui pertany
create function portal.firma_ambit_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'La firma d''ÀMBIT només es registra per migració' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'La firma d''ÀMBIT no pot canviar de persona' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger firma_ambit_regles
  before insert or update on portal.firmes_ambit
  for each row execute function portal.firma_ambit_regles();

-- -----------------------------------------------------------------------------
-- 7. Empremtes SHA-256. Es calculen sempre aquí perquè el PDF i la
--    comprovació final facin servir exactament la mateixa forma.
-- -----------------------------------------------------------------------------

-- Signatura d'un signant del client: contracte (títol, idioma, original),
-- signant (identitat, lloc i acceptació prèvia)
create function portal.empremta_contracte(p_signant_id uuid, p_lloc text)
  returns text
  language sql
  stable
  set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'request_id',       r.id,
    'document_type',    r.document_type,
    'template_version', r.template_version,
    'client', jsonb_build_object('id', c.id, 'party_type', c.party_type, 'nom_mostrat', c.nom_mostrat),
    'titol',            k.titol,
    'idioma',           k.idioma,
    'original', jsonb_build_object('sha256', o.sha256, 'pagines', o.pagines, 'nom_fitxer', o.nom_fitxer, 'mida', o.mida_bytes),
    'signant', jsonb_build_object('id', s.id, 'ordre', s.ordre, 'nom', s.nom, 'email', s.email, 'qualitat', s.qualitat,
                                  'acceptat_at', s.acceptat_at, 'lloc', p_lloc)
  )::text, 'UTF8')), 'hex')
  from portal.contracte_signants s
  join portal.requests r on r.id = s.request_id
  join portal.clients c on c.id = r.client_id
  join portal.contractes k on k.request_id = r.id
  join portal.contracte_originals o on o.request_id = r.id
  where s.id = p_signant_id and r.document_type = 'contracte';
$$;

-- Signatura d'ÀMBIT: l'original i les empremtes de totes les signatures del client
create function portal.empremta_contrafirma(p_request_id uuid, p_nom text, p_carrec text, p_firma_sha256 text, p_signat_at timestamptz)
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
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

-- Firma d'ÀMBIT de l'usuari connectat (només per al signant d'ÀMBIT)
create function portal.firma_ambit_meva()
  returns table (nom text, carrec text, imatge_path text, sha256 text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select f.nom, f.carrec, f.imatge_path, f.sha256
  from portal.firmes_ambit f
  where f.user_id = auth.uid() and portal.es_signant_ambit();
$$;

-- -----------------------------------------------------------------------------
-- 8. Auditoria, prohibició d'esborrat i immutabilitat
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['contractes', 'contracte_originals', 'contracte_signants', 'contracte_contrafirmes', 'firmes_ambit'] loop
    execute format('create trigger audita after insert or update or delete on portal.%I for each row execute function portal.audita()', t);
    execute format('create trigger impedeix_delete before delete on portal.%I for each row execute function portal.impedeix_canvi()', t);
    execute format('create trigger impedeix_truncate before truncate on portal.%I for each statement execute function portal.impedeix_canvi()', t);
    execute format('alter table portal.%I enable row level security', t);
  end loop;
end;
$$;

-- El contracte, l'original i la signatura d'ÀMBIT no admeten UPDATE (com les signatures)
create trigger impedeix_update before update on portal.contractes             for each row execute function portal.impedeix_canvi();
create trigger impedeix_update before update on portal.contracte_originals    for each row execute function portal.impedeix_canvi();
create trigger impedeix_update before update on portal.contracte_contrafirmes for each row execute function portal.impedeix_canvi();

-- -----------------------------------------------------------------------------
-- 9. RLS (les dades bloquejades per conservació desapareixen del panell)
-- -----------------------------------------------------------------------------
create policy personal_select on portal.contractes for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_insert on portal.contractes for insert to authenticated
  with check (portal.is_staff() and not portal.request_bloquejada(request_id));

create policy personal_select on portal.contracte_originals for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));

create policy personal_select on portal.contracte_signants for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_insert on portal.contracte_signants for insert to authenticated
  with check (portal.is_staff() and not portal.request_bloquejada(request_id));

create policy personal_select on portal.contracte_contrafirmes for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy ambit_insert on portal.contracte_contrafirmes for insert to authenticated
  with check (portal.es_signant_ambit() and not portal.request_bloquejada(request_id));
-- firmes_ambit: cap política per a authenticated (només service_role)

do $$
declare
  t text;
begin
  foreach t in array array['contractes', 'contracte_originals', 'contracte_signants', 'contracte_contrafirmes'] loop
    execute format('create policy purga on portal.%I for all to portal_purga using (true) with check (true)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Funcions del personal
-- -----------------------------------------------------------------------------

-- Crea un contracte en esborrany des d'un client: sol·licitud, títol, idioma i
-- signants. El PDF original s'hi afegeix després (portal-contracte-personal),
-- un cop comprovat. SECURITY INVOKER: permisos i RLS de qui crida.
-- p_signants: [{"nom": "...", "email": "...", "qualitat": "..."}, ...]
create function portal.contracte_crea(p_client_id uuid, p_titol text, p_idioma text, p_signants jsonb)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_req uuid;
  v_s   jsonb;
  n     int := 0;
begin
  if not portal.is_staff() then
    raise exception 'Només el personal d''ÀMBIT' using errcode = '42501';
  end if;
  if not exists (select 1 from portal.clients where id = p_client_id) then
    raise exception 'Client inexistent' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_signants) <> 'array' or jsonb_array_length(p_signants) not between 1 and 20 then
    raise exception 'Cal indicar entre 1 i 20 signants' using errcode = '22023';
  end if;
  if p_idioma not in ('ca', 'ca_en') then
    raise exception 'Idioma no vàlid' using errcode = '22023';
  end if;

  insert into portal.requests (client_id, document_type, template_version, idioma)
  values (p_client_id, 'contracte', 'CONTRACTE v1', 'ca')
  returning id into v_req;
  insert into portal.contractes (request_id, titol, idioma) values (v_req, p_titol, p_idioma);
  for v_s in select * from jsonb_array_elements(p_signants) loop
    n := n + 1;
    insert into portal.contracte_signants (request_id, ordre, nom, email, qualitat)
    values (v_req, n, v_s ->> 'nom', v_s ->> 'email', v_s ->> 'qualitat');
  end loop;
  return v_req;
end;
$$;

-- Registra el PDF original que el servei ja ha comprovat (PDF vàlid, sense
-- xifrar, màxim 20 MB) i n'ha calculat l'empremta (Edge Function
-- portal-contracte-personal, service_role en nom del personal)
create function portal.contracte_registra_original(
  p_actor uuid, p_request_id uuid, p_path text, p_sha256 text, p_mida bigint, p_nom_fitxer text, p_pagines int
)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_doc uuid;
begin
  perform portal.actua_com(p_actor, 'personal');
  perform 1 from portal.requests where id = p_request_id and document_type = 'contracte' for update;
  if not found then
    raise exception 'Contracte inexistent' using errcode = 'P0002';
  end if;
  if exists (select 1 from portal.contracte_originals where request_id = p_request_id) then
    raise exception 'Aquest contracte ja té el PDF original; per canviar-lo, cal anul·lar-lo i crear-ne un altre' using errcode = '23505';
  end if;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, 'original', p_path, p_sha256, p_mida, 'application/pdf')
  returning id into v_doc;
  insert into portal.contracte_originals (request_id, document_id, nom_fitxer, pagines, sha256, mida_bytes)
  values (p_request_id, v_doc, coalesce(nullif(left(btrim(p_nom_fitxer), 200), ''), 'contracte.pdf'), p_pagines, p_sha256, p_mida);
  return v_doc;
end;
$$;

-- Enllaç d'un signant (Edge Function portal-contracte-personal, service_role).
-- El pas esborrany → enviat el fa abans la mateixa Edge Function amb la sessió
-- del personal, com exigeix valida_estat. Regenerar revoca l'anterior del
-- mateix signant.
create function portal.contracte_crea_token(p_actor uuid, p_signant_id uuid, p_token_hash text, p_expira_at timestamptz)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_sig portal.contracte_signants;
  v_req portal.requests;
  v_id  uuid;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_sig from portal.contracte_signants where id = p_signant_id;
  if v_sig.id is null then
    raise exception 'Signant inexistent' using errcode = 'P0002';
  end if;
  select * into v_req from portal.requests where id = v_sig.request_id for update;
  if v_req.status not in ('enviat', 'parcialment_signat') or v_req.bloquejat_at is not null then
    raise exception 'No es pot generar l''enllaç: el contracte està en "%"', v_req.status using errcode = '23514';
  end if;
  if v_sig.signat_at is not null then
    raise exception 'Aquest signant ja ha signat' using errcode = '23514';
  end if;
  if p_expira_at <= now() or p_expira_at > now() + interval '7 days 1 minute' then
    raise exception 'Caducitat no vàlida' using errcode = '22023';
  end if;

  update portal.access_tokens set revocat_at = now()
   where signant_id = p_signant_id and revocat_at is null and usat_at is null;
  insert into portal.access_tokens (request_id, signant_id, token_hash, expira_at)
  values (v_req.id, p_signant_id, p_token_hash, p_expira_at)
  returning id into v_id;
  return v_id;
end;
$$;

-- Enllaços vigents dels signants d'un contracte (sense el hash)
create function portal.estat_enllacos_contracte(p_request_id uuid)
  returns table (signant_id uuid, creat_at timestamptz, expira_at timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select t.signant_id, t.created_at, t.expira_at
  from portal.access_tokens t
  join portal.requests r on r.id = t.request_id
  where portal.is_staff()
    and t.request_id = p_request_id and t.signant_id is not null
    and r.bloquejat_at is null
    and t.revocat_at is null and t.usat_at is null
    and t.expira_at > now();
$$;

-- Anul·la un contracte (només OCIC, amb motiu; ho comprova valida_estat).
-- Els enllaços pendents deixen de funcionar: només valen amb el contracte
-- enviat o parcialment signat.
create function portal.anulla_contracte(p_request_id uuid, p_motiu text)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  update portal.requests set status = 'anullat', motiu_anullacio = btrim(coalesce(p_motiu, ''))
   where id = p_request_id and document_type = 'contracte';
  if not found then
    raise exception 'Contracte inexistent' using errcode = 'P0002';
  end if;
end;
$$;

-- Signatura d'ÀMBIT (sessió authenticated del signant d'ÀMBIT): registra la
-- signatura i passa pendent_ambit → signat en una sola transacció. Tot ho
-- comproven els triggers. El PDF final el genera després el servei.
create function portal.contrafirma_contracte(p_request_id uuid)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_x portal.contracte_contrafirmes;
begin
  insert into portal.contracte_contrafirmes (request_id, user_id, nom, carrec, imatge_path, imatge_sha256, empremta_dades)
  values (p_request_id, auth.uid(), '-', '-', '-', repeat('0', 64), repeat('0', 64))
  returning * into v_x;
  update portal.requests set status = 'signat', signat_at = v_x.signat_at where id = p_request_id;
  return jsonb_build_object('signat_at', v_x.signat_at, 'empremta', v_x.empremta_dades);
end;
$$;

-- Dades per generar el PDF final (Edge Function, service_role): només per al
-- signant d'ÀMBIT que ha signat el contracte i si encara no hi ha PDF final
create function portal.contracte_dades_pdf_final(p_actor uuid, p_request_id uuid)
  returns jsonb
  language plpgsql
  stable
  set search_path = ''
as $$
declare
  v_x portal.contracte_contrafirmes;
begin
  perform portal.actua_com(p_actor, 'ocic');
  select * into v_x from portal.contracte_contrafirmes where request_id = p_request_id;
  if v_x.id is null or v_x.user_id <> p_actor or not portal.es_signant_ambit(p_actor) then
    raise exception 'Només el signant d''ÀMBIT que ha signat el contracte en pot generar el PDF final' using errcode = '42501';
  end if;
  if exists (select 1 from portal.documents where request_id = p_request_id and kind = 'signat') then
    raise exception 'El PDF final ja existeix' using errcode = '23505';
  end if;
  return jsonb_build_object(
    'request',     (select to_jsonb(r) from portal.requests r where r.id = p_request_id),
    'client',      (select to_jsonb(c) from portal.clients c join portal.requests r on r.client_id = c.id where r.id = p_request_id),
    'contracte',   (select to_jsonb(k) from portal.contractes k where k.request_id = p_request_id),
    'original',    (select to_jsonb(o) || jsonb_build_object('storage_path', d.storage_path)
                      from portal.contracte_originals o join portal.documents d on d.id = o.document_id
                     where o.request_id = p_request_id),
    'signants',    (select coalesce(jsonb_agg(to_jsonb(s) order by s.ordre), '[]'::jsonb)
                      from portal.contracte_signants s where s.request_id = p_request_id),
    'contrafirma', to_jsonb(v_x)
  );
end;
$$;

create function portal.contracte_registra_pdf_final(p_actor uuid, p_request_id uuid, p_path text, p_sha256 text, p_mida bigint)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform portal.actua_com(p_actor, 'ocic');
  if not exists (select 1 from portal.contracte_contrafirmes where request_id = p_request_id and user_id = p_actor)
     or not portal.es_signant_ambit(p_actor) then
    raise exception 'Només el signant d''ÀMBIT que ha signat el contracte' using errcode = '42501';
  end if;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, 'signat', p_path, p_sha256, p_mida, 'application/pdf')
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Funcions del signant (Edge Function pública portal-contracte, service_role)
-- -----------------------------------------------------------------------------

-- Valida el token i retorna el contracte per al signant. Retorna null si el
-- token no és vàlid (la funció respon sempre igual). No canvia cap estat.
create function portal.obre_contracte_per_token(p_token_hash text)
  returns jsonb
  language plpgsql
  stable
  set search_path = ''
as $$
declare
  v_tok portal.access_tokens;
  v_req portal.requests;
  v_sig portal.contracte_signants;
  v_k   portal.contractes;
  v_o   portal.contracte_originals;
begin
  select * into v_tok from portal.access_tokens where token_hash = p_token_hash;
  if not found or v_tok.signant_id is null or v_tok.revocat_at is not null or v_tok.usat_at is not null
     or v_tok.expira_at <= now() then
    return null;
  end if;
  select * into v_req from portal.requests where id = v_tok.request_id;
  select * into v_sig from portal.contracte_signants where id = v_tok.signant_id;
  if v_req.document_type <> 'contracte' or v_req.status not in ('enviat', 'parcialment_signat')
     or v_req.bloquejat_at is not null or v_sig.signat_at is not null then
    return null;
  end if;
  select * into v_k from portal.contractes where request_id = v_req.id;
  select * into v_o from portal.contracte_originals where request_id = v_req.id;

  return jsonb_build_object(
    'token_id',         v_tok.id,
    'request_id',       v_req.id,
    'template_version', v_req.template_version,
    'expira_at',        v_tok.expira_at,
    'titol',            v_k.titol,
    'idioma',           v_k.idioma,
    'original', jsonb_build_object('storage_path', (select d.storage_path from portal.documents d where d.id = v_o.document_id),
                                   'sha256', v_o.sha256, 'pagines', v_o.pagines, 'nom_fitxer', v_o.nom_fitxer),
    'signant', jsonb_build_object('id', v_sig.id, 'nom', v_sig.nom, 'qualitat', v_sig.qualitat, 'acceptat_at', v_sig.acceptat_at)
  );
end;
$$;

-- Comprova un token de contracte per a les accions d'escriptura del signant
create function portal.contracte_token_vigent(p_token_id uuid)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok portal.access_tokens;
  v_req portal.requests;
begin
  select * into v_tok from portal.access_tokens where id = p_token_id for update;
  if not found or v_tok.signant_id is null or v_tok.revocat_at is not null or v_tok.usat_at is not null
     or v_tok.expira_at <= now() then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;
  select * into v_req from portal.requests where id = v_tok.request_id for update;
  if v_req.document_type <> 'contracte' or v_req.status not in ('enviat', 'parcialment_signat')
     or v_req.bloquejat_at is not null
     or exists (select 1 from portal.contracte_signants s where s.id = v_tok.signant_id and s.signat_at is not null) then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;
  return v_tok.signant_id;
end;
$$;

-- Acceptació prèvia de la clàusula addicional de signatura electrònica, amb
-- la seva data i hora. Exigeix la confirmació de lectura del contracte
-- complet. Si ja s'havia acceptat, es conserva la primera acceptació.
create function portal.contracte_accepta(p_token_id uuid, p_llegit boolean, p_accepta boolean, p_ip inet, p_user_agent text)
  returns timestamptz
  language plpgsql
  set search_path = ''
as $$
declare
  v_signant uuid := portal.contracte_token_vigent(p_token_id);
  v_at timestamptz;
begin
  if p_llegit is not true or p_accepta is not true then
    raise exception 'Cal confirmar la lectura del contracte i acceptar la signatura electrònica' using errcode = '22023';
  end if;
  select acceptat_at into v_at from portal.contracte_signants where id = v_signant;
  if v_at is not null then
    return v_at;
  end if;
  update portal.contracte_signants
     set acceptat_at = clock_timestamp(), acceptacio_ip = p_ip, acceptacio_user_agent = left(p_user_agent, 500)
   where id = v_signant
  returning acceptat_at into v_at;
  return v_at;
end;
$$;

-- Registra la signatura d'un signant en una sola transacció: comprova el
-- token, l'acceptació prèvia i l'empremta, desa la signatura i la imatge,
-- passa el contracte a parcialment_signat o pendent_ambit i consumeix el token.
-- p: empremta, lloc, imatge_path, imatge_sha256, imatge_mida.
-- SECURITY INVOKER a propòsit: valida_estat exigeix current_user = service_role.
create function portal.contracte_registra_signatura(p_token_id uuid, p_signat_at timestamptz, p_ip inet, p_user_agent text, p jsonb)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_signant uuid := portal.contracte_token_vigent(p_token_id);
  v_sig portal.contracte_signants;
  v_total int;
  v_signats int;
  v_nou portal.request_status;
begin
  select * into v_sig from portal.contracte_signants where id = v_signant for update;
  if p_signat_at is null or p_signat_at < now() - interval '10 minutes' or p_signat_at > now() + interval '1 minute' then
    raise exception 'Data de signatura no vàlida' using errcode = '22023';
  end if;
  if v_sig.acceptat_at is null or v_sig.acceptat_at >= p_signat_at then
    raise exception 'Abans de signar cal l''acceptació prèvia de la signatura electrònica' using errcode = '23514';
  end if;
  if p ->> 'empremta' is distinct from portal.empremta_contracte(v_signant, p ->> 'lloc') then
    raise exception 'Les dades han canviat des que s''ha generat el document; no es pot signar' using errcode = '40001';
  end if;

  update portal.contracte_signants
     set lloc = p ->> 'lloc', signat_at = p_signat_at, imatge_path = p ->> 'imatge_path',
         imatge_sha256 = p ->> 'imatge_sha256', ip = p_ip, user_agent = left(p_user_agent, 500),
         empremta_dades = p ->> 'empremta'
   where id = v_signant;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_sig.request_id, 'evidencies', p ->> 'imatge_path', p ->> 'imatge_sha256', (p ->> 'imatge_mida')::bigint, 'image/png');

  select total, signats into v_total, v_signats from portal.contracte_recompte(v_sig.request_id);
  v_nou := case when v_signats = v_total then 'pendent_ambit' else 'parcialment_signat' end;
  update portal.requests set status = v_nou
   where id = v_sig.request_id and status is distinct from v_nou;

  update portal.access_tokens set usat_at = now() where id = p_token_id;
  return jsonb_build_object('estat', v_nou, 'signats', v_signats, 'total', v_total);
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Enllaç de l'autorització (obre_per_token, portal-signar): un token de
--     contracte no hi serveix mai (la de la conservació, amb aquesta condició més).
-- -----------------------------------------------------------------------------
create or replace function portal.obre_per_token(p_token_hash text)
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
  if v_req.status not in ('enviat', 'en_curs') or v_req.bloquejat_at is not null
     or v_req.document_type = 'contracte' then
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

-- -----------------------------------------------------------------------------
-- 13. Conservació (integrada al mòdul existent)
--     · Contracte amb alguna signatura (d'un signant o d'ÀMBIT): fi de la
--       relació amb el client + termini_contracte (6 anys); si s'ha anul·lat i
--       no hi ha fi de la relació, des de l'anul·lació. Després, el bloqueig
--       general (3 anys) i la destrucció.
--     · Contracte sense cap signatura: com les altres sol·licituds no signades.
-- -----------------------------------------------------------------------------
create or replace function portal.venciments(p_ara timestamptz default now())
  returns table (request_id uuid, client_id uuid, status portal.request_status, causa text, vencut_el timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with cfg as (select termini_no_signades as t, termini_kyc as tk, termini_pdp as tp, termini_irpf as ti,
                      termini_contracte as tc from portal.config_conservacio),
  base as (
    select r.id, r.client_id, r.status,
      case
        when r.document_type in ('kyc_pf', 'kyc_pj', 'pdp') and s.id is not null
          then case when r.document_type = 'pdp' then 'fi de la relació (protecció de dades)' else 'fi de la relació (KYC)' end
        when r.document_type = 'irpf_comunicacio'
             and (s.id is not null or exists (select 1 from portal.irpf_calculs x where x.request_id = r.id))
          then 'fi de les rendes (IRPF)'
        when r.document_type = 'contracte'
             and exists (select 1 from portal.contracte_signants x where x.request_id = r.id and x.signat_at is not null)
          then 'fi de la relació (contracte)'
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
        -- IRPF signat o amb càlcul: fi de les rendes (o anul·lació) + sis anys
        when r.document_type = 'irpf_comunicacio'
             and (s.id is not null or exists (select 1 from portal.irpf_calculs x where x.request_id = r.id)) then
          case when pe.data_fi_rendes is not null
                 then (pe.data_fi_rendes::timestamp at time zone 'Europe/Andorra')
               when r.status = 'anullat'
                 then coalesce(r.anullat_at, r.updated_at)
          end + (select ti from cfg)
        -- Contracte amb alguna signatura: fi de la relació (o anul·lació) + sis anys
        when r.document_type = 'contracte'
             and exists (select 1 from portal.contracte_signants x where x.request_id = r.id and x.signat_at is not null) then
          case when c.data_fi_relacio is not null
                 then (c.data_fi_relacio::timestamp at time zone 'Europe/Andorra')
               when r.status = 'anullat'
                 then coalesce(r.anullat_at, r.updated_at)
          end + (select tc from cfg)
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
    left join portal.irpf_comunicacions k on k.request_id = r.id
    left join portal.irpf_perceptors pe on pe.id = k.perceptor_id
    where r.bloquejat_at is null
      and (r.status in ('retirat', 'anullat', 'esborrany', 'enviat', 'en_curs')
           or (r.document_type in ('kyc_pf', 'kyc_pj', 'pdp', 'irpf_comunicacio') and r.status in ('signat', 'actiu'))
           or (r.document_type = 'contracte' and r.status in ('parcialment_signat', 'pendent_ambit', 'signat')))
      -- enviat / en_curs: només si no hi ha cap enllaç vigent a p_ara.
      -- La PDP no té token propi: segueix el del KYC enllaçat.
      and not (r.status in ('enviat', 'en_curs') and exists (
            select 1 from portal.access_tokens t
            where t.request_id = coalesce((select k2.request_id from portal.kyc_formularis k2 where k2.pdp_request_id = r.id), r.id)
              and t.revocat_at is null and t.usat_at is null and t.expira_at > p_ara))
  )
  select id, client_id, status, causa, vencut_el from base where vencut_el is not null;
$$;

-- destrueix_solicitud (propietari portal_purga): també les taules del contracte
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
  if not exists (select 1 from portal.requests where client_id = v_req.client_id)
     and not exists (select 1 from portal.irpf_perceptors where client_id = v_req.client_id) then
    v_ids := v_ids || v_req.client_id;
    v_ids := v_ids || coalesce((select array_agg(id) from portal.irpf_pagadors where client_id = v_req.client_id), '{}');
    delete from portal.irpf_pagadors where client_id = v_req.client_id;
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
                     'contractes', 'contracte_originals', 'contracte_signants', 'contracte_contrafirmes')
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

-- Auditoria de les sol·licituds bloquejades: també les taules del contracte
create or replace function portal.auditoria_bloquejada(p_entitat text, p_entitat_id uuid, p_accio text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p_accio in ('INSERT', 'UPDATE', 'DELETE') and case p_entitat
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

-- Accés per requeriment: també les dades del contracte
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
    'irpf_comunicacio', (select to_jsonb(k) from portal.irpf_comunicacions k where k.request_id = p_request_id),
    'irpf_perceptor', (select to_jsonb(pe) from portal.irpf_perceptors pe join portal.irpf_comunicacions k on k.perceptor_id = pe.id
                       where k.request_id = p_request_id),
    'irpf_recepcio', (select to_jsonb(x) from portal.irpf_recepcions x where x.request_id = p_request_id),
    'irpf_calculs', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from portal.irpf_calculs c where c.request_id = p_request_id), '[]'::jsonb),
    'contracte', (select to_jsonb(k) from portal.contractes k where k.request_id = p_request_id),
    'contracte_original', (select to_jsonb(o) from portal.contracte_originals o where o.request_id = p_request_id),
    'contracte_signants', coalesce((select jsonb_agg(to_jsonb(s) order by s.ordre) from portal.contracte_signants s where s.request_id = p_request_id), '[]'::jsonb),
    'contracte_contrafirma', (select to_jsonb(x) from portal.contracte_contrafirmes x where x.request_id = p_request_id),
    'signatura', (select to_jsonb(s) from portal.signatures s where s.request_id = p_request_id),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from portal.documents d where d.request_id = p_request_id), '[]'::jsonb),
    'retencions', coalesce((select jsonb_agg(to_jsonb(x) order by x.activada_at) from portal.retencions x where x.request_id = p_request_id), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. Firma d'ÀMBIT de mpaleari@ambit.ad: la mateixa imatge que la seva firma
--     OCIC, amb el nom i el càrrec amb què signa els contractes. Només
--     postgres (les migracions); es pot tornar a executar en publicar si la
--     firma OCIC es registra després d'aquesta migració.
-- -----------------------------------------------------------------------------
create function portal.registra_firma_ambit_des_ocic()
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_ocic portal.firmes_ocic;
begin
  select f.* into v_ocic
  from portal.firmes_ocic f
  join auth.users u on u.id = f.user_id
  join portal.staff_profiles s on s.user_id = f.user_id and s.actiu and s.role = 'ocic'
  where lower(u.email) = portal.correu_signant_ambit();
  if v_ocic.id is null then
    raise warning 'Portal: % no té cap firma OCIC registrada; la firma d''ÀMBIT per als contractes queda pendent.', portal.correu_signant_ambit();
    return false;
  end if;
  insert into portal.firmes_ambit (user_id, nom, carrec, imatge_path, sha256)
  values (v_ocic.user_id, 'Martín Paleari', 'Administrador solidari', v_ocic.imatge_path, v_ocic.sha256)
  on conflict (user_id) do update
    set nom = excluded.nom, carrec = excluded.carrec, imatge_path = excluded.imatge_path, sha256 = excluded.sha256;
  raise notice 'Portal: firma d''ÀMBIT registrada per a % (Martín Paleari · Administrador solidari).', portal.correu_signant_ambit();
  return true;
end;
$$;

select portal.registra_firma_ambit_des_ocic();

-- -----------------------------------------------------------------------------
-- 15. Permisos
-- -----------------------------------------------------------------------------
revoke all on table portal.contractes, portal.contracte_originals, portal.contracte_signants,
                    portal.contracte_contrafirmes, portal.firmes_ambit
  from public, anon, authenticated, service_role;

-- Personal (authenticated + RLS)
grant select on portal.contractes, portal.contracte_originals, portal.contracte_signants, portal.contracte_contrafirmes to authenticated;
grant insert on portal.contractes, portal.contracte_signants to authenticated;
grant insert on portal.contracte_contrafirmes to authenticated;

-- Servei del portal (Edge Functions)
grant select on portal.contractes, portal.contracte_contrafirmes, portal.firmes_ambit to service_role;
grant select, insert on portal.contracte_originals to service_role;
grant select, update (acceptat_at, acceptacio_ip, acceptacio_user_agent, lloc, signat_at, imatge_path, imatge_sha256,
                      ip, user_agent, empremta_dades, updated_at) on portal.contracte_signants to service_role;

-- Destrucció
grant select, delete on portal.contractes, portal.contracte_originals, portal.contracte_signants,
                        portal.contracte_contrafirmes to portal_purga;

revoke all on function
  portal.access_token_signant_regles(), portal.es_contracte(portal.document_type), portal.correu_signant_ambit(),
  portal.es_signant_ambit(uuid), portal.contracte_recompte(uuid),
  portal.contracte_regles(), portal.contracte_original_regles(), portal.contracte_signant_regles(),
  portal.contracte_contrafirma_regles(), portal.document_contracte_regles(), portal.firma_ambit_regles(),
  portal.empremta_contracte(uuid, text), portal.empremta_contrafirma(uuid, text, text, text, timestamptz),
  portal.firma_ambit_meva(),
  portal.contracte_crea(uuid, text, text, jsonb),
  portal.contracte_registra_original(uuid, uuid, text, text, bigint, text, int),
  portal.contracte_crea_token(uuid, uuid, text, timestamptz), portal.estat_enllacos_contracte(uuid),
  portal.anulla_contracte(uuid, text), portal.contrafirma_contracte(uuid),
  portal.contracte_dades_pdf_final(uuid, uuid), portal.contracte_registra_pdf_final(uuid, uuid, text, text, bigint),
  portal.obre_contracte_per_token(text), portal.contracte_token_vigent(uuid),
  portal.contracte_accepta(uuid, boolean, boolean, inet, text),
  portal.contracte_registra_signatura(uuid, timestamptz, inet, text, jsonb),
  portal.registra_firma_ambit_des_ocic()
from public, anon, authenticated, service_role;

-- Funcions que fan servir els triggers i les polítiques (s'executen amb el rol de qui fa la petició)
grant execute on function
  portal.es_contracte(portal.document_type), portal.correu_signant_ambit(), portal.es_signant_ambit(uuid),
  portal.contracte_recompte(uuid), portal.empremta_contrafirma(uuid, text, text, text, timestamptz),
  portal.firma_ambit_meva()
to authenticated, service_role;

-- Panell del personal (cada funció comprova el rol; la base aplica les regles)
grant execute on function
  portal.contracte_crea(uuid, text, text, jsonb), portal.estat_enllacos_contracte(uuid),
  portal.anulla_contracte(uuid, text), portal.contrafirma_contracte(uuid)
to authenticated;

-- Edge Functions (portal-contracte i portal-contracte-personal)
grant execute on function
  portal.contracte_registra_original(uuid, uuid, text, text, bigint, text, int),
  portal.contracte_crea_token(uuid, uuid, text, timestamptz),
  portal.contracte_dades_pdf_final(uuid, uuid), portal.contracte_registra_pdf_final(uuid, uuid, text, text, bigint),
  portal.obre_contracte_per_token(text), portal.contracte_token_vigent(uuid),
  portal.contracte_accepta(uuid, boolean, boolean, inet, text),
  portal.empremta_contracte(uuid, text),
  portal.contracte_registra_signatura(uuid, timestamptz, inet, text, jsonb)
to service_role;
