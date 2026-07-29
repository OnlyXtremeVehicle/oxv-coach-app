-- ============================================================================
-- PROPOSITION — L-18 : véhicule principal, et masse pour l'énergie de freinage
-- ============================================================================
--
-- ⚠️  NON APPLIQUÉE. Ce fichier est délibérément nommé `PROPOSITION_` et non
--     horodaté : il n'est PAS ramassé par `supabase db push`. Modifier le schéma
--     de production demande l'accord du fondateur (CLAUDE.md). À renommer en
--     `<timestamp>_l18_vehicules_colonnes.sql` le jour où c'est décidé.
--
-- ----------------------------------------------------------------------------
-- DEUX LOTS, UNE SEULE TABLE — D'OÙ UN SEUL FICHIER
-- ----------------------------------------------------------------------------
--
-- Deux lots du programme V3 demandent une colonne sur `vehicles`, chacun de son
-- côté :
--
--   · lot 18 — « véhicule principal, colonne `is_primary` à créer » ;
--   · lot 21z — l'énergie dissipée au freinage, ΔE = ½·m·(v_entrée² − v_sortie²),
--     qui exige la MASSE et ne peut pas l'inventer.
--
-- Les demander séparément ferait deux allers-retours pour un seul arbitrage sur
-- une seule table. Elles sont donc ici ensemble, et se décident ensemble.
--
-- ----------------------------------------------------------------------------
-- CE QUI EXISTE AUJOURD'HUI, VÉRIFIÉ
-- ----------------------------------------------------------------------------
--
-- `vehicles` porte : brand, color, declared_value, license_plate, model, notes,
-- photo_*, year. Ni masse, ni `is_primary`.
--
-- Le contournement en place pour « véhicule principal » est « le premier créé
-- fait foi » — une règle que rien n'écrit et que le pilote ne peut pas changer.
--
-- ----------------------------------------------------------------------------
-- CE QUE CHAQUE COLONNE PERMET, ET CE QU'ELLE NE PERMET PAS
-- ----------------------------------------------------------------------------
--
-- `is_primary` — le sélecteur de véhicule dans Data, et la préparation qui sait
-- de quelle voiture on parle. Un seul véhicule principal par pilote : l'index
-- partiel unique ci-dessous l'impose plutôt qu'un déclencheur, parce qu'une
-- contrainte se voit dans le schéma là où un déclencheur se découvre.
--
-- `mass_kg` — l'énergie de freinage, et rien d'autre. Elle est SAISIE, jamais
-- mesurée : la grandeur qui en découle est donc une déduction sur une valeur
-- déclarée, et devra le dire à l'écran. Sans elle, l'énergie s'affiche « — ».
--
-- **La masse ne sert pas à comparer des pilotes.** Deux voitures de masses
-- différentes dissipent des énergies différentes sans que cela dise quoi que ce
-- soit de la conduite. La grandeur reste descriptive, et alimente le carnet
-- d'entretien — « 312 freinages au-delà de 1,2 G disent plus que 1 240 km ».
--
-- ----------------------------------------------------------------------------

begin;

alter table public.vehicles
  add column if not exists is_primary boolean not null default false;

comment on column public.vehicles.is_primary is
  'Véhicule principal du pilote. Un seul par utilisateur (index partiel unique). '
  'Remplace la règle implicite « le premier créé fait foi », que rien n''écrivait.';

-- Un seul principal par pilote. Index partiel plutôt que déclencheur : une
-- contrainte se lit dans le schéma, un déclencheur se découvre.
create unique index if not exists vehicles_un_seul_principal
  on public.vehicles (user_id)
  where is_primary;

alter table public.vehicles
  add column if not exists mass_kg numeric(6, 1);

comment on column public.vehicles.mass_kg is
  'Masse en ordre de marche, en kilogrammes. SAISIE par le pilote, jamais mesurée : '
  'toute grandeur qui en dérive (énergie de freinage) est une déduction sur une valeur '
  'déclarée et doit l''annoncer. NULL = inconnue → la grandeur s''affiche « — », jamais 0.';

-- Une masse nulle ou négative n'est pas une masse ; une masse de dix tonnes
-- n'est pas une voiture de circuit. La borne haute est large à dessein — elle
-- écarte la faute de frappe, pas un choix de véhicule.
alter table public.vehicles
  drop constraint if exists vehicles_mass_kg_plausible;
alter table public.vehicles
  add constraint vehicles_mass_kg_plausible
  check (mass_kg is null or (mass_kg > 100 and mass_kg < 5000));

commit;

-- ----------------------------------------------------------------------------
-- CE QUI RESTE À FAIRE CÔTÉ APPLICATION, LE JOUR OÙ C'EST APPLIQUÉ
-- ----------------------------------------------------------------------------
--
--   1. `garageService` ne sélectionne aujourd'hui que id/brand/model/year/
--      color/notes, et n'a pas de `setPrimary`. Les deux sont à ajouter.
--   2. Le sélecteur de véhicule dans Data (lot 21o) devient constructible.
--   3. L'énergie de freinage se branche sur les zones déjà détectées par
--      `src/telemetry/braking.ts`, et s'enregistre au registre de provenance
--      en [D] avec sa convention : « masse déclarée, non mesurée ».
--   4. Les RLS de `vehicles` couvrent déjà les deux colonnes — elles portent sur
--      la ligne, pas sur la liste des colonnes. Rien à ajouter.
