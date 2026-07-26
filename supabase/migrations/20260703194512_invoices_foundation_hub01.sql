-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 3 juillet 2026 a 19:45:12 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-01 : facturation — fondations (numérotation séquentielle infalsifiable,
-- table avec snapshot, bucket privé, RLS). Additif. PDF/email = Edge Function à suivre.

-- Compteur par année : numérotation continue OXV-2027-0001 (pas de trous liés aux rollbacks de séquence)
create table public.invoice_counters (
  year int primary key,
  last_number int not null default 0
);
alter table public.invoice_counters enable row level security; -- aucune policy : service role uniquement

create or replace function public.oxv_next_invoice_number()
returns text language plpgsql security definer set search_path = public as $$
declare y int := extract(year from now())::int; n int;
begin
  insert into public.invoice_counters(year, last_number) values (y, 1)
  on conflict (year) do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into n;
  return 'OXV-' || y || '-' || lpad(n::text, 4, '0');
end $$;
revoke execute on function public.oxv_next_invoice_number() from public, anon, authenticated;
comment on function public.oxv_next_invoice_number() is 'PR-HUB-01 — numéro de facture séquentiel par année (service role uniquement).';

-- Factures : snapshot complet au moment de l''émission (immuable côté client)
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  type text not null default 'invoice' check (type in ('invoice','credit_note')),
  credit_note_for uuid references public.invoices(id),
  user_id uuid not null references public.users(id),
  payment_id uuid references public.payments(id),
  registration_id uuid references public.registrations(id),
  issued_at date not null default current_date,
  currency text not null default 'EUR',
  amount_total integer not null,            -- centimes ; négatif pour un avoir
  vat_note text not null default 'TVA non applicable, art. 293 B du CGI',
  seller jsonb not null,                    -- snapshot vendeur (identité, SIRET — placeholder tant que non fourni)
  customer jsonb not null,                  -- snapshot client (nom, adresse, email)
  lines jsonb not null,                     -- [{designation, quantity, unit_price, total}]
  pdf_path text,                            -- chemin bucket invoices (user_id/number.pdf)
  created_at timestamptz not null default now()
);
comment on table public.invoices is 'PR-HUB-01 — factures et avoirs. Écriture service role uniquement (Edge Function generate-invoice). Snapshot immuable : ne jamais UPDATE les montants après émission.';
alter table public.invoices enable row level security;
create policy invoices_select_own on public.invoices
  for select to authenticated using (user_id = (select auth.uid()) or is_admin());
-- aucune policy INSERT/UPDATE/DELETE : service role uniquement
create index invoices_user_idx on public.invoices (user_id, issued_at desc);
create index invoices_payment_idx on public.invoices (payment_id);

-- Bucket privé pour les PDF
insert into storage.buckets (id, name, public) values ('invoices','invoices', false)
on conflict (id) do nothing;
create policy invoices_storage_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and ((storage.foldername(name))[1] = (select auth.uid())::text or is_admin()));
-- aucune policy INSERT/UPDATE/DELETE storage : upload par service role uniquement
