-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 16 juin 2026 à 17:51:04, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Relais admin pour validate-inscription (porte unique S2S)
-- RPC SECURITY DEFINER gardée par oxv_is_admin(), relai pg_net avec secret du Vault.
-- Asynchrone. Dormant tant que les secrets Vault sont absents.

CREATE OR REPLACE FUNCTION public.admin_validate_inscription(
  p_demande_id UUID,
  p_action TEXT DEFAULT 'accept',
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  edge_url TEXT;
  invoke_secret TEXT;
  v_statut TEXT;
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- 1) Garde admin
  IF NOT oxv_is_admin() THEN
    RAISE EXCEPTION 'forbidden_not_admin' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('accept', 'reject', 'acknowledge') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action', 'action', p_action);
  END IF;

  -- 2) Pré-vérif synchrone : demande existe + statut cohérent
  SELECT statut::TEXT INTO v_statut
  FROM public.demandes_inscription
  WHERE id = p_demande_id;

  IF v_statut IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'demande_not_found');
  END IF;
  IF p_action IN ('accept', 'reject') AND v_statut <> 'en_attente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'demande_already_processed', 'statut', v_statut);
  END IF;

  -- 3) Secrets (Vault). Absents -> dormant.
  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('validate_inscription_secret');

  IF edge_url IS NULL OR edge_url = '' OR invoke_secret IS NULL OR invoke_secret = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_armed',
      'detail', 'Secrets Vault edge_functions_base_url / validate_inscription_secret absents.');
  END IF;

  -- 4) Relai pg_net vers la edge function (secret injecté côté serveur)
  payload := jsonb_build_object(
    'demande_id', p_demande_id,
    'action', p_action,
    'admin_note', p_admin_note,
    'reviewed_by', auth.uid()
  );

  SELECT net.http_post(
    url := edge_url || '/validate-inscription',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-oxv-admin-secret', invoke_secret,
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := payload,
    timeout_milliseconds := 8000
  ) INTO request_id;

  -- 5) Journalisation admin (colonne metadata)
  INSERT INTO public.admin_audit (user_id, action, metadata)
  VALUES (
    auth.uid(),
    'inscription_' || p_action || '_relayed',
    jsonb_build_object(
      'demande_id', p_demande_id,
      'edge_request_id', request_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'queued', true,
    'action', p_action, 'edge_request_id', request_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[admin_validate_inscription] %', SQLERRM;
    RETURN jsonb_build_object('ok', false, 'error', 'relay_failed', 'detail', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_validate_inscription(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_validate_inscription(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_validate_inscription(UUID, TEXT, TEXT) IS
  'Relais admin (oxv_is_admin) vers la edge function validate-inscription via pg_net. Injecte le secret S2S depuis le Vault. Asynchrone. Dormant tant que les secrets Vault sont absents.';
