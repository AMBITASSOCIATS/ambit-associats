-- Seguretat de public.profiles i public.declaracions
--
-- Problema: la política perfil_propi (FOR ALL) deixava que qualsevol usuari
-- autenticat creés o modifiqués la seva pròpia fitxa amb estat 'actiu', eines i
-- empresa_id a voluntat. L'estat només es comprovava al navegador.
--
-- Després d'aquesta migració:
--   · L'usuari només pot modificar la columna capcalera de la seva fitxa.
--   · L'usuari només pot crear la seva fitxa com a 'pendent', 'individual',
--     sense eines i sense empresa.
--   · El maestro (actiu) veu totes les fitxes i canvia estat, eines i rol amb
--     public.maestro_actualitza_perfil(). No pot assignar el rol maestro.
--   · La creació de comptes aprovats es fa a l'Edge Function aprovar-solicitud
--     (service_role), no des del navegador.
--   · Només els usuaris en estat 'actiu' poden llegir o escriure declaracions.
--
-- No toca l'esquema portal.

-- ─── Funcions auxiliars ─────────────────────────────────────────────────────
-- SECURITY DEFINER per poder-les usar dins de polítiques de profiles sense
-- recursió de RLS.

create or replace function public.es_actiu()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and estat = 'actiu'
  );
$$;

create or replace function public.es_maestro()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'maestro' and estat = 'actiu'
  );
$$;

revoke all on function public.es_actiu()   from public, anon;
revoke all on function public.es_maestro() from public, anon;
grant execute on function public.es_actiu()   to authenticated;
grant execute on function public.es_maestro() to authenticated;

-- get_my_rol() no s'usa enlloc, però es manté; se li fixa el search_path i
-- es treu a anon.
alter function public.get_my_rol() set search_path = '';
revoke all on function public.get_my_rol() from public, anon;
grant execute on function public.get_my_rol() to authenticated;

-- ─── profiles: permisos per columna ─────────────────────────────────────────

revoke all on table public.profiles from anon, authenticated;
grant select                  on table public.profiles to authenticated;
grant insert (id, email, nom) on table public.profiles to authenticated;
grant update (capcalera)      on table public.profiles to authenticated;

-- ─── profiles: polítiques ───────────────────────────────────────────────────

drop policy if exists "perfil_propi" on public.profiles;

create policy "perfil_llegir" on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.es_maestro());

create policy "perfil_crear_propi" on public.profiles
  for insert
  to authenticated
  with check (
    id = auth.uid()
    and lower(email) = lower(auth.jwt() ->> 'email')
    and rol = 'individual'
    and estat = 'pendent'
    and coalesce(eines, '{}') = '{}'
    and empresa_id is null
  );

create policy "perfil_modificar_propi" on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── profiles: segon pany (trigger) ─────────────────────────────────────────
-- Encara que algun dia s'obrís un permís per error, un usuari (anon o
-- authenticated) no pot pujar-se l'estat, les eines, el rol ni l'empresa.
-- El service_role i les funcions SECURITY DEFINER no passen per aquí.

drop trigger if exists impedeix_autoassignar_rol on public.profiles;
drop function if exists public.impedeix_autoassignar_rol();

create or replace function public.protegeix_camps_perfil()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.rol is distinct from 'individual'
         or new.estat is distinct from 'pendent'
         or coalesce(new.eines, '{}') <> '{}'
         or new.empresa_id is not null then
        raise exception 'Una fitxa nova només pot ser individual, pendent, sense eines i sense empresa';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.id         is distinct from old.id
         or new.email      is distinct from old.email
         or new.rol        is distinct from old.rol
         or new.estat      is distinct from old.estat
         or new.eines      is distinct from old.eines
         or new.empresa_id is distinct from old.empresa_id then
        raise exception 'No es permet modificar rol, estat, eines ni empresa del perfil';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger protegeix_camps_perfil
  before insert or update on public.profiles
  for each row execute function public.protegeix_camps_perfil();

revoke all on function public.protegeix_camps_perfil() from public, anon, authenticated;

-- ─── Accions del maestro ────────────────────────────────────────────────────
-- Canvia estat, eines i/o rol d'una altra fitxa. Els paràmetres nuls no es
-- toquen. El rol maestro no es pot donar ni treure des d'aquí (només a mà).

create or replace function public.maestro_actualitza_perfil(
  p_id    uuid,
  p_estat text   default null,
  p_eines text[] default null,
  p_rol   text   default null
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_rol_actual text;
begin
  if not public.es_maestro() then
    raise exception 'Només un maestro actiu pot modificar perfils' using errcode = '42501';
  end if;

  if p_id = auth.uid() then
    raise exception 'El maestro no pot modificar el seu propi perfil des del panell' using errcode = '42501';
  end if;

  select rol into v_rol_actual from public.profiles where id = p_id for update;
  if not found then
    raise exception 'Perfil inexistent' using errcode = 'P0002';
  end if;

  if v_rol_actual = 'maestro' then
    raise exception 'Un perfil maestro només es pot modificar a mà' using errcode = '42501';
  end if;

  if p_rol = 'maestro' then
    raise exception 'El rol maestro només es pot assignar a mà' using errcode = '42501';
  end if;

  if p_rol is not null and p_rol not in ('individual', 'empleat', 'empresa') then
    raise exception 'Rol no vàlid: %', p_rol using errcode = '22023';
  end if;

  if p_estat is not null and p_estat not in ('pendent', 'actiu', 'bloquejat') then
    raise exception 'Estat no vàlid: %', p_estat using errcode = '22023';
  end if;

  if p_eines is not null and not (p_eines <@ array['irpf', 'bretxa']) then
    raise exception 'Eina no vàlida' using errcode = '22023';
  end if;

  update public.profiles
     set estat = coalesce(p_estat, estat),
         eines = coalesce(p_eines, eines),
         rol   = coalesce(p_rol, rol)
   where id = p_id;
end;
$$;

revoke all on function public.maestro_actualitza_perfil(uuid, text, text[], text) from public, anon;
grant execute on function public.maestro_actualitza_perfil(uuid, text, text[], text) to authenticated;

-- ─── declaracions: només usuaris actius ─────────────────────────────────────
-- Es reemplacen totes les polítiques (n'hi havia de duplicades) per unes que
-- exigeixen estat 'actiu' comprovat a la base.

drop policy if exists "Maestro veu totes les declaracions"         on public.declaracions;
drop policy if exists "Usuari crea les seves declaracions"         on public.declaracions;
drop policy if exists "Usuari elimina les seves declaracions"      on public.declaracions;
drop policy if exists "Usuari modifica les seves declaracions"     on public.declaracions;
drop policy if exists "Usuari veu les seves declaracions"          on public.declaracions;
drop policy if exists "Usuaris actualitzen les seves declaracions" on public.declaracions;
drop policy if exists "Usuaris eliminen les seves declaracions"    on public.declaracions;
drop policy if exists "Usuaris insereixen les seves declaracions"  on public.declaracions;

create policy "declaracions_llegir" on public.declaracions
  for select
  to authenticated
  using (public.es_actiu() and (user_id = auth.uid() or public.es_maestro()));

create policy "declaracions_crear" on public.declaracions
  for insert
  to authenticated
  with check (public.es_actiu() and user_id = auth.uid());

create policy "declaracions_modificar" on public.declaracions
  for update
  to authenticated
  using (public.es_actiu() and user_id = auth.uid())
  with check (public.es_actiu() and user_id = auth.uid());

create policy "declaracions_eliminar" on public.declaracions
  for delete
  to authenticated
  using (public.es_actiu() and user_id = auth.uid());

revoke all on table public.declaracions from anon;
revoke truncate, references, trigger on table public.declaracions from authenticated;

-- ─── solicituds ─────────────────────────────────────────────────────────────
-- El formulari públic hi pot crear sol·licituds (una sola política d'INSERT).
-- Només un maestro actiu les pot veure, modificar o esborrar.

drop policy if exists "Maestro veu totes les sollicituds"  on public.solicituds;
drop policy if exists "Maestro veu totes les sol·licituds" on public.solicituds;
drop policy if exists "Maestro actualitza sollicituds"     on public.solicituds;
drop policy if exists "Maestro elimina sollicituds"        on public.solicituds;
drop policy if exists "Qualsevol pot inserir sollicituds"  on public.solicituds;
-- Es manté "Inserció pública" (FOR INSERT TO public WITH CHECK (true)).

create policy "solicituds_maestro_llegir" on public.solicituds
  for select
  to authenticated
  using (public.es_maestro());

create policy "solicituds_maestro_modificar" on public.solicituds
  for update
  to authenticated
  using (public.es_maestro())
  with check (public.es_maestro());

create policy "solicituds_maestro_eliminar" on public.solicituds
  for delete
  to authenticated
  using (public.es_maestro());

revoke truncate, references, trigger on table public.solicituds from anon, authenticated;
