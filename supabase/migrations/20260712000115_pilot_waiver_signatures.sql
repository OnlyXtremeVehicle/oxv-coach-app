-- P3 Waivers e-sign — décisions fondateur 2026-07-12 : timing = À LA RÉSERVATION,
-- valeur probante = SIMPLE (case + nom + horodatage + empreinte du texte, hébergé
-- OXV), périmètre = PILOTE UNIQUEMENT. Trace par-signature IMMUABLE (pas des
-- colonnes users qui s'écrasent).
-- ⚠ Le TEXTE de décharge reste à faire relire par un avocat avant activation du
--   flag pilot_waivers (OFF).
create table if not exists public.pilot_waiver_signatures (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  booking_id         uuid references public.coaching_bookings(id) on delete set null,
  session_id         uuid references public.telemetry_sessions(id) on delete set null,
  waiver_version     text not null,
  document_hash      text not null,
  signed_full_name   text not null,
  signed_at          timestamptz not null default now(),
  user_agent         text,
  app_version        text,
  created_at         timestamptz not null default now()
);

create index if not exists pilot_waiver_user_idx
  on public.pilot_waiver_signatures (user_id, signed_at desc);

alter table public.pilot_waiver_signatures enable row level security;

-- Le pilote lit et crée SES signatures ; il ne peut ni les modifier ni les
-- supprimer (immuabilité de la preuve). Admin en lecture (audit). Volontairement
-- AUCUNE policy update/delete pour authenticated.
create policy waiver_owner_select on public.pilot_waiver_signatures
  for select using (user_id = auth.uid());
create policy waiver_owner_insert on public.pilot_waiver_signatures
  for insert with check (user_id = auth.uid());
create policy waiver_admin_select on public.pilot_waiver_signatures
  for select using (is_admin());

-- Flag d'activation (OFF) : rien de visible tant que le texte n'est pas relu.
insert into public.app_feature_flags (key, enabled, description)
  values ('pilot_waivers', false, 'Décharge de responsabilité e-sign (pilote) — activation après relecture avocat')
  on conflict (key) do nothing;
