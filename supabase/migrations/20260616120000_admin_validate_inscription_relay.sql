-- =================================================================
-- Migration — Relais admin pour validate-inscription (porte unique S2S)
-- =================================================================
--
-- Contexte : la edge function `validate-inscription` est protégée par un
-- secret serveur-à-serveur (en-tête `x-oxv-admin-secret`). Ce secret ne
-- peut PAS vivre dans le navigateur. Le tableau de bord admin (SPA statique)
-- ne peut donc pas appeler la fonction directement.
--
-- Solution (pattern OXV déjà utilisé par les triggers notif, cf. 0025) :
-- une RPC `SECURITY DEFINER` gardée par `oxv_is_admin()`, qui lit le secret
-- dans le Vault et relaie l'appel via pg_net. L'admin appelle la RPC avec
-- sa session Supabase ; le secret reste côté serveur.
--
-- ASYNCHRONE : net.http_post est « fire-and-forget » (comme les notifs).
-- La RPC renvoie immédiatement { ok:true, queued:true, edge_request_id }.
-- L'edge function fait le travail (création compte + e-mail + passage du
-- statut) ensuite ; l'UI admin re-fetch la demande pour voir 'acceptee' /
-- 'refusee'. Pré-vérification synchrone du cas le plus fréquent
-- (demande déjà traitée) pour un retour immédiat.
--
-- PRÉ-REQUIS D'ARMEMENT (à faire UNE fois quand on veut activer) :
--   1. Poser le secret côté edge function :
--        supabase secrets set VALIDATE_INSCRIPTION_SECRET=<S>
--   2. Poser les MÊMES valeurs dans le Vault (lisible depuis Postgres) :
--        SELECT vault.create_secret('https://<REF>.functions.supabase.co',
--          'edge_functions_base_url', 'URL base Edge Functions OXV');
--          -- (déjà créé si les notifs tournent)
--        SELECT vault.create_secret('<S>', 'validate_inscription_secret',
--          'Secret x-oxv-admin-secret pour validate-inscription');
--   Tant que ces secrets sont absents, la RPC renvoie { ok:false,
--   error:'not_armed' } sans rien faire (dormant, cohérent avec la fonction).
-- =================================================================

-- Réutilise oxv_get_secret(name) défini en migration 0025 (lecture Vault sûre).

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
  -- 1) Garde admin (la RPC est exposée à 'authenticated' ; seul un admin passe)
  IF NOT oxv_is_admin() THEN
    RAISE EXCEPTION 'forbidden_not_admin' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('accept', 'reject', 'acknowledge') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action', 'action', p_action);
  END IF;

  -- 2) Pré-vérif synchrone : demande existe + statut cohérent (retour immédiat)
  SELECT statut::TEXT INTO v_statut
  FROM public.demandes_inscription
  WHERE id = p_demande_id;

  IF v_statut IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'demande_not_found');
  END IF;
  IF p_action IN ('accept', 'reject') AND v_statut <> 'en_attente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'demande_already_processed', 'statut', v_statut);
  END IF;

  -- 3) Secrets (Vault). Absents -> dormant, on ne fait rien.
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

  -- 5) Journalisation admin (colonne metadata, cf. table admin_audit réelle)
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
  'Relais admin (oxv_is_admin) vers la edge function validate-inscription via pg_net. '
  'Injecte le secret S2S depuis le Vault. Asynchrone. Dormant tant que les secrets Vault sont absents.';
