-- ============================================================================
-- L-18 + L-21z : véhicule principal, et masse pour l énergie de freinage
-- ============================================================================
--
-- APPLIQUÉE EN PRODUCTION le 29/07/2026, sur accord du fondateur.
--
-- Deux lots du programme V3 demandaient chacun une colonne sur `vehicles` sans
-- se voir : le véhicule principal (lot 18) et la masse, sans laquelle l énergie
-- dissipée au freinage ne peut pas se calculer (lot 21z). Un seul arbitrage.
--
-- `is_primary` remplace la règle implicite « le premier créé fait foi », que
-- rien n écrivait et que le pilote ne pouvait pas changer.
--
-- `mass_kg` est SAISIE, jamais mesurée : toute grandeur qui en dérive est une
-- déduction sur une valeur déclarée et doit l annoncer. NULL → « — », jamais 0.
-- ============================================================================

alter table public.vehicles
  add column if not exists is_primary boolean not null default false;

comment on column public.vehicles.is_primary is
  'Véhicule principal du pilote. Un seul par utilisateur (index partiel unique). Remplace la règle implicite « le premier créé fait foi », que rien n''écrivait.';

-- Un seul principal par pilote. Index partiel plutôt que déclencheur : une
-- contrainte se lit dans le schéma, un déclencheur se découvre.
create unique index if not exists vehicles_un_seul_principal
  on public.vehicles (user_id)
  where is_primary;

alter table public.vehicles
  add column if not exists mass_kg numeric(6, 1);

comment on column public.vehicles.mass_kg is
  'Masse en ordre de marche, en kilogrammes. SAISIE par le pilote, jamais mesurée : toute grandeur qui en dérive (énergie de freinage) est une déduction sur une valeur déclarée et doit l''annoncer. NULL = inconnue → la grandeur s''affiche « — », jamais 0.';

-- Une masse nulle ou négative n est pas une masse ; dix tonnes n est pas une
-- voiture de circuit. La borne haute est large à dessein : elle écarte la faute
-- de frappe, pas un choix de véhicule.
alter table public.vehicles
  drop constraint if exists vehicles_mass_kg_plausible;
alter table public.vehicles
  add constraint vehicles_mass_kg_plausible
  check (mass_kg is null or (mass_kg > 100 and mass_kg < 5000));
