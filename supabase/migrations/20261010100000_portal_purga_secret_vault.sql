-- =============================================================================
-- Portal · secret de portal-purga generat i comprovat dins de la base
--
-- Abans, el secret de la crida diària (pg_cron → portal-purga) s'havia de
-- generar fora i copiar a dos llocs (secrets de les funcions i Vault). Ara:
--  · La mateixa base genera el secret a Vault (portal_purga_secret) amb
--    gen_random_bytes. El valor no apareix en cap consulta, ordre ni registre.
--  · portal-purga ja no fa servir PORTAL_PURGA_SECRET: comprova la capçalera
--    amb portal.secret_purga_correcte(), que només retorna cert o fals.
--  · La URL de portal-purga (portal_purga_url) també va a Vault; no és secreta
--    i es desa amb portal.desa_url_purga() en publicar.
-- No toca cap taula de public.
-- =============================================================================

-- Genera (o renova) el secret dins de Vault. No retorna el valor.
-- Només postgres (les migracions); ningú més la pot executar.
create function portal.renova_secret_purga()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
  v_nou text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into v_id from vault.secrets where name = 'portal_purga_secret';
  if v_id is null then
    perform vault.create_secret(v_nou, 'portal_purga_secret', 'Secret de la crida diària a portal-purga (generat a la base)');
  else
    perform vault.update_secret(v_id, v_nou);
  end if;
end;
$$;

-- Desa la URL de portal-purga a Vault (crea o actualitza). Només postgres.
create function portal.desa_url_purga(p_url text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_url !~ '^https?://[^ ]+/functions/v1/portal-purga$' then
    raise exception 'URL de portal-purga no vàlida' using errcode = '22023';
  end if;
  select id into v_id from vault.secrets where name = 'portal_purga_url';
  if v_id is null then
    perform vault.create_secret(p_url, 'portal_purga_url', 'URL de l''Edge Function portal-purga');
  else
    perform vault.update_secret(v_id, p_url);
  end if;
end;
$$;

-- Comprova la capçalera x-portal-purga contra Vault. Retorna només cert o fals,
-- mai el secret. Compara les empremtes SHA-256 (mateixa longitud sempre).
create function portal.secret_purga_correcte(p_rebut text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce((
    select length(s.decrypted_secret) >= 32
       and sha256(convert_to(s.decrypted_secret, 'UTF8')) = sha256(convert_to(coalesce(p_rebut, ''), 'UTF8'))
    from vault.decrypted_secrets s
    where s.name = 'portal_purga_secret'
  ), false);
$$;

revoke all on function portal.renova_secret_purga(), portal.desa_url_purga(text), portal.secret_purga_correcte(text)
  from public, anon, authenticated, service_role;
grant execute on function portal.secret_purga_correcte(text) to service_role;

-- Secret inicial (només si encara no n'hi ha)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'portal_purga_secret') then
    perform portal.renova_secret_purga();
  end if;
end;
$$;
