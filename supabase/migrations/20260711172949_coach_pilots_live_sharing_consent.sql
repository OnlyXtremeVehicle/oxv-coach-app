ALTER TABLE public.coach_pilots
  ADD COLUMN IF NOT EXISTS live_sharing_at timestamptz NULL;

COMMENT ON COLUMN public.coach_pilots.live_sharing_at IS
  'Consentement du pilote au partage LIVE (telemetrie temps reel) avec ce coach. NULL = non consenti. Distinct de pilot_consent_at (apres-seance). Revocable.';
