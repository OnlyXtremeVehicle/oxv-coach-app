-- Corrige une fuite RGPD : la policy SELECT-by-token (migration 0011) utilisait
-- USING(true), exposant TOUTES les lignes de app_progression_shares à anon et
-- authenticated — n'importe qui pouvait `select *` et récupérer tous les partages
-- (user_id, tokens, métriques, vues). RLS n'impose pas le filtre token : USING(true)
-- = toutes les lignes visibles. La table est vide au moment du correctif → aucune
-- donnée exposée, aucun partage à casser.
--
-- On supprime cette policy et on remplace la lecture par token par une fonction
-- SECURITY DEFINER : unique porte, valide le token exact (non-révoqué, non-expiré),
-- incrémente view_count (traçabilité émetteur), et ne renvoie QUE des champs sûrs
-- (jamais user_id ni token, jamais d'autres lignes).
--
-- ⚠️ Le site oxvehicle.fr/share/{token} doit lire via cette RPC (plus via SELECT).

DROP POLICY IF EXISTS app_progression_shares_select_by_token ON public.app_progression_shares;

CREATE OR REPLACE FUNCTION public.get_shared_progression(p_token text)
RETURNS TABLE (
  share_scope text,
  included_metrics jsonb,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.app_progression_shares
  WHERE share_token = p_token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN; -- token inconnu / révoqué / expiré → aucun résultat (partage terminé)
  END IF;

  UPDATE public.app_progression_shares
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE id = v_id;

  RETURN QUERY
  SELECT s.share_scope, s.included_metrics, s.created_at, s.expires_at
  FROM public.app_progression_shares s
  WHERE s.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_progression(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_progression(text) TO anon, authenticated;
