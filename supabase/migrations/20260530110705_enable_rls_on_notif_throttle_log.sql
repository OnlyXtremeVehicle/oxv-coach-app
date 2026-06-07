-- [Réimportée dans le repo le 2026-06-08 : appliquée en prod le 2026-05-30,
--  hors dépôt. Contenu = SQL réellement appliqué (schema_migrations).]
-- Migration : Activer Row Level Security sur notif_throttle_log
-- Source : Audit Supabase §4.1 / §9.2 / Annexe B
-- Alerte Supabase Advisor : critical

-- 1) Activer RLS
ALTER TABLE public.notif_throttle_log ENABLE ROW LEVEL SECURITY;

-- 2) Policy INSERT : service_role uniquement (edge functions notify-*)
DROP POLICY IF EXISTS "notif_throttle_log_service_insert" ON public.notif_throttle_log;
CREATE POLICY "notif_throttle_log_service_insert"
ON public.notif_throttle_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3) Policy SELECT : service_role uniquement (rate-limiting check)
DROP POLICY IF EXISTS "notif_throttle_log_service_select" ON public.notif_throttle_log;
CREATE POLICY "notif_throttle_log_service_select"
ON public.notif_throttle_log
FOR SELECT
TO service_role
USING (true);

-- 4) Policy DELETE : service_role uniquement (cleanup automatique)
DROP POLICY IF EXISTS "notif_throttle_log_service_delete" ON public.notif_throttle_log;
CREATE POLICY "notif_throttle_log_service_delete"
ON public.notif_throttle_log
FOR DELETE
TO service_role
USING (true);
