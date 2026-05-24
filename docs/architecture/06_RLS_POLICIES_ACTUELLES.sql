-- ============================================================
-- RLS POLICIES — Schéma public OXV
-- ============================================================
-- Source : Export direct depuis Supabase fouvuqkdxarjpjbqnsjq
-- Date : 24 mai 2026
-- Total : 80+ policies sur 20 tables
-- ============================================================

-- IMPORTANT pour Claude Code :
-- Ces policies sont DÉJÀ APPLIQUÉES en production.
-- Ne PAS les ré-exécuter, juste les lire pour comprendre la sécurité.
-- Pour AJOUTER des policies sur les nouvelles tables (app_*), créer un fichier séparé.

-- ============================================================
-- TABLE: admin_audit
-- ============================================================

CREATE POLICY admin_audit_admin_only ON public.admin_audit
  FOR ALL USING (is_admin());

CREATE POLICY admin_audit_insert_admin_only ON public.admin_audit
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY admin_audit_select_admin_only ON public.admin_audit
  FOR SELECT USING (is_admin());

-- ============================================================
-- TABLE: circuits
-- ============================================================

CREATE POLICY "Users can view own or official circuits" ON public.circuits
  FOR SELECT USING (auth.uid() = user_id OR is_official = true);

CREATE POLICY "Users can insert own circuits" ON public.circuits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own circuits" ON public.circuits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own circuits" ON public.circuits
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: contact_messages
-- ============================================================

-- N'importe qui peut envoyer un message (formulaire public)
CREATE POLICY contact_messages_insert_public ON public.contact_messages
  FOR INSERT WITH CHECK (true);

-- Seul l'admin peut lire/modifier
CREATE POLICY contact_messages_admin_all ON public.contact_messages
  FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: documents
-- ============================================================

CREATE POLICY documents_select_own_or_admin ON public.documents
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY documents_insert_own_or_admin ON public.documents
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY documents_update_admin_only ON public.documents
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY documents_delete_admin_only ON public.documents
  FOR DELETE USING (is_admin());

-- ============================================================
-- TABLE: email_log
-- ============================================================

CREATE POLICY email_log_admin_only ON public.email_log
  FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: heritage_packs
-- ============================================================

CREATE POLICY heritage_packs_select_own_or_admin ON public.heritage_packs
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY heritage_packs_insert_admin_only ON public.heritage_packs
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY heritage_packs_update_admin_only ON public.heritage_packs
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY heritage_packs_delete_admin_only ON public.heritage_packs
  FOR DELETE USING (is_admin());

-- ============================================================
-- TABLE: laps
-- ============================================================

CREATE POLICY "Users can view own laps" ON public.laps
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own laps" ON public.laps
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: media
-- ============================================================

CREATE POLICY media_select_own ON public.media
  FOR SELECT USING (auth.uid() = user_id AND visible_to_user = true);

CREATE POLICY media_admin_all ON public.media
  FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: payments
-- ============================================================

CREATE POLICY payments_select_own_or_admin ON public.payments
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY payments_admin_all ON public.payments
  FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: pricing
-- ============================================================

-- Lecture publique pour les tarifs actifs
CREATE POLICY pricing_read_all ON public.pricing
  FOR SELECT USING (active = true);

CREATE POLICY pricing_select_public ON public.pricing
  FOR SELECT USING (true);

CREATE POLICY pricing_insert_admin_only ON public.pricing
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY pricing_update_admin_only ON public.pricing
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY pricing_delete_admin_only ON public.pricing
  FOR DELETE USING (is_admin());

-- ============================================================
-- TABLE: qdi_scores
-- ============================================================

CREATE POLICY qdi_scores_select_own_or_admin ON public.qdi_scores
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY qdi_scores_insert_admin_only ON public.qdi_scores
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY qdi_scores_update_admin_only ON public.qdi_scores
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY qdi_scores_delete_admin_only ON public.qdi_scores
  FOR DELETE USING (is_admin());

-- ============================================================
-- TABLE: registrations
-- ============================================================

CREATE POLICY registrations_select_own_or_admin ON public.registrations
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY registrations_insert_own_or_admin ON public.registrations
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY registrations_update_own_or_admin ON public.registrations
  FOR UPDATE USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY registrations_delete_admin_only ON public.registrations
  FOR DELETE USING (is_admin());

-- ============================================================
-- TABLE: resend_events
-- ============================================================

CREATE POLICY resend_events_select_admin ON public.resend_events
  FOR SELECT USING (is_admin());

-- ============================================================
-- TABLE: ritual_dispatches
-- ============================================================

CREATE POLICY ritual_dispatches_select_own ON public.ritual_dispatches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY ritual_dispatches_select_admin ON public.ritual_dispatches
  FOR SELECT USING (is_admin());

-- ============================================================
-- TABLE: sessions
-- ============================================================

-- Calendrier visible par tous (même non-connectés)
CREATE POLICY sessions_select_public ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY sessions_insert_admin_only ON public.sessions
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY sessions_update_admin_only ON public.sessions
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY sessions_delete_admin_only ON public.sessions
  FOR DELETE USING (is_admin());

-- ============================================================
-- TABLE: telemetry_frames
-- ============================================================

CREATE POLICY "Users can view own frames" ON public.telemetry_frames
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own frames" ON public.telemetry_frames
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: telemetry_sessions
-- ============================================================

CREATE POLICY "Users can view own sessions" ON public.telemetry_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.telemetry_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.telemetry_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.telemetry_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: users
-- ============================================================

CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY users_insert_own_or_admin ON public.users
  FOR INSERT WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY users_update_own_or_admin ON public.users
  FOR UPDATE USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY users_delete_admin_only ON public.users
  FOR DELETE USING (is_admin());

-- ============================================================
-- TABLE: vehicles
-- ============================================================

CREATE POLICY vehicles_select_own_or_admin ON public.vehicles
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY vehicles_insert_own_or_admin ON public.vehicles
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY vehicles_update_own_or_admin ON public.vehicles
  FOR UPDATE USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY vehicles_delete_own_or_admin ON public.vehicles
  FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- ============================================================
-- TABLE: weather_snapshots
-- ============================================================

CREATE POLICY "Users can view own weather" ON public.weather_snapshots
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own weather" ON public.weather_snapshots
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM telemetry_sessions WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- FONCTIONS HELPER
-- ============================================================

-- Fonction is_admin() utilisée par toutes les policies
-- DÉJÀ DÉFINIE en SECURITY DEFINER, évite la récursion sur users
--
-- Ne PAS la redéfinir, elle existe déjà.

-- ============================================================
-- FIN
-- ============================================================
