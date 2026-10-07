-- =============================================================================
-- Portal de signatura de clients ÀMBIT · Fase 1 · Pas D
-- Mòdul "Autorització de càrrec en compte" + regles d'activació.
-- =============================================================================

create table portal.autoritzacions_carrec (
  id                   uuid primary key default gen_random_uuid(),
  request_id           uuid not null unique references portal.requests (id) on delete restrict,
  titular_nom          text not null check (btrim(titular_nom) <> ''),
  titular_adreca       text not null check (btrim(titular_adreca) <> ''),
  titular_cp_poblacio  text not null check (btrim(titular_cp_poblacio) <> ''),
  entitat              text not null check (entitat in ('andbank', 'creand', 'morabanc')),
  iban_xifrat          bytea,  -- el xifratge el fa l'aplicació (fase 3)
  iban_ultims4         text check (iban_ultims4 is null or iban_ultims4 ~ '^[0-9A-Z]{4}$'),
  client_facturat_nom  text,   -- només si és diferent del titular
  poder_adjunt_id      uuid references portal.documents (id) on delete restrict,
  data_alta            date,   -- només l'omple ÀMBIT
  data_retirada        date,
  motiu_retirada       text,
  darrer_carrec        date,
  -- Conservació: la data més tardana entre retirada i darrer càrrec + 13 mesos
  -- (art. 31.1 del Reglament de la Llei 8/2018). Nul mentre l'autorització és vigent.
  conservar_fins       date generated always as (
                         case
                           when data_retirada is null then null
                           else (greatest(data_retirada, darrer_carrec) + interval '13 months')::date
                         end
                       ) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on portal.autoritzacions_carrec (poder_adjunt_id);

create trigger set_updated_at before update on portal.autoritzacions_carrec
  for each row execute function portal.set_updated_at();

-- -----------------------------------------------------------------------------
-- Camps reservats a ÀMBIT: clients.referencia_client i autoritzacions_carrec.data_alta.
-- Només els pot fixar o canviar el personal actiu amb sessió authenticated
-- (o les migracions, com a postgres).
-- SECURITY INVOKER a propòsit: current_user ha de ser el rol real de qui fa el canvi.
-- -----------------------------------------------------------------------------
create function portal.nomes_personal_ambit()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  camp text := tg_argv[0];
  valor_nou text := to_jsonb(new) ->> camp;
  valor_vell text := case when tg_op = 'UPDATE' then to_jsonb(old) ->> camp end;
begin
  if valor_nou is distinct from valor_vell
     and current_user not in ('postgres', 'supabase_admin')
     and not (current_user = 'authenticated' and portal.is_staff()) then
    raise exception 'Només el personal d''ÀMBIT pot assignar %', camp
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger referencia_nomes_personal
  before insert or update of referencia_client on portal.clients
  for each row execute function portal.nomes_personal_ambit('referencia_client');

create trigger data_alta_nomes_personal
  before insert or update of data_alta on portal.autoritzacions_carrec
  for each row execute function portal.nomes_personal_ambit('data_alta');

-- -----------------------------------------------------------------------------
-- Regles de portal.requests:
--  · Es crea sempre en 'esborrany'.
--  · Transicions permeses (qualsevol altra es rebutja, també tornar enrere;
--    'retirat' i 'anullat' són finals):
--      esborrany → enviat                    només personal
--      enviat → en_curs, en_curs → signat    només service_role
--      signat → actiu                        només personal (firma, referència, data_alta)
--      actiu → retirat                       només personal (data_retirada informada)
--      esborrany | enviat | en_curs → anullat  només personal
--  · 'signat' exigeix una firma a portal.signatures.
--  · Des de 'enviat' endavant, client_id, document_type, template_version i
--    idioma no es poden modificar.
--  · activat_at i activat_per els fixa sempre aquest trigger (now() i
--    auth.uid()); s'ignora el que arribi a la petició.
-- SECURITY INVOKER a propòsit: current_user ha de ser el rol real de qui fa el
-- canvi (authenticated o service_role). Les funcions de la fase 3 han de
-- canviar estats com a service_role; com a postgres es rebutja.
--
-- NOTA PER A LA FASE 3: la funció que registra la firma ha de generar el PDF a
-- partir de les dades desades en aquell mateix moment, dins de la mateixa
-- transacció que crea la fila de portal.signatures i passa la sol·licitud a
-- 'signat', perquè el que se signa i el que queda desat coincideixin.
-- -----------------------------------------------------------------------------
create function portal.valida_estat()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  qui    text;  -- 'personal' o 'servei': qui pot fer la transició
  falten text[] := '{}';
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

create trigger valida_estat
  before insert or update on portal.requests
  for each row execute function portal.valida_estat();

-- -----------------------------------------------------------------------------
-- Un cop signada ('signat', 'actiu' o 'retirat'), l'autorització només admet
-- canvis a data_alta, data_retirada, motiu_retirada i darrer_carrec.
-- -----------------------------------------------------------------------------
create function portal.bloqueja_autoritzacio_signada()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_status  portal.request_status;
  canviats  text[];
begin
  select r.status into v_status from portal.requests r where r.id = old.request_id;
  if v_status not in ('signat', 'actiu', 'retirat') then
    return new;
  end if;

  select array_agg(e.key order by e.key) into canviats
  from jsonb_each(to_jsonb(new)) e
  where e.key not in ('data_alta', 'data_retirada', 'motiu_retirada', 'darrer_carrec',
                      'updated_at', 'conservar_fins')
    and e.value is distinct from to_jsonb(old) -> e.key;

  if canviats is not null then
    raise exception 'L''autorització està en estat "%" i no es pot modificar: %. Només es poden canviar data_alta, data_retirada, motiu_retirada i darrer_carrec.',
      v_status, array_to_string(canviats, ', ')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger bloqueja_autoritzacio_signada
  before update on portal.autoritzacions_carrec
  for each row execute function portal.bloqueja_autoritzacio_signada();

-- -----------------------------------------------------------------------------
-- Mentre la sol·licitud és en 'enviat' o 'en_curs', els camps que omple el
-- client només els pot escriure service_role (el formulari del client, fase 3).
-- En 'esborrany' el personal els pot preomplir; des de 'signat' s'aplica el
-- bloqueig de bloqueja_autoritzacio_signada.
-- SECURITY INVOKER a propòsit: current_user ha de ser el rol real de qui escriu.
-- -----------------------------------------------------------------------------
create function portal.camps_client_nomes_servei()
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
                  'iban_ultims4', 'client_facturat_nom', 'poder_adjunt_id')
    and e.value is distinct from to_jsonb(old) -> e.key;

  if canviats is not null then
    raise exception 'La sol·licitud està en estat "%": % ho omple el client i només ho pot modificar service_role', v_status, array_to_string(canviats, ', ')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger camps_client_nomes_servei
  before insert or update on portal.autoritzacions_carrec
  for each row execute function portal.camps_client_nomes_servei();

-- -----------------------------------------------------------------------------
-- data_retirada només pot tenir valor si la sol·licitud és 'retirat' (i en
-- 'retirat' no pot quedar buida). Es comprova en acabar la transacció, per
-- permetre informar data_retirada i passar a 'retirat' en la mateixa operació.
-- -----------------------------------------------------------------------------
create function portal.comprova_data_retirada()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_status        portal.request_status;
  v_data_retirada date;
begin
  select r.status, a.data_retirada into v_status, v_data_retirada
  from portal.autoritzacions_carrec a
  join portal.requests r on r.id = a.request_id
  where a.id = new.id;

  if v_data_retirada is not null and v_status <> 'retirat' then
    raise exception 'data_retirada només es pot informar en retirar l''autorització (la sol·licitud està en "%"). Feu servir portal.retira_autoritzacio().', v_status
      using errcode = '23514';
  end if;

  if v_data_retirada is null and v_status = 'retirat' then
    raise exception 'Una autorització retirada ha de tenir data_retirada'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger comprova_data_retirada
  after insert or update on portal.autoritzacions_carrec
  deferrable initially deferred
  for each row execute function portal.comprova_data_retirada();

-- -----------------------------------------------------------------------------
-- Retirada des del panell: una sola crida que, dins la mateixa transacció,
-- primer informa data_retirada i motiu_retirada i després passa la sol·licitud
-- a 'retirat'. SECURITY INVOKER: s'apliquen els permisos i l'RLS de qui la crida.
-- -----------------------------------------------------------------------------
create function portal.retira_autoritzacio(p_request_id uuid, p_data_retirada date, p_motiu text)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  if p_data_retirada is null then
    raise exception 'Cal indicar la data de retirada' using errcode = '23514';
  end if;

  update portal.autoritzacions_carrec
     set data_retirada = p_data_retirada, motiu_retirada = p_motiu
   where request_id = p_request_id;
  if not found then
    raise exception 'No hi ha cap autorització de càrrec per a la sol·licitud %', p_request_id
      using errcode = 'P0002';
  end if;

  update portal.requests set status = 'retirat' where id = p_request_id;
end;
$$;
