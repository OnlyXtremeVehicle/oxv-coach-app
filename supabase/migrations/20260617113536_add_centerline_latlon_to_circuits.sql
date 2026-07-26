-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 à 11:35:36, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

alter table public.circuits
  add column if not exists centerline_latlon jsonb;

comment on column public.circuits.centerline_latlon is
  'Polyline georeferencee du trace : tableau ordonne [{lat, lon}] (source OSM/GPS). Alimente le generateur de ruban 3D (centerline -> virages -> ruban). NULL = pas de geometrie (rendu 3D indisponible pour ce circuit).';
