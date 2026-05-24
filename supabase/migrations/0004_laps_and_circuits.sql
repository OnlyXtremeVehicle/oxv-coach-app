-- ============================================================================
-- OXV App — Module B.1 v0.3 : Détection des tours + calibration circuits
-- À exécuter dans Supabase SQL Editor APRÈS les migrations 0001, 0002, 0003
-- Date : 16 mai 2026
-- ============================================================================

-- ============================================================================
-- TABLE : circuits (calibration ligne d'arrivée par utilisateur)
-- Permet à l'utilisateur de définir sa ligne d'arrivée pour chaque circuit
-- ============================================================================

CREATE TABLE IF NOT EXISTS circuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Identification
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  
  -- Ligne d'arrivée (point GPS + tolérance)
  finish_line_lat NUMERIC(10,7) NOT NULL,
  finish_line_lon NUMERIC(10,7) NOT NULL,
  finish_line_radius_m NUMERIC(5,2) DEFAULT 30, -- rayon détection en mètres
  
  -- Direction de passage (pour éviter faux positifs en U-turn)
  finish_line_heading NUMERIC(5,2), -- en degrés 0-360, optionnel
  
  -- Stats du circuit
  total_sessions INTEGER DEFAULT 0,
  best_lap_seconds NUMERIC(7,3),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circuits_user ON circuits(user_id);

-- ============================================================================
-- TABLE : laps (détail tour par tour)
-- ============================================================================

CREATE TABLE IF NOT EXISTS laps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES telemetry_sessions(id) ON DELETE CASCADE,
  
  -- Numérotation
  lap_number INTEGER NOT NULL,
  is_best_lap BOOLEAN DEFAULT false,
  is_outlap BOOLEAN DEFAULT false,    -- tour de mise en route
  is_inlap BOOLEAN DEFAULT false,     -- tour de retour aux stands
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds NUMERIC(7,3) NOT NULL,
  
  -- Stats du tour
  max_speed_kmh NUMERIC(6,2),
  avg_speed_kmh NUMERIC(6,2),
  max_g_lateral NUMERIC(4,2),
  max_g_braking NUMERIC(4,2),
  max_g_accel NUMERIC(4,2),
  distance_meters NUMERIC(8,2),
  
  -- Position début/fin (pour debug et validation)
  start_lat NUMERIC(10,7),
  start_lon NUMERIC(10,7),
  end_lat NUMERIC(10,7),
  end_lon NUMERIC(10,7),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_laps_session ON laps(session_id, lap_number);

-- ============================================================================
-- AJOUTER colonnes manquantes à telemetry_sessions
-- ============================================================================

ALTER TABLE telemetry_sessions 
  ADD COLUMN IF NOT EXISTS circuit_id UUID REFERENCES circuits(id) ON DELETE SET NULL;

ALTER TABLE telemetry_sessions 
  ADD COLUMN IF NOT EXISTS best_lap_number INTEGER;

ALTER TABLE telemetry_sessions 
  ADD COLUMN IF NOT EXISTS avg_lap_seconds NUMERIC(7,3);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE laps ENABLE ROW LEVEL SECURITY;

-- Circuits : un user voit ses propres circuits
DROP POLICY IF EXISTS "Users can view own circuits" ON circuits;
CREATE POLICY "Users can view own circuits"
  ON circuits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own circuits" ON circuits;
CREATE POLICY "Users can insert own circuits"
  ON circuits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own circuits" ON circuits;
CREATE POLICY "Users can update own circuits"
  ON circuits FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own circuits" ON circuits;
CREATE POLICY "Users can delete own circuits"
  ON circuits FOR DELETE
  USING (auth.uid() = user_id);

-- Laps : visible si la session appartient au user
DROP POLICY IF EXISTS "Users can view own laps" ON laps;
CREATE POLICY "Users can view own laps"
  ON laps FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own laps" ON laps;
CREATE POLICY "Users can insert own laps"
  ON laps FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- FONCTION : auto-update du best_lap dans la session
-- ============================================================================

CREATE OR REPLACE FUNCTION update_session_best_lap()
RETURNS TRIGGER AS $$
BEGIN
  -- Trouve le tour le plus rapide de la session
  UPDATE telemetry_sessions
  SET 
    best_lap_seconds = (
      SELECT MIN(duration_seconds)
      FROM laps
      WHERE session_id = NEW.session_id
        AND is_outlap = false
        AND is_inlap = false
    ),
    best_lap_number = (
      SELECT lap_number
      FROM laps
      WHERE session_id = NEW.session_id
        AND is_outlap = false
        AND is_inlap = false
      ORDER BY duration_seconds ASC
      LIMIT 1
    ),
    avg_lap_seconds = (
      SELECT AVG(duration_seconds)
      FROM laps
      WHERE session_id = NEW.session_id
        AND is_outlap = false
        AND is_inlap = false
    ),
    lap_count = (
      SELECT COUNT(*)
      FROM laps
      WHERE session_id = NEW.session_id
    )
  WHERE id = NEW.session_id;
  
  -- Marquer le best lap
  UPDATE laps SET is_best_lap = false WHERE session_id = NEW.session_id;
  
  UPDATE laps SET is_best_lap = true
  WHERE session_id = NEW.session_id
    AND duration_seconds = (
      SELECT MIN(duration_seconds)
      FROM laps
      WHERE session_id = NEW.session_id
        AND is_outlap = false
        AND is_inlap = false
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lap_inserted ON laps;
CREATE TRIGGER on_lap_inserted
  AFTER INSERT ON laps
  FOR EACH ROW
  EXECUTE FUNCTION update_session_best_lap();

-- ============================================================================
-- Refresh schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
