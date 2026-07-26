-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 13 juin 2026 a 17:14 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS rotation_x numeric;
ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS rotation_y numeric;
ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS rotation_z numeric;
ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS itow_ms bigint;
ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS speed_ms numeric;
ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS heading_accuracy numeric;
ALTER TABLE telemetry_frames ADD COLUMN IF NOT EXISTS pdop numeric;
CREATE INDEX IF NOT EXISTS idx_frames_session_elapsed ON telemetry_frames (session_id, elapsed_ms);
