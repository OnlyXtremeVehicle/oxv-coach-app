-- =================================================================
-- Migration 0022 — Trigger notify-coach-session-analyzed
-- =================================================================
--
-- Trigger Postgres AFTER INSERT sur app_session_analyses qui notifie
-- les coachs actifs+consentis du pilote qu'un nouveau bilan est dispo.
--
-- Symétrique de migration 0021 (notif annotations coach → pilote).
--
-- Pré-requis (déjà actifs sur le projet OXV) :
--   - Extension pg_net activée
--   - app.edge_functions_base_url + app.edge_functions_invoke_secret
--     configurés (cf. NOTIF_ANNOTATIONS_SETUP.md)
-- =================================================================

CREATE OR REPLACE FUNCTION notify_session_analysis_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  invoke_secret TEXT;
  pilot_id_v UUID;
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- Récupère le pilot_id depuis la session liée
  SELECT user_id INTO pilot_id_v
  FROM telemetry_sessions
  WHERE id = NEW.telemetry_session_id;

  IF pilot_id_v IS NULL THEN
    RAISE WARNING '[notify_session_analysis] pas de pilot_id pour session %', NEW.telemetry_session_id;
    RETURN NEW;
  END IF;

  edge_url := current_setting('app.edge_functions_base_url', true);
  invoke_secret := current_setting('app.edge_functions_invoke_secret', true);

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE WARNING '[notify_session_analysis] edge_url manquant — notif skippée';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'analysis_id', NEW.id,
    'telemetry_session_id', NEW.telemetry_session_id,
    'pilot_id', pilot_id_v,
    'margin_global', NEW.margin_global,
    'margin_zone', NEW.margin_zone
  );

  SELECT net.http_post(
    url := edge_url || '/notify-coach-session-analyzed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(invoke_secret, '')
    ),
    body := payload,
    timeout_milliseconds := 5000
  ) INTO request_id;

  -- Audit
  INSERT INTO admin_audit (user_id, action, payload)
  VALUES (
    pilot_id_v,
    'session_analysis_notified',
    jsonb_build_object(
      'analysis_id', NEW.id,
      'telemetry_session_id', NEW.telemetry_session_id,
      'edge_request_id', request_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_session_analysis] erreur : %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_analyses_notify_trigger ON app_session_analyses;
CREATE TRIGGER session_analyses_notify_trigger
  AFTER INSERT ON app_session_analyses
  FOR EACH ROW
  EXECUTE FUNCTION notify_session_analysis_inserted();

REVOKE EXECUTE ON FUNCTION notify_session_analysis_inserted() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION notify_session_analysis_inserted IS
  'Trigger AFTER INSERT sur app_session_analyses qui notifie les coachs du pilote via Edge Function. Best-effort.';
