-- ─────────────────────────────────────────────────────────────────────────────
-- CALIBRATION — Circuit Ricardo Tormo (Valence, Cheste)
-- Relevé fondateur 2026-07-16 (piste 3 ways chaînées, pit lane 3 ways, box,
-- ligne d'arrivée officielle OXV) + imagerie satellite (épaisseur du pit wall).
-- Sources : src/circuit/data/ricardo-tormo.geojson (OSM, ODbL).
--
-- ⚠ PRÉPARÉE, NON EXÉCUTÉE. Application sur accord explicite fondateur.
-- ⚠ DÉTECTION PAR PORTE (e64c37e) : finish_line_heading renseigné → le rayon
--   sert de DEMI-LARGEUR DE PORTE (franchissement + sens), pas de rayon de
--   proximité. NE PAS retirer le heading.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── GÉOMÉTRIE MESURÉE (modèle latéral depuis la ligne OXV) ───────────────────
--   ligne OXV : 39.483568, -0.631076  → à 2,02 m de l'axe piste, CÔTÉ OPPOSÉ
--   aux stands ; cap piste au franchissement : 55,2°.
--   bord piste côté stands   :  8,0 m   (piste 12 m)
--   PIT WALL (mur physique)  :  8,0 → ~12,5 m  (épaisseur ~4-5 m, imagerie)
--   fast lane                :  à partir de ~12,5 m
--   axe voie des stands      : 16,2 m   (parallèle à 0,4° — un filtre de cap
--                                        ne discrimine pas ; la porte + le mur, oui)
--
-- DEMI-LARGEUR RETENUE : 10 m → couvre la piste entière (8 m) avec 2 m de marge
-- GPS, s'arrête à 2,5 m du début de la fast lane (elle-même derrière le mur).
-- Fenêtre admissible [8,0 ; 12,5]. Le RaceBox fait 1-3 m en dynamique : ça tient.
-- VALIDATION OBLIGATOIRE jour J : remonter la voie des stands SANS franchir la
-- ligne → 0 tour. Si un tour apparaît, réduire vers 9, jamais sous 8.

-- ── 1. VÉRIFIER ──────────────────────────────────────────────────────────────
select id, name, finish_line_lat, finish_line_lon, finish_line_radius_m,
       finish_line_heading, length_km, turns_count
from public.circuits
where name ilike '%tormo%' or name ilike '%valence%' or name ilike '%valencia%';

-- ── 2. CRÉER (aucune ligne attendue à l'étape 1) ─────────────────────────────
insert into public.circuits (
  id, name, is_official, is_default,
  finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading,
  length_km, turns_count,
  bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon
) values (
  gen_random_uuid(),
  'Circuit Ricardo Tormo',
  true,
  false,                               -- Haute Saintonge reste le défaut
  39.483568, -0.631076, 10, 55.2,
  4.000,                               -- mesuré sur les 135 points chaînés (officiel 4,005)
  14,
  39.481599, 39.48944, -0.635173, -0.626055
);

-- ── 3. CONTRÔLE ──────────────────────────────────────────────────────────────
select name, finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading
from public.circuits where name ilike '%tormo%';
