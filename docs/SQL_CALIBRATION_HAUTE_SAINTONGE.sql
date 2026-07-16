-- ─────────────────────────────────────────────────────────────────────────────
-- CALIBRATION — Circuit de Haute Saintonge (La Genétouze)
-- Relevé fondateur du 2026-07-16 (box, voie des stands, piste, ligne d'arrivée).
-- Source géométrie : OpenStreetMap way 54412766 « Piste vitesse » (ODbL).
-- Fichier source : src/circuit/data/haute-saintonge.geojson
--
-- ⚠ PRÉPARÉE, NON EXÉCUTÉE. À appliquer en prod par Gabin.
-- ⚠ LE RAYON EST LA VALEUR CRITIQUE — lire la note ci-dessous avant de changer 15.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── POURQUOI 15 m ET PAS LE DÉFAUT (30 m) ────────────────────────────────────
-- La VOIE DES STANDS longe la ligne droite d'arrivée à 22,9 m et lui est
-- PARALLÈLE (cap 300,8° contre 298,5° pour la piste, soit 2,3° d'écart). Or la
-- détection de tour (src/utils/lapDetection.ts) ne filtre QUE sur la distance :
-- aucun filtre de cap ne pourrait distinguer les deux. Le rayon est le SEUL levier.
--
-- Géométrie mesurée sur le relevé (test de garde : src/circuit/__tests__/
-- hauteSaintongeCalibration.test.ts) :
--   • ligne → axe de PISTE          :  1,47 m   (la ligne est bien sur la piste)
--   • ligne → axe VOIE DES STANDS   : 22,92 m   (la contrainte)
--   • plancher admissible ≈  9,5 m  = 1,5 (axe) + 3 (demi-largeur piste width=6) + 5 (GPS)
--   • plafond  admissible ≈ 20,4 m  = 22,9 (stands) − 2,5 (demi-largeur voie stands)
--   → fenêtre [9 m ; 20 m] ; 15 m se tient au milieu (≈5 m de garde côté stands).
--
-- Avec le défaut de 30 m (circuitsService) ou 40 m (BELTOISE_FINISH), CHAQUE
-- passage dans la voie des stands compterait un FAUX TOUR : compteur, meilleur
-- temps et régularité du pilote corrompus, en silence.

-- ── 1. VÉRIFIER CE QUI EXISTE (à lancer d'abord) ─────────────────────────────
select id, name, is_official, is_default,
       finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading,
       length_km, turns_count
from public.circuits
where name ilike '%saintonge%' or name ilike '%genétouze%' or name ilike '%genetouze%';

-- ── 2a. SI LA LIGNE EXISTE → METTRE À JOUR (adapter le WHERE à l'id trouvé) ──
update public.circuits set
  finish_line_lat      = 45.240578,     -- point GPS officiel OXV (déclenchement chrono)
  finish_line_lon      = -0.094391,
  finish_line_radius_m = 15,            -- ⚠ NE PAS ÉLARGIR : voie des stands à 22,9 m
  finish_line_heading  = 298.5,         -- cap de la piste au franchissement
  length_km            = 2.207,         -- mesuré sur les 73 points OSM (tracé fermé)
  turns_count          = 7,             -- détection par courbure (specs v4 §05)
  bbox_min_lat         = 45.2388985,
  bbox_max_lat         = 45.2428731,
  bbox_min_lon         = -0.0967996,
  bbox_max_lon         = -0.0881083
where id = '<ID_TROUVÉ_À_L_ÉTAPE_1>';

-- ── 2b. SI AUCUNE LIGNE N'EXISTE → CRÉER ─────────────────────────────────────
insert into public.circuits (
  id, name, is_official, is_default,
  finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading,
  length_km, turns_count,
  bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon
) values (
  gen_random_uuid(),
  'Circuit de Haute Saintonge',
  true,
  true,                                 -- circuit maison → défaut ? à confirmer
  45.240578, -0.094391, 15, 298.5,
  2.207, 7,
  45.2388985, 45.2428731, -0.0967996, -0.0881083
);

-- ── 3. CONTRÔLE APRÈS APPLICATION ────────────────────────────────────────────
-- Le rayon doit être 15. S'il est à 30/40, la détection comptera les stands.
select name, finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading
from public.circuits
where name ilike '%saintonge%';

-- ── APRÈS COUP, LE JOUR J ────────────────────────────────────────────────────
-- Vérifier qu'aucun « tour » n'est détecté pendant un aller-retour aux stands
-- SANS passer la ligne : si un tour apparaît, le rayon est trop large.
