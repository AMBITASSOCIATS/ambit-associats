-- =============================================================================
-- Portal de signatura de clients ÀMBIT · Fase 1 · Pas G
-- Altes de personal. Es busquen per email a auth.users; si no existeixen,
-- s'avisa i no es creen.
-- =============================================================================

do $$
declare
  alta record;
  v_user_id uuid;
begin
  for alta in
    select * from (values
      ('mpaleari@ambit.ad', 'ocic'::portal.staff_role),
      ('info@ambit.ad',     'gestor'::portal.staff_role)
    ) as t (email, role)
  loop
    select id into v_user_id from auth.users where lower(email) = alta.email;

    if v_user_id is null then
      raise warning 'Portal: no existeix cap usuari amb l''email %; no s''ha donat d''alta.', alta.email;
    else
      insert into portal.staff_profiles (user_id, role)
      values (v_user_id, alta.role)
      on conflict (user_id) do nothing;
      raise notice 'Portal: % donat d''alta com a %.', alta.email, alta.role;
    end if;
  end loop;
end;
$$;
