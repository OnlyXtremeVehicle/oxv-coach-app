-- Conformité (P2) — VALIDÉ fondateur (2026-07-12). Fige le nom du destinataire au
-- moment de l'émission, comme le vendeur (seller). Sans ça, getInvoiceDetail
-- re-résolvait le nom via listMyPilots() → une facture ré-ouverte après retrait
-- de consentement du pilote perdait son destinataire (copie non conforme).
alter table public.coach_invoices
  add column if not exists buyer_name text;

comment on column public.coach_invoices.buyer_name is
  'Nom du destinataire figé a l''emission (snapshot conformite). NULL pour les factures anterieures ou sans destinataire.';
