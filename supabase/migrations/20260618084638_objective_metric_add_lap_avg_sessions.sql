-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 08:46:38 (UTC), elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Élargit le catalogue de métriques. Mesurables dès aujourd'hui depuis laps.
-- ADD VALUE doit précéder toute fonction qui référence ces littéraux (transaction séparée).
alter type public.objective_metric add value if not exists 'avg_lap';
alter type public.objective_metric add value if not exists 'lap_count';
alter type public.objective_metric add value if not exists 'sessions';
