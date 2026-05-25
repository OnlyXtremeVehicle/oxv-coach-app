-- =================================================================
-- Migration 0025 — Patch des triggers notif pour utiliser Supabase Vault
-- =================================================================
--
-- Les migrations 0021 et 0022 utilisaient `current_setting('app.edge_functions_base_url', true)`
-- qui nécessite `ALTER DATABASE postgres SET ...` — refusé par les
-- permissions Supabase managed (le user 'postgres' du Dashboard SQL
-- Editor n'a pas SUPERUSER).
--
-- Cette migration remplace l'accès via `current_setting` par une lecture
-- dans `vault.decrypted_secrets`, qui est la convention officielle
-- Supabase pour stocker des secrets accessibles depuis Postgres.
--
-- PRÉ-REQUIS côté Gabin (UNE seule fois, dans SQL Editor) :
--
--   SELECT vault.create_secret(
--     'https://<TON-REF>.functions.supabase.co',
--     'edge_functions_base_url',
--     'URL de base des Edge Functions OXV'
--   );
--
-- Optionnel (si on veut un secret d'auth pour les Edge Functions) :
--
--   SELECT vault.create_secret(
--     '<random-uuid>',
--     'edge_functions_invoke_secret',
--     'Secret bearer pour authentifier l''appel pg_net'
--   );
--
-- Si le secret invoke_secret n'est pas créé, l'appel sera fait sans
-- Bearer (l'Edge Function reste accessible publiquement par URL — c'est
-- ok pour V1 alpha, à durcir V1.1 avec un secret partagé).
-- =================================================================

-- =================================================================
-- Helper : lecture sûre d'un secret du Vault (renvoie NULL si absent)
-- =================================================================

CREATE OR REPLACE FUNCTION oxv_get_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v TEXT;
BEGIN
  SELECT decrypted_secret INTO v
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
  RETURN v;
EXCEPTION
  WHEN OTHERS THEN
    -- Vault peut ne pas être dispo, ou nom inconnu : on retourne NULL
    -- pour ne pas faire planter les triggers.
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION oxv_get_secret FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION oxv_get_secret TO service_role;

-- =================================================================
-- Patch trigger notify_coach_annotation_inserted (migration 0021)
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

  INSERT INTO admin_audit (user_id, action, payload)
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

-- =================================================================
-- Patch trigger notify_session_analysis_inserted (migration 0022)
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

COMMENT ON FUNCTION oxv_get_secret IS
  'Helper pour lire un secret du vault Supabase. Renvoie NULL si absent (ne plante jamais).';
