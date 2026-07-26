-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 15:38:12, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- OXV — sessions : lecture rétablie proprement (constat fondateur
-- 2026-07-19 : « permission denied for table sessions » à la création
-- admin — l'insert chaîne .select(), or le GRANT SELECT avait été
-- révoqué au durcissement, la policy 'true' rendant ce revoke
-- indispensable. On remet le GRANT et on resserre la POLICY :
--   · admin        → toutes les sessions (y compris B2B privées)
--   · authenticated→ uniquement les non-privées (= sessions_public)
-- Aucune exposition nouvelle ; les lectures directes du site
-- (pages admin, calendriers internes) refonctionnent.
-- ============================================================
DROP POLICY IF EXISTS sessions_select_authenticated ON public.sessions;
CREATE POLICY sessions_select_authenticated ON public.sessions
  FOR SELECT TO authenticated
  USING (public.is_admin() OR is_private IS NOT TRUE);

GRANT SELECT ON public.sessions TO authenticated;
