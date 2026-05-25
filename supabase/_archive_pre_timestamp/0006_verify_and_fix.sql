-- ============================================================================
-- OXV HOTFIX 0006 — Vérification et fix Haute Saintonge
-- À exécuter dans Supabase pour s'assurer que les données sont propres
-- ============================================================================

-- ÉTAPE 1 : Vérifier qu'on a bien Haute Saintonge
SELECT 
  id, 
  name, 
  is_official, 
  length_km,
  turns_count,
  finish_line_lat,
  finish_line_lon,
  CASE WHEN track_svg_path IS NULL THEN 'NULL'
       WHEN LENGTH(track_svg_path) < 50 THEN 'TROP COURT'
       ELSE 'OK (' || LENGTH(track_svg_path) || ' chars)' 
  END as svg_status
FROM circuits 
WHERE is_official = true;

-- ÉTAPE 2 : Vérifier les politiques RLS
SELECT polname, polcmd 
FROM pg_policy 
WHERE polrelid = 'circuits'::regclass;

-- Si la politique de lecture officiel n'existe pas, la créer :
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'circuits'::regclass 
    AND polname = 'Users can view own or official circuits'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own or official circuits"
      ON circuits FOR SELECT
      USING (auth.uid() = user_id OR is_official = true)';
  END IF;
END $$;

-- ÉTAPE 3 : Refresh schema
NOTIFY pgrst, 'reload schema';
