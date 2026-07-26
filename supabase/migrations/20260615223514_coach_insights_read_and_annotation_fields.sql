-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 à 22:35:14, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- 1) Le coach (consenti) peut LIRE les insights calculés de son pilote.
--    Même garde que telemetry_sessions/laps : is_coach_of() exige active + pilot_consent_at.
--    Additif (nouvelle policy SELECT), ne touche pas aux accès existants.
CREATE POLICY session_insights_coach_select ON public.session_insights
  FOR SELECT USING (is_coach_of(user_id));

-- 2) coach_annotations : compléter l'ancrage Lot 8. Colonnes additives, nullables.
ALTER TABLE public.coach_annotations
  ADD COLUMN IF NOT EXISTS lap_index     integer,
  ADD COLUMN IF NOT EXISTS audio_url     text,
  ADD COLUMN IF NOT EXISTS marker_s_norm numeric;

COMMENT ON COLUMN public.coach_annotations.lap_index IS
  'Tour concerné par l''annotation (NULL = virage/session en général).';
COMMENT ON COLUMN public.coach_annotations.audio_url IS
  'Chemin de l''annotation audio dans le bucket privé audio_briefings.';
COMMENT ON COLUMN public.coach_annotations.marker_s_norm IS
  'Repère fin sur le tracé (0..1, position le long du tour). NULL = utiliser l''apex du corner_index via circuits.corners.';
