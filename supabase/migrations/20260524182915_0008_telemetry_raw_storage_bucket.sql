-- Bucket Storage pour les fichiers UBX bruts des sessions de
-- pilotage. Référencé depuis telemetry_sessions.raw_data_url.
--
-- Convention de path : {user_id}/{telemetry_session_id}.ubx
-- ce qui permet une RLS basée sur le premier segment.
--
-- Bucket privé, max 50 MB par fichier (cf. archi P1 sec. 3.7).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'telemetry_raw',
  'telemetry_raw',
  false,
  52428800,
  ARRAY['application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- RLS sur storage.objects : un user ne voit/écrit que ses propres fichiers
-- (le premier segment du path doit être son auth.uid()).

DROP POLICY IF EXISTS telemetry_raw_select_own ON storage.objects;
CREATE POLICY telemetry_raw_select_own ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'telemetry_raw'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS telemetry_raw_insert_own ON storage.objects;
CREATE POLICY telemetry_raw_insert_own ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'telemetry_raw'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS telemetry_raw_update_own ON storage.objects;
CREATE POLICY telemetry_raw_update_own ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'telemetry_raw'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS telemetry_raw_delete_own ON storage.objects;
CREATE POLICY telemetry_raw_delete_own ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'telemetry_raw'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
