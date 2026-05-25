-- Ajoute le tracking d'acceptation du Pacte de pilotage et des CGU
-- au niveau du user. Volontairement NULL par défaut : un compte
-- existant n'a pas accepté les CGU/Pacte tant qu'il n'a pas refait
-- l'onboarding après déploiement V1.
--
-- Voir docs/juridique/01_PACTE_DE_PILOTAGE et 02_CGU_APP_OXV_COACH.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pact_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pact_version text,
  ADD COLUMN IF NOT EXISTS cgu_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS cgu_version text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text;

COMMENT ON COLUMN public.users.pact_accepted_at IS
  'Timestamp d''acceptation du Pacte de pilotage. NULL = pacte non encore accepté.';
COMMENT ON COLUMN public.users.cgu_accepted_at IS
  'Timestamp d''acceptation des CGU OXV Coach. NULL = CGU non encore acceptées.';
COMMENT ON COLUMN public.users.privacy_accepted_at IS
  'Timestamp d''acceptation de la Politique de confidentialité.';
