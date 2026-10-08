-- Proves del portal de signatura · fases 2 i 3
-- Execució local: supabase test db
begin;
select plan(81);

-- ─── Dades de prova (com a postgres) ────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'ocic@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'ocic2@test.local'),
  ('00000000-0000-0000-0000-0000000000e3', 'gestor@test.local'),
  ('00000000-0000-0000-0000-0000000000e4', 'gestor-inactiu@test.local'),
  ('00000000-0000-0000-0000-0000000000e5', 'web@test.local'),
  ('00000000-0000-0000-0000-0000000000e6', 'futur-gestor@test.local');

insert into portal.staff_profiles (user_id, role, actiu) values
  ('00000000-0000-0000-0000-0000000000e1', 'ocic',   true),
  ('00000000-0000-0000-0000-0000000000e2', 'ocic',   true),
  ('00000000-0000-0000-0000-0000000000e3', 'gestor', true),
  ('00000000-0000-0000-0000-0000000000e4', 'gestor', false);

insert into portal.clients (id, party_type, nom_mostrat, referencia_client) values
  ('00000000-0000-0000-0000-0000000000c1', 'pf', 'Client PF', 'REF-PF-1'),
  ('00000000-0000-0000-0000-0000000000c2', 'pj', 'Client PJ, SL', null),
  ('00000000-0000-0000-0000-0000000000c3', 'pf', 'Client Caducat', null);

insert into portal.requests (id, client_id, document_type, template_version, idioma) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'autoritzacio_carrec', 'ABA-01 v1', 'ca'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2', 'autoritzacio_carrec', 'ABA-01 v1', 'ca'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3', 'autoritzacio_carrec', 'ABA-01 v1', 'ca');

-- Valors que es comparteixen entre proves
create temp table t (k text primary key, v text);
grant select, insert, update on t to public;

create function pg_temp.com(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.servei() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('portal.actor', '', true);
  execute 'set local role service_role';
end $$;

create function pg_temp.estat(r uuid) returns text language sql as $$
  select status::text from portal.requests where id = r
$$;

-- ─── 1. Rol i accés del personal ────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select is(portal.el_meu_rol()::text, 'gestor', 'el_meu_rol: gestor actiu');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000e4');
select is(portal.el_meu_rol(), null, 'el_meu_rol: gestor inactiu → null');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000e5');
select is(portal.el_meu_rol(), null, 'el_meu_rol: usuari de la web → null');
select is((select count(*)::int from portal.clients), 0, 'Usuari de la web no veu clients');
select throws_ok($$ insert into portal.clients (party_type, nom_mostrat) values ('pf', 'X') $$,
  '42501', null, 'Usuari de la web no pot crear clients');
reset role;

-- ─── 2. Transicions ─────────────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select lives_ok($$ insert into portal.clients (party_type, nom_mostrat, referencia_client) values ('pf', 'Nou', 'NOU-1') $$,
  'Gestor crea un client amb referència');
select throws_ok($$ insert into portal.clients (party_type, nom_mostrat, referencia_client) values ('pf', 'Llarg', 'REFERENCIA-DE-15') $$,
  '22001', null, 'La referència del client té com a màxim 14 caràcters');
select throws_ok(
  $$ insert into portal.requests (client_id, document_type, template_version, idioma, status)
     values ('00000000-0000-0000-0000-0000000000c1', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'enviat') $$,
  '23514', null, 'Una sol·licitud nova no pot començar en enviat');
select lives_ok(
  $$ insert into portal.autoritzacions_carrec (request_id, titular_nom) values ('00000000-0000-0000-0000-0000000000f2', 'Client PJ, SL') $$,
  'Gestor preomple només el nom del titular en esborrany');
select lives_ok(
  $$ update portal.requests set status = 'enviat' where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3') $$,
  'Gestor passa esborrany → enviat');
select throws_ok($$ update portal.requests set status = 'en_curs' where id = '00000000-0000-0000-0000-0000000000f1' $$,
  '42501', null, 'Gestor no pot fer enviat → en_curs (només servei)');
select throws_ok($$ update portal.requests set status = 'esborrany' where id = '00000000-0000-0000-0000-0000000000f1' $$,
  '23514', null, 'No es pot tornar a esborrany');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000e5');
update portal.requests set status = 'anullat' where id = '00000000-0000-0000-0000-0000000000f1';
reset role;
select is(pg_temp.estat('00000000-0000-0000-0000-0000000000f1'), 'enviat', 'Usuari de la web no pot anul·lar (RLS)');

-- ─── 3. Tokens ──────────────────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1', repeat('1', 64), now() + interval '7 days') $$,
  '42501', null, 'crea_token no es pot cridar des del navegador');
select throws_ok($$ select portal.obre_per_token(repeat('1', 64)) $$,
  '42501', null, 'obre_per_token no es pot cridar des del navegador');
select throws_ok($$ select * from portal.access_tokens $$,
  '42501', null, 'El personal no llegeix access_tokens directament');
reset role;

select pg_temp.servei();
select throws_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f1', repeat('1', 64), now() + interval '7 days') $$,
  '42501', null, 'crea_token: un usuari que no és personal no pot generar enllaços');
select throws_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000f1', repeat('1', 64), now() + interval '7 days') $$,
  '42501', null, 'crea_token: un gestor inactiu no pot generar enllaços');
select throws_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1', repeat('1', 64), now() + interval '30 days') $$,
  '22023', null, 'crea_token: caducitat de més de 7 dies rebutjada');
select throws_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1', 'no-es-un-hash', now() + interval '7 days') $$,
  '23514', null, 'crea_token: només s''accepta un hash SHA-256');
select lives_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1', repeat('0', 64), now() + interval '7 days') $$,
  'crea_token: gestor genera un token');
select lives_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1', repeat('1', 64), now() + interval '7 days') $$,
  'crea_token: gestor regenera el token');
select is(
  (select count(*)::int from portal.access_tokens where request_id = '00000000-0000-0000-0000-0000000000f1' and revocat_at is null and usat_at is null),
  1, 'Regenerar revoca l''anterior: un sol token vigent');
select is(portal.obre_per_token(repeat('0', 64)), null, 'El token revocat ja no obre res');
select is(
  (select actor from portal.audit_log where entitat = 'access_tokens' and accio = 'INSERT'
     and detalls -> 'nou' ->> 'request_id' = '00000000-0000-0000-0000-0000000000f1' order by at limit 1),
  '00000000-0000-0000-0000-0000000000e3'::uuid, 'audit_log: la creació del token té el gestor com a actor');
select is(
  (select detalls -> 'nou' ->> 'token_hash' from portal.audit_log where entitat = 'access_tokens' and accio = 'INSERT' limit 1),
  '[ocult]', 'audit_log: el hash del token no es copia');

-- Token caducat
select lives_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f3', repeat('3', 64), now() + interval '7 days') $$,
  'Token per a la sol·licitud que caducarà');
update portal.access_tokens set expira_at = now() - interval '1 minute' where token_hash = repeat('3', 64);
select is(portal.obre_per_token(repeat('3', 64)), null, 'Token caducat → null');
select is(pg_temp.estat('00000000-0000-0000-0000-0000000000f3'), 'enviat', 'Un token caducat no canvia l''estat');
select is(portal.obre_per_token(repeat('9', 64)), null, 'Token inexistent → null');

-- Token vàlid: enviat → en_curs
select isnt(portal.obre_per_token(repeat('1', 64)), null, 'Token vàlid obre la sol·licitud');
select is(pg_temp.estat('00000000-0000-0000-0000-0000000000f1'), 'en_curs', 'Obrir passa enviat → en_curs');
select is(portal.obre_per_token(repeat('1', 64)) ->> 'client_nom', 'Client PF', 'Es pot tornar a obrir i retorna el client');
insert into t values ('tok1', (select id::text from portal.access_tokens where token_hash = repeat('1', 64)));
reset role;

-- ─── 4. Camps del client mentre és en curs ──────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok(
  $$ insert into portal.autoritzacions_carrec (request_id, titular_nom) values ('00000000-0000-0000-0000-0000000000f1', 'Gestor') $$,
  '42501', null, 'En curs: el personal no pot crear l''autorització');
reset role;

-- ─── 5. Funció de signatura ─────────────────────────────────────────────────
select pg_temp.servei();
insert into portal.autoritzacions_carrec (request_id, titular_nom, titular_adreca, titular_cp_poblacio, entitat, iban_xifrat, iban_ultims4)
values ('00000000-0000-0000-0000-0000000000f1', 'Titular PF', 'Carrer 1', 'AD500 Andorra la Vella', 'andbank', '\x01aabbcc', '0100');

insert into t values ('emp1', portal.empremta_dades('00000000-0000-0000-0000-0000000000f1', 'Titular PF', null, 'Andorra la Vella'));
select matches((select v from t where k = 'emp1'), '^[0-9a-f]{64}$', 'empremta_dades retorna un SHA-256');
select is(portal.empremta_dades('00000000-0000-0000-0000-0000000000f1', 'Titular PF', null, 'Andorra la Vella'),
  (select v from t where k = 'emp1'), 'L''empremta és estable per a les mateixes dades');
select isnt(portal.empremta_dades('00000000-0000-0000-0000-0000000000f1', 'Titular PF', null, 'Escaldes'),
  (select v from t where k = 'emp1'), 'Canviar la localitat canvia l''empremta');

-- Huella cambiada → rechazo
update portal.autoritzacions_carrec set titular_nom = 'Titular Canviat' where request_id = '00000000-0000-0000-0000-0000000000f1';
select throws_ok(
  $$ select portal.registra_signatura((select v::uuid from t where k = 'tok1'), (select v from t where k = 'emp1'),
       'Titular PF', null, 'Andorra la Vella', now(), '10.0.0.1', 'Prova', 'requests/f1/evidencies/a.png', repeat('a', 64), 100,
       'requests/f1/signat/a.pdf', repeat('b', 64), 1000) $$,
  '40001', null, 'Empremta canviada → la signatura es rebutja');
select is(pg_temp.estat('00000000-0000-0000-0000-0000000000f1'), 'en_curs', 'Després del rebuig continua en curs');
select is((select count(*)::int from portal.signatures where request_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'Després del rebuig no hi ha cap firma');

update portal.autoritzacions_carrec set titular_nom = 'Titular PF' where request_id = '00000000-0000-0000-0000-0000000000f1';
select throws_ok(
  $$ select portal.registra_signatura((select v::uuid from t where k = 'tok1'), (select v from t where k = 'emp1'),
       'Titular PF', null, 'Andorra la Vella', now() - interval '1 hour', '10.0.0.1', 'Prova', 'requests/f1/evidencies/a.png', repeat('a', 64), 100,
       'requests/f1/signat/a.pdf', repeat('b', 64), 1000) $$,
  '22023', null, 'Data de signatura fora de marge → rebutjada');
select lives_ok(
  $$ select portal.registra_signatura((select v::uuid from t where k = 'tok1'), (select v from t where k = 'emp1'),
       'Titular PF', null, 'Andorra la Vella', now(), '10.0.0.1', 'Prova', 'requests/f1/evidencies/a.png', repeat('a', 64), 100,
       'requests/f1/signat/a.pdf', repeat('b', 64), 1000) $$,
  'Amb les mateixes dades, la signatura es registra');
select is(pg_temp.estat('00000000-0000-0000-0000-0000000000f1'), 'signat', 'en_curs → signat');
select is((select empremta_dades from portal.signatures where request_id = '00000000-0000-0000-0000-0000000000f1'),
  (select v from t where k = 'emp1'), 'La firma desa l''empremta');
select is((select count(*)::int from portal.documents where request_id = '00000000-0000-0000-0000-0000000000f1'), 2,
  'Es registren el PDF signat i la imatge de la firma');
select isnt((select usat_at from portal.access_tokens where id = (select v::uuid from t where k = 'tok1')), null,
  'El token queda consumit');
select is(portal.obre_per_token(repeat('1', 64)), null, 'Un token usat ja no obre res');
select throws_ok(
  $$ select portal.registra_signatura((select v::uuid from t where k = 'tok1'), (select v from t where k = 'emp1'),
       'Titular PF', null, 'Andorra la Vella', now(), '10.0.0.1', 'Prova', 'requests/f1/evidencies/b.png', repeat('a', 64), 100,
       'requests/f1/signat/b.pdf', repeat('b', 64), 1000) $$,
  '42501', null, 'No es pot signar dues vegades amb el mateix token');
select throws_ok(
  $$ update portal.autoritzacions_carrec set titular_nom = 'Després' where request_id = '00000000-0000-0000-0000-0000000000f1' $$,
  '42501', null, 'Signada: ni service_role pot canviar les dades del titular');
select throws_ok(
  $$ update portal.signatures set lloc = 'Altre' where request_id = '00000000-0000-0000-0000-0000000000f1' $$,
  '42501', null, 'La firma no es pot modificar');

-- Persona jurídica sense dades completes (sense IBAN i signant no administrador sense poder)
select lives_ok(
  $$ select portal.crea_token('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f2', repeat('2', 64), now() + interval '7 days') $$,
  'Token per a la persona jurídica');
select isnt(portal.obre_per_token(repeat('2', 64)), null, 'La persona jurídica obre l''enllaç');
update portal.autoritzacions_carrec
   set titular_adreca = 'Av. 1', titular_cp_poblacio = 'AD700 Escaldes', entitat = 'creand', signant_es_administrador = false
 where request_id = '00000000-0000-0000-0000-0000000000f2';
insert into t values ('tok2', (select id::text from portal.access_tokens where token_hash = repeat('2', 64)));
select throws_ok(
  $$ select portal.registra_signatura((select v::uuid from t where k = 'tok2'),
       portal.empremta_dades('00000000-0000-0000-0000-0000000000f2', 'Apoderat', 'Apoderat', 'Escaldes'),
       'Apoderat', 'Apoderat', 'Escaldes', now(), null, null, 'requests/f2/evidencies/a.png', repeat('a', 64), 100,
       'requests/f2/signat/a.pdf', repeat('b', 64), 1000) $$,
  '23514', 'No es pot passar a signat: falta IBAN, poder adjunt', 'Sense IBAN ni poder no es pot signar');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok(
  $$ select portal.registra_signatura(gen_random_uuid(), repeat('a', 64), 'x', null, 'x', now(), null, null, 'a', repeat('a', 64), 1, 'b', repeat('b', 64), 1) $$,
  '42501', null, 'registra_signatura no es pot cridar des del navegador');
select throws_ok(
  $$ update portal.autoritzacions_carrec set signant_es_administrador = true where request_id = '00000000-0000-0000-0000-0000000000f2' $$,
  '42501', null, 'En curs: el personal no pot canviar signant_es_administrador');
reset role;

-- ─── 6. Activació ───────────────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e5');
select throws_ok($$ select portal.activa_autoritzacio('00000000-0000-0000-0000-0000000000f1', current_date) $$,
  'P0002', null, 'Usuari de la web no pot activar (no veu l''autorització)');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select lives_ok($$ select portal.activa_autoritzacio('00000000-0000-0000-0000-0000000000f1', current_date) $$,
  'Gestor activa l''autorització signada');
select is(pg_temp.estat('00000000-0000-0000-0000-0000000000f1'), 'actiu', 'signat → actiu');
reset role;
select is((select activat_per from portal.requests where id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-0000000000e3'::uuid, 'activat_per és el gestor');

-- ─── 7. Remesa: només personal ──────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select * from portal.remesa_exporta('00000000-0000-0000-0000-0000000000e3', null, null) $$,
  '42501', null, 'remesa_exporta no es pot cridar des del navegador (ni pel personal)');
select throws_ok($$ insert into portal.audit_log (accio, entitat) values ('EXPORT', 'remesa') $$,
  '42501', null, 'El personal no pot escriure a audit_log');
reset role;

select pg_temp.servei();
select throws_ok($$ select * from portal.remesa_exporta('00000000-0000-0000-0000-0000000000e5', null, null) $$,
  '42501', null, 'remesa_exporta: usuari que no és personal → rebutjat');
select throws_ok($$ select * from portal.remesa_exporta('00000000-0000-0000-0000-0000000000e4', null, null) $$,
  '42501', null, 'remesa_exporta: gestor inactiu → rebutjat');
select results_eq(
  $$ select referencia_client, entitat, encode(iban_xifrat, 'hex') from portal.remesa_exporta('00000000-0000-0000-0000-0000000000e3', '10.0.0.2', 'Prova')
     where request_id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3') $$,
  $$ values ('REF-PF-1'::text, 'andbank'::text, '01aabbcc'::text) $$,
  'remesa_exporta: el gestor rep només les autoritzacions actives');
select is(
  (select count(*)::int from portal.audit_log where entitat = 'remesa' and accio = 'EXPORT'
     and actor = '00000000-0000-0000-0000-0000000000e3'
     and detalls -> 'requests' @> '["00000000-0000-0000-0000-0000000000f1"]'
     and not detalls -> 'requests' @> '["00000000-0000-0000-0000-0000000000f2"]'),
  1, 'L''exportació queda a audit_log amb el gestor com a actor');
reset role;

-- ─── 8. Personal del portal ─────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select portal.alta_gestor('00000000-0000-0000-0000-0000000000e1', 'futur-gestor@test.local') $$,
  '42501', null, 'alta_gestor no es pot cridar des del navegador');
select throws_ok($$ insert into portal.staff_profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000e6', 'gestor') $$,
  '42501', null, 'Ningú pot escriure staff_profiles des del navegador');
reset role;

select pg_temp.servei();
select throws_ok($$ select portal.alta_gestor('00000000-0000-0000-0000-0000000000e3', 'futur-gestor@test.local') $$,
  '42501', null, 'Un gestor no pot donar d''alta personal');
select throws_ok($$ select * from portal.llista_personal('00000000-0000-0000-0000-0000000000e3') $$,
  '42501', null, 'Un gestor no pot llistar el personal');
select lives_ok($$ select portal.alta_gestor('00000000-0000-0000-0000-0000000000e1', 'FUTUR-GESTOR@test.local') $$,
  'OCIC dona d''alta un gestor pel correu');
select is((select role::text || '/' || actiu from portal.staff_profiles where user_id = '00000000-0000-0000-0000-0000000000e6'),
  'gestor/true', 'El nou gestor queda actiu');
select throws_ok($$ select portal.baixa_gestor('00000000-0000-0000-0000-0000000000e1', 'ocic@test.local') $$,
  '42501', null, 'OCIC no es pot donar de baixa a si mateix');
select throws_ok($$ select portal.baixa_gestor('00000000-0000-0000-0000-0000000000e1', 'ocic2@test.local') $$,
  '42501', null, 'OCIC no pot donar de baixa un altre OCIC');
select throws_ok($$ select portal.alta_gestor('00000000-0000-0000-0000-0000000000e1', 'ningu@test.local') $$,
  'P0002', null, 'No es pot donar d''alta un correu inexistent');
select lives_ok($$ select portal.baixa_gestor('00000000-0000-0000-0000-0000000000e1', 'futur-gestor@test.local') $$,
  'OCIC dona de baixa el gestor');
select is((select actiu from portal.staff_profiles where user_id = '00000000-0000-0000-0000-0000000000e6'),
  false, 'La baixa desactiva i no esborra');
select is(
  (select count(*)::int from portal.audit_log a join portal.staff_profiles s on s.id = a.entitat_id
    where a.entitat = 'staff_profiles' and s.user_id = '00000000-0000-0000-0000-0000000000e6'
      and a.actor = '00000000-0000-0000-0000-0000000000e1'),
  2, 'audit_log: alta i baixa amb l''OCIC com a actor');
reset role;

-- ─── 9. L'actor no es pot falsificar des d'una sessió authenticated ─────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select set_config('portal.actor', '00000000-0000-0000-0000-0000000000e1', true);
update portal.clients set nom_mostrat = 'Client PF (nou nom)' where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select is(
  (select actor from portal.audit_log where entitat = 'clients' and entitat_id = '00000000-0000-0000-0000-0000000000c1' and accio = 'UPDATE'),
  '00000000-0000-0000-0000-0000000000e3'::uuid, 'Amb sessió authenticated, portal.actor s''ignora');

-- ─── 10. Límit d'intents ────────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select * from portal.limit_intents $$, '42501', null, 'limit_intents no és accessible des del navegador');
reset role;
select pg_temp.servei();
select ok(portal.registra_intent('prova', 2, 600) and portal.registra_intent('prova', 2, 600), 'Dins del límit → true');
select ok(not portal.registra_intent('prova', 2, 600), 'Per sobre del límit → false');
reset role;

select * from finish();
rollback;
