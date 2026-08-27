-- =============================================================================
-- PROPOSITION — LE RÉFÉRENTIEL VÉHICULES, ET LES COLONNES QUE LA FICHE ATTEND
--
--   *** NON APPLIQUÉE. NE PAS EXÉCUTER SANS DÉCISION FONDATEUR. ***
--
-- Le nom commence par PROPOSITION_ et non par un horodatage : `supabase db
-- push` ne le ramasse pas.
--
-- Rédigée le 26/08/2026, avec le lot 11b (fiche véhicule dans Garage).
-- =============================================================================
--
-- CE QUI MANQUE, MESURÉ LE 26/08/2026
--
-- `public.vehicles` porte dix-sept colonnes :
--
--   id, user_id, created_at, updated_at, brand, model, year, license_plate,
--   color, declared_value, photo_front_url, photo_side_url, photo_rear_url,
--   photo_interior_url, notes, is_primary, mass_kg
--
-- La fiche véhicule du lot 1 en demande huit. **Trois existent :**
--
--   Marque       `brand`     — texte libre, saisi par le pilote
--   Modèle       `model`     — texte libre, saisi par le pilote
--   Masse        `mass_kg`   — numeric(6,1), posée le 29/07 par la migration
--                              `20260729034110`, contrainte `> 100 et < 5000`,
--                              ZÉRO ligne renseignée sur six, aucun formulaire
--                              ne l'écrit (ni l'app, ni le site)
--
-- **Cinq n'existent pas :** génération, années de la génération, puissance,
-- classe de roulage (dérivée du rapport), concordance HistoVec.
--
-- Aucune table de référentiel véhicules n'existe EN BASE. Le référentiel, lui,
-- existe depuis le 26/08/2026 — en TypeScript, dans
-- `src/features/vehicules/referentielVehicules.ts` : 93 entrées, classe
-- recalculée par `eligibiliteLogic`, jamais lue d'une colonne.
--
-- C'est pourquoi ce fichier est en QUATRE parties dont une seule est requise.
-- La partie 1 pose ce que les lots 1 et 2 exigent — la génération et HistoVec,
-- sur `public.vehicles`. Les parties 2 à 4 posent le référentiel EN BASE, et
-- elles relèvent d'un arbitrage : deux référentiels valent moins qu'un, et la
-- seule raison d'en poser un second est qu'un lecteur hors de l'application
-- (le tunnel du site, `registrations`) doive le joindre en SQL.
--
-- Ne pas confondre avec `eligibility_items` (prod depuis le 03/07) : ses neuf
-- clés sont PILOTE / JOURNÉE — permis, cni, assurance_circuit,
-- controle_technique, pneus_freins, niveau_sonore, casque, decharge, briefing
-- — rattachées à `registration_id`, jamais à un véhicule.
--
-- ---------------------------------------------------------------------------
-- CE QUE LE CODE FAIT EN ATTENDANT, ET POURQUOI IL RESTE HONNÊTE
--
-- La fiche affiche « — » sur les lignes absentes. Elle ne rapproche AUCUN
-- texte libre (`brand`, `model`) d'une entrée du référentiel : un
-- rapprochement approximatif produirait une classe fausse, donc un accès faux.
-- La classe n'est jamais un à-peu-près.
--
-- `src/features/vehicules/eligibiliteLogic.ts` porte déjà le calcul complet —
-- rapport, seuils, ouverture des offres — et `ficheVehiculeLogic` n'en fait
-- que la mise en forme. Cette migration ne change pas le code : elle lui donne
-- de quoi afficher autre chose que des tirets.
--
-- =============================================================================
-- PARTIE 1 — CE QUE LES LOTS 1 ET 2 EXIGENT, ET RIEN DE PLUS
-- =============================================================================
--
-- Deux besoins, deux gestes, sur la table qui existe déjà.
--
-- 1. LA GÉNÉRATION. `chercheAuReferentiel` (module `referentielVehicules`)
--    exige un triplet marque / modèle / génération. Les deux premiers sont en
--    base, le troisième non — c'est la seule pièce qui manque pour que la fiche
--    affiche autre chose que des tirets.
--
--    La colonne est NULLABLE, et le restera : les six véhicules déjà en base
--    ont été saisis en texte libre, et AUCUN rapprochement automatique ne sera
--    fait. Deviner la génération d'après le millésime marcherait souvent, et
--    « souvent » afficherait un jour une classe fausse, donc un accès faux.
--
-- 2. HISTOVEC — TROIS ÉTATS, ET L'UN DES TROIS EST L'ABSENCE.
--
--    « Non vérifié » n'est pas une valeur : c'est le fait qu'aucune
--    vérification n'a eu lieu. Il s'écrit `null`, comme toute absence dans ce
--    schéma, et l'interface l'affiche « — » sans aucune alerte. Poser en plus
--    une chaîne 'non_verifie' donnerait DEUX façons de dire la même chose, et
--    un jour les deux se rencontreraient.
--
--    POINT À TRANCHER. Le « Registre Véhicule v1.2 » du 26/08 propose son
--    propre vocabulaire pour ce champ — 'concordant' | 'non_verifie' | 'ecart'
--    — sur une table `vehicules` qui lui est propre. Le présent fichier étend
--    `public.vehicles`, qui existe, et emploie le vocabulaire de l'interface :
--    'verifiee' | 'non_etablie'. Les deux documents devront converger avant que
--    le registre ne soit construit.
--
-- CE QUE CETTE PARTIE NE FAIT PAS : elle ne bloque rien. Aucune contrainte ne
-- subordonne une réservation à une concordance. Le contrôle réel a lieu au
-- paddock ; la base en garde la trace, l'application la restitue.

alter table public.vehicles
  add column if not exists generation text,
  add column if not exists histovec_statut text,
  add column if not exists histovec_verifie_le timestamptz,
  add column if not exists histovec_motif text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vehicles_histovec_statut_check'
  ) then
    alter table public.vehicles
      add constraint vehicles_histovec_statut_check
      check (histovec_statut is null or histovec_statut in ('verifiee', 'non_etablie'));
  end if;

  -- Un statut sans horodatage serait une vérification sans date ; une date sans
  -- statut serait une vérification sans résultat. Ni l'un ni l'autre n'est un
  -- fait restituable.
  if not exists (
    select 1 from pg_constraint where conname = 'vehicles_histovec_horodatage_check'
  ) then
    alter table public.vehicles
      add constraint vehicles_histovec_horodatage_check
      check ((histovec_statut is null) = (histovec_verifie_le is null));
  end if;
end $$;

comment on column public.vehicles.generation is
  'Génération déclarée, telle qu''elle est nommée au référentiel publié. NULL = véhicule non rapproché : la fiche affiche « — », jamais une génération devinée.';

comment on column public.vehicles.histovec_statut is
  'verifiee | non_etablie. NULL = aucune vérification demandée, affiché « — » sans alerte. Ne conditionne rien : le contrôle a lieu au paddock.';

comment on column public.vehicles.histovec_motif is
  'Motif FACTUEL d''une concordance non établie. Jamais une qualification de faute, jamais un jugement sur le pilote.';

-- =============================================================================
-- PARTIE 2 — LE RÉFÉRENTIEL EN BASE : ARBITRAGE, PAS BESOIN DES LOTS 1 ET 2
-- =============================================================================
--
-- *** CETTE PARTIE EST SÉPARABLE. Les lots 1 et 2 n'en ont PAS besoin. ***
--
-- Depuis le 26/08/2026, le référentiel publié vit DÉJÀ dans le dépôt, en
-- TypeScript : `src/features/vehicules/referentielVehicules.ts`, 93 entrées,
-- classe recalculée par `eligibiliteLogic`, jamais lue d'une colonne. La fiche
-- véhicule s'en sert et n'a besoin d'aucune table.
--
-- Le poser AUSSI en base crée deux référentiels — précisément ce que ce dépôt
-- combat. La question n'est donc pas « faut-il une table », mais « QUI a besoin
-- de lire le référentiel hors de l'application » :
--
--   • le tunnel de réservation du SITE (`oxv-site`, HTML statique) sert la
--     cascade marque → modèle → génération à des visiteurs non connectés. Il ne
--     peut pas importer un module TypeScript de l'app ;
--   • `registrations` devra un jour figer la classe retenue au paiement.
--
-- Si la réponse est « personne d'autre ne lit », cette partie et la partie 4
-- ne s'appliquent pas. Si elle est « le site lit », alors la table devient la
-- source, et la table TypeScript doit en être DÉRIVÉE — pas maintenue en
-- parallèle.
--
-- Source : `docs/produit/OXV_Referentiel_Vehicules_2026.csv`, 93 entrées,
-- millésime 2026, produit par `docs/produit/gen_referentiel.py`.
--
-- LA CLASSE EST UNE COLONNE GÉNÉRÉE, ET LE RAPPORT NE L'EST PAS. Ce n'est pas
-- une inconséquence, c'est le seul montage qui évite une TROISIÈME règle
-- d'arrondi.
--
--   • `gen_referentiel.py` arrondit en virgule flottante, AU PAIR — la règle de
--     `round()` en Python. 1450 / 400 = 3,625 donne 3,62.
--   • `round(numeric, 2)` en PostgreSQL arrondit à l'ÉCART DE ZÉRO. Le même
--     calcul donnerait 3,63.
--   • `Math.round(x * 100) / 100` en JavaScript donnerait 3,63 aussi, et 3,93
--     là où le référentiel publie 3,92 (Audi RS3 8Y).
--
-- Trois règles, trois résultats, deux lignes du référentiel concernées. Aucune
-- ne change de classe aujourd'hui — mais un véhicule posé sur un seuil le
-- ferait, et la valeur affichée au pilote différerait de celle qu'OXV publie.
--
-- Donc : `ratio_kg_ch` est IMPORTÉ tel qu'il est publié, et `classe` est
-- générée À PARTIR DE LUI. La base ne rejoue aucun arrondi ; elle applique des
-- seuils à une valeur figée. La classe n'est jamais saisie à la main (§ 3 du
-- document d'éligibilité), et une contrainte refuse un rapport importé qui
-- s'écarterait du quotient de plus d'un demi-centième.
--
-- La valeur `null` de `classe` n'est pas un manque : c'est le HORS PÉRIMÈTRE
-- des conditions C3 et C4 — au-delà de 6,0 kg/ch, ou au-dessus de 2 400 kg. Le
-- référentiel 2026 ne contient aucune ligne dans ce cas ; la colonne le prévoit
-- pour les révisions suivantes.

create table if not exists public.vehicules_eligibles (
  id              uuid primary key default gen_random_uuid(),
  marque          text        not null,
  modele          text        not null,
  generation      text,
  annee_debut     int         not null,
  annee_fin       int,
  puissance_ch    int         not null check (puissance_ch > 0),
  masse_kg        numeric(6,1) not null check (masse_kg > 100 and masse_kg < 5000),
  ratio_kg_ch     numeric(5,2) not null check (ratio_kg_ch > 0),
  carrosserie     text        not null check (carrosserie in ('fermee', 'decouvrable')),
  motorisation    text        not null check (motorisation in ('thermique', 'hybride', 'electrique')),
  revision        int         not null,
  cree_le         timestamptz not null default now(),

  -- Le rapport importé doit être l'arrondi au centième du quotient réel. Un
  -- demi-centième est l'écart maximal d'un arrondi correct, quelle que soit la
  -- règle de départage.
  constraint vehicules_eligibles_ratio_coherent
    check (abs(ratio_kg_ch - masse_kg / puissance_ch) <= 0.005),

  constraint vehicules_eligibles_annees_ordonnees
    check (annee_fin is null or annee_fin >= annee_debut),

  -- Une génération par plage d'années. Les 93 entrées du millésime 2026 en
  -- portent toutes une ; si une révision future en omettait, PostgreSQL
  -- traiterait ces NULL comme distincts et la clé cesserait de dédoublonner.
  constraint vehicules_eligibles_identite
    unique (marque, modele, generation, annee_debut)
);

-- Classe de roulage — § 3 du document d'éligibilité. GÉNÉRÉE : jamais saisie,
-- jamais négociée, jamais ajustée au cas par cas.
alter table public.vehicules_eligibles
  add column if not exists classe text
  generated always as (
    case
      when masse_kg   > 2400 then null::text
      when ratio_kg_ch > 6.0 then null::text
      when ratio_kg_ch < 3.5 then 'III'::text
      when ratio_kg_ch < 5.0 then 'II'::text
      else 'I'::text
    end
  ) stored;

comment on table public.vehicules_eligibles is
  'Référentiel des véhicules éligibles, millésime 2026. Application des conditions C1 à C5, jamais leur substitut. Révisé annuellement par gen_referentiel.py. L''absence d''un véhicule ne vaut pas refus : elle ouvre un examen individuel sous 72 heures.';

comment on column public.vehicules_eligibles.ratio_kg_ch is
  'Rapport masse / puissance PUBLIÉ, arrondi au centième par gen_referentiel.py. Importé, jamais recalculé en base — trois règles d''arrondi donneraient trois valeurs.';

comment on column public.vehicules_eligibles.classe is
  'I (5,0 à 6,0 kg/ch, Sport), II (3,5 à 5,0, GT), III (sous 3,5, Supersport). NULL = hors périmètre de service (C3 ou C4), jamais un refus de client.';

create index if not exists vehicules_eligibles_marque_modele_idx
  on public.vehicules_eligibles (marque, modele);

-- ---------------------------------------------------------------------------
-- RLS — le référentiel est PUBLIÉ, sa lecture est ouverte, son écriture ne
-- passe jamais par un client.
--
-- Le tunnel de réservation du site sert la cascade marque → modèle →
-- génération à des visiteurs non connectés : `anon` doit lire. Aucune politique
-- d'écriture n'est créée — `service_role` contourne RLS, et c'est par lui que
-- passe la révision annuelle.

alter table public.vehicules_eligibles enable row level security;

drop policy if exists vehicules_eligibles_select_public on public.vehicules_eligibles;
create policy vehicules_eligibles_select_public
  on public.vehicules_eligibles for select
  to anon, authenticated
  using (true);

-- =============================================================================
-- PARTIE 3 — LE RATTACHEMENT AU RÉFÉRENTIEL EN BASE (suite de l'arbitrage)
-- =============================================================================
--
-- *** SÉPARABLE, comme la partie 2. Ne s'applique qu'avec elle. ***
--
-- `generation` (partie 1) suffit à la fiche : le rapprochement se fait par
-- triplet, côté application. `referentiel_id` est le même lien, matérialisé —
-- il ne devient utile que si le SITE ou `registrations` doivent joindre le
-- référentiel en SQL.
--
-- Les deux ne se contredisent pas, mais ils se doublent : ne poser celui-ci
-- que si la partie 2 est retenue, et faire alors de `generation` le champ
-- déclaratif et de `referentiel_id` le lien résolu.

alter table public.vehicles
  add column if not exists referentiel_id uuid
    references public.vehicules_eligibles(id) on delete set null;

comment on column public.vehicles.referentiel_id is
  'Entrée du référentiel dont ce véhicule relève. NULL = non rattaché : la fiche affiche « — », jamais une classe devinée.';

create index if not exists vehicles_referentiel_idx
  on public.vehicles (referentiel_id) where referentiel_id is not null;

-- =============================================================================
-- PARTIE 4 — LE MILLÉSIME 2026, 93 ENTRÉES (suite de l'arbitrage)
-- =============================================================================
--
-- Repris ligne à ligne de `OXV_Referentiel_Vehicules_2026.csv`. `classe` n'est
-- pas insérée : elle est générée. `statut` et `motif_exclusion` du CSV ne sont
-- pas repris — le fichier ne contient aucune ligne exclue, et une colonne qui
-- ne porterait qu'une seule valeur ne dit rien.
--
-- `on conflict do nothing` : rejouer le fichier ne duplique pas le millésime.

insert into public.vehicules_eligibles
  (marque, modele, generation, annee_debut, annee_fin, puissance_ch, masse_kg,
   ratio_kg_ch, carrosserie, motorisation, revision)
values
  ('Abarth', '595', 'Competizione', 2012, 2023, 180, 1035, 5.75, 'fermee', 'thermique', 2026),
  ('BMW', 'M135i', 'F40', 2019, null, 306, 1550, 5.07, 'fermee', 'thermique', 2026),
  ('Honda', 'S2000', 'AP1 AP2', 1999, 2009, 240, 1260, 5.25, 'decouvrable', 'thermique', 2026),
  ('Hyundai', 'i30 N', 'PD Performance', 2017, null, 275, 1429, 5.20, 'fermee', 'thermique', 2026),
  ('Mazda', 'MX-5', 'ND2', 2018, null, 184, 1050, 5.71, 'decouvrable', 'thermique', 2026),
  ('Mini', 'John Cooper Works', 'F56', 2015, null, 231, 1275, 5.52, 'fermee', 'thermique', 2026),
  ('Nissan', '350Z', 'Z33', 2003, 2009, 280, 1530, 5.46, 'fermee', 'thermique', 2026),
  ('Peugeot', '208', 'GTi 30th', 2015, 2019, 208, 1160, 5.58, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '964 Carrera', 1989, 1994, 250, 1350, 5.40, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '993 Carrera', 1994, 1998, 272, 1370, 5.04, 'fermee', 'thermique', 2026),
  ('Porsche', 'Boxster', '986 S', 1999, 2004, 252, 1320, 5.24, 'decouvrable', 'thermique', 2026),
  ('Renault', 'Clio', 'IV RS Trophy', 2015, 2019, 220, 1204, 5.47, 'fermee', 'thermique', 2026),
  ('Renault', 'Megane', 'IV RS 280', 2018, 2023, 280, 1430, 5.11, 'fermee', 'thermique', 2026),
  ('Subaru', 'BRZ', 'ZD8', 2021, null, 234, 1280, 5.47, 'fermee', 'thermique', 2026),
  ('Toyota', 'GR86', 'ZN8', 2021, null, 234, 1280, 5.47, 'fermee', 'thermique', 2026),
  ('Volkswagen', 'Golf', 'VII GTI Performance', 2013, 2020, 245, 1350, 5.51, 'fermee', 'thermique', 2026),
  ('Alfa Romeo', '4C', '960', 2013, 2020, 240, 1025, 4.27, 'fermee', 'thermique', 2026),
  ('Alpine', 'A110', 'Base', 2017, null, 252, 1110, 4.40, 'fermee', 'thermique', 2026),
  ('Alpine', 'A110', 'S', 2019, null, 300, 1114, 3.71, 'fermee', 'thermique', 2026),
  ('Alpine', 'A110', 'R', 2022, null, 300, 1082, 3.61, 'fermee', 'thermique', 2026),
  ('Audi', 'RS e-tron GT', 'J1', 2021, null, 598, 2347, 3.92, 'fermee', 'electrique', 2026),
  ('Audi', 'RS3', '8V', 2015, 2020, 367, 1520, 4.14, 'fermee', 'thermique', 2026),
  ('Audi', 'RS3', '8Y', 2021, null, 400, 1570, 3.92, 'fermee', 'thermique', 2026),
  ('Audi', 'RS4', 'B9 Avant', 2017, null, 450, 1790, 3.98, 'fermee', 'thermique', 2026),
  ('Audi', 'TT RS', '8S', 2016, 2022, 400, 1450, 3.62, 'fermee', 'thermique', 2026),
  ('BMW', 'M2', 'F87', 2016, 2021, 370, 1495, 4.04, 'fermee', 'thermique', 2026),
  ('BMW', 'M2', 'G87', 2023, null, 460, 1725, 3.75, 'fermee', 'thermique', 2026),
  ('BMW', 'M240i', 'G42', 2021, null, 374, 1690, 4.52, 'fermee', 'thermique', 2026),
  ('BMW', 'M3', 'E46', 2000, 2006, 343, 1570, 4.58, 'fermee', 'thermique', 2026),
  ('BMW', 'M3', 'E92', 2007, 2013, 420, 1655, 3.94, 'fermee', 'thermique', 2026),
  ('BMW', 'M3', 'F80', 2014, 2018, 431, 1595, 3.70, 'fermee', 'thermique', 2026),
  ('BMW', 'M4', 'F82', 2014, 2020, 431, 1572, 3.65, 'fermee', 'thermique', 2026),
  ('BMW', 'Z4', 'M40i G29', 2018, null, 340, 1610, 4.74, 'decouvrable', 'thermique', 2026),
  ('Caterham', 'Seven', '310', 2017, null, 152, 540, 3.55, 'decouvrable', 'thermique', 2026),
  ('Cupra', 'Leon', 'VZ 300', 2020, null, 300, 1450, 4.83, 'fermee', 'thermique', 2026),
  ('Ford', 'Mustang', 'VI GT V8', 2015, 2023, 450, 1740, 3.87, 'fermee', 'thermique', 2026),
  ('Honda', 'Civic Type R', 'FK8', 2017, 2021, 320, 1380, 4.31, 'fermee', 'thermique', 2026),
  ('Honda', 'Civic Type R', 'FL5', 2022, null, 329, 1429, 4.34, 'fermee', 'thermique', 2026),
  ('Lotus', 'Elise', 'S2 111S', 2004, 2011, 192, 860, 4.48, 'decouvrable', 'thermique', 2026),
  ('Lotus', 'Elise', 'S3 S 220', 2011, 2021, 220, 924, 4.20, 'decouvrable', 'thermique', 2026),
  ('Lotus', 'Emira', 'V6', 2022, null, 405, 1458, 3.60, 'fermee', 'thermique', 2026),
  ('Lotus', 'Evora', 'S', 2010, 2021, 350, 1437, 4.11, 'fermee', 'thermique', 2026),
  ('Mercedes-AMG', 'A45', 'W176', 2015, 2018, 381, 1480, 3.88, 'fermee', 'thermique', 2026),
  ('Mercedes-AMG', 'A45 S', 'W177', 2019, null, 421, 1550, 3.68, 'fermee', 'thermique', 2026),
  ('Nissan', '370Z', 'Z34', 2009, 2020, 328, 1520, 4.63, 'fermee', 'thermique', 2026),
  ('Peugeot', '308', 'GTi 270', 2015, 2021, 272, 1205, 4.43, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '996 Carrera', 1998, 2004, 300, 1320, 4.40, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '996 GT3', 1999, 2005, 360, 1350, 3.75, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '997 Carrera S', 2004, 2012, 355, 1425, 4.01, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '992 Carrera', 2019, null, 385, 1505, 3.91, 'fermee', 'thermique', 2026),
  ('Porsche', 'Boxster', '718', 2016, null, 300, 1385, 4.62, 'decouvrable', 'thermique', 2026),
  ('Porsche', 'Cayman', '987 S', 2005, 2012, 295, 1350, 4.58, 'fermee', 'thermique', 2026),
  ('Porsche', 'Cayman', '981 S', 2012, 2016, 325, 1350, 4.15, 'fermee', 'thermique', 2026),
  ('Porsche', 'Cayman', '718', 2016, null, 300, 1365, 4.55, 'fermee', 'thermique', 2026),
  ('Porsche', 'Cayman', '718 S', 2016, null, 350, 1385, 3.96, 'fermee', 'thermique', 2026),
  ('Porsche', 'Cayman', '718 GTS 4.0', 2020, null, 400, 1405, 3.51, 'fermee', 'thermique', 2026),
  ('Porsche', 'Taycan', '4S J1', 2020, null, 530, 2220, 4.19, 'fermee', 'electrique', 2026),
  ('Renault', 'Megane', 'IV RS Trophy', 2019, 2023, 300, 1430, 4.77, 'fermee', 'thermique', 2026),
  ('Tesla', 'Model 3', 'Performance', 2019, null, 510, 1850, 3.63, 'fermee', 'electrique', 2026),
  ('Toyota', 'GR Supra', 'A90 3.0', 2019, null, 340, 1520, 4.47, 'fermee', 'thermique', 2026),
  ('Toyota', 'GR Yaris', 'XP210', 2020, null, 261, 1280, 4.90, 'fermee', 'thermique', 2026),
  ('Volkswagen', 'Golf', 'VII R', 2013, 2020, 310, 1476, 4.76, 'fermee', 'thermique', 2026),
  ('Volkswagen', 'Golf', 'VIII GTI Clubsport', 2020, null, 300, 1462, 4.87, 'fermee', 'thermique', 2026),
  ('Volkswagen', 'Golf', 'VIII R', 2020, null, 320, 1551, 4.85, 'fermee', 'thermique', 2026),
  ('Alfa Romeo', 'Giulia', 'Quadrifoglio', 2016, null, 510, 1620, 3.18, 'fermee', 'thermique', 2026),
  ('Aston Martin', 'Vantage', 'V8 2018', 2018, null, 510, 1630, 3.20, 'fermee', 'thermique', 2026),
  ('Audi', 'R8', '4S V10', 2015, null, 570, 1660, 2.91, 'fermee', 'thermique', 2026),
  ('Audi', 'RS6', 'C8 Avant', 2019, null, 600, 2075, 3.46, 'fermee', 'thermique', 2026),
  ('BMW', 'M3', 'G80', 2021, null, 510, 1730, 3.39, 'fermee', 'thermique', 2026),
  ('BMW', 'M5', 'F10', 2011, 2016, 560, 1870, 3.34, 'fermee', 'thermique', 2026),
  ('Caterham', 'Seven', '420', 2017, null, 210, 560, 2.67, 'decouvrable', 'thermique', 2026),
  ('Chevrolet', 'Corvette', 'C7 Stingray', 2014, 2019, 466, 1560, 3.35, 'fermee', 'thermique', 2026),
  ('Ferrari', '296', 'GTB', 2022, null, 830, 1470, 1.77, 'fermee', 'hybride', 2026),
  ('Ferrari', '458', 'Italia', 2009, 2015, 570, 1485, 2.61, 'fermee', 'thermique', 2026),
  ('Ferrari', '488', 'GTB', 2015, 2019, 670, 1475, 2.20, 'fermee', 'thermique', 2026),
  ('Ferrari', 'F8', 'Tributo', 2019, 2023, 720, 1435, 1.99, 'fermee', 'thermique', 2026),
  ('Jaguar', 'F-Type', 'R Coupe', 2014, null, 550, 1730, 3.15, 'fermee', 'thermique', 2026),
  ('Lamborghini', 'Gallardo', 'LP560-4', 2008, 2013, 560, 1430, 2.55, 'fermee', 'thermique', 2026),
  ('Lamborghini', 'Huracan', 'LP610-4', 2014, null, 610, 1422, 2.33, 'fermee', 'thermique', 2026),
  ('Lotus', 'Exige', 'S V6', 2012, 2021, 350, 1176, 3.36, 'fermee', 'thermique', 2026),
  ('McLaren', '570S', 'P13', 2015, 2021, 570, 1440, 2.53, 'fermee', 'thermique', 2026),
  ('McLaren', '720S', 'P14', 2017, 2023, 720, 1419, 1.97, 'fermee', 'thermique', 2026),
  ('Mercedes-AMG', 'C63 S', 'W205', 2015, 2021, 510, 1745, 3.42, 'fermee', 'thermique', 2026),
  ('Mercedes-AMG', 'GT', 'C190', 2015, 2021, 476, 1615, 3.39, 'fermee', 'thermique', 2026),
  ('Nissan', 'GT-R', 'R35', 2008, null, 570, 1752, 3.07, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '997 GT3', 2006, 2011, 415, 1395, 3.36, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '991 Carrera S', 2011, 2019, 420, 1440, 3.43, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '991 GT3', 2013, 2019, 500, 1430, 2.86, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '992 GT3', 2021, null, 510, 1418, 2.78, 'fermee', 'thermique', 2026),
  ('Porsche', '911', '992 Turbo', 2020, null, 580, 1640, 2.83, 'fermee', 'thermique', 2026),
  ('Porsche', 'Cayman', '718 GT4', 2019, null, 420, 1420, 3.38, 'fermee', 'thermique', 2026),
  ('Porsche', 'Taycan', 'Turbo S J1', 2020, null, 761, 2320, 3.05, 'fermee', 'electrique', 2026),
  ('Tesla', 'Model S', 'Plaid', 2021, null, 1020, 2190, 2.15, 'fermee', 'electrique', 2026)
on conflict (marque, modele, generation, annee_debut) do nothing;

-- =============================================================================
-- VÉRIFICATIONS APRÈS APPLICATION
-- =============================================================================
--
--   -- 93 entrées, répartition 16 / 48 / 29
--   select classe, count(*) from public.vehicules_eligibles group by classe
--    order by classe;
--
--   -- Aucune ligne hors périmètre dans le millésime 2026
--   select count(*) from public.vehicules_eligibles where classe is null;
--
--   -- Le rapport publié et le quotient réel ne s'écartent jamais
--   select marque, modele, generation, ratio_kg_ch, masse_kg / puissance_ch
--     from public.vehicules_eligibles
--    where abs(ratio_kg_ch - masse_kg / puissance_ch) > 0.005;
--
--   -- Lecture anonyme du référentiel (le tunnel du site en dépend)
--   set role anon; select count(*) from public.vehicules_eligibles; reset role;
--
-- =============================================================================
-- CE QUI N'EST PAS DANS CE FICHIER, ET QUI VIENDRA
-- =============================================================================
--
-- `registrations.classe_retenue` — la classe FIGÉE au paiement, que le prompt
-- Garage demande de garder inchangée après une révision du référentiel (lot 4,
-- substitution de véhicule). La colonne de liaison `registrations.vehicle_id`
-- existe déjà et les trois inscriptions en base la portent ; la classe retenue,
-- non. Elle relève du lot 4, avec la règle de substitution — l'écrire ici sans
-- la règle qui la remplit poserait une colonne morte de plus.
