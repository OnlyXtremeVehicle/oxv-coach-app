-- ============================================================================
-- Migration 0028 — Triggers notif push pour pilot_friendships (Duel 3/4)
-- ============================================================================
--
-- 2 triggers AFTER sur pilot_friendships qui appellent les Edge Functions
-- via pg_net pour envoyer des push notifs Expo :
--
--   1. AFTER INSERT (status='pending')
--      → notify-pilot-friend-request : « X souhaite vous comparer »
--      → destinataire = l'autre membre de la paire (pas l'initiator)
--
--   2. AFTER UPDATE (status pending → accepted)
--      → notify-pilot-friend-accepted : « X a accepté votre duel »
--      → destinataire = l'initiator (celui qui avait fait la demande)
--
-- Pattern : reprend la convention oxv_get_secret + admin_audit.metadata
-- établie par les migrations 0025/0026. Utilise EXCEPTION WHEN OTHERS pour
-- ne JAMAIS bloquer l'INSERT/UPDATE même si l'Edge Function est down.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trigger AFTER INSERT — notify recipient on new pending request
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_pilot_friend_request_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  invoke_secret TEXT;
  recipient_id UUID;
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- Filtre : ne fire que pour les demandes en pending (pas pour accepted créé directement par admin)
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Le destinataire est l'autre membre de la paire (pas l'initiator)
  recipient_id := CASE
    WHEN NEW.initiator_id = NEW.pilot_a THEN NEW.pilot_b
    ELSE NEW.pilot_a
  END;

  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := COALESCE(oxv_get_secret('edge_functions_invoke_secret'), '');

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE WARNING '[notify_friend_request] vault secret edge_functions_base_url manquant — notif skippée';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'friendship_id', NEW.id,
    'initiator_id', NEW.initiator_id,
    'recipient_id', recipient_id
  );

  SELECT net.http_post(
    url := edge_url || '/notify-pilot-friend-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  ) INTO request_id;

  INSERT INTO admin_audit (user_id, action, metadata)
  VALUES (
    NEW.initiator_id,
    'pilot_friend_request_notified',
    jsonb_build_object(
      'friendship_id', NEW.id,
      'recipient_id', recipient_id,
      'edge_request_id', request_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_friend_request] erreur : %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pilot_friendships_after_insert ON public.pilot_friendships;
CREATE TRIGGER pilot_friendships_after_insert
  AFTER INSERT ON public.pilot_friendships
  FOR EACH ROW
  EXECUTE FUNCTION notify_pilot_friend_request_inserted();

-- ----------------------------------------------------------------------------
-- 2. Trigger AFTER UPDATE — notify initiator on acceptance
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_pilot_friend_accepted_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  invoke_secret TEXT;
  responder_id UUID;
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- Fire uniquement sur transition pending → accepted (pas declined ni revoked)
  IF OLD.status = 'accepted' OR NEW.status != 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Le « responder » (qui vient d'accepter) est l'autre membre de la paire
  responder_id := CASE
    WHEN NEW.initiator_id = NEW.pilot_a THEN NEW.pilot_b
    ELSE NEW.pilot_a
  END;

  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := COALESCE(oxv_get_secret('edge_functions_invoke_secret'), '');

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE WARNING '[notify_friend_accepted] vault secret edge_functions_base_url manquant — notif skippée';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'friendship_id', NEW.id,
    'initiator_id', NEW.initiator_id,
    'responder_id', responder_id
  );

  SELECT net.http_post(
    url := edge_url || '/notify-pilot-friend-accepted',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  ) INTO request_id;

  INSERT INTO admin_audit (user_id, action, metadata)
  VALUES (
    responder_id,
    'pilot_friend_accepted_notified',
    jsonb_build_object(
      'friendship_id', NEW.id,
      'initiator_id', NEW.initiator_id,
      'edge_request_id', request_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_friend_accepted] erreur : %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pilot_friendships_after_update ON public.pilot_friendships;
CREATE TRIGGER pilot_friendships_after_update
  AFTER UPDATE OF status ON public.pilot_friendships
  FOR EACH ROW
  EXECUTE FUNCTION notify_pilot_friend_accepted_updated();
