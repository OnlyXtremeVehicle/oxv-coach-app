-- Table app_session_analyses : résultat du calcul de marge composite
-- pour chaque telemetry_session. Une seule analyse par session en V1
-- (UNIQUE sur telemetry_session_id).
--
-- Voir docs/architecture/02_PARTIE_2_algorithmes pour l'algo de marge.

CREATE TABLE IF NOT EXISTS public.app_session_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telemetry_session_id uuid NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Marge composite (le chiffre central du bilan)
  margin_global numeric(5,2) CHECK (margin_global >= 0 AND margin_global <= 100),
  margin_zone text CHECK (margin_zone IN ('green', 'yellow', 'red')),

  -- Décomposition pour la traçabilité
  margin_vehicle numeric(5,2),
  margin_pilot numeric(5,2),

  -- Sous-indicateurs et metadata (regularity, smoothness, marges par virage...)
  margin_breakdown jsonb,

  -- Suggestion "Une chose à creuser"
  next_focus_corner_index int4,
  next_focus_phrase text,

  -- Texte du debrief J+1 (généré OpenAI côté Edge Function)
  debrief_text text,
  debrief_generated_at timestamptz,

  -- Tracking acceptation du Pacte au moment de l'analyse
  pact_accepted_at timestamptz,
  pact_version text,

  -- Metadata algo
  algo_version text NOT NULL DEFAULT 'v1.0',
  computed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_session_analyses_unique_per_session UNIQUE (telemetry_session_id)
);

CREATE INDEX IF NOT EXISTS idx_app_session_analyses_user_date
  ON public.app_session_analyses (user_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_session_analyses_telemetry
  ON public.app_session_analyses (telemetry_session_id);

-- RLS
ALTER TABLE public.app_session_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_session_analyses_select_own ON public.app_session_analyses;
CREATE POLICY app_session_analyses_select_own ON public.app_session_analyses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS app_session_analyses_insert_own ON public.app_session_analyses;
CREATE POLICY app_session_analyses_insert_own ON public.app_session_analyses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS app_session_analyses_update_own ON public.app_session_analyses;
CREATE POLICY app_session_analyses_update_own ON public.app_session_analyses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS app_session_analyses_delete_admin_only ON public.app_session_analyses;
CREATE POLICY app_session_analyses_delete_admin_only ON public.app_session_analyses
  FOR DELETE TO authenticated
  USING (is_admin());
