-- =============================================================================
-- Execució diària de portal-purga a eu-west-1 (Irlanda)
--
-- La crida de pg_net a l'Edge Function portal-purga demana la regió amb la
-- capçalera x-region, igual que el navegador (src/supabaseClient.js). La resta
-- és idèntica a 20261009100000_portal_conservacio.sql (apartat 18).
-- =============================================================================

create or replace function portal.llanca_purga()
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
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-portal-purga', v_secret, 'x-region', 'eu-west-1'),
    body := '{"simulacio": false}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke all on function portal.llanca_purga() from public, anon, authenticated, service_role;
