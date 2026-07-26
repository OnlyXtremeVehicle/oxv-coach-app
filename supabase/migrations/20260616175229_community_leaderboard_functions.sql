-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 16 juin 2026 à 17:52:29, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

CREATE OR REPLACE FUNCTION public.community_circuit_leaderboard(p_circuit_id uuid, p_limit integer DEFAULT 100)
RETURNS TABLE (
  rank integer, pilot_id uuid, display_name text, best_lap_s numeric,
  vehicle_context text, condition_context text, is_self boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $fn$
  WITH per_pilot AS (
    SELECT DISTINCT ON (h.user_id)
      h.user_id, h.personal_record_s AS best_s, h.vehicle_id, h.vehicle_label, h.condition
    FROM public.history_rollups h
    WHERE h.circuit_id = p_circuit_id AND h.personal_record_s IS NOT NULL
    ORDER BY h.user_id, h.personal_record_s ASC
  ),
  ranked AS (
    SELECT p.user_id, p.best_s, p.condition,
           COALESCE(NULLIF(TRIM(COALESCE(v.brand,'') || ' ' || COALESCE(v.model,'')), ''), p.vehicle_label) AS vehicle_model,
           u.community_visibility, u.public_handle
    FROM per_pilot p
    JOIN public.users u ON u.id = p.user_id
    LEFT JOIN public.vehicles v ON v.id = p.vehicle_id
    WHERE u.community_visibility <> 'private'
  )
  SELECT
    (row_number() OVER (ORDER BY best_s ASC))::integer AS rank,
    CASE WHEN community_visibility = 'nominative' OR user_id = auth.uid() THEN user_id ELSE NULL END AS pilot_id,
    CASE WHEN user_id = auth.uid() THEN COALESCE(public_handle,'Vous')
         WHEN community_visibility = 'nominative' THEN public_handle
         ELSE NULL END AS display_name,
    best_s AS best_lap_s, vehicle_model AS vehicle_context, condition AS condition_context,
    (user_id = auth.uid()) AS is_self
  FROM ranked
  ORDER BY best_s ASC
  LIMIT p_limit;
$fn$;

CREATE OR REPLACE FUNCTION public.community_model_observatory(p_circuit_id uuid)
RETURNS TABLE (
  vehicle_model text, n_pilots integer, best_lap_s numeric, median_lap_s numeric, condition_context text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $fn$
  WITH base AS (
    SELECT h.user_id,
           COALESCE(NULLIF(TRIM(COALESCE(v.brand,'') || ' ' || COALESCE(v.model,'')), ''), h.vehicle_label) AS model_key,
           h.personal_record_s AS best_s, h.condition
    FROM public.history_rollups h
    LEFT JOIN public.vehicles v ON v.id = h.vehicle_id
    JOIN public.users u ON u.id = h.user_id
    WHERE h.circuit_id = p_circuit_id AND h.personal_record_s IS NOT NULL
      AND u.community_visibility <> 'private'
  ),
  per_pilot AS (
    SELECT DISTINCT ON (user_id, model_key) user_id, model_key, best_s, condition
    FROM base WHERE model_key IS NOT NULL
    ORDER BY user_id, model_key, best_s ASC
  )
  SELECT model_key AS vehicle_model,
         (count(DISTINCT user_id))::integer AS n_pilots,
         round(min(best_s), 3) AS best_lap_s,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY best_s))::numeric, 3) AS median_lap_s,
         mode() WITHIN GROUP (ORDER BY condition) AS condition_context
  FROM per_pilot
  GROUP BY model_key
  ORDER BY best_lap_s ASC;
$fn$;

REVOKE EXECUTE ON FUNCTION public.community_circuit_leaderboard(uuid, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.community_model_observatory(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.community_circuit_leaderboard(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_model_observatory(uuid) TO authenticated;
