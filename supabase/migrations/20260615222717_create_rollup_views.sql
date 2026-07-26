-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 a 22:27 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Rollups M3 : agrégats lisibles par l'app. Vues security_invoker (RLS du pilote appliquée).
-- Additif (création de vues), zéro impact sur les tables/données existantes.

-- =========================================================
-- day_rollups : une ligne par (pilote, circuit, jour)
-- Alimente la Synthèse "meilleur du jour" + relais→relais.
-- =========================================================
CREATE OR REPLACE VIEW public.day_rollups
WITH (security_invoker = true) AS
WITH s AS (
  SELECT ts.id AS session_id, ts.user_id, ts.circuit_id, ts.circuit_name,
         ts.vehicle_label, ts.weather,
         (COALESCE(ts.started_at, ts.created_at))::date AS day
  FROM public.telemetry_sessions ts
),
vl AS (  -- tours valides (ni out ni in, durée > 0)
  SELECT s.user_id, s.circuit_id, s.circuit_name, s.day, s.session_id,
         s.vehicle_label, s.weather, l.lap_number,
         l.duration_seconds AS lap_s, l.max_speed_kmh
  FROM s
  JOIN public.laps l ON l.session_id = s.session_id
  WHERE COALESCE(l.is_outlap,false)=false AND COALESCE(l.is_inlap,false)=false
    AND l.duration_seconds IS NOT NULL AND l.duration_seconds > 0
),
best AS (  -- meilleur tour de la journée
  SELECT DISTINCT ON (user_id, circuit_id, day)
         user_id, circuit_id, day,
         session_id AS best_session_id, lap_number AS best_lap_number, lap_s AS best_lap_s
  FROM vl
  ORDER BY user_id, circuit_id, day, lap_s ASC
)
SELECT vl.user_id, vl.circuit_id, vl.circuit_name, vl.day,
       COUNT(*)::int                            AS n_valid_laps,
       COUNT(DISTINCT vl.session_id)::int        AS n_sessions,
       ROUND(MIN(vl.lap_s)::numeric, 3)          AS best_lap_s,
       ROUND(AVG(vl.lap_s)::numeric, 3)          AS avg_valid_lap_s,
       ROUND(MAX(vl.max_speed_kmh)::numeric, 1)  AS max_speed_kmh,
       ARRAY_AGG(DISTINCT vl.vehicle_label) FILTER (WHERE vl.vehicle_label IS NOT NULL) AS vehicles,
       ARRAY_AGG(DISTINCT vl.weather)       FILTER (WHERE vl.weather IS NOT NULL)        AS weather_seen,
       b.best_session_id, b.best_lap_number
FROM vl
JOIN best b ON b.user_id=vl.user_id AND b.circuit_id=vl.circuit_id AND b.day=vl.day
GROUP BY vl.user_id, vl.circuit_id, vl.circuit_name, vl.day, b.best_session_id, b.best_lap_number;

COMMENT ON VIEW public.day_rollups IS 'Agrégat par (pilote, circuit, jour) : meilleur tour du jour, nb tours valides/relais, vitesse max. Source Synthèse.';

-- =========================================================
-- history_rollups : une ligne par (pilote, circuit, voiture, condition)
-- Alimente le pilier Évolution (jalons records + resserrement régularité).
-- =========================================================
CREATE OR REPLACE VIEW public.history_rollups
WITH (security_invoker = true) AS
WITH s AS (
  SELECT ts.id AS session_id, ts.user_id, ts.circuit_id, ts.circuit_name,
         ts.vehicle_id, ts.vehicle_label,
         CASE
           WHEN ts.weather ILIKE '%pluie%' OR ts.weather ILIKE '%humid%'
             OR ts.weather ILIKE '%wet%'   OR ts.weather ILIKE '%mouill%' THEN 'wet'
           WHEN ts.weather IS NOT NULL AND length(btrim(ts.weather)) > 0 THEN 'dry'
           ELSE 'unknown'
         END AS condition,
         (COALESCE(ts.started_at, ts.created_at))::date AS day,
         COALESCE(ts.started_at, ts.created_at) AS ts_at
  FROM public.telemetry_sessions ts
),
sb AS (  -- meilleur tour + dispersion par session (scope)
  SELECT s.user_id, s.circuit_id, s.circuit_name, s.vehicle_id, s.vehicle_label,
         s.condition, s.session_id, s.day, s.ts_at,
         MIN(l.duration_seconds)        AS session_best_s,
         STDDEV_POP(l.duration_seconds) AS spread_s
  FROM s
  JOIN public.laps l ON l.session_id = s.session_id
  WHERE COALESCE(l.is_outlap,false)=false AND COALESCE(l.is_inlap,false)=false
    AND l.duration_seconds IS NOT NULL AND l.duration_seconds > 0
  GROUP BY s.user_id, s.circuit_id, s.circuit_name, s.vehicle_id, s.vehicle_label,
           s.condition, s.session_id, s.day, s.ts_at
),
prog AS (  -- meilleur courant (récord progressif)
  SELECT *,
         MIN(session_best_s) OVER (
           PARTITION BY user_id, circuit_id, vehicle_id, condition
           ORDER BY ts_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS running_best
  FROM sb
),
milestones AS (  -- jalons : la session bat (ou égale) tous les précédents
  SELECT user_id, circuit_id, vehicle_id, condition, day, session_id, session_best_s
  FROM prog WHERE session_best_s <= running_best
)
SELECT
  sb.user_id, sb.circuit_id, sb.circuit_name, sb.vehicle_id, sb.vehicle_label, sb.condition,
  COUNT(DISTINCT sb.session_id)::int        AS n_sessions,
  COUNT(DISTINCT sb.day)::int               AS n_days,
  ROUND(MIN(sb.session_best_s)::numeric, 3) AS personal_record_s,
  MIN(sb.day)                               AS first_day,
  MAX(sb.day)                               AS last_day,
  jsonb_agg(
    jsonb_build_object('date', sb.day, 'session_id', sb.session_id,
                       'best_s',   ROUND(sb.session_best_s::numeric, 3),
                       'spread_s', ROUND(COALESCE(sb.spread_s,0)::numeric, 3))
    ORDER BY sb.ts_at
  )                                         AS regularity_trend,
  (SELECT jsonb_agg(jsonb_build_object('date', m.day, 'session_id', m.session_id,
                                       'lap_s', ROUND(m.session_best_s::numeric, 3)) ORDER BY m.day)
   FROM milestones m
   WHERE m.user_id=sb.user_id AND m.circuit_id=sb.circuit_id
     AND m.vehicle_id IS NOT DISTINCT FROM sb.vehicle_id AND m.condition=sb.condition
  )                                         AS records_timeline,
  '[]'::jsonb                               AS apex_bands,            -- SCAFFOLD : bandes apex/virage sur N sessions (anatomy réelle, post-Valence)
  5                                         AS apex_bands_window_target
FROM sb
GROUP BY sb.user_id, sb.circuit_id, sb.circuit_name, sb.vehicle_id, sb.vehicle_label, sb.condition;

COMMENT ON VIEW public.history_rollups IS 'Agrégat par (pilote, circuit, voiture, condition) : record perso, jalons records progressifs, resserrement régularité. Source pilier Évolution. apex_bands scaffoldé (post-Valence).';
