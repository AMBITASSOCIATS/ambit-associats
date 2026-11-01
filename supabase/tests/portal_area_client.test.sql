-- Proves de l'àrea de client (comptes de client separats, sessió amb segon
-- factor, enllaços, enviaments, documents i conservació)
-- Execució local: supabase test db
begin;
select plan(166);

-- ─── Dades de prova (com a postgres) ────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'info@ambit.ad'),
  ('00000000-0000-0000-0000-0000000000a2', 'mpaleari@ambit.ad'),
  ('00000000-0000-0000-0000-0000000000a3', 'gestor-ac@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'pro-ac@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'client1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'client2@test.local'),
  ('00000000-0000-0000-0000-0000000000b3', 'client3@test.local'),
  ('00000000-0000-0000-0000-0000000000b9', 'lliure@test.local')
on conflict (id) do nothing;
insert into portal.staff_profiles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestor'),
  ('00000000-0000-0000-0000-0000000000a2', 'ocic'),
  ('00000000-0000-0000-0000-0000000000a3', 'gestor')
on conflict (user_id) do nothing;
insert into public.profiles (id, email, nom, rol, estat) values
  ('00000000-0000-0000-0000-0000000000a4', 'pro-ac@test.local', 'Pro', 'individual', 'actiu');
insert into portal.clients (id, party_type, nom_mostrat) values
  ('00000000-0000-0000-0000-0000000000c1', 'pj', 'Client A'),
  ('00000000-0000-0000-0000-0000000000c2', 'pf', 'Client B'),
  ('00000000-0000-0000-0000-0000000000c3', 'pj', 'Client C');
update portal.client_destinataris set user_id = '00000000-0000-0000-0000-0000000000a1', actiu = true where email = 'info@ambit.ad';
update portal.client_destinataris set user_id = '00000000-0000-0000-0000-0000000000a2', actiu = true where email = 'mpaleari@ambit.ad';

create temp table t (k text primary key, v text);
grant select, insert, update on t to public;

-- Sessió del personal / Zona Professionals (rol authenticated)
create function pg_temp.com(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end $$;
-- Sessió d'un usuari de client (rol portal_client), amb aal i session_id
create function pg_temp.client(uid uuid, aal text default 'aal2', sid uuid default null, rol text default 'portal_client') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', rol, 'aal', aal, 'session_id', sid)::text, true);
  execute format('set local role %I', rol);
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
grant execute on function pg_temp.com(uuid), pg_temp.client(uuid, text, uuid, text), pg_temp.servei(), pg_temp.fora() to public;

-- Usuaris de client: U1 (clients A i B) i U2 (client A), actius i amb sessió verificada
select pg_temp.servei();
insert into t values ('u1', portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Usuària U1', 'client1@test.local', '00000000-0000-0000-0000-0000000000b1')::text);
select portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 'Usuària U1', 'CLIENT1@test.local');
insert into t values ('u2', portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Usuari U2', 'client2@test.local', '00000000-0000-0000-0000-0000000000b2')::text);
select pg_temp.fora();
insert into portal.client_sessions (usuari_id, session_id, tipus, mfa_at)
select v::uuid, case k when 'u1' then '00000000-0000-0000-0000-00000000e001'::uuid else '00000000-0000-0000-0000-00000000e002'::uuid end, 'acces', now()
from t where k in ('u1', 'u2');
update portal.client_usuaris set estat = 'actiu', activat_at = now(), condicions_versio = 'CONDICIONS-AREA v1', condicions_at = now()
 where id in (select v::uuid from t where k in ('u1', 'u2'));

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Estructura
-- ═════════════════════════════════════════════════════════════════════════════
select ok(exists (select 1 from pg_roles where rolname = 'portal_client' and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls),
  'Rol portal_client: sense login, sense herència, sense superusuari ni BYPASSRLS');
select ok(pg_has_role('authenticator', 'portal_client', 'MEMBER'), 'authenticator pot canviar a portal_client (PostgREST)');
select ok(not pg_has_role('portal_client', 'authenticated', 'MEMBER') and not pg_has_role('portal_client', 'anon', 'MEMBER'),
  'portal_client no és membre d''authenticated ni d''anon');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'portal' and c.relkind = 'r' and (c.relname like 'client\_%' or c.relname = 'config_area_client') and not c.relrowsecurity),
  0, 'RLS a totes les taules noves');
select is((select string_agg(email || ':' || actiu || ':' || (user_id is not null), ',' order by ordre) from portal.client_destinataris),
  'info@ambit.ad:true:true,mpaleari@ambit.ad:true:true,mdelsoto@ambit.ad:false:false', 'Destinataris: info@ i mpaleari@ actius; mdelsoto@ inactiu i sense usuari');
select is((select count(*)::int from unnest(array['public', 'anon', 'authenticated', 'service_role', 'portal_client']) r
            where has_function_privilege(case r when 'public' then 'anon' else r end, 'portal.client_bloquejat_intern(uuid)', 'execute')),
  0, 'client_bloquejat_intern: ningú no la pot executar');
select is((select string_agg(nom, ' | ' order by ordre) from portal.client_destinataris),
  'ÀMBIT Associats (info@ambit.ad) | Martín Paleari | Mariona del Soto', 'Noms dels destinataris');
select is((select versio from portal.client_condicions where vigent), 'CONDICIONS-AREA v1', 'Condicions vigents: CONDICIONS-AREA v1');
select is((select inactivitat from portal.config_area_client), interval '30 minutes', 'Inactivitat: 30 minuts');

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Separació: tots els permisos de portal_client, a tota la base
-- ═════════════════════════════════════════════════════════════════════════════
select is((select string_agg(nspname, ',' order by nspname) from pg_namespace
            where has_schema_privilege('portal_client', oid, 'USAGE') and nspname in ('public', 'portal', 'graphql_public', 'storage', 'auth', 'vault', 'realtime', 'graphql')),
  'portal,public', 'Esquemes exposats o sensibles amb USAGE: només portal i public (cap a auth, storage, vault, graphql, realtime)');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname not in ('pg_catalog', 'information_schema') and c.relkind in ('r', 'v', 'm', 'p', 'f', 'S')
              and has_table_privilege('portal_client', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              and n.nspname in ('public', 'portal', 'storage', 'auth', 'vault', 'graphql_public', 'graphql', 'realtime')),
  0, 'Cap permís de taula sencera a public, portal, storage, auth, vault, graphql ni realtime');
select is((select string_agg(x, ',' order by x) from (
            select distinct c.relname || '(' || (select string_agg(a.attname, ' ' order by a.attname) from pg_attribute a
                    where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                      and has_column_privilege('portal_client', c.oid, a.attnum, 'SELECT,INSERT,UPDATE,REFERENCES')) || ')' as x
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname in ('public', 'portal', 'storage', 'auth', 'vault', 'graphql_public')
              and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                          and has_column_privilege('portal_client', c.oid, a.attnum, 'SELECT,INSERT,UPDATE,REFERENCES'))) s),
  'client_condicions(versio vigent),client_destinataris(actiu email id nom ordre),client_enviaments(assumpte client_id destinatari_id enviat_at estat id n_fitxers),client_vincles(client_id id),clients(id nom_mostrat)',
  'Columnes: només lectura d''aquestes (cap altra columna ni taula)');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
                      where n.nspname in ('public', 'portal') and has_column_privilege('portal_client', c.oid, a.attnum, 'INSERT,UPDATE,REFERENCES')),
  'Cap permís d''escriptura directa');
select is((select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'portal', 'graphql_public', 'storage', 'auth') and has_function_privilege('portal_client', p.oid, 'EXECUTE')
              and has_schema_privilege('portal_client', n.oid, 'USAGE')),
  'client_document_cami,client_documents_llista,client_enviament_crea,client_enviaments_llista,client_inici,client_usuari_actual,client_vinculat',
  'Funcions: només les set de l''àrea de client (cap funció existent de portal ni de public)');
select is((select count(*)::int from (
            select 'T' k, c.oid::text o from pg_class c where has_table_privilege('portal_client', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
            except select 'T', c.oid::text from pg_class c where has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')) s),
  0, 'Fora de l''àrea, portal_client no té cap permís de taula que no tingui ja anon (el que hereta de PUBLIC)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname not in ('pg_catalog', 'information_schema', 'portal')
              and has_function_privilege('portal_client', p.oid, 'EXECUTE') and has_schema_privilege('portal_client', n.oid, 'USAGE')
              and not (has_function_privilege('anon', p.oid, 'EXECUTE') and has_schema_privilege('anon', n.oid, 'USAGE'))),
  0, '… ni cap funció executable fora de portal que no pugui executar anon');
select is((select string_agg(tablename || '.' || policyname, ',' order by tablename) from pg_policies where 'portal_client' = any (roles)),
  'client_condicions.client_select,client_destinataris.client_select,client_enviaments.client_select,client_vincles.client_select,clients.client_select',
  'Polítiques per a portal_client: només les cinc noves');
select is((select count(*)::int from pg_policies p
            where p.schemaname in ('public', 'portal', 'storage') and 'public' = any (p.roles)
              and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = p.schemaname and c.relname = p.tablename
                            and (has_table_privilege('portal_client', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
                                 or exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attnum > 0
                                            and has_column_privilege('portal_client', c.oid, a.attnum, 'SELECT,INSERT,UPDATE'))))),
  0, 'Cap política existent «TO public» s''aplica a una taula on portal_client té permís');

-- Cada taula de public i de portal, com a usuari de client amb sessió aal2 vàlida: permís denegat
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
do $$
declare
  r record;
  n int := 0;
  oberts text := '';
begin
  for r in select schemaname, tablename from pg_tables where schemaname in ('public', 'portal', 'storage')
           and tablename not in ('client_vincles', 'clients', 'client_destinataris', 'client_enviaments', 'client_condicions') loop
    begin
      execute format('select count(*) from %I.%I', r.schemaname, r.tablename);
      oberts := oberts || r.schemaname || '.' || r.tablename || ' ';
    exception when insufficient_privilege then
      n := n + 1;
    end;
  end loop;
  insert into t values ('taules_denegades', n::text), ('taules_obertes', oberts);
end $$;
select pg_temp.fora();
select is((select v from t where k = 'taules_obertes'), '', 'Totes les taules de public, portal i storage (llevat de les cinc de l''àrea) donen permís denegat');
select ok((select v::int from t where k = 'taules_denegades') > 40, 'Comprovades totes (' || (select v from t where k = 'taules_denegades') || ')');

-- Cada funció de portal i public que pot cridar authenticated, com a usuari de client: permís denegat
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
do $$
declare
  r record;
  n int := 0;
  oberts text := '';
begin
  for r in select p.oid::regprocedure as f, p.pronargs, p.proargtypes from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('portal', 'public') and has_function_privilege('authenticated', p.oid, 'EXECUTE') and p.prokind = 'f'
             and p.prorettype <> 'trigger'::regtype loop
    begin
      execute format('select %s(%s)', regexp_replace(r.f::text, '\(.*$', ''),
                     (select coalesce(string_agg('null::' || format_type(x, null), ', '), '') from unnest(r.proargtypes::oid[]) x));
      oberts := oberts || r.f::text || ' ';
    exception when insufficient_privilege then
      n := n + 1;
    when others then
      oberts := oberts || r.f::text || '[' || sqlstate || '] ';
    end;
  end loop;
  insert into t values ('fns_denegades', n::text), ('fns_obertes', oberts);
end $$;
select pg_temp.fora();
select is((select v from t where k = 'fns_obertes'), '', 'Cap de les funcions de portal i public d''authenticated no s''executa com a usuari de client');
select ok((select v::int from t where k = 'fns_denegades') > 60, 'Comprovades totes (' || (select v from t where k = 'fns_denegades') || ')');

-- Si el hook fallés (usuari de client amb el rol authenticated): continua sense cap accés
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001', 'authenticated');
create temp table files_amb_authenticated as
  select 'profiles' t, count(*) n from public.profiles
  union all select 'declaracions', count(*) from public.declaracions
  union all select 'clients', count(*) from portal.clients
  union all select 'requests', count(*) from portal.requests
  union all select 'documents', count(*) from portal.documents
  union all select 'client_usuaris', count(*) from portal.client_usuaris
  union all select 'client_vincles', count(*) from portal.client_vincles
  union all select 'client_enviaments', count(*) from portal.client_enviaments
  union all select 'client_sessions', count(*) from portal.client_sessions
  union all select 'audit_log', count(*) from portal.audit_log
  union all select 'storage', count(*) from storage.objects where bucket_id in ('portal-docs', 'client-enviaments');
select pg_temp.fora();
select is((select sum(n)::int from files_amb_authenticated), 0, 'Amb el rol authenticated (hook fallit): cap fila de cap taula de public, portal ni storage');
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001', 'authenticated');
select throws_ok($$ insert into public.profiles (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'client1@test.local') $$,
  '42501', null, 'Amb el rol authenticated: no pot crear-se una fitxa de la Zona Professionals');
select throws_ok($$ select portal.client_inici() $$, '42501', null, 'Amb el rol authenticated: tampoc entra a l''àrea de client');
select is(portal.is_staff(), false, 'Amb el rol authenticated: no és personal');
select is(public.es_actiu(), false, 'Amb el rol authenticated: no és usuari actiu de la Zona Professionals');
select pg_temp.fora();

-- Només per a les proves: pgTAP és a l'esquema extensions, que portal_client
-- no pot fer servir. Es dona després de comprovar-ne tots els permisos i es
-- desfà amb el rollback del final.
grant usage on schema extensions to portal_client;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Separació a les dades: un compte, un sol tipus
-- ═════════════════════════════════════════════════════════════════════════════
select throws_ok($$ insert into portal.client_usuaris (user_id, nom, email) values ('00000000-0000-0000-0000-0000000000a4', 'Pro', 'pro-ac@test.local') $$,
  '42501', null, 'Un usuari de la Zona Professionals no pot ser usuari de client');
select throws_ok($$ insert into portal.client_usuaris (user_id, nom, email) values ('00000000-0000-0000-0000-0000000000a1', 'Info', 'info@ambit.ad') $$,
  '42501', null, 'Un membre del personal no pot ser usuari de client');
select throws_ok($$ insert into portal.staff_profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000b1', 'gestor') $$,
  '42501', null, 'Un usuari de client no pot ser personal');
select throws_ok($$ insert into public.profiles (id, email, nom) values ('00000000-0000-0000-0000-0000000000b1', 'client1@test.local', 'x') $$,
  '42501', null, 'Un usuari de client no pot tenir fitxa a public.profiles (ni com a postgres)');
select throws_ok($$ update portal.staff_profiles set user_id = '00000000-0000-0000-0000-0000000000b2' where user_id = '00000000-0000-0000-0000-0000000000a3' $$,
  '42501', null, 'Ni canviant el user_id d''una fila existent');
select throws_ok($$ select portal.alta_gestor('00000000-0000-0000-0000-0000000000a2', 'client1@test.local') $$,
  '42501', null, 'L''OCIC no pot donar d''alta com a gestor un usuari de client (alta_gestor)');
select is((select count(*)::int from public.profiles where id in (select user_id from portal.client_usuaris))
        + (select count(*)::int from portal.staff_profiles where user_id in (select user_id from portal.client_usuaris)), 0,
  'Cap usuari de client a profiles ni a staff_profiles');

-- Hook d'Auth
select is(portal.hook_token_client('{"user_id": "00000000-0000-0000-0000-0000000000b1", "claims": {"role": "authenticated", "aal": "aal1"}}') #>> '{claims,role}',
  'portal_client', 'Hook: l''usuari de client rep el rol portal_client');
select is(portal.hook_token_client('{"user_id": "00000000-0000-0000-0000-0000000000a1", "claims": {"role": "authenticated"}}') #>> '{claims,role}',
  'authenticated', 'Hook: el personal no canvia');
select is(portal.hook_token_client('{"user_id": "00000000-0000-0000-0000-0000000000a4", "claims": {"role": "authenticated"}}') #>> '{claims,role}',
  'authenticated', 'Hook: la Zona Professionals no canvia');
select is(portal.hook_token_client('{"user_id": "no-uuid", "claims": {"role": "authenticated"}}') #>> '{claims,role}',
  'authenticated', 'Hook: si falla, retorna les dades sense tocar');
select ok(has_function_privilege('supabase_auth_admin', 'portal.hook_token_client(jsonb)', 'EXECUTE')
          and not has_function_privilege('authenticated', 'portal.hook_token_client(jsonb)', 'EXECUTE')
          and not has_function_privilege('anon', 'portal.hook_token_client(jsonb)', 'EXECUTE'),
  'Hook: només l''executa supabase_auth_admin');

-- El personal i la Zona Professionals no poden fer servir l'àrea
select pg_temp.com('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select portal.client_inici() $$, '42501', null, 'El personal no pot cridar les funcions de l''àrea de client');
select throws_ok($$ select portal.client_usuari_actual() $$, '42501', null, '… ni la funció de sessió');
select pg_temp.fora();
select pg_temp.com('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$ select portal.client_enviaments_llista('00000000-0000-0000-0000-0000000000c1') $$, '42501', null, 'La Zona Professionals tampoc');
select is((select count(*)::int from portal.client_enviaments), 0, 'La Zona Professionals no veu cap enviament');
select pg_temp.fora();
-- Un membre del personal amb el rol portal_client (JWT fals) no és usuari de client
select pg_temp.client('00000000-0000-0000-0000-0000000000a1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select ok(portal.client_usuari_actual() is null, 'Un JWT de portal_client d''un compte que no és de client: cap usuari');
select is((select count(*)::int from portal.clients), 0, '… i cap client');
select pg_temp.fora();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Sessió: aal2, sessió registrada, activa, usuari actiu i condicions
-- ═════════════════════════════════════════════════════════════════════════════
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select is(portal.client_usuari_actual()::text, (select v from t where k = 'u1'), 'Sessió vàlida: usuari actual U1');
select is((select string_agg(nom_mostrat, ',' order by nom_mostrat) from portal.clients), 'Client A,Client B', 'U1 veu només els seus dos clients');
select is((select count(*)::int from portal.client_vincles), 2, 'U1 veu només els seus dos vincles');
select is(portal.client_inici() #>> '{usuari,email}', 'client1@test.local', 'client_inici: l''usuari');
select is((select string_agg(c ->> 'nom', ',' order by c ->> 'nom') from jsonb_array_elements(portal.client_inici() -> 'clients') c),
  'Client A,Client B', 'client_inici: els seus dos clients (estat de bloqueig real, no el de portal.client_bloquejat)');
select throws_ok($$ select referencia_client from portal.clients $$, '42501', null, 'portal.clients: cap altra columna');
select pg_temp.fora();
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal1', '00000000-0000-0000-0000-00000000e001');
select ok(portal.client_usuari_actual() is null, 'aal1: cap usuari');
select is((select count(*)::int from portal.clients) + (select count(*)::int from portal.client_vincles) + (select count(*)::int from portal.client_destinataris), 0, 'aal1: cap fila');
select throws_ok($$ select portal.client_inici() $$, '42501', null, 'aal1: client_inici denegat');
select pg_temp.fora();
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e999');
select ok(portal.client_usuari_actual() is null, 'aal2 amb una sessió no registrada (oberta fora de l''Edge Function): cap usuari');
select pg_temp.fora();
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e002');
select ok(portal.client_usuari_actual() is null, 'La sessió d''un altre usuari: cap usuari');
select pg_temp.fora();
update portal.client_sessions set mfa_at = null where session_id = '00000000-0000-0000-0000-00000000e001';
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select ok(portal.client_usuari_actual() is null, 'Sessió sense segon factor verificat per l''Edge Function: cap usuari');
select pg_temp.fora();
update portal.client_sessions set mfa_at = now(), ultima_activitat = now() - interval '31 minutes' where session_id = '00000000-0000-0000-0000-00000000e001';
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select ok(portal.client_usuari_actual() is null, '31 minuts sense activitat: cap usuari');
select pg_temp.fora();
select is(portal.client_estat_sessio('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000e001') ->> 'motiu', 'inactivitat', 'client_estat_sessio: inactivitat');
select is((select motiu_tancament from portal.client_sessions where session_id = '00000000-0000-0000-0000-00000000e001'), 'inactivitat', '… i la sessió queda tancada');
select is(portal.client_estat_sessio('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000e001') ->> 'motiu', 'sessio', 'Una sessió tancada no es reobre');
update portal.client_sessions set tancada_at = null, motiu_tancament = null, ultima_activitat = now() where session_id = '00000000-0000-0000-0000-00000000e001';
update portal.client_usuaris set bloquejat_fins = now() + interval '10 minutes' where id = (select v::uuid from t where k = 'u1');
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select ok(portal.client_usuari_actual() is null, 'Accés bloquejat per intents fallits: cap usuari');
select pg_temp.fora();
update portal.client_usuaris set bloquejat_fins = null where id = (select v::uuid from t where k = 'u1');
insert into portal.client_condicions (versio) values ('CONDICIONS-AREA v2');
update portal.client_condicions set vigent = false where versio = 'CONDICIONS-AREA v1';
update portal.client_condicions set vigent = true where versio = 'CONDICIONS-AREA v2';
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select ok(portal.client_usuari_actual() is null, 'Condicions noves sense acceptar: cap accés');
select pg_temp.fora();
select is(portal.client_estat_sessio('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000e001') ->> 'motiu', 'condicions', 'client_estat_sessio: cal acceptar les condicions');
select throws_ok($$ select portal.client_registra_acceptacio('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000e001', 'CONDICIONS-AREA v1', null, null) $$,
  '23514', null, 'Només s''accepta la versió vigent');
select lives_ok($$ select portal.client_registra_acceptacio('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000e001', 'CONDICIONS-AREA v2', null, null) $$,
  'Accepta la versió nova');
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select is(portal.client_usuari_actual()::text, (select v from t where k = 'u1'), 'Amb la versió nova acceptada, torna a tenir accés');
select pg_temp.fora();
update portal.client_condicions set vigent = false where versio = 'CONDICIONS-AREA v2';
update portal.client_condicions set vigent = true where versio = 'CONDICIONS-AREA v1';
update portal.client_usuaris set condicions_versio = 'CONDICIONS-AREA v1' where condicions_versio = 'CONDICIONS-AREA v2';
select throws_ok($$ update portal.client_condicions set vigent = true where versio = 'CONDICIONS-AREA v2' $$, '23505', null, 'Una sola versió vigent');

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Enllaços d'activació i de restabliment
-- ═════════════════════════════════════════════════════════════════════════════
select pg_temp.servei();
insert into t values ('u3', portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 'Usuari U3', 'client3@test.local', '00000000-0000-0000-0000-0000000000b3')::text);
select throws_ok($$ select portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000c1', 'X', 'lliure@test.local', '00000000-0000-0000-0000-0000000000b9') $$,
  '42501', null, 'Només el personal dona d''alta usuaris');
select throws_ok($$ select portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'X', 'altre@test.local', '00000000-0000-0000-0000-0000000000b9') $$,
  '22023', null, 'El compte ha de correspondre al correu');
select lives_ok($$ select portal.client_crea_token('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u3'), 'invitacio', repeat('a', 64), now() + interval '7 days') $$,
  'Invitació (7 dies)');
select throws_ok($$ select portal.client_crea_token('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u3'), 'invitacio', repeat('b', 64), now() + interval '8 days') $$,
  '22023', null, 'Més de 7 dies: rebutjat');
select throws_ok($$ select portal.client_crea_token('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u3'), 'restabliment', repeat('b', 64), now() + interval '7 days') $$,
  '42501', null, 'No es restableix un usuari que no s''ha activat');
select throws_ok($$ select portal.client_crea_token('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u1'), 'invitacio', repeat('b', 64), now() + interval '7 days') $$,
  '42501', null, 'No es convida un usuari ja activat');
select is(portal.client_obre_token(repeat('a', 64)) ->> 'motiu', 'invitacio', 'L''enllaç és vàlid');
select lives_ok($$ select portal.client_crea_token('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u3'), 'invitacio', repeat('c', 64), now() + interval '7 days') $$,
  'Enllaç nou');
select ok(portal.client_obre_token(repeat('a', 64)) is null, 'L''enllaç nou revoca l''anterior');
select throws_ok($$ select portal.client_consumeix_token(repeat('c', 64), '00000000-0000-0000-0000-00000000e003', 'CONDICIONS-AREA v0', null, null) $$,
  '23514', null, 'Sense acceptar les condicions vigents: no s''activa');
select lives_ok($$ select portal.client_consumeix_token(repeat('c', 64), '00000000-0000-0000-0000-00000000e003', 'CONDICIONS-AREA v1', null, null) $$,
  'Es consumeix amb la versió vigent');
select ok(portal.client_obre_token(repeat('c', 64)) is null, 'D''un sol ús: ja no és vàlid');
select throws_ok($$ select portal.client_consumeix_token(repeat('c', 64), '00000000-0000-0000-0000-00000000e004', 'CONDICIONS-AREA v1', null, null) $$,
  '42501', null, 'No es pot consumir dues vegades');
select is((select estat::text from portal.client_usuaris where id = (select v::uuid from t where k = 'u3')), 'pendent', 'Fins que no configura el segon factor, continua pendent');
select throws_ok($$ select portal.client_obre_sessio((select v::uuid from t where k = 'u3'), '00000000-0000-0000-0000-00000000e005', null, null) $$,
  '42501', null, 'Pendent: no pot obrir cap sessió d''accés');
select throws_ok($$ select portal.client_completa_activacio('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000e999') $$,
  '42501', null, 'Només la sessió d''activació pot completar l''activació');
select lives_ok($$ select portal.client_completa_activacio('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000e003') $$,
  'Activació completa (l''Edge Function ha comprovat aal2 i el TOTP)');
select is((select estat::text || ' ' || (activat_at is not null) || ' ' || (sessio_activacio is null) from portal.client_usuaris where id = (select v::uuid from t where k = 'u3')),
  'actiu true true', 'Usuari actiu');
select pg_temp.fora();
select is((select count(*)::int from portal.client_acceptacions where usuari_id = (select v::uuid from t where k = 'u3') and versio = 'CONDICIONS-AREA v1'), 1,
  'Versió acceptada i data registrades');
select pg_temp.servei();
select lives_ok($$ select portal.client_crea_token('00000000-0000-0000-0000-0000000000a3', (select v::uuid from t where k = 'u3'), 'restabliment', repeat('d', 64), now() + interval '7 days') $$,
  'Restabliment');
select pg_temp.fora();
update portal.client_tokens set expira_at = now() - interval '1 second' where token_hash = repeat('d', 64);
select pg_temp.servei();
select ok(portal.client_obre_token(repeat('d', 64)) is null, 'Enllaç caducat: no vàlid');
select throws_ok($$ select portal.client_consumeix_token(repeat('d', 64), '00000000-0000-0000-0000-00000000e006', 'CONDICIONS-AREA v1', null, null) $$,
  '42501', null, 'Enllaç caducat: no es consumeix');
select pg_temp.fora();

-- Intents fallits
select pg_temp.servei();
select portal.client_registra_fallada((select v::uuid from t where k = 'u3'), 'contrasenya', null, null) from generate_series(1, 4);
select ok((select bloquejat_fins from portal.client_usuaris where id = (select v::uuid from t where k = 'u3')) is null, '4 intents fallits: encara no bloqueja');
select ok(portal.client_registra_fallada((select v::uuid from t where k = 'u3'), 'codi', null, null) is not null, 'Al 5è, bloqueja');
select ok((portal.client_prepara_acces('client3@test.local') ->> 'bloquejat_fins') is not null, 'client_prepara_acces informa del bloqueig');
select throws_ok($$ select portal.client_obre_sessio((select v::uuid from t where k = 'u3'), '00000000-0000-0000-0000-00000000e007', null, null) $$,
  '42501', null, 'Bloquejat: no pot obrir cap sessió');
select pg_temp.fora();
select is((select count(*)::int from portal.audit_log where accio = 'ACCES_FALLIT' and entitat_id = (select v::uuid from t where k = 'u3')), 5, 'Els intents fallits queden a audit_log');
update portal.client_usuaris set bloquejat_fins = null where id = (select v::uuid from t where k = 'u3');

-- Suspendre i revocar
select pg_temp.servei();
select is(portal.client_canvia_estat('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u2'), 'suspen'), '00000000-0000-0000-0000-0000000000b2'::uuid, 'Suspendre U2');
select pg_temp.fora();
select pg_temp.client('00000000-0000-0000-0000-0000000000b2', 'aal2', '00000000-0000-0000-0000-00000000e002');
select ok(portal.client_usuari_actual() is null, 'Suspès: cap accés');
select pg_temp.fora();
select pg_temp.servei();
select lives_ok($$ select portal.client_canvia_estat('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u2'), 'reactiva') $$, 'Reactivar');
select is((select estat::text from portal.client_usuaris where id = (select v::uuid from t where k = 'u2')), 'actiu', 'Torna a ser actiu');
select lives_ok($$ select portal.client_canvia_estat('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u2'), 'revoca') $$, 'Revocar');
select throws_ok($$ select portal.client_canvia_estat('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'u2'), 'reactiva') $$, '42501', null, 'Revocat: no es reactiva');
select throws_ok($$ select portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'U2', 'client2@test.local') $$, '42501', null, 'Revocat: no es torna a vincular');
select pg_temp.fora();
select is((select count(*)::int from portal.client_vincles where usuari_id = (select v::uuid from t where k = 'u2') and baixa_at is null)
        + (select count(*)::int from portal.client_sessions where usuari_id = (select v::uuid from t where k = 'u2') and tancada_at is null), 0,
  'Revocat: sense vincles ni sessions obertes');
select ok(exists (select 1 from portal.audit_log where entitat = 'client_usuaris' and entitat_id = (select v::uuid from t where k = 'u2') and detalls -> 'canvis' -> 'estat' ->> 'despres' = 'revocat'),
  'Revocació a audit_log');

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Enviaments
-- ═════════════════════════════════════════════════════════════════════════════
select throws_ok($$ update portal.client_destinataris set actiu = true where email = 'mdelsoto@ambit.ad' $$, '23514', null,
  'mdelsoto@ no es pot activar sense usuari al portal (restricció de la base)');
select throws_ok($$ update portal.client_destinataris set actiu = true, user_id = '00000000-0000-0000-0000-0000000000b9' where email = 'mdelsoto@ambit.ad' $$, '23514', null,
  '… ni amb un compte que no és personal del portal');
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select is((select string_agg(email || ':' || (d ->> 'disponible'), ',' order by d ->> 'email') from jsonb_array_elements(portal.client_inici() -> 'destinataris') d, lateral (select d ->> 'email' as email) e),
  'info@ambit.ad:true,mdelsoto@ambit.ad:false,mpaleari@ambit.ad:true', 'mdelsoto@ visible però no disponible');
select throws_ok($$ select portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'mdelsoto@ambit.ad'), 'x', null, '[{"nom": "a.pdf", "extensio": "pdf", "mida": 10}]') $$,
  '23514', null, 'Destinatari inactiu: no es pot triar');
select throws_ok($$ select portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c3', (select id from portal.client_destinataris where email = 'info@ambit.ad'), 'x', null, '[{"nom": "a.pdf", "extensio": "pdf", "mida": 10}]') $$,
  '42501', null, 'Client no vinculat: denegat');
select throws_ok($$ select portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'info@ambit.ad'), ' ', null, '[{"nom": "a.pdf", "extensio": "pdf", "mida": 10}]') $$,
  '23514', null, 'Assumpte obligatori');
select throws_ok($$ select portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'info@ambit.ad'), repeat('x', 121), null, '[{"nom": "a.pdf", "extensio": "pdf", "mida": 10}]') $$,
  '23514', null, 'Assumpte de més de 120 caràcters');
select throws_ok($$ select portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'info@ambit.ad'), 'x', null, '[{"nom": "a.zip", "extensio": "zip", "mida": 10}]') $$,
  '23514', null, 'ZIP: no admès');
select throws_ok($$ select portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'info@ambit.ad'), 'x', null, '[{"nom": "a.pdf", "extensio": "pdf", "mida": 20971521}]') $$,
  '23514', null, 'Més de 20 MB per fitxer');
select throws_ok($$ select portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'info@ambit.ad'), 'x', null,
  (select jsonb_agg(jsonb_build_object('nom', 'a.pdf', 'extensio', 'pdf', 'mida', 20000000)) from generate_series(1, 6))) $$,
  '23514', null, 'Més de 100 MB per enviament');
insert into t values ('e_info', portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'info@ambit.ad'), 'Factures', 'Comentari', '[{"nom": "a.pdf", "extensio": "pdf", "mida": 10}, {"nom": "b.docx", "extensio": "docx", "mida": 20}]') ->> 'enviament_id');
insert into t values ('e_mpa', portal.client_enviament_crea('00000000-0000-0000-0000-0000000000c1', (select id from portal.client_destinataris where email = 'mpaleari@ambit.ad'), 'Per a mpaleari', null, '[{"nom": "c.csv", "extensio": "csv", "mida": 10}]') ->> 'enviament_id');
select is((select count(*)::int from portal.client_enviaments), 0, 'Mentre es pugen els fitxers, l''enviament no surt a la llista');
select pg_temp.fora();
select is((select string_agg(storage_path, ',' order by ordre) ~ '^enviaments/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf,enviaments/[0-9a-f-]{36}/[0-9a-f-]{36}\.docx$'
             from portal.client_enviament_fitxers where enviament_id = (select v::uuid from t where k = 'e_info')), true, 'Camins amb identificadors (sense el nom del fitxer)');
select pg_temp.servei();
select throws_ok($$ select portal.client_enviament_registra('00000000-0000-0000-0000-0000000000b3', (select v::uuid from t where k = 'e_info'), '[]') $$,
  '42501', null, 'Un altre usuari no pot registrar l''enviament');
select throws_ok($$ select portal.client_enviament_registra('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'e_info'),
  (select jsonb_agg(jsonb_build_object('id', id, 'sha256', repeat('1', 64), 'mida', 10)) from portal.client_enviament_fitxers where enviament_id = (select v::uuid from t where k = 'e_info') and ordre = 1)) $$,
  '23514', null, 'Cal verificar tots els fitxers');
select is(portal.client_enviament_registra('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'e_info'),
  (select jsonb_agg(jsonb_build_object('id', id, 'sha256', repeat('1', 64), 'mida', 10)) from portal.client_enviament_fitxers where enviament_id = (select v::uuid from t where k = 'e_info'))),
  'INFO', 'Registrat: retorna la clau de Formspree d''info@');
select is(portal.client_enviament_registra('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'e_mpa'),
  (select jsonb_agg(jsonb_build_object('id', id, 'sha256', repeat('2', 64), 'mida', 10)) from portal.client_enviament_fitxers where enviament_id = (select v::uuid from t where k = 'e_mpa'))),
  'MPALEARI', '… i la de mpaleari@');
select pg_temp.fora();
select throws_ok($$ update portal.client_enviament_fitxers set sha256 = repeat('3', 64) where enviament_id = (select v::uuid from t where k = 'e_info') $$,
  '42501', null, 'L''empremta d''un fitxer verificat no es modifica');
select throws_ok($$ update portal.client_enviaments set assumpte = 'canviat' where id = (select v::uuid from t where k = 'e_info') $$,
  '42501', null, 'Les dades d''un enviament no es modifiquen');
select throws_ok($$ update portal.client_enviaments set estat = 'pujant' where id = (select v::uuid from t where k = 'e_info') $$,
  '42501', null, 'Transició no permesa');

-- Opció B: només el destinatari i l'OCIC
select pg_temp.com('00000000-0000-0000-0000-0000000000a1');
select is((select string_agg(assumpte, ',') from portal.client_enviaments), 'Factures', 'info@ només veu el seu');
select is((select count(*)::int from portal.client_enviament_fitxers), 2, '… i només els seus fitxers');
select throws_ok($$ select portal.client_enviament_arxiva((select v::uuid from t where k = 'e_mpa')) $$, '42501', null, 'info@ no arxiva el de mpaleari@');
select pg_temp.fora();
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from portal.client_enviaments) + (select count(*)::int from portal.client_enviament_fitxers), 0, 'Un gestor que no és destinatari no en veu cap');
select pg_temp.fora();
select pg_temp.com('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from portal.client_enviaments), 2, 'L''OCIC els veu tots');
select pg_temp.fora();
select pg_temp.com('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select portal.client_enviament_arxiva((select v::uuid from t where k = 'e_info')) $$, '«Descarregat i arxivat» pel destinatari');
select pg_temp.fora();
select is((select estat::text || ' ' || (arxivat_per = '00000000-0000-0000-0000-0000000000a1') from portal.client_enviaments where id = (select v::uuid from t where k = 'e_info')), 'arxivat true', 'Qui i quan');
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select is((select string_agg(e ->> 'estat', ',' order by e ->> 'assumpte') from jsonb_array_elements(portal.client_enviaments_llista('00000000-0000-0000-0000-0000000000c1')) e),
  'rebut,enviat', 'El client veu «Rebut per ÀMBIT» (arxivat) i «Enviat»');
select throws_ok($$ select comentari from portal.client_enviaments $$, '42501', null, 'El client no llegeix el comentari directament');
select pg_temp.fora();
select pg_temp.client('00000000-0000-0000-0000-0000000000b3', 'aal2', '00000000-0000-0000-0000-00000000e003');
select is(jsonb_array_length(portal.client_enviaments_llista('00000000-0000-0000-0000-0000000000c2')), 0, 'Un altre usuari no veu els enviaments d''U1');
select throws_ok($$ select portal.client_enviaments_llista('00000000-0000-0000-0000-0000000000c1') $$, '42501', null, 'Ni d''un client al qual no està vinculat');
select pg_temp.fora();

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. Els meus documents: només els quatre tipus, mai interns ni IRPF
-- ═════════════════════════════════════════════════════════════════════════════
select is((select string_agg(t || '/' || k, ',' order by t, k) from unnest(enum_range(null::portal.document_type)) t, unnest(enum_range(null::portal.doc_kind)) k
            where portal.client_document_permes(t, k)),
  'autoritzacio_carrec/signat,kyc_pf/copia_client,kyc_pj/copia_client,pdp/signat,contracte/signat',
  'Combinacions permeses: autorització, còpia per al client del KYC, protecció de dades i contracte final');
set local session_replication_role = replica;
insert into portal.requests (id, client_id, document_type, template_version, idioma, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'kyc_pj', 'X', 'ca', 'actiu'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'irpf_comunicacio', 'X', 'ca', 'actiu'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', 'contracte', 'X', 'ca', 'signat'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', 'autoritzacio_carrec', 'X', 'ca', 'anullat'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c3', 'pdp', 'X', 'ca', 'signat');
insert into portal.documents (id, request_id, kind, storage_path, sha256, mida_bytes, mime) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1', 'copia_client', 'requests/d1/a.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000d1', 'validat',      'requests/d1/b.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000d1', 'signat',       'requests/d1/c.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000d2', 'intern',       'requests/d2/a.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000d2', 'signat',       'requests/d2/b.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000d3', 'signat',       'requests/d3/a.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000d3', 'original',     'requests/d3/b.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000d4', 'signat',       'requests/d4/a.pdf', repeat('0', 64), 1, 'application/pdf'),
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000d5', 'signat',       'requests/d5/a.pdf', repeat('0', 64), 1, 'application/pdf');
set local session_replication_role = origin;
select pg_temp.client('00000000-0000-0000-0000-0000000000b1', 'aal2', '00000000-0000-0000-0000-00000000e001');
select is((select string_agg(d ->> 'id', ',' order by d ->> 'id') from jsonb_array_elements(portal.client_documents_llista('00000000-0000-0000-0000-0000000000c1')) d),
  '00000000-0000-0000-0000-0000000000f1,00000000-0000-0000-0000-0000000000f6', 'Client A: la còpia per al client del KYC i el contracte final; res més');
select is(portal.client_document_cami('00000000-0000-0000-0000-0000000000f6') ->> 'storage_path', 'requests/d3/a.pdf', 'Camí del contracte final');
select throws_ok($$ select portal.client_document_cami('00000000-0000-0000-0000-0000000000f2') $$, 'P0002', null, 'Mai la versió interna del KYC (validat)');
select throws_ok($$ select portal.client_document_cami('00000000-0000-0000-0000-0000000000f4') $$, 'P0002', null, 'Mai el full intern de l''IRPF');
select throws_ok($$ select portal.client_document_cami('00000000-0000-0000-0000-0000000000f5') $$, 'P0002', null, 'Mai cap comunicació IRPF');
select throws_ok($$ select portal.client_document_cami('00000000-0000-0000-0000-0000000000f8') $$, 'P0002', null, 'Ni sol·licituds anul·lades');
select throws_ok($$ select portal.client_document_cami('00000000-0000-0000-0000-0000000000f9') $$, 'P0002', null, 'Ni documents d''un client no vinculat');
select throws_ok($$ select portal.client_documents_llista('00000000-0000-0000-0000-0000000000c3') $$, '42501', null, 'Ni la llista d''un client no vinculat');
select throws_ok($$ select * from portal.documents $$, '42501', null, 'Ni portal.documents directament');
select pg_temp.fora();
select is((select count(*)::int from portal.audit_log where accio = 'DESCARREGA_CLIENT' and entitat_id = '00000000-0000-0000-0000-0000000000f6'), 1, 'La descàrrega queda registrada');

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. Conservació
-- ═════════════════════════════════════════════════════════════════════════════
set local session_replication_role = replica;
update portal.client_enviaments set arxivat_at = now() - interval '31 days', created_at = now() - interval '35 days' where id = (select v::uuid from t where k = 'e_info');
update portal.client_enviaments set created_at = now() - interval '89 days' where id = (select v::uuid from t where k = 'e_mpa');
set local session_replication_role = origin;
select pg_temp.servei();
select is((select string_agg(causa, ',') from portal.client_enviaments_a_destruir() where enviament_id in (select v::uuid from t where k in ('e_info', 'e_mpa'))),
  'arxivat', 'Arxivat fa 31 dies: a destruir; rebut fa 89 dies sense arxivar: encara no');
select pg_temp.fora();
set local session_replication_role = replica;
update portal.client_enviaments set created_at = now() - interval '91 days' where id = (select v::uuid from t where k = 'e_mpa');
set local session_replication_role = origin;
select pg_temp.servei();
select is((select causa from portal.client_enviaments_a_destruir() where enviament_id = (select v::uuid from t where k = 'e_mpa')),
  'termini màxim', 'Rebut fa 91 dies: a destruir (termini màxim, encara que no s''hagi arxivat)');
select pg_temp.fora();
set local session_replication_role = replica;
update portal.client_enviaments set created_at = now() - interval '89 days' where id = (select v::uuid from t where k = 'e_mpa');
set local session_replication_role = origin;
set local session_replication_role = replica;
update portal.client_enviaments set arxivat_at = now() - interval '29 days' where id = (select v::uuid from t where k = 'e_info');
set local session_replication_role = origin;
select is((select count(*)::int from portal.client_venciments_enviaments(now()) where enviament_id = (select v::uuid from t where k = 'e_info') and vencut_el <= now()), 0,
  'Arxivat fa 29 dies: encara no');
set local session_replication_role = replica;
update portal.client_enviaments set arxivat_at = now() - interval '31 days' where id = (select v::uuid from t where k = 'e_info');
set local session_replication_role = origin;
select pg_temp.servei();
select lives_ok($$ select portal.client_destrueix_enviament((select v::uuid from t where k = 'e_info')) $$, 'Destrucció de l''enviament vençut');
select throws_ok($$ select portal.client_destrueix_enviament((select v::uuid from t where k = 'e_mpa')) $$, '42501', null,
  'Un enviament no vençut (rebut fa 89 dies) no es destrueix');
select pg_temp.fora();
select is((select estat::text || '|' || coalesce(usuari_id::text, '') || coalesce(client_id::text, '') || coalesce(assumpte, '') || coalesce(comentari, '') || '|' || n_fitxers
             from portal.client_enviaments where id = (select v::uuid from t where k = 'e_info')), 'destruit||2', 'Registre mínim: estat, dates i nombre de fitxers');
select is((select count(*)::int from portal.client_enviament_fitxers where enviament_id = (select v::uuid from t where k = 'e_info') and nom_fitxer is null and storage_path is null and sha256 is not null), 2,
  'Fitxers: sense nom ni camí; es conserven les empremtes');
select is((select count(*)::int from portal.audit_log where entitat in ('client_enviaments', 'client_enviament_fitxers')
             and entitat_id in (select (select v::uuid from t where k = 'e_info') union all select id from portal.client_enviament_fitxers where enviament_id = (select v::uuid from t where k = 'e_info'))
             and accio <> 'DESTRUCCIO' and detalls is distinct from '{"purgat": true}'::jsonb), 0, 'audit_log: detalls purgats');
select ok((select detalls::text !~ '(Factures|Comentari|a\.pdf|client1|Usuària)' and (detalls ->> 'n_fitxers')::int = 2
             from portal.audit_log where accio = 'DESTRUCCIO' and entitat = 'client_enviaments' and entitat_id = (select v::uuid from t where k = 'e_info')),
  'Entrada DESTRUCCIO sense dades personals');
select throws_ok($$ update portal.client_enviament_fitxers set nom_fitxer = null where enviament_id = (select v::uuid from t where k = 'e_mpa') $$, '42501', null,
  'Fora de la destrucció, ningú buida un fitxer');

-- Usuaris revocats (U2, revocat a la secció 5): termini_revocats
select pg_temp.servei();
select is((select count(*)::int from portal.client_usuaris_a_destruir()), 0, 'Revocat avui: encara no es destrueix');
select pg_temp.fora();
set local session_replication_role = replica;
update portal.client_usuaris set revocat_at = now() - interval '3 years 1 day' where id = (select v::uuid from t where k = 'u2');
set local session_replication_role = origin;
select pg_temp.servei();
select lives_ok($$ select portal.client_destrueix_usuari((select v::uuid from t where k = 'u2')) $$, 'Revocat fa més de 3 anys: es destrueix');
select pg_temp.fora();
select is((select count(*)::int from portal.client_usuaris where id = (select v::uuid from t where k = 'u2'))
        + (select count(*)::int from portal.client_sessions where usuari_id = (select v::uuid from t where k = 'u2'))
        + (select count(*)::int from portal.client_vincles where usuari_id = (select v::uuid from t where k = 'u2')), 0,
  'Dades, vincles i registre d''accessos esborrats');
select is((select count(*)::int from portal.client_comptes_a_esborrar where user_id = '00000000-0000-0000-0000-0000000000b2'), 1, 'Compte d''Auth pendent d''esborrar');
select is((select count(*)::int from portal.audit_log where entitat_id = (select v::uuid from t where k = 'u2') and accio <> 'DESTRUCCIO' and detalls is distinct from '{"purgat": true}'::jsonb), 0,
  'audit_log de l''usuari purgat');

-- destrueix_solicitud amb vincles de l'àrea de client (regla existent ampliada)
insert into portal.clients (id, party_type, nom_mostrat) values ('00000000-0000-0000-0000-0000000000c9', 'pf', 'Client per destruir');
set local session_replication_role = replica;
insert into portal.requests (id, client_id, document_type, template_version, idioma, status)
  values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000c9', 'autoritzacio_carrec', 'X', 'ca', 'anullat');
set local session_replication_role = origin;
select pg_temp.servei();
select portal.client_usuari_afegeix('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c9', 'Usuari U3', 'client3@test.local');
select pg_temp.fora();
set local session_replication_role = replica;
update portal.requests set bloquejat_at = now() - interval '4 years', destruir_despres_de = now() - interval '1 day' where id = '00000000-0000-0000-0000-0000000000d9';
set local session_replication_role = origin;
select pg_temp.servei();
select lives_ok($$ select portal.destrueix_solicitud('00000000-0000-0000-0000-0000000000d9') $$, 'destrueix_solicitud d''un client amb vincles de l''àrea de client');
select pg_temp.fora();
select is((select count(*)::int from portal.clients where id = '00000000-0000-0000-0000-0000000000c9')
        + (select count(*)::int from portal.client_vincles where client_id = '00000000-0000-0000-0000-0000000000c9'), 0, 'El client i els seus vincles s''han esborrat');

-- Regles existents intactes
select ok(has_function_privilege('authenticated', 'portal.client_bloquejat(uuid)', 'EXECUTE') and has_function_privilege('service_role', 'portal.client_bloquejat(uuid)', 'EXECUTE'),
  'portal.client_bloquejat (existent) conserva els permisos');
select ok(not has_function_privilege('authenticated', 'portal.destrueix_solicitud(uuid, int)', 'EXECUTE')
          and has_function_privilege('service_role', 'portal.destrueix_solicitud(uuid, int)', 'EXECUTE')
          and (select proowner::regrole::text from pg_proc where oid = 'portal.destrueix_solicitud(uuid, int)'::regprocedure) = 'portal_purga',
  'destrueix_solicitud: mateix propietari i permisos');
select ok(not exists (select 1 from pg_auth_members where roleid = 'portal_purga'::regrole and member = 'postgres'::regrole and (set_option or inherit_option)),
  'postgres ja no pot actuar com a portal_purga (sense SET ni INHERIT)');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'portal' and p.proname like 'client\_%' and (has_function_privilege('anon', p.oid, 'EXECUTE'))),
  'anon no pot executar cap funció de l''àrea de client');

select * from finish();
rollback;
