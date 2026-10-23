-- Proves del contracte (signatura de contractes amb un o més signants i ÀMBIT)
-- Execució local: supabase test db
begin;
select plan(140);

-- ─── Dades de prova (com a postgres) ────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'mpaleari@ambit.ad'),
  ('00000000-0000-0000-0000-0000000000c2', 'altra-ocic@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'gestor-contracte@test.local'),
  ('00000000-0000-0000-0000-0000000000c5', 'web-contracte@test.local')
on conflict (id) do nothing;
insert into portal.staff_profiles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'ocic'),
  ('00000000-0000-0000-0000-0000000000c2', 'ocic'),
  ('00000000-0000-0000-0000-0000000000c3', 'gestor')
on conflict (user_id) do nothing;
insert into portal.clients (id, party_type, nom_mostrat, referencia_client) values
  ('00000000-0000-0000-0000-0000000000d1', 'pj', 'Client Contracte, SL', 'CON-1'),
  ('00000000-0000-0000-0000-0000000000d2', 'pf', 'Client Contracte Persona', null);

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
  perform set_config('portal.actor', '', true);
  execute 'set local role service_role';
end $$;
create function pg_temp.v(k text) returns uuid language sql as $$ select v::uuid from t where t.k = $1 $$;
create function pg_temp.estat(r uuid) returns text language sql as $$ select status::text from portal.requests where id = r $$;
create function pg_temp.signant(r uuid, ordre int) returns uuid language sql as $$
  select id from portal.contracte_signants where request_id = r and contracte_signants.ordre = $2 $$;
grant execute on function pg_temp.v(text), pg_temp.estat(uuid), pg_temp.signant(uuid, int) to public;

-- Original tal com el registra portal-contracte-personal (gestor com a actor)
create function pg_temp.original(r uuid, sha text default repeat('a', 64)) returns uuid language sql as $$
  select portal.contracte_registra_original('00000000-0000-0000-0000-0000000000c3', r,
    'requests/' || r || '/original/' || gen_random_uuid() || '.pdf', sha, 12345, 'Contracte de prova.pdf', 3) $$;
grant execute on function pg_temp.original(uuid, text) to public;

-- Enllaç d'un signant (el hash és el del token; aquí, un valor fix per signant)
create function pg_temp.token(s uuid) returns uuid language sql as $$
  select portal.contracte_crea_token('00000000-0000-0000-0000-0000000000c3', s,
    encode(sha256(convert_to(s::text || clock_timestamp()::text, 'UTF8')), 'hex'), now() + interval '7 days') $$;
grant execute on function pg_temp.token(uuid) to public;

-- Signatura tal com la registra portal-contracte
create function pg_temp.signa(tok uuid, s uuid, lloc text default 'Andorra la Vella', empremta text default null) returns jsonb language sql as $$
  select portal.contracte_registra_signatura(tok, clock_timestamp(), '10.0.0.1', 'prova',
    jsonb_build_object('empremta', coalesce(empremta, portal.empremta_contracte(s, lloc)), 'lloc', lloc,
      'imatge_path', 'requests/' || (select request_id from portal.contracte_signants where id = s) || '/evidencies/' || gen_random_uuid() || '-signatura.png',
      'imatge_sha256', encode(sha256(convert_to(s::text, 'UTF8')), 'hex'), 'imatge_mida', 100)) $$;
grant execute on function pg_temp.signa(uuid, uuid, text, text) to public;

-- Firma OCIC de mpaleari@ambit.ad i firma d'ÀMBIT (la mateixa imatge)
insert into portal.firmes_ocic (user_id, nom, imatge_path, sha256) values
  ('00000000-0000-0000-0000-0000000000c1', 'Martín Paleari',
   'ocic/00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-00000000f1f1.png', repeat('f', 64))
on conflict (user_id) do nothing;
-- L'altra OCIC també té firma OCIC (però no és el signant d'ÀMBIT)
insert into portal.firmes_ocic (user_id, nom, imatge_path, sha256) values
  ('00000000-0000-0000-0000-0000000000c2', 'Altra OCIC',
   'ocic/00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-00000000f2f2.png', repeat('e', 64))
on conflict (user_id) do nothing;

-- ═══ 1. Estructura ══════════════════════════════════════════════════════════
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'portal.contractes'::regclass, 'portal.contracte_originals'::regclass, 'portal.contracte_signants'::regclass,
  'portal.contracte_contrafirmes'::regclass, 'portal.firmes_ambit'::regclass)), 'RLS activat a totes les taules noves');
select is((select termini_contracte from portal.config_conservacio), interval '6 years', 'Conservació: fi de la relació + 6 anys');
select ok(portal.registra_firma_ambit_des_ocic(), 'Es registra la firma d''ÀMBIT a partir de la firma OCIC de mpaleari@ambit.ad');
select is((select nom || ' · ' || carrec || ' · ' || sha256 from portal.firmes_ambit where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'Martín Paleari · Administrador solidari · ' || repeat('f', 64), 'Firma d''ÀMBIT: mateixa imatge que la firma OCIC, amb el nom i el càrrec');
select is((select count(*)::int from portal.firmes_ambit), 1, 'Només hi ha la firma d''ÀMBIT de mpaleari@ambit.ad');

select pg_temp.servei();
select throws_ok($$ insert into portal.firmes_ambit (user_id, nom, carrec, imatge_path, sha256)
  values ('00000000-0000-0000-0000-0000000000c2', 'Altra', 'Càrrec', 'ocic/00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-00000000f2f2.png', repeat('e', 64)) $$,
  '42501', null, 'El servei no pot registrar cap firma d''ÀMBIT');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from portal.contracte_contrafirmes), 0, 'El personal veu les signatures d''ÀMBIT (cap encara)');
select throws_ok($$ select * from portal.firmes_ambit $$, '42501', null, 'El personal no pot llegir les firmes d''ÀMBIT');
reset role;

-- ═══ 2. Creació des d'un client ═════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000c5');
select throws_ok($$ select portal.contracte_crea('00000000-0000-0000-0000-0000000000d1', 'Contracte X', 'ca',
  '[{"nom":"A","email":"a@a.ad","qualitat":"En nom propi"}]') $$, '42501', null, 'Un usuari de la web no pot crear un contracte');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select portal.contracte_crea('00000000-0000-0000-0000-0000000000d1', 'Contracte X', 'en', '[{"nom":"A","email":"a@a.ad","qualitat":"Q"}]') $$,
  '22023', null, 'Idioma no admès (només ca o ca_en)');
select throws_ok($$ select portal.contracte_crea('00000000-0000-0000-0000-0000000000d1', 'Contracte X', 'ca', '[]') $$,
  '22023', null, 'Cal un signant com a mínim');
select throws_ok($$ select portal.contracte_crea('00000000-0000-0000-0000-0000000000d1', 'Contracte X', 'ca', '[{"nom":"A","email":"no-es-correu","qualitat":"Q"}]') $$,
  '23514', null, 'El correu del signant ha de ser vàlid');
select throws_ok($$ select portal.contracte_crea('00000000-0000-0000-0000-0000000000d1', '  ', 'ca', '[{"nom":"A","email":"a@a.ad","qualitat":"Q"}]') $$,
  '23514', null, 'Cal el títol');
select throws_ok($$ select portal.contracte_crea('00000000-0000-0000-0000-0000000000d1', 'Contracte X', 'ca', '[{"nom":"A","email":"a@a.ad","qualitat":" "}]') $$,
  '23514', null, 'Cal la qualitat del signant');
-- Dos signants, bilingüe
insert into t select 'dos', portal.contracte_crea('00000000-0000-0000-0000-0000000000d1', '  Contracte de serveis 2026 ', 'ca_en',
  '[{"nom":"Anna Prova Primera","email":"Anna@Test.local","qualitat":"En nom i representació de Client Contracte, SL, com a administradora"},
    {"nom":"Bernat Prova Segon","email":"bernat@test.local","qualitat":"En nom propi"}]');
-- Un signant, català
insert into t select 'un', portal.contracte_crea('00000000-0000-0000-0000-0000000000d2', 'Contracte d''arrendament', 'ca',
  '[{"nom":"Carla Prova","email":"carla@test.local","qualitat":"En nom propi"}]');
-- Per anul·lar
insert into t select 'anul', portal.contracte_crea('00000000-0000-0000-0000-0000000000d2', 'Contracte per anul·lar', 'ca',
  '[{"nom":"Dídac Prova","email":"didac@test.local","qualitat":"En nom propi"},{"nom":"Eva Prova","email":"eva@test.local","qualitat":"En nom propi"}]');
insert into t select 'esb', portal.contracte_crea('00000000-0000-0000-0000-0000000000d2', 'Esborrany per anul·lar', 'ca',
  '[{"nom":"Fèlix Prova","email":"felix@test.local","qualitat":"En nom propi"}]');
reset role;

select is((select document_type::text || ' ' || template_version || ' ' || status || ' ' || idioma from portal.requests where id = pg_temp.v('dos')),
  'contracte CONTRACTE v1 esborrany ca', 'Tipus contracte, plantilla CONTRACTE v1, en esborrany');
select is((select titol || ' · ' || idioma from portal.contractes where request_id = pg_temp.v('dos')), 'Contracte de serveis 2026 · ca_en',
  'Es desa el títol i l''idioma triat');
select is((select string_agg(ordre || ':' || email, ',' order by ordre) from portal.contracte_signants where request_id = pg_temp.v('dos')),
  '1:anna@test.local,2:bernat@test.local', 'Dos signants, en ordre, amb el correu en minúscules');
select is((select creat_per from portal.requests where id = pg_temp.v('dos')), '00000000-0000-0000-0000-0000000000c3'::uuid,
  'La sol·licitud consta creada pel gestor');

select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ update portal.contractes set titol = 'Un altre' where request_id = pg_temp.v('dos') $$,
  '42501', null, 'El títol i l''idioma no es poden modificar');
select throws_ok($$ update portal.contracte_signants set email = 'altre@test.local' where request_id = pg_temp.v('dos') $$,
  '42501', null, 'Les dades dels signants no es poden modificar');
select throws_ok($$ update portal.requests set document_type = 'autoritzacio_carrec' where id = pg_temp.v('dos') $$,
  '42501', null, 'Un contracte no pot canviar de tipus');
select throws_ok($$ update portal.requests set status = 'enviat' where id = pg_temp.v('dos') $$,
  '23514', null, 'No es pot enviar sense el PDF original');
reset role;

-- ═══ 3. PDF original ════════════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (pg_temp.v('dos'), 'original', 'requests/' || pg_temp.v('dos') || '/original/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1, 'application/pdf') $$,
  '42501', null, 'El personal no pot registrar l''original directament (sense comprovar)');
select throws_ok($$ insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (pg_temp.v('dos'), 'adjunt', 'requests/' || pg_temp.v('dos') || '/adjunts/x.pdf', repeat('a', 64), 1, 'application/pdf') $$,
  '42501', null, 'Ni cap adjunt al contracte');
select throws_ok($$ select pg_temp.original(pg_temp.v('dos')) $$, '42501', null, 'Ni amb la funció del servei');
reset role;
select pg_temp.servei();
select throws_ok($$ insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (pg_temp.v('dos'), 'original', 'requests/' || pg_temp.v('dos') || '/original/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1, 'application/pdf') $$,
  '42501', null, 'Tampoc el servei sense passar per la funció que el registra en nom del personal');
reset role;
select pg_temp.servei();
select throws_ok($$ select portal.contracte_registra_original('00000000-0000-0000-0000-0000000000c5', pg_temp.v('dos'),
  'requests/' || pg_temp.v('dos') || '/original/' || gen_random_uuid() || '.pdf', repeat('a', 64), 1, 'x.pdf', 1) $$,
  '42501', null, 'L''actor ha de ser personal actiu');
select throws_ok($$ select portal.contracte_registra_original('00000000-0000-0000-0000-0000000000c3', pg_temp.v('dos'),
  'requests/' || pg_temp.v('dos') || '/altres/' || gen_random_uuid() || '.pdf', repeat('a', 64), 1, 'x.pdf', 1) $$,
  '23514', null, 'Camí de l''original no vàlid');
select throws_ok($$ select portal.contracte_registra_original('00000000-0000-0000-0000-0000000000c3', pg_temp.v('dos'),
  'requests/' || pg_temp.v('dos') || '/original/' || gen_random_uuid() || '.pdf', repeat('a', 64), 30000000, 'x.pdf', 1) $$,
  '23514', null, 'Màxim 20 MB');
select lives_ok($$ select pg_temp.original(pg_temp.v('dos'), repeat('1', 64)) $$, 'El servei registra l''original comprovat');
select throws_ok($$ select pg_temp.original(pg_temp.v('dos'), repeat('2', 64)) $$, '23505', null,
  'L''original no se substitueix mai (cal anul·lar i crear-ne un altre)');
select lives_ok($$ select pg_temp.original(pg_temp.v('un'), repeat('3', 64)) $$, 'Original del contracte d''un signant');
select lives_ok($$ select pg_temp.original(pg_temp.v('anul'), repeat('4', 64)) $$, 'Original del contracte per anul·lar');
reset role;
-- Un document 'original' a una sol·licitud que no és un contracte
insert into portal.requests (id, client_id, document_type, template_version, idioma)
values ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000d1', 'autoritzacio_carrec', 'ABA-01 v1', 'ca');
select pg_temp.servei();
select throws_ok($$ insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values ('00000000-0000-0000-0000-0000000000e9', 'original', 'requests/00000000-0000-0000-0000-0000000000e9/original/x.pdf', repeat('a', 64), 1, 'application/pdf') $$,
  '23514', null, 'Només els contractes tenen PDF original');
reset role;

select is((select sha256 || ' ' || pagines || ' ' || nom_fitxer from portal.contracte_originals where request_id = pg_temp.v('dos')),
  repeat('1', 64) || ' 3 Contracte de prova.pdf', 'Es desa l''empremta, les pàgines i el nom del fitxer original');
select is((select d.sha256 from portal.documents d where d.request_id = pg_temp.v('dos') and d.kind = 'original'), repeat('1', 64),
  'El document original té la mateixa empremta');
select throws_ok($$ update portal.contracte_originals set sha256 = repeat('9', 64) where request_id = pg_temp.v('dos') $$,
  '42501', null, 'L''original registrat no es pot modificar');
select throws_ok($$ update portal.documents set sha256 = repeat('9', 64) where request_id = pg_temp.v('dos') and kind = 'original' $$,
  '42501', null, 'El document original no es pot modificar');
select throws_ok($$ delete from portal.contracte_originals where request_id = pg_temp.v('dos') $$,
  '42501', null, 'L''original no es pot esborrar');

-- ═══ 4. Enviament i enllaços (un per signant) ═══════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select lives_ok($$ update portal.requests set status = 'enviat', enviat_at = now() where id in (pg_temp.v('dos'), pg_temp.v('un'), pg_temp.v('anul')) $$,
  'Amb l''original i els signants, el personal l''envia');
select throws_ok($$ insert into portal.contracte_signants (request_id, ordre, nom, email, qualitat)
  values (pg_temp.v('dos'), 9, 'X', 'x@test.local', 'Q') $$, '23514', null, 'Un cop enviat, no s''hi poden afegir signants');
reset role;
select pg_temp.servei();
select throws_ok($$ select portal.crea_token('00000000-0000-0000-0000-0000000000c3', pg_temp.v('dos'), repeat('b', 64), now() + interval '7 days') $$,
  '23514', null, 'Un contracte no admet un enllaç sense signant (crea_token de les altres sol·licituds)');
insert into t select 'tok_a', pg_temp.token(pg_temp.signant(pg_temp.v('dos'), 1));
insert into t select 'tok_b', pg_temp.token(pg_temp.signant(pg_temp.v('dos'), 2));
select is((select count(*)::int from portal.access_tokens where request_id = pg_temp.v('dos') and revocat_at is null and usat_at is null), 2,
  'Cada signant té el seu enllaç vigent al mateix temps');
insert into t select 'tok_a2', pg_temp.token(pg_temp.signant(pg_temp.v('dos'), 1));
select ok((select revocat_at is not null from portal.access_tokens where id = pg_temp.v('tok_a')), 'Regenerar revoca l''enllaç anterior del signant');
select ok((select revocat_at is null from portal.access_tokens where id = pg_temp.v('tok_b')), '… però no el de l''altre signant');
select throws_ok($$ insert into portal.access_tokens (request_id, signant_id, token_hash, expira_at)
  values ('00000000-0000-0000-0000-0000000000e9', pg_temp.signant(pg_temp.v('dos'), 1), repeat('c', 64), now() + interval '1 day') $$,
  '23514', null, 'Un enllaç per signant només és d''un contracte i del mateix contracte');
select throws_ok($$ select portal.contracte_crea_token('00000000-0000-0000-0000-0000000000c3', pg_temp.signant(pg_temp.v('dos'), 1), repeat('d', 64), now() + interval '30 days') $$,
  '22023', null, 'Caducitat màxima de 7 dies');
insert into t select 'tok_c', pg_temp.token(pg_temp.signant(pg_temp.v('un'), 1));
insert into t select 'tok_d', pg_temp.token(pg_temp.signant(pg_temp.v('anul'), 1));
reset role;

select pg_temp.servei();
select is(portal.obre_per_token((select token_hash from portal.access_tokens where id = pg_temp.v('tok_c'))), null,
  'L''enllaç d''un contracte no serveix a la pàgina de l''autorització de càrrec');
select is((portal.obre_contracte_per_token((select token_hash from portal.access_tokens where id = pg_temp.v('tok_a2'))) ->> 'titol'),
  'Contracte de serveis 2026', 'L''enllaç del signant obre el contracte');
select is((portal.obre_contracte_per_token((select token_hash from portal.access_tokens where id = pg_temp.v('tok_a2'))) #>> '{signant,nom}'),
  'Anna Prova Primera', '… amb les dades del seu signant');
select is(portal.obre_contracte_per_token((select token_hash from portal.access_tokens where id = pg_temp.v('tok_a'))), null,
  'L''enllaç revocat ja no obre res');
select is(pg_temp.estat(pg_temp.v('dos')), 'enviat', 'Obrir l''enllaç no canvia l''estat');
reset role;

-- ═══ 5. Acceptació prèvia i signatura ═══════════════════════════════════════
select pg_temp.servei();
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_a2'), pg_temp.signant(pg_temp.v('dos'), 1)) $$, '23514', null,
  'Sense l''acceptació prèvia no es pot signar');
select throws_ok($$ select portal.contracte_accepta(pg_temp.v('tok_a2'), false, true, '10.0.0.1', 'prova') $$, '22023', null,
  'Cal la casella de lectura del contracte complet');
select throws_ok($$ select portal.contracte_accepta(pg_temp.v('tok_a2'), true, false, '10.0.0.1', 'prova') $$, '22023', null,
  'Cal la casella d''acceptació de la signatura electrònica');
insert into t select 'acc_a', portal.contracte_accepta(pg_temp.v('tok_a2'), true, true, '10.0.0.1', 'prova');
select is((select acceptat_at::text from portal.contracte_signants where id = pg_temp.signant(pg_temp.v('dos'), 1)), (select v from t where k = 'acc_a'),
  'L''acceptació es registra amb la seva data i hora');
select is(portal.contracte_accepta(pg_temp.v('tok_a2'), true, true, '10.0.0.9', 'altre')::text, (select v from t where k = 'acc_a'),
  'Tornar a acceptar conserva la primera acceptació');
select throws_ok($$ update portal.contracte_signants set acceptat_at = now() where id = pg_temp.signant(pg_temp.v('dos'), 1) $$,
  '42501', null, 'L''acceptació registrada no es pot modificar');
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_a2'), pg_temp.signant(pg_temp.v('dos'), 1), 'Andorra la Vella', repeat('0', 64)) $$,
  '40001', null, 'Amb una empremta que no correspon a les dades no es pot signar');
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_a2'), pg_temp.signant(pg_temp.v('dos'), 2)) $$,
  '40001', null, 'Un signant no pot signar per un altre');
select is((pg_temp.signa(pg_temp.v('tok_a2'), pg_temp.signant(pg_temp.v('dos'), 1)) ->> 'estat'), 'parcialment_signat',
  'Signa el primer signant: parcialment signat');
reset role;
select is(pg_temp.estat(pg_temp.v('dos')), 'parcialment_signat', 'Estat: parcialment signat');
select ok((select acceptat_at < signat_at from portal.contracte_signants where id = pg_temp.signant(pg_temp.v('dos'), 1)),
  'L''acceptació és anterior a la signatura');
select ok((select usat_at is not null from portal.access_tokens where id = pg_temp.v('tok_a2')), 'L''enllaç és d''un sol ús');
select is((select count(*)::int from portal.documents where request_id = pg_temp.v('dos') and kind = 'evidencies'), 1,
  'Es desa la imatge de la firma');
select ok((select empremta_dades = portal.empremta_contracte(id, lloc) from portal.contracte_signants where id = pg_temp.signant(pg_temp.v('dos'), 1)),
  'L''empremta de la signatura cobreix el contracte, l''original, el signant, el lloc i l''acceptació');

select pg_temp.servei();
select throws_ok($$ select portal.contracte_accepta(pg_temp.v('tok_a2'), true, true, '10.0.0.1', 'prova') $$, '42501', null,
  'Un cop signat, l''enllaç ja no serveix');
select throws_ok($$ update portal.contracte_signants set lloc = 'Encamp' where id = pg_temp.signant(pg_temp.v('dos'), 1) $$,
  '42501', null, 'La signatura registrada no es pot modificar');
select throws_ok($$ select portal.contracte_crea_token('00000000-0000-0000-0000-0000000000c3', pg_temp.signant(pg_temp.v('dos'), 1), repeat('e', 64), now() + interval '1 day') $$,
  '23514', null, 'No es genera cap enllaç per a qui ja ha signat');
reset role;

-- Signatura d'ÀMBIT abans que hagin signat tots
select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select portal.contrafirma_contracte(pg_temp.v('dos')) $$, '23514', null,
  'ÀMBIT no pot signar fins que hagin signat tots els signants del client');
select throws_ok($$ update portal.requests set status = 'pendent_ambit' where id = pg_temp.v('dos') $$, '42501', null,
  'El personal no pot posar el contracte pendent de signatura d''ÀMBIT');
reset role;

select pg_temp.servei();
select lives_ok($$ select portal.contracte_accepta(pg_temp.v('tok_b'), true, true, '10.0.0.2', 'prova 2') $$, 'Accepta el segon signant');
select is((pg_temp.signa(pg_temp.v('tok_b'), pg_temp.signant(pg_temp.v('dos'), 2), 'Escaldes-Engordany') ->> 'estat'), 'pendent_ambit',
  'Signa el segon: pendent de signatura d''ÀMBIT');
-- Un signant, en qualsevol ordre: el contracte d'un signant passa directament a pendent d'ÀMBIT
select lives_ok($$ select portal.contracte_accepta(pg_temp.v('tok_c'), true, true, '10.0.0.3', 'prova 3') $$, 'Accepta el signant únic');
select is((pg_temp.signa(pg_temp.v('tok_c'), pg_temp.signant(pg_temp.v('un'), 1)) ->> 'estat'), 'pendent_ambit',
  'Amb un sol signant: enviat → pendent de signatura d''ÀMBIT');
reset role;

-- ═══ 6. Signatura d'ÀMBIT ═══════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select portal.contrafirma_contracte(pg_temp.v('dos')) $$, '42501', null, 'Un gestor no pot signar en nom d''ÀMBIT');
select throws_ok($$ update portal.requests set status = 'signat' where id = pg_temp.v('dos') $$, '42501', null,
  'Un gestor no pot passar el contracte a signat');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select portal.contrafirma_contracte(pg_temp.v('dos')) $$, '42501', null,
  'Una altra OCIC (amb firma OCIC) no pot signar en nom d''ÀMBIT');
reset role;
select pg_temp.servei();
select throws_ok($$ insert into portal.contracte_contrafirmes (request_id, user_id, nom, carrec, imatge_path, imatge_sha256, empremta_dades)
  values (pg_temp.v('dos'), '00000000-0000-0000-0000-0000000000c1', 'x', 'x', 'x', repeat('f', 64), repeat('f', 64)) $$,
  '42501', null, 'El servei no pot estampar la firma d''ÀMBIT (cal la sessió del signant)');
select throws_ok($$ update portal.requests set status = 'signat' where id = pg_temp.v('dos') $$, '42501', null,
  'El servei no pot passar el contracte a signat');
select throws_ok($$ select portal.contracte_registra_pdf_final('00000000-0000-0000-0000-0000000000c1', pg_temp.v('dos'),
  'requests/' || pg_temp.v('dos') || '/signat/' || gen_random_uuid() || '.pdf', repeat('9', 64), 100) $$,
  '42501', null, 'Sense la signatura d''ÀMBIT no hi ha PDF final');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ insert into t select 'cf', portal.contrafirma_contracte(pg_temp.v('dos'))::text $$, 'mpaleari@ambit.ad signa amb la seva sessió');
reset role;
select is(pg_temp.estat(pg_temp.v('dos')), 'signat', 'Estat: signat');
select is((select nom || ' · ' || carrec || ' · ' || imatge_sha256 || ' · ' || user_id from portal.contracte_contrafirmes where request_id = pg_temp.v('dos')),
  'Martín Paleari · Administrador solidari · ' || repeat('f', 64) || ' · 00000000-0000-0000-0000-0000000000c1',
  'La signatura d''ÀMBIT surt de la firma registrada (nom, càrrec i imatge), no de la petició');
select ok((select x.signat_at > max(s.signat_at) from portal.contracte_contrafirmes x join portal.contracte_signants s on s.request_id = x.request_id
           where x.request_id = pg_temp.v('dos') group by x.signat_at), 'ÀMBIT signa després de tots els signants del client');
select ok((select empremta_dades = portal.empremta_contrafirma(request_id, nom, carrec, imatge_sha256, signat_at)
           from portal.contracte_contrafirmes where request_id = pg_temp.v('dos')), 'L''empremta d''ÀMBIT cobreix l''original i totes les signatures');
select is((select signat_at from portal.requests where id = pg_temp.v('dos')),
  (select signat_at from portal.contracte_contrafirmes where request_id = pg_temp.v('dos')), 'Data de signatura del contracte: la d''ÀMBIT');
select throws_ok($$ update portal.contracte_contrafirmes set nom = 'Un altre' where request_id = pg_temp.v('dos') $$,
  '42501', null, 'La signatura d''ÀMBIT no es pot modificar');

select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select portal.contrafirma_contracte(pg_temp.v('dos')) $$, '23514', null, 'ÀMBIT només signa una vegada');
reset role;

-- PDF final
select pg_temp.servei();
select throws_ok($$ select portal.contracte_dades_pdf_final('00000000-0000-0000-0000-0000000000c2', pg_temp.v('dos')) $$,
  '42501', null, 'Només el signant d''ÀMBIT que ha signat genera el PDF final');
select ok((portal.contracte_dades_pdf_final('00000000-0000-0000-0000-0000000000c1', pg_temp.v('dos')) -> 'signants') is not null,
  'Dades per al PDF final');
select throws_ok($$ select portal.contracte_registra_pdf_final('00000000-0000-0000-0000-0000000000c1', pg_temp.v('dos'),
  'requests/' || pg_temp.v('dos') || '/altres/' || gen_random_uuid() || '.pdf', repeat('9', 64), 100) $$,
  '23514', null, 'Camí del PDF final no vàlid');
select lives_ok($$ select portal.contracte_registra_pdf_final('00000000-0000-0000-0000-0000000000c1', pg_temp.v('dos'),
  'requests/' || pg_temp.v('dos') || '/signat/' || gen_random_uuid() || '.pdf', repeat('9', 64), 100) $$, 'Es registra el PDF final');
select throws_ok($$ select portal.contracte_registra_pdf_final('00000000-0000-0000-0000-0000000000c1', pg_temp.v('dos'),
  'requests/' || pg_temp.v('dos') || '/signat/' || gen_random_uuid() || '.pdf', repeat('8', 64), 100) $$,
  '23514', null, 'Un sol PDF final per contracte');
select throws_ok($$ select portal.contracte_dades_pdf_final('00000000-0000-0000-0000-0000000000c1', pg_temp.v('dos')) $$,
  '23505', null, 'Amb el PDF final ja generat, no se''n torna a generar');
reset role;
select is((select sha256 from portal.documents where request_id = pg_temp.v('dos') and kind = 'signat'), repeat('9', 64),
  'L''empremta del PDF final queda a la base');
select is((select sha256 from portal.contracte_originals where request_id = pg_temp.v('dos')), repeat('1', 64),
  'L''original té la mateixa empremta després de tot el circuit');

-- ═══ 7. Estats i anul·lació ═════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select portal.anulla_contracte(pg_temp.v('dos'), 'Prova') $$, '23514', null,
  'Un contracte signat no es pot anul·lar (és immutable)');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select portal.anulla_contracte(pg_temp.v('anul'), 'Motiu') $$, '42501', null, 'Un gestor no pot anul·lar un contracte');
select throws_ok($$ select portal.anulla_contracte(pg_temp.v('esb'), 'Motiu') $$, '42501', null, '… ni tan sols un esborrany');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select portal.anulla_contracte(pg_temp.v('anul'), '  ') $$, '23514', null, 'L''anul·lació exigeix motiu');
reset role;
-- Un signant del contracte per anul·lar signa abans
select pg_temp.servei();
select lives_ok($$ select portal.contracte_accepta(pg_temp.v('tok_d'), true, true, '10.0.0.4', 'prova 4') $$, 'Accepta un signant del contracte per anul·lar');
select is((pg_temp.signa(pg_temp.v('tok_d'), pg_temp.signant(pg_temp.v('anul'), 1)) ->> 'estat'), 'parcialment_signat', 'Parcialment signat');
insert into t select 'tok_e', pg_temp.token(pg_temp.signant(pg_temp.v('anul'), 2));
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c2');
select lives_ok($$ select portal.anulla_contracte(pg_temp.v('anul'), 'El client ha demanat canvis al contracte') $$,
  'L''OCIC anul·la un contracte parcialment signat, amb motiu');
select lives_ok($$ select portal.anulla_contracte(pg_temp.v('esb'), 'Creat per error') $$, 'L''OCIC anul·la un esborrany, amb motiu');
reset role;
select is((select status || ' · ' || motiu_anullacio from portal.requests where id = pg_temp.v('anul')),
  'anullat · El client ha demanat canvis al contracte', 'Anul·lat amb el motiu');
select ok((select anullat_at is not null from portal.requests where id = pg_temp.v('anul')), 'Amb la data d''anul·lació');
select pg_temp.servei();
select throws_ok($$ select portal.contracte_accepta(pg_temp.v('tok_e'), true, true, '10.0.0.5', 'prova 5') $$, '42501', null,
  'Anul·lat: els enllaços pendents ja no serveixen');
select is(portal.obre_contracte_per_token((select token_hash from portal.access_tokens where id = pg_temp.v('tok_e'))), null,
  'Anul·lat: l''enllaç ja no obre el contracte');
reset role;
select is((select count(*)::int from portal.contracte_signants where request_id = pg_temp.v('anul') and signat_at is not null), 1,
  'La signatura feta abans d''anul·lar es conserva');

-- Transicions no permeses
select pg_temp.servei();
select throws_ok($$ update portal.requests set status = 'en_curs' where id = pg_temp.v('un') $$, '23514', null,
  'El contracte no passa per en_curs');
select throws_ok($$ update portal.requests set status = 'signat' where id = pg_temp.v('un') $$, '42501', null,
  'Pendent d''ÀMBIT → signat no la pot fer el servei');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ update portal.requests set status = 'actiu' where id = pg_temp.v('dos') $$, '23514', null, 'Un contracte signat no s''activa');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ update portal.requests set status = 'parcialment_signat' where id = '00000000-0000-0000-0000-0000000000e9' $$, '23514', null,
  'Els estats nous no són d''altres tipus de document');
reset role;

-- La signatura d'ÀMBIT del contracte d'un signant (per al PDF de prova)
select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select portal.contrafirma_contracte(pg_temp.v('un')) $$, 'ÀMBIT signa el contracte d''un signant');
reset role;

-- ═══ 8. Permisos i RLS ══════════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000c5');
select is((select count(*)::int from portal.contractes), 0, 'Un usuari de la web no veu cap contracte');
select is((select count(*)::int from portal.contracte_signants), 0, '… ni cap signant');
reset role;
set local role anon;
select throws_ok($$ select * from portal.contractes $$, '42501', null, 'anon no hi té accés');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from portal.contracte_signants where request_id = pg_temp.v('dos')), 2, 'El personal veu els signants');
select throws_ok($$ delete from portal.contracte_signants where request_id = pg_temp.v('esb') $$, '42501', null, 'No es pot esborrar cap signant');
select is((select count(*)::int from portal.estat_enllacos_contracte(pg_temp.v('dos'))), 0, 'Cap enllaç vigent un cop han signat tots');
reset role;
select pg_temp.servei();
select throws_ok($$ select portal.contrafirma_contracte(pg_temp.v('dos')) $$, '42501', null, 'El servei no pot cridar la signatura d''ÀMBIT');
reset role;

-- ═══ 9. Conservació ═════════════════════════════════════════════════════════
select ok(not exists (select 1 from portal.venciments() v where v.request_id in (pg_temp.v('dos'), pg_temp.v('un'))),
  'Mentre dura la relació amb el client, el contracte signat no venç');
select is((select vencut_el from portal.venciments() v where v.request_id = pg_temp.v('anul')),
  (select anullat_at from portal.requests where id = pg_temp.v('anul')) + interval '6 years',
  'Anul·lat amb alguna signatura: sis anys des de l''anul·lació');
select is((select vencut_el from portal.venciments() v where v.request_id = pg_temp.v('esb')),
  (select anullat_at from portal.requests where id = pg_temp.v('esb')) + interval '12 months',
  'Anul·lat sense cap signatura: les regles generals de les no signades');
select pg_temp.com('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select portal.fixa_fi_relacio('00000000-0000-0000-0000-0000000000d1', '2018-03-31') $$, 'L''OCIC fixa la fi de la relació');
reset role;
select is((select vencut_el from portal.venciments() v where v.request_id = pg_temp.v('dos')),
  ('2018-03-31'::timestamp at time zone 'Europe/Andorra') + interval '6 years', 'Venç sis anys després de la fi de la relació');
select is((select causa from portal.venciments() v where v.request_id = pg_temp.v('dos')), 'fi de la relació (contracte)', 'Causa del venciment');
select pg_temp.servei();
select ok(exists (select 1 from portal.bloqueja_vencudes(false) b where b.request_id = pg_temp.v('dos')), 'Es bloqueja en vèncer');
reset role;
select ok((select destruir_despres_de = bloquejat_at + interval '3 years' from portal.requests where id = pg_temp.v('dos')),
  'Després, el bloqueig general de 3 anys');
select pg_temp.com('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from portal.contractes where request_id = pg_temp.v('dos')), 0, 'Bloquejat: desapareix del panell');
select is((select count(*)::int from portal.contracte_signants where request_id = pg_temp.v('dos')), 0, '… també els signants');
reset role;
alter table portal.requests disable trigger valida_estat;
update portal.requests set bloquejat_at = now() - interval '4 years', destruir_despres_de = now() - interval '1 year'
 where id = pg_temp.v('dos');
alter table portal.requests enable trigger valida_estat;
select pg_temp.servei();
insert into t select 'des', portal.destrueix_solicitud(pg_temp.v('dos'))::text;
reset role;
select is(((select v from t where k = 'des')::jsonb -> 'files_esborrades' ->> 'contracte_signants')::int, 2, 'Destrucció: s''esborren els signants');
select is(((select v from t where k = 'des')::jsonb -> 'files_esborrades' ->> 'contracte_originals')::int, 1, '… l''original');
select is(((select v from t where k = 'des')::jsonb -> 'files_esborrades' ->> 'contracte_contrafirmes')::int, 1, '… la signatura d''ÀMBIT');
select is(((select v from t where k = 'des')::jsonb -> 'files_esborrades' ->> 'contractes')::int, 1, '… i el contracte');
select is((select count(*)::int from portal.audit_log where entitat in ('contractes', 'contracte_originals', 'contracte_signants', 'contracte_contrafirmes')
           and detalls <> '{"purgat": true}'::jsonb
           and entitat_id not in (select id from portal.contractes union all select id from portal.contracte_originals
                                  union all select id from portal.contracte_signants union all select id from portal.contracte_contrafirmes)), 0,
  'A l''auditoria, els detalls del contracte destruït queden purgats');
select ok(exists (select 1 from portal.firmes_ambit), 'La firma d''ÀMBIT no es destrueix amb el contracte');

-- ═══ 10. Auditoria ══════════════════════════════════════════════════════════
select ok((select count(*) from portal.audit_log where entitat = 'contracte_contrafirmes' and accio = 'INSERT'
           and actor = '00000000-0000-0000-0000-0000000000c1') >= 1, 'La signatura d''ÀMBIT queda a l''auditoria amb el seu autor');
select ok(exists (select 1 from portal.audit_log where entitat = 'contracte_originals' and accio = 'INSERT'
           and actor = '00000000-0000-0000-0000-0000000000c3'), 'El registre de l''original consta fet pel gestor');

select * from finish();
rollback;
