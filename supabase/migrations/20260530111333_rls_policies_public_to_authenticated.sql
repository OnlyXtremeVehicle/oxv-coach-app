-- [Réimportée dans le repo le 2026-06-08 : appliquée en prod le 2026-05-30,
--  hors dépôt. Contenu = SQL réellement appliqué (schema_migrations).]
-- Migration : Audit Annexe C - Best practices RLS
-- Objectif 1 : Migrer 67 policies du rôle `public` vers `authenticated`
-- Objectif 2 : Supprimer 3 policies redondantes (vehicles + heritage_packs)
-- Préservées en `public` (légitimes) : contact_messages_insert_public,
--   pricing_read_all, sessions_select_public, articles_select_published_or_admin

-- =====================================================================
-- ÉTAPE 1 : Suppression des 3 policies redondantes (sans recréation)
-- =====================================================================
DROP POLICY IF EXISTS "vehicles_select_own" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_modify_own" ON public.vehicles;
DROP POLICY IF EXISTS "heritage_packs_select_own" ON public.heritage_packs;

-- =====================================================================
-- ÉTAPE 2 : Migration des 67 policies vers `authenticated`
-- Pattern : DROP + CREATE avec mêmes conditions, rôle authenticated
-- =====================================================================

-- ----- admin_audit (3 policies) -----
DROP POLICY IF EXISTS "admin_audit_admin_only" ON public.admin_audit;
CREATE POLICY "admin_audit_admin_only" ON public.admin_audit
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_audit_insert_admin_only" ON public.admin_audit;
CREATE POLICY "admin_audit_insert_admin_only" ON public.admin_audit
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_audit_select_admin_only" ON public.admin_audit;
CREATE POLICY "admin_audit_select_admin_only" ON public.admin_audit
  FOR SELECT TO authenticated USING (is_admin());

-- ----- articles (3 policies, articles_select_published_or_admin reste public) -----
DROP POLICY IF EXISTS "articles_delete_admin" ON public.articles;
CREATE POLICY "articles_delete_admin" ON public.articles
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "articles_insert_admin" ON public.articles;
CREATE POLICY "articles_insert_admin" ON public.articles
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "articles_update_admin" ON public.articles;
CREATE POLICY "articles_update_admin" ON public.articles
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- circuits (4 policies) -----
DROP POLICY IF EXISTS "Users can delete own circuits" ON public.circuits;
CREATE POLICY "Users can delete own circuits" ON public.circuits
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own circuits" ON public.circuits;
CREATE POLICY "Users can insert own circuits" ON public.circuits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own circuits" ON public.circuits;
CREATE POLICY "Users can update own circuits" ON public.circuits
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own or official circuits" ON public.circuits;
CREATE POLICY "Users can view own or official circuits" ON public.circuits
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR (is_official = true));

-- ----- coach_annotations (3 policies) -----
DROP POLICY IF EXISTS "coach_annotations_admin_select" ON public.coach_annotations;
CREATE POLICY "coach_annotations_admin_select" ON public.coach_annotations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

DROP POLICY IF EXISTS "coach_annotations_coach_all" ON public.coach_annotations;
CREATE POLICY "coach_annotations_coach_all" ON public.coach_annotations
  FOR ALL TO authenticated
  USING ((coach_id = auth.uid()) AND is_coach_of(pilot_id))
  WITH CHECK ((coach_id = auth.uid()) AND is_coach_of(pilot_id));

DROP POLICY IF EXISTS "coach_annotations_pilot_select" ON public.coach_annotations;
CREATE POLICY "coach_annotations_pilot_select" ON public.coach_annotations
  FOR SELECT TO authenticated
  USING ((pilot_id = auth.uid()) AND (visibility = 'shared'::text) AND (deleted_at IS NULL));

-- ----- contact_messages (1 policy, contact_messages_insert_public reste public) -----
DROP POLICY IF EXISTS "contact_messages_admin_all" ON public.contact_messages;
CREATE POLICY "contact_messages_admin_all" ON public.contact_messages
  FOR ALL TO authenticated USING (is_admin());

-- ----- documents (5 policies) -----
DROP POLICY IF EXISTS "documents_admin_all" ON public.documents;
CREATE POLICY "documents_admin_all" ON public.documents
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "documents_delete_admin_only" ON public.documents;
CREATE POLICY "documents_delete_admin_only" ON public.documents
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "documents_insert_own_or_admin" ON public.documents;
CREATE POLICY "documents_insert_own_or_admin" ON public.documents
  FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "documents_select_own_or_admin" ON public.documents;
CREATE POLICY "documents_select_own_or_admin" ON public.documents
  FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "documents_update_admin_only" ON public.documents;
CREATE POLICY "documents_update_admin_only" ON public.documents
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- email_log (1 policy) -----
DROP POLICY IF EXISTS "email_log_admin_only" ON public.email_log;
CREATE POLICY "email_log_admin_only" ON public.email_log
  FOR ALL TO authenticated USING (is_admin());

-- ----- heritage_packs (5 policies, après suppression de heritage_packs_select_own) -----
DROP POLICY IF EXISTS "heritage_packs_admin_all" ON public.heritage_packs;
CREATE POLICY "heritage_packs_admin_all" ON public.heritage_packs
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "heritage_packs_delete_admin_only" ON public.heritage_packs;
CREATE POLICY "heritage_packs_delete_admin_only" ON public.heritage_packs
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "heritage_packs_insert_admin_only" ON public.heritage_packs;
CREATE POLICY "heritage_packs_insert_admin_only" ON public.heritage_packs
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "heritage_packs_select_own_or_admin" ON public.heritage_packs;
CREATE POLICY "heritage_packs_select_own_or_admin" ON public.heritage_packs
  FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "heritage_packs_update_admin_only" ON public.heritage_packs;
CREATE POLICY "heritage_packs_update_admin_only" ON public.heritage_packs
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- laps (2 policies) -----
DROP POLICY IF EXISTS "Users can insert own laps" ON public.laps;
CREATE POLICY "Users can insert own laps" ON public.laps
  FOR INSERT TO authenticated
  WITH CHECK (session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own laps" ON public.laps;
CREATE POLICY "Users can view own laps" ON public.laps
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()));

-- ----- media (2 policies) -----
DROP POLICY IF EXISTS "media_admin_all" ON public.media;
CREATE POLICY "media_admin_all" ON public.media
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "media_select_own" ON public.media;
CREATE POLICY "media_select_own" ON public.media
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) AND (visible_to_user = true));

-- ----- payments (2 policies) -----
DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "payments_select_own_or_admin" ON public.payments;
CREATE POLICY "payments_select_own_or_admin" ON public.payments
  FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_admin());

-- ----- pilot_goals (1 policy) -----
DROP POLICY IF EXISTS "pilot_goals_owner_all" ON public.pilot_goals;
CREATE POLICY "pilot_goals_owner_all" ON public.pilot_goals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----- pricing (4 policies, pricing_read_all reste public) -----
DROP POLICY IF EXISTS "pricing_delete_admin_only" ON public.pricing;
CREATE POLICY "pricing_delete_admin_only" ON public.pricing
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "pricing_insert_admin_only" ON public.pricing;
CREATE POLICY "pricing_insert_admin_only" ON public.pricing
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "pricing_update_admin_only" ON public.pricing;
CREATE POLICY "pricing_update_admin_only" ON public.pricing
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "pricing_write_admin" ON public.pricing;
CREATE POLICY "pricing_write_admin" ON public.pricing
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- registrations (5 policies) -----
DROP POLICY IF EXISTS "registrations_admin_all" ON public.registrations;
CREATE POLICY "registrations_admin_all" ON public.registrations
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "registrations_delete_admin_only" ON public.registrations;
CREATE POLICY "registrations_delete_admin_only" ON public.registrations
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "registrations_insert_own_or_admin" ON public.registrations;
CREATE POLICY "registrations_insert_own_or_admin" ON public.registrations
  FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "registrations_select_own_or_admin" ON public.registrations;
CREATE POLICY "registrations_select_own_or_admin" ON public.registrations
  FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "registrations_update_own_or_admin" ON public.registrations;
CREATE POLICY "registrations_update_own_or_admin" ON public.registrations
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR is_admin())
  WITH CHECK ((user_id = auth.uid()) OR is_admin());

-- ----- resend_events (1 policy) -----
DROP POLICY IF EXISTS "resend_events_select_admin" ON public.resend_events;
CREATE POLICY "resend_events_select_admin" ON public.resend_events
  FOR SELECT TO authenticated USING (is_admin());

-- ----- ritual_dispatches (2 policies) -----
DROP POLICY IF EXISTS "ritual_dispatches_select_admin" ON public.ritual_dispatches;
CREATE POLICY "ritual_dispatches_select_admin" ON public.ritual_dispatches
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "ritual_dispatches_select_own" ON public.ritual_dispatches;
CREATE POLICY "ritual_dispatches_select_own" ON public.ritual_dispatches
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ----- sessions (4 policies, sessions_select_public reste public) -----
DROP POLICY IF EXISTS "sessions_admin_all" ON public.sessions;
CREATE POLICY "sessions_admin_all" ON public.sessions
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "sessions_delete_admin_only" ON public.sessions;
CREATE POLICY "sessions_delete_admin_only" ON public.sessions
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "sessions_insert_admin_only" ON public.sessions;
CREATE POLICY "sessions_insert_admin_only" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "sessions_update_admin_only" ON public.sessions;
CREATE POLICY "sessions_update_admin_only" ON public.sessions
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- telemetry_frames (4 policies) -----
DROP POLICY IF EXISTS "Users can insert own frames" ON public.telemetry_frames;
CREATE POLICY "Users can insert own frames" ON public.telemetry_frames
  FOR INSERT TO authenticated
  WITH CHECK (session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own frames" ON public.telemetry_frames;
CREATE POLICY "Users can view own frames" ON public.telemetry_frames
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "telemetry_frames_admin_all" ON public.telemetry_frames;
CREATE POLICY "telemetry_frames_admin_all" ON public.telemetry_frames
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "telemetry_frames_delete_own" ON public.telemetry_frames;
CREATE POLICY "telemetry_frames_delete_own" ON public.telemetry_frames
  FOR DELETE TO authenticated
  USING (session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()));

-- ----- telemetry_sessions (5 policies) -----
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.telemetry_sessions;
CREATE POLICY "Users can delete own sessions" ON public.telemetry_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.telemetry_sessions;
CREATE POLICY "Users can insert own sessions" ON public.telemetry_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.telemetry_sessions;
CREATE POLICY "Users can update own sessions" ON public.telemetry_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own sessions" ON public.telemetry_sessions;
CREATE POLICY "Users can view own sessions" ON public.telemetry_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "telemetry_sessions_admin_all" ON public.telemetry_sessions;
CREATE POLICY "telemetry_sessions_admin_all" ON public.telemetry_sessions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- users (4 policies) -----
DROP POLICY IF EXISTS "users_delete_admin_only" ON public.users;
CREATE POLICY "users_delete_admin_only" ON public.users
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "users_insert_own_or_admin" ON public.users;
CREATE POLICY "users_insert_own_or_admin" ON public.users
  FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
CREATE POLICY "users_select_own_or_admin" ON public.users
  FOR SELECT TO authenticated USING ((id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "users_update_own_or_admin" ON public.users;
CREATE POLICY "users_update_own_or_admin" ON public.users
  FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR is_admin())
  WITH CHECK ((id = auth.uid()) OR is_admin());

-- ----- vehicles (5 policies, après suppression de vehicles_modify_own et vehicles_select_own) -----
DROP POLICY IF EXISTS "vehicles_admin_all" ON public.vehicles;
CREATE POLICY "vehicles_admin_all" ON public.vehicles
  FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "vehicles_delete_own_or_admin" ON public.vehicles;
CREATE POLICY "vehicles_delete_own_or_admin" ON public.vehicles
  FOR DELETE TO authenticated USING ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "vehicles_insert_own_or_admin" ON public.vehicles;
CREATE POLICY "vehicles_insert_own_or_admin" ON public.vehicles
  FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "vehicles_select_own_or_admin" ON public.vehicles;
CREATE POLICY "vehicles_select_own_or_admin" ON public.vehicles
  FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "vehicles_update_own_or_admin" ON public.vehicles;
CREATE POLICY "vehicles_update_own_or_admin" ON public.vehicles
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR is_admin())
  WITH CHECK ((user_id = auth.uid()) OR is_admin());

-- ----- weather_snapshots (2 policies) -----
DROP POLICY IF EXISTS "Users can insert own weather" ON public.weather_snapshots;
CREATE POLICY "Users can insert own weather" ON public.weather_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own weather" ON public.weather_snapshots;
CREATE POLICY "Users can view own weather" ON public.weather_snapshots
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()));
