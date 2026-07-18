-- ⚠ NON APPLIQUÉE (règle du lot : exécution APRÈS validation M. Fillat).
-- Jointe au repo pour revue — le code du lot tolère l'absence des colonnes (42703).
-- ============================================================
-- OXV — Migration : champs profil + opt-in Pavillon
-- Lot : PROFIL_CARTES
-- À exécuter APRÈS validation par M. Fillat.
-- Vérifier au préalable qu'aucun champ équivalent n'existe
-- (grep sur le code app : "bio", "car_number", "pavilion").
-- ============================================================

-- 1. Bio éditable du pilote (profil public entre membres)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio text
  CHECK (char_length(bio) <= 400);

-- 2. Numéro de voiture — identité Pavillon (arbitrage A7)
--    Unique par pilote actif ; attribution manuelle staff au départ.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS car_number smallint
  CHECK (car_number BETWEEN 1 AND 999);

CREATE UNIQUE INDEX IF NOT EXISTS users_car_number_unique
  ON public.users (car_number)
  WHERE car_number IS NOT NULL;

-- 3. Opt-in affichage nominatif sur les écrans du Pavillon
--    (arbitrage A7 — désactivé par défaut, RGPD)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pavilion_name_optin boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pavilion_name_optin_at timestamptz;

-- Horodatage automatique du consentement (preuve RGPD)
CREATE OR REPLACE FUNCTION public.set_pavilion_optin_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pavilion_name_optin IS DISTINCT FROM OLD.pavilion_name_optin THEN
    NEW.pavilion_name_optin_at := CASE WHEN NEW.pavilion_name_optin THEN now() ELSE NULL END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pavilion_optin_at ON public.users;
CREATE TRIGGER trg_pavilion_optin_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_pavilion_optin_at();

-- ============================================================
-- NOTE RLS : les policies existantes de public.users doivent déjà
-- restreindre l'UPDATE au propriétaire (auth.uid() = id).
-- Vérifier qu'aucune policy SELECT publique n'expose bio/car_number
-- au-delà du périmètre membres authentifiés.
-- Aucune nouvelle policy créée par cette migration.
-- ============================================================
