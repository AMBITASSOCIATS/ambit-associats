-- Proves de conservació, bloqueig i destrucció del portal
-- Execució local: supabase test db
begin;
select plan(125);

-- ─── Dades de prova ─────────────────────────────────────────────────────────
-- Com a postgres i amb els triggers aturats NOMÉS durant aquest bloc, per
-- poder posar dates antigues (fins a 3 anys enrere). Es tornen a activar
-- abans de la primera prova; tot es desfà amb el rollback final.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'ocic@test.local'),
  ('00000000-0000-0000-0000-0000000000e3', 'gestor@test.local'),
  ('00000000-0000-0000-0000-0000000000e5', 'web@test.local');
insert into portal.staff_profiles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'ocic'),
  ('00000000-0000-0000-0000-0000000000e3', 'gestor');

alter table portal.clients               disable trigger user;
alter table portal.requests              disable trigger user;
alter table portal.autoritzacions_carrec disable trigger user;
alter table portal.signatures            disable trigger user;
alter table portal.documents             disable trigger user;
alter table portal.access_tokens         disable trigger user;

insert into portal.clients (id, party_type, nom_mostrat, referencia_client) values
  ('00000000-0000-0000-0000-00000000c001', 'pf', 'Titular Retirat Prova', 'RET-1'),
  ('00000000-0000-0000-0000-00000000c002', 'pf', 'Client Anul·lat', 'ANU-1'),
  ('00000000-0000-0000-0000-00000000c003', 'pf', 'Client Enviat', null),
  ('00000000-0000-0000-0000-00000000c004', 'pf', 'Client Esborrany', null),
  ('00000000-0000-0000-0000-00000000c005', 'pf', 'Client Signat', 'SIG-1'),
  ('00000000-0000-0000-0000-00000000c006', 'pj', 'Client Mixt, SL', 'MIX-1');

-- f001 retirada vençuda · f002 retirada no vençuda · f003 anul·lada fa 13 mesos
-- f004 anul·lada fa 11 mesos · f005 enviada, enllaç caducat fa 13 mesos
-- f006 en curs amb enllaç vigent · f007 enviada, enllaç caducat fa 1 mes
-- f008 esborrany sense canvis fa 13 mesos · f009 esborrany amb dades tocades fa 1 mes
-- f010 signada (no venç) · f011 anul·lada fa 2 anys (client f002 compartit)
insert into portal.requests (id, client_id, document_type, template_version, idioma, status, created_at, updated_at, anullat_at) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c001', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'retirat',   now() - interval '3 years',  now() - interval '2 years',  null),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000c006', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'retirat',   now() - interval '1 year',   now() - interval '1 month',  null),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000c002', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'anullat',   now() - interval '14 months', now() - interval '13 months', now() - interval '13 months'),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000c002', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'anullat',   now() - interval '12 months', now() - interval '11 months', now() - interval '11 months'),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-00000000c003', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'enviat',    now() - interval '14 months', now() - interval '14 months', null),
  ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-00000000c003', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'en_curs',   now() - interval '20 months', now() - interval '20 months', null),
  ('00000000-0000-0000-0000-00000000f007', '00000000-0000-0000-0000-00000000c003', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'enviat',    now() - interval '2 months',  now() - interval '2 months',  null),
  ('00000000-0000-0000-0000-00000000f008', '00000000-0000-0000-0000-00000000c004', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'esborrany', now() - interval '13 months', now() - interval '13 months', null),
  ('00000000-0000-0000-0000-00000000f009', '00000000-0000-0000-0000-00000000c004', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'esborrany', now() - interval '13 months', now() - interval '13 months', null),
  ('00000000-0000-0000-0000-00000000f010', '00000000-0000-0000-0000-00000000c005', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'signat',    now() - interval '5 years',  now() - interval '5 years',  null),
  ('00000000-0000-0000-0000-00000000f011', '00000000-0000-0000-0000-00000000c006', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'anullat',   now() - interval '3 years',  now() - interval '2 years',  now() - interval '2 years'),
  -- f012 signada i mai activada (com la de prova) · f013 activa
  ('00000000-0000-0000-0000-00000000f012', '00000000-0000-0000-0000-00000000c005', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'signat',    now() - interval '1 month',  now() - interval '1 month',  null),
  ('00000000-0000-0000-0000-00000000f013', '00000000-0000-0000-0000-00000000c005', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', 'actiu',     now() - interval '1 month',  now() - interval '1 month',  null);

insert into portal.documents (id, request_id, kind, storage_path, sha256, mida_bytes, mime) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000f001', 'signat',     'requests/00000000-0000-0000-0000-00000000f001/signat/a.pdf', repeat('a', 64), 1000, 'application/pdf'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000f001', 'evidencies', 'requests/00000000-0000-0000-0000-00000000f001/evidencies/a.png', repeat('b', 64), 100, 'image/png'),
  ('00000000-0000-0000-0000-00000000d010', '00000000-0000-0000-0000-00000000f010', 'signat',     'requests/00000000-0000-0000-0000-00000000f010/signat/a.pdf', repeat('c', 64), 1000, 'application/pdf');

insert into portal.autoritzacions_carrec (id, request_id, titular_nom, titular_adreca, titular_cp_poblacio, entitat, iban_xifrat, iban_ultims4, data_alta, data_retirada, darrer_carrec, updated_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000f001', 'Titular Retirat Prova', 'Carrer Secret 1', 'AD500 Andorra la Vella', 'andbank', '\x01aa', '0100', '2023-01-01', '2024-01-01', '2024-02-01', now() - interval '2 years'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000f002', 'Mixt', 'Av. 2', 'AD700', 'creand', '\x01bb', '0200', '2025-01-01', current_date - 30, null, now() - interval '1 month'),
  ('00000000-0000-0000-0000-00000000a009', '00000000-0000-0000-0000-00000000f009', 'Esborrany tocat', null, null, null, null, null, null, null, null, now() - interval '1 month'),
  ('00000000-0000-0000-0000-00000000a012', '00000000-0000-0000-0000-00000000f012', 'Prova No Valida', 'Carrer Prova', 'AD500', 'morabanc', '\x01cc', '3456', null, null, null, now() - interval '1 month'),
  ('00000000-0000-0000-0000-00000000a013', '00000000-0000-0000-0000-00000000f013', 'Activa', 'Carrer Actiu', 'AD500', 'andbank', '\x01dd', '0100', '2026-09-01', null, null, now() - interval '1 month');

insert into portal.signatures (id, request_id, signatari_nom, lloc, signat_at, imatge_path, ip, user_agent, empremta_dades) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000f001', 'Titular Retirat Prova', 'Andorra la Vella', now() - interval '3 years',
   'requests/00000000-0000-0000-0000-00000000f001/evidencies/a.png', '10.1.2.3', 'Navegador Prova', repeat('e', 64)),
  ('00000000-0000-0000-0000-00000000b010', '00000000-0000-0000-0000-00000000f010', 'Client Signat', 'Escaldes', now() - interval '5 years',
   null, null, null, repeat('f', 64)),
  ('00000000-0000-0000-0000-00000000b012', '00000000-0000-0000-0000-00000000f012', 'Prova No Valida', 'Escaldes', now() - interval '1 month',
   null, null, null, repeat('9', 64)),
  ('00000000-0000-0000-0000-00000000b013', '00000000-0000-0000-0000-00000000f013', 'Activa', 'Escaldes', now() - interval '1 month',
   null, null, null, repeat('8', 64));

insert into portal.access_tokens (request_id, token_hash, expira_at, created_at) values
  ('00000000-0000-0000-0000-00000000f005', repeat('5', 64), now() - interval '13 months', now() - interval '14 months'),
  ('00000000-0000-0000-0000-00000000f006', repeat('6', 64), now() + interval '3 days', now() - interval '4 days'),
  ('00000000-0000-0000-0000-00000000f007', repeat('7', 64), now() - interval '1 month', now() - interval '2 months');

alter table portal.clients               enable trigger user;
alter table portal.requests              enable trigger user;
alter table portal.autoritzacions_carrec enable trigger user;
alter table portal.signatures            enable trigger user;
alter table portal.documents             enable trigger user;
alter table portal.access_tokens         enable trigger user;

-- Entrades d'auditoria amb dades personals de f001 (per comprovar la purga)
update portal.clients set nom_mostrat = 'Titular Retirat Prova' , referencia_client = 'RET-1B' where id = '00000000-0000-0000-0000-00000000c001';
update portal.autoritzacions_carrec set darrer_carrec = '2024-02-02' where id = '00000000-0000-0000-0000-00000000a001';

-- Fitxer d'una sol·licitud no bloquejada i d'una que es bloquejarà (per a la política de Storage)
insert into storage.objects (bucket_id, name) values
  ('portal-docs', 'requests/00000000-0000-0000-0000-00000000f010/signat/a.pdf'),
  ('portal-docs', 'requests/00000000-0000-0000-0000-00000000f001/signat/a.pdf');

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

create function pg_temp.vencut(r text) returns boolean language sql as $$
  select coalesce((select vencut_el <= now() from portal.venciments(now()) where request_id = r::uuid), false)
$$;

-- ─── 1. Terminis (A) ────────────────────────────────────────────────────────
select is((select termini_bloqueig from portal.config_conservacio), interval '3 years', 'Termini de bloqueig per defecte: 3 anys');
select is((select termini_no_signades from portal.config_conservacio), interval '12 months', 'Termini de les no signades: 12 mesos');

select ok(pg_temp.vencut('00000000-0000-0000-0000-00000000f001'), 'Retirada: venç a conservar_fins (passat)');
select ok(not pg_temp.vencut('00000000-0000-0000-0000-00000000f002'), 'Retirada: no venç abans de conservar_fins');
select is((select (vencut_el at time zone 'Europe/Andorra')::date from portal.venciments() where request_id = '00000000-0000-0000-0000-00000000f001'),
  '2025-03-02'::date, 'Retirada: la data de venciment és conservar_fins (darrer càrrec + 13 mesos)');
select ok(pg_temp.vencut('00000000-0000-0000-0000-00000000f003'), 'Anul·lada fa 13 mesos: venç');
select ok(not pg_temp.vencut('00000000-0000-0000-0000-00000000f004'), 'Anul·lada fa 11 mesos: no venç');
select ok((select vencut_el <= now() + interval '2 months' from portal.venciments(now() + interval '2 months')
           where request_id = '00000000-0000-0000-0000-00000000f004'), 'Anul·lada fa 11 mesos: venç d''aquí a 1 mes (data simulada)');
select ok(pg_temp.vencut('00000000-0000-0000-0000-00000000f005'), 'Enviada amb l''enllaç caducat fa 13 mesos: venç');
select ok(not exists (select 1 from portal.venciments() where request_id = '00000000-0000-0000-0000-00000000f006'),
  'En curs amb enllaç vigent: no venç');
select ok(exists (select 1 from portal.venciments(now() + interval '13 months') where request_id = '00000000-0000-0000-0000-00000000f006'),
  'En curs: quan l''enllaç caduqui (data simulada) passa a comptar el termini');
select ok(not pg_temp.vencut('00000000-0000-0000-0000-00000000f007'), 'Enviada amb l''enllaç caducat fa 1 mes: no venç');
select ok(pg_temp.vencut('00000000-0000-0000-0000-00000000f008'), 'Esborrany sense canvis fa 13 mesos: venç');
select ok(not pg_temp.vencut('00000000-0000-0000-0000-00000000f009'), 'Esborrany amb dades modificades fa 1 mes: no venç');
select ok(not exists (select 1 from portal.venciments(now() + interval '50 years') where request_id = '00000000-0000-0000-0000-00000000f010'),
  'Signada i mai activada: no venç mai amb aquestes regles');

-- anullat_at: el fixa valida_estat i no és editable
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
insert into portal.requests (id, client_id, document_type, template_version, idioma, anullat_at)
values ('00000000-0000-0000-0000-00000000f099', '00000000-0000-0000-0000-00000000c005', 'autoritzacio_carrec', 'ABA-01 v1', 'ca', '2000-01-01');
reset role;
select is((select anullat_at from portal.requests where id = '00000000-0000-0000-0000-00000000f099'), null, 'anullat_at no es pot posar en crear');
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
update portal.requests set status = 'anullat' where id = '00000000-0000-0000-0000-00000000f099';
reset role;
select ok((select anullat_at = now() from portal.requests where id = '00000000-0000-0000-0000-00000000f099'), 'Passar a anul·lat fixa anullat_at');
select pg_temp.servei();
update portal.requests set anullat_at = '2000-01-01' where id = '00000000-0000-0000-0000-00000000f099';
reset role;
update portal.requests set anullat_at = '2000-01-01' where id = '00000000-0000-0000-0000-00000000f099';
select ok((select anullat_at = now() from portal.requests where id = '00000000-0000-0000-0000-00000000f099'),
  'anullat_at no es pot canviar (ni service_role ni postgres)');

-- ─── 2. Simulació i bloqueig (B, E) ─────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select * from portal.bloqueja_vencudes(false) $$, '42501', null, 'bloqueja_vencudes no es pot cridar des del navegador');
select throws_ok($$ select portal.simula_conservacio() $$, '42501', null, 'Un gestor no pot fer la simulació');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
insert into t values ('sim', portal.simula_conservacio()::text);
reset role;
select is((select jsonb_array_length(v::jsonb -> 'a_bloquejar') from t where k = 'sim'), 5,
  'Simulació (OCIC): bloquejaria les 5 vençudes');
select ok((select v not like '%Titular Retirat Prova%' from t where k = 'sim'), 'La simulació no mostra noms');

select pg_temp.servei();
select is((select count(*)::int from portal.bloqueja_vencudes(true)), 5, 'Simulació del servei: 5 a bloquejar');
reset role;
select is((select count(*)::int from portal.requests where bloquejat_at is not null), 0, 'La simulació no ha bloquejat res');

-- Per poder provar la destrucció en aquesta mateixa transacció: termini de bloqueig 0
update portal.config_conservacio set termini_bloqueig = interval '0';
select pg_temp.servei();
select results_eq(
  $$ select request_id::text from portal.bloqueja_vencudes(false) order by 1 $$,
  $$ values ('00000000-0000-0000-0000-00000000f001'), ('00000000-0000-0000-0000-00000000f003'),
            ('00000000-0000-0000-0000-00000000f005'), ('00000000-0000-0000-0000-00000000f008'),
            ('00000000-0000-0000-0000-00000000f011') $$,
  'Bloqueig: exactament les 5 vençudes');
select is((select count(*)::int from portal.bloqueja_vencudes(false)), 0, 'Bloqueig idempotent: la segona execució no fa res');
reset role;
select ok((select bool_and(bloquejat_at = now() and destruir_despres_de = bloquejat_at + interval '0')
           from portal.requests where bloquejat_at is not null), 'destruir_despres_de = bloquejat_at + termini de bloqueig');
select is((select titular_nom from portal.autoritzacions_carrec where request_id = '00000000-0000-0000-0000-00000000f001'),
  'Titular Retirat Prova', 'El bloqueig no modifica les dades');
select is((select count(*)::int from portal.documents where request_id = '00000000-0000-0000-0000-00000000f001'), 2,
  'El bloqueig no modifica els documents');

-- Camps de bloqueig no editables
select pg_temp.servei();
update portal.requests set bloquejat_at = null, destruir_despres_de = null where id = '00000000-0000-0000-0000-00000000f001';
reset role;
update portal.requests set destruir_despres_de = now() + interval '9 years' where id = '00000000-0000-0000-0000-00000000f001';
select ok((select bloquejat_at = now() and destruir_despres_de = now() from portal.requests where id = '00000000-0000-0000-0000-00000000f001'),
  'bloquejat_at i destruir_despres_de no es poden canviar (ni service_role ni postgres)');
select pg_temp.servei();
select throws_ok($$ update portal.requests set status = 'en_curs' where id = '00000000-0000-0000-0000-00000000f005' $$,
  '42501', null, 'Una sol·licitud bloquejada no pot canviar d''estat');
select is(portal.obre_per_token(repeat('5', 64)), null, 'Una sol·licitud bloquejada no s''obre per enllaç');
reset role;

-- ─── 3. Invisible per al gestor i per al panell normal de l'OCIC (B) ────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select is((select count(*)::int from portal.requests where bloquejat_at is not null), 0, 'Gestor: no veu cap sol·licitud bloquejada');
select is((select count(*)::int from portal.requests where id = '00000000-0000-0000-0000-00000000f002'), 1, 'Gestor: continua veient les no bloquejades');
select is((select count(*)::int from portal.autoritzacions_carrec where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'Gestor: no veu l''autorització bloquejada');
select is((select count(*)::int from portal.signatures where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'Gestor: no veu la firma bloquejada');
select is((select count(*)::int from portal.documents where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'Gestor: no veu els documents bloquejats');
select is((select count(*)::int from portal.clients where id = '00000000-0000-0000-0000-00000000c001'), 0, 'Gestor: no veu el client que només té sol·licituds bloquejades');
select is((select count(*)::int from portal.clients where id = '00000000-0000-0000-0000-00000000c006'), 1, 'Gestor: veu el client que encara té alguna sol·licitud no bloquejada');
select is((select count(*)::int from storage.objects where name = 'requests/00000000-0000-0000-0000-00000000f001/signat/a.pdf'), 0, 'Gestor: no pot accedir al fitxer bloquejat (Storage)');
select is((select count(*)::int from storage.objects where name = 'requests/00000000-0000-0000-0000-00000000f010/signat/a.pdf'), 1, 'Gestor: sí que accedeix als fitxers no bloquejats');
update portal.autoritzacions_carrec set darrer_carrec = current_date where request_id = '00000000-0000-0000-0000-00000000f001';
select throws_ok($$ select portal.activa_retencio('00000000-0000-0000-0000-00000000f001', 'x') $$, '42501', null, 'Gestor: no pot activar retencions');
select throws_ok($$ select * from portal.llista_bloquejades() $$, '42501', null, 'Gestor: no pot llistar les bloquejades');
reset role;
select is((select darrer_carrec from portal.autoritzacions_carrec where request_id = '00000000-0000-0000-0000-00000000f001'),
  '2024-02-02'::date, 'Gestor: no pot modificar dades bloquejades');

select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from portal.requests where bloquejat_at is not null), 0, 'OCIC (panell normal): no veu cap sol·licitud bloquejada');
select is((select count(*)::int from portal.documents where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'OCIC (panell normal): no veu els documents bloquejats');
select is((select count(*)::int from portal.audit_log where entitat_id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001')),
  0, 'OCIC (panell normal): no veu l''auditoria amb dades de les bloquejades');
select is((select count(*)::int from storage.objects where name = 'requests/00000000-0000-0000-0000-00000000f001/signat/a.pdf'), 0, 'OCIC (panell normal): no pot descarregar el fitxer bloquejat');
select is((select count(*)::int from portal.llista_bloquejades()), 5, 'OCIC: la pestanya Conservació llista les 5 bloquejades');
select ok((select count(*) from portal.propers_venciments(90) where request_id = '00000000-0000-0000-0000-00000000f004') = 1,
  'OCIC: propers venciments (90 dies) inclou l''anul·lada que venç d''aquí a 1 mes');
reset role;
select ok((select count(*) from portal.audit_log where entitat_id = '00000000-0000-0000-0000-00000000a001') > 0,
  'L''auditoria de les bloquejades continua existint (només oculta)');

-- ─── 4. Accés per requeriment d'autoritat (B) ───────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select portal.acces_requeriment('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000f001', 'm', 'a', null, null) $$,
  '42501', null, 'acces_requeriment no es pot cridar des del navegador');
reset role;
select pg_temp.servei();
select throws_ok($$ select portal.acces_requeriment('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000f001', 'Motiu', 'Batllia', null, null) $$,
  '42501', null, 'Requeriment: un gestor no hi té accés');
select throws_ok($$ select portal.acces_requeriment('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000f001', ' ', 'Batllia', null, null) $$,
  '23514', null, 'Requeriment: el motiu és obligatori');
select throws_ok($$ select portal.acces_requeriment('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000f001', 'Diligències 12/2026', null, null, null) $$,
  '23514', null, 'Requeriment: l''autoritat és obligatòria');
select throws_ok($$ select portal.acces_requeriment('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000f002', 'Motiu', 'Batllia', null, null) $$,
  'P0002', null, 'Requeriment: només per a sol·licituds bloquejades');
insert into t values ('req', portal.acces_requeriment('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000f001',
  'Diligències prèvies 12/2026', 'Batllia d''Andorra', '10.0.0.9', 'Prova')::text);
reset role;
select is((select v::jsonb -> 'autoritzacio' ->> 'titular_nom' from t where k = 'req'), 'Titular Retirat Prova', 'Requeriment: l''OCIC rep les dades bloquejades');
select ok((select not (v::jsonb -> 'autoritzacio' ? 'iban_xifrat') from t where k = 'req'), 'Requeriment: no lliura l''IBAN xifrat');
select is((select jsonb_array_length(v::jsonb -> 'documents') from t where k = 'req'), 2, 'Requeriment: llista els documents');
select is((select count(*)::int from portal.audit_log where accio = 'ACCES_REQUERIMENT' and actor = '00000000-0000-0000-0000-0000000000e1'
             and entitat_id = '00000000-0000-0000-0000-00000000f001' and detalls ->> 'autoritat' = 'Batllia d''Andorra'), 1,
  'Requeriment: l''accés queda a audit_log amb motiu i autoritat');
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from portal.audit_log where accio = 'ACCES_REQUERIMENT'), 1, 'L''OCIC veu el registre d''accessos per requeriment');
reset role;

-- ─── 5. Retenció (C) ────────────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select portal.activa_retencio('00000000-0000-0000-0000-00000000f002', 'Reclamació') $$, 'P0002', null, 'Retenció: només sobre bloquejades');
select throws_ok($$ select portal.activa_retencio('00000000-0000-0000-0000-00000000f001', '  ') $$, '23514', null, 'Retenció: el motiu és obligatori');
select lives_ok($$ select portal.activa_retencio('00000000-0000-0000-0000-00000000f001', 'Reclamació davant l''APDA') $$, 'Retenció: l''OCIC l''activa');
select throws_ok($$ select portal.activa_retencio('00000000-0000-0000-0000-00000000f001', 'Una altra') $$, '23505', null, 'Retenció: només una d''activa');
select ok((select retencio ->> 'motiu' from portal.llista_bloquejades() where request_id = '00000000-0000-0000-0000-00000000f001') like 'Reclamació%',
  'Retenció: surt a la llista de bloquejades');
reset role;
select is((select actor from portal.audit_log where entitat = 'retencions' and accio = 'INSERT'),
  '00000000-0000-0000-0000-0000000000e1'::uuid, 'Retenció: queda a audit_log amb l''OCIC com a actor');

select pg_temp.servei();
select ok(not exists (select 1 from portal.candidats_destruccio() where request_id = '00000000-0000-0000-0000-00000000f001'),
  'Retenció: la sol·licitud retinguda no és candidata a destrucció');
select throws_ok($$ select portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f001') $$, '42501', null, 'Retenció: impedeix la destrucció');
reset role;

select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select portal.retira_retencio('00000000-0000-0000-0000-00000000f001', '') $$, '23514', null, 'Retirar la retenció exigeix motiu');
select lives_ok($$ select portal.retira_retencio('00000000-0000-0000-0000-00000000f001', 'Reclamació resolta') $$, 'L''OCIC retira la retenció');
reset role;
select is((select count(*)::int from portal.audit_log where entitat = 'retencions' and accio = 'UPDATE' and actor = '00000000-0000-0000-0000-0000000000e1'), 1,
  'Retirar la retenció queda a audit_log');

-- ─── 6. Destrucció (D) ──────────────────────────────────────────────────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f001') $$, '42501', null, 'destrueix_solicitud no es pot cridar des del navegador');
reset role;
select pg_temp.servei();
select ok(exists (select 1 from portal.candidats_destruccio() where request_id = '00000000-0000-0000-0000-00000000f001'),
  'Sense retenció, torna a ser candidata');
select throws_ok($$ select portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f002') $$, '42501', null, 'No es destrueix una sol·licitud no bloquejada');
-- Encara hi ha el fitxer a Storage: no s'esborra cap fila
select throws_ok($$ select portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f001') $$, '55000', null, 'No s''esborren files mentre quedin fitxers a Storage');
reset role;
-- (els fitxers els esborra l'Edge Function amb la Storage API; aquí, com a postgres,
--  se simula que ja no hi són)
set local storage.allow_delete_query = 'true';
delete from storage.objects where name like 'requests/00000000-0000-0000-0000-00000000f001/%';

select is((select count(*)::int from portal.audit_log where entitat_id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001',
             '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001') and detalls <> '{"purgat": true}'), 6,
  'Abans: 6 entrades d''auditoria amb detalls d''aquestes entitats');
insert into t select 'audit_abans', jsonb_agg(jsonb_build_object('id', id, 'at', at, 'accio', accio, 'actor', actor) order by id)::text
  from portal.audit_log where entitat_id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001');

select pg_temp.servei();
insert into t values ('des', portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f001')::text);
reset role;

select is((select count(*)::int from portal.requests where id = '00000000-0000-0000-0000-00000000f001'), 0, 'Destrucció: la sol·licitud ja no existeix');
select is((select count(*)::int from portal.autoritzacions_carrec where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'Destrucció: autorització esborrada');
select is((select count(*)::int from portal.signatures where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'Destrucció: firma esborrada');
select is((select count(*)::int from portal.documents where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'Destrucció: documents esborrats');
select is((select count(*)::int from portal.retencions where request_id = '00000000-0000-0000-0000-00000000f001'), 0, 'Destrucció: retencions esborrades');
select is((select count(*)::int from portal.clients where id = '00000000-0000-0000-0000-00000000c001'), 0, 'Destrucció: el client sense altres sol·licituds també s''esborra');
select is((select count(*)::int from portal.audit_log where entitat_id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001',
             '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001')
             and accio <> 'DESTRUCCIO' and detalls <> '{"purgat": true}'), 0,
  'audit_log: totes les entrades d''aquestes entitats queden com {"purgat": true}');
select is((select jsonb_agg(jsonb_build_object('id', id, 'at', at, 'accio', accio, 'actor', actor) order by id)::text
             from portal.audit_log where entitat_id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001')
             and accio <> 'DESTRUCCIO'),
  (select v from t where k = 'audit_abans'), 'audit_log: la purga no toca data, acció ni actor');
select is((select count(*)::int from portal.audit_log where accio = 'DESTRUCCIO' and entitat_id = '00000000-0000-0000-0000-00000000f001'), 1,
  'audit_log: una entrada DESTRUCCIO');
select ok((select detalls::text !~* 'Titular|Carrer|Andorra la Vella|10\.1\.2\.3|Navegador|RET-1|0100|signat/a\.pdf'
             from portal.audit_log where accio = 'DESTRUCCIO' and entitat_id = '00000000-0000-0000-0000-00000000f001'),
  'DESTRUCCIO: sense cap dada personal (ni noms, adreces, IP, referència, IBAN ni camins)');
select ok((select detalls -> 'fitxers' @> jsonb_build_array(jsonb_build_object('sha256', repeat('a', 64)))
             and (detalls ->> 'fitxers_destruits')::int = 2
             and (detalls -> 'files_esborrades' ->> 'requests')::int = 1
             and (detalls -> 'files_esborrades' ->> 'clients')::int = 1
             and detalls ? 'bloquejat_at' and detalls ? 'destruit_at'
           from portal.audit_log where accio = 'DESTRUCCIO' and entitat_id = '00000000-0000-0000-0000-00000000f001'),
  'DESTRUCCIO: ids, dates, files i fitxers destruïts amb les empremtes');
select ok(not exists (select 1 from portal.audit_log where detalls::text like '%Titular Retirat Prova%'),
  'Cap entrada d''audit_log conserva el nom del titular');

-- Idempotència
select pg_temp.servei();
select is(portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f001') ->> 'ja_destruida', 'true', 'Idempotent: si ja no hi és, no fa res');
reset role;
select is((select count(*)::int from portal.audit_log where accio = 'DESTRUCCIO' and entitat_id = '00000000-0000-0000-0000-00000000f001'), 1,
  'Idempotent: no duplica l''entrada DESTRUCCIO');

-- Client compartit: es conserva
select pg_temp.servei();
select lives_ok($$ select portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f011') $$, 'Es destrueix l''anul·lada del client compartit');
reset role;
select is((select count(*)::int from portal.clients where id = '00000000-0000-0000-0000-00000000c006'), 1, 'El client amb altres sol·licituds es conserva');

-- ─── 7. Ningú pot esborrar ni modificar audit_log ni dades signades ─────────
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ delete from portal.audit_log $$, '42501', null, 'authenticated (OCIC): no pot esborrar audit_log');
select throws_ok($$ update portal.audit_log set detalls = '{"purgat": true}' $$, '42501', null, 'authenticated (OCIC): no pot modificar audit_log');
reset role;
select pg_temp.servei();
select throws_ok($$ delete from portal.audit_log $$, '42501', null, 'service_role: no pot esborrar audit_log');
select throws_ok($$ update portal.audit_log set detalls = '{"purgat": true}' $$, '42501', null, 'service_role: no pot modificar audit_log');
select throws_ok($$ delete from portal.signatures $$, '42501', null, 'service_role: no pot esborrar firmes');
reset role;
select throws_ok($$ delete from portal.audit_log where accio = 'DESTRUCCIO' $$, '42501', null, 'postgres: no pot esborrar audit_log');
select throws_ok($$ update portal.audit_log set detalls = '{"purgat": true}' where accio = 'EXPORT' or true $$, '42501', null, 'postgres: no pot modificar audit_log');
select throws_ok($$ delete from portal.signatures $$, '42501', null, 'postgres: no pot esborrar firmes');
select throws_ok($$ update portal.documents set sha256 = repeat('0', 64) $$, '42501', null, 'postgres: no pot modificar documents');
select set_config('portal.mode', 'purga', true);
select throws_ok($$ delete from portal.signatures $$, '42501', null, 'postgres amb l''indicador de purga fixat a mà: tampoc pot esborrar');
select throws_ok($$ update portal.audit_log set detalls = '{"purgat": true}' $$, '42501', null, 'postgres amb l''indicador fixat a mà: tampoc pot purgar audit_log');
select set_config('portal.mode', '', true);
select throws_ok($$ set local role portal_purga $$, '42501', null, 'postgres ja no pot actuar com a portal_purga');
select throws_ok($$ truncate portal.audit_log $$, '42501', null, 'Ningú pot buidar audit_log');

-- ─── 8. Execució automàtica (E) ─────────────────────────────────────────────
select ok(exists (select 1 from cron.job where jobname = 'portal-purga-diaria' and schedule = '30 3 * * *'), 'Tasca diària programada a pg_cron');
select is(portal.llanca_purga(), null, 'Sense els secrets a Vault, la tasca no fa res');
select pg_temp.servei();
select throws_ok($$ select portal.llanca_purga() $$, '42501', null, 'llanca_purga no es pot cridar des de l''API');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ update portal.config_conservacio set termini_bloqueig = interval '1 day' $$, '42501', null, 'Els terminis no es poden canviar des del panell');
reset role;

-- ─── 9. Anul·lar una autorització signada que no s'activarà (només OCIC) ───
update portal.config_conservacio set termini_bloqueig = interval '3 years';
select pg_temp.com('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ update portal.requests set status = 'anullat', motiu_anullacio = 'Motiu' where id = '00000000-0000-0000-0000-00000000f012' $$,
  '42501', null, 'signat → anullat: un gestor no pot');
reset role;
select pg_temp.servei();
select throws_ok($$ update portal.requests set status = 'anullat', motiu_anullacio = 'Motiu' where id = '00000000-0000-0000-0000-00000000f012' $$,
  '42501', null, 'signat → anullat: service_role tampoc');
reset role;
select pg_temp.com('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ update portal.requests set status = 'anullat' where id = '00000000-0000-0000-0000-00000000f012' $$,
  '23514', 'Cal indicar el motiu de l''anul·lació', 'signat → anullat: l''OCIC sense motiu no pot');
select throws_ok($$ update portal.requests set status = 'anullat', motiu_anullacio = '   ' where id = '00000000-0000-0000-0000-00000000f012' $$,
  '23514', null, 'signat → anullat: un motiu en blanc no serveix');
select lives_ok($$ update portal.requests set status = 'anullat', motiu_anullacio = 'Prova del circuit, no vàlida' where id = '00000000-0000-0000-0000-00000000f012' $$,
  'signat → anullat: l''OCIC amb motiu sí');
select throws_ok($$ update portal.requests set status = 'anullat', motiu_anullacio = 'Motiu' where id = '00000000-0000-0000-0000-00000000f013' $$,
  '23514', null, 'actiu → anullat continua prohibit (també per a l''OCIC)');
update portal.requests set motiu_anullacio = 'Un altre motiu' where id = '00000000-0000-0000-0000-00000000f012';
select throws_ok($$ update portal.autoritzacions_carrec set titular_nom = 'Canviat' where request_id = '00000000-0000-0000-0000-00000000f012' $$,
  '42501', null, 'Anul·lada després de signar: les dades signades continuen immutables');
reset role;
select ok((select status = 'anullat' and anullat_at = now() and motiu_anullacio = 'Prova del circuit, no vàlida'
           from portal.requests where id = '00000000-0000-0000-0000-00000000f012'),
  'Queda anul·lada, amb anullat_at del sistema i el motiu (que ja no es pot canviar)');
select ok(exists (select 1 from portal.audit_log where entitat = 'requests' and entitat_id = '00000000-0000-0000-0000-00000000f012'
                  and accio = 'UPDATE' and actor = '00000000-0000-0000-0000-0000000000e1'
                  and detalls -> 'canvis' -> 'motiu_anullacio' ->> 'despres' = 'Prova del circuit, no vàlida'
                  and detalls -> 'canvis' -> 'status' ->> 'despres' = 'anullat'),
  'L''anul·lació i el motiu queden a audit_log amb l''OCIC com a actor');
select ok(not pg_temp.vencut('00000000-0000-0000-0000-00000000f012'), 'Anul·lada avui: encara no venç');
select ok(exists (select 1 from portal.venciments(now() + interval '12 months 1 day') where request_id = '00000000-0000-0000-0000-00000000f012'
                  and vencut_el <= now() + interval '12 months 1 day'),
  'Venç als 12 mesos, com les altres anul·lades (data simulada)');
-- Per provar-ho avui: termini de les no signades i de bloqueig a 0
update portal.config_conservacio set termini_no_signades = interval '0', termini_bloqueig = interval '0';
select pg_temp.servei();
select ok(exists (select 1 from portal.bloqueja_vencudes(false) where request_id = '00000000-0000-0000-0000-00000000f012'), 'Es bloqueja com les altres');
select is(portal.destrueix_solicitud('00000000-0000-0000-0000-00000000f012') ->> 'request_id', '00000000-0000-0000-0000-00000000f012', 'I es destrueix com les altres');
reset role;
select is((select count(*)::int from portal.requests where id = '00000000-0000-0000-0000-00000000f012'), 0, 'Ja no existeix');
select is((select count(*)::int from portal.requests where id = '00000000-0000-0000-0000-00000000f013' and status = 'actiu'), 1, 'L''activa no s''ha tocat');

select * from finish();
rollback;
