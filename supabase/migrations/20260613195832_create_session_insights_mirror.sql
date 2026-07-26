-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 13 juin 2026 a 19:58 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

CREATE TABLE IF NOT EXISTS session_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telemetry_session_id uuid NOT NULL REFERENCES telemetry_sessions(id) ON DELETE CASCADE,
  user_id uuid,
  n_laps integer,
  n_frames integer,
  engine_version text,
  computed_at timestamptz DEFAULT now(),
  anatomy jsonb,
  gg_envelope jsonb,
  throttle_brake jsonb,
  dispersion jsonb,
  ideal_lap jsonb,
  session_drift jsonb,
  flow_coherence jsonb,
  chassis_balance jsonb,
  load_transfer jsonb,
  data_quality jsonb,
  UNIQUE (telemetry_session_id)
);
ALTER TABLE session_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insights read" ON session_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service writes insights" ON session_insights FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
