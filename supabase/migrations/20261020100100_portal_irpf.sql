-- =============================================================================
-- Portal de signatura · Comunicació de dades personals i familiars al pagador
-- (IRPF, art. 28.5 del Reglament) (2 de 2)
--
-- Tipus nou irpf_comunicacio (plantilla IRPF-COM v1,
-- docs/plantilla-comunicacio-dades-irpf.md). Es crea des d'un client PAGADOR
-- (persona jurídica o física) indicant el perceptor (nom, NRT i correu); un
-- pagador pot tenir diversos perceptors.
--
-- Cicle: esborrany → enviat → en_curs (el perceptor omple el formulari amb
-- desada automàtica) → signat (apartat 11, signatura del perceptor) → actiu
-- (apartat 12, "Recepció pel pagador", signada pel seu representant amb un
-- enllaç propi). Si el perceptor és el representant del pagador (p. ex.
-- l'administrador únic), signa els dos blocs en la mateixa sessió i la
-- comunicació passa directament a actiu. Sense contrasignatura de l'OCIC.
--
-- Versions: cada comunicació substitueix l'anterior sense esborrar-la i en
-- guarda la data d'efectes; portal.irpf_vigent() diu quines dades i quin
-- percentatge s'aplicaven en qualsevol data.
--
-- Càlcul (art. 24.1 del Reglament): paràmetres per exercici en una taula que
-- edita el personal; el percentatge i el detall de cada pas es desen amb la
-- comunicació i van a un full intern del PDF d'ÀMBIT (doc_kind 'intern'), mai
-- a la còpia del perceptor.
--
-- Conservació: mentre el perceptor rep rendes del pagador i sis anys després
-- (data de fi que fixa el personal); després, el bloqueig general de tres
-- anys i la destrucció del mòdul existent.
--
-- Cap regla existent es debilita: les funcions que es substitueixen
-- conserven tot el que feien i només hi afegeixen el tipus nou. No toca cap
-- taula de public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configuració
-- -----------------------------------------------------------------------------
alter table portal.config_conservacio
  -- IRPF: fi de les rendes + sis anys; després, el bloqueig general (termini_bloqueig)
  add column termini_irpf interval not null default interval '6 years' check (termini_irpf >= interval '0');

-- -----------------------------------------------------------------------------
-- 2. Taules
-- -----------------------------------------------------------------------------

-- Dades del pagador (apartat 2 i capçalera i peu del PDF). Una fila per client.
create table portal.irpf_pagadors (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null unique references portal.clients (id) on delete restrict,
  denominacio text not null check (btrim(denominacio) <> '' and length(denominacio) <= 200),
  nrt         text not null check (btrim(nrt) <> '' and length(nrt) <= 30),
  domicili    text not null check (btrim(domicili) <> '' and length(domicili) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Perceptors de rendes del treball de cada pagador
create table portal.irpf_perceptors (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references portal.clients (id) on delete restrict,  -- el pagador
  nom             text not null check (btrim(nom) <> '' and length(nom) <= 200),
  nrt             text not null check (btrim(nrt) <> '' and length(nrt) <= 30),
  email           text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 200),
  -- És el representant del pagador (p. ex. l'administrador únic): signa també
  -- la recepció pel pagador, en la mateixa sessió
  es_representant boolean not null default false,
  -- Inici de la relació laboral o, si no és laboral, data del primer pagament
  -- (la indica el personal): termini de la comunicació inicial (arts. 31.a i 31.b)
  inici_relacio   date,
  relacio_laboral boolean not null default true,
  -- Fi de les rendes del pagador (la fixa el personal): des d'aquí compten els sis anys
  data_fi_rendes  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, nrt)
);
create index on portal.irpf_perceptors (client_id);

-- Comunicació (una per sol·licitud)
create table portal.irpf_comunicacions (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null unique references portal.requests (id) on delete restrict,
  perceptor_id    uuid not null references portal.irpf_perceptors (id) on delete restrict,
  -- Comunicació vigent de la qual parteix (revisió anual). Sense clau forana a
  -- propòsit: cada sol·licitud es destrueix per separat.
  revisio_de      uuid,
  -- El perceptor és el representant del pagador i signa també l'apartat 12
  doble_signatura boolean not null,
  -- Dades del pagador en el moment de crear-la (apartat 2, capçalera i peu)
  pagador         jsonb not null check (jsonb_typeof(pagador) = 'object'),
  dades           jsonb not null default '{}'::jsonb check (jsonb_typeof(dades) = 'object'),
  desat_at        timestamptz,
  data_efectes    date generated always as (portal.data_segura(dades ->> 'data_efectes')) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on portal.irpf_comunicacions (perceptor_id);

-- Apartat 12: recepció pel pagador, signada pel seu representant
create table portal.irpf_recepcions (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null unique references portal.requests (id) on delete restrict,
  representant_nom    text not null check (btrim(representant_nom) <> '' and length(representant_nom) <= 200),
  representant_carrec text not null check (btrim(representant_carrec) <> '' and length(representant_carrec) <= 200),
  signat_at           timestamptz not null,
  imatge_path         text not null,
  imatge_sha256       text not null check (imatge_sha256 ~ '^[0-9a-f]{64}$'),
  ip                  inet,
  user_agent          text,
  empremta_dades      text not null check (empremta_dades ~ '^[0-9a-f]{64}$'),
  -- Signada pel mateix perceptor en la sessió de la signatura
  mateixa_sessio      boolean not null,
  created_at          timestamptz not null default now()
);

-- Paràmetres del càlcul per exercici (editables pel personal; mai fixos al codi)
create table portal.irpf_parametres (
  id                      uuid primary key default gen_random_uuid(),
  exercici                int not null unique check (exercici between 2000 and 2100),
  minim_personal          numeric(12,2) not null check (minim_personal >= 0),
  minim_incapacitat       numeric(12,2) not null check (minim_incapacitat >= 0),
  limit_conjuge           numeric(12,2) not null check (limit_conjuge >= 0),
  reduccio_familiar       numeric(12,2) not null check (reduccio_familiar >= 0),
  coeficient_discapacitat numeric(5,2)  not null check (coeficient_discapacitat >= 1),
  max_matricules          numeric(12,2) not null check (max_matricules >= 0),
  salari_minim            numeric(12,2) not null check (salari_minim >= 0),
  habitatge_percentatge   numeric(5,2)  not null check (habitatge_percentatge between 0 and 100),
  habitatge_maxim         numeric(12,2) not null check (habitatge_maxim >= 0),
  plans_percentatge       numeric(5,2)  not null check (plans_percentatge between 0 and 100),
  plans_maxim             numeric(12,2) not null check (plans_maxim >= 0),
  tipus                   numeric(5,2)  not null check (tipus > 0 and tipus <= 100),
  bonificacio_percentatge numeric(5,2)  not null check (bonificacio_percentatge between 0 and 100),
  bonificacio_maxim       numeric(12,2) not null check (bonificacio_maxim >= 0),
  despeses_percentatge    numeric(5,2)  not null check (despeses_percentatge between 0 and 100),
  despeses_maxim          numeric(12,2) not null check (despeses_maxim >= 0),
  edat_descendents        int           not null check (edat_descendents between 1 and 120),
  edat_ascendents         int           not null check (edat_ascendents between 1 and 120),
  regularitzacio_llindar  numeric(5,2)  not null check (regularitzacio_llindar between 0 and 100),
  regularitzacio_maxim    numeric(5,2)  not null check (regularitzacio_maxim > 0 and regularitzacio_maxim <= 100),
  actualitzat_per         uuid references auth.users (id) on delete restrict,  -- el fixa un trigger
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Exercici 2025: valors de la plantilla (salari mínim interprofessional del 2025)
insert into portal.irpf_parametres (
  exercici, minim_personal, minim_incapacitat, limit_conjuge, reduccio_familiar, coeficient_discapacitat,
  max_matricules, salari_minim, habitatge_percentatge, habitatge_maxim, plans_percentatge, plans_maxim,
  tipus, bonificacio_percentatge, bonificacio_maxim, despeses_percentatge, despeses_maxim,
  edat_descendents, edat_ascendents, regularitzacio_llindar, regularitzacio_maxim)
values (2025, 24000, 30000, 40000, 1000, 1.5, 300, 17367.96, 50, 5000, 30, 5000, 10, 50, 800, 3, 2500, 25, 65, 1, 10);

-- Càlculs del percentatge (un o més per comunicació: cada canvi de retribució
-- o d'exercici en fa un de nou; no es modifiquen mai)
create table portal.irpf_calculs (
  id                      uuid primary key default gen_random_uuid(),
  request_id              uuid not null references portal.requests (id) on delete restrict,
  perceptor_id            uuid not null references portal.irpf_perceptors (id) on delete restrict,
  exercici                int not null check (exercici between 2000 and 2100),
  data_efectes            date not null,
  -- comunicacio: amb les dades signades; sense_comunicacio: art. 24.4 del Reglament
  mode                    text not null check (mode in ('comunicacio', 'sense_comunicacio')),
  retribucions            numeric(14,2) not null check (retribucions > 0),
  cotitzacions            numeric(14,2) not null check (cotitzacions >= 0),
  retribucions_satisfetes numeric(14,2) check (retribucions_satisfetes >= 0),
  retencions_practicades  numeric(14,2) check (retencions_practicades >= 0),
  calcul_anterior         uuid,   -- càlcul anterior del mateix exercici (regularització, art. 25)
  -- Data en què el pagador coneix la variació (amb càlcul anterior): el
  -- percentatge nou s'aplica des del mes següent (art. 27.1.b del Reglament)
  data_coneixement        date,
  percentatge             numeric(5,2) not null check (percentatge between 0 and 100),
  percentatge_aplicat     numeric(5,2) not null check (percentatge_aplicat between 0 and 100),
  regularitzat            boolean not null,
  parametres              jsonb not null check (jsonb_typeof(parametres) = 'object'),
  detall                  jsonb not null check (jsonb_typeof(detall) = 'object'),
  empremta_comunicacio    text check (empremta_comunicacio ~ '^[0-9a-f]{64}$'),
  creat_per               uuid not null references auth.users (id) on delete restrict,
  created_at              timestamptz not null default now(),
  check (extract(year from data_efectes)::int = exercici)
);
create index on portal.irpf_calculs (perceptor_id, exercici, data_efectes);
create index on portal.irpf_calculs (request_id);

create trigger set_updated_at before update on portal.irpf_pagadors      for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.irpf_perceptors    for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.irpf_comunicacions for each row execute function portal.set_updated_at();
create trigger set_updated_at before update on portal.irpf_parametres    for each row execute function portal.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Auxiliars
-- -----------------------------------------------------------------------------
create function portal.es_irpf(t portal.document_type)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select t = 'irpf_comunicacio';
$$;

-- Alguna discapacitat o dependència marcada als apartats 5, 6 o 7 (mateix
-- criteri que requereixConsentiment d'irpf-regles.js)
create function portal.irpf_requereix_consentiment(d jsonb)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select exists (
    select 1
    from unnest(array['descendents', 'ascendents', 'tutelats']) k,
         jsonb_array_elements(portal.llista_json(d -> k)) p
    where p ->> 'discapacitat' = 'true' or p ->> 'dependencia' = 'true');
$$;

-- Declaracions de l'apartat 10 marcades (i el consentiment de l'art. 9.2.a, si cal)
create function portal.irpf_declaracions_completes(p_request_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce((
    select k.dades #>> '{declaracions,d1}' = 'true' and k.dades #>> '{declaracions,d2}' = 'true'
       and k.dades #>> '{declaracions,d3}' = 'true' and k.dades #>> '{declaracions,d4}' = 'true'
       and (not portal.irpf_requereix_consentiment(k.dades) or k.dades #>> '{declaracions,consentiment}' = 'true')
    from portal.irpf_comunicacions k
    where k.request_id = p_request_id), false);
$$;

-- Perceptor amb comunicacions i totes bloquejades per conservació
create function portal.perceptor_bloquejat(p_perceptor_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from portal.irpf_comunicacions k where k.perceptor_id = p_perceptor_id)
     and not exists (select 1 from portal.irpf_comunicacions k
                     join portal.requests r on r.id = k.request_id
                     where k.perceptor_id = p_perceptor_id and r.bloquejat_at is null);
$$;

-- Paràmetres d'un exercici tal com es desen amb cada càlcul
create function portal.irpf_parametres_json(p_exercici int)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select to_jsonb(p) - 'id' - 'actualitzat_per' - 'created_at' - 'updated_at'
  from portal.irpf_parametres p where p.exercici = p_exercici;
$$;

-- -----------------------------------------------------------------------------
-- 4. valida_estat: la de les correccions del KYC, més el tipus irpf_comunicacio:
--    · en_curs → signat (servei): formulari, declaracions, data d'efectes i, si
--      el perceptor és el representant del pagador, la recepció ja signada;
--    · signat → actiu (servei): només amb la recepció pel pagador signada; no
--      cal la referència del client (la comunicació és del pagador);
--    · no es retira (les comunicacions se substitueixen, no es retiren).
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
  v_irpf boolean := new.document_type = 'irpf_comunicacio';
  v_com  portal.irpf_comunicacions;
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

  -- Només l'OCIC (sessió authenticated): anul·lar una sol·licitud signada o
  -- qualsevol KYC/PDP, i validar un KYC
  if qui = 'ocic' then
    if not (current_user = 'authenticated' and portal.is_ocic()) then
      if new.status = 'actiu' then
        raise exception 'Només l''OCIC pot validar un KYC' using errcode = '42501';
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
-- 5. Regles de les taules noves
--    SECURITY INVOKER a propòsit: current_user ha de ser el rol real.
-- -----------------------------------------------------------------------------

-- Comunicació: es crea amb la sol·licitud en esborrany (personal); les
-- respostes les desa només el servei mentre és enviada o en curs i, un cop
-- signada, ja no canvia mai. La resta de camps no canvien.
create function portal.irpf_comunicacio_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req portal.requests;
  canviats text[];
begin
  select * into v_req from portal.requests where id = new.request_id;

  if tg_op = 'INSERT' then
    if v_req.id is null or v_req.document_type <> 'irpf_comunicacio' or v_req.status <> 'esborrany' then
      raise exception 'La comunicació s''ha de crear amb una sol·licitud IRPF en esborrany' using errcode = '23514';
    end if;
    if not exists (select 1 from portal.irpf_perceptors p where p.id = new.perceptor_id and p.client_id = v_req.client_id) then
      raise exception 'El perceptor no és d''aquest pagador' using errcode = '23514';
    end if;
    new.desat_at := null;
    return new;
  end if;

  select array_agg(e.key order by e.key) into canviats
  from jsonb_each(to_jsonb(new)) e
  where e.key not in ('dades', 'desat_at', 'updated_at', 'data_efectes')
    and e.value is distinct from to_jsonb(old) -> e.key;
  if canviats is not null then
    raise exception 'De la comunicació només es poden modificar les respostes (s''ha intentat canviar %)', array_to_string(canviats, ', ')
      using errcode = '42501';
  end if;

  if (new.dades, new.desat_at) is distinct from (old.dades, old.desat_at) then
    if exists (select 1 from portal.signatures s where s.request_id = old.request_id)
       or v_req.status not in ('enviat', 'en_curs') then
      raise exception 'La comunicació està en estat "%" i ja no es pot modificar', v_req.status
        using errcode = '42501';
    end if;
    if current_user <> 'service_role' then
      raise exception 'Les respostes de la comunicació les omple el perceptor; només el servei del portal les pot desar'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger irpf_comunicacio_regles
  before insert or update on portal.irpf_comunicacions
  for each row execute function portal.irpf_comunicacio_regles();

-- Recepció pel pagador: només el servei, després de la signatura del perceptor
-- (en la mateixa sessió, si és el representant; si no, amb el seu enllaç)
create function portal.irpf_recepcio_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req portal.requests;
  v_doble boolean;
begin
  if current_user <> 'service_role' then
    raise exception 'La recepció la signa el representant del pagador al portal' using errcode = '42501';
  end if;
  select * into v_req from portal.requests where id = new.request_id;
  select doble_signatura into v_doble from portal.irpf_comunicacions where request_id = new.request_id;
  if v_req.document_type is distinct from 'irpf_comunicacio' or v_req.bloquejat_at is not null then
    raise exception 'Sol·licitud IRPF inexistent' using errcode = 'P0002';
  end if;
  if not exists (select 1 from portal.signatures s where s.request_id = new.request_id) then
    raise exception 'Abans de la recepció cal la signatura del perceptor' using errcode = '23514';
  end if;
  if new.mateixa_sessio then
    if not v_doble or v_req.status <> 'en_curs' then
      raise exception 'Només el perceptor que és el representant del pagador signa la recepció en la mateixa sessió' using errcode = '23514';
    end if;
  elsif v_req.status <> 'signat' then
    raise exception 'La comunicació no està pendent de recepció' using errcode = '23514';
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger irpf_recepcio_regles
  before insert on portal.irpf_recepcions
  for each row execute function portal.irpf_recepcio_regles();

-- Perceptor: el pagador no canvia; la fi de les rendes no pot ser futura
create function portal.irpf_perceptor_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'El perceptor no pot canviar de pagador' using errcode = '42501';
  end if;
  if new.data_fi_rendes is not null and new.data_fi_rendes > portal.avui() then
    raise exception 'La data de fi de les rendes no pot ser futura' using errcode = '23514';
  end if;
  new.nrt := upper(btrim(new.nrt));
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

create trigger irpf_perceptor_regles
  before insert or update on portal.irpf_perceptors
  for each row execute function portal.irpf_perceptor_regles();

-- Paràmetres: l'exercici no canvia; qui els actualitza el fixa el trigger
create function portal.irpf_parametres_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.exercici is distinct from old.exercici then
    raise exception 'L''exercici dels paràmetres no es pot canviar' using errcode = '42501';
  end if;
  new.actualitzat_per := auth.uid();
  return new;
end;
$$;

create trigger irpf_parametres_regles
  before insert or update on portal.irpf_parametres
  for each row execute function portal.irpf_parametres_regles();

-- Càlcul: només el servei en nom del personal (portal.actor), amb els
-- paràmetres vigents de l'exercici. Amb comunicació, només si la comunicació
-- ha estat rebuda pel pagador (actiu); l'empremta de les dades signades la
-- fixa aquest trigger.
create function portal.irpf_calcul_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_req   portal.requests;
  v_com   portal.irpf_comunicacions;
  v_actor uuid := nullif(current_setting('portal.actor', true), '')::uuid;
  v_ant   portal.irpf_calculs;
begin
  if current_user <> 'service_role' or v_actor is null then
    raise exception 'El càlcul només el registra el servei del portal en nom del personal' using errcode = '42501';
  end if;
  select * into v_req from portal.requests where id = new.request_id;
  select * into v_com from portal.irpf_comunicacions where request_id = new.request_id;
  if v_req.document_type is distinct from 'irpf_comunicacio' or v_com.id is null or v_req.bloquejat_at is not null then
    raise exception 'Sol·licitud IRPF inexistent' using errcode = 'P0002';
  end if;
  if new.perceptor_id is distinct from v_com.perceptor_id then
    raise exception 'El perceptor no correspon a la comunicació' using errcode = '23514';
  end if;
  if new.mode = 'comunicacio' then
    if v_req.status <> 'actiu' then
      raise exception 'Només es pot calcular amb una comunicació rebuda pel pagador' using errcode = '23514';
    end if;
    new.empremta_comunicacio := (select s.empremta_dades from portal.signatures s where s.request_id = new.request_id);
  else
    new.empremta_comunicacio := null;
  end if;
  if new.parametres is distinct from portal.irpf_parametres_json(new.exercici) then
    raise exception 'Els paràmetres de l''exercici % han canviat o no existeixen; torneu a calcular', new.exercici
      using errcode = '40001';
  end if;
  -- Càlcul anterior del mateix exercici: el darrer amb data d'efectes igual o anterior
  select * into v_ant from portal.irpf_calculs c
   where c.perceptor_id = new.perceptor_id and c.exercici = new.exercici and c.data_efectes <= new.data_efectes
   order by c.data_efectes desc, c.created_at desc limit 1;
  if new.calcul_anterior is distinct from v_ant.id then
    raise exception 'Hi ha un càlcul més recent d''aquest exercici; torneu a calcular' using errcode = '40001';
  end if;
  -- Variació: des del mes següent a aquell en què el pagador la coneix (art. 27.1.b),
  -- i mai abans de rebre la comunicació que la conté
  if v_ant.id is not null then
    if new.data_coneixement is null or new.data_coneixement > portal.avui() then
      raise exception 'Cal la data (no futura) en què el pagador coneix la variació' using errcode = '23514';
    end if;
    if new.mode = 'comunicacio' and v_ant.request_id is distinct from new.request_id
       and new.data_coneixement < (select (x.signat_at at time zone 'Europe/Andorra')::date
                                   from portal.irpf_recepcions x where x.request_id = new.request_id) then
      raise exception 'El pagador no pot conèixer la variació abans de rebre la comunicació' using errcode = '23514';
    end if;
    if new.data_efectes < (date_trunc('month', new.data_coneixement) + interval '1 month')::date then
      raise exception 'La variació s''aplica des del mes següent a aquell en què el pagador la coneix (art. 27.1.b del Reglament)'
        using errcode = '23514';
    end if;
  else
    new.data_coneixement := null;
  end if;
  new.creat_per  := v_actor;
  new.created_at := now();
  return new;
end;
$$;

create trigger irpf_calcul_regles
  before insert on portal.irpf_calculs
  for each row execute function portal.irpf_calcul_regles();

-- PDF finals: el validat i la còpia del KYC (sense canvis) i, per a l'IRPF, la
-- còpia amb la recepció i el PDF intern d'ÀMBIT amb el full del càlcul
create or replace function portal.document_validat_regles()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_tipus portal.document_type;
begin
  if new.kind in ('validat', 'copia_client', 'intern') then
    select document_type into v_tipus from portal.requests where id = new.request_id;
    if current_user <> 'service_role' then
      raise exception 'El PDF validat només el genera el servei del portal' using errcode = '42501';
    end if;
    if v_tipus = 'irpf_comunicacio' then
      if new.kind = 'validat' then
        raise exception 'Tipus de PDF no vàlid per a una comunicació IRPF' using errcode = '23514';
      end if;
      if new.kind = 'copia_client'
         and not exists (select 1 from portal.irpf_recepcions x where x.request_id = new.request_id) then
        raise exception 'La comunicació no està rebuda pel pagador' using errcode = '42501';
      end if;
      if new.kind = 'intern'
         and not exists (select 1 from portal.irpf_calculs c where c.request_id = new.request_id) then
        raise exception 'La comunicació no té cap càlcul' using errcode = '42501';
      end if;
    else
      if new.kind = 'intern' then
        raise exception 'Tipus de PDF no vàlid' using errcode = '23514';
      end if;
      if not exists (select 1 from portal.kyc_validacions v
                     join portal.requests r on r.id = v.request_id
                     where v.request_id = new.request_id and r.status = 'actiu') then
        raise exception 'El KYC no està validat per l''OCIC' using errcode = '42501';
      end if;
    end if;
    if new.storage_path !~ ('^requests/' || new.request_id || '/' ||
                            case new.kind when 'validat' then 'validat' when 'intern' then 'intern' else 'copia-client' end ||
                            '/[0-9a-f-]{36}\.pdf$') then
      raise exception 'Camí del PDF validat no vàlid' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Auditoria, prohibició d'esborrat i immutabilitat
-- -----------------------------------------------------------------------------

-- El detall del càlcul (amb noms de familiars) no es copia sencer al registre:
-- hi queda la seva empremta, com les respostes dels formularis. La resta, com fins ara.
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
                when key in ('dades', 'detall') and value <> 'null'::jsonb
                  then to_jsonb('sha256:' || encode(sha256(convert_to(value::text, 'UTF8')), 'hex'))
                else value end), '{}'::jsonb)
  from jsonb_each(j);
$$;

do $$
declare
  t text;
begin
  foreach t in array array['irpf_pagadors', 'irpf_perceptors', 'irpf_comunicacions', 'irpf_recepcions',
                           'irpf_parametres', 'irpf_calculs'] loop
    execute format('create trigger audita after insert or update or delete on portal.%I for each row execute function portal.audita()', t);
    execute format('create trigger impedeix_delete before delete on portal.%I for each row execute function portal.impedeix_canvi()', t);
    execute format('create trigger impedeix_truncate before truncate on portal.%I for each statement execute function portal.impedeix_canvi()', t);
    execute format('alter table portal.%I enable row level security', t);
  end loop;
end;
$$;

-- La recepció i els càlculs no admeten UPDATE (com les signatures)
create trigger impedeix_update before update on portal.irpf_recepcions for each row execute function portal.impedeix_canvi();
create trigger impedeix_update before update on portal.irpf_calculs    for each row execute function portal.impedeix_canvi();

-- -----------------------------------------------------------------------------
-- 7. RLS (les dades bloquejades per conservació desapareixen del panell)
-- -----------------------------------------------------------------------------
create policy personal_select on portal.irpf_pagadors for select to authenticated
  using (portal.is_staff() and not portal.client_bloquejat(client_id));
create policy personal_insert on portal.irpf_pagadors for insert to authenticated
  with check (portal.is_staff() and not portal.client_bloquejat(client_id));
create policy personal_update on portal.irpf_pagadors for update to authenticated
  using (portal.is_staff() and not portal.client_bloquejat(client_id))
  with check (portal.is_staff() and not portal.client_bloquejat(client_id));

create policy personal_select on portal.irpf_perceptors for select to authenticated
  using (portal.is_staff() and not portal.perceptor_bloquejat(id));
create policy personal_insert on portal.irpf_perceptors for insert to authenticated
  with check (portal.is_staff() and not portal.client_bloquejat(client_id));
create policy personal_update on portal.irpf_perceptors for update to authenticated
  using (portal.is_staff() and not portal.perceptor_bloquejat(id))
  with check (portal.is_staff() and not portal.perceptor_bloquejat(id));

create policy personal_select on portal.irpf_comunicacions for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_insert on portal.irpf_comunicacions for insert to authenticated
  with check (portal.is_staff() and not portal.request_bloquejada(request_id));

create policy personal_select on portal.irpf_recepcions for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_select on portal.irpf_calculs for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));

create policy personal_select on portal.irpf_parametres for select to authenticated using (portal.is_staff());
create policy personal_insert on portal.irpf_parametres for insert to authenticated with check (portal.is_staff());
create policy personal_update on portal.irpf_parametres for update to authenticated
  using (portal.is_staff()) with check (portal.is_staff());

do $$
declare
  t text;
begin
  foreach t in array array['irpf_pagadors', 'irpf_perceptors', 'irpf_comunicacions', 'irpf_recepcions', 'irpf_calculs'] loop
    execute format('create policy purga on portal.%I for all to portal_purga using (true) with check (true)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Funcions del perceptor i del representant del pagador
--    (Edge Function pública portal-irpf, service_role)
-- -----------------------------------------------------------------------------

-- Valida el token i retorna la comunicació. Mode 'perceptor' (enviada o en
-- curs; el primer cop passa a en_curs) o 'recepcio' (signada pel perceptor i
-- pendent de la recepció pel pagador). Retorna null si el token no és vàlid.
create function portal.obre_irpf_per_token(p_token_hash text)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok  portal.access_tokens;
  v_req  portal.requests;
  v_com  portal.irpf_comunicacions;
  v_per  portal.irpf_perceptors;
  v_sig  portal.signatures;
  v_mode text;
begin
  select * into v_tok from portal.access_tokens where token_hash = p_token_hash for update;
  if not found or v_tok.revocat_at is not null or v_tok.usat_at is not null or v_tok.expira_at <= now() then
    return null;
  end if;

  select * into v_req from portal.requests where id = v_tok.request_id for update;
  if v_req.document_type <> 'irpf_comunicacio' or v_req.bloquejat_at is not null then
    return null;
  end if;
  if v_req.status in ('enviat', 'en_curs') then
    v_mode := 'perceptor';
  elsif v_req.status = 'signat' and not exists (select 1 from portal.irpf_recepcions x where x.request_id = v_req.id) then
    v_mode := 'recepcio';
  else
    return null;
  end if;

  if v_req.status = 'enviat' then
    update portal.requests set status = 'en_curs' where id = v_req.id;
  end if;

  select * into v_com from portal.irpf_comunicacions where request_id = v_req.id;
  select * into v_per from portal.irpf_perceptors where id = v_com.perceptor_id;
  select * into v_sig from portal.signatures where request_id = v_req.id;

  return jsonb_build_object(
    'token_id',         v_tok.id,
    'request_id',       v_req.id,
    'mode',             v_mode,
    'template_version', v_req.template_version,
    'idioma',           v_req.idioma,
    'expira_at',        v_tok.expira_at,
    'client_id',        v_req.client_id,
    'referencia_client', (select c.referencia_client from portal.clients c where c.id = v_req.client_id),
    'party_type',       (select c.party_type from portal.clients c where c.id = v_req.client_id),
    'perceptor_id',     v_per.id,
    'perceptor_nom',    v_per.nom,
    'pagador',          v_com.pagador,
    'doble_signatura',  v_com.doble_signatura,
    'dades',            v_com.dades,
    'desat_at',         v_com.desat_at,
    'signatura',        case when v_sig.id is null then null else jsonb_build_object(
                          'signatari_nom', v_sig.signatari_nom, 'lloc', v_sig.lloc, 'signat_at', v_sig.signat_at,
                          'imatge_path', v_sig.imatge_path, 'ip', v_sig.ip, 'user_agent', v_sig.user_agent,
                          'empremta_dades', v_sig.empremta_dades) end
  );
end;
$$;

-- Comprova un token de comunicació IRPF per a les accions d'escriptura
create function portal.irpf_token_vigent(p_token_id uuid, p_mode text)
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
  if v_req.document_type <> 'irpf_comunicacio' or v_req.bloquejat_at is not null
     or (p_mode = 'perceptor' and v_req.status <> 'en_curs')
     or (p_mode = 'recepcio' and (v_req.status <> 'signat'
                                  or exists (select 1 from portal.irpf_recepcions x where x.request_id = v_req.id)))
     or p_mode not in ('perceptor', 'recepcio') then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;
  return v_req.id;
end;
$$;

-- Desada automàtica de les respostes del perceptor
create function portal.irpf_desa(p_token_id uuid, p_dades jsonb)
  returns timestamptz
  language plpgsql
  set search_path = ''
as $$
declare
  v_request uuid := portal.irpf_token_vigent(p_token_id, 'perceptor');
begin
  if jsonb_typeof(p_dades) <> 'object' or length(p_dades::text) > 200000 then
    raise exception 'Respostes no vàlides' using errcode = '22023';
  end if;
  update portal.irpf_comunicacions set dades = p_dades, desat_at = now() where request_id = v_request;
  return now();
end;
$$;

-- Empremtes SHA-256 de les dades que se signen. Es calculen sempre aquí perquè
-- el PDF i la comprovació final facin servir exactament la mateixa forma.
create function portal.empremta_irpf(p_request_id uuid, p_signatari_nom text, p_lloc text)
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
    'pagador',          k.pagador,
    'perceptor_id',     k.perceptor_id,
    'doble_signatura',  k.doble_signatura,
    'dades',            k.dades,
    'signant', jsonb_build_object('nom', p_signatari_nom, 'lloc', p_lloc)
  )::text, 'UTF8')), 'hex')
  from portal.requests r
  join portal.clients c on c.id = r.client_id
  join portal.irpf_comunicacions k on k.request_id = r.id
  where r.id = p_request_id and r.document_type = 'irpf_comunicacio';
$$;

-- La recepció cobreix la comunicació signada (empremta de la signatura del
-- perceptor) i les dades del representant. La variant _de rep l'empremta del
-- perceptor (doble signatura: encara no està registrada quan es genera el PDF).
create function portal.empremta_irpf_recepcio_de(p_request_id uuid, p_empremta_perceptor text, p_nom text, p_carrec text)
  returns text
  language sql
  stable
  set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'request_id',          r.id,
    'document_type',       r.document_type,
    'template_version',    r.template_version,
    'empremta_perceptor',  p_empremta_perceptor,
    'representant', jsonb_build_object('nom', p_nom, 'carrec', p_carrec)
  )::text, 'UTF8')), 'hex')
  from portal.requests r
  where r.id = p_request_id and r.document_type = 'irpf_comunicacio' and p_empremta_perceptor is not null;
$$;

create function portal.empremta_irpf_recepcio(p_request_id uuid, p_nom text, p_carrec text)
  returns text
  language sql
  stable
  set search_path = ''
as $$
  select portal.empremta_irpf_recepcio_de(p_request_id,
    (select s.empremta_dades from portal.signatures s where s.request_id = p_request_id), p_nom, p_carrec);
$$;

-- Registra la signatura del perceptor (apartat 11) en una sola transacció i,
-- si és el representant del pagador, també la recepció (apartat 12).
-- p_perceptor: empremta, signatari_nom, lloc, imatge_path, imatge_sha256,
--   imatge_mida, pdf_path, pdf_sha256, pdf_mida.
-- p_recepcio (només amb doble signatura): empremta, nom, carrec, imatge_path,
--   imatge_sha256, imatge_mida.
-- SECURITY INVOKER a propòsit: valida_estat exigeix current_user = service_role.
create function portal.registra_signatura_irpf(
  p_token_id   uuid,
  p_signat_at  timestamptz,
  p_ip         inet,
  p_user_agent text,
  p_perceptor  jsonb,
  p_recepcio   jsonb
)
  returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_tok portal.access_tokens;
  v_req portal.requests;
  v_com portal.irpf_comunicacions;
  v_pdf uuid;
begin
  select * into v_tok from portal.access_tokens where id = p_token_id for update;
  if not found or v_tok.revocat_at is not null or v_tok.usat_at is not null or v_tok.expira_at <= now() then
    raise exception 'Enllaç no vàlid o caducat' using errcode = '42501';
  end if;
  select * into v_req from portal.requests where id = v_tok.request_id for update;
  select * into v_com from portal.irpf_comunicacions where request_id = v_req.id;
  if v_req.document_type <> 'irpf_comunicacio' or v_req.status <> 'en_curs' or v_com.id is null then
    raise exception 'La sol·licitud no està pendent de signatura' using errcode = '42501';
  end if;
  if p_signat_at is null or p_signat_at < now() - interval '10 minutes' or p_signat_at > now() + interval '1 minute' then
    raise exception 'Data de signatura no vàlida' using errcode = '22023';
  end if;
  if v_com.doble_signatura <> (p_recepcio is not null) then
    raise exception 'La recepció pel pagador només la signa el perceptor si n''és el representant' using errcode = '22023';
  end if;

  if p_perceptor ->> 'empremta' is distinct from
     portal.empremta_irpf(v_req.id, p_perceptor ->> 'signatari_nom', p_perceptor ->> 'lloc') then
    raise exception 'Les dades han canviat des que s''ha generat el document; no es pot signar' using errcode = '40001';
  end if;

  insert into portal.signatures (request_id, signatari_nom, signatari_carrec, lloc, signat_at,
                                 imatge_path, ip, user_agent, empremta_dades)
  values (v_req.id, p_perceptor ->> 'signatari_nom', null, p_perceptor ->> 'lloc', p_signat_at,
          p_perceptor ->> 'imatge_path', p_ip, p_user_agent, p_perceptor ->> 'empremta');
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_req.id, 'evidencies', p_perceptor ->> 'imatge_path', p_perceptor ->> 'imatge_sha256', (p_perceptor ->> 'imatge_mida')::bigint, 'image/png');
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_req.id, 'signat', p_perceptor ->> 'pdf_path', p_perceptor ->> 'pdf_sha256', (p_perceptor ->> 'pdf_mida')::bigint, 'application/pdf')
  returning id into v_pdf;

  -- Doble signatura: la recepció en la mateixa sessió, amb una signatura a part
  if v_com.doble_signatura then
    if p_recepcio ->> 'imatge_sha256' = p_perceptor ->> 'imatge_sha256' then
      raise exception 'La recepció pel pagador s''ha de signar a part' using errcode = '22023';
    end if;
    if p_recepcio ->> 'empremta' is distinct from
       portal.empremta_irpf_recepcio(v_req.id, p_recepcio ->> 'nom', p_recepcio ->> 'carrec') then
      raise exception 'Les dades han canviat des que s''ha generat el document; no es pot signar' using errcode = '40001';
    end if;
    insert into portal.irpf_recepcions (request_id, representant_nom, representant_carrec, signat_at, imatge_path,
                                        imatge_sha256, ip, user_agent, empremta_dades, mateixa_sessio)
    values (v_req.id, p_recepcio ->> 'nom', p_recepcio ->> 'carrec', p_signat_at, p_recepcio ->> 'imatge_path',
            p_recepcio ->> 'imatge_sha256', p_ip, p_user_agent, p_recepcio ->> 'empremta', true);
    insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
    values (v_req.id, 'evidencies', p_recepcio ->> 'imatge_path', p_recepcio ->> 'imatge_sha256', (p_recepcio ->> 'imatge_mida')::bigint, 'image/png');
  end if;

  update portal.requests set status = 'signat', signat_at = p_signat_at where id = v_req.id;
  if v_com.doble_signatura then
    update portal.requests set status = 'actiu' where id = v_req.id;
  end if;

  update portal.access_tokens set usat_at = now() where id = p_token_id;
  return jsonb_build_object('pdf_id', v_pdf, 'rebuda', v_com.doble_signatura);
end;
$$;

-- Registra la recepció pel pagador (apartat 12) amb l'enllaç del representant:
-- la recepció, la imatge de la firma i la còpia final, i passa a actiu.
-- p: empremta, nom, carrec, imatge_path, imatge_sha256, imatge_mida, pdf_path, pdf_sha256, pdf_mida.
create function portal.registra_recepcio_irpf(
  p_token_id   uuid,
  p_signat_at  timestamptz,
  p_ip         inet,
  p_user_agent text,
  p            jsonb
)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_request uuid := portal.irpf_token_vigent(p_token_id, 'recepcio');
  v_pdf uuid;
begin
  if p_signat_at is null or p_signat_at < now() - interval '10 minutes' or p_signat_at > now() + interval '1 minute' then
    raise exception 'Data de signatura no vàlida' using errcode = '22023';
  end if;
  if p ->> 'empremta' is distinct from portal.empremta_irpf_recepcio(v_request, p ->> 'nom', p ->> 'carrec') then
    raise exception 'Les dades han canviat des que s''ha generat el document; no es pot signar' using errcode = '40001';
  end if;
  insert into portal.irpf_recepcions (request_id, representant_nom, representant_carrec, signat_at, imatge_path,
                                      imatge_sha256, ip, user_agent, empremta_dades, mateixa_sessio)
  values (v_request, p ->> 'nom', p ->> 'carrec', p_signat_at, p ->> 'imatge_path',
          p ->> 'imatge_sha256', p_ip, p_user_agent, p ->> 'empremta', false);
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_request, 'evidencies', p ->> 'imatge_path', p ->> 'imatge_sha256', (p ->> 'imatge_mida')::bigint, 'image/png');
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (v_request, 'copia_client', p ->> 'pdf_path', p ->> 'pdf_sha256', (p ->> 'pdf_mida')::bigint, 'application/pdf')
  returning id into v_pdf;
  update portal.requests set status = 'actiu' where id = v_request;
  update portal.access_tokens set usat_at = now() where id = p_token_id;
  return v_pdf;
end;
$$;

-- Enllaç del representant del pagador (Edge Function portal-enllac, service_role)
create function portal.irpf_crea_token_recepcio(p_actor uuid, p_request_id uuid, p_token_hash text, p_expira_at timestamptz)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_req portal.requests;
  v_id  uuid;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_req from portal.requests where id = p_request_id for update;
  if not found or v_req.document_type <> 'irpf_comunicacio' then
    raise exception 'Sol·licitud inexistent' using errcode = 'P0002';
  end if;
  if v_req.status <> 'signat' or v_req.bloquejat_at is not null
     or exists (select 1 from portal.irpf_recepcions x where x.request_id = p_request_id) then
    raise exception 'La comunicació no està pendent de recepció pel pagador' using errcode = '23514';
  end if;
  if p_expira_at <= now() or p_expira_at > now() + interval '7 days 1 minute' then
    raise exception 'Caducitat no vàlida' using errcode = '22023';
  end if;
  update portal.access_tokens set revocat_at = now()
   where request_id = p_request_id and revocat_at is null and usat_at is null;
  insert into portal.access_tokens (request_id, token_hash, expira_at)
  values (p_request_id, p_token_hash, p_expira_at)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Funcions del personal
-- -----------------------------------------------------------------------------

-- Insereix la sol·licitud i la comunicació d'un perceptor (comú a la creació i
-- a la revisió anual). SECURITY INVOKER: permisos i RLS de qui crida.
create function portal.irpf_insereix(p_perceptor_id uuid, p_dades jsonb, p_revisio_de uuid)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_per portal.irpf_perceptors;
  v_pag portal.irpf_pagadors;
  v_req uuid;
begin
  select * into v_per from portal.irpf_perceptors where id = p_perceptor_id;
  if v_per.id is null then
    raise exception 'Perceptor inexistent' using errcode = 'P0002';
  end if;
  select * into v_pag from portal.irpf_pagadors where client_id = v_per.client_id;
  if v_pag.id is null then
    raise exception 'Falten les dades del pagador (denominació, NRT i domicili)' using errcode = '23514';
  end if;
  -- Una sola comunicació pendent per perceptor
  if exists (select 1 from portal.irpf_comunicacions k join portal.requests r on r.id = k.request_id
             where k.perceptor_id = p_perceptor_id
               and (r.status in ('esborrany', 'enviat', 'en_curs')
                    or (r.status = 'signat' and not exists (select 1 from portal.irpf_recepcions x where x.request_id = r.id)))) then
    raise exception 'Aquest perceptor ja té una comunicació pendent' using errcode = '23505';
  end if;

  insert into portal.requests (client_id, document_type, template_version, idioma)
  values (v_per.client_id, 'irpf_comunicacio', 'IRPF-COM v1', 'ca')
  returning id into v_req;
  insert into portal.irpf_comunicacions (request_id, perceptor_id, revisio_de, doble_signatura, pagador, dades)
  values (v_req, p_perceptor_id, p_revisio_de, v_per.es_representant,
          jsonb_build_object('denominacio', v_pag.denominacio, 'nrt', v_pag.nrt, 'domicili', v_pag.domicili),
          p_dades);
  return v_req;
end;
$$;

-- Crea una comunicació des d'un client pagador. p_perceptor: {id} d'un
-- perceptor existent, o {nom, nrt, email, es_representant} d'un de nou.
-- p_pagador: {denominacio, nrt, domicili} (es desa o s'actualitza).
create function portal.irpf_crea(p_client_id uuid, p_perceptor jsonb, p_pagador jsonb)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_per uuid;
  v_fila portal.irpf_perceptors;
  v_tipus text;
begin
  if not portal.is_staff() then
    raise exception 'Només el personal d''ÀMBIT' using errcode = '42501';
  end if;
  if not exists (select 1 from portal.clients where id = p_client_id) then
    raise exception 'Client inexistent' using errcode = 'P0002';
  end if;

  if p_pagador is not null then
    insert into portal.irpf_pagadors (client_id, denominacio, nrt, domicili)
    values (p_client_id, btrim(p_pagador ->> 'denominacio'), upper(btrim(p_pagador ->> 'nrt')), btrim(p_pagador ->> 'domicili'))
    on conflict (client_id) do update
      set denominacio = excluded.denominacio, nrt = excluded.nrt, domicili = excluded.domicili;
  end if;

  if p_perceptor ? 'id' then
    v_per := (p_perceptor ->> 'id')::uuid;
    if not exists (select 1 from portal.irpf_perceptors where id = v_per and client_id = p_client_id) then
      raise exception 'El perceptor no és d''aquest pagador' using errcode = '23514';
    end if;
  else
    insert into portal.irpf_perceptors (client_id, nom, nrt, email, es_representant, inici_relacio, relacio_laboral)
    values (p_client_id, btrim(p_perceptor ->> 'nom'), btrim(p_perceptor ->> 'nrt'), btrim(p_perceptor ->> 'email'),
            coalesce((p_perceptor ->> 'es_representant')::boolean, false),
            nullif(p_perceptor ->> 'inici_relacio', '')::date, coalesce((p_perceptor ->> 'relacio_laboral')::boolean, true))
    returning id into v_per;
  end if;

  select * into v_fila from portal.irpf_perceptors where id = v_per;
  -- Inicial si encara no n'hi ha cap de rebuda; si no, modificació
  v_tipus := case when exists (select 1 from portal.irpf_comunicacions k join portal.requests r on r.id = k.request_id
                               where k.perceptor_id = v_per and r.status = 'actiu')
                  then 'modificacio' else 'inicial' end;
  return portal.irpf_insereix(v_per, jsonb_build_object(
    'comunicacio', jsonb_build_object('tipus', v_tipus, 'modifica', '[]'::jsonb),
    'perceptor', jsonb_build_object('nom', v_fila.nom, 'nrt', v_fila.nrt, 'email', v_fila.email)), null);
end;
$$;

-- Comunicació vigent (rebuda pel pagador) i càlcul vigent d'un perceptor en
-- una data: quines dades i quin percentatge s'aplicaven aquell dia.
create function portal.irpf_vigent(p_perceptor_id uuid, p_data date default null)
  returns jsonb
  language sql
  stable
  set search_path = ''
as $$
  with d as (select coalesce(p_data, portal.avui()) as dia)
  select jsonb_build_object(
    'data', (select dia from d),
    'comunicacio', (
      select jsonb_build_object('request_id', k.request_id, 'data_efectes', k.data_efectes, 'signat_at', r.signat_at,
                                'tipus', k.dades #>> '{comunicacio,tipus}', 'dades', k.dades)
      from portal.irpf_comunicacions k join portal.requests r on r.id = k.request_id, d
      where k.perceptor_id = p_perceptor_id and r.status = 'actiu' and k.data_efectes <= d.dia
      order by k.data_efectes desc, r.signat_at desc limit 1),
    'calcul', (
      select jsonb_build_object('id', c.id, 'request_id', c.request_id, 'exercici', c.exercici, 'data_efectes', c.data_efectes,
                                'mode', c.mode, 'percentatge', c.percentatge, 'percentatge_aplicat', c.percentatge_aplicat,
                                'regularitzat', c.regularitzat, 'created_at', c.created_at)
      from portal.irpf_calculs c, d
      where c.perceptor_id = p_perceptor_id and c.data_efectes <= d.dia
      order by c.data_efectes desc, c.created_at desc limit 1));
$$;

-- "Enviar revisió anual": comunicació nova preomplerta amb la vigent, de tipus
-- modificació, amb efectes l'1 de gener de l'any següent. Les declaracions i la
-- data d'efectes les torna a fer el perceptor.
create function portal.irpf_revisio_anual(p_perceptor_id uuid)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_vig jsonb;
  v_dades jsonb;
begin
  if not portal.is_staff() then
    raise exception 'Només el personal d''ÀMBIT' using errcode = '42501';
  end if;
  v_vig := portal.irpf_vigent(p_perceptor_id, null) -> 'comunicacio';
  if v_vig is null or v_vig = 'null'::jsonb then
    -- Si totes tenen efectes futurs, la darrera rebuda
    select jsonb_build_object('request_id', k.request_id, 'dades', k.dades) into v_vig
    from portal.irpf_comunicacions k join portal.requests r on r.id = k.request_id
    where k.perceptor_id = p_perceptor_id and r.status = 'actiu'
    order by k.data_efectes desc, r.signat_at desc limit 1;
  end if;
  if v_vig is null then
    raise exception 'Aquest perceptor no té cap comunicació rebuda per revisar' using errcode = 'P0002';
  end if;
  v_dades := (v_vig -> 'dades') - 'declaracions'
             || jsonb_build_object('comunicacio', jsonb_build_object('tipus', 'modificacio', 'modifica', '[]'::jsonb),
                                   'data_efectes', (extract(year from portal.avui())::int + 1)::text || '-01-01');
  return portal.irpf_insereix(p_perceptor_id, v_dades, (v_vig ->> 'request_id')::uuid);
end;
$$;

-- Fi de les rendes del pagador (el personal; no futura). Des d'aquí compten
-- els sis anys de conservació.
create function portal.irpf_fixa_fi_rendes(p_perceptor_id uuid, p_data date)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  if not portal.is_staff() then
    raise exception 'Només el personal d''ÀMBIT' using errcode = '42501';
  end if;
  update portal.irpf_perceptors set data_fi_rendes = p_data where id = p_perceptor_id;
  if not found then
    raise exception 'Perceptor inexistent' using errcode = 'P0002';
  end if;
end;
$$;

-- Dades per calcular (Edge Function portal-irpf-personal, service_role)
create function portal.irpf_dades_calcul(p_actor uuid, p_request_id uuid, p_exercici int, p_data_efectes date)
  returns jsonb
  language plpgsql
  stable
  set search_path = ''
as $$
declare
  v_com portal.irpf_comunicacions;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_com from portal.irpf_comunicacions where request_id = p_request_id;
  if v_com.id is null or portal.request_bloquejada(p_request_id) then
    raise exception 'Comunicació inexistent' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'request',     (select to_jsonb(r) from portal.requests r where r.id = p_request_id),
    'client',      (select to_jsonb(c) from portal.clients c join portal.requests r on r.client_id = c.id where r.id = p_request_id),
    'comunicacio', to_jsonb(v_com),
    'perceptor',   (select to_jsonb(p) from portal.irpf_perceptors p where p.id = v_com.perceptor_id),
    'parametres',  portal.irpf_parametres_json(p_exercici),
    'anterior',    (select to_jsonb(c) - 'detall' - 'parametres' from portal.irpf_calculs c
                     where c.perceptor_id = v_com.perceptor_id and c.exercici = p_exercici and c.data_efectes <= p_data_efectes
                     order by c.data_efectes desc, c.created_at desc limit 1),
    'signatura',   (select to_jsonb(s) from portal.signatures s where s.request_id = p_request_id),
    'recepcio',    (select to_jsonb(x) from portal.irpf_recepcions x where x.request_id = p_request_id),
    'documents',   (select coalesce(jsonb_agg(jsonb_build_object('kind', d.kind, 'storage_path', d.storage_path, 'sha256', d.sha256)
                                              order by d.created_at), '[]'::jsonb)
                     from portal.documents d where d.request_id = p_request_id)
  );
end;
$$;

-- Registra un càlcul i el PDF intern d'ÀMBIT en una sola transacció
-- (Edge Function portal-irpf-personal, service_role en nom del personal)
create function portal.irpf_registra_calcul(p_actor uuid, p_request_id uuid, p jsonb, p_pdf jsonb)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_com portal.irpf_comunicacions;
  v_id  uuid;
begin
  perform portal.actua_com(p_actor, 'personal');
  select * into v_com from portal.irpf_comunicacions where request_id = p_request_id;
  if v_com.id is null then
    raise exception 'Comunicació inexistent' using errcode = 'P0002';
  end if;
  if (p_pdf ->> 'path') !~ ('^requests/' || p_request_id || '/intern/[0-9a-f-]{36}\.pdf$') then
    raise exception 'Camí no vàlid' using errcode = '22023';
  end if;
  insert into portal.irpf_calculs (
    id, request_id, perceptor_id, exercici, data_efectes, mode, retribucions, cotitzacions,
    retribucions_satisfetes, retencions_practicades, calcul_anterior, data_coneixement, percentatge, percentatge_aplicat,
    regularitzat, parametres, detall, creat_per)
  values (
    coalesce((p ->> 'id')::uuid, gen_random_uuid()), p_request_id, v_com.perceptor_id, (p ->> 'exercici')::int, (p ->> 'data_efectes')::date,
    p ->> 'mode', (p ->> 'retribucions')::numeric, (p ->> 'cotitzacions')::numeric,
    (p ->> 'retribucions_satisfetes')::numeric, (p ->> 'retencions_practicades')::numeric,
    (p ->> 'calcul_anterior')::uuid, (p ->> 'data_coneixement')::date, (p ->> 'percentatge')::numeric, (p ->> 'percentatge_aplicat')::numeric,
    (p ->> 'regularitzat')::boolean, p -> 'parametres', p -> 'detall', p_actor)
  returning id into v_id;
  insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (p_request_id, 'intern', p_pdf ->> 'path', p_pdf ->> 'sha256', (p_pdf ->> 'mida')::bigint, 'application/pdf');
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Conservació (integrada al mòdul existent)
--     · Comunicació IRPF signada o amb algun càlcul: fi de les rendes del
--       perceptor + termini_irpf (6 anys); si s'ha anul·lat i no hi ha fi de
--       les rendes, des de l'anul·lació. Després, el bloqueig general (3 anys)
--       i la destrucció.
--     · No signades i sense càlcul: com fins ara.
-- -----------------------------------------------------------------------------
create or replace function portal.venciments(p_ara timestamptz default now())
  returns table (request_id uuid, client_id uuid, status portal.request_status, causa text, vencut_el timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with cfg as (select termini_no_signades as t, termini_kyc as tk, termini_pdp as tp, termini_irpf as ti from portal.config_conservacio),
  base as (
    select r.id, r.client_id, r.status,
      case
        when r.document_type in ('kyc_pf', 'kyc_pj', 'pdp') and s.id is not null
          then case when r.document_type = 'pdp' then 'fi de la relació (protecció de dades)' else 'fi de la relació (KYC)' end
        when r.document_type = 'irpf_comunicacio'
             and (s.id is not null or exists (select 1 from portal.irpf_calculs x where x.request_id = r.id))
          then 'fi de les rendes (IRPF)'
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
           or (r.document_type in ('kyc_pf', 'kyc_pj', 'pdp', 'irpf_comunicacio') and r.status in ('signat', 'actiu')))
      -- enviat / en_curs: només si no hi ha cap enllaç vigent a p_ara.
      -- La PDP no té token propi: segueix el del KYC enllaçat.
      and not (r.status in ('enviat', 'en_curs') and exists (
            select 1 from portal.access_tokens t
            where t.request_id = coalesce((select k2.request_id from portal.kyc_formularis k2 where k2.pdp_request_id = r.id), r.id)
              and t.revocat_at is null and t.usat_at is null and t.expira_at > p_ara))
  )
  select id, client_id, status, causa, vencut_el from base where vencut_el is not null;
$$;

-- destrueix_solicitud (propietari portal_purga): també les taules de l'IRPF;
-- el perceptor quan ja no li queda cap comunicació, i les dades del pagador
-- amb el client
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
    select id from portal.autoritzacions_carrec where request_id = p_request_id union all
    select id from portal.kyc_validacions       where request_id = p_request_id union all
    select id from portal.kyc_adjunts           where request_id = p_request_id union all
    select id from portal.kyc_formularis        where request_id = p_request_id union all
    select id from portal.pdp_consentiments     where request_id = p_request_id union all
    select id from portal.irpf_calculs          where request_id = p_request_id union all
    select id from portal.irpf_recepcions       where request_id = p_request_id union all
    select id from portal.irpf_comunicacions    where request_id = p_request_id union all
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
  delete from portal.irpf_calculs          where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('irpf_calculs', n);
  delete from portal.irpf_recepcions       where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('irpf_recepcions', n);
  delete from portal.irpf_comunicacions    where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('irpf_comunicacions', n);
  delete from portal.signatures            where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('signatures', n);
  delete from portal.documents             where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('documents', n);
  delete from portal.access_tokens         where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('access_tokens', n);
  delete from portal.otps                  where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('otps', n);
  delete from portal.retencions            where request_id = p_request_id; get diagnostics n = row_count; v_files := v_files || jsonb_build_object('retencions', n);
  delete from portal.requests              where id = p_request_id;         get diagnostics n = row_count; v_files := v_files || jsonb_build_object('requests', n);

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
                     'irpf_comunicacions', 'irpf_recepcions', 'irpf_calculs', 'irpf_perceptors', 'irpf_pagadors')
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

-- Auditoria de les sol·licituds bloquejades: també les taules de l'IRPF
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
    when 'irpf_comunicacions'    then exists (select 1 from portal.irpf_comunicacions x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'irpf_recepcions'       then exists (select 1 from portal.irpf_recepcions x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'irpf_calculs'          then exists (select 1 from portal.irpf_calculs x where x.id = p_entitat_id and portal.request_bloquejada(x.request_id))
    when 'irpf_perceptors'       then portal.perceptor_bloquejat(p_entitat_id)
    when 'irpf_pagadors'         then exists (select 1 from portal.irpf_pagadors x where x.id = p_entitat_id and portal.client_bloquejat(x.client_id))
    else false
  end;
$$;

-- Accés per requeriment: també les dades de l'IRPF
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
    'signatura', (select to_jsonb(s) from portal.signatures s where s.request_id = p_request_id),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from portal.documents d where d.request_id = p_request_id), '[]'::jsonb),
    'retencions', coalesce((select jsonb_agg(to_jsonb(x) order by x.activada_at) from portal.retencions x where x.request_id = p_request_id), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Permisos
-- -----------------------------------------------------------------------------
revoke all on table portal.irpf_pagadors, portal.irpf_perceptors, portal.irpf_comunicacions,
                    portal.irpf_recepcions, portal.irpf_parametres, portal.irpf_calculs
  from public, anon, authenticated, service_role;

-- Personal (authenticated + RLS)
grant select on portal.irpf_pagadors, portal.irpf_perceptors, portal.irpf_comunicacions,
                portal.irpf_recepcions, portal.irpf_parametres, portal.irpf_calculs to authenticated;
grant insert, update (denominacio, nrt, domicili, updated_at) on portal.irpf_pagadors to authenticated;
grant insert on portal.irpf_perceptors to authenticated;
grant update (nom, email, es_representant, data_fi_rendes, nrt, inici_relacio, relacio_laboral, updated_at) on portal.irpf_perceptors to authenticated;
grant insert on portal.irpf_comunicacions to authenticated;
grant insert, update on portal.irpf_parametres to authenticated;

-- Servei del portal (Edge Functions)
grant select on portal.irpf_pagadors, portal.irpf_perceptors, portal.irpf_parametres to service_role;
grant select, update (dades, desat_at, updated_at) on portal.irpf_comunicacions to service_role;
grant select, insert on portal.irpf_recepcions, portal.irpf_calculs to service_role;

-- Destrucció
grant select, delete on portal.irpf_pagadors, portal.irpf_perceptors, portal.irpf_comunicacions,
                        portal.irpf_recepcions, portal.irpf_calculs to portal_purga;

revoke all on function
  portal.es_irpf(portal.document_type), portal.irpf_requereix_consentiment(jsonb),
  portal.irpf_declaracions_completes(uuid), portal.perceptor_bloquejat(uuid), portal.irpf_parametres_json(int),
  portal.irpf_comunicacio_regles(), portal.irpf_recepcio_regles(), portal.irpf_perceptor_regles(),
  portal.irpf_parametres_regles(), portal.irpf_calcul_regles(),
  portal.obre_irpf_per_token(text), portal.irpf_token_vigent(uuid, text), portal.irpf_desa(uuid, jsonb),
  portal.empremta_irpf(uuid, text, text), portal.empremta_irpf_recepcio(uuid, text, text),
  portal.empremta_irpf_recepcio_de(uuid, text, text, text),
  portal.registra_signatura_irpf(uuid, timestamptz, inet, text, jsonb, jsonb),
  portal.registra_recepcio_irpf(uuid, timestamptz, inet, text, jsonb),
  portal.irpf_crea_token_recepcio(uuid, uuid, text, timestamptz),
  portal.irpf_insereix(uuid, jsonb, uuid), portal.irpf_crea(uuid, jsonb, jsonb), portal.irpf_vigent(uuid, date),
  portal.irpf_revisio_anual(uuid), portal.irpf_fixa_fi_rendes(uuid, date),
  portal.irpf_dades_calcul(uuid, uuid, int, date), portal.irpf_registra_calcul(uuid, uuid, jsonb, jsonb)
from public, anon, authenticated, service_role;

-- Funcions que fan servir els triggers i les polítiques (s'executen amb el rol de qui fa la petició)
grant execute on function
  portal.es_irpf(portal.document_type), portal.irpf_requereix_consentiment(jsonb),
  portal.irpf_declaracions_completes(uuid), portal.perceptor_bloquejat(uuid), portal.irpf_parametres_json(int)
to authenticated, service_role;

-- Panell del personal (cada funció comprova el rol; irpf_insereix la crida irpf_crea)
grant execute on function
  portal.irpf_crea(uuid, jsonb, jsonb), portal.irpf_insereix(uuid, jsonb, uuid), portal.irpf_vigent(uuid, date),
  portal.irpf_revisio_anual(uuid), portal.irpf_fixa_fi_rendes(uuid, date)
to authenticated;

-- Edge Functions (portal-irpf, portal-irpf-personal i portal-enllac)
grant execute on function
  portal.obre_irpf_per_token(text), portal.irpf_token_vigent(uuid, text), portal.irpf_desa(uuid, jsonb),
  portal.empremta_irpf(uuid, text, text), portal.empremta_irpf_recepcio(uuid, text, text),
  portal.empremta_irpf_recepcio_de(uuid, text, text, text),
  portal.registra_signatura_irpf(uuid, timestamptz, inet, text, jsonb, jsonb),
  portal.registra_recepcio_irpf(uuid, timestamptz, inet, text, jsonb),
  portal.irpf_crea_token_recepcio(uuid, uuid, text, timestamptz),
  portal.irpf_vigent(uuid, date),
  portal.irpf_dades_calcul(uuid, uuid, int, date), portal.irpf_registra_calcul(uuid, uuid, jsonb, jsonb)
to service_role;
