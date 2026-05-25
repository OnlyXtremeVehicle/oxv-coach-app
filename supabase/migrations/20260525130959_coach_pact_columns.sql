-- Bucket 1.A — Pacte de coaching distinct du pacte pilote
--
-- Un user role='coach' signe le PACTE DE COACHING (pas le pacte de
-- pilotage). Ce sont 2 documents juridiques distincts car les
-- engagements diffèrent :
--   - Pilote : "je suis seul responsable de mes décisions en piste"
--   - Coach : "je m'engage à respecter la confidentialité du pilote
--     et à ne pas me substituer à OXV"
--
-- L'isOnboardingComplete vérifie maintenant :
--   - pilote : pact_accepted_at + cgu_accepted_at
--   - coach  : coach_pact_accepted_at + cgu_accepted_at
-- Le profile_completed_at reste commun (marqueur de fin onboarding).
--
-- Note : déjà appliqué en prod via SQL Editor (placeholder antérieur).
-- ADD COLUMN IF NOT EXISTS rend l'opération idempotente pour dev/test fresh.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coach_pact_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS coach_pact_version text;

COMMENT ON COLUMN public.users.coach_pact_accepted_at IS
  'Date d''acceptation du Pacte de coaching (uniquement pour les users role=coach). Distinct de pact_accepted_at qui est le Pacte de pilotage.';
COMMENT ON COLUMN public.users.coach_pact_version IS
  'Version du Pacte de coaching acceptée. Permet de re-soliciter consentement si le pacte est mis à jour.';
