-- Proves del secret de portal-purga generat i comprovat dins de la base
-- Execució local: supabase test db
begin;
select plan(18);

create temp table t (k text primary key, v text);
grant select on t to public;
-- El valor actual, només per poder provar la comprovació (no s'imprimeix enlloc)
insert into t select 'secret', decrypted_secret from vault.decrypted_secrets where name = 'portal_purga_secret';

create function pg_temp.com(r text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', r)::text, true);
  execute format('set local role %I', r);
end $$;

-- ─── 1. Secret generat per la migració ──────────────────────────────────────
select is((select count(*)::int from vault.secrets where name = 'portal_purga_secret'), 1, 'La migració ha creat un secret a Vault');
select matches((select v from t where k = 'secret'), '^[0-9a-f]{64}$', 'El secret és de 32 bytes aleatoris (64 caràcters hex)');

-- ─── 2. Comprovació: només cert o fals ──────────────────────────────────────
select is((select data_type from information_schema.routines where routine_schema = 'portal' and routine_name = 'secret_purga_correcte'),
  'boolean', 'secret_purga_correcte només pot retornar cert o fals');
select is((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where proname = 'secret_purga_correcte'),
  true, 'secret_purga_correcte és SECURITY DEFINER amb search_path fixat');

select pg_temp.com('service_role');
select is(portal.secret_purga_correcte((select v from t where k = 'secret')), true, 'service_role: el secret correcte → cert');
select is(portal.secret_purga_correcte(repeat('0', 64)), false, 'service_role: un altre valor → fals');
select is(portal.secret_purga_correcte(left((select v from t where k = 'secret'), 63)), false, 'service_role: el secret escapçat → fals');
select is(portal.secret_purga_correcte(''), false, 'service_role: buit → fals');
select is(portal.secret_purga_correcte(null), false, 'service_role: nul → fals');
select throws_ok($$ select portal.renova_secret_purga() $$, '42501', null, 'service_role: no pot renovar el secret');
select throws_ok($$ select portal.desa_url_purga('https://x.supabase.co/functions/v1/portal-purga') $$, '42501', null, 'service_role: no pot canviar la URL');
reset role;

select pg_temp.com('authenticated');
select throws_ok($$ select portal.secret_purga_correcte('x') $$, '42501', null, 'authenticated: no pot cridar la comprovació');
reset role;
select pg_temp.com('anon');
select throws_ok($$ select portal.secret_purga_correcte('x') $$, '42501', null, 'anon: no pot cridar la comprovació');
reset role;

-- ─── 3. Renovació i URL (només postgres, és a dir, migracions) ──────────────
select portal.renova_secret_purga();
select isnt((select decrypted_secret from vault.decrypted_secrets where name = 'portal_purga_secret'), (select v from t where k = 'secret'),
  'Renovar genera un valor nou');
select is(portal.secret_purga_correcte((select v from t where k = 'secret')), false, 'Després de renovar, l''antic ja no serveix');

select throws_ok($$ select portal.desa_url_purga('https://malicios.example/res') $$, '22023', null, 'URL que no és de portal-purga → rebutjada');
select portal.desa_url_purga('https://exemple.supabase.co/functions/v1/portal-purga');
select portal.desa_url_purga('https://exemple2.supabase.co/functions/v1/portal-purga');
select is((select count(*)::int from vault.secrets where name = 'portal_purga_url'), 1, 'La URL es desa una sola vegada (es pot actualitzar)');
select isnt(portal.llanca_purga(), null, 'Amb secret i URL a Vault, la tasca diària ja envia la petició');

select * from finish();
rollback;
