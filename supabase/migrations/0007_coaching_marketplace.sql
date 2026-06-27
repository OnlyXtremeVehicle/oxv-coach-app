-- ============================================================================
-- Place de marché coaching — MVP Phase 1 (mise en relation, SANS paiement, SANS avis).
-- APPLIQUÉE en prod le 2026-06-25 (accord Gabin), via apply_migration :
--   « coaching_marketplace_phase1 » + « coaching_marketplace_fn_search_path ».
-- Réf. spec : docs/specs-bundle-v4/MVP_PLACE_DE_MARCHE_COACHING.md.
--
-- Cadrage doctrine « le pilote parcourt des coachs publiés » : validé par Gabin.
-- Paiement / commission / unité monétaire / avis = HORS Phase 1 (Phase 2).
--
-- Périmètre RÉELLEMENT appliqué :
--   1. coach_availability (créneaux déclarés par le coach) + RLS.
--   2. coaching_bookings (demande de séance pilote → coach) + RLS.
--   Section 0 (policy SELECT pilote sur coach_profiles publiés) OMISE : la policy
--   `coach_profiles_read_published` (USING is_published = true) EXISTE DÉJÀ en prod
--   (vérifié). coach_profiles n'est donc PAS modifié.
--
-- Sécurité (pattern repris de 0034_coach_roulages) :
--   - Helpers is_admin() / is_coach() DÉJÀ EN PLACE — non redéfinis.
--   - RGPD : une demande `pending` n'ouvre AUCUN accès aux données du pilote.
--     L'affiliation `coach_pilots` (consentement) reste le seul vecteur d'accès
--     télémétrie ; ce MVP ne la modifie pas (cf. spec §4).
--   - Le pilote ne peut QUE créer une demande `pending` et l'annuler
--     (`status = 'cancelled'`) ; il ne peut pas auto-accepter (réservé au coach).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. coach_availability — créneaux déclarés par le coach
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  circuit_name  TEXT NOT NULL DEFAULT 'Circuit de Haute Saintonge',
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  capacity      INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'full', 'closed', 'cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_coach_availability_coach
  ON public.coach_availability (coach_id, starts_at);

-- updated_at automatique. search_path épinglé (lint Supabase 0011).
CREATE OR REPLACE FUNCTION public.coach_availability_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_availability_updated_at ON public.coach_availability;
CREATE TRIGGER coach_availability_updated_at
  BEFORE UPDATE ON public.coach_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.coach_availability_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. coaching_bookings — demande de séance pilote → coach
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coaching_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coach_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  availability_id     UUID REFERENCES public.coach_availability(id) ON DELETE SET NULL,
  requested_starts_at TIMESTAMPTZ,
  circuit_name        TEXT,
  message             TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending', 'accepted', 'declined', 'cancelled',
                          'paid', 'completed', 'refunded'  -- paid/refunded : Phase 2, écriture serveur
                        )),
  responded_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_bookings_coach
  ON public.coaching_bookings (coach_id, status);
CREATE INDEX IF NOT EXISTS idx_coaching_bookings_pilot
  ON public.coaching_bookings (pilot_id, status);

DROP TRIGGER IF EXISTS coaching_bookings_updated_at ON public.coaching_bookings;
CREATE TRIGGER coaching_bookings_updated_at
  BEFORE UPDATE ON public.coaching_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.coach_availability_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS — coach_availability
-- ----------------------------------------------------------------------------
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_availability_manage_own ON public.coach_availability;
CREATE POLICY coach_availability_manage_own ON public.coach_availability
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_availability_select_published ON public.coach_availability;
CREATE POLICY coach_availability_select_published ON public.coach_availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles p
      WHERE p.coach_id = coach_availability.coach_id
        AND p.is_published = true
    )
  );

DROP POLICY IF EXISTS coach_availability_admin_all ON public.coach_availability;
CREATE POLICY coach_availability_admin_all ON public.coach_availability
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 4. RLS — coaching_bookings
-- ----------------------------------------------------------------------------
ALTER TABLE public.coaching_bookings ENABLE ROW LEVEL SECURITY;

-- Pilote : crée SA demande `pending` sur un coach publié (jamais un état Phase 2).
DROP POLICY IF EXISTS coaching_bookings_pilot_insert ON public.coaching_bookings;
CREATE POLICY coaching_bookings_pilot_insert ON public.coaching_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    pilot_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.coach_profiles p
      WHERE p.coach_id = coaching_bookings.coach_id
        AND p.is_published = true
    )
  );

DROP POLICY IF EXISTS coaching_bookings_pilot_select ON public.coaching_bookings;
CREATE POLICY coaching_bookings_pilot_select ON public.coaching_bookings
  FOR SELECT TO authenticated
  USING (pilot_id = auth.uid());

-- Pilote : peut UNIQUEMENT annuler sa demande (pas d'auto-acceptation).
DROP POLICY IF EXISTS coaching_bookings_pilot_cancel ON public.coaching_bookings;
CREATE POLICY coaching_bookings_pilot_cancel ON public.coaching_bookings
  FOR UPDATE TO authenticated
  USING (pilot_id = auth.uid())
  WITH CHECK (pilot_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS coaching_bookings_coach_select ON public.coaching_bookings;
CREATE POLICY coaching_bookings_coach_select ON public.coaching_bookings
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

-- Coach : répond à ses demandes (accepter / décliner / annuler).
DROP POLICY IF EXISTS coaching_bookings_coach_respond ON public.coaching_bookings;
CREATE POLICY coaching_bookings_coach_respond ON public.coaching_bookings
  FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coaching_bookings_admin_all ON public.coaching_bookings;
CREATE POLICY coaching_bookings_admin_all ON public.coaching_bookings
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- FIN — Sections 1-4 APPLIQUÉES en prod le 2026-06-25.
-- ============================================================================
