-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 a 23:26:20, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Fiche coach : argumentaire public + prix de saison affiché
create table public.coach_profiles (
  coach_id uuid primary key references public.users(id) on delete cascade,
  headline text,
  bio text,
  specialties text[] not null default '{}',
  palmares text,
  photo_url text,
  circuits uuid[] not null default '{}',
  season_price_eur integer,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.coach_profiles is 'Fiche coach (argumentaire). is_published -> visible dans l''annuaire. season_price_eur affiché (NULL = gratuit). Identité nominative via RPC coach_public_card.';
alter table public.coach_profiles enable row level security;
create policy coach_profiles_owner_all on public.coach_profiles
  for all using (coach_id = auth.uid() and public.is_coach()) with check (coach_id = auth.uid() and public.is_coach());
create policy coach_profiles_admin_all on public.coach_profiles
  for all using (public.is_admin()) with check (public.is_admin());
create policy coach_profiles_read_published on public.coach_profiles
  for select using (is_published = true);

-- Fiche pilote : infos importantes pour le coach (DISTINCTE de pilot_goals, qui reste privé)
create table public.pilot_sheets (
  pilot_id uuid primary key references public.users(id) on delete cascade,
  level text,
  experience_years integer,
  vehicles_note text,
  focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.pilot_sheets is 'Fiche pilote destinée au coach (niveau, expérience, ce que je veux travailler). Distincte de pilot_goals (intime, jamais partagé).';
alter table public.pilot_sheets enable row level security;
create policy pilot_sheets_owner_all on public.pilot_sheets
  for all using (pilot_id = auth.uid()) with check (pilot_id = auth.uid());
create policy pilot_sheets_admin_all on public.pilot_sheets
  for all using (public.is_admin()) with check (public.is_admin());
-- Un coach lié OU invité (toute ligne coach_pilots les reliant) peut lire la fiche
create policy pilot_sheets_read_by_linked_coach on public.pilot_sheets
  for select using (
    exists (select 1 from public.coach_pilots cp where cp.pilot_id = pilot_sheets.pilot_id and cp.coach_id = auth.uid())
  );
