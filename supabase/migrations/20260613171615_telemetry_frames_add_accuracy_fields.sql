-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 13 juin 2026 a 17:16 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS speed_accuracy numeric;
ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS fix_valid boolean;
