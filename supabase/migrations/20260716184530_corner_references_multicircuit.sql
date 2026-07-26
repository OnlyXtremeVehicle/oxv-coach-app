-- ============================================================================
-- Repères de virage MULTI-CIRCUIT (demande fondateur 2026-07-16, accord
-- explicite AskUserQuestion — appliquée en prod le même jour).
--
-- Avant : coach_corner_reference clé (coach_id, corner_index) — le circuit
-- était IMPLICITE (Haute Saintonge). Avec Valence (14 virages) au calendrier,
-- un repère doit appartenir à UN circuit : le virage 3 de Haute Saintonge
-- n'est pas le virage 3 de Ricardo Tormo.
--
-- Table VIDE au moment de l'application (0 repère constaté) → colonne posée
-- NOT NULL directement, pas de backfill nécessaire. Si elle ne l'était plus :
-- backfill sur l'id de Haute Saintonge (les repères y ont été créés) AVANT le
-- SET NOT NULL.
-- ============================================================================

-- 1. La colonne (NOT NULL direct : table vide vérifiée).
ALTER TABLE public.coach_corner_reference
  ADD COLUMN IF NOT EXISTS circuit_id UUID REFERENCES public.circuits(id) ON DELETE CASCADE;

DO $$
BEGIN
  -- Garde : si des lignes existaient sans circuit (application tardive),
  -- les rattacher à Haute Saintonge avant de verrouiller.
  UPDATE public.coach_corner_reference
     SET circuit_id = (SELECT id FROM public.circuits WHERE name = 'Haute Saintonge' LIMIT 1)
   WHERE circuit_id IS NULL;

  ALTER TABLE public.coach_corner_reference
    ALTER COLUMN circuit_id SET NOT NULL;
END $$;

-- 2. L'unicité passe de (coach, virage) à (coach, circuit, virage).
ALTER TABLE public.coach_corner_reference
  DROP CONSTRAINT IF EXISTS coach_corner_reference_coach_id_corner_index_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_corner_reference_coach_circuit_corner_key'
      AND conrelid = 'public.coach_corner_reference'::regclass
  ) THEN
    ALTER TABLE public.coach_corner_reference
      ADD CONSTRAINT coach_corner_reference_coach_circuit_corner_key
      UNIQUE (coach_id, circuit_id, corner_index);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coach_corner_reference_circuit
  ON public.coach_corner_reference(coach_id, circuit_id);

COMMENT ON COLUMN public.coach_corner_reference.circuit_id IS
  'Circuit du repère (multi-circuit, 2026-07-16). Un repère appartient à un circuit : ses virages sont dérivés du tracé réel (centerline_latlon, détection par courbure) ou de la topologie nommée (Haute Saintonge).';
