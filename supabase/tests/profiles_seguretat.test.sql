-- Proves de seguretat de public.profiles i public.declaracions
-- Execució local: supabase test db
begin;
select plan(49);

-- ─── Dades de prova (com a postgres) ────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'maestro@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'maestro2@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'maestro-bloquejat@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'actiu@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'pendent@test.local'),
  ('00000000-0000-0000-0000-0000000000b3', 'bloquejat@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'nou@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'nou2@test.local');

insert into public.profiles (id, email, rol, estat, eines) values
  ('00000000-0000-0000-0000-0000000000a1', 'maestro@test.local',   'maestro',    'actiu',     '{irpf,bretxa}'),
  ('00000000-0000-0000-0000-0000000000a2', 'maestro2@test.local',  'maestro',    'actiu',     '{irpf}'),
  ('00000000-0000-0000-0000-0000000000a3', 'maestro-bloquejat@test.local', 'maestro', 'bloquejat', '{irpf}'),
  ('00000000-0000-0000-0000-0000000000b1', 'actiu@test.local',     'individual', 'actiu',     '{irpf}'),
  ('00000000-0000-0000-0000-0000000000b2', 'pendent@test.local',   'individual', 'pendent',   '{}'),
  ('00000000-0000-0000-0000-0000000000b3', 'bloquejat@test.local', 'individual', 'bloquejat', '{irpf}');

insert into public.declaracions (id, user_id, client_nom) values
  ('d-actiu',     '00000000-0000-0000-0000-0000000000b1', 'A'),
  ('d-pendent',   '00000000-0000-0000-0000-0000000000b2', 'P'),
  ('d-bloquejat', '00000000-0000-0000-0000-0000000000b3', 'B');

insert into public.solicituds (id, nom, email, eines) values
  ('00000000-0000-0000-0000-00000000f001', 'Sol 1', 'sol1@test.local', '{irpf}'),
  ('00000000-0000-0000-0000-00000000f002', 'Sol 2', 'sol2@test.local', '{bretxa}');

create function pg_temp.com(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ─── 1. Usuari actiu sobre la seva fitxa ────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000b1', 'actiu@test.local');

select lives_ok(
  $$ update public.profiles set capcalera = '{"nom":"Despatx"}' where id = auth.uid() $$,
  'Usuari pot desar la seva capcalera');
select throws_ok(
  $$ update public.profiles set estat = 'bloquejat' where id = auth.uid() $$,
  '42501', null, 'Usuari no pot canviar el seu estat');
select throws_ok(
  $$ update public.profiles set eines = '{irpf,bretxa}' where id = auth.uid() $$,
  '42501', null, 'Usuari no pot canviar les seves eines');
select throws_ok(
  $$ update public.profiles set rol = 'empresa' where id = auth.uid() $$,
  '42501', null, 'Usuari no pot canviar el seu rol');
select throws_ok(
  $$ update public.profiles set empresa_id = '00000000-0000-0000-0000-0000000000a1' where id = auth.uid() $$,
  '42501', null, 'Usuari no pot canviar la seva empresa');
select throws_ok(
  $$ update public.profiles set email = 'altre@test.local' where id = auth.uid() $$,
  '42501', null, 'Usuari no pot canviar el seu correu');
select throws_ok(
  $$ delete from public.profiles where id = auth.uid() $$,
  '42501', null, 'Usuari no pot esborrar la seva fitxa');
select is(
  (select count(*)::int from public.profiles), 1,
  'Usuari només veu la seva fitxa');
update public.profiles set capcalera = '{"x":1}' where id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is(
  (select capcalera from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), null,
  'Usuari no pot modificar la capcalera d''un altre');

-- ─── 2. Usuari pendent no es pot autoactivar ────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000b2', 'pendent@test.local');
select throws_ok(
  $$ update public.profiles set estat = 'actiu' where id = auth.uid() $$,
  '42501', null, 'Usuari pendent no es pot activar');
select throws_ok(
  $$ update public.profiles set eines = '{irpf}' where id = auth.uid() $$,
  '42501', null, 'Usuari pendent no es pot donar eines');
reset role;

-- ─── 3. Creació de la pròpia fitxa ──────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000c2', 'nou2@test.local');
select throws_ok(
  $$ insert into public.profiles (id, email, estat) values (auth.uid(), 'nou2@test.local', 'actiu') $$,
  '42501', null, 'No es pot crear la fitxa ja activa');
select throws_ok(
  $$ insert into public.profiles (id, email, eines) values (auth.uid(), 'nou2@test.local', '{irpf}') $$,
  '42501', null, 'No es pot crear la fitxa amb eines');
select throws_ok(
  $$ insert into public.profiles (id, email, rol) values (auth.uid(), 'nou2@test.local', 'maestro') $$,
  '42501', null, 'No es pot crear la fitxa amb rol');
select throws_ok(
  $$ insert into public.profiles (id, email) values (auth.uid(), 'maestro@test.local') $$,
  '42501', null, 'No es pot crear la fitxa amb un correu que no és el seu');
select throws_ok(
  $$ insert into public.profiles (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'nou2@test.local') $$,
  '42501', null, 'No es pot crear la fitxa d''un altre');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000c1', 'nou@test.local');
select lives_ok(
  $$ insert into public.profiles (id, email, nom) values (auth.uid(), 'nou@test.local', 'Nou') $$,
  'Usuari nou pot crear la seva fitxa mínima');
select results_eq(
  $$ select rol, estat, eines, empresa_id from public.profiles where id = auth.uid() $$,
  $$ values ('individual'::text, 'pendent'::text, '{}'::text[], null::uuid) $$,
  'La fitxa nova queda individual, pendent, sense eines ni empresa');
reset role;

-- ─── 4. Declaracions: pendent i bloquejat no hi accedeixen ──────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000b2', 'pendent@test.local');
select is((select count(*)::int from public.declaracions), 0, 'Pendent no llegeix declaracions');
select throws_ok(
  $$ insert into public.declaracions (user_id, client_nom) values (auth.uid(), 'X') $$,
  '42501', null, 'Pendent no crea declaracions');
update public.declaracions set client_nom = 'canviat' where id = 'd-pendent';
delete from public.declaracions where id = 'd-pendent';
reset role;
select is((select client_nom from public.declaracions where id = 'd-pendent'), 'P',
  'Pendent no modifica ni esborra declaracions');

select pg_temp.com('00000000-0000-0000-0000-0000000000b3', 'bloquejat@test.local');
select is((select count(*)::int from public.declaracions), 0, 'Bloquejat no llegeix declaracions');
select throws_ok(
  $$ insert into public.declaracions (user_id, client_nom) values (auth.uid(), 'X') $$,
  '42501', null, 'Bloquejat no crea declaracions');
update public.declaracions set client_nom = 'canviat' where id = 'd-bloquejat';
delete from public.declaracions where id = 'd-bloquejat';
reset role;
select is((select client_nom from public.declaracions where id = 'd-bloquejat'), 'B',
  'Bloquejat no modifica ni esborra declaracions');

-- ─── 5. Declaracions: actiu sí ──────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000b1', 'actiu@test.local');
select results_eq($$ select id from public.declaracions $$, $$ values ('d-actiu') $$,
  'Actiu llegeix només les seves declaracions');
select lives_ok(
  $$ insert into public.declaracions (id, user_id, client_nom) values ('d-nova', auth.uid(), 'N') $$,
  'Actiu crea declaracions');
select lives_ok(
  $$ update public.declaracions set client_nom = 'A2' where id = 'd-actiu' $$,
  'Actiu modifica declaracions');
select throws_ok(
  $$ update public.declaracions set user_id = '00000000-0000-0000-0000-0000000000b2' where id = 'd-actiu' $$,
  '42501', null, 'Actiu no pot passar una declaració a un altre usuari');
select lives_ok($$ delete from public.declaracions where id = 'd-nova' $$, 'Actiu esborra declaracions');
reset role;

-- ─── 6. Maestro ─────────────────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000a1', 'maestro@test.local');
select is((select count(*)::int from public.profiles where email like '%@test.local'), 7, 'Maestro veu totes les fitxes');
select is((select count(*)::int from public.declaracions where id like 'd-%'), 3, 'Maestro veu totes les declaracions');
select lives_ok(
  $$ select public.maestro_actualitza_perfil('00000000-0000-0000-0000-0000000000b2', p_estat => 'actiu', p_eines => '{irpf}') $$,
  'Maestro aprova un usuari pendent i li dona eines');
select throws_ok(
  $$ select public.maestro_actualitza_perfil('00000000-0000-0000-0000-0000000000b1', p_rol => 'maestro') $$,
  '42501', null, 'Maestro NO pot assignar el rol maestro');
select throws_ok(
  $$ select public.maestro_actualitza_perfil('00000000-0000-0000-0000-0000000000a2', p_estat => 'bloquejat') $$,
  '42501', null, 'Maestro no pot modificar un altre maestro');
select throws_ok(
  $$ update public.profiles set estat = 'bloquejat' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'Maestro no pot modificar fitxes directament, només amb la funció');
reset role;
select results_eq(
  $$ select estat, eines from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  $$ values ('actiu'::text, '{irpf}'::text[]) $$,
  'L''aprovació del maestro ha quedat desada');

-- ─── 7. Un no-maestro no pot usar la funció del maestro ─────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000b1', 'actiu@test.local');
select throws_ok(
  $$ select public.maestro_actualitza_perfil('00000000-0000-0000-0000-0000000000b3', p_estat => 'actiu') $$,
  '42501', null, 'Un usuari normal no pot usar la funció del maestro');
reset role;

-- ─── 8. Anònim ──────────────────────────────────────────────────────────────
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'Anònim no llegeix profiles');
select throws_ok($$ select * from public.declaracions $$, '42501', null, 'Anònim no llegeix declaracions');
reset role;

-- ─── 9. solicituds ──────────────────────────────────────────────────────────
-- Maestro bloquejat: no veu, no modifica i no esborra
select pg_temp.com('00000000-0000-0000-0000-0000000000a3', 'maestro-bloquejat@test.local');
select is((select count(*)::int from public.solicituds), 0, 'Maestro bloquejat no veu sol·licituds');
update public.solicituds set estat = 'rebutjat' where id = '00000000-0000-0000-0000-00000000f001';
delete from public.solicituds where id = '00000000-0000-0000-0000-00000000f002';
reset role;
select results_eq(
  $$ select estat from public.solicituds where id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f002') order by id $$,
  $$ values ('pendent'::text), ('pendent'::text) $$,
  'Maestro bloquejat no modifica ni esborra sol·licituds');
select throws_ok(
  $$ select public.maestro_actualitza_perfil('00000000-0000-0000-0000-0000000000b3', p_estat => 'actiu') $$,
  '42501', null, 'Maestro bloquejat no pot usar la funció del maestro');

-- Usuari actiu normal: no veu sol·licituds
select pg_temp.com('00000000-0000-0000-0000-0000000000b1', 'actiu@test.local');
select is((select count(*)::int from public.solicituds), 0, 'Usuari normal no veu sol·licituds');
reset role;

-- Maestro actiu: veu, modifica i esborra
select pg_temp.com('00000000-0000-0000-0000-0000000000a1', 'maestro@test.local');
select is((select count(*)::int from public.solicituds where email like '%@test.local'), 2, 'Maestro actiu veu les sol·licituds');
select lives_ok(
  $$ update public.solicituds set estat = 'rebutjat' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'Maestro actiu modifica una sol·licitud');
select lives_ok(
  $$ delete from public.solicituds where id = '00000000-0000-0000-0000-00000000f002' $$,
  'Maestro actiu esborra una sol·licitud');
reset role;
select results_eq(
  $$ select id, estat from public.solicituds where email like '%@test.local' $$,
  $$ values ('00000000-0000-0000-0000-00000000f001'::uuid, 'rebutjat'::text) $$,
  'Els canvis del maestro actiu han quedat desats');

-- Anònim: pot inserir (formulari públic) però no llegir
set local role anon;
select lives_ok(
  $$ insert into public.solicituds (nom, email, eines, estat) values ('Anon', 'anon@test.local', '{irpf}', 'pendent') $$,
  'Anònim pot enviar una sol·licitud');
select is((select count(*)::int from public.solicituds), 0, 'Anònim no pot llegir sol·licituds');
reset role;

select * from finish();
rollback;
