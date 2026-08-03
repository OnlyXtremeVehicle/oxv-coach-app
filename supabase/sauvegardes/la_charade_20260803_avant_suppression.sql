-- =============================================================================
-- SAUVEGARDE AVANT SUPPRESSION — circuit « La charade »
--
-- Capturée le 03/08/2026, AVANT la migration `..._j0h_retrait_la_charade.sql`.
-- Règle 0.5 du programme V3 : aucune suppression destructive sans sauvegarde
-- vérifiée. Ce fichier EST la vérification.
--
-- CE QUE C'ÉTAIT
--
-- Une fiche de circuit PRIVÉE (`review_status = 'private'`, `is_official`
-- faux), créée le 16/05/2026 par le compte 88203298-…, sans tracé, sans
-- centerline, sans virages, sans longueur. Sa ligne d'arrivée — 45.5988038,
-- -0.1338882 — tombe à une centaine de mètres de celle de Haute Saintonge
-- (45.6004, -0.141) : c'était un doublon d'essai, pas un circuit.
--
-- Une seule séance de télémétrie y pointait (f13545a1-…, 1 tour, 16/05/2026).
-- Elle portait déjà `circuit_name = 'La charade'` : la détacher ne retire rien
-- de ce que le pilote voit.
--
-- POUR REVENIR EN ARRIÈRE
--
-- Exécuter l'INSERT ci-dessous, puis rétablir le lien :
--
--   update public.telemetry_sessions
--      set circuit_id = 'ed3ce247-040d-45a8-925c-ba7e5c1f7cde'
--    where id = 'f13545a1-21a4-4d0d-86e2-914047ea33e1';
-- =============================================================================

insert into public.circuits (
  id, user_id, name, official_name, city, region, description,
  is_default, is_official, review_status,
  length_km, turns_count, best_lap_seconds, total_sessions,
  finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading,
  track_svg_path, centerline_latlon, corners, corners_engine_version, corners_computed_at,
  bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon,
  created_at, updated_at
) values (
  'ed3ce247-040d-45a8-925c-ba7e5c1f7cde',
  '88203298-6204-45d9-b6e6-e8d9aa6c0c3a',
  'La charade',
  null, null, null, null,
  false, false, 'private',
  null, null, null, 0,
  45.5988038, -0.1338882, 30, null,
  null, null, null, null, null,
  null, null, null, null,
  '2026-05-16T16:21:45.006615+00:00',
  '2026-06-13T21:19:57.489733+00:00'
);
