-- =================================================================
-- Migration 0023 — Objectifs personnels du pilote
-- =================================================================
--
-- Le pilote peut se fixer un objectif sobre avant une session
-- (ex: « Apprivoiser le virage 3 »). L'objectif s'affiche sur le
-- bilan post-session. Auto-évaluation libre après : atteint /
-- à continuer / lâcher.
--
-- Doctrine : pas d'objectif imposé par l'app, pas de score, pas de
-- gamification. Juste un mot que le pilote se donne à lui-même.
-- =================================================================

CREATE TABLE IF NOT EXISTS pilot_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 200),

  -- Statut : actif = en cours, achieved = atteint, continued = à continuer,
  -- abandoned = lâché. Toujours libre, jamais imposé par l'app.
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'achieved', 'continued', 'abandoned')
  ),

  -- Optionnel : si rattaché à une session passée (auto-évaluation après)
  evaluated_session_id UUID REFERENCES telemetry_sessions(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_goals_user_active_idx
  ON pilot_goals (user_id, created_at DESC)
  WHERE status = 'active';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION pilot_goals_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pilot_goals_updated_at ON pilot_goals;
CREATE TRIGGER pilot_goals_updated_at
  BEFORE UPDATE ON pilot_goals
  FOR EACH ROW EXECUTE FUNCTION pilot_goals_set_updated_at();

-- =================================================================
-- RLS — strict propriétaire
-- =================================================================

ALTER TABLE pilot_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pilot_goals_owner_all ON pilot_goals;
CREATE POLICY pilot_goals_owner_all ON pilot_goals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Le coach NE VOIT PAS les objectifs personnels du pilote (volontaire :
-- c'est l'espace intime du pilote, le coach ne s'y mêle pas).
-- Admin pareil (pas de SELECT admin pour cette table).

COMMENT ON TABLE pilot_goals IS
  'Objectifs personnels que le pilote se fixe à lui-même. Espace intime, jamais visible des coachs ni admins.';
