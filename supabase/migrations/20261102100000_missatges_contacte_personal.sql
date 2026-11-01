-- =============================================================================
-- Missatges de contacte de la web: els llegeix el personal del portal
--
-- Es llegeixen a /portal (pestanya «Missatges web»), no al Panell Maestro de
-- l'eina IRPF. Hi té accés tot el personal actiu de portal.staff_profiles
-- (OCIC i gestors); el maestro de l'eina IRPF ja no.
-- =============================================================================

drop policy "missatges_contacte_maestro_llegir" on public.missatges_contacte;
drop policy "missatges_contacte_maestro_eliminar" on public.missatges_contacte;

create policy "missatges_contacte_personal_llegir" on public.missatges_contacte
  for select
  to authenticated
  using (portal.el_meu_rol() is not null);

create policy "missatges_contacte_personal_eliminar" on public.missatges_contacte
  for delete
  to authenticated
  using (portal.el_meu_rol() is not null);
