-- Migration RECONSTITUÉE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquée en production le 18 juillet 2026 à 15:47:31 (UTC), elle n'avait jamais été
-- versionnée dans ce dépôt. Source : colonne statements, recollée dans l'ordre d'exécution.
-- Le formatage d'origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a réellement tourné. Ne pas rejouer : déjà appliquée.

-- OXV — Espace partenaire valorisant (fondateur : « on va faire de même pour un partenaire »)
-- 1) Galerie médias de la fiche entreprise (miroir de coach_profiles.media)
ALTER TABLE public.partner_accounts ADD COLUMN IF NOT EXISTS media jsonb;
-- 2) Upload partner-media : is_partner() strict refusait le compte multi-casquettes
--    (role=admin) — même correctif que coach-media le 2026-07-19.
DROP POLICY IF EXISTS partner_media_insert ON storage.objects;
CREATE POLICY partner_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'partner-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (public.is_partner() OR public.is_admin())
  );
