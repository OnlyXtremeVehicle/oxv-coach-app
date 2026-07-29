-- ============================================================================
-- T-2 : ThumbHash sur les médias de séance
-- ============================================================================
--
-- APPLIQUÉE EN PRODUCTION le 29/07/2026, sur accord du fondateur.
--
-- NULL = pas encore généré : l affichage retombe sur l aplat titane. Jamais de
-- valeur fabriquée. L index partiel sert la file de génération.
-- ============================================================================

ALTER TABLE public.session_media
  ADD COLUMN IF NOT EXISTS thumbhash text;

COMMENT ON COLUMN public.session_media.thumbhash IS
  'ThumbHash base64 du média (lot T2). NULL = pas encore généré : l''affichage retombe sur l''aplat titane. Jamais de valeur fabriquée.';

CREATE INDEX IF NOT EXISTS idx_session_media_thumbhash_manquant
  ON public.session_media (uploaded_at)
  WHERE thumbhash IS NULL AND deleted_at IS NULL;
