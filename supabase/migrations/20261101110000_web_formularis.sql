-- Formularis de la web: contacte (App.js) i sol·licitud d'accés a la Zona
-- Professionals (PaginaLogin.jsx). Les dades només arriben a Supabase per la
-- funció web-formulari (service role); Formspree rep un avís sense cap dada.

-- ─── missatges_contacte ─────────────────────────────────────────────────────
-- Només un maestro actiu els pot llegir o esborrar. Ningú no hi pot inserir des
-- del navegador.

create table public.missatges_contacte (
  id        uuid        primary key default gen_random_uuid(),
  nom       text        not null check (char_length(nom) between 1 and 200),
  email     text        not null check (char_length(email) between 3 and 254),
  telefon   text        check (char_length(telefon) <= 50),
  missatge  text        not null check (char_length(missatge) between 1 and 5000),
  idioma    text        check (idioma in ('ca', 'es', 'en', 'fr')),
  creat_el  timestamptz not null default now()
);

alter table public.missatges_contacte enable row level security;

revoke all on table public.missatges_contacte from public, anon, authenticated;
grant select, delete on table public.missatges_contacte to authenticated;

create policy "missatges_contacte_maestro_llegir" on public.missatges_contacte
  for select
  to authenticated
  using (public.es_maestro());

create policy "missatges_contacte_maestro_eliminar" on public.missatges_contacte
  for delete
  to authenticated
  using (public.es_maestro());

-- ─── solicituds ─────────────────────────────────────────────────────────────
-- El navegador ja no hi insereix: ho fa web-formulari.

drop policy if exists "Inserció pública" on public.solicituds;
revoke insert on table public.solicituds from anon, authenticated;
