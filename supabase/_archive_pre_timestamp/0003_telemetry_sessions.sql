-- ============================================================================
-- OXV App — Module B.1 : Tables télémétrie
-- À exécuter dans Supabase SQL Editor APRÈS les migrations 0001 et 0002
-- Date : 16 mai 2026
-- ============================================================================

-- ============================================================================
-- TABLE 1 : telemetry_sessions
-- Une ligne par session de roulage
-- ============================================================================

CREATE TABLE IF NOT EXISTS telemetry_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Métadonnées session
  name TEXT,
  circuit_name TEXT DEFAULT 'Haute Saintonge',
  vehicle_id UUID,
  weather TEXT,
  notes TEXT,
  
  -- Horodatage
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN ended_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER 
      ELSE NULL 
    END
  ) STORED,
  
  -- Statistiques calculées (mises à jour en fin de session)
  total_frames INTEGER DEFAULT 0,
  max_speed_kmh NUMERIC(6,2),
  max_g_lateral NUMERIC(4,2),
  max_g_longitudinal NUMERIC(4,2),
  distance_km NUMERIC(6,2),
  lap_count INTEGER DEFAULT 0,
  best_lap_seconds NUMERIC(7,3),
  
  -- État
  status TEXT NOT NULL DEFAULT 'recording' 
    CHECK (status IN ('recording', 'completed', 'aborted', 'processing')),
  
  -- Fichier brut (URL Supabase Storage pour les frames .dat)
  raw_data_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_user 
  ON telemetry_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_status 
  ON telemetry_sessions(status);

-- ============================================================================
-- TABLE 2 : telemetry_frames
-- Stockage compact des frames live (mode debug / replay simple)
-- Pour V1, on enregistre des "samples" : 1 frame toutes les ~200ms (5 Hz)
-- Les 25 Hz complets sont stockés dans le fichier .dat sur Storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS telemetry_frames (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES telemetry_sessions(id) ON DELETE CASCADE,
  
  -- Horodatage relatif à la session
  elapsed_ms INTEGER NOT NULL,
  
  -- GPS
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  altitude_m NUMERIC(7,2),
  gps_accuracy_m NUMERIC(5,2),
  gps_fix INTEGER,
  satellites INTEGER,
  
  -- Motion
  speed_kmh NUMERIC(6,2),
  heading NUMERIC(5,2),
  
  -- IMU
  g_force_x NUMERIC(4,3),
  g_force_y NUMERIC(4,3),
  g_force_z NUMERIC(4,3),
  
  -- Batterie
  battery_level INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_frames_session 
  ON telemetry_frames(session_id, elapsed_ms);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE telemetry_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_frames ENABLE ROW LEVEL SECURITY;

-- Sessions : un user voit ses propres sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON telemetry_sessions;
CREATE POLICY "Users can view own sessions"
  ON telemetry_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON telemetry_sessions;
CREATE POLICY "Users can insert own sessions"
  ON telemetry_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON telemetry_sessions;
CREATE POLICY "Users can update own sessions"
  ON telemetry_sessions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON telemetry_sessions;
CREATE POLICY "Users can delete own sessions"
  ON telemetry_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Frames : un user voit les frames de ses propres sessions
DROP POLICY IF EXISTS "Users can view own frames" ON telemetry_frames;
CREATE POLICY "Users can view own frames"
  ON telemetry_frames FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own frames" ON telemetry_frames;
CREATE POLICY "Users can insert own frames"
  ON telemetry_frames FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- BUCKET STORAGE pour les fichiers .dat (frames 25 Hz)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'telemetry-raw', 
  'telemetry-raw', 
  false,  -- PRIVÉ
  104857600,  -- 100 MB max par fichier
  ARRAY['application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users read own raw telemetry" ON storage.objects;
CREATE POLICY "Users read own raw telemetry"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'telemetry-raw'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users upload own raw telemetry" ON storage.objects;
CREATE POLICY "Users upload own raw telemetry"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'telemetry-raw'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- Notify PostgREST de recharger le cache de schéma
-- ============================================================================

NOTIFY pgrst, 'reload schema';
