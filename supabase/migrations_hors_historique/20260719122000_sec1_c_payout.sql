-- ============================================================================
-- SEC-1 — PRÉPARÉE, NON APPLIQUÉE — approbation fondateur requise
-- ============================================================================
-- Lot C — Coordonnées de règlement coach : table dédiée coach_payout_details
--
-- Constat prod (inspection 2026-07-19, lecture seule) :
--   - Aucune colonne IBAN nulle part (information_schema : seul
--     coach_profiles.payment_link existe, type text).
--   - coach_profiles.payment_link : 0 valeur non nulle en prod — AUCUNE donnée
--     à migrer.
--   - Le risque était structurel : payment_link est lisible par TOUT LE MONDE
--     via la policy coach_profiles_read_published (USING is_published = true,
--     rôle public). Un coach qui y aurait collé son IBAN l'aurait publié.
--
-- Décision fondateur appliquée : les coordonnées bancaires (RIB/QR SEPA à
-- venir) vivent dans une table séparée, RLS owner + admin, jamais publiée.
-- Côté repo (même lot SEC-1) : coachBillingService refuse désormais toute
-- valeur non-URL (dont IBAN) dans payment_link.
--
-- Rollback : DROP TABLE public.coach_payout_details; (aucune donnée existante
-- n'y est déplacée par cette migration).
-- ============================================================================

create table public.coach_payout_details (
  coach_id uuid primary key references public.users (id) on delete cascade,
  -- IBAN du coach (règlement direct hors OXV — l'app ne traite aucun paiement).
  iban text,
  bic text,
  -- Titulaire du compte tel qu'il doit apparaître pour un virement.
  account_holder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_payout_details is
  'SEC-1 : coordonnées de règlement du coach (IBAN/BIC), séparées de '
  'coach_profiles pour ne JAMAIS transiter par les policies publiques '
  '(coach_profiles_read_published expose payment_link à tous). '
  'Accès : le coach lui-même + admin. Base du futur RIB/QR SEPA.';

alter table public.coach_payout_details enable row level security;

-- Le coach gère SES coordonnées (et uniquement les siennes).
create policy coach_payout_details_owner_all
  on public.coach_payout_details
  for all to authenticated
  using (coach_id = auth.uid() and is_coach())
  with check (coach_id = auth.uid() and is_coach());

-- L'admin voit et corrige tout (support).
create policy coach_payout_details_admin_all
  on public.coach_payout_details
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- GRANT minimal : jamais d'anon sur des coordonnées bancaires.
revoke all on public.coach_payout_details from public, anon;
grant select, insert, update, delete on public.coach_payout_details to authenticated;
grant all on public.coach_payout_details to service_role;

-- updated_at automatique (fonction générique déjà en prod, search_path figé).
create trigger coach_payout_details_touch
  before update on public.coach_payout_details
  for each row execute function public.tg_touch_updated_at();
