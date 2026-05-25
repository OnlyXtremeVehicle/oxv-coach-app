-- =================================================================
-- Migration 0021 — Trigger notify-pilot-coach-annotated
-- =================================================================
--
-- Trigger Postgres AFTER INSERT sur coach_annotations qui appelle
-- l'Edge Function `notify-pilot-coach-annotated` via pg_net pour
-- envoyer une push notif Expo au pilote.
--
-- Filtre : ne fire que pour les annotations partagées (visibility='shared').
-- Les brouillons (visibility='private') ne notifient pas le pilote.
--
-- Pré-requis (déjà actifs sur le projet OXV) :
--   - Extension `pg_net` activée
--   - Secret `EDGE_FUNCTIONS_BASE_URL` configuré (format : https://<ref>.functions.supabase.co)
--   - Secret `EDGE_FUNCTIONS_INVOKE_SECRET` configuré
-- =================================================================

-- Fonction trigger qui POST le payload à l'Edge Function
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
  -- Skip si pas partagée
  IF NEW.visibility != 'shared' THEN
    RETURN NEW;
  END IF;

  -- Skip si deleted_at déjà set (cas tordu mais protège)
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Récupère la config depuis vault (settings runtime Supabase)
  edge_url := current_setting('app.edge_functions_base_url', true);
  invoke_secret := current_setting('app.edge_functions_invoke_secret', true);

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE WARNING '[notify_coach_annotation] edge_url manquant — notif skippée';
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

  -- Appel async (pg_net renvoie un request_id, ne bloque pas l'insert)
  SELECT net.http_post(
    url := edge_url || '/notify-pilot-coach-annotated',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(invoke_secret, '')
    ),
    body := payload,
    timeout_milliseconds := 5000
  ) INTO request_id;

  -- Log dans admin_audit pour traçabilité RGPD (un coach a déclenché une notif vers un pilote)
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
    -- Ne JAMAIS faire planter l'insert si la notif échoue (best-effort)
    RAISE WARNING '[notify_coach_annotation] erreur : %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Le trigger
DROP TRIGGER IF EXISTS coach_annotations_notify_trigger ON coach_annotations;
CREATE TRIGGER coach_annotations_notify_trigger
  AFTER INSERT ON coach_annotations
  FOR EACH ROW
  EXECUTE FUNCTION notify_coach_annotation_inserted();

-- =================================================================
-- Sécurité : restreindre l'execution aux rôles attendus
-- =================================================================
-- La fonction est SECURITY DEFINER (exécutée avec les droits du créateur).
-- On verrouille EXECUTE à postgres seulement pour éviter qu'un user
-- malveillant l'appelle hors du trigger.
REVOKE EXECUTE ON FUNCTION notify_coach_annotation_inserted() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION notify_coach_annotation_inserted IS
  'Trigger BEFORE INSERT sur coach_annotations qui notifie le pilote via Edge Function. Best-effort : n''empêche jamais l''insert.';
