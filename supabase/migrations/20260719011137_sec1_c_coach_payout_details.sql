-- Migration RECONSTITUÉE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquée en production le 19 juillet 2026 à 01:11:37 (UTC), elle n'avait jamais été
-- versionnée dans ce dépôt. Source : colonne statements, recollée dans l'ordre d'exécution.
-- Le formatage d'origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a réellement tourné. Ne pas rejouer : déjà appliquée.

-- SEC-1 lot C — coordonnées de règlement coach, séparées et jamais publiées
-- (source repo : supabase/migrations/20260719122000_sec1_c_payout.sql)

create table public.coach_payout_details (
  coach_id uuid primary key references public.users (id) on delete cascade,
  iban text,
  bic text,
  account_holder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_payout_details is
  'SEC-1 : coordonnées de règlement du coach (IBAN/BIC), séparées de coach_profiles pour ne JAMAIS transiter par les policies publiques (coach_profiles_read_published expose payment_link à tous). Accès : le coach lui-même + admin. Base du futur RIB/QR SEPA.';

alter table public.coach_payout_details enable row level security;

create policy coach_payout_details_owner_all
  on public.coach_payout_details
  for all to authenticated
  using (coach_id = auth.uid() and is_coach())
  with check (coach_id = auth.uid() and is_coach());

create policy coach_payout_details_admin_all
  on public.coach_payout_details
  for all to authenticated
  using (is_admin())
  with check (is_admin());

revoke all on public.coach_payout_details from public, anon;
grant select, insert, update, delete on public.coach_payout_details to authenticated;
grant all on public.coach_payout_details to service_role;

create trigger coach_payout_details_touch
  before update on public.coach_payout_details
  for each row execute function public.tg_touch_updated_at();
