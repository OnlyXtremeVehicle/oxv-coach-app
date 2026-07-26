-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 a 22:21 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Virages détectés automatiquement par circuit. Additif, nullable, réversible.
ALTER TABLE public.circuits
  ADD COLUMN IF NOT EXISTS corners                 jsonb,
  ADD COLUMN IF NOT EXISTS corners_engine_version  text,
  ADD COLUMN IF NOT EXISTS corners_computed_at      timestamptz;

COMMENT ON COLUMN public.circuits.corners IS
  'Virages auto-détectés depuis la géométrie (moteur corners-v1). Tant que non calé sur télémétrie : calibration=schematic_svg (approximatif). Forme: {engine_version, params, n_corners, corners:[{corner_index, direction, apex_s_norm, r_m, name, calibration}]}. name = couche éditoriale, assignée séparément.';
