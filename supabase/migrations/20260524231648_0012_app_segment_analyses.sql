-- Table app_segment_analyses : stats par segment (virage / ligne droite)
-- pour une session de roulage donnée.
--
-- Issue de l'intégration trackviz sem 12. Remplace mockCornerMargins par
-- de vraies marges calculées à partir des frames GPS+IMU. Une ligne par
-- (session, segment_index 1..14). UNIQUE garantit l'idempotence.

CREATE TABLE IF NOT EXISTS public.app_segment_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telemetry_session_id uuid NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  segment_index int4 NOT NULL CHECK (segment_index >= 1),
  segment_name text,
  kind text CHECK (kind IN ('straight', 'turn', 'chicane')),

  start_progress numeric(5, 4),
  end_progress numeric(5, 4),

  sample_count int4,
  duration_seconds numeric(8, 3),

  entry_speed_kmh numeric(5, 1),
  apex_speed_kmh numeric(5, 1),
  exit_speed_kmh numeric(5, 1),
  min_speed_kmh numeric(5, 1),
  max_speed_kmh numeric(5, 1),
  avg_speed_kmh numeric(5, 1),

  max_g_lateral numeric(4, 3),
  max_g_braking numeric(4, 3),
  max_g_accel numeric(4, 3),

  avg_lateral_error_m numeric(5, 2),
  max_lateral_error_m numeric(5, 2),

  margin_percent numeric(5, 2) CHECK (margin_percent IS NULL OR (margin_percent >= 0 AND margin_percent <= 100)),
  margin_zone text CHECK (margin_zone IS NULL OR margin_zone IN ('green', 'yellow', 'red')),

  algo_version text NOT NULL DEFAULT 'trackviz-v1.0',
  computed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_segment_analyses_unique_per_session_segment
    UNIQUE (telemetry_session_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_app_segment_analyses_session
  ON public.app_segment_analyses (telemetry_session_id, segment_index);

CREATE INDEX IF NOT EXISTS idx_app_segment_analyses_user
  ON public.app_segment_analyses (user_id, computed_at DESC);

ALTER TABLE public.app_segment_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_segment_analyses_select_own ON public.app_segment_analyses;
CREATE POLICY app_segment_analyses_select_own ON public.app_segment_analyses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS app_segment_analyses_insert_own ON public.app_segment_analyses;
CREATE POLICY app_segment_analyses_insert_own ON public.app_segment_analyses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS app_segment_analyses_update_own ON public.app_segment_analyses;
CREATE POLICY app_segment_analyses_update_own ON public.app_segment_analyses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS app_segment_analyses_delete_admin_only ON public.app_segment_analyses;
CREATE POLICY app_segment_analyses_delete_admin_only ON public.app_segment_analyses
  FOR DELETE TO authenticated
  USING (is_admin());
