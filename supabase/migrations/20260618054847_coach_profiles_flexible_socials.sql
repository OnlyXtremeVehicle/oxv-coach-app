-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 05:48:47, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Réseaux sociaux flexibles : liste [{platform, url}] (remplace les 3 colonnes figées, conservées en repli).
alter table public.coach_profiles
  add column if not exists socials jsonb not null default '[]'::jsonb;

comment on column public.coach_profiles.socials is 'Liste ordonnée [{platform,url}] des réseaux du coach. platform ∈ instagram/tiktok/youtube/facebook/x/linkedin/strava/website/other. Les colonnes instagram_url/youtube_url/website_url sont conservées en repli/sync.';
