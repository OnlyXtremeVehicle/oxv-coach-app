-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 25 juin 2026 a 19:58:20 UTC, elle n avait jamais ete
-- versionnee dans ce depot sous sa version reelle. Source : colonne statements, recollee
-- dans l ordre d execution. Le formatage d origine et les commentaires hors instruction
-- sont perdus ; le SQL, lui, est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Place de marche coaching Phase 1 — tables NOUVELLES uniquement.
-- Section 0 (policy coach_profiles) OMISE : coach_profiles_read_published
-- (is_published = true) existe deja en prod. coach_profiles non touche.

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

CREATE OR REPLACE FUNCTION public.coach_availability_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
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

CREATE TABLE IF NOT EXISTS public.coaching_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coach_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  availability_id     UUID REFERENCES public.coach_availability(id) ON DELETE SET NULL,
  requested_starts_at TIMESTAMPTZ,
  circuit_name        TEXT,
  message             TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','declined','cancelled','paid','completed','refunded')),
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

ALTER TABLE public.coaching_bookings ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS coaching_bookings_pilot_cancel ON public.coaching_bookings;
CREATE POLICY coaching_bookings_pilot_cancel ON public.coaching_bookings
  FOR UPDATE TO authenticated
  USING (pilot_id = auth.uid())
  WITH CHECK (pilot_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS coaching_bookings_coach_select ON public.coaching_bookings;
CREATE POLICY coaching_bookings_coach_select ON public.coaching_bookings
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

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
