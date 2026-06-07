-- ============================================================================
-- Migration 0037 — Paramètres contextuels du coach (§10.3 OXV Mirror)
-- ============================================================================
-- Cahier v3 §10.3 : le coach enrichit la donnée brute avec son savoir
-- contextuel, « ce que le capteur ne capte pas ». Trois formes :
--   1. Annotations textuelles  → DÉJÀ FAIT (table coach_annotations).
--   2. Paramètres contextuels  → CETTE MIGRATION : niveau de l'élève,
--      objectif travaillé, matériel utilisé, conditions météo vécues.
--   3. Méthodes appliquées à la restitution → cadrage écrit en attente de
--      validation Gabin (doctrine), aucun schéma ici.
--
-- Cohérence doctrinale (cahier §10.3) : c'est le COACH — professionnel agréé,
-- sous sa responsabilité — qui apporte ce contexte. OXV ne fournit que
-- l'outil. Le contexte est destiné à l'élève : le pilote le voit sur son
-- bilan (pas de toggle privé, contrairement aux annotations).
--
-- Sécurité :
--   - le coach gère le contexte de SES élèves consentis (is_coach_of) ;
--   - le pilote lit le contexte de SES propres sessions ;
--   - admin : tout.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coach_session_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pilot_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,

  -- Paramètres contextuels (tous optionnels, texte libre court).
  pilot_level TEXT,
  objective TEXT,
  equipment TEXT,
  weather_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul contexte par coach et par session.
  UNIQUE (coach_id, session_id),
  CHECK (coach_id <> pilot_id)
);

COMMENT ON TABLE public.coach_session_context IS
  'Paramètres contextuels saisis par le coach sur une session d''un élève (§10.3) : niveau, objectif, matériel, météo vécue. Destiné à l''élève (visible sur son bilan).';

CREATE INDEX IF NOT EXISTS idx_coach_session_context_session
  ON public.coach_session_context(session_id);
CREATE INDEX IF NOT EXISTS idx_coach_session_context_pilot
  ON public.coach_session_context(pilot_id);

-- updated_at automatique
CREATE OR REPLACE FUNCTION public.coach_session_context_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_session_context_updated_at ON public.coach_session_context;
CREATE TRIGGER coach_session_context_updated_at
  BEFORE UPDATE ON public.coach_session_context
  FOR EACH ROW
  EXECUTE FUNCTION public.coach_session_context_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_session_context ENABLE ROW LEVEL SECURITY;

-- Coach : gère le contexte de ses élèves consentis (is_coach_of vérifie
-- l'assignation active ET le consentement).
DROP POLICY IF EXISTS coach_session_context_coach_manage ON public.coach_session_context;
CREATE POLICY coach_session_context_coach_manage ON public.coach_session_context
  FOR ALL TO authenticated
  USING (coach_id = auth.uid() AND is_coach_of(pilot_id))
  WITH CHECK (coach_id = auth.uid() AND is_coach_of(pilot_id));

-- Pilote : lit le contexte de ses propres sessions.
DROP POLICY IF EXISTS coach_session_context_pilot_select ON public.coach_session_context;
CREATE POLICY coach_session_context_pilot_select ON public.coach_session_context
  FOR SELECT TO authenticated
  USING (pilot_id = auth.uid());

-- Admin : tout.
DROP POLICY IF EXISTS coach_session_context_admin_all ON public.coach_session_context;
CREATE POLICY coach_session_context_admin_all ON public.coach_session_context
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
