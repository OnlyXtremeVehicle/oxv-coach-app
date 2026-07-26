-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 a 22:07 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- M3 / mirror-insights-v3 : colonnes additives pour le contrat de données du Lot Cœur.
-- 100% additif, nullable, réversible (DROP COLUMN possible). Aucune donnée existante modifiée.
ALTER TABLE public.session_insights
  ADD COLUMN IF NOT EXISTS lap_classification jsonb,   -- classe par tour + drapeau off_track
  ADD COLUMN IF NOT EXISTS off_track_events  jsonb,    -- sorties localisées + snapshot (fait, non qualifié)
  ADD COLUMN IF NOT EXISTS warmup            jsonb,    -- tours de chauffe (contexte factuel)
  ADD COLUMN IF NOT EXISTS reference_laps    jsonb,    -- best_of_day + personal_record (scopés)
  ADD COLUMN IF NOT EXISTS trajectory        jsonb,    -- module trajectoire (traj-v1)
  ADD COLUMN IF NOT EXISTS condition         text,     -- dry | wet (du weather_snapshot)
  ADD COLUMN IF NOT EXISTS circuit_id        uuid,     -- scoping multi-circuits
  ADD COLUMN IF NOT EXISTS vehicle_id        uuid;     -- scoping par voiture

COMMENT ON COLUMN public.session_insights.off_track_events IS
  'Sorties de piste localisees (corner_index, lap_index, instant, snapshot). FAIT brut cote pilote, jamais qualifie (la lecture faute = espace coach).';
COMMENT ON COLUMN public.session_insights.lap_classification IS
  'Par tour: class (hot_valid|in_lap|out_lap|warmup_cooldown) + off_track + valid_for_count.';
