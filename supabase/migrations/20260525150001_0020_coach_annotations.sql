-- =================================================================
-- Migration 0020 — Annotations coach sur les virages d'un pilote
-- =================================================================
--
-- Permet au coach d'écrire une note libre sur un virage spécifique
-- d'une session d'un pilote qu'il suit. Le pilote voit les notes en
-- lecture seule sur l'écran #15 Zoom virage.
--
-- Doctrine :
--   - L'app est un miroir. La note du coach est une OBSERVATION,
--     pas un mode d'emploi.
--   - Le coach reste sobre dans son ton (vouvoiement, pas d'instruction).
--   - Le pilote ne peut pas répondre à une note (asynchrone unidirectionnel).
--
-- Visibilité :
--   - 'private' = note de travail du coach, invisible au pilote
--   - 'shared'  = partagée avec le pilote, visible côté pilote
--
-- RLS :
--   - Le coach SELECT/INSERT/UPDATE/DELETE ses propres notes
--   - Le pilote SELECT les notes où pilot_id = auth.uid() ET
--     visibility = 'shared' ET deleted_at IS NULL
--   - L'admin SELECT toutes les notes (audit)
-- =================================================================

CREATE TABLE IF NOT EXISTS coach_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pilot_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Optionnel : si null, la note s'applique au virage en général
  -- (sur tous les bilans du pilote sur ce circuit)
  telemetry_session_id UUID REFERENCES telemetry_sessions(id) ON DELETE SET NULL,

  -- Virage cible (1..7 pour Beltoise, contraint comme app_segment_analyses)
  corner_index INTEGER NOT NULL CHECK (corner_index BETWEEN 1 AND 7),

  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  visibility TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('private', 'shared')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS coach_annotations_pilot_corner_idx
  ON coach_annotations (pilot_id, corner_index)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS coach_annotations_session_corner_idx
  ON coach_annotations (telemetry_session_id, corner_index)
  WHERE telemetry_session_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS coach_annotations_coach_idx
  ON coach_annotations (coach_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION coach_annotations_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_annotations_updated_at ON coach_annotations;
CREATE TRIGGER coach_annotations_updated_at
  BEFORE UPDATE ON coach_annotations
  FOR EACH ROW EXECUTE FUNCTION coach_annotations_set_updated_at();

-- =================================================================
-- RLS
-- =================================================================

ALTER TABLE coach_annotations ENABLE ROW LEVEL SECURITY;

-- Coach : ses propres notes (toutes opérations)
DROP POLICY IF EXISTS coach_annotations_coach_all ON coach_annotations;
CREATE POLICY coach_annotations_coach_all ON coach_annotations
  FOR ALL
  USING (coach_id = auth.uid() AND is_coach_of(pilot_id))
  WITH CHECK (coach_id = auth.uid() AND is_coach_of(pilot_id));

-- Pilote : SELECT uniquement, sur les notes partagées non supprimées
DROP POLICY IF EXISTS coach_annotations_pilot_select ON coach_annotations;
CREATE POLICY coach_annotations_pilot_select ON coach_annotations
  FOR SELECT
  USING (
    pilot_id = auth.uid()
    AND visibility = 'shared'
    AND deleted_at IS NULL
  );

-- Admin : SELECT toutes les notes (audit RGPD)
DROP POLICY IF EXISTS coach_annotations_admin_select ON coach_annotations;
CREATE POLICY coach_annotations_admin_select ON coach_annotations
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- =================================================================
-- Doc
-- =================================================================

COMMENT ON TABLE coach_annotations IS
  'Notes de coaching attachées à un virage spécifique d''un pilote. Asynchrone unidirectionnel : le coach écrit, le pilote lit.';
COMMENT ON COLUMN coach_annotations.visibility IS
  '''private'' = note de travail du coach (invisible au pilote). ''shared'' = visible côté pilote sur l''écran zoom virage.';
COMMENT ON COLUMN coach_annotations.telemetry_session_id IS
  'Optionnel. Si renseigné, la note est contextualisée à cette session. Si null, note générique sur le virage (lue sur toute session).';
