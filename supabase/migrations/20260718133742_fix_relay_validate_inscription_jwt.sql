-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 13:37:42, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- OXV — Correctif relais admin_validate_inscription
-- 1) Authorization = clé anon (JWT VALIDE, publique par nature) :
--    l'edge function est déployée verify_jwt=true — l'ancien
--    « Bearer <invoke_secret> » était rejeté par la plateforme.
--    L'auth applicative reste x-oxv-admin-secret (inchangée).
-- 2) p_dry_run : répétition sans effet (ni email, ni mutation)
--    pour les tests de bout en bout.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_validate_inscription(
  p_demande_id uuid,
  p_action text DEFAULT 'accept'::text,
  p_admin_note text DEFAULT NULL::text,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  edge_url TEXT;
  invoke_secret TEXT;
  v_statut TEXT;
  payload JSONB;
  request_id BIGINT;
  -- Clé anon du projet (publique — présente dans le HTML du site) : sert
  -- uniquement à franchir verify_jwt ; l'autorisation réelle = le secret.
  anon_jwt CONSTANT TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdXZ1cWtkeGFyanBqYnFuc2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzM2MDYsImV4cCI6MjA5Mzg0OTYwNn0.zhigqdPPe7M35mCvBeqoY6MGfp4Kn9quWNn_7mxLqo8';
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
    'reviewed_by', auth.uid(),
    'dry_run', COALESCE(p_dry_run, false)
  );

  SELECT net.http_post(
    url := edge_url || '/validate-inscription',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-oxv-admin-secret', invoke_secret,
      'Authorization', 'Bearer ' || anon_jwt
    ),
    body := payload,
    timeout_milliseconds := 8000
  ) INTO request_id;

  -- 5) Journalisation admin (colonne metadata)
  INSERT INTO public.admin_audit (user_id, action, metadata)
  VALUES (
    auth.uid(),
    'inscription_' || p_action || CASE WHEN COALESCE(p_dry_run,false) THEN '_dryrun' ELSE '' END || '_relayed',
    jsonb_build_object(
      'demande_id', p_demande_id,
      'edge_request_id', request_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'queued', true,
    'action', p_action, 'dry_run', COALESCE(p_dry_run,false), 'edge_request_id', request_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[admin_validate_inscription] %', SQLERRM;
    RETURN jsonb_build_object('ok', false, 'error', 'relay_failed', 'detail', SQLERRM);
END;
$function$;
