-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 22 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Jalon 4 — RPC de lecture publique des VALEURS d'un partage de progression.
--
-- Complète get_shared_progression (qui ne renvoyait que les métadonnées) :
-- recalcule à la volée les valeurs réelles des métriques COCHÉES, depuis les
-- sessions du propriétaire, selon la portée. SECURITY DEFINER pour lire les
-- données du propriétaire sans authentification, mais ne renvoie JAMAIS
-- d'identité (ni user_id, ni nom) et UNIQUEMENT les métriques de la liste
-- blanche du partage. Doctrine Mirror : faits bruts (chronos, tours,
-- régularité), jamais la marge interne ni aucun score.

CREATE OR REPLACE FUNCTION public.get_shared_progression_values(p_token text)
RETURNS TABLE (
  share_scope     text,
  included_metrics jsonb,
  created_at      timestamptz,
  expires_at      timestamptz,
  metric_values   jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          uuid;
  v_user        uuid;
  v_scope       text;
  v_metrics     jsonb;
  v_created     timestamptz;
  v_expires     timestamptz;
  v_limit       int;
  v_session_ids uuid[];
  v_values      jsonb := '{}'::jsonb;
BEGIN
  -- 1. Résoudre + valider le token (non révoqué, non expiré).
  SELECT s.id, s.user_id, s.share_scope, s.included_metrics, s.created_at, s.expires_at
    INTO v_id, v_user, v_scope, v_metrics, v_created, v_expires
  FROM public.app_progression_shares s
  WHERE s.share_token = p_token
    AND s.revoked_at IS NULL
    AND (s.expires_at IS NULL OR s.expires_at > now())
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN; -- token inconnu / révoqué / expiré → aucun résultat
  END IF;

  -- 2. Traçabilité émetteur.
  UPDATE public.app_progression_shares
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE id = v_id;

  -- 3. Ensemble de sessions selon la portée (NULL = toutes).
  v_limit := CASE v_scope
    WHEN 'last_session'    THEN 1
    WHEN 'last_5_sessions' THEN 5
    ELSE NULL
  END;

  SELECT array_agg(t.id ORDER BY t.started_at DESC)
    INTO v_session_ids
  FROM (
    SELECT id, started_at
    FROM public.telemetry_sessions
    WHERE user_id = v_user AND status = 'completed'
    ORDER BY started_at DESC
    LIMIT v_limit
  ) t;

  IF v_session_ids IS NULL THEN
    v_session_ids := ARRAY[]::uuid[];
  END IF;

  -- 4. Calcul par métrique, UNIQUEMENT si cochée (liste blanche stricte).

  IF v_metrics ? 'best_lap' THEN
    v_values := v_values || jsonb_build_object('best_lap', (
      SELECT jsonb_build_object(
        'seconds', round(min(best_lap_seconds)::numeric, 2),
        'circuit', (array_agg(circuit_name ORDER BY best_lap_seconds ASC)
                      FILTER (WHERE best_lap_seconds IS NOT NULL))[1]
      )
      FROM public.telemetry_sessions
      WHERE id = ANY(v_session_ids) AND best_lap_seconds IS NOT NULL
    ));
  END IF;

  IF v_metrics ? 'lap_count' THEN
    v_values := v_values || jsonb_build_object('lap_count', (
      SELECT coalesce(sum(lap_count), 0)
      FROM public.telemetry_sessions
      WHERE id = ANY(v_session_ids)
    ));
  END IF;

  IF v_metrics ? 'regularity' THEN
    v_values := v_values || jsonb_build_object('regularity', (
      SELECT jsonb_build_object(
        'stddev_s', round(stddev_samp(duration_seconds)::numeric, 2),
        'clean_laps', count(*)
      )
      FROM public.laps
      WHERE session_id = ANY(v_session_ids)
        AND coalesce(is_outlap, false) = false
        AND coalesce(is_inlap, false) = false
        AND duration_seconds IS NOT NULL
    ));
  END IF;

  IF v_metrics ? 'progression' THEN
    v_values := v_values || jsonb_build_object('progression', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'date', started_at,
               'best_lap_s', round(best_lap_seconds::numeric, 2),
               'circuit', circuit_name
             ) ORDER BY started_at ASC), '[]'::jsonb)
      FROM public.telemetry_sessions
      WHERE id = ANY(v_session_ids) AND best_lap_seconds IS NOT NULL
    ));
  END IF;

  -- Signature : profil calculé par l'analyse, pas en base → drapeau (V1).
  IF v_metrics ? 'signature' THEN
    v_values := v_values || jsonb_build_object('signature', jsonb_build_object('available', false));
  END IF;

  -- Contexte non identifiant (toujours).
  v_values := v_values || jsonb_build_object(
    'session_count', coalesce(array_length(v_session_ids, 1), 0)
  );

  RETURN QUERY SELECT v_scope, v_metrics, v_created, v_expires, v_values;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_progression_values(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_progression_values(text) TO anon, authenticated;
