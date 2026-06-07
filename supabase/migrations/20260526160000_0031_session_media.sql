-- ============================================================================
-- Migration 0031 — Table session_media + bucket storage (Page Média)
-- ============================================================================
--
-- Permet à OXV (admin) d'attacher des médias (photos / vidéos) à une
-- session de pilote. Le pilote retrouve ses souvenirs dans un écran
-- galerie dédié au bilan.
--
-- Cas d'usage typique :
--   - Photographe OXV shoote en piste pendant un track day
--   - Admin sélectionne les meilleures photos par pilote
--   - Upload via /(admin)/sessions/{id}/media
--   - Pilote voit ses photos dans /(app)/session-media/{id}
--
-- Doctrine V1 :
--   - Pas de gating par forfait pour cette V1 — si OXV upload, le pilote
--     voit. La gating par offre sera ajoutée en V1.1 si besoin.
--   - Lecture uniquement par le pilote propriétaire, ses amis (read-only),
--     ses coachs (read-only), et les admins.
--   - Upload/Delete uniquement par admins.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table session_media
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.session_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  telemetry_session_id UUID NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  -- Dénormalisé pour faciliter les RLS et requêtes par pilote
  pilot_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Storage : chemin dans le bucket `session-media`
  storage_path TEXT NOT NULL,

  -- Métadonnées
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  mime_type TEXT,
  file_size_bytes BIGINT,
  width_px INT,
  height_px INT,
  duration_seconds NUMERIC(6, 2),

  -- Caption optionnelle (admin peut annoter « Sortie courbe 4 », etc.)
  caption TEXT,

  -- Tracking
  uploaded_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Soft delete pour audit RGPD
  deleted_at TIMESTAMPTZ,

  -- Ordre d'affichage (admin peut réordonner)
  display_order INT NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.session_media IS
  'Médias (photos/vidéos) attachés à une session de pilote, uploadés par admin OXV après track day.';
COMMENT ON COLUMN public.session_media.pilot_user_id IS
  'Dénormalisé depuis telemetry_sessions.user_id pour simplifier les RLS et requêtes "tous mes médias".';
COMMENT ON COLUMN public.session_media.storage_path IS
  'Chemin dans le bucket session-media. Convention : {pilot_user_id}/{session_id}/{media_id}.{ext}';
COMMENT ON COLUMN public.session_media.deleted_at IS
  'Soft delete — le storage object peut être purgé par un cron séparé.';

CREATE INDEX IF NOT EXISTS idx_session_media_session
  ON public.session_media(telemetry_session_id, display_order)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_session_media_pilot
  ON public.session_media(pilot_user_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. RLS sur session_media
-- ----------------------------------------------------------------------------

ALTER TABLE public.session_media ENABLE ROW LEVEL SECURITY;

-- SELECT : propriétaire pilote
DROP POLICY IF EXISTS session_media_select_owner ON public.session_media;
CREATE POLICY session_media_select_owner ON public.session_media
  FOR SELECT TO authenticated
  USING (pilot_user_id = auth.uid() AND deleted_at IS NULL);

-- SELECT : amis du pilote (cohérent avec extension RLS Duel)
DROP POLICY IF EXISTS session_media_select_friend ON public.session_media;
CREATE POLICY session_media_select_friend ON public.session_media
  FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), pilot_user_id) AND deleted_at IS NULL);

-- SELECT : coachs actifs+consentis (cohérent avec is_coach_of)
DROP POLICY IF EXISTS session_media_select_coach ON public.session_media;
CREATE POLICY session_media_select_coach ON public.session_media
  FOR SELECT TO authenticated
  USING (public.is_coach_of(pilot_user_id) AND deleted_at IS NULL);

-- SELECT : admins
DROP POLICY IF EXISTS session_media_select_admin ON public.session_media;
CREATE POLICY session_media_select_admin ON public.session_media
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT : admins uniquement
DROP POLICY IF EXISTS session_media_insert_admin ON public.session_media;
CREATE POLICY session_media_insert_admin ON public.session_media
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- UPDATE : admins uniquement (réordonner, modifier caption, soft-delete)
DROP POLICY IF EXISTS session_media_update_admin ON public.session_media;
CREATE POLICY session_media_update_admin ON public.session_media
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE : admins uniquement (hard delete rare, préfère soft via UPDATE)
DROP POLICY IF EXISTS session_media_delete_admin ON public.session_media;
CREATE POLICY session_media_delete_admin ON public.session_media
  FOR DELETE TO authenticated
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- 3. Bucket Storage `session-media` + Storage RLS
-- ----------------------------------------------------------------------------
-- Note : on ne crée PAS le bucket dans cette migration car ça nécessite
-- l'extension storage qui n'est pas toujours migrable. À créer côté
-- Dashboard Supabase > Storage > New bucket :
--   - Name: session-media
--   - Public: false
--   - File size limit: 50 MB
--   - Allowed MIME types: image/jpeg, image/png, image/heic, video/mp4
--
-- Les Storage RLS suivantes assument que le bucket existe.
-- ----------------------------------------------------------------------------

-- Storage RLS sont gérées via la table storage.objects.
-- Convention path : {pilot_user_id}/{session_id}/{media_id}.{ext}
-- → On peut extraire le pilot_user_id depuis storage.foldername(name)[1]

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'objects' AND relnamespace = (
      SELECT oid FROM pg_namespace WHERE nspname = 'storage'
    )
  ) THEN
    -- SELECT : owner, friends, coachs, admins
    EXECUTE $sql$
      DROP POLICY IF EXISTS session_media_storage_select ON storage.objects;
      CREATE POLICY session_media_storage_select ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'session-media'
          AND (
            -- Owner
            (storage.foldername(name))[1] = auth.uid()::text
            -- Friend
            OR public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
            -- Coach
            OR public.is_coach_of(((storage.foldername(name))[1])::uuid)
            -- Admin
            OR public.is_admin()
          )
        );
    $sql$;

    -- INSERT/UPDATE/DELETE : admins uniquement
    EXECUTE $sql$
      DROP POLICY IF EXISTS session_media_storage_write ON storage.objects;
      CREATE POLICY session_media_storage_write ON storage.objects
        FOR ALL TO authenticated
        USING (bucket_id = 'session-media' AND public.is_admin())
        WITH CHECK (bucket_id = 'session-media' AND public.is_admin());
    $sql$;
  END IF;
END $$;
