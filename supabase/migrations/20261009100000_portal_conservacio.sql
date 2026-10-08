-- =============================================================================
-- Portal de signatura · Conservació, bloqueig i destrucció
-- (articles 30 i 70.1 de la Llei 29/2021, qualificada de protecció de dades)
--
-- 1. Venciment: les sol·licituds que ja no s'han de conservar per a la seva
--    finalitat (retirades, anul·lades, enllaços caducats, esborranys antics).
-- 2. Bloqueig: en vèncer, les dades queden bloquejades durant el termini de
--    bloqueig (per defecte 3 anys). Ningú les veu pel panell normal; només
--    l'OCIC, per requeriment d'una autoritat i deixant-ne constància.
-- 3. Destrucció: passat el termini de bloqueig i sense cap retenció activa,
--    s'esborren els fitxers (Storage API, Edge Function portal-purga) i les
--    files, i a audit_log els detalls d'aquestes entitats queden com
--    {"purgat": true}, amb una entrada DESTRUCCIO sense dades personals.
--
-- EXCEPCIONS ÚNIQUES a les regles de les fases 1 a 3:
--  · "Cap esborrat físic" i "audit_log immutable": només dins de
--    portal.destrueix_solicitud(), que s'executa com a rol propietari
--    portal_purga i fixa l'indicador de sessió portal.mode = 'purga'.
--    Calen les dues coses alhora (portal.en_purga()); authenticated,
--    service_role i postgres fora de la funció continuen sense poder esborrar
--    res ni modificar audit_log.
--  · "service_role no esborra mai fitxers de portal-docs": només l'Edge
--    Function portal-purga, i només els fitxers de sol·licituds que
--    portal.candidats_destruccio() dona per destruïbles.
--  · Nova transició signat → anullat: només l'OCIC (sessió authenticated) i
--    amb motiu obligatori, per a autoritzacions signades que no s'activaran
--    (si no, no vencerien mai). Les dades signades continuen immutables.
-- La resta de regles no canvien; aquesta migració n'afegeix de noves.
-- No toca cap taula de public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rol propietari de les funcions de bloqueig i destrucció
-- -----------------------------------------------------------------------------
create role portal_purga nologin noinherit;
-- postgres l'ha de poder fer propietari de les funcions; es retira al final.
grant portal_purga to postgres with set true;
grant usage on schema portal to portal_purga;

-- Cert només dins de les funcions de destrucció: rol portal_purga i indicador
-- de sessió fixat per la mateixa funció. SECURITY INVOKER a propòsit.
create function portal.en_purga()
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select current_user = 'portal_purga' and current_setting('portal.mode', true) = 'purga';
$$;

create function portal.en_bloqueig()
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select current_user = 'portal_purga' and current_setting('portal.mode', true) = 'bloqueig';
$$;

-- -----------------------------------------------------------------------------
-- 2. Configuració: terminis (una sola fila). Es canvien amb una migració:
--    update portal.config_conservacio set termini_bloqueig = interval '5 years';
-- -----------------------------------------------------------------------------
create table portal.config_conservacio (
  id                    uuid primary key default gen_random_uuid(),
  unica                 boolean not null default true unique check (unica),  -- una sola fila
  -- Termini de bloqueig abans de destruir (art. 70.1): per defecte 3 anys
  termini_bloqueig      interval not null default interval '3 years'
                        check (termini_bloqueig >= interval '0'),
  -- Sol·licituds no signades: anul·lades, enllaç caducat o esborrany sense canvis
  termini_no_signades   interval not null default interval '12 months'
                        check (termini_no_signades >= interval '0'),
  updated_at            timestamptz not null default now()
);
insert into portal.config_conservacio default values;

create trigger set_updated_at before update on portal.config_conservacio
  for each row execute function portal.set_updated_at();
alter table portal.config_conservacio enable row level security;

-- -----------------------------------------------------------------------------
-- 3. Columnes noves de requests
-- -----------------------------------------------------------------------------
alter table portal.requests
  add column anullat_at          timestamptz,
  add column motiu_anullacio     text check (motiu_anullacio is null or btrim(motiu_anullacio) <> ''),
  add column bloquejat_at        timestamptz,
  add column destruir_despres_de timestamptz,
  add constraint requests_bloqueig_coherent
    check ((bloquejat_at is null) = (destruir_despres_de is null));

-- Sol·licituds ja anul·lades abans d'aquesta migració: data aproximada (darrer canvi)
update portal.requests set anullat_at = updated_at where status = 'anullat' and anullat_at is null;

create index on portal.requests (bloquejat_at) where bloquejat_at is not null;

-- -----------------------------------------------------------------------------
-- 4. Retencions per reclamació o procediment (només OCIC, sobre bloquejades)
-- -----------------------------------------------------------------------------
create table portal.retencions (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references portal.requests (id) on delete restrict,
  motiu           text not null check (btrim(motiu) <> ''),
  activada_per    uuid not null references auth.users (id) on delete restrict,
  activada_at     timestamptz not null default now(),
  retirada_per    uuid references auth.users (id) on delete restrict,
  retirada_at     timestamptz,
  motiu_retirada  text,
  check ((retirada_at is null) = (retirada_per is null)),
  check (retirada_at is null or btrim(coalesce(motiu_retirada, '')) <> '')
);
create unique index retencions_una_activa on portal.retencions (request_id) where retirada_at is null;
alter table portal.retencions enable row level security;

-- -----------------------------------------------------------------------------
-- 5. valida_estat: la de les fases 1 a 3, més:
--    · anullat_at el fixa sempre aquest trigger (now() en passar a 'anullat');
--    · bloquejat_at i destruir_despres_de només els canvia
--      portal.bloqueja_vencudes() (s'ignora el que arribi a la petició);
--    · una sol·licitud bloquejada ja no canvia d'estat;
--    · signat → anullat: només OCIC (authenticated) i amb motiu_anullacio,
--      que només es pot posar en aquesta transició.
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
  if not (old.status = 'signat' and new.status = 'anullat') then
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
    when old.status = 'signat'    and new.status = 'actiu'   then 'personal'
    when old.status = 'actiu'     and new.status = 'retirat' then 'personal'
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

  -- Anul·lar una autorització signada que no s'activarà: només l'OCIC, amb motiu
  if qui = 'ocic' then
    if not (current_user = 'authenticated' and portal.is_ocic()) then
      raise exception 'Només l''OCIC pot anul·lar una autorització signada' using errcode = '42501';
    end if;
    if btrim(coalesce(new.motiu_anullacio, '')) = '' then
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

  -- Conservació: data d'anul·lació (no editable)
  if new.status = 'anullat' then
    new.anullat_at := now();
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5 bis. Immutabilitat del que s'ha signat: la de la fase 1 es basava en
--    l'estat (signat, actiu, retirat). Amb signat → anullat, una autorització
--    signada podria tornar a ser editable; ara es bloqueja també sempre que
--    hi hagi firma, sigui quin sigui l'estat.
-- -----------------------------------------------------------------------------
create or replace function portal.bloqueja_autoritzacio_signada()
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
  if v_status not in ('signat', 'actiu', 'retirat')
     and not exists (select 1 from portal.signatures s where s.request_id = old.request_id) then
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

-- -----------------------------------------------------------------------------
-- 6. Prohibició d'esborrat: única excepció, la funció de destrucció
-- -----------------------------------------------------------------------------
create or replace function portal.impedeix_canvi()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_level = 'ROW' and portal.en_purga() then
    -- Esborrar files de dades (mai d'audit_log)
    if tg_op = 'DELETE' and tg_table_name <> 'audit_log' then
      return old;
    end if;
    -- A audit_log, només substituir detalls per {"purgat": true}, sense tocar res més
    if tg_op = 'UPDATE' and tg_table_name = 'audit_log' then
      if new.detalls = '{"purgat": true}'::jsonb
         and (new.id, new.actor, new.accio, new.entitat, new.entitat_id, new.ip, new.user_agent, new.at)
             is not distinct from
             (old.id, old.actor, old.accio, old.entitat, old.entitat_id, old.ip, old.user_agent, old.at) then
        return new;
      end if;
    end if;
  end if;

  raise exception 'Operació % no permesa a portal.%', tg_op, tg_table_name
    using errcode = '42501';
end;
$$;

-- Taules noves: tampoc admeten esborrat ni buidat (salvat la destrucció)
create trigger impedeix_delete before delete on portal.retencions          for each row execute function portal.impedeix_canvi();
create trigger impedeix_delete before delete on portal.config_conservacio  for each row execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.retencions          for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.config_conservacio  for each statement execute function portal.impedeix_canvi();

-- -----------------------------------------------------------------------------
-- 7. Auditoria: sense registre dels DELETE de la destrucció (en deixa un de
--    sol, DESTRUCCIO). Fora de la destrucció, cap DELETE arriba aquí: el
--    bloqueja impedeix_canvi (BEFORE), i aquest trigger és AFTER.
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
  if tg_op = 'DELETE' and current_setting('portal.mode', true) = 'purga' then
    return null;
  end if;

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

create trigger audita after insert or update or delete on portal.retencions         for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.config_conservacio for each row execute function portal.audita();

-- -----------------------------------------------------------------------------
-- 8. Funcions auxiliars de bloqueig (SECURITY DEFINER: s'usen dins de polítiques)
-- -----------------------------------------------------------------------------
create function portal.request_bloquejada(p_request_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from portal.requests where id = p_request_id and bloquejat_at is not null);
$$;

-- Client amb sol·licituds i totes bloquejades
create function portal.client_bloquejat(p_client_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from portal.requests where client_id = p_client_id)
     and not exists (select 1 from portal.requests where client_id = p_client_id and bloquejat_at is null);
$$;

-- Fitxer de portal-docs d'una sol·licitud bloquejada (camí requests/<uuid>/...)
create function portal.cami_bloquejat(p_cami text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select case
    when split_part(p_cami, '/', 2) ~ '^[0-9a-f-]{36}$'
      then portal.request_bloquejada(split_part(p_cami, '/', 2)::uuid)
    else false
  end;
$$;

-- Entrada d'audit_log amb dades d'una sol·licitud bloquejada
-- (només INSERT/UPDATE/DELETE de les taules de dades; EXPORT, DESTRUCCIO,
--  ACCES_REQUERIMENT i les retencions no porten dades del titular).
create function portal.auditoria_bloquejada(p_entitat text, p_entitat_id uuid, p_accio text)
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
    else false
  end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RLS: les dades bloquejades desapareixen del panell (gestor i OCIC)
-- -----------------------------------------------------------------------------
drop policy personal_select on portal.clients;
drop policy personal_update on portal.clients;
create policy personal_select on portal.clients for select to authenticated
  using (portal.is_staff() and not portal.client_bloquejat(id));
create policy personal_update on portal.clients for update to authenticated
  using (portal.is_staff() and not portal.client_bloquejat(id))
  with check (portal.is_staff() and not portal.client_bloquejat(id));

drop policy personal_select on portal.requests;
drop policy personal_insert on portal.requests;
drop policy personal_update on portal.requests;
create policy personal_select on portal.requests for select to authenticated
  using (portal.is_staff() and bloquejat_at is null);
create policy personal_insert on portal.requests for insert to authenticated
  with check (portal.is_staff() and not portal.client_bloquejat(client_id));
create policy personal_update on portal.requests for update to authenticated
  using (portal.is_staff() and bloquejat_at is null)
  with check (portal.is_staff() and bloquejat_at is null);

drop policy personal_select on portal.autoritzacions_carrec;
drop policy personal_insert on portal.autoritzacions_carrec;
drop policy personal_update on portal.autoritzacions_carrec;
create policy personal_select on portal.autoritzacions_carrec for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_insert on portal.autoritzacions_carrec for insert to authenticated
  with check (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_update on portal.autoritzacions_carrec for update to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id))
  with check (portal.is_staff() and not portal.request_bloquejada(request_id));

drop policy personal_select on portal.signatures;
create policy personal_select on portal.signatures for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));

drop policy personal_select on portal.documents;
drop policy personal_insert on portal.documents;
create policy personal_select on portal.documents for select to authenticated
  using (portal.is_staff() and not portal.request_bloquejada(request_id));
create policy personal_insert on portal.documents for insert to authenticated
  with check (portal.is_staff() and kind = 'adjunt' and not portal.request_bloquejada(request_id));

drop policy ocic_select on portal.audit_log;
create policy ocic_select on portal.audit_log for select to authenticated
  using (portal.is_ocic() and not portal.auditoria_bloquejada(entitat, entitat_id, accio));

-- Fitxers: tampoc es poden descarregar pel panell
drop policy portal_docs_personal_select on storage.objects;
create policy portal_docs_personal_select on storage.objects
  for select to authenticated
  using (bucket_id = 'portal-docs' and portal.is_staff() and not portal.cami_bloquejat(name));

-- Rol portal_purga: veu i pot actuar sobre totes les files (limitat pels GRANT de més avall)
do $$
declare
  t text;
begin
  foreach t in array array['clients', 'requests', 'autoritzacions_carrec', 'signatures', 'documents',
                           'access_tokens', 'otps', 'retencions', 'audit_log', 'config_conservacio'] loop
    execute format('create policy purga on portal.%I for all to portal_purga using (true) with check (true)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Funcions de les fases 2-3 que han d'ignorar les bloquejades
-- -----------------------------------------------------------------------------
create or replace function portal.estat_enllac(p_request_id uuid)
  returns table (creat_at timestamptz, expira_at timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select t.created_at, t.expira_at
  from portal.access_tokens t
  join portal.requests r on r.id = t.request_id
  where portal.is_staff()
    and t.request_id = p_request_id
    and r.bloquejat_at is null
    and t.revocat_at is null and t.usat_at is null
    and t.expira_at > now();
$$;

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
  if v_req.status not in ('enviat', 'en_curs') or v_req.bloquejat_at is not null then
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

create or replace function portal.remesa_exporta(p_actor uuid, p_ip inet, p_user_agent text)
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
  where r.status = 'actiu' and r.document_type = 'autoritzacio_carrec' and r.bloquejat_at is null;

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
-- 11. Venciments: una sola definició per al bloqueig, la simulació i el panell
--     p_ara permet calcular-los a una data simulada (no canvia res).
--     · retirat               → conservar_fins (retirada o darrer càrrec + 13 mesos)
--     · anullat               → anullat_at + termini_no_signades
--     · enviat/en_curs sense cap enllaç vigent → caducitat del darrer enllaç + termini
--     · esborrany             → darrer canvi + termini
--     · signat i actiu no vencen.
-- -----------------------------------------------------------------------------
create function portal.venciments(p_ara timestamptz default now())
  returns table (request_id uuid, client_id uuid, status portal.request_status, causa text, vencut_el timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with cfg as (select termini_no_signades as t from portal.config_conservacio),
  base as (
    select r.id, r.client_id, r.status,
      case r.status
        when 'retirat' then 'retirada'
        when 'anullat' then 'anul·lació'
        when 'esborrany' then 'esborrany sense canvis'
        else 'enllaç caducat'
      end as causa,
      case r.status
        when 'retirat' then (a.conservar_fins::timestamp at time zone 'Europe/Andorra')
        when 'anullat' then coalesce(r.anullat_at, r.updated_at) + (select t from cfg)
        when 'esborrany' then greatest(r.updated_at, coalesce(a.updated_at, r.updated_at)) + (select t from cfg)
        when 'enviat' then coalesce((select max(t.expira_at) from portal.access_tokens t where t.request_id = r.id), r.updated_at) + (select t from cfg)
        when 'en_curs' then coalesce((select max(t.expira_at) from portal.access_tokens t where t.request_id = r.id), r.updated_at) + (select t from cfg)
      end as vencut_el
    from portal.requests r
    left join portal.autoritzacions_carrec a on a.request_id = r.id
    where r.bloquejat_at is null
      and r.status in ('retirat', 'anullat', 'esborrany', 'enviat', 'en_curs')
      -- enviat / en_curs: només si no hi ha cap enllaç vigent a p_ara
      and not (r.status in ('enviat', 'en_curs') and exists (
            select 1 from portal.access_tokens t
            where t.request_id = r.id and t.revocat_at is null and t.usat_at is null and t.expira_at > p_ara))
  )
  select id, client_id, status, causa, vencut_el from base where vencut_el is not null;
$$;

-- -----------------------------------------------------------------------------
-- 12. Bloqueig (Edge Function portal-purga, service_role)
--     Propietari portal_purga. No modifica dades ni documents: només marca
--     bloquejat_at i destruir_despres_de.
-- -----------------------------------------------------------------------------
create function portal.bloqueja_vencudes(p_simulacio boolean default true)
  returns table (request_id uuid, causa text, vencut_el timestamptz, destruir_despres_de timestamptz)
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_termini interval := (select termini_bloqueig from portal.config_conservacio);
  v record;
begin
  perform set_config('portal.mode', 'bloqueig', true);
  for v in select * from portal.venciments(now()) x where x.vencut_el <= now() order by x.vencut_el loop
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

-- -----------------------------------------------------------------------------
-- 13. Retencions (panell OCIC, authenticated). SECURITY DEFINER: la taula no
--     té permisos directes. L'auditoria registra l'OCIC com a actor.
-- -----------------------------------------------------------------------------
create function portal.activa_retencio(p_request_id uuid, p_motiu text)
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
  perform 1 from portal.requests where id = p_request_id and bloquejat_at is not null for update;
  if not found then
    raise exception 'Només es poden retenir sol·licituds bloquejades' using errcode = 'P0002';
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

create function portal.retira_retencio(p_request_id uuid, p_motiu text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC pot gestionar retencions' using errcode = '42501';
  end if;
  if btrim(coalesce(p_motiu, '')) = '' then
    raise exception 'Cal indicar el motiu per retirar la retenció' using errcode = '23514';
  end if;
  update portal.retencions
     set retirada_at = now(), retirada_per = auth.uid(), motiu_retirada = btrim(p_motiu)
   where request_id = p_request_id and retirada_at is null;
  if not found then
    raise exception 'Aquesta sol·licitud no té cap retenció activa' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. Accés per requeriment d'autoritat (Edge Function portal-requeriment)
--     Només OCIC, només sobre bloquejades, amb motiu i autoritat. Cada accés
--     queda a audit_log (ACCES_REQUERIMENT).
-- -----------------------------------------------------------------------------
create function portal.acces_requeriment(
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
    'signatura', (select to_jsonb(s) from portal.signatures s where s.request_id = p_request_id),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from portal.documents d where d.request_id = p_request_id), '[]'::jsonb),
    'retencions', coalesce((select jsonb_agg(to_jsonb(x) order by x.activada_at) from portal.retencions x where x.request_id = p_request_id), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 15. Panell OCIC: venciments propers, bloquejades i simulació
--     (sense noms de les bloquejades: només referència i dates)
-- -----------------------------------------------------------------------------
create function portal.propers_venciments(p_dies int default 90)
  returns table (request_id uuid, nom_mostrat text, referencia_client text, status portal.request_status, causa text, vencut_el timestamptz)
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC' using errcode = '42501';
  end if;
  return query
    select v.request_id, c.nom_mostrat, c.referencia_client::text, v.status, v.causa, v.vencut_el
    from portal.venciments(now()) v
    join portal.clients c on c.id = v.client_id
    where v.vencut_el <= now() + make_interval(days => p_dies)
    order by v.vencut_el;
end;
$$;

create function portal.llista_bloquejades()
  returns table (request_id uuid, status portal.request_status, referencia_client text,
                 bloquejat_at timestamptz, destruir_despres_de timestamptz, retencio jsonb)
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  if not portal.is_ocic() then
    raise exception 'Només l''OCIC' using errcode = '42501';
  end if;
  return query
    select r.id, r.status, c.referencia_client::text, r.bloquejat_at, r.destruir_despres_de,
           (select jsonb_build_object('motiu', x.motiu, 'activada_at', x.activada_at)
              from portal.retencions x where x.request_id = r.id and x.retirada_at is null)
    from portal.requests r
    join portal.clients c on c.id = r.client_id
    where r.bloquejat_at is not null
    order by r.destruir_despres_de;
end;
$$;

-- Destruïbles: bloquejades, termini de bloqueig passat i sense retenció activa
create function portal.destruibles()
  returns table (request_id uuid, bloquejat_at timestamptz, destruir_despres_de timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select r.id, r.bloquejat_at, r.destruir_despres_de
  from portal.requests r
  where r.bloquejat_at is not null
    and r.destruir_despres_de <= now()
    and not exists (select 1 from portal.retencions x where x.request_id = r.id and x.retirada_at is null)
  order by r.destruir_despres_de;
$$;

-- Simulació: què es bloquejaria i què es destruiria ara, sense canviar res
create function portal.simula_conservacio()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  if not (portal.is_ocic() or auth.role() = 'service_role') then
    raise exception 'Només l''OCIC' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'a_bloquejar', coalesce((
      select jsonb_agg(jsonb_build_object('request_id', v.request_id, 'referencia', c.referencia_client,
                                          'status', v.status, 'causa', v.causa, 'vencut_el', v.vencut_el)
                       order by v.vencut_el)
      from portal.venciments(now()) v join portal.clients c on c.id = v.client_id
      where v.vencut_el <= now()), '[]'::jsonb),
    'a_destruir', coalesce((
      select jsonb_agg(jsonb_build_object('request_id', d.request_id, 'referencia', c.referencia_client,
                                          'bloquejat_at', d.bloquejat_at, 'destruir_despres_de', d.destruir_despres_de)
                       order by d.destruir_despres_de)
      from portal.destruibles() d join portal.requests r on r.id = d.request_id join portal.clients c on c.id = r.client_id), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 16. Destrucció
-- -----------------------------------------------------------------------------

-- Fitxers de cada sol·licitud destruïble (tots els de requests/<id>/, també
-- els que van quedar sense registrar per un error a mitja signatura).
-- registrats: quants d'aquests fitxers consten a portal.documents (amb empremta)
create function portal.candidats_destruccio()
  returns table (request_id uuid, fitxers text[], registrats int)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select d.request_id,
         coalesce((select array_agg(o.name order by o.name) from storage.objects o
                   where o.bucket_id = 'portal-docs' and o.name like 'requests/' || d.request_id || '/%'), '{}'),
         (select count(*)::int from portal.documents x
           join storage.objects o on o.bucket_id = 'portal-docs' and o.name = x.storage_path
          where x.request_id = d.request_id)
  from portal.destruibles() d;
$$;

create function portal.fitxers_restants(p_request_id uuid)
  returns int
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select count(*)::int from storage.objects
  where bucket_id = 'portal-docs' and name like 'requests/' || p_request_id || '/%';
$$;

-- Esborra totes les files d'una sol·licitud destruïble en una transacció.
-- Propietari portal_purga + indicador portal.mode = 'purga': l'única manera
-- d'esborrar al portal. Exigeix que els fitxers ja s'hagin esborrat (Storage
-- API). Si la sol·licitud ja no existeix, no fa res (idempotent).
create function portal.destrueix_solicitud(p_request_id uuid, p_altres_fitxers int default 0)
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
                     'access_tokens', 'otps', 'retencions')
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

-- -----------------------------------------------------------------------------
-- 17. Propietaris i permisos
-- -----------------------------------------------------------------------------
-- (canviar el propietari exigeix CREATE a l'esquema; només durant aquest pas)
grant create on schema portal to portal_purga;
alter function portal.bloqueja_vencudes(boolean) owner to portal_purga;
alter function portal.destrueix_solicitud(uuid, int) owner to portal_purga;
revoke create on schema portal from portal_purga;

-- Allò que poden fer les funcions de portal_purga (i res més)
grant select on portal.config_conservacio to portal_purga;
grant select, delete on portal.clients, portal.autoritzacions_carrec, portal.signatures, portal.documents,
                        portal.access_tokens, portal.otps, portal.retencions to portal_purga;
grant select, delete, update (bloquejat_at, destruir_despres_de) on portal.requests to portal_purga;
grant select, insert, update (detalls) on portal.audit_log to portal_purga;

revoke all on table portal.config_conservacio, portal.retencions from public, anon, authenticated, service_role;
grant select on portal.config_conservacio to service_role;

revoke all on function
  portal.en_purga(), portal.en_bloqueig(),
  portal.request_bloquejada(uuid), portal.client_bloquejat(uuid), portal.cami_bloquejat(text),
  portal.auditoria_bloquejada(text, uuid, text),
  portal.venciments(timestamptz), portal.bloqueja_vencudes(boolean),
  portal.activa_retencio(uuid, text), portal.retira_retencio(uuid, text),
  portal.acces_requeriment(uuid, uuid, text, text, inet, text),
  portal.propers_venciments(int), portal.llista_bloquejades(), portal.destruibles(),
  portal.simula_conservacio(), portal.candidats_destruccio(), portal.fitxers_restants(uuid),
  portal.destrueix_solicitud(uuid, int)
from public, anon, authenticated, service_role;

-- Triggers i polítiques (s'executen amb el rol de qui fa la petició)
grant execute on function portal.en_purga(), portal.en_bloqueig() to authenticated, service_role, portal_purga;
grant execute on function portal.request_bloquejada(uuid), portal.client_bloquejat(uuid),
                          portal.cami_bloquejat(text), portal.auditoria_bloquejada(text, uuid, text)
  to authenticated, service_role;

-- Panell OCIC (cada funció comprova is_ocic)
grant execute on function portal.activa_retencio(uuid, text), portal.retira_retencio(uuid, text),
                          portal.propers_venciments(int), portal.llista_bloquejades(),
                          portal.simula_conservacio()
  to authenticated;

-- Edge Functions portal-purga i portal-requeriment
grant execute on function portal.bloqueja_vencudes(boolean), portal.candidats_destruccio(),
                          portal.destrueix_solicitud(uuid, int), portal.simula_conservacio(),
                          portal.acces_requeriment(uuid, uuid, text, text, inet, text)
  to service_role;

-- Funcions que criden les de portal_purga
grant execute on function portal.venciments(timestamptz), portal.fitxers_restants(uuid)
  to portal_purga;

-- postgres ja no necessita actuar com a portal_purga
revoke portal_purga from postgres;

-- -----------------------------------------------------------------------------
-- 18. Execució diària (pg_cron + pg_net → Edge Function portal-purga)
--     La URL i el secret es desen a Vault (portal_purga_url, portal_purga_secret).
--     Sense aquests dos secrets, la tasca no fa res.
-- -----------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create function portal.llanca_purga()
  returns bigint
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'portal_purga_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'portal_purga_secret';
  if v_url is null or v_secret is null then
    raise warning 'portal-purga: falten els secrets portal_purga_url o portal_purga_secret a Vault';
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-portal-purga', v_secret),
    body := '{"simulacio": false}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke all on function portal.llanca_purga() from public, anon, authenticated, service_role;

-- Cada dia a les 03:30 UTC
select cron.schedule('portal-purga-diaria', '30 3 * * *', 'select portal.llanca_purga()');
