-- ============================================================================
-- S6 (charte 12 — souveraineté des données) : rétention des telemetry_frames.
--
-- Les frames brutes (volumineuses, 25 Hz) ont une durée de conservation définie,
-- DISTINCTE des insights dérivés. Décision fondateur : conservation ~une saison
-- (fenêtre glissante de 12 mois). Au-delà, les frames brutes sont purgées ; les
-- dérivés (app_session_analyses, app_segment_analyses, session_insights, laps)
-- sont CONSERVÉS — la lecture de session reste intacte après la purge.
--
-- La cascade d'effacement sur suppression de compte reste inchangée (delete_rule
-- CASCADE depuis telemetry_sessions) : cette purge par âge s'AJOUTE, elle ne la
-- remplace pas.
--
-- Modèle aligné sur cleanup_old_notif_logs() (migration 0024) : SECURITY DEFINER,
-- réservé à service_role. Planification : à brancher sur pg_cron (1×/jour) ;
-- en attendant, appel manuel/edge planifiée (même note que 0024).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry_frames()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.telemetry_frames
  WHERE created_at < now() - INTERVAL '12 months';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_telemetry_frames() IS
  'S6 : purge les telemetry_frames de plus de 12 mois (≈ une saison). Les insights dérivés sont conservés. À planifier via pg_cron (1×/jour). Réservé à service_role.';

-- Réservé au backend (service_role) : aucun rôle client ne peut déclencher la purge.
REVOKE ALL ON FUNCTION public.cleanup_old_telemetry_frames() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_telemetry_frames() TO service_role;
