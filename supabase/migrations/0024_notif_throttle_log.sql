-- =================================================================
-- Migration 0024 — Throttling des push notifications
-- =================================================================
--
-- Évite le spam : si le pilote enchaîne 5 sessions en 30 min, le coach
-- n'a pas besoin de recevoir 5 notifs distinctes. La 2e+ dans la
-- fenêtre de throttle est skippée silencieusement.
--
-- Implémentation : table de log des envois récents. Chaque Edge
-- Function vérifie le log avant d'envoyer, puis y inscrit son envoi.
-- =================================================================

CREATE TABLE IF NOT EXISTS notif_throttle_log (
  id BIGSERIAL PRIMARY KEY,

  -- Destinataire (à qui on a envoyé)
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source (de qui vient la notif — pilote pour session, coach pour annotation)
  source_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type de notif (clé de throttle distincte par type)
  notif_type TEXT NOT NULL CHECK (
    notif_type IN ('session_analyzed', 'coach_annotation', 'coach_assigned', 'consent_received')
  ),

  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index optimisé pour la requête de check (« dernier envoi <T pour ce trio »)
CREATE INDEX IF NOT EXISTS notif_throttle_log_lookup_idx
  ON notif_throttle_log (recipient_user_id, source_user_id, notif_type, sent_at DESC);

-- =================================================================
-- Helper : check + insert atomique pour throttle
-- =================================================================
--
-- Renvoie true si on PEUT envoyer (et inscrit le log), false si throttlé.
-- Throttle window = paramètre `window_seconds`.
--
-- Appelée depuis les Edge Functions via supabase.rpc('should_send_notif', {...}).
-- =================================================================

CREATE OR REPLACE FUNCTION should_send_notif(
  recipient UUID,
  source UUID,
  notif TEXT,
  window_seconds INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_sent TIMESTAMPTZ;
BEGIN
  -- Cherche la dernière notif du même trio
  SELECT sent_at INTO last_sent
  FROM notif_throttle_log
  WHERE recipient_user_id = recipient
    AND source_user_id = source
    AND notif_type = notif
  ORDER BY sent_at DESC
  LIMIT 1;

  -- Si throttle window dépassée OU jamais envoyé → on peut envoyer
  IF last_sent IS NULL OR last_sent < (now() - (window_seconds || ' seconds')::INTERVAL) THEN
    INSERT INTO notif_throttle_log (recipient_user_id, source_user_id, notif_type)
    VALUES (recipient, source, notif);
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Sécurité : seules les Edge Functions (via service_role) appellent cette fonction
REVOKE EXECUTE ON FUNCTION should_send_notif FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION should_send_notif TO service_role;

-- =================================================================
-- Cleanup périodique : supprime les logs > 7 jours pour limiter la table
-- À exécuter via pg_cron une fois par jour. Pour V1, manuel ou cron simple.
-- =================================================================

CREATE OR REPLACE FUNCTION cleanup_old_notif_logs() RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM notif_throttle_log
  WHERE sent_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE notif_throttle_log IS
  'Log des push notifs envoyées pour throttle. Une ligne par envoi réussi. Purge auto via cleanup_old_notif_logs.';
COMMENT ON FUNCTION should_send_notif IS
  'Check + insert atomique : renvoie true si la notif peut être envoyée (fenêtre de throttle dépassée).';
