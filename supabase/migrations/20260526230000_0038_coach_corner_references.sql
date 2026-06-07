-- ============================================================================
-- Migration 0038 — Repères de référence du coach par virage (§10.3c, option A)
-- ============================================================================
-- Décision Gabin (2026-06-07) : le coach définit, par virage, SES repères
-- (point de freinage de référence, vitesse de passage repère, trajectoire).
-- L'app les superpose à la donnée du pilote, ÉTIQUETÉS « Repère de votre
-- coach » — comparaison purement factuelle. Le pilote tire ses conclusions.
--
-- Doctrine : descriptif, attribué au coach (professionnel agréé), jamais
-- présenté comme une consigne d'OXV. Vocabulaire « repère », pas « consigne ».
--
-- Les repères sont au niveau COACH (un jeu par coach), appliqués à tous ses
-- élèves consentis. Circuit unique en V1 (Haute Saintonge), donc clé sur le
-- numéro de virage (corner_index).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper is_my_coach(coach_uuid) — coach_uuid est-il un coach (actif +
--    consenti) de l'utilisateur courant (le pilote) ? Réciproque de
--    is_coach_of. Réutilisable par toutes les vues pilote de contenu coach.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_my_coach(coach_uuid UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_pilots
    WHERE coach_id = coach_uuid
      AND pilot_id = auth.uid()
      AND active = true
      AND pilot_consent_at IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.is_my_coach(UUID) IS
  'True si coach_uuid est un coach actif ET consenti de auth.uid() (le pilote). Réciproque de is_coach_of, pour les RLS de contenu coach lu côté pilote.';

REVOKE EXECUTE ON FUNCTION public.is_my_coach(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_coach(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Table coach_corner_reference
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_corner_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  corner_index INTEGER NOT NULL CHECK (corner_index >= 1),

  -- Repères (tous optionnels). « repère », pas « consigne ».
  braking_point_m NUMERIC CHECK (braking_point_m IS NULL OR braking_point_m >= 0),
  target_speed_kmh NUMERIC CHECK (target_speed_kmh IS NULL OR target_speed_kmh >= 0),
  trajectory_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (coach_id, corner_index)
);

COMMENT ON TABLE public.coach_corner_reference IS
  'Repères de référence du coach par virage (§10.3c-A). Superposés à la donnée du pilote, étiquetés « Repère de votre coach ». Descriptif, attribué, jamais consigne OXV.';

CREATE INDEX IF NOT EXISTS idx_coach_corner_reference_coach
  ON public.coach_corner_reference(coach_id);

-- updated_at automatique
CREATE OR REPLACE FUNCTION public.coach_corner_reference_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_corner_reference_updated_at ON public.coach_corner_reference;
CREATE TRIGGER coach_corner_reference_updated_at
  BEFORE UPDATE ON public.coach_corner_reference
  FOR EACH ROW
  EXECUTE FUNCTION public.coach_corner_reference_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_corner_reference ENABLE ROW LEVEL SECURITY;

-- Coach : gère ses propres repères.
DROP POLICY IF EXISTS coach_corner_reference_coach_manage ON public.coach_corner_reference;
CREATE POLICY coach_corner_reference_coach_manage ON public.coach_corner_reference
  FOR ALL TO authenticated
  USING (coach_id = auth.uid() AND is_coach())
  WITH CHECK (coach_id = auth.uid() AND is_coach());

-- Pilote : lit les repères de SES coachs (actifs + consentis).
DROP POLICY IF EXISTS coach_corner_reference_pilot_select ON public.coach_corner_reference;
CREATE POLICY coach_corner_reference_pilot_select ON public.coach_corner_reference
  FOR SELECT TO authenticated
  USING (is_my_coach(coach_id));

-- Admin : tout.
DROP POLICY IF EXISTS coach_corner_reference_admin_all ON public.coach_corner_reference;
CREATE POLICY coach_corner_reference_admin_all ON public.coach_corner_reference
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
