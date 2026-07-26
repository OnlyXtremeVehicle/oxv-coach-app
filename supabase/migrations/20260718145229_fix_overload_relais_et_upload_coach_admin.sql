-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 14:52:29, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- OXV — Deux correctifs (constats fondateur 2026-07-19)
-- 1) ACCEPTATION ADMIN REFUSÉE : l'ajout de p_dry_run avait créé une
--    SURCHARGE — l'ancienne admin_validate_inscription(uuid,text,text)
--    (en-tête Authorization invalide) coexistait avec la nouvelle →
--    appel RPC ambigu/résolu sur la mauvaise → échec. On supprime
--    l'ancienne : une seule fonction, la bonne.
-- 2) PHOTO COACH REFUSÉE : la policy d'upload coach-media exigeait
--    is_coach() strict (role='coach') — le compte multi-casquettes
--    (role='admin') était refusé. Élargie à is_coach() OR is_admin().
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_validate_inscription(uuid, text, text);

DROP POLICY IF EXISTS "Coaches can upload own media" ON storage.objects;
CREATE POLICY "Coaches can upload own media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (public.is_coach() OR public.is_admin())
  );
