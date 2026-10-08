-- Proves del KYC i la protecció de dades (base de dades)
-- Execució local: supabase test db
begin;
select plan(120);

-- ─── Dades de prova (com a postgres) ────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'ocic@test.local'),
  ('00000000-0000-0000-0000-0000000000e3', 'gestor@test.local'),
  ('00000000-0000-0000-0000-0000000000e5', 'web@test.local');
insert into portal.staff_profiles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'ocic'),
  ('00000000-0000-0000-0000-0000000000e3', 'gestor');
insert into portal.clients (id, party_type, nom_mostrat, referencia_client) values
  ('00000000-0000-0000-0000-0000000000c1', 'pf', 'Client KYC PF', 'KPF-1'),
  ('00000000-0000-0000-0000-0000000000c2', 'pj', 'Client KYC PJ, SL', 'KPJ-1'),
  ('00000000-0000-0000-0000-0000000000c3', 'pf', 'Client Prohibit', 'KIR-1');

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

-- Respostes vàlides de persona física (com les que desa el servei)
create function pg_temp.dades_pf(nac text default 'ES', ppe boolean default false) returns jsonb language sql as $$
  select jsonb_build_object(
    'identificacio', jsonb_build_object('nom', 'Client KYC PF', 'nacionalitats', jsonb_build_array(nac), 'pais_residencia', 'AD', 'doc_caducitat', '2031-01-01'),
    'representacio', jsonb_build_object('actua', false),
    'activitat', jsonb_build_object('tipus', 'sense', 'sense', 'jubilat'),
    'ppe', jsonb_build_object('exerceix', ppe, 'familiar', false),
    'sancions', jsonb_build_object('residencia_ru_by', false, 'actua_ru_by', false),
    'declaracions', jsonb_build_object('d1', true, 'd2', true, 'd3', true, 'd4', true))
$$;
grant execute on function pg_temp.dades_pf(text, boolean) to public;

-- ═══ 1. Estructura ══════════════════════════════════════════════════════════
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'portal.kyc_formularis'::regclass, 'portal.kyc_adjunts'::regclass, 'portal.pdp_consentiments'::regclass,
  'portal.kyc_validacions'::regclass, 'portal.paisos_risc'::regclass, 'portal.firmes_ocic'::regclass, 'portal.config_kyc'::regclass)),
  'RLS activat a totes les taules noves');
select is((select count(*)::int from portal.paisos_risc where baixa_at is null and referencia = 'CT-01/2026'), 26, 'Llista UE (CT-01/2026): 26 països');
select is((select count(*)::int from portal.paisos_risc where baixa_at is null and referencia = 'CT-03/2026'), 25, 'Llista GAFI (CT-03/2026): 25 països');
select is((select string_agg(pais, ',' order by pais) from portal.paisos_risc where categoria = 'prohibicio_total'), 'IR,KP,MM',
  'Prohibició total (CT-03/2026): Corea del Nord, Iran i Myanmar');
select is((select public from storage.buckets where id = 'portal-firmes'), false, 'El bucket de les firmes de l''OCIC és privat');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and qual like '%portal-firmes%'), 0,
  'Cap política d''accés al bucket portal-firmes (només el servei)');

-- ═══ 2. Creació (personal) ══════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000e5');
select throws_ok($$ select portal.crea_kyc('00000000-0000-0000-0000-0000000000c1') $$, '42501', null, 'Un usuari de la web no pot crear un KYC');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
insert into t select 'kyc', portal.crea_kyc('00000000-0000-0000-0000-0000000000c1');
insert into t select 'kycpj', portal.crea_kyc('00000000-0000-0000-0000-0000000000c2');
insert into t select 'kycir', portal.crea_kyc('00000000-0000-0000-0000-0000000000c3');
reset role;
insert into t select 'pdp', pdp_request_id from portal.kyc_formularis where request_id = pg_temp.v('kyc');
insert into t select 'pdppj', pdp_request_id from portal.kyc_formularis where request_id = pg_temp.v('kycpj');
insert into t select 'pdpir', pdp_request_id from portal.kyc_formularis where request_id = pg_temp.v('kycir');
select is((select document_type::text || ' ' || template_version from portal.requests where id = pg_temp.v('kyc')), 'kyc_pf KYC-PF v1', 'Persona física → kyc_pf, KYC-PF v1');
select is((select document_type::text || ' ' || template_version from portal.requests where id = pg_temp.v('kycpj')), 'kyc_pj KYC-PJ v1', 'Persona jurídica → kyc_pj, KYC-PJ v1');
select is((select document_type::text || ' ' || template_version from portal.requests where id = pg_temp.v('pdp')), 'pdp PDP v1', 'La PDP enllaçada → pdp, PDP v1');

select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select portal.crea_kyc('00000000-0000-0000-0000-0000000000c1') $$, '23505', null, 'No es pot crear un segon KYC pendent per al mateix client');
select throws_ok($$ update portal.kyc_formularis set dades = '{"x": 1}' where request_id = pg_temp.v('kyc') $$,
  '42501', null, 'El personal no pot escriure les respostes del client');
select throws_ok($$ update portal.requests set status = 'anullat', motiu_anullacio = 'x' where id = pg_temp.v('kycir') $$,
  '42501', null, 'Un gestor no pot anul·lar un KYC (només l''OCIC)');
-- Enviar (personal): KYC i PDP
update portal.requests set status = 'enviat' where id in (pg_temp.v('kyc'), pg_temp.v('pdp'), pg_temp.v('kycpj'), pg_temp.v('pdppj'), pg_temp.v('kycir'), pg_temp.v('pdpir'));
reset role;
select is(pg_temp.estat(pg_temp.v('pdp')), 'enviat', 'El personal envia el KYC i la PDP');

-- ═══ 3. Client (servei): token, desada, documents ═══════════════════════════
insert into portal.access_tokens (request_id, token_hash, expira_at) values
  (pg_temp.v('kyc'),   repeat('a', 64), now() + interval '7 days'),
  (pg_temp.v('kycpj'), repeat('b', 64), now() + interval '7 days'),
  (pg_temp.v('kycir'), repeat('c', 64), now() + interval '7 days');
insert into t select 'tok', id from portal.access_tokens where token_hash = repeat('a', 64);
insert into t select 'tokpj', id from portal.access_tokens where token_hash = repeat('b', 64);
insert into t select 'tokir', id from portal.access_tokens where token_hash = repeat('c', 64);

select pg_temp.servei();
select is((portal.obre_kyc_per_token(repeat('a', 64)) ->> 'document_type'), 'kyc_pf', 'El servei obre el KYC amb el token');
select is(pg_temp.estat(pg_temp.v('kyc')) || '/' || pg_temp.estat(pg_temp.v('pdp')), 'en_curs/en_curs', 'Obrir passa el KYC i la PDP a en_curs');
select ok(portal.obre_kyc_per_token(repeat('f', 64)) is null, 'Token inexistent → null');
select ok(portal.obre_kyc_per_token(repeat('b', 64)) is not null and portal.obre_kyc_per_token(repeat('c', 64)) is not null, 'S''obren els altres dos KYC');
select lives_ok($$ select portal.kyc_desa(pg_temp.v('tok'), pg_temp.dades_pf()) $$, 'Desada automàtica de les respostes');
select is((select string_agg(tipus, ',' order by tipus) from portal.kyc_documents_requerits(pg_temp.v('kyc'))), 'domicili,fons,identitat,residencia',
  'Documents obligatoris PF (resident estranger, sense activitat)');
select lives_ok($$ select portal.kyc_desa(pg_temp.v('tok'), pg_temp.dades_pf('ES', true)) $$, 'Desada amb PPE');
select ok((select bool_or(tipus = 'patrimoni') from portal.kyc_documents_requerits(pg_temp.v('kyc'))), 'Amb PPE cal el justificant de l''origen del patrimoni');
select lives_ok($$ select portal.kyc_desa(pg_temp.v('tok'), pg_temp.dades_pf()) $$, 'Torna a desar sense PPE');
select throws_ok($$ select portal.kyc_registra_adjunt(pg_temp.v('tok'), 'requests/' || pg_temp.v('kyc') || '/adjunts/00000000-0000-0000-0000-000000000001.pdf', repeat('1', 64), 10, 'application/pdf', 'escriptura', null, 'x.pdf') $$,
  '22023', null, 'Un tipus de document de PJ no s''admet en un KYC de PF');
select throws_ok($$ select portal.kyc_registra_adjunt(pg_temp.v('tok'), 'requests/' || pg_temp.v('kycpj') || '/adjunts/00000000-0000-0000-0000-000000000001.pdf', repeat('1', 64), 10, 'application/pdf', 'identitat', null, 'x.pdf') $$,
  '22023', null, 'No es pot registrar un fitxer d''una altra sol·licitud');
select lives_ok($$
  select portal.kyc_registra_adjunt(pg_temp.v('tok'), 'requests/' || pg_temp.v('kyc') || '/adjunts/00000000-0000-0000-0000-00000000000' || n || '.pdf',
                                   repeat(n::text, 64), 100, 'application/pdf', t, null, t || '.pdf')
  from (values (1, 'identitat'), (2, 'domicili'), (3, 'residencia')) x(n, t) $$, 'Registra 3 dels 4 documents obligatoris');
select is((select string_agg(tipus, ',') from portal.kyc_documents_pendents(pg_temp.v('kyc'))), 'fons', 'Pendent: el justificant de l''origen dels fons');

-- Intent de signar amb un document pendent
select throws_ok($$
  select portal.registra_signatura_kyc(pg_temp.v('tok'), now(), null, null,
    jsonb_build_object('empremta', portal.empremta_kyc(pg_temp.v('kyc'), 'Client KYC PF', null, 'Andorra'), 'signatari_nom', 'Client KYC PF', 'lloc', 'Andorra',
      'imatge_path', 'requests/' || pg_temp.v('kyc') || '/evidencies/a.png', 'imatge_sha256', repeat('a', 64), 'imatge_mida', 100,
      'pdf_path', 'requests/' || pg_temp.v('kyc') || '/signat/a.pdf', 'pdf_sha256', repeat('b', 64), 'pdf_mida', 100),
    jsonb_build_object('empremta', portal.empremta_pdp(pg_temp.v('pdp'), 'Client KYC PF', null, 'Andorra', false), 'signatari_nom', 'Client KYC PF', 'lloc', 'Andorra',
      'imatge_path', 'requests/' || pg_temp.v('pdp') || '/evidencies/a.png', 'imatge_sha256', repeat('c', 64), 'imatge_mida', 100,
      'pdf_path', 'requests/' || pg_temp.v('pdp') || '/signat/a.pdf', 'pdf_sha256', repeat('d', 64), 'pdf_mida', 100, 'consentiment_comercial', false)) $$,
  '23514', null, 'No es pot passar a signat amb un document obligatori pendent');
select lives_ok($$ select portal.kyc_registra_adjunt(pg_temp.v('tok'), 'requests/' || pg_temp.v('kyc') || '/adjunts/00000000-0000-0000-0000-000000000004.pdf', repeat('4', 64), 100, 'application/pdf', 'fons', null, 'fons.pdf') $$,
  'Registra el darrer document obligatori');

-- Declaració sense marcar
select lives_ok($$ select portal.kyc_desa(pg_temp.v('tok'), jsonb_set(pg_temp.dades_pf(), '{declaracions,d2}', 'false')) $$, 'Desa amb una declaració sense marcar');
create function pg_temp.signa(tok text, k text, p text, firma_pdp text default 'c') returns jsonb language sql as $$
  select portal.registra_signatura_kyc(pg_temp.v(tok), now(), '10.0.0.1', 'Prova pgTAP',
    jsonb_build_object('empremta', portal.empremta_kyc(pg_temp.v(k), 'Signant', null, 'Andorra'), 'signatari_nom', 'Signant', 'lloc', 'Andorra',
      'imatge_path', 'requests/' || pg_temp.v(k) || '/evidencies/a.png', 'imatge_sha256', repeat('a', 64), 'imatge_mida', 100,
      'pdf_path', 'requests/' || pg_temp.v(k) || '/signat/a.pdf', 'pdf_sha256', repeat('b', 64), 'pdf_mida', 100),
    jsonb_build_object('empremta', portal.empremta_pdp(pg_temp.v(p), 'Signant', null, 'Andorra', true), 'signatari_nom', 'Signant', 'lloc', 'Andorra',
      'imatge_path', 'requests/' || pg_temp.v(p) || '/evidencies/a.png', 'imatge_sha256', repeat(firma_pdp, 64), 'imatge_mida', 100,
      'pdf_path', 'requests/' || pg_temp.v(p) || '/signat/a.pdf', 'pdf_sha256', repeat('d', 64), 'pdf_mida', 100, 'consentiment_comercial', true))
$$;
grant execute on function pg_temp.signa(text, text, text, text) to public;
select throws_ok($$ select pg_temp.signa('tok', 'kyc', 'pdp') $$, '23514', null, 'No es pot passar a signat amb una declaració sense marcar');
select lives_ok($$ select portal.kyc_desa(pg_temp.v('tok'), pg_temp.dades_pf()) $$, 'Desa les respostes completes');
select throws_ok($$ select pg_temp.signa('tok', 'kyc', 'pdp', 'a') $$, '22023', null, 'Les dues signatures (KYC i PDP) han de ser diferents');
select throws_ok($$
  select portal.registra_signatura_kyc(pg_temp.v('tok'), now(), null, null,
    jsonb_build_object('empremta', repeat('0', 64)), jsonb_build_object('empremta', repeat('0', 64), 'consentiment_comercial', false, 'imatge_sha256', 'x')) $$,
  '40001', null, 'Si les dades han canviat (empremta diferent), no es pot signar');
select lives_ok($$ select pg_temp.signa('tok', 'kyc', 'pdp') $$, 'Signatura del KYC i de la PDP en una sola transacció');
select is(pg_temp.estat(pg_temp.v('kyc')) || '/' || pg_temp.estat(pg_temp.v('pdp')), 'signat/signat', 'KYC pendent de validació (signat) i PDP signada');
select is((select count(*)::int from portal.signatures where request_id in (pg_temp.v('kyc'), pg_temp.v('pdp'))), 2, 'Dues signatures separades');
select is((select count(*)::int from portal.documents where request_id in (pg_temp.v('kyc'), pg_temp.v('pdp')) and kind = 'signat'), 2, 'Dos PDF separats');
select is((select consentiment_comercial::text from portal.clients where id = '00000000-0000-0000-0000-0000000000c1'), 'true', 'Consentiment comercial desat al client');
select ok((select usat_at is not null from portal.access_tokens where id = pg_temp.v('tok')), 'El token queda consumit');
select throws_ok($$ select portal.kyc_desa(pg_temp.v('tok'), pg_temp.dades_pf()) $$, '42501', null, 'Un cop signat, el formulari ja no es pot desar');
select throws_ok($$ update portal.kyc_adjunts set retirat_at = now() where request_id = pg_temp.v('kyc') $$, '42501', null, 'Un cop signat, els documents ja no es poden treure');
select throws_ok($$ update portal.pdp_consentiments set consentiment_comercial = false where request_id = pg_temp.v('pdp') $$, '42501', null, 'El consentiment signat no es pot modificar');
select throws_ok($$ update portal.requests set status = 'actiu' where id = pg_temp.v('kyc') $$, '42501', null, 'El servei no pot validar un KYC');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), '{"nivell": "normal"}') $$, '42501', null, 'El servei no pot cridar valida_kyc');
select throws_ok($$ insert into portal.documents (request_id, kind, storage_path, sha256, mida_bytes, mime)
  values (pg_temp.v('kyc'), 'validat', 'requests/' || pg_temp.v('kyc') || '/validat/00000000-0000-0000-0000-000000000009.pdf', repeat('9', 64), 1, 'application/pdf') $$,
  '42501', null, 'No hi pot haver PDF validat sense la validació de l''OCIC');
reset role;

-- ═══ 4. Marques automàtiques ════════════════════════════════════════════════
-- PJ amb un beneficiari efectiu PPE, un altre resident a Rússia i un trust
select pg_temp.servei();
select lives_ok($$ select portal.kyc_desa(pg_temp.v('tokpj'), jsonb_build_object(
  'societat', jsonb_build_object('pais_constitucio', 'AD', 'pais_activitat', 'AD', 'data_constitucio', to_char(current_date - 30, 'YYYY-MM-DD')),
  'representants', jsonb_build_array(jsonb_build_object('id', '11111111-1111-1111-1111-111111111111', 'nom', 'BE Política', 'actua_com', 'apoderat')),
  'socis', jsonb_build_array(
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-000000000001', 'nom', 'BE Política', 'tipus', 'pf', 'percentatge', '40'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-000000000002', 'nom', 'Holding Prova, SA', 'tipus', 'pj', 'percentatge', '60'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-000000000003', 'nom', 'BE  rus', 'tipus', 'pf', 'percentatge', '50', 'soci_de', 'aaaaaaaa-0000-0000-0000-000000000002'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0000-000000000004', 'nom', 'Pere Prova Inversor', 'tipus', 'pf', 'percentatge', '50', 'soci_de', 'aaaaaaaa-0000-0000-0000-000000000002')),
  'beneficiaris', jsonb_build_array(
    jsonb_build_object('id', '22222222-2222-2222-2222-222222222222', 'nom', 'BE Política', 'nacionalitats', jsonb_build_array('FR'), 'pais_residencia', 'FR',
                       'representant_id', '11111111-1111-1111-1111-111111111111', 'ppe', jsonb_build_object('exerceix', true)),
    jsonb_build_object('id', '33333333-3333-3333-3333-333333333333', 'nom', 'BE Rus', 'nacionalitats', jsonb_build_array('RU'), 'pais_residencia', 'RU',
                       'ppe', jsonb_build_object('exerceix', false, 'familiar', false))),
  'trust', jsonb_build_object('forma_part', true),
  'sancions', jsonb_build_object('establert_ru_by', true, 'actua_ru_by', false),
  'declaracio_beneficiaris', true,
  'declaracions', jsonb_build_object('d1', true, 'd2', true, 'd3', true, 'd4', true))) $$, 'Desa un KYC de PJ amb PPE, Rússia i trust');
reset role;
create function pg_temp.codis(k text) returns text language sql as $$
  select string_agg(distinct m ->> 'codi', ',' order by m ->> 'codi') from jsonb_array_elements(portal.kyc_marques(pg_temp.v(k))) m
$$;
grant execute on function pg_temp.codis(text) to public;
select is(pg_temp.codis('kycpj'), 'be_no_declarat,pais_risc,ppe,russia_belarus,trust',
  'Marques PJ: beneficiari no declarat, PPE, país de risc (Rússia a CT-01/2026), Rússia o Belarús i trust');
select is((select string_agg(nom || '=' || percentatge, ',' order by percentatge desc, nom) from portal.kyc_participacions(pg_temp.v('kycpj'))),
  'BE Política=40.00,BE  rus=30.00,Pere Prova Inversor=30.00', 'Participació directa i indirecta de cada persona física (40 %; 60 % × 50 % = 30 %)');
select is((select string_agg(nom || '=' || percentatge, ',') from portal.kyc_be_no_declarats(pg_temp.v('kycpj'))),
  'Pere Prova Inversor=30.00', 'Pere Prova Inversor (30 % indirecte) no és a la llista de beneficiaris efectius (el nom es compara sense majúscules ni espais de més)');
select ok((select bool_or(m ->> 'detall' like 'Pere Prova Inversor: 30 %%') from jsonb_array_elements(portal.kyc_marques(pg_temp.v('kycpj'))) m
           where m ->> 'codi' = 'be_no_declarat'), 'Marca per a l''OCIC amb el nom i el percentatge');
select is((select string_agg(tipus || coalesce(':' || left(persona, 4), ''), ',' order by tipus, persona) from portal.kyc_documents_requerits(pg_temp.v('kycpj'))),
  'escriptura,identitat:1111,identitat:3333,nrt,patrimoni:2222,poder:1111,registre_be,trust,vigencia',
  'Documents PJ: el beneficiari que és també representant fa servir el document d''identitat del representant');
select pg_temp.servei();
select throws_like($$ select pg_temp.signa('tokpj', 'kycpj', 'pdppj') $$, '%beneficiaris efectius no declarats%',
  'No es pot passar a signat amb una persona de més del 25 % no declarada');
reset role;
select is(pg_temp.codis('kyc'), null, 'PF sense marques');
select pg_temp.servei();
select lives_ok($$ select portal.kyc_desa(pg_temp.v('tokir'), pg_temp.dades_pf('IR')) $$, 'PF amb nacionalitat iraniana');
reset role;
select is(pg_temp.codis('kycir'), 'pais_risc,prohibicio_total', 'Iran: país de risc (CT-01/2026) i prohibició total (CT-03/2026)');

-- ═══ 5. Validació de l'OCIC ═════════════════════════════════════════════════
-- Evidència de sancions (la registra el servei en nom de l'OCIC)
select pg_temp.servei();
select throws_ok($$ select portal.kyc_registra_evidencia('00000000-0000-0000-0000-0000000000e3', pg_temp.v('kyc'),
  'requests/' || pg_temp.v('kyc') || '/ocic/00000000-0000-0000-0000-0000000000aa.pdf', repeat('e', 64), 10, 'application/pdf') $$,
  '42501', null, 'Un gestor no pot adjuntar l''evidència de sancions');
insert into t select 'ev', portal.kyc_registra_evidencia('00000000-0000-0000-0000-0000000000e1', pg_temp.v('kyc'),
  'requests/' || pg_temp.v('kyc') || '/ocic/00000000-0000-0000-0000-0000000000aa.pdf', repeat('e', 64), 10, 'application/pdf');
reset role;
-- Evidència "falsa": un document del client (no de la carpeta ocic/)
insert into t select 'adj', document_id from portal.kyc_adjunts where request_id = pg_temp.v('kyc') limit 1;

create function pg_temp.val(nivell text, ev text default 'ev', alta boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('nivell', nivell, 'justificacio', 'Prova', 'verificacio_via', 'presencial',
    'verificacio_data', current_date, 'verificacio_persona', 'OCIC', 'sancions_data', current_date,
    'sancions_llistes_marcades', jsonb_build_array('onu', 'cp_1_2026', 'decret_182_2026', 'ct_02_2016'),
    'sancions_altres', 'OFAC (prova)', 'sancions_resultat', 'Sense coincidències', 'sancions_evidencia_id', pg_temp.v(ev))
    || case when alta then jsonb_build_object('alta_direccio_nom', 'Direcció', 'alta_direccio_data', current_date) else '{}'::jsonb end
$$;
grant execute on function pg_temp.val(text, text, boolean) to public;

select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), pg_temp.val('normal')) $$, '42501', null, 'Un gestor no pot validar');
select throws_ok($$ insert into portal.kyc_validacions (request_id, nivell, justificacio, verificacio_via, verificacio_data, verificacio_persona,
  sancions_data, sancions_llistes, sancions_resultat, sancions_evidencia_id)
  values (pg_temp.v('kyc'), 'normal', 'x', 'presencial', current_date, 'x', current_date, 'x', 'x', pg_temp.v('ev')) $$,
  '42501', null, 'Un gestor no pot inserir una validació');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), pg_temp.val('normal', 'adj')) $$, '23514', null,
  'L''evidència de sancions ha de ser un adjunt de l''OCIC (no un document del client)');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), pg_temp.val('normal') - 'justificacio') $$, '23514', null, 'La justificació és obligatòria');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), pg_temp.val('normal') || '{"sancions_llistes_marcades": ["onu", "cp_1_2026", "decret_182_2026"]}') $$,
  '23514', null, 'Totes les llistes de sancions fixes s''han de marcar');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), pg_temp.val('normal') || '{"sancions_llistes_marcades": ["onu", "cp_1_2026", "decret_182_2026", "ct_02_2016", "inventada"]}') $$,
  '22023', null, 'Una llista de sancions desconeguda es rebutja');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), pg_temp.val('normal') || '{"verificacio_data": "2099-01-01"}') $$, '23514', null,
  'La data de verificació no pot ser futura');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kycpj'), pg_temp.val('normal')) $$, '23514', null, 'Només es pot validar un KYC signat');
-- Una validació sense el pas a actiu falla en acabar la transacció
savepoint s1;
select throws_ok($$
  insert into portal.kyc_validacions (request_id, nivell, justificacio, verificacio_via, verificacio_data, verificacio_persona,
    sancions_data, sancions_llistes, sancions_resultat, sancions_evidencia_id)
  values (pg_temp.v('kyc'), 'normal', 'x', 'presencial', current_date, 'x', current_date, 'x', 'x', pg_temp.v('ev'));
  set constraints portal.kyc_validacio_amb_estat immediate $$,
  '23514', null, 'Una validació inserida directament sense passar a validat no es pot desar');
rollback to savepoint s1;
select lives_ok($$ select portal.valida_kyc(pg_temp.v('kyc'), pg_temp.val('simplificada')) $$, 'Sense marques, l''OCIC pot aplicar diligència simplificada');
reset role;
select is(pg_temp.estat(pg_temp.v('kyc')), 'actiu', 'KYC validat (actiu)');
select is((select propera_revisio from portal.kyc_validacions where request_id = pg_temp.v('kyc')),
  ((now() at time zone 'Europe/Andorra')::date + interval '5 years')::date, 'Risc reduït: propera revisió a 5 anys');
select is((select sancions_llistes from portal.kyc_validacions where request_id = pg_temp.v('kyc')),
  'Llista consolidada del Consell de Seguretat de l''ONU; Resolució 1/2026 de la Comissió Permanent (capítol novè de la Llei 14/2017); '
  || 'Decret 182/2026, annexos 1 i 2 (Llei 5/2022); Comunicat tècnic CT-02/2016, annex; OFAC (prova)',
  'Les llistes de sancions es desen amb el text fix i les altres llistes');
select is((select validat_per from portal.kyc_validacions where request_id = pg_temp.v('kyc')), '00000000-0000-0000-0000-0000000000e1'::uuid,
  'La validació registra l''OCIC (no el que arribi a la petició)');
select throws_ok($$ update portal.kyc_validacions set nivell = 'normal' $$, '42501', null, 'La validació no es pot modificar');
select throws_ok($$ delete from portal.kyc_validacions $$, '42501', null, 'La validació no es pot esborrar');

-- Prohibició total: no es pot validar i queda registrat
select pg_temp.servei();
select lives_ok($$ select portal.kyc_registra_adjunt(pg_temp.v('tokir'), 'requests/' || pg_temp.v('kycir') || '/adjunts/00000000-0000-0000-0000-0000000000' || n || '.pdf',
  repeat(to_hex(n % 16), 64), 100, 'application/pdf', t, null, t || '.pdf')
  from (values (11, 'identitat'), (12, 'domicili'), (13, 'residencia'), (14, 'fons')) x(n, t) $$, 'Documents del KYC prohibit');
select lives_ok($$ select pg_temp.signa('tokir', 'kycir', 'pdpir') $$, 'El client prohibit signa (no se li comunica res)');
insert into t select 'evir', portal.kyc_registra_evidencia('00000000-0000-0000-0000-0000000000e1', pg_temp.v('kycir'),
  'requests/' || pg_temp.v('kycir') || '/ocic/00000000-0000-0000-0000-0000000000bb.pdf', repeat('f', 64), 10, 'application/pdf');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select is((portal.valida_kyc(pg_temp.v('kycir'), pg_temp.val('reforcada', 'evir', true)) ->> 'motiu'), 'prohibicio_total',
  'País de prohibició total: l''OCIC no pot validar');
select throws_ok($$ insert into portal.kyc_validacions (request_id, nivell, justificacio, verificacio_via, verificacio_data, verificacio_persona,
  sancions_data, sancions_llistes, sancions_resultat, sancions_evidencia_id, alta_direccio_nom, alta_direccio_data)
  values (pg_temp.v('kycir'), 'reforcada', 'x', 'presencial', current_date, 'x', current_date, 'x', 'x', pg_temp.v('evir'), 'D', current_date) $$,
  '42501', null, 'Ni inserint directament la validació');
reset role;
select is(pg_temp.estat(pg_temp.v('kycir')), 'signat', 'El KYC prohibit continua sense validar');
select ok((select count(*) >= 1 from portal.audit_log where accio = 'VALIDACIO_DENEGADA' and entitat_id = pg_temp.v('kycir')
           and actor = '00000000-0000-0000-0000-0000000000e1'), 'L''intent queda registrat a audit_log');

-- Marques: simplificada impossible i alta direcció obligatòria (es treu temporalment l'Iran de les llistes)
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ select portal.treu_pais_risc(id, 'Prova') from portal.paisos_risc where pais = 'IR' and baixa_at is null $$,
  'L''OCIC treu un país de les llistes (versionat)');
select is(pg_temp.codis('kycir'), null, 'Sense l''Iran a les llistes, el KYC ja no té marques');
select lives_ok($$ select portal.afegeix_pais_risc('UE', 'CT-01/2026', 'IR', 'Iran', 'risc') $$, 'L''OCIC torna a afegir l''Iran com a país de risc');
select is(pg_temp.codis('kycir'), 'pais_risc', 'Ara només és país de risc');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kycir'), pg_temp.val('simplificada', 'evir', true)) $$, '23514', null,
  'Diligència simplificada impossible amb marques');
select throws_ok($$ select portal.valida_kyc(pg_temp.v('kycir'), pg_temp.val('normal', 'evir', false)) $$, '23514', null,
  'Amb un país de risc cal l''autorització de l''alta direcció');
select lives_ok($$ select portal.valida_kyc(pg_temp.v('kycir'), pg_temp.val('reforcada', 'evir', true)) $$, 'Amb l''alta direcció, es valida');
reset role;
select is((select propera_revisio from portal.kyc_validacions where request_id = pg_temp.v('kycir')),
  ((now() at time zone 'Europe/Andorra')::date + interval '1 year')::date, 'Risc alt: propera revisió a 1 any');
select is((select marques -> 0 ->> 'referencia' from portal.kyc_validacions where request_id = pg_temp.v('kycir')), 'CT-01/2026',
  'La validació desa una còpia de les marques amb la referència del comunicat');

-- Llistes: gestor no; files no s'esborren; només la baixa
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select portal.afegeix_pais_risc('UE', 'X', 'ES', 'Espanya', 'risc') $$, '42501', null, 'Un gestor no pot modificar les llistes');
select throws_ok($$ select * from portal.revisions_kyc() $$, '42501', null, 'Un gestor no veu les revisions KYC');
select throws_ok($$ select * from portal.firmes_ocic $$, '42501', null, 'El personal no pot llegir la taula de firmes de l''OCIC');
reset role;
select throws_ok($$ delete from portal.paisos_risc where pais = 'IR' $$, '42501', null, 'Les files de les llistes no es poden esborrar');
select throws_ok($$ update portal.paisos_risc set nom = 'Canviat' where pais = 'AO' and llista = 'UE' $$, '42501', null, 'Una fila de la llista no es pot editar');

-- ═══ 6. Revisió periòdica ═══════════════════════════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from portal.revisions_kyc(400) where request_id = pg_temp.v('kycir')), 1, 'Revisions KYC: surt el KYC que venç en un any');
select is((select count(*)::int from portal.revisions_kyc(90)), 0, 'Revisions KYC: cap venciment en 90 dies');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select portal.crea_kyc('00000000-0000-0000-0000-0000000000c3', pg_temp.v('kyc')) $$, '23514', null,
  'Una revisió només es pot fer a partir d''un KYC validat del mateix client');
insert into t select 'rev', portal.crea_kyc('00000000-0000-0000-0000-0000000000c1', pg_temp.v('kyc'), 'Fet rellevant (prova)');
reset role;
select is((select dades #>> '{identificacio,nom}' from portal.kyc_formularis where request_id = pg_temp.v('rev')), 'Client KYC PF',
  'La revisió es preomple amb les respostes del KYC validat');
select ok((select not (dades ? 'declaracions') from portal.kyc_formularis where request_id = pg_temp.v('rev')),
  'La revisió no copia les declaracions (cal tornar-les a fer)');
select is((select revisio_de from portal.kyc_formularis where request_id = pg_temp.v('rev')), pg_temp.v('kyc'), 'La revisió apunta al KYC anterior');
select is((select string_agg(tipus, ',' order by tipus) from portal.kyc_adjunts_a_copiar('00000000-0000-0000-0000-0000000000e3', pg_temp.v('rev'))),
  'identitat,residencia', 'Es copien només els documents que no caduquen (identitat vigent, residència)');
select is(pg_temp.estat(pg_temp.v('kyc')), 'actiu', 'El KYC anterior es conserva intacte');

-- ═══ 7. Client: fi de la relació i consentiment ═════════════════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select portal.fixa_fi_relacio('00000000-0000-0000-0000-0000000000c1', current_date) $$, '42501', null,
  'Un gestor no pot fixar la fi de la relació');
select throws_ok($$ update portal.clients set consentiment_comercial = true, consentiment_comercial_at = now() + interval '1 day' where id = '00000000-0000-0000-0000-0000000000c3' $$,
  '42501', null, 'El personal no pot registrar un consentiment');
select lives_ok($$ select portal.anota_retirada_consentiment('00000000-0000-0000-0000-0000000000c1', current_date, 'Per correu') $$,
  'El personal anota la retirada del consentiment');
select throws_ok($$ select portal.anota_retirada_consentiment('00000000-0000-0000-0000-0000000000c1', current_date, 'Una altra') $$, 'P0002', null,
  'No es pot anotar una retirada d''un consentiment ja retirat');
reset role;

-- ═══ 8. Conservació (dates simulades amb venciments(p_ara)) ═════════════════
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ select portal.fixa_fi_relacio('00000000-0000-0000-0000-0000000000c1', current_date) $$, 'L''OCIC fixa la fi de la relació (avui)');
reset role;
create function pg_temp.venc(k text, ara timestamptz) returns boolean language sql as $$
  select exists (select 1 from portal.venciments(ara) x where x.request_id = pg_temp.v(k) and x.vencut_el <= ara)
$$;
select ok(not pg_temp.venc('kyc', now() + interval '4 years 11 months'), 'KYC: no venç abans de 5 anys des de la fi de la relació');
select ok(pg_temp.venc('kyc', now() + interval '5 years 1 day'), 'KYC: venç als 5 anys de la fi de la relació');
select ok(not pg_temp.venc('pdp', now() + interval '5 years 11 months'), 'PDP: no venç abans de 6 anys');
select ok(pg_temp.venc('pdp', now() + interval '6 years 1 day'), 'PDP: venç als 6 anys de la fi de la relació');
select ok(not pg_temp.venc('kycir', now() + interval '50 years'), 'KYC sense fi de relació: no venç mai');
select is(portal.termini_bloqueig_de(pg_temp.v('kyc')), interval '0', 'KYC: sense termini de bloqueig (destrucció directa)');
select is(portal.termini_bloqueig_de(pg_temp.v('pdp')), interval '3 years', 'PDP: bloqueig de 3 anys abans de destruir');
-- KYC no signat i anul·lat: 12 mesos (com la resta de no signades)
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select portal.anulla_kyc(pg_temp.v('rev'), '') $$, '23514', null, 'Anul·lar un KYC exigeix motiu');
select lives_ok($$ select portal.anulla_kyc(pg_temp.v('rev'), 'Prova') $$, 'L''OCIC anul·la un KYC (i la PDP no signada)');
reset role;
select ok(pg_temp.venc('rev', now() + interval '12 months 1 day') and not pg_temp.venc('rev', now() + interval '11 months'),
  'KYC no signat i anul·lat: venç als 12 mesos');
-- Retenció d'un KYC signat abans que venci (ampliació de la UIFAND)
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ select portal.activa_retencio(pg_temp.v('kyc'), 'Ampliació UIFAND (prova)') $$, 'L''OCIC pot retenir un KYC signat no bloquejat');
select throws_ok($$ select portal.activa_retencio(pg_temp.v('pdp'), 'x') $$, 'P0002', null, 'La PDP no bloquejada no es pot retenir (com la resta)');
reset role;

-- ═══ 9. Auditoria ═══════════════════════════════════════════════════════════
select ok((select bool_and(detalls #>> '{canvis,dades,despres}' like 'sha256:%') from portal.audit_log
           where entitat = 'kyc_formularis' and accio = 'UPDATE' and detalls #> '{canvis,dades}' is not null),
  'A l''auditoria, les respostes queden com a empremta (sha256), no senceres');
select ok((select count(*) > 0 from portal.audit_log where entitat = 'paisos_risc' and accio = 'UPDATE'
           and actor = '00000000-0000-0000-0000-0000000000e1'), 'Els canvis a les llistes queden a l''auditoria amb l''OCIC com a actor');

select * from finish();
rollback;
