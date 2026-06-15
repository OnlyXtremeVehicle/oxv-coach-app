-- Durcissement RLS / perf — search_path des fonctions + REVOKE EXECUTE internes
--
-- Contexte : audit advisors (projet prod fouvuqkdxarjpjbqnsjq) + vérification
-- adversariale par fonction. Cette migration ne touche QUE des éléments
-- confirmés sans risque :
--   Bloc 1 — fixe search_path sur 15 fonctions qui ne l'avaient pas
--            (anti-injection ; ne change aucun comportement applicatif).
--   Bloc 2 — REVOKE EXECUTE sur 3 fonctions trigger internes exposées à tort
--            via /rpc (les triggers continuent de tourner : Postgres
--            n'évalue pas le privilège EXECUTE de l'appelant pour un trigger).
--   Bloc 3 — recommandations PERF (index dupliqué, FK non indexées,
--            initplan RLS, index inutilisés) laissées EN COMMENTAIRE.
--            À appliquer en lot plus tard, après revue / mesure sous charge.
--
-- Migration idempotente (ALTER FUNCTION et REVOKE rejouables sans erreur).
-- NON destructive : aucun DROP, aucune modification de policy ou de schéma.
--
-- Périmètre volontairement réduit. Ce qui N'EST PAS touché ici :
--   - Les helpers RLS SECURITY DEFINER (oxv_is_admin, is_admin, is_coach,
--     is_coach_of, is_my_coach, coach_has_permission, is_validated_member,
--     are_friends) : appelés dans les expressions USING/WITH CHECK des
--     policies. Leur retirer EXECUTE casserait l'évaluation RLS pour
--     authenticated. On conserve.
--   - Les RPC légitimes appelées par le client (get_shared_progression,
--     admin_ritual_stats, log_coach_view) : conservées telles quelles.
--   - Les fonctions Bloc 1 sont aussi des triggers/helpers internes ; on
--     se contente de fixer leur search_path sans toucher leurs droits, sauf
--     les 3 du Bloc 2 dont le REVOKE est explicitement prouvé sûr.

-- ============================================================================
-- BLOC 1 — SET search_path = public, pg_temp (anti-injection)
-- ============================================================================
-- Fixe le search_path de fonctions qui ne l'avaient pas. Sans risque : ne
-- modifie ni la signature, ni les droits, ni le corps. Empêche qu'un objet
-- malveillant placé dans un schéma tiers du search_path de l'appelant ne
-- détourne une résolution de nom (fonctions SECURITY DEFINER surtout).

ALTER FUNCTION public.pilot_goals_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.should_send_notif(recipient uuid, source uuid, notif text, window_seconds integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_notif_logs() SET search_path = public, pg_temp;
ALTER FUNCTION public.oxv_get_secret(secret_name text) SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_coach_annotation_inserted() SET search_path = public, pg_temp;
ALTER FUNCTION public.coach_annotations_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_session_analysis_inserted() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_pilot_friend_request_inserted() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_pilot_friend_accepted_updated() SET search_path = public, pg_temp;
ALTER FUNCTION public.coach_roulages_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.circuit_services_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.coach_session_context_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.coach_corner_reference_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.coach_curation_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.coach_reading_weights_set_updated_at() SET search_path = public, pg_temp;

-- ============================================================================
-- BLOC 2 — REVOKE EXECUTE sur fonctions trigger internes
-- ============================================================================
-- Ces 3 fonctions retournent `trigger` et ne sont rattachées qu'à un trigger
-- réel (vérifié sur prod). Elles ne sont référencées dans AUCUNE policy RLS
-- et n'ont AUCUN appelant RPC/fonction. Les grants EXECUTE à PUBLIC/anon/
-- authenticated sont donc inertes (exposition /rpc inutile) :
--   - Postgres invoque les fonctions trigger via la machinerie de trigger,
--     SANS vérifier le privilège EXECUTE du rôle qui fait l'INSERT/UPDATE.
--     Le REVOKE ne bloque donc PAS le déclenchement du trigger.
--   - breaks_rls = false : absentes de pg_policies (qual / with_check).
-- service_role et postgres ne sont volontairement PAS visés.

-- Trigger users_ensure_coach_permissions (AFTER INSERT OR UPDATE OF role ON public.users).
-- Provisioning auto coach -> coach_permissions : continue de fonctionner.
REVOKE EXECUTE ON FUNCTION public.ensure_coach_permissions() FROM PUBLIC, anon, authenticated;

-- Trigger pilot_friendships_after_insert (AFTER INSERT ON public.pilot_friendships).
-- Notification de demande d'ami : continue de fonctionner.
REVOKE EXECUTE ON FUNCTION public.notify_pilot_friend_request_inserted() FROM PUBLIC, anon, authenticated;

-- Trigger d'acceptation d'ami (AFTER UPDATE ON public.pilot_friendships).
-- Notification d'acceptation : continue de fonctionner.
REVOKE EXECUTE ON FUNCTION public.notify_pilot_friend_accepted_updated() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- BLOC 3 — PERFORMANCE (NON APPLIQUÉ — à appliquer en lot plus tard)
-- ============================================================================
-- Laissé entièrement en commentaire. Aucune de ces lignes ne s'exécute.
-- À traiter dans une migration perf dédiée, après revue et mesure.
--
-- ----------------------------------------------------------------------------
-- 3.a — Index dupliqué (safe_now = true)
-- ----------------------------------------------------------------------------
-- idx_frames_session_elapsed et idx_telemetry_frames_session sont identiques
-- (btree(session_id, elapsed_ms)). On garde idx_telemetry_frames_session.
--
-- DROP INDEX IF EXISTS public.idx_frames_session_elapsed;
--
-- ----------------------------------------------------------------------------
-- 3.b — Clés étrangères sans index couvrant (safe_now = true) — 19 FK
-- ----------------------------------------------------------------------------
-- CREATE INDEX IF NOT EXISTS idx_coach_permissions_granted_by ON public.coach_permissions(granted_by);
-- CREATE INDEX IF NOT EXISTS idx_coach_pilots_created_by ON public.coach_pilots(created_by);
-- CREATE INDEX IF NOT EXISTS idx_contact_messages_read_by ON public.contact_messages(read_by);
-- CREATE INDEX IF NOT EXISTS idx_demandes_inscription_created_user_id ON public.demandes_inscription(created_user_id);
-- CREATE INDEX IF NOT EXISTS idx_demandes_inscription_reviewed_by ON public.demandes_inscription(reviewed_by);
-- CREATE INDEX IF NOT EXISTS idx_documents_validated_by ON public.documents(validated_by);
-- CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON public.media(uploaded_by);
-- CREATE INDEX IF NOT EXISTS idx_notif_throttle_log_source_user_id ON public.notif_throttle_log(source_user_id);
-- CREATE INDEX IF NOT EXISTS idx_payments_heritage_pack_id ON public.payments(heritage_pack_id);
-- CREATE INDEX IF NOT EXISTS idx_pilot_friendships_initiator_id ON public.pilot_friendships(initiator_id);
-- CREATE INDEX IF NOT EXISTS idx_pilot_goals_evaluated_session_id ON public.pilot_goals(evaluated_session_id);
-- CREATE INDEX IF NOT EXISTS idx_registrations_cancelled_by ON public.registrations(cancelled_by);
-- CREATE INDEX IF NOT EXISTS idx_registrations_heritage_pack_id ON public.registrations(heritage_pack_id);
-- CREATE INDEX IF NOT EXISTS idx_registrations_vehicle_id ON public.registrations(vehicle_id);
-- CREATE INDEX IF NOT EXISTS idx_session_media_uploaded_by_user_id ON public.session_media(uploaded_by_user_id);
-- CREATE INDEX IF NOT EXISTS idx_social_pings_created_by ON public.social_pings(created_by);
-- CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_circuit_id ON public.telemetry_sessions(circuit_id);
-- CREATE INDEX IF NOT EXISTS idx_users_kyc_validated_by ON public.users(kyc_validated_by);
-- CREATE INDEX IF NOT EXISTS idx_users_suspended_by ON public.users(suspended_by);
--
-- ----------------------------------------------------------------------------
-- 3.c — auth_rls_initplan (safe_now = FALSE) — 75 policies / 33 tables
-- ----------------------------------------------------------------------------
-- Remplacer auth.<fn>() par (select auth.<fn>()) dans USING et WITH CHECK
-- pour que la fonction soit évaluée une seule fois par requête (initplan)
-- au lieu d'une fois par ligne. Modifie le plan RLS : NE PAS appliquer à
-- l'aveugle. Récupérer d'abord le corps exact de chaque policy :
--   SELECT schemaname, tablename, policyname, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- puis ré-émettre chaque policy via ALTER POLICY avec :
--   auth.uid()           -> (select auth.uid())
--   auth.role()          -> (select auth.role())
--   auth.jwt()           -> (select auth.jwt())
--   current_setting(...) -> (select current_setting(...))
-- Vérifier la sémantique d'accès inchangée sur une branche avant prod.
--
-- ----------------------------------------------------------------------------
-- 3.d — Index inutilisés (safe_now = FALSE) — 51 index
-- ----------------------------------------------------------------------------
-- NE PAS supprimer en lot. Stats jeunes (~44 sessions) : plusieurs index
-- adossent des chemins de lookup pas encore exercés (idx_users_email,
-- idx_users_public_handle, idx_app_progression_shares_token, etc.).
-- Après trafic réel soutenu, vérifier puis dropper sélectivement :
--   SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
--   WHERE schemaname = 'public' ORDER BY idx_scan, relname;
--   -- ex. : DROP INDEX IF EXISTS public.idx_telemetry_frames_created_at;
