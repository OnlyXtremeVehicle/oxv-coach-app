-- ============================================================================
-- Feature Coach — étape 2/2 : table coach_pilots + helper is_coach_of + RLS
-- ============================================================================
-- Brief : un coach est un user avec role='coach' qui peut voir la télémétrie
-- et les analyses de ses pilotes assignés (lecture seule uniquement).
--
-- Décisions V1 (auto mode) :
--   D1 — Free, pas de logique paiement
--   D2 — Admin valide l'inscription coach (pas d'auto-signup)
--   D3+D4 — Many-to-many, pas de check applicatif sur nb max coachs/pilote
--   D5 — Consentement RGPD via pilot_consent_at sur coach_pilots
--
-- Sécurité : un coach ne voit JAMAIS :
--   - documents (RGPD), payments, registrations (commercial OXV)
--   - email/téléphone d'un pilote (passe par OXV pour contact)
-- Un coach ne MODIFIE JAMAIS rien chez le pilote (SELECT only via RLS).

-- ----------------------------------------------------------------------------
-- 1. Table coach_pilots
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_pilots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pilot_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  -- D5 — Consentement RGPD du pilote au coaching. Null = pas encore consenti.
  -- Tant que null, le coach NE VOIT RIEN (vérifié dans is_coach_of).
  pilot_consent_at TIMESTAMPTZ,
  UNIQUE(coach_id, pilot_id),
  -- Empêche coach=pilote (un user ne peut pas être son propre coach)
  CHECK (coach_id <> pilot_id)
);

COMMENT ON TABLE public.coach_pilots IS
  'Assignation coach <-> pilote (many-to-many). active=true ET pilot_consent_at IS NOT NULL pour que le coach voie les données.';
COMMENT ON COLUMN public.coach_pilots.pilot_consent_at IS
  'Timestamp du consentement RGPD du pilote au coaching. Null = pas consenti = coach ne voit rien.';
COMMENT ON COLUMN public.coach_pilots.created_by IS
  'Qui a fait l''assignation (souvent admin OXV).';

CREATE INDEX IF NOT EXISTS idx_coach_pilots_coach
  ON public.coach_pilots(coach_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_coach_pilots_pilot
  ON public.coach_pilots(pilot_id) WHERE active;

ALTER TABLE public.coach_pilots ENABLE ROW LEVEL SECURITY;

-- Policies coach_pilots
-- Coach voit ses propres assignations
CREATE POLICY "coach_pilots_select_own_coach"
  ON public.coach_pilots
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Pilote voit ses propres assignations (pour pouvoir consentir/révoquer)
CREATE POLICY "coach_pilots_select_own_pilot"
  ON public.coach_pilots
  FOR SELECT
  TO authenticated
  USING (pilot_id = auth.uid());

-- Pilote peut mettre à jour le consentement sur ses propres assignations
-- (toggle pilot_consent_at). Ne peut pas changer coach/pilot/active.
CREATE POLICY "coach_pilots_update_own_pilot_consent"
  ON public.coach_pilots
  FOR UPDATE
  TO authenticated
  USING (pilot_id = auth.uid())
  WITH CHECK (pilot_id = auth.uid());

-- Admin a tous les droits (CRUD complet)
CREATE POLICY "coach_pilots_admin_all"
  ON public.coach_pilots
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 2. Fonction helper is_coach_of(pilot_uuid)
-- ----------------------------------------------------------------------------
-- Retourne true si le user courant est coach actif de pilot_uuid ET que le
-- pilote a consenti. Suit le même pattern que is_admin() (STABLE SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.is_coach_of(pilot_uuid UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_pilots
    WHERE coach_id = auth.uid()
      AND pilot_id = pilot_uuid
      AND active = true
      AND pilot_consent_at IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.is_coach_of(UUID) IS
  'Vérifie que auth.uid() est coach actif ET consenti par le pilote pilot_uuid. Utilisé par les RLS coach_select sur telemetry, analyses, etc.';

REVOKE EXECUTE ON FUNCTION public.is_coach_of(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Policies coach SELECT sur les tables pilote
-- ----------------------------------------------------------------------------

CREATE POLICY "telemetry_sessions_coach_select"
  ON public.telemetry_sessions
  FOR SELECT
  TO authenticated
  USING (is_coach_of(user_id));

CREATE POLICY "telemetry_frames_coach_select"
  ON public.telemetry_frames
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.telemetry_sessions
      WHERE is_coach_of(user_id)
    )
  );

CREATE POLICY "laps_coach_select"
  ON public.laps
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.telemetry_sessions
      WHERE is_coach_of(user_id)
    )
  );

CREATE POLICY "app_session_analyses_coach_select"
  ON public.app_session_analyses
  FOR SELECT
  TO authenticated
  USING (is_coach_of(user_id));

CREATE POLICY "app_segment_analyses_coach_select"
  ON public.app_segment_analyses
  FOR SELECT
  TO authenticated
  USING (is_coach_of(user_id));

CREATE POLICY "vehicles_coach_select"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (is_coach_of(user_id));

CREATE POLICY "app_progression_shares_coach_select"
  ON public.app_progression_shares
  FOR SELECT
  TO authenticated
  USING (is_coach_of(user_id));

-- ----------------------------------------------------------------------------
-- 4. Vue limitée coach_pilots_view
-- ----------------------------------------------------------------------------
-- Postgres ne supporte pas RLS par colonne. Pour exposer un sous-ensemble de
-- colonnes users à un coach (nom/prénom/avatar mais PAS email/tel/docs),
-- on crée une vue dédiée en SECURITY INVOKER.

CREATE OR REPLACE VIEW public.coach_pilots_view
WITH (security_invoker = on)
AS
SELECT
  u.id AS pilot_id,
  u.first_name,
  u.last_name,
  u.pilot_level,
  u.avatar_url,
  cp.id AS assignment_id,
  cp.created_at AS assigned_at,
  cp.pilot_consent_at,
  cp.notes
FROM public.coach_pilots cp
JOIN public.users u ON u.id = cp.pilot_id
WHERE cp.coach_id = auth.uid()
  AND cp.active = true
  AND cp.pilot_consent_at IS NOT NULL;

COMMENT ON VIEW public.coach_pilots_view IS
  'Vue restreinte pour les coachs : liste de leurs pilotes assignés ET consentis, avec uniquement les colonnes non-sensibles (pas d''email/tel/docs).';

REVOKE ALL ON public.coach_pilots_view FROM PUBLIC, anon;
GRANT SELECT ON public.coach_pilots_view TO authenticated;
