-- =============================================================================
-- Conservació dels formularis de la web (purga diària: portal-purga, pas 5)
--
-- - public.missatges_contacte: 12 mesos des de la recepció.
-- - public.solicituds rebutjades: 12 mesos des del rebuig (columna nova
--   rebutjat_el, que posa la base, no el navegador).
-- - portal.limit_intents (empremtes d'IP del límit de peticions): 1 dia. Cap
--   finestra no passa de 10 minuts; fins ara només s'esborraven a l'atzar
--   (un 2 % de les crides a portal.registra_intent).
-- =============================================================================

-- ─── solicituds: data de rebuig ─────────────────────────────────────────────

alter table public.solicituds add column rebutjat_el timestamptz;

-- Les ja rebutjades no tenen data de rebuig: el termini comença a comptar avui.
update public.solicituds set rebutjat_el = now() where estat = 'rebutjat';

-- La data la posa sempre la base: en passar a 'rebutjat', ara; si deixa de ser
-- rebutjada, res; si no canvia l'estat, es conserva (no es pot moure a mà).
create function public.solicituds_data_rebuig()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.estat is distinct from 'rebutjat' then
    new.rebutjat_el := null;
  elsif tg_op = 'INSERT' or old.estat is distinct from 'rebutjat' then
    new.rebutjat_el := now();
  else
    new.rebutjat_el := old.rebutjat_el;
  end if;
  return new;
end;
$$;

revoke all on function public.solicituds_data_rebuig() from public, anon, authenticated;

create trigger solicituds_data_rebuig
  before insert or update on public.solicituds
  for each row execute function public.solicituds_data_rebuig();

-- ─── Purga ──────────────────────────────────────────────────────────────────

-- Amb p_simulacio només compta què s'esborraria.
create function portal.purga_formularis_web(p_simulacio boolean)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_missatges  int;
  v_solicituds int;
  v_intents    int;
begin
  if p_simulacio then
    select count(*) into v_missatges  from public.missatges_contacte where creat_el < now() - interval '12 months';
    select count(*) into v_solicituds from public.solicituds where estat = 'rebutjat' and rebutjat_el < now() - interval '12 months';
    select count(*) into v_intents    from portal.limit_intents where finestra < now() - interval '1 day';
  else
    delete from public.missatges_contacte where creat_el < now() - interval '12 months';
    get diagnostics v_missatges = row_count;
    delete from public.solicituds where estat = 'rebutjat' and rebutjat_el < now() - interval '12 months';
    get diagnostics v_solicituds = row_count;
    delete from portal.limit_intents where finestra < now() - interval '1 day';
    get diagnostics v_intents = row_count;
  end if;
  return jsonb_build_object(
    'missatges_contacte', v_missatges,
    'solicituds_rebutjades', v_solicituds,
    'limit_intents', v_intents
  );
end;
$$;

revoke all on function portal.purga_formularis_web(boolean) from public, anon, authenticated;
grant execute on function portal.purga_formularis_web(boolean) to service_role;
