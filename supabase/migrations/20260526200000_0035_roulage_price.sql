-- ============================================================================
-- Migration 0035 — Prix par place sur les roulages (§10.2 dashboard coach)
-- ============================================================================
-- Décision Gabin (2026-06-07, cahier v3 §10.2 sans la remise) : le coach
-- dispose d'un tableau de bord business affichant le suivi de SES revenus.
-- La seule source de revenu interne à l'app et contrôlée par le coach est
-- la tarification de ses roulages. On ajoute donc un prix par place.
--
-- Stocké en CENTIMES d'euro (entier), cohérent avec payments.amount.
-- NULL = roulage non tarifé (gratuit / prix non renseigné).
--
-- La remise dégressive -5/-10/-15 % est ABANDONNÉE (décision Gabin) : aucune
-- colonne ni logique de remise n'est introduite.
-- ============================================================================

ALTER TABLE public.coach_roulages
  ADD COLUMN IF NOT EXISTS price_per_pilot INTEGER
  CHECK (price_per_pilot IS NULL OR price_per_pilot >= 0);

COMMENT ON COLUMN public.coach_roulages.price_per_pilot IS
  'Prix par place en centimes d''euro. NULL = non tarifé. Sert au suivi des revenus du coach (§10.2).';
