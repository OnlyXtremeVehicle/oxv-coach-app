-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 16 juin 2026 à 18:40:04, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Accusé de réception des messages de contact (trigger AFTER INSERT -> pg_net)
-- Dormant si secrets Vault absents. Ne bloque jamais l'insertion.

CREATE OR REPLACE FUNCTION public.notify_contact_message_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  edge_url TEXT;
  invoke_secret TEXT;
  request_id BIGINT;
BEGIN
  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('edge_functions_invoke_secret');

  IF edge_url IS NULL OR edge_url = '' OR invoke_secret IS NULL OR invoke_secret = '' THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := edge_url || '/send-contact-ack',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-oxv-invoke-secret', invoke_secret,
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := jsonb_build_object('contact_id', NEW.id),
    timeout_milliseconds := 5000
  ) INTO request_id;

  INSERT INTO public.admin_audit (user_id, action, metadata)
  VALUES (
    NULL,
    'contact_ack_relayed',
    jsonb_build_object('contact_id', NEW.id, 'edge_request_id', request_id)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_contact_message] %', SQLERRM;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_contact_message_inserted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contact_message_ack ON public.contact_messages;
CREATE TRIGGER trg_contact_message_ack
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contact_message_inserted();

COMMENT ON FUNCTION public.notify_contact_message_inserted() IS
  'Relaie un accusé de réception (edge send-contact-ack) à l''INSERT d''un message de contact. Dormant si secrets Vault absents. Ne bloque jamais l''insertion.';
