-- Proves de la comunicació de dades personals i familiars al pagador (IRPF)
-- Execució local: supabase test db
begin;
select plan(139);

-- ─── Dades de prova (com a postgres) ────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ocic-irpf@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'gestor-irpf@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'web-irpf@test.local');
insert into portal.staff_profiles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'ocic'),
  ('00000000-0000-0000-0000-0000000000a3', 'gestor');
insert into portal.clients (id, party_type, nom_mostrat, referencia_client) values
  ('00000000-0000-0000-0000-0000000000b1', 'pj', 'Pagadora Prova, SL', 'PIR-1'),
  ('00000000-0000-0000-0000-0000000000b2', 'pj', 'Altra Pagadora, SA', null),
  ('00000000-0000-0000-0000-0000000000b3', 'pf', 'Pagador Persona Física', null);

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
grant execute on function pg_temp.v(text), pg_temp.estat(uuid) to public;

-- Respostes vàlides (com les que desa el servei després de netejar-les)
create function pg_temp.dades(nom text, estat text default 'solter', disc boolean default false, consent boolean default false,
                              efectes text default '2026-01-01') returns jsonb language sql as $$
  select jsonb_build_object(
    'comunicacio', jsonb_build_object('tipus', 'inicial', 'modifica', '[]'::jsonb),
    'perceptor', jsonb_build_object('nom', nom, 'nrt', 'F-111111-A', 'document', 'X1234567', 'domicili', 'Carrer Prova, 1', 'incapacitat', false),
    'estat_civil', jsonb_build_object('estat', estat, 'des_de', ''),
    'descendents', case when disc then jsonb_build_array(jsonb_build_object('nom', 'Fill Prova', 'any_naixement', '2012', 'conviu', true,
                     'rendes_superiors', false, 'discapacitat', true, 'persones', '2')) else '[]'::jsonb end,
    'ascendents', '[]'::jsonb, 'tutelats', '[]'::jsonb,
    'altres', jsonb_build_object(),
    'data_efectes', efectes,
    'declaracions', jsonb_build_object('d1', true, 'd2', true, 'd3', true, 'd4', true, 'consentiment', consent))
$$;
grant execute on function pg_temp.dades(text, text, boolean, boolean, text) to public;

-- Signatura del perceptor (i, si cal, la recepció) amb les empremtes correctes
create function pg_temp.signa(tok uuid, req uuid, nom text, recepcio boolean default false) returns jsonb language sql as $$
  select portal.registra_signatura_irpf(tok, now(), '10.0.0.1', 'prova',
    jsonb_build_object('empremta', portal.empremta_irpf(req, nom, 'Andorra la Vella'), 'signatari_nom', nom, 'lloc', 'Andorra la Vella',
      'imatge_path', 'requests/' || req || '/evidencies/p.png', 'imatge_sha256', repeat('a', 64), 'imatge_mida', 100,
      'pdf_path', 'requests/' || req || '/signat/' || gen_random_uuid() || '.pdf', 'pdf_sha256', repeat('b', 64), 'pdf_mida', 100),
    case when recepcio then jsonb_build_object(
      'empremta', portal.empremta_irpf_recepcio_de(req, portal.empremta_irpf(req, nom, 'Andorra la Vella'), nom, 'Administrador únic'),
      'nom', nom, 'carrec', 'Administrador únic',
      'imatge_path', 'requests/' || req || '/evidencies/r.png', 'imatge_sha256', repeat('c', 64), 'imatge_mida', 100) end)
$$;
grant execute on function pg_temp.signa(uuid, uuid, text, boolean) to public;

-- Càlcul tal com el registra portal-irpf-personal
create function pg_temp.calcul(req uuid, efectes date, pct numeric, anterior uuid default null, mode text default 'comunicacio',
                               coneixement date default null)
  returns uuid language sql as $$
  select portal.irpf_registra_calcul('00000000-0000-0000-0000-0000000000a3', req,
    jsonb_build_object('exercici', extract(year from efectes)::int, 'data_efectes', efectes, 'mode', mode,
      'retribucions', 60000, 'cotitzacions', 0, 'calcul_anterior', anterior, 'data_coneixement', coneixement,
      'percentatge', pct, 'percentatge_aplicat', pct, 'regularitzat', false,
      'parametres', portal.irpf_parametres_json(extract(year from efectes)::int), 'detall', jsonb_build_object('passos', '[]'::jsonb)),
    jsonb_build_object('path', 'requests/' || req || '/intern/' || gen_random_uuid() || '.pdf', 'sha256', repeat('e', 64), 'mida', 100))
$$;
grant execute on function pg_temp.calcul(uuid, date, numeric, uuid, text, date) to public;

-- ═══ 1. Estructura ══════════════════════════════════════════════════════════
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'portal.irpf_pagadors'::regclass, 'portal.irpf_perceptors'::regclass, 'portal.irpf_comunicacions'::regclass,
  'portal.irpf_recepcions'::regclass, 'portal.irpf_parametres'::regclass, 'portal.irpf_calculs'::regclass)),
  'RLS activat a totes les taules noves');
select is((select minim_personal::text || ' ' || minim_incapacitat || ' ' || limit_conjuge || ' ' || tipus || ' ' || salari_minim
           from portal.irpf_parametres where exercici = 2025), '24000.00 30000.00 40000.00 10.00 17367.96',
  'Paràmetres de l''exercici 2025 (valors de la plantilla)');
select is((select termini_irpf from portal.config_conservacio), interval '6 years', 'Conservació IRPF: fi de les rendes + 6 anys');

-- ═══ 2. Creació des d'un client pagador ═════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000a5');
select throws_ok($$ select portal.irpf_crea('00000000-0000-0000-0000-0000000000b1',
  '{"nom":"X","nrt":"F-1","email":"x@x.ad"}', '{"denominacio":"P","nrt":"L-1","domicili":"D"}') $$,
  '42501', null, 'Un usuari de la web no pot crear una comunicació');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select portal.irpf_crea('00000000-0000-0000-0000-0000000000b1',
  '{"nom":"Perceptor Solter","nrt":"f-111111-a","email":"solter@test.local"}', null) $$,
  '23514', null, 'Sense les dades del pagador no es pot crear');
insert into t select 'solter', portal.irpf_crea('00000000-0000-0000-0000-0000000000b1',
  '{"nom":"Perceptor Solter","nrt":"f-111111-a","email":"Solter@Test.local"}',
  '{"denominacio":"Pagadora Prova, SL","nrt":"l-700000-x","domicili":"Av. Prova, 1, Andorra la Vella"}');
insert into t select 'casat', portal.irpf_crea('00000000-0000-0000-0000-0000000000b1',
  '{"nom":"Perceptor Casat","nrt":"F-222222-B","email":"casat@test.local"}', null);
insert into t select 'admin', portal.irpf_crea('00000000-0000-0000-0000-0000000000b1',
  '{"nom":"Administradora Única","nrt":"F-333333-C","email":"admin@test.local","es_representant":true,"inici_relacio":"2026-03-01","relacio_laboral":false}', null);
select throws_ok($$ select portal.irpf_crea('00000000-0000-0000-0000-0000000000b1',
  '{"nom":"Perceptor Solter","nrt":"F-111111-A","email":"solter@test.local"}', null) $$,
  '23505', null, 'El mateix NRT no es pot donar d''alta dues vegades per al mateix pagador');
reset role;
insert into t select 'p_solter', perceptor_id from portal.irpf_comunicacions where request_id = pg_temp.v('solter');
insert into t select 'p_casat', perceptor_id from portal.irpf_comunicacions where request_id = pg_temp.v('casat');
insert into t select 'p_admin', perceptor_id from portal.irpf_comunicacions where request_id = pg_temp.v('admin');

select is((select document_type::text || ' ' || template_version || ' ' || status from portal.requests where id = pg_temp.v('solter')),
  'irpf_comunicacio IRPF-COM v1 esborrany', 'Tipus irpf_comunicacio, plantilla IRPF-COM v1, en esborrany');
select is((select inici_relacio::text || ' ' || relacio_laboral from portal.irpf_perceptors where id = pg_temp.v('p_admin')), '2026-03-01 false',
  'Es desa l''inici de la relació (o el primer pagament) i si és laboral (termini de la comunicació inicial, arts. 31.a i 31.b)');
select is((select relacio_laboral from portal.irpf_perceptors where id = pg_temp.v('p_solter')), true, 'Per defecte, relació laboral');
select is((select count(*)::int from portal.irpf_perceptors where client_id = '00000000-0000-0000-0000-0000000000b1'), 3,
  'Un pagador pot tenir diversos perceptors');
select is((select nrt || ' ' || email from portal.irpf_perceptors where id = pg_temp.v('p_solter')), 'F-111111-A solter@test.local',
  'NRT en majúscules i correu en minúscules');
select is((select pagador ->> 'nrt' from portal.irpf_comunicacions where request_id = pg_temp.v('solter')), 'L-700000-X',
  'La comunicació desa les dades del pagador');
select is((select dades #>> '{comunicacio,tipus}' || ' ' || (dades #>> '{perceptor,nom}') from portal.irpf_comunicacions where request_id = pg_temp.v('solter')),
  'inicial Perceptor Solter', 'Preomplerta: comunicació inicial i dades del perceptor');
select is((select string_agg(doble_signatura::text, ',' order by doble_signatura) from portal.irpf_comunicacions
           where request_id in (pg_temp.v('solter'), pg_temp.v('admin'))), 'false,true',
  'Doble signatura només si el perceptor és el representant del pagador');

select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select portal.irpf_crea('00000000-0000-0000-0000-0000000000b1', jsonb_build_object('id', pg_temp.v('p_solter')), null) $$,
  '23505', null, 'Una sola comunicació pendent per perceptor');
select throws_ok($$ select portal.irpf_crea('00000000-0000-0000-0000-0000000000b2', jsonb_build_object('id', pg_temp.v('p_solter')),
  '{"denominacio":"Altra Pagadora, SA","nrt":"L-800000-Y","domicili":"Escaldes"}') $$,
  '23514', null, 'El perceptor d''un pagador no es pot fer servir en un altre');
select throws_ok($$ update portal.irpf_comunicacions set doble_signatura = true where request_id = pg_temp.v('solter') $$,
  '42501', null, 'La doble signatura no es pot canviar després de crear-la');
select throws_ok($$ update portal.irpf_comunicacions set dades = '{"x":1}' where request_id = pg_temp.v('solter') $$,
  '42501', null, 'El personal no pot escriure les respostes del perceptor');
select throws_ok($$ update portal.irpf_perceptors set client_id = '00000000-0000-0000-0000-0000000000b2' where id = pg_temp.v('p_solter') $$,
  '42501', null, 'Un perceptor no pot canviar de pagador');
-- Enviar (personal)
update portal.requests set status = 'enviat' where id in (pg_temp.v('solter'), pg_temp.v('casat'), pg_temp.v('admin'));
reset role;
select is(pg_temp.estat(pg_temp.v('solter')), 'enviat', 'El personal envia la comunicació');

-- ═══ 3. Perceptor (servei): token, desada, signatura ════════════════════════
insert into portal.access_tokens (request_id, token_hash, expira_at) values
  (pg_temp.v('solter'), repeat('1', 64), now() + interval '7 days'),
  (pg_temp.v('casat'),  repeat('2', 64), now() + interval '7 days'),
  (pg_temp.v('admin'),  repeat('3', 64), now() + interval '7 days');
insert into t select 'tok_solter', id from portal.access_tokens where token_hash = repeat('1', 64);
insert into t select 'tok_casat', id from portal.access_tokens where token_hash = repeat('2', 64);
insert into t select 'tok_admin', id from portal.access_tokens where token_hash = repeat('3', 64);

select pg_temp.servei();
select is(portal.obre_irpf_per_token(repeat('1', 64)) ->> 'mode', 'perceptor', 'El servei obre la comunicació en mode perceptor');
select is(pg_temp.estat(pg_temp.v('solter')), 'en_curs', 'Obrir passa la comunicació a en_curs');
select ok(portal.obre_irpf_per_token(repeat('9', 64)) is null, 'Token inexistent → null');
select ok(portal.obre_kyc_per_token(repeat('1', 64)) is null, 'El token d''una comunicació IRPF no obre cap KYC');
select ok(portal.obre_irpf_per_token(repeat('2', 64)) is not null and portal.obre_irpf_per_token(repeat('3', 64)) is not null,
  'S''obren les altres dues comunicacions');
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_solter'), pg_temp.dades('Perceptor Solter')) $$, 'Desada automàtica de les respostes');
select is((select data_efectes from portal.irpf_comunicacions where request_id = pg_temp.v('solter')), '2026-01-01'::date,
  'La data d''efectes es desa amb les respostes');
select throws_ok($$ select portal.irpf_desa(pg_temp.v('tok_solter'), '[]'::jsonb) $$, '22023', null, 'Respostes que no són un objecte → error');
select throws_ok($$ select portal.irpf_crea_token_recepcio('00000000-0000-0000-0000-0000000000a3', pg_temp.v('solter'), repeat('8', 64), now() + interval '1 day') $$,
  '23514', null, 'No hi ha enllaç de recepció abans de la signatura del perceptor');

-- Declaració sense marcar → no es pot signar
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_solter'), jsonb_set(pg_temp.dades('Perceptor Solter'), '{declaracions,d3}', 'false')) $$,
  'Desa amb una declaració sense marcar');
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_solter'), pg_temp.v('solter'), 'Perceptor Solter') $$,
  '23514', null, 'No es pot signar amb una declaració sense marcar');
-- Sense data d'efectes → no es pot signar
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_solter'), pg_temp.dades('Perceptor Solter', efectes => '')) $$, 'Desa sense data d''efectes');
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_solter'), pg_temp.v('solter'), 'Perceptor Solter') $$,
  '23514', null, 'No es pot signar sense data d''efectes');
-- Empremta diferent → no es pot signar
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_solter'), pg_temp.dades('Perceptor Solter')) $$, 'Desa les respostes completes');
select throws_ok($$ select portal.registra_signatura_irpf(pg_temp.v('tok_solter'), now(), null, null,
  jsonb_build_object('empremta', repeat('0', 64), 'signatari_nom', 'Perceptor Solter', 'lloc', 'Andorra la Vella',
    'imatge_path', 'x', 'imatge_sha256', repeat('a', 64), 'imatge_mida', 1, 'pdf_path', 'y', 'pdf_sha256', repeat('b', 64), 'pdf_mida', 1), null) $$,
  '40001', null, 'Empremta que no correspon a les dades desades → no es pot signar');
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_solter'), pg_temp.v('solter'), 'Perceptor Solter', true) $$,
  '22023', null, 'Un perceptor que no és el representant no pot signar la recepció');
select lives_ok($$ select pg_temp.signa(pg_temp.v('tok_solter'), pg_temp.v('solter'), 'Perceptor Solter') $$, 'Signa el perceptor (apartat 11)');
select is(pg_temp.estat(pg_temp.v('solter')), 'signat', 'Signada pel perceptor: pendent de la recepció pel pagador');
select ok((select usat_at is not null from portal.access_tokens where id = pg_temp.v('tok_solter')), 'El token del perceptor queda consumit');
select ok(portal.obre_irpf_per_token(repeat('1', 64)) is null, 'L''enllaç del perceptor ja no s''obre');
select throws_ok($$ select portal.irpf_desa(pg_temp.v('tok_solter'), pg_temp.dades('Perceptor Solter')) $$,
  '42501', null, 'Després de signar, les respostes ja no es poden desar');
select is((select string_agg(kind::text, ',' order by kind::text) from portal.documents where request_id = pg_temp.v('solter')),
  'evidencies,signat', 'Signatura: imatge de la firma i PDF signat');
reset role;

-- Consentiment de l'art. 9.2.a: obligatori només si hi ha discapacitat o dependència
select pg_temp.servei();
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_casat'), pg_temp.dades('Perceptor Casat', 'casat', true, false)) $$,
  'Desa amb un descendent amb discapacitat i sense el consentiment');
select ok(not portal.irpf_declaracions_completes(pg_temp.v('casat')), 'Amb discapacitat, el consentiment és obligatori');
select ok(portal.irpf_requereix_consentiment(pg_temp.dades('X', disc => true)) and not portal.irpf_requereix_consentiment(pg_temp.dades('X')),
  'El consentiment només es demana si es marca alguna discapacitat o dependència');
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_casat'), pg_temp.v('casat'), 'Perceptor Casat') $$,
  '23514', null, 'Sense el consentiment no es pot signar');
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_casat'), pg_temp.dades('Perceptor Casat', 'casat', true, true)) $$, 'Desa amb el consentiment');
select lives_ok($$ select pg_temp.signa(pg_temp.v('tok_casat'), pg_temp.v('casat'), 'Perceptor Casat') $$, 'Signa el perceptor casat');

-- Doble signatura: el representant del pagador signa els dos blocs en la mateixa sessió
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_admin'), pg_temp.dades('Administradora Única')) $$, 'Desa les respostes de l''administradora');
select throws_ok($$ select pg_temp.signa(pg_temp.v('tok_admin'), pg_temp.v('admin'), 'Administradora Única') $$,
  '22023', null, 'El representant del pagador ha de signar també la recepció');
select throws_ok($$ select portal.registra_signatura_irpf(pg_temp.v('tok_admin'), now(), null, null,
  jsonb_build_object('empremta', portal.empremta_irpf(pg_temp.v('admin'), 'Administradora Única', 'Andorra la Vella'), 'signatari_nom', 'Administradora Única',
    'lloc', 'Andorra la Vella', 'imatge_path', 'x', 'imatge_sha256', repeat('a', 64), 'imatge_mida', 1, 'pdf_path', 'y', 'pdf_sha256', repeat('b', 64), 'pdf_mida', 1),
  jsonb_build_object('empremta', portal.empremta_irpf_recepcio_de(pg_temp.v('admin'), portal.empremta_irpf(pg_temp.v('admin'), 'Administradora Única', 'Andorra la Vella'), 'Administradora Única', 'Administradora'),
    'nom', 'Administradora Única', 'carrec', 'Administradora', 'imatge_path', 'z', 'imatge_sha256', repeat('a', 64), 'imatge_mida', 1)) $$,
  '22023', null, 'La recepció s''ha de signar a part (firma diferent)');
select lives_ok($$ select pg_temp.signa(pg_temp.v('tok_admin'), pg_temp.v('admin'), 'Administradora Única', true) $$,
  'L''administradora única signa la comunicació i la recepció');
select is(pg_temp.estat(pg_temp.v('admin')), 'actiu', 'Doble signatura: la comunicació queda rebuda pel pagador (actiu)');
select is((select representant_carrec || ' ' || mateixa_sessio from portal.irpf_recepcions where request_id = pg_temp.v('admin')),
  'Administrador únic true', 'Recepció en la mateixa sessió, amb el càrrec');
select is((select count(*)::int from portal.documents where request_id = pg_temp.v('admin') and kind = 'evidencies'), 2,
  'Doble signatura: dues imatges de firma');
reset role;

-- ═══ 4. Recepció pel pagador (representant amb el seu enllaç) ═══════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ insert into portal.irpf_recepcions (request_id, representant_nom, representant_carrec, signat_at, imatge_path, imatge_sha256, empremta_dades, mateixa_sessio)
  values (pg_temp.v('solter'), 'X', 'Y', now(), 'p', repeat('a', 64), repeat('b', 64), false) $$,
  '42501', null, 'El personal no pot registrar la recepció directament');
select throws_ok($$ update portal.requests set status = 'actiu' where id = pg_temp.v('solter') $$,
  '42501', null, 'El personal no pot donar per rebuda la comunicació (només la recepció signada)');
reset role;
select pg_temp.servei();
select lives_ok($$ select portal.irpf_crea_token_recepcio('00000000-0000-0000-0000-0000000000a3', pg_temp.v('solter'), repeat('4', 64), now() + interval '7 days') $$,
  'Enllaç del representant del pagador (comunicació signada)');
reset role;
insert into t select 'tok_rec', id from portal.access_tokens where token_hash = repeat('4', 64);
select pg_temp.servei();
select is(portal.obre_irpf_per_token(repeat('4', 64)) ->> 'mode', 'recepcio', 'L''enllaç s''obre en mode recepció');
select ok(portal.obre_irpf_per_token(repeat('4', 64)) -> 'signatura' ->> 'signatari_nom' = 'Perceptor Solter', 'El representant veu qui ha signat');
select throws_ok($$ select portal.irpf_desa(pg_temp.v('tok_rec'), pg_temp.dades('Altre')) $$,
  '42501', null, 'Amb l''enllaç de recepció no es poden canviar les respostes');
select throws_ok($$ select portal.registra_recepcio_irpf(pg_temp.v('tok_rec'), now(), null, null,
  jsonb_build_object('empremta', repeat('0', 64), 'nom', 'Gerent', 'carrec', 'Gerent')) $$,
  '40001', null, 'Empremta de la recepció que no correspon → error');
select lives_ok($$ select portal.registra_recepcio_irpf(pg_temp.v('tok_rec'), now(), '10.0.0.2', 'prova',
  jsonb_build_object('empremta', portal.empremta_irpf_recepcio(pg_temp.v('solter'), 'Gerent Prova', 'Gerent'), 'nom', 'Gerent Prova', 'carrec', 'Gerent',
    'imatge_path', 'requests/' || pg_temp.v('solter') || '/evidencies/r.png', 'imatge_sha256', repeat('d', 64), 'imatge_mida', 100,
    'pdf_path', 'requests/' || pg_temp.v('solter') || '/copia-client/' || gen_random_uuid() || '.pdf', 'pdf_sha256', repeat('e', 64), 'pdf_mida', 100)) $$,
  'El representant del pagador signa la recepció');
select is(pg_temp.estat(pg_temp.v('solter')), 'actiu', 'Rebuda pel pagador: actiu');
select ok(portal.obre_irpf_per_token(repeat('4', 64)) is null, 'L''enllaç de recepció queda consumit');
select is((select count(*)::int from portal.documents where request_id = pg_temp.v('solter') and kind = 'copia_client'), 1,
  'Còpia final amb la recepció');
select throws_ok($$ select portal.irpf_crea_token_recepcio('00000000-0000-0000-0000-0000000000a3', pg_temp.v('solter'), repeat('5', 64), now() + interval '1 day') $$,
  '23514', null, 'Un cop rebuda, no hi ha enllaç de recepció nou');
select throws_ok($$ update portal.irpf_recepcions set representant_carrec = 'Altre' where request_id = pg_temp.v('solter') $$,
  '42501', null, 'La recepció és immutable');
reset role;

-- La recepció del perceptor casat queda pendent; transicions
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ update portal.requests set status = 'retirat' where id = pg_temp.v('admin') $$,
  '23514', null, 'Una comunicació no es retira (se substitueix)');
select throws_ok($$ update portal.requests set status = 'anullat', motiu_anullacio = 'x' where id = pg_temp.v('casat') $$,
  '42501', null, 'Un gestor no pot anul·lar una comunicació signada');
reset role;

-- ═══ 5. Paràmetres per exercici (personal) ══════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from portal.irpf_parametres), 0, 'Un usuari de la web no veu els paràmetres');
update portal.irpf_parametres set tipus = 20 where exercici = 2025;
reset role;
select is((select tipus from portal.irpf_parametres where exercici = 2025), 10.00::numeric, 'Un usuari de la web no els pot canviar');
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$ insert into portal.irpf_parametres (exercici, minim_personal, minim_incapacitat, limit_conjuge, reduccio_familiar,
  coeficient_discapacitat, max_matricules, salari_minim, habitatge_percentatge, habitatge_maxim, plans_percentatge, plans_maxim, tipus,
  bonificacio_percentatge, bonificacio_maxim, despeses_percentatge, despeses_maxim, edat_descendents, edat_ascendents,
  regularitzacio_llindar, regularitzacio_maxim)
  select 2026, minim_personal, minim_incapacitat, limit_conjuge, reduccio_familiar, coeficient_discapacitat, max_matricules, 18000,
    habitatge_percentatge, habitatge_maxim, plans_percentatge, plans_maxim, tipus, bonificacio_percentatge, bonificacio_maxim,
    despeses_percentatge, despeses_maxim, edat_descendents, edat_ascendents, regularitzacio_llindar, regularitzacio_maxim
  from portal.irpf_parametres where exercici = 2025 $$, 'Un gestor crea l''exercici 2026 a partir del 2025');
select lives_ok($$ update portal.irpf_parametres set salari_minim = 18100.50 where exercici = 2026 $$, 'Un gestor edita un paràmetre');
select throws_ok($$ update portal.irpf_parametres set exercici = 2027 where exercici = 2026 $$, '42501', null, 'L''exercici no es pot canviar');
select throws_ok($$ update portal.irpf_parametres set coeficient_discapacitat = 0.5 where exercici = 2026 $$, '23514', null,
  'Valors fora de rang → error');
select throws_ok($$ delete from portal.irpf_parametres where exercici = 2026 $$, '42501', null, 'Els paràmetres no s''esborren');
reset role;
select is((select actualitzat_per from portal.irpf_parametres where exercici = 2026), '00000000-0000-0000-0000-0000000000a3'::uuid,
  'Queda qui els ha actualitzat');
select ok(exists (select 1 from portal.audit_log where entitat = 'irpf_parametres' and accio = 'UPDATE'
                  and actor = '00000000-0000-0000-0000-0000000000a3'), 'Els canvis de paràmetres queden a l''auditoria');

-- ═══ 6. Càlcul ══════════════════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select pg_temp.calcul(pg_temp.v('solter'), '2026-01-01', 4.37) $$, '42501', null,
  'El personal no pot registrar un càlcul directament (només el servei)');
reset role;
select pg_temp.servei();
select throws_ok($$ insert into portal.irpf_calculs (request_id, perceptor_id, exercici, data_efectes, mode, retribucions, cotitzacions,
  percentatge, percentatge_aplicat, regularitzat, parametres, detall, creat_per)
  values (pg_temp.v('solter'), pg_temp.v('p_solter'), 2026, '2026-01-01', 'comunicacio', 1, 0, 1, 1, false, '{}', '{}', '00000000-0000-0000-0000-0000000000a3') $$,
  '42501', null, 'Sense actor (personal) el servei no pot registrar cap càlcul');
select throws_ok($$ select pg_temp.calcul(pg_temp.v('casat'), '2026-01-01', 1.00) $$, '23514', null,
  'Amb comunicació, només si l''ha rebuda el pagador');
select lives_ok($$ select pg_temp.calcul(pg_temp.v('casat'), '2026-01-01', 8.37, null, 'sense_comunicacio') $$,
  'Sense comunicació (art. 24.4) es pot calcular encara que no s''hagi rebut');
select throws_ok($$ select portal.irpf_registra_calcul('00000000-0000-0000-0000-0000000000a3', pg_temp.v('solter'),
  jsonb_build_object('exercici', 2026, 'data_efectes', '2026-01-01', 'mode', 'comunicacio', 'retribucions', 60000, 'cotitzacions', 0,
    'percentatge', 4.37, 'percentatge_aplicat', 4.37, 'regularitzat', false,
    'parametres', portal.irpf_parametres_json(2025), 'detall', '{}'),
  jsonb_build_object('path', 'requests/' || pg_temp.v('solter') || '/intern/' || gen_random_uuid() || '.pdf', 'sha256', repeat('e', 64), 'mida', 1)) $$,
  '40001', null, 'Paràmetres que no són els de l''exercici → error');
select throws_ok($$ select pg_temp.calcul(pg_temp.v('solter'), '2027-01-01', 4.37) $$, '40001', null,
  'Exercici sense paràmetres → error');
select lives_ok($$ insert into t select 'c1', pg_temp.calcul(pg_temp.v('solter'), '2026-01-01', 4.37) $$, 'Primer càlcul del 2026');
select throws_ok($$ select pg_temp.calcul(pg_temp.v('solter'), '2026-06-01', 6.00) $$, '40001', null,
  'Un càlcul posterior ha d''indicar l''anterior del mateix exercici (regularització)');
-- Variació (art. 27.1.b): des del mes següent a aquell en què el pagador la coneix
select throws_ok($$ select pg_temp.calcul(pg_temp.v('solter'), '2026-06-01', 6.00, pg_temp.v('c1')) $$, '23514', null,
  'Una variació necessita la data en què el pagador la coneix');
select throws_ok($$ select pg_temp.calcul(pg_temp.v('solter'), '2026-06-01', 6.00, pg_temp.v('c1'), 'comunicacio', '2026-06-01') $$, '23514', null,
  'Coneguda l''1/06: no es pot aplicar el mateix mes (art. 27.1.b)');
select throws_ok($$ select pg_temp.calcul(pg_temp.v('solter'), '2026-06-01', 6.00, pg_temp.v('c1'), 'comunicacio', '2099-01-01') $$, '23514', null,
  'La data de coneixement no pot ser futura');
select lives_ok($$ insert into t select 'c2', pg_temp.calcul(pg_temp.v('solter'), '2026-06-01', 6.00, pg_temp.v('c1'), 'comunicacio', '2026-05-15') $$,
  'Coneguda el 15/05: s''aplica des de l''1/06 (segon càlcul del 2026)');
select is((select data_coneixement from portal.irpf_calculs where id = pg_temp.v('c2')), '2026-05-15'::date, 'Es desa la data de coneixement');
select is((select data_coneixement from portal.irpf_calculs where id = pg_temp.v('c1')), null, 'El primer càlcul de l''exercici no és una variació');
select is((select creat_per from portal.irpf_calculs where id = pg_temp.v('c1')), '00000000-0000-0000-0000-0000000000a3'::uuid,
  'El càlcul registra qui l''ha fet');
select ok((select empremta_comunicacio = (select empremta_dades from portal.signatures where request_id = pg_temp.v('solter'))
           from portal.irpf_calculs where id = pg_temp.v('c1')), 'El càlcul queda lligat a l''empremta de la comunicació signada');
select is((select count(*)::int from portal.documents where request_id = pg_temp.v('solter') and kind = 'intern'), 2,
  'Cada càlcul té el seu PDF intern d''ÀMBIT');
select throws_ok($$ select portal.irpf_registra_calcul('00000000-0000-0000-0000-0000000000a3', pg_temp.v('solter'), '{}',
  jsonb_build_object('path', 'requests/' || pg_temp.v('solter') || '/copia-client/x.pdf', 'sha256', repeat('e', 64), 'mida', 1)) $$,
  '22023', null, 'El PDF intern va a la seva carpeta');
select throws_ok($$ update portal.irpf_calculs set percentatge = 1 where id = pg_temp.v('c1') $$, '42501', null, 'Un càlcul no es modifica mai');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from portal.irpf_calculs where perceptor_id = pg_temp.v('p_solter')), 2, 'El personal veu els càlculs');
reset role;
-- El PDF intern d'un KYC no existeix
select pg_temp.servei();
select throws_ok($$ insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (pg_temp.v('solter'), 'validat', 'requests/' || pg_temp.v('solter') || '/validat/' || gen_random_uuid() || '.pdf', repeat('a', 64), 1, 'application/pdf') $$,
  '23514', null, 'Una comunicació IRPF no té PDF "validat" (és del KYC)');
reset role;

-- ═══ 7. Versions: dades i percentatge vigents en qualsevol data ═════════════
-- Segona comunicació (modificació, efectes 1/7/2026) i revisió anual
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
insert into t select 'mod', portal.irpf_crea('00000000-0000-0000-0000-0000000000b1', jsonb_build_object('id', pg_temp.v('p_solter')), null);
select is((select dades #>> '{comunicacio,tipus}' from portal.irpf_comunicacions where request_id = pg_temp.v('mod')), 'modificacio',
  'Amb una comunicació ja rebuda, la nova és de modificació');
update portal.requests set status = 'enviat' where id = pg_temp.v('mod');
reset role;
insert into portal.access_tokens (request_id, token_hash, expira_at) values (pg_temp.v('mod'), repeat('6', 64), now() + interval '7 days');
insert into t select 'tok_mod', id from portal.access_tokens where token_hash = repeat('6', 64);
select pg_temp.servei();
select ok(portal.obre_irpf_per_token(repeat('6', 64)) is not null, 'S''obre la modificació');
select lives_ok($$ select portal.irpf_desa(pg_temp.v('tok_mod'), jsonb_set(pg_temp.dades('Perceptor Solter', 'divorciat', efectes => '2026-07-01'),
  '{comunicacio}', '{"tipus":"modificacio","modifica":["familiars"]}')) $$, 'Desa la modificació');
select lives_ok($$ select pg_temp.signa(pg_temp.v('tok_mod'), pg_temp.v('mod'), 'Perceptor Solter') $$, 'Signa la modificació');
select lives_ok($$ select portal.irpf_crea_token_recepcio('00000000-0000-0000-0000-0000000000a3', pg_temp.v('mod'), repeat('7', 64), now() + interval '7 days') $$,
  'Enllaç de recepció de la modificació');
select lives_ok($$ select portal.registra_recepcio_irpf((select id from portal.access_tokens where token_hash = repeat('7', 64)), now(), null, null,
  jsonb_build_object('empremta', portal.empremta_irpf_recepcio(pg_temp.v('mod'), 'Gerent Prova', 'Gerent'), 'nom', 'Gerent Prova', 'carrec', 'Gerent',
    'imatge_path', 'requests/' || pg_temp.v('mod') || '/evidencies/r.png', 'imatge_sha256', repeat('d', 64), 'imatge_mida', 100,
    'pdf_path', 'requests/' || pg_temp.v('mod') || '/copia-client/' || gen_random_uuid() || '.pdf', 'pdf_sha256', repeat('e', 64), 'pdf_mida', 100)) $$,
  'Rebuda pel pagador');
reset role;
select is(pg_temp.estat(pg_temp.v('solter')), 'actiu', 'La comunicació anterior no s''esborra ni canvia d''estat');
select pg_temp.servei();
select throws_ok($$ select pg_temp.calcul(pg_temp.v('mod'), '2026-08-01', 5.00, pg_temp.v('c2'), 'comunicacio', '2026-07-05') $$, '23514', null,
  'El pagador no pot conèixer la variació d''una comunicació nova abans de rebre-la');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select is(portal.irpf_vigent(pg_temp.v('p_solter'), '2025-12-31') -> 'comunicacio', 'null'::jsonb, 'Abans de la primera data d''efectes, cap comunicació');
select is((portal.irpf_vigent(pg_temp.v('p_solter'), '2026-03-15') #>> '{comunicacio,request_id}')::uuid, pg_temp.v('solter'),
  'El 15/03/2026 s''aplicava la comunicació inicial');
select is((portal.irpf_vigent(pg_temp.v('p_solter'), '2026-03-15') #>> '{comunicacio,dades,estat_civil,estat}'), 'solter',
  '… amb les seves dades (solter)');
select is((portal.irpf_vigent(pg_temp.v('p_solter'), '2026-08-01') #>> '{comunicacio,request_id}')::uuid, pg_temp.v('mod'),
  'L''1/08/2026 s''aplicava la modificació');
select is((portal.irpf_vigent(pg_temp.v('p_solter'), '2026-08-01') #>> '{comunicacio,dades,estat_civil,estat}'), 'divorciat',
  '… amb les dades noves (divorciat)');
select is((portal.irpf_vigent(pg_temp.v('p_solter'), '2026-03-15') #>> '{calcul,percentatge_aplicat}'), '4.37',
  'El 15/03/2026 s''aplicava el 4,37 %');
select is((portal.irpf_vigent(pg_temp.v('p_solter'), '2026-08-01') #>> '{calcul,percentatge_aplicat}'), '6.00',
  'L''1/08/2026 s''aplicava el 6,00 %');

-- Revisió anual: preomplerta amb la vigent, de modificació
insert into t select 'rev', portal.irpf_revisio_anual(pg_temp.v('p_solter'));
select is((select (dades #>> '{comunicacio,tipus}') || ' ' || (dades #>> '{estat_civil,estat}') || ' ' || coalesce(dades ->> 'declaracions', 'sense declaracions')
           from portal.irpf_comunicacions where request_id = pg_temp.v('rev')), 'modificacio divorciat sense declaracions',
  'Revisió anual: modificació preomplerta amb la vigent, sense les declaracions');
select is((select revisio_de from portal.irpf_comunicacions where request_id = pg_temp.v('rev')), pg_temp.v('mod'),
  'La revisió anual parteix de la comunicació vigent');
select is((select data_efectes from portal.irpf_comunicacions where request_id = pg_temp.v('rev')),
  make_date(extract(year from portal.avui())::int + 1, 1, 1), 'Efectes proposats: l''1 de gener de l''any següent');
select throws_ok($$ select portal.irpf_revisio_anual(pg_temp.v('p_solter')) $$, '23505', null,
  'No es pot enviar una segona revisió mentre n''hi ha una de pendent');
select throws_ok($$ select portal.irpf_revisio_anual(pg_temp.v('p_casat')) $$, 'P0002', null,
  'Sense cap comunicació rebuda no hi ha revisió anual');
reset role;

-- ═══ 8. Conservació ═════════════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select portal.irpf_fixa_fi_rendes(pg_temp.v('p_solter'), current_date + 30) $$, '23514', null,
  'La fi de les rendes no pot ser futura');
reset role;
select ok(not exists (select 1 from portal.venciments() v where v.request_id in (pg_temp.v('solter'), pg_temp.v('mod'), pg_temp.v('admin'))),
  'Mentre el perceptor rep rendes, les comunicacions signades no vencen');
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select portal.irpf_fixa_fi_rendes(pg_temp.v('p_solter'), '2018-06-30') $$, 'El personal fixa la fi de les rendes');
reset role;
select is((select vencut_el from portal.venciments() v where v.request_id = pg_temp.v('solter')),
  ('2018-06-30'::timestamp at time zone 'Europe/Andorra') + interval '6 years', 'Venç sis anys després de la fi de les rendes');
select is((select causa from portal.venciments() v where v.request_id = pg_temp.v('mod')), 'fi de les rendes (IRPF)',
  'Totes les comunicacions del perceptor segueixen el mateix termini');
select is((select vencut_el from portal.venciments() v where v.request_id = pg_temp.v('rev')),
  (select updated_at from portal.requests where id = pg_temp.v('rev')) + interval '12 months',
  'Una comunicació no enviada segueix les regles generals');
select is((select vencut_el from portal.venciments() v where v.request_id = pg_temp.v('casat')),
  null, 'Signada i amb càlcul però sense fi de les rendes: no venç');

-- Bloqueig (3 anys) i destrucció
select pg_temp.servei();
select ok(exists (select 1 from portal.bloqueja_vencudes(false) b where b.request_id = pg_temp.v('solter')), 'Es bloqueja en vèncer');
reset role;
select ok((select destruir_despres_de = bloquejat_at + interval '3 years' from portal.requests where id = pg_temp.v('solter')),
  'Després, el bloqueig general de 3 anys');
select pg_temp.com('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from portal.irpf_comunicacions where request_id = pg_temp.v('solter')), 0,
  'Bloquejada: desapareix del panell');
select is((select count(*)::int from portal.irpf_calculs where request_id = pg_temp.v('solter')), 0, '… també els seus càlculs');
reset role;
-- Final del bloqueig (simulat) i destrucció de les quatre sol·licituds del perceptor
alter table portal.requests disable trigger valida_estat;
update portal.requests set bloquejat_at = now() - interval '4 years', destruir_despres_de = now() - interval '1 year'
 where id in (pg_temp.v('solter'), pg_temp.v('mod'), pg_temp.v('rev'));
alter table portal.requests enable trigger valida_estat;
select pg_temp.servei();
select ok((portal.destrueix_solicitud(pg_temp.v('solter')) -> 'files_esborrades' ->> 'irpf_calculs')::int = 2,
  'Destrucció: s''esborren els càlculs de la comunicació');
select ok(exists (select 1 from portal.irpf_perceptors where id = pg_temp.v('p_solter')), 'El perceptor es manté mentre li quedin comunicacions');
select lives_ok($$ select portal.destrueix_solicitud(pg_temp.v('mod')) $$, 'Destrueix la modificació');
select ok((portal.destrueix_solicitud(pg_temp.v('rev')) -> 'files_esborrades' ->> 'irpf_perceptors')::int = 1,
  'Amb la darrera comunicació s''esborra també el perceptor');
reset role;
select is((select count(*)::int from portal.irpf_recepcions where request_id in (pg_temp.v('solter'), pg_temp.v('mod'))), 0, 'Recepcions esborrades');
select is((select count(*)::int from portal.audit_log where entitat in ('irpf_comunicacions', 'irpf_calculs', 'irpf_perceptors', 'irpf_recepcions')
           and entitat_id in (pg_temp.v('p_solter')) and detalls <> '{"purgat": true}'::jsonb), 0,
  'A l''auditoria, els detalls del perceptor queden purgats');
select ok(exists (select 1 from portal.irpf_pagadors where client_id = '00000000-0000-0000-0000-0000000000b1'),
  'Les dades del pagador es mantenen mentre el client tingui sol·licituds');

-- ═══ 9. Redacció de l'auditoria ═════════════════════════════════════════════
select ok((select bool_and(detalls #>> '{nou,detall}' like 'sha256:%') from portal.audit_log
           where entitat = 'irpf_calculs' and accio = 'INSERT' and detalls <> '{"purgat": true}'::jsonb),
  'El detall del càlcul (amb noms de familiars) no es copia a l''auditoria: només l''empremta');

select * from finish();
rollback;
