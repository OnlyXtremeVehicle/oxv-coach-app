-- ============================================================================
-- Migration 0040 — « La lecture de votre coach » (§10.3c, option D — version sûre)
-- ============================================================================
-- Décision Gabin (2026-06-07) : on retient D mais en VERSION SÛRE, attribuée.
--
-- Le coach définit ses pondérations sur les sous-composantes DÉJÀ calculées
-- par OXV (véhicule, pilote, régularité, fluidité). L'app en dérive une
-- « lecture du coach » = moyenne pondérée des MÊMES sous-composantes.
--
-- GARDE-FOU DOCTRINAL CAPITAL : cette lecture est présentée SÉPARÉMENT,
-- explicitement étiquetée « La lecture de votre coach », et ne remplace
-- JAMAIS la marge neutre d'OXV. L'interprétation est portée par le coach
-- (professionnel agréé), pas par OXV. On ne réécrit aucun indicateur OXV.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coach_reading_weights (
  coach_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Pondérations relatives (≥ 0). Normalisées à l'usage : pas besoin de
  -- sommer à 100. Défaut = équipondération (≈ neutre).
  w_vehicle NUMERIC NOT NULL DEFAULT 25 CHECK (w_vehicle >= 0),
  w_pilot NUMERIC NOT NULL DEFAULT 25 CHECK (w_pilot >= 0),
  w_regularity NUMERIC NOT NULL DEFAULT 25 CHECK (w_regularity >= 0),
  w_smoothness NUMERIC NOT NULL DEFAULT 25 CHECK (w_smoothness >= 0),

  -- Intro libre du coach (« Ma lecture privilégie… »). Optionnel.
  note TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coach_reading_weights IS
  'Pondérations du coach pour « La lecture de votre coach » (§10.3c-D). Dérive une lecture des sous-composantes OXV. Présentée séparément, attribuée, ne remplace jamais la marge OXV.';

CREATE OR REPLACE FUNCTION public.coach_reading_weights_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_reading_weights_updated_at ON public.coach_reading_weights;
CREATE TRIGGER coach_reading_weights_updated_at
  BEFORE UPDATE ON public.coach_reading_weights
  FOR EACH ROW EXECUTE FUNCTION public.coach_reading_weights_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_reading_weights ENABLE ROW LEVEL SECURITY;

-- Coach : gère sa propre lecture.
DROP POLICY IF EXISTS coach_reading_weights_coach_manage ON public.coach_reading_weights;
CREATE POLICY coach_reading_weights_coach_manage ON public.coach_reading_weights
  FOR ALL TO authenticated
  USING (coach_id = auth.uid() AND is_coach())
  WITH CHECK (coach_id = auth.uid() AND is_coach());

-- Pilote : lit la lecture de ses coachs (actifs + consentis).
DROP POLICY IF EXISTS coach_reading_weights_pilot_select ON public.coach_reading_weights;
CREATE POLICY coach_reading_weights_pilot_select ON public.coach_reading_weights
  FOR SELECT TO authenticated
  USING (is_my_coach(coach_id));

-- Admin : tout.
DROP POLICY IF EXISTS coach_reading_weights_admin_all ON public.coach_reading_weights;
CREATE POLICY coach_reading_weights_admin_all ON public.coach_reading_weights
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
