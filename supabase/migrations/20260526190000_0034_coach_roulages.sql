-- ============================================================================
-- Migration 0034 — Roulages organisés par le coach (§8 OXV Mirror)
-- ============================================================================
-- Décision Gabin (2026-06-07) :
--   - Le coach CRÉE ses roulages et INVITE ses pilotes.
--   - La remise dégressive -5/-10/-15 % est ABANDONNÉE (aucune logique de
--     prix/paiement ici — DROP franc, conforme à la doctrine).
--
-- Gating : la gestion des roulages est réservée aux coachs disposant de la
-- permission modulaire 'manage_own_sessions' (table coach_permissions, 0032).
--
-- Sécurité :
--   - Un coach ne gère QUE ses propres roulages (coach_id = auth.uid()) ET
--     seulement avec la permission manage_own_sessions.
--   - Un coach n'invite QUE des pilotes qui lui sont assignés (coach_pilots
--     actif). Pas besoin du consentement DATA : un roulage est un événement,
--     pas un accès à la télémétrie.
--   - Le pilote voit ses invitations et peut accepter/refuser (rien d'autre).
--   - Admin : tous droits.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper is_coach() — l'utilisateur courant a-t-il le rôle coach ?
-- ----------------------------------------------------------------------------
-- Même pattern que is_admin() / is_coach_of() : STABLE SECURITY DEFINER pour
-- usage en RLS sans buter sur la RLS de la table users.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'coach'
  );
$$;

COMMENT ON FUNCTION public.is_coach() IS
  'True si auth.uid() a le rôle coach. Helper RLS pour les features coach.';

REVOKE EXECUTE ON FUNCTION public.is_coach() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Table coach_roulages
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_roulages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- Circuit du roulage. Texte libre en V1 (un seul circuit OXV pour l'instant).
  circuit_name TEXT NOT NULL DEFAULT 'Circuit de Haute Saintonge',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  -- Nombre de places (optionnel). NULL = non limité.
  max_pilots INTEGER CHECK (max_pilots IS NULL OR max_pilots > 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

COMMENT ON TABLE public.coach_roulages IS
  'Roulages organisés par un coach (§8). Le coach crée et invite ses pilotes. Gating : permission manage_own_sessions.';
COMMENT ON COLUMN public.coach_roulages.max_pilots IS
  'Places disponibles. NULL = non limité.';
COMMENT ON COLUMN public.coach_roulages.status IS
  'open = ouvert aux inscriptions ; cancelled = annulé ; done = passé/clôturé.';

CREATE INDEX IF NOT EXISTS idx_coach_roulages_coach ON public.coach_roulages(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_roulages_starts ON public.coach_roulages(starts_at);

-- updated_at automatique
CREATE OR REPLACE FUNCTION public.coach_roulages_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_roulages_updated_at ON public.coach_roulages;
CREATE TRIGGER coach_roulages_updated_at
  BEFORE UPDATE ON public.coach_roulages
  FOR EACH ROW
  EXECUTE FUNCTION public.coach_roulages_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Table roulage_invitations
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roulage_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roulage_id UUID NOT NULL REFERENCES public.coach_roulages(id) ON DELETE CASCADE,
  pilot_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (roulage_id, pilot_id)
);

COMMENT ON TABLE public.roulage_invitations IS
  'Invitations de pilotes à un roulage coach. Le pilote accepte/refuse (status).';

CREATE INDEX IF NOT EXISTS idx_roulage_invitations_roulage ON public.roulage_invitations(roulage_id);
CREATE INDEX IF NOT EXISTS idx_roulage_invitations_pilot ON public.roulage_invitations(pilot_id);

-- ----------------------------------------------------------------------------
-- 4. RLS — coach_roulages
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_roulages ENABLE ROW LEVEL SECURITY;

-- Coach : gère ses propres roulages SI permission manage_own_sessions.
DROP POLICY IF EXISTS coach_roulages_manage_own ON public.coach_roulages;
CREATE POLICY coach_roulages_manage_own ON public.coach_roulages
  FOR ALL TO authenticated
  USING (coach_id = auth.uid() AND coach_has_permission(auth.uid(), 'manage_own_sessions'))
  WITH CHECK (coach_id = auth.uid() AND coach_has_permission(auth.uid(), 'manage_own_sessions'));

-- Pilote invité : lecture seule des roulages où il figure.
DROP POLICY IF EXISTS coach_roulages_invited_pilot_select ON public.coach_roulages;
CREATE POLICY coach_roulages_invited_pilot_select ON public.coach_roulages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roulage_invitations ri
      WHERE ri.roulage_id = coach_roulages.id
        AND ri.pilot_id = auth.uid()
    )
  );

-- Admin : tout.
DROP POLICY IF EXISTS coach_roulages_admin_all ON public.coach_roulages;
CREATE POLICY coach_roulages_admin_all ON public.coach_roulages
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 5. RLS — roulage_invitations
-- ----------------------------------------------------------------------------

ALTER TABLE public.roulage_invitations ENABLE ROW LEVEL SECURITY;

-- Coach propriétaire : gère les invitations de SES roulages, et ne peut
-- inviter QUE des pilotes qui lui sont assignés (coach_pilots actif).
DROP POLICY IF EXISTS roulage_invitations_coach_manage ON public.roulage_invitations;
CREATE POLICY roulage_invitations_coach_manage ON public.roulage_invitations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_roulages cr
      WHERE cr.id = roulage_invitations.roulage_id
        AND cr.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coach_roulages cr
      WHERE cr.id = roulage_invitations.roulage_id
        AND cr.coach_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.coach_pilots cp
      WHERE cp.coach_id = auth.uid()
        AND cp.pilot_id = roulage_invitations.pilot_id
        AND cp.active = true
    )
  );

-- Pilote : lit ses propres invitations.
DROP POLICY IF EXISTS roulage_invitations_pilot_select ON public.roulage_invitations;
CREATE POLICY roulage_invitations_pilot_select ON public.roulage_invitations
  FOR SELECT TO authenticated
  USING (pilot_id = auth.uid());

-- Pilote : met à jour le statut de SES invitations (accepter/refuser).
-- (RLS ne filtre pas par colonne ; l'app n'envoie que status/responded_at.)
DROP POLICY IF EXISTS roulage_invitations_pilot_respond ON public.roulage_invitations;
CREATE POLICY roulage_invitations_pilot_respond ON public.roulage_invitations
  FOR UPDATE TO authenticated
  USING (pilot_id = auth.uid())
  WITH CHECK (pilot_id = auth.uid());

-- Admin : tout.
DROP POLICY IF EXISTS roulage_invitations_admin_all ON public.roulage_invitations;
CREATE POLICY roulage_invitations_admin_all ON public.roulage_invitations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
