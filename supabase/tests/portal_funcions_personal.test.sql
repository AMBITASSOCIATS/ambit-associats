-- Proves de les funcions SECURITY DEFINER del portal: només el personal (o el
-- servidor) en pot obtenir dades; un usuari de la Zona Professionals, no.
-- Execució local: supabase test db
begin;
select plan(55);

-- ─── Dades de prova (com a postgres) ────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'mpaleari@ambit.ad'),
  ('00000000-0000-0000-0000-0000000000f3', 'gestor-fp@test.local'),
  ('00000000-0000-0000-0000-0000000000f5', 'pro-fp@test.local'),
  ('00000000-0000-0000-0000-0000000000f6', 'maestro-fp@test.local');
insert into portal.staff_profiles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'ocic'),
  ('00000000-0000-0000-0000-0000000000f3', 'gestor');
-- L'OCIC és el signant d'ÀMBIT (firma registrada)
insert into portal.firmes_ocic (user_id, nom, imatge_path, sha256) values
  ('00000000-0000-0000-0000-0000000000f1', 'Martín Paleari',
   'ocic/00000000-0000-0000-0000-0000000000f1/00000000-0000-0000-0000-00000000f1f1.png', repeat('f', 64));
select portal.registra_firma_ambit_des_ocic();
insert into public.profiles (id, email, nom, rol, estat) values
  ('00000000-0000-0000-0000-0000000000f5', 'pro-fp@test.local', 'Pro', 'individual', 'actiu'),
  ('00000000-0000-0000-0000-0000000000f6', 'maestro-fp@test.local', 'Maestro', 'maestro', 'actiu');
insert into portal.clients (id, party_type, nom_mostrat, referencia_client) values
  ('00000000-0000-0000-0000-0000000000d1', 'pj', 'Client Funcions, SL', 'FP-1'),
  ('00000000-0000-0000-0000-0000000000d2', 'pf', 'Client Bloquejat', 'FP-2');

create temp table t (k text primary key, v text);
grant select, insert, update on t to public;

create function pg_temp.com(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.servei() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end $$;
create function pg_temp.fora() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.v(k text) returns uuid language sql as $$ select v::uuid from t where t.k = $1 $$;
grant execute on function pg_temp.v(text) to public;

-- KYC de persona jurídica amb socis i beneficiaris (dades reals que no ha de veure ningú més)
select pg_temp.com('00000000-0000-0000-0000-0000000000f3');
insert into t select 'kyc', portal.crea_kyc('00000000-0000-0000-0000-0000000000d1');
insert into t select 'bloc', portal.crea_kyc('00000000-0000-0000-0000-0000000000d2');
select pg_temp.fora();
set local session_replication_role = replica;
update portal.kyc_formularis set dades = jsonb_build_object(
  'societat', jsonb_build_object('pais_constitucio', 'AD', 'pais_activitat', 'RU'),
  'socis', jsonb_build_array(
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-000000000001', 'nom', 'Soci Secret', 'tipus', 'pf', 'percentatge', '70'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-000000000002', 'nom', 'Sòcia Minoritària', 'tipus', 'pf', 'percentatge', '30')),
  'beneficiaris', jsonb_build_array(
    jsonb_build_object('id', 'bbbbbbbb-0000-0000-0000-000000000001', 'nom', 'Soci Secret', 'nacionalitats', jsonb_build_array('ES'),
                       'pais_residencia', 'AD', 'ppe', jsonb_build_object('exerceix', true))),
  'declaracions', jsonb_build_object('d1', true, 'd2', true, 'd3', true, 'd4', true),
  'declaracio_beneficiaris', true)
where request_id = pg_temp.v('kyc');
update portal.requests set bloquejat_at = now(), destruir_despres_de = now() + interval '1 year'
where id = pg_temp.v('bloc') or id = (select pdp_request_id from portal.kyc_formularis where request_id = pg_temp.v('bloc'));
set local session_replication_role = origin;

-- ═══ 1. Estructura ══════════════════════════════════════════════════════════
select ok(not has_function_privilege('authenticated', 'portal.personal_o_servei()', 'execute')
      and not has_function_privilege('anon', 'portal.personal_o_servei()', 'execute')
      and not has_function_privilege('authenticated', 'portal.exigeix_personal_o_servei()', 'execute')
      and not has_function_privilege('anon', 'portal.exigeix_personal_o_servei()', 'execute'),
  'Les funcions de comprovació no es poden cridar directament');

-- Cap funció SECURITY DEFINER de portal que pugui cridar authenticated queda sense comprovar qui la crida
-- (llevat de les que només retornen dades de qui crida, sense paràmetres)
select is((select coalesce(string_agg(p.proname, ', ' order by p.proname), '') from pg_proc p
           where p.pronamespace = 'portal'::regnamespace and p.prosecdef
             and has_function_privilege('authenticated', p.oid, 'execute')
             and p.prosrc !~ '(is_staff|is_ocic|personal_o_servei)'
             and p.proname not in ('el_meu_rol', 'firma_ambit_meva', 'is_staff', 'is_ocic')),
  '', 'Totes les funcions SECURITY DEFINER de portal comproven qui les crida');
select is((select string_agg(p.proname, ', ' order by p.proname) from pg_proc p
           where p.pronamespace = 'portal'::regnamespace and p.prosecdef and p.pronargs = 0
             and p.proname in ('el_meu_rol', 'firma_ambit_meva', 'is_staff', 'is_ocic')),
  'el_meu_rol, firma_ambit_meva, is_ocic, is_staff', 'Les excepcions no tenen paràmetres');

-- Mateixos permisos que abans
select is((select string_agg(p.proname || '=' || coalesce(p.proacl::text, ''), ' ' order by p.proname) from pg_proc p
           where p.pronamespace = 'portal'::regnamespace and p.proname in ('kyc_participacions', 'request_bloquejada', 'es_signant_ambit')),
  'es_signant_ambit={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} '
  'kyc_participacions={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} '
  'request_bloquejada={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}',
  'Les funcions conserven el propietari i els permisos');

-- ═══ 2. Zona Professionals: cap dada ════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000f5');
select throws_ok($$ select * from portal.kyc_participacions(pg_temp.v('kyc')) $$, '42501', null, 'kyc_participacions: denegat');
select throws_ok($$ select * from portal.kyc_be_no_declarats(pg_temp.v('kyc')) $$, '42501', null, 'kyc_be_no_declarats: denegat');
select throws_ok($$ select * from portal.kyc_paisos(pg_temp.v('kyc')) $$, '42501', null, 'kyc_paisos: denegat');
select throws_ok($$ select portal.kyc_marques(pg_temp.v('kyc')) $$, '42501', null, 'kyc_marques: denegat');
select throws_ok($$ select portal.kyc_estat_documents(pg_temp.v('kyc')) $$, '42501', null, 'kyc_estat_documents: denegat');
select throws_ok($$ select * from portal.kyc_documents_requerits(pg_temp.v('kyc')) $$, '42501', null, 'kyc_documents_requerits: denegat');
select throws_ok($$ select * from portal.kyc_documents_pendents(pg_temp.v('kyc')) $$, '42501', null, 'kyc_documents_pendents: denegat');
select throws_ok($$ select portal.kyc_declaracions_completes(pg_temp.v('kyc')) $$, '42501', null, 'kyc_declaracions_completes: denegat');
select throws_ok($$ select portal.irpf_declaracions_completes(pg_temp.v('kyc')) $$, '42501', null, 'irpf_declaracions_completes: denegat');
select throws_ok($$ select portal.irpf_parametres_json(2025) $$, '42501', null, 'irpf_parametres_json: denegat');
select throws_ok($$ select * from portal.contracte_recompte(pg_temp.v('kyc')) $$, '42501', null, 'contracte_recompte: denegat');
select throws_ok($$ select portal.empremta_contrafirma(pg_temp.v('kyc'), 'x', 'x', repeat('a', 64), now()) $$, '42501', null, 'empremta_contrafirma: denegat');
select throws_ok($$ select portal.llistes_vigents() $$, '42501', null, 'llistes_vigents: denegat');

-- Bloqueig: sempre «bloquejat» (no revela si existeix ni en quin estat és)
select is(portal.request_bloquejada(pg_temp.v('kyc')), true, 'request_bloquejada: «bloquejat» per a una sol·licitud oberta');
select is(portal.client_bloquejat('00000000-0000-0000-0000-0000000000d1'), true, 'client_bloquejat: «bloquejat» per a un client actiu');
select is(portal.perceptor_bloquejat(gen_random_uuid()), true, 'perceptor_bloquejat: «bloquejat»');
select is(portal.cami_bloquejat('requests/' || pg_temp.v('kyc') || '/original/x.pdf'), true, 'cami_bloquejat: «bloquejat»');
select is(portal.auditoria_bloquejada('requests', pg_temp.v('kyc'), 'SELECT'), true, 'auditoria_bloquejada: «bloquejat»');
select is(portal.es_signant_ambit('00000000-0000-0000-0000-0000000000f1'), false, 'es_signant_ambit d''un altre usuari: false');
select is(portal.es_signant_ambit(), false, 'es_signant_ambit: false');
select is(portal.el_meu_rol(), null, 'el_meu_rol: cap rol');
select is((select count(*)::int from portal.firma_ambit_meva()), 0, 'firma_ambit_meva: cap fila');

-- Les consultes de la Zona Professionals no es trenquen: zero files, sense error
select is((select count(*)::int from portal.requests), 0, 'portal.requests: zero files');
select is((select count(*)::int from portal.clients), 0, 'portal.clients: zero files');
select is((select count(*)::int from storage.objects), 0, 'storage.objects: zero files');
select is((select count(*)::int from portal.audit_log), 0, 'portal.audit_log: zero files');
select pg_temp.fora();

-- Totes les funcions de portal que pot cridar authenticated, amb la sol·licitud i el client reals:
-- cap retorna dades a un usuari de la Zona Professionals (ni a un maestro)
create function pg_temp.recorre(p_uid uuid, p_clau text, p_id uuid) returns void language plpgsql as $$
declare
  r record;
  res text;
  n int := 0;
  oberts text := '';
begin
  for r in select p.oid, p.oid::regprocedure::text as f, p.proname, p.proargtypes, p.proretset from pg_proc p
           where p.pronamespace = 'portal'::regnamespace and has_function_privilege('authenticated', p.oid, 'EXECUTE')
             and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype order by 2 loop
    perform pg_temp.com(p_uid);
    begin
      execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from (select * from portal.%I(%s) limit 50) x', r.proname,
                     (select coalesce(string_agg(case when x = 'uuid'::regtype then quote_literal(p_id) || '::uuid' else 'null::' || format_type(x, null) end, ', '), '')
                      from unnest(r.proargtypes::oid[]) x))
        into res;
      n := n + 1;
      -- Sense dades: cap fila, nul, false o buit; «bloquejat» per a les funcions de bloqueig;
      -- irpf_vigent (SECURITY INVOKER, amb RLS) sense càlcul ni comunicació. Excepcions: funcions
      -- pures o de valors fixos que no llegeixen cap dada de client (data d'avui, normalització
      -- de noms, validesa d'un document segons dates, llistes de sancions i correu del signant
      -- d'ÀMBIT, que és públic)
      if res not in ('[]', '[null]', '[false]', '[{}]', '[[]]', '[{"total": 0, "signats": 0}]')
         and not (r.proname ~ 'bloquej' and res ~ '^\[\{"[a-z_]+": true\}\]$')
         and not (r.proname = 'irpf_vigent' and res ~ '"calcul": null, "comunicacio": null')
         and r.proname not in ('avui', 'nom_normal', 'kyc_adjunt_valid', 'llistes_sancions', 'correu_signant_ambit')
         and not (res ~ '^\[\{"[a-z_]+": (null|false|\[\]|\{\})\}\]$') then
        oberts := oberts || r.f || ' → ' || left(res, 80) || E'\n';
      end if;
    exception when others then
      n := n + 1;
    end;
    perform pg_temp.fora();
  end loop;
  insert into t values (p_clau, oberts), (p_clau || '_n', n::text);
end $$;
select pg_temp.recorre('00000000-0000-0000-0000-0000000000f5', 'pro_kyc', pg_temp.v('kyc'));
select pg_temp.recorre('00000000-0000-0000-0000-0000000000f5', 'pro_client', '00000000-0000-0000-0000-0000000000d1');
select pg_temp.recorre('00000000-0000-0000-0000-0000000000f6', 'maestro_kyc', pg_temp.v('kyc'));
select is((select v from t where k = 'pro_kyc'), '', 'Cap funció de portal retorna dades a la Zona Professionals (amb l''id de la sol·licitud)');
select is((select v from t where k = 'pro_client'), '', '… ni amb l''id del client');
select is((select v from t where k = 'maestro_kyc'), '', '… ni a un maestro');
select ok((select v::int from t where k = 'pro_kyc_n') > 60, 'Comprovades totes (' || (select v from t where k = 'pro_kyc_n') || ')');

-- ═══ 3. Personal: tot igual ═════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000f3');
select is((select string_agg(nom || ' ' || percentatge, ', ') from portal.kyc_participacions(pg_temp.v('kyc'))),
  'Soci Secret 70.00, Sòcia Minoritària 30.00', 'Gestor: kyc_participacions');
select is((select string_agg(distinct m ->> 'codi', ',' order by m ->> 'codi') from jsonb_array_elements(portal.kyc_marques(pg_temp.v('kyc'))) m),
  'be_no_declarat,pais_risc,ppe,russia_belarus', 'Gestor: kyc_marques (la sòcia del 30 % no és beneficiària declarada)');
select ok(jsonb_array_length(portal.kyc_estat_documents(pg_temp.v('kyc')) -> 'requerits') > 0, 'Gestor: kyc_estat_documents');
select is(portal.kyc_declaracions_completes(pg_temp.v('kyc')), true, 'Gestor: kyc_declaracions_completes');
select ok(portal.llistes_vigents() ? 'UE', 'Gestor: llistes_vigents');
select is(portal.request_bloquejada(pg_temp.v('kyc')), false, 'Gestor: una sol·licitud oberta no està bloquejada');
select is(portal.request_bloquejada(pg_temp.v('bloc')), true, 'Gestor: la bloquejada sí');
select is(portal.client_bloquejat('00000000-0000-0000-0000-0000000000d1') || '/' || portal.client_bloquejat('00000000-0000-0000-0000-0000000000d2'),
  'false/true', 'Gestor: client_bloquejat');
select is(portal.cami_bloquejat('requests/' || pg_temp.v('kyc') || '/original/x.pdf') || '/' || portal.cami_bloquejat('requests/' || pg_temp.v('bloc') || '/original/x.pdf'),
  'false/true', 'Gestor: cami_bloquejat');
select is((select count(*)::int from portal.requests where id in (pg_temp.v('kyc'), pg_temp.v('bloc'))), 1,
  'Gestor: veu la sol·licitud oberta i no la bloquejada (polítiques iguals)');
select is((select count(*)::int from portal.clients where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')), 1,
  'Gestor: veu el client actiu i no el bloquejat');
select is(portal.el_meu_rol()::text, 'gestor', 'Gestor: el_meu_rol');
select is(portal.es_signant_ambit('00000000-0000-0000-0000-0000000000f1'), true, 'Gestor: es_signant_ambit de l''OCIC signant');
select pg_temp.fora();

select pg_temp.com('00000000-0000-0000-0000-0000000000f1');
select is(portal.auditoria_bloquejada('requests', pg_temp.v('kyc'), 'UPDATE'), false, 'OCIC: auditoria d''una sol·licitud oberta visible');
select is(portal.auditoria_bloquejada('requests', pg_temp.v('bloc'), 'UPDATE'), true, 'OCIC: la d''una bloquejada, no');
select is(portal.es_signant_ambit(), true, 'OCIC signant: es_signant_ambit');
select is((select count(*)::int from portal.firma_ambit_meva()), 1, 'OCIC signant: firma_ambit_meva');
select pg_temp.fora();

-- ═══ 4. Servidor: tot igual ═════════════════════════════════════════════════
select pg_temp.servei();
select is((select count(*)::int from portal.kyc_participacions(pg_temp.v('kyc'))), 2, 'service_role: kyc_participacions');
select is(portal.request_bloquejada(pg_temp.v('kyc')), false, 'service_role: request_bloquejada');
select pg_temp.fora();
-- Connexió directa sense JWT (pg_cron, portal_purga)
select is((select count(*)::int from portal.kyc_participacions(pg_temp.v('kyc'))), 2, 'Sense JWT: kyc_participacions');
select is(portal.request_bloquejada(pg_temp.v('bloc')), true, 'Sense JWT: request_bloquejada');

select * from finish();
rollback;
