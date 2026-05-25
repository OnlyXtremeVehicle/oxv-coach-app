-- =================================================================
-- Migration 0026 — Fix colonne admin_audit dans les triggers notif
-- =================================================================
--
-- Les migrations 0021 et 0022 (puis 0025) utilisaient
-- `INSERT INTO admin_audit (user_id, action, payload) VALUES (...)`
-- mais la colonne réelle s'appelle `metadata`, pas `payload`.
--
-- Comportement actuel : le trigger plante silencieusement à l'INSERT
-- audit_log (attrapé par `EXCEPTION WHEN OTHERS`), donc la notif Expo
-- part quand même (pg_net est appelé AVANT l'INSERT audit), mais
-- aucune trace dans admin_audit pour le RGPD.
--
-- Ce patch corrige les 2 fonctions trigger pour utiliser le bon nom
-- de colonne. Aucun changement de comportement, juste l'audit log
-- qui se met à fonctionner.
-- =================================================================

CREATE OR REPLACE FUNCTION notify_coach_annotation_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  invoke_secret TEXT;
  payload JSONB;
  request_id BIGINT;
BEGIN
  IF NEW.visibility != 'shared' THEN
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := COALESCE(oxv_get_secret('edge_functions_invoke_secret'), '');

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE WARNING '[notify_coach_annotation] vault secret edge_functions_base_url manquant — notif skippée';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'annotation_id', NEW.id,
    'pilot_id', NEW.pilot_id,
    'coach_id', NEW.coach_id,
    'corner_index', NEW.corner_index,
    'body', NEW.body,
    'telemetry_session_id', NEW.telemetry_session_id,
    'visibility', NEW.visibility
  );

  SELECT net.http_post(
    url := edge_url || '/notify-pilot-coach-annotated',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  ) INTO request_id;

  -- ⚠ Fix : colonne `metadata` (pas `payload`)
  INSERT INTO admin_audit (user_id, action, metadata)
  VALUES (
    NEW.coach_id,
    'coach_annotation_notified',
    jsonb_build_object(
      'pilot_id', NEW.pilot_id,
      'annotation_id', NEW.id,
      'corner_index', NEW.corner_index,
      'edge_request_id', request_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_coach_annotation] erreur : %', SQLERRM;
    RETURN NEW;
END;
$$;

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
  SELECT user_id INTO pilot_id_v
  FROM telemetry_sessions
  WHERE id = NEW.telemetry_session_id;

  IF pilot_id_v IS NULL THEN
    RAISE WARNING '[notify_session_analysis] pas de pilot_id pour session %', NEW.telemetry_session_id;
    RETURN NEW;
  END IF;

  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := COALESCE(oxv_get_secret('edge_functions_invoke_secret'), '');

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE WARNING '[notify_session_analysis] vault secret manquant — notif skippée';
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
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  ) INTO request_id;

  -- ⚠ Fix : colonne `metadata` (pas `payload`)
  INSERT INTO admin_audit (user_id, action, metadata)
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
