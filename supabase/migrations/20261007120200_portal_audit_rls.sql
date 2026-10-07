-- =============================================================================
-- Portal de signatura de clients ÀMBIT · Fase 1 · Pas E
-- Auditoria, prohibició d'esborrat i RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funcions auxiliars de rol
-- -----------------------------------------------------------------------------
create function portal.is_staff()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from portal.staff_profiles
    where user_id = auth.uid() and actiu
  );
$$;

create function portal.is_ocic()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from portal.staff_profiles
    where user_id = auth.uid() and actiu and role = 'ocic'
  );
$$;

-- -----------------------------------------------------------------------------
-- Auditoria
-- -----------------------------------------------------------------------------
-- Els valors sensibles no es copien mai al registre: queden com "[ocult]".
create function portal.redacta(j jsonb)
  returns jsonb
  language sql
  immutable
  set search_path = ''
as $$
  select coalesce(jsonb_object_agg(
           key,
           case when key in ('iban_xifrat', 'token_hash', 'codi_hash') and value <> 'null'::jsonb
                then to_jsonb('[ocult]'::text) else value end), '{}'::jsonb)
  from jsonb_each(j);
$$;

create function portal.audita()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  nou      jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  vell     jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  capcal   jsonb;
  v_ip     inet;
  v_detall jsonb;
begin
  begin
    capcal := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := nullif(btrim(split_part(capcal ->> 'x-forwarded-for', ',', 1)), '')::inet;
  exception when others then
    v_ip := null;
  end;

  v_detall := case tg_op
    when 'INSERT' then jsonb_build_object('nou', portal.redacta(nou))
    when 'DELETE' then jsonb_build_object('anterior', portal.redacta(vell))
    else jsonb_build_object('canvis', (
      select coalesce(jsonb_object_agg(e.key, jsonb_build_object(
               'abans',   portal.redacta(jsonb_build_object(e.key, vell -> e.key)) -> e.key,
               'despres', portal.redacta(jsonb_build_object(e.key, e.value)) -> e.key)), '{}'::jsonb)
      from jsonb_each(nou) e
      where e.value is distinct from vell -> e.key and e.key <> 'updated_at'))
  end;

  insert into portal.audit_log (actor, accio, entitat, entitat_id, ip, user_agent, detalls)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    (coalesce(nou, vell) ->> 'id')::uuid,
    v_ip,
    capcal ->> 'user-agent',
    v_detall
  );
  return null;
end;
$$;

create trigger audita after insert or update or delete on portal.staff_profiles        for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.clients               for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.requests              for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.access_tokens         for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.otps                  for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.signatures            for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.documents             for each row execute function portal.audita();
create trigger audita after insert or update or delete on portal.autoritzacions_carrec for each row execute function portal.audita();

-- -----------------------------------------------------------------------------
-- Cap esborrat físic: ni DELETE ni TRUNCATE a cap taula del portal.
-- audit_log, signatures i documents tampoc admeten UPDATE.
-- Val per a tots els rols, inclòs postgres.
-- -----------------------------------------------------------------------------
create function portal.impedeix_canvi()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  raise exception 'Operació % no permesa a portal.%', tg_op, tg_table_name
    using errcode = '42501';
end;
$$;

create trigger impedeix_update_delete before update or delete on portal.audit_log
  for each row execute function portal.impedeix_canvi();

create trigger impedeix_delete before delete on portal.staff_profiles        for each row execute function portal.impedeix_canvi();
create trigger impedeix_delete before delete on portal.clients               for each row execute function portal.impedeix_canvi();
create trigger impedeix_delete before delete on portal.requests              for each row execute function portal.impedeix_canvi();
create trigger impedeix_delete before delete on portal.access_tokens         for each row execute function portal.impedeix_canvi();
create trigger impedeix_delete before delete on portal.otps                  for each row execute function portal.impedeix_canvi();
create trigger impedeix_update_delete before update or delete on portal.signatures for each row execute function portal.impedeix_canvi();
create trigger impedeix_update_delete before update or delete on portal.documents for each row execute function portal.impedeix_canvi();
create trigger impedeix_delete before delete on portal.autoritzacions_carrec for each row execute function portal.impedeix_canvi();

create trigger impedeix_truncate before truncate on portal.staff_profiles        for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.clients               for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.requests              for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.access_tokens         for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.otps                  for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.signatures            for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.documents             for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.autoritzacions_carrec for each statement execute function portal.impedeix_canvi();
create trigger impedeix_truncate before truncate on portal.audit_log             for each statement execute function portal.impedeix_canvi();

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema portal from public, anon, authenticated, service_role;
revoke all on all functions in schema portal from public, anon, authenticated, service_role;
alter default privileges in schema portal revoke all on tables    from public, anon, authenticated;
alter default privileges in schema portal revoke all on functions from public, anon, authenticated;

grant usage on schema portal to authenticated, service_role;

grant execute on function portal.is_staff(), portal.is_ocic() to authenticated, service_role;

-- Personal (authenticated + RLS): llegir, crear i modificar; mai esborrar.
-- signatures: només llegir (les firmes les crea service_role).
-- documents: llegir i crear, i només de tipus 'adjunt' (política personal_insert).
grant select, insert, update on portal.clients, portal.requests, portal.autoritzacions_carrec to authenticated;
grant select, insert         on portal.documents                                              to authenticated;
grant select                 on portal.signatures                                             to authenticated;
grant select on portal.audit_log to authenticated;
grant execute on function portal.retira_autoritzacio(uuid, date, text) to authenticated;

-- service_role (funcions de la fase 3): sense DELETE ni TRUNCATE; audit_log,
-- signatures i documents només lectura i inserció.
grant select, insert, update on all tables in schema portal to service_role;
revoke update on portal.audit_log, portal.signatures, portal.documents from service_role;

-- -----------------------------------------------------------------------------
-- RLS a totes les taules. Sense polítiques per a anon; staff_profiles,
-- access_tokens i otps queden sense cap política (només service_role).
-- -----------------------------------------------------------------------------
alter table portal.staff_profiles        enable row level security;
alter table portal.clients               enable row level security;
alter table portal.requests              enable row level security;
alter table portal.access_tokens         enable row level security;
alter table portal.otps                  enable row level security;
alter table portal.signatures            enable row level security;
alter table portal.documents             enable row level security;
alter table portal.autoritzacions_carrec enable row level security;
alter table portal.audit_log             enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'requests', 'signatures', 'documents', 'autoritzacions_carrec'] loop
    execute format('create policy personal_select on portal.%I for select to authenticated using (portal.is_staff())', t);
  end loop;
  foreach t in array array['clients', 'requests', 'autoritzacions_carrec'] loop
    execute format('create policy personal_insert on portal.%I for insert to authenticated with check (portal.is_staff())', t);
    execute format('create policy personal_update on portal.%I for update to authenticated using (portal.is_staff()) with check (portal.is_staff())', t);
  end loop;
end;
$$;

-- El personal només adjunta documents (p. ex. el poder); 'signat' i
-- 'evidencies' només els crea service_role.
create policy personal_insert on portal.documents
  for insert to authenticated
  with check (portal.is_staff() and kind = 'adjunt');

create policy ocic_select on portal.audit_log
  for select to authenticated using (portal.is_ocic());
