-- ============================================================================
-- Migration 0030 — Étend les RLS aux app_segment_analyses pour les amis
-- ============================================================================
--
-- Permet à un ami accepté de SELECT les analyses par virage d'un autre
-- pilote. Nécessaire pour la feature « Comparaison virage par virage »
-- dans l'écran Duel (V1.1).
--
-- Sécurité : strictement SELECT, jamais INSERT/UPDATE/DELETE. Le helper
-- are_friends() (migration 0027) fait toute la logique d'autorisation.
--
-- Note doctrine : on autorise les ANALYSES par virage mais PAS les
-- coach_annotations (qui restent privées pilote+coach) ni les goals
-- (espace intime du pilote).
-- ============================================================================

DROP POLICY IF EXISTS app_segment_analyses_select_friend ON public.app_segment_analyses;
CREATE POLICY app_segment_analyses_select_friend ON public.app_segment_analyses
  FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), user_id));

COMMENT ON POLICY app_segment_analyses_select_friend ON public.app_segment_analyses IS
  'Un ami accepté peut lire les analyses par virage du pilote pour la comparaison Duel V1.1. Read-only, jamais INSERT/UPDATE/DELETE.';
