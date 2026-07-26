-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 26 juin 2026 a 21:10:54 UTC, elle n avait jamais ete
-- versionnee dans ce depot sous sa version reelle. Source : colonne statements, recollee
-- dans l ordre d execution. Le formatage d origine et les commentaires hors instruction
-- sont perdus ; le SQL, lui, est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Phase 2 (sans paiement) : avis post-seance (note 1-5 + texte) + prenom du
-- pilote denormalise sur la demande (revele SEULEMENT le prenom, des la demande ;
-- aucune policy users, aucune exposition de la ligne users du pilote).

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
  UNIQUE (coach_id, pilot_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_reviews_coach ON public.coach_reviews (coach_id);

DROP TRIGGER IF EXISTS coach_reviews_updated_at ON public.coach_reviews;
CREATE TRIGGER coach_reviews_updated_at
  BEFORE UPDATE ON public.coach_reviews
  FOR EACH ROW EXECUTE FUNCTION public.coach_availability_set_updated_at();

ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;

-- Lecture : tout authentifie lit les avis d'un coach PUBLIE (fiche/decouverte).
DROP POLICY IF EXISTS coach_reviews_select_published ON public.coach_reviews;
CREATE POLICY coach_reviews_select_published ON public.coach_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_profiles p
    WHERE p.coach_id = coach_reviews.coach_id AND p.is_published = true
  ));

-- Le pilote ecrit SON avis, seulement s'il a une seance acceptee/completee avec ce coach.
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
