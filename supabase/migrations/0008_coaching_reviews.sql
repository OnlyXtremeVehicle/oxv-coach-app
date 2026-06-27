-- ============================================================================
-- Place de marché coaching — Phase 2 (SANS paiement) : avis + prénom pilote.
-- APPLIQUÉE en prod le 2026-06-25 (accord Gabin) via apply_migration
--   « coaching_reviews_and_pilot_first_name ».
--
-- Décisions Gabin : avis = note 1-5 + texte ; identité côté coach = PRÉNOM
-- révélé dès la demande. Paiement Stripe = reporté (pas dans cette migration).
--
-- Le prénom est DÉNORMALISÉ sur la demande (et sur l'avis) : on n'expose
-- jamais la ligne `users` du pilote — seul son prénom, qu'il fournit lui-même.
-- ============================================================================

ALTER TABLE public.coaching_bookings ADD COLUMN IF NOT EXISTS pilot_first_name text;

CREATE TABLE IF NOT EXISTS public.coach_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pilot_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id       UUID REFERENCES public.coaching_bookings(id) ON DELETE SET NULL,
  pilot_first_name TEXT,
  rating           INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, pilot_id) -- un avis par pilote par coach (éditable)
);

CREATE INDEX IF NOT EXISTS idx_coach_reviews_coach ON public.coach_reviews (coach_id);

DROP TRIGGER IF EXISTS coach_reviews_updated_at ON public.coach_reviews;
CREATE TRIGGER coach_reviews_updated_at
  BEFORE UPDATE ON public.coach_reviews
  FOR EACH ROW EXECUTE FUNCTION public.coach_availability_set_updated_at();

ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;

-- Lecture : tout authentifié lit les avis d'un coach PUBLIÉ (fiche / découverte).
DROP POLICY IF EXISTS coach_reviews_select_published ON public.coach_reviews;
CREATE POLICY coach_reviews_select_published ON public.coach_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_profiles p
    WHERE p.coach_id = coach_reviews.coach_id AND p.is_published = true
  ));

-- Le pilote écrit SON avis, seulement s'il a une séance acceptée/complétée avec ce coach.
DROP POLICY IF EXISTS coach_reviews_pilot_write ON public.coach_reviews;
CREATE POLICY coach_reviews_pilot_write ON public.coach_reviews
  FOR ALL TO authenticated
  USING (pilot_id = auth.uid())
  WITH CHECK (
    pilot_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.coaching_bookings b
      WHERE b.coach_id = coach_reviews.coach_id AND b.pilot_id = auth.uid()
        AND b.status IN ('accepted', 'completed')
    )
  );

DROP POLICY IF EXISTS coach_reviews_admin_all ON public.coach_reviews;
CREATE POLICY coach_reviews_admin_all ON public.coach_reviews
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
