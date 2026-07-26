-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 00:24:58, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

alter table public.coach_profiles
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists website_url text,
  add column if not exists media jsonb not null default '[]'::jsonb;

comment on column public.coach_profiles.media is 'Galerie de la fiche coach : tableau JSON [{type: photo|video, url, caption}]. URLs pour l''instant ; upload Storage à venir.';

-- Le pilote lié voit la fiche de SON coach même si elle n'est pas publiée.
create policy coach_profiles_read_by_linked_pilot on public.coach_profiles
  for select using (public.is_my_coach(coach_id));
