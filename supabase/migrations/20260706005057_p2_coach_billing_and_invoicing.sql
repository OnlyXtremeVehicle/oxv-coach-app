-- P2 Studio Coach — APPLIQUÉE en prod le 2026-07-04 via MCP — ne pas ré-exécuter.
-- Prestation coach : paiement DIRECT au coach (hors OXV) + AIDE À LA FACTURE
-- OPTIONNELLE (choix par coach). Décisions fondateur 2026-07-04. OXV n'encaisse
-- ni ne facture la prestation ; l'app = suivi + outil de facture pour le coach
-- qui l'active. Additif, RLS complète. Ne touche PAS payments/invoices OXV.
-- ⚠ Gabarit de facture + régime TVA à faire VALIDER par un comptable avant service.

alter table public.coaching_bookings
  add column if not exists amount_cents integer,
  add column if not exists billing_status text default 'none'
    check (billing_status in ('none', 'quote', 'settled'));

alter table public.coach_profiles
  add column if not exists payment_link text,
  add column if not exists invoicing_assist_enabled boolean not null default false,
  add column if not exists billing_name text,
  add column if not exists billing_address text,
  add column if not exists billing_siret text,
  add column if not exists billing_legal_form text,
  add column if not exists vat_regime text default 'franchise'
    check (vat_regime in ('franchise', 'assujetti')),
  add column if not exists vat_rate numeric;

create table if not exists public.coach_invoices (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id),
  number text not null,
  pilot_id uuid references auth.users(id),
  coaching_booking_id uuid references public.coaching_bookings(id),
  issued_at timestamptz not null default now(),
  service_date date,
  currency text not null default 'EUR',
  lines jsonb not null,
  amount_ht integer not null,
  vat_rate numeric,
  vat_amount integer,
  amount_total integer not null,
  vat_note text,
  seller jsonb not null,
  pdf_path text,
  created_at timestamptz not null default now(),
  unique (coach_id, number)
);

create table if not exists public.coach_invoice_counters (
  coach_id uuid primary key references auth.users(id),
  year integer not null,
  next_number integer not null default 1
);

alter table public.coach_invoices enable row level security;
alter table public.coach_invoice_counters enable row level security;

create policy coach_invoices_coach_all on public.coach_invoices
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy coach_invoices_pilot_select on public.coach_invoices
  for select using (pilot_id = auth.uid());
create policy coach_invoices_admin_all on public.coach_invoices
  for all using (is_admin());
create policy coach_counters_coach_all on public.coach_invoice_counters
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy coach_counters_admin_all on public.coach_invoice_counters
  for all using (is_admin());

-- Numérotation atomique : séquence par coach, remise à 1 au changement d'année.
create or replace function public.next_coach_invoice_number(p_coach uuid, p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cur record;
  alloc int;
begin
  insert into coach_invoice_counters (coach_id, year, next_number)
    values (p_coach, p_year, 1)
    on conflict (coach_id) do nothing;
  select * into cur from coach_invoice_counters where coach_id = p_coach for update;
  if cur.year <> p_year then
    alloc := 1;
  else
    alloc := cur.next_number;
  end if;
  update coach_invoice_counters set year = p_year, next_number = alloc + 1 where coach_id = p_coach;
  return alloc;
end;
$$;

insert into public.app_feature_flags (key, enabled, description)
  values ('coach_billing', false, 'Prestation coach : suivi + aide à la facture (par coach)')
  on conflict (key) do nothing;
