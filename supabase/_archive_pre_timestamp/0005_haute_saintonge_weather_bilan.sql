-- ============================================================================
-- OXV App — Module B.2 v0.1 : Bilan riche + Météo + Haute Saintonge
-- À exécuter APRÈS les migrations 0001-0004
-- Date : 16 mai 2026
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1 : Évolution de la table circuits pour distinguer officiel vs perso
-- ============================================================================

ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;

ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS official_name TEXT;

ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS region TEXT;

ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS length_km NUMERIC(4,2);

ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS turns_count INTEGER;

ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS description TEXT;

-- SVG path du tracé stylisé
ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS track_svg_path TEXT;

-- Bounding box (pour viewBox SVG)
ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS bbox_min_lat NUMERIC(10,7);
ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS bbox_max_lat NUMERIC(10,7);
ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS bbox_min_lon NUMERIC(10,7);
ALTER TABLE circuits 
  ADD COLUMN IF NOT EXISTS bbox_max_lon NUMERIC(10,7);

-- ============================================================================
-- ÉTAPE 2 : Politiques RLS pour circuits officiels (visibles par tous)
-- ============================================================================

-- Supprimer l'ancienne policy "voir ses propres circuits"
DROP POLICY IF EXISTS "Users can view own circuits" ON circuits;

-- Nouvelle policy : user voit (ses circuits perso) OU (les circuits officiels)
CREATE POLICY "Users can view own or official circuits"
  ON circuits FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_official = true
  );

-- ============================================================================
-- ÉTAPE 3 : Seed Haute Saintonge
-- ============================================================================

-- Insérer le circuit officiel Haute Saintonge (user_id NULL pour officiel)
-- Note : on contourne le NOT NULL sur user_id en utilisant un user system
-- Approche : on rend user_id nullable pour les circuits officiels

ALTER TABLE circuits 
  ALTER COLUMN user_id DROP NOT NULL;

-- Vérifier qu'on n'insère pas en double
DELETE FROM circuits 
WHERE is_official = true 
  AND name = 'Haute Saintonge';

INSERT INTO circuits (
  user_id,
  name,
  official_name,
  is_official,
  is_default,
  city,
  region,
  length_km,
  turns_count,
  description,
  
  finish_line_lat,
  finish_line_lon,
  finish_line_radius_m,
  
  bbox_min_lat,
  bbox_max_lat,
  bbox_min_lon,
  bbox_max_lon,
  
  track_svg_path
) VALUES (
  NULL,  -- circuit officiel, pas d'owner
  'Haute Saintonge',
  'Circuit de Haute-Saintonge Jean-Pierre Beltoise',
  true,
  true,
  'La Genétouze',
  'Charente-Maritime (17)',
  2.2,
  7,
  'Imaginé par Jean-Pierre Beltoise et inauguré en 2009, ce tracé de 2,2 km combine deux lignes droites de 650 mètres avec sept virages techniques. La piste est exploitée par Julien Beltoise. Premier circuit français conçu dans une démarche développement durable.',
  
  -- Ligne d'arrivée approximative (entre les 2 sources publiques, ajustée
  -- pour le milieu de la ligne droite principale)
  -- TODO V2 : calibrer sur place avec RaceBox pour précision ±1m
  45.24180,
  -0.09080,
  35,  -- rayon 35m (un peu plus large que défaut car approximation)
  
  -- Bounding box (zone du circuit pour viewBox SVG)
  45.24050,
  45.24320,
  -0.09700,
  -0.08850,
  
  -- SVG path stylisé (tracé schématique : 2 lignes droites + virages)
  -- ViewBox : 0 0 1000 600
  -- TODO V2 : remplacer par tracé OSM exact via script Python
  'M 100,300 L 700,300 Q 850,300 850,200 Q 850,100 700,100 L 200,100 Q 80,100 100,200 Q 130,260 180,250 Q 250,240 250,300 Z'
);

-- ============================================================================
-- ÉTAPE 4 : Table weather_snapshots (météo des sessions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS weather_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES telemetry_sessions(id) ON DELETE CASCADE,
  
  -- Moment du snapshot
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moment TEXT NOT NULL CHECK (moment IN ('before', 'during', 'after')),
  
  -- Position
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  
  -- Conditions
  temperature_c NUMERIC(4,1),
  feels_like_c NUMERIC(4,1),
  humidity_pct INTEGER,
  pressure_hpa INTEGER,
  visibility_km NUMERIC(4,1),
  
  -- Vent
  wind_speed_kmh NUMERIC(5,1),
  wind_direction_deg INTEGER,
  wind_gust_kmh NUMERIC(5,1),
  
  -- Précipitations
  precipitation_mm NUMERIC(5,2),
  precipitation_probability_pct INTEGER,
  
  -- Code météo (WMO)
  weather_code INTEGER,
  weather_label TEXT,
  
  -- Données brutes (pour debug ou enrichissement)
  raw_data JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_session 
  ON weather_snapshots(session_id, moment);

ALTER TABLE weather_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own weather" ON weather_snapshots;
CREATE POLICY "Users can view own weather"
  ON weather_snapshots FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own weather" ON weather_snapshots;
CREATE POLICY "Users can insert own weather"
  ON weather_snapshots FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- ÉTAPE 5 : Notes utilisateur sur les sessions
-- ============================================================================

-- La colonne notes existe déjà depuis 0003, on en ajoute une "custom_name"
ALTER TABLE telemetry_sessions
  ADD COLUMN IF NOT EXISTS custom_name TEXT;

ALTER TABLE telemetry_sessions
  ADD COLUMN IF NOT EXISTS vehicle_label TEXT;

-- ============================================================================
-- ÉTAPE 6 : Refresh schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
