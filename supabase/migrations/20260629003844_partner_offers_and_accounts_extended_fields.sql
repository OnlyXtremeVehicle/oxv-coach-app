-- PR-35 : champs offre complets. Additif, RLS existante conservee.
alter table public.partner_offers
  add column if not exists category text,
  add column if not exists valid_until timestamptz,
  add column if not exists conditions text,
  add column if not exists image_url text;

-- PR-36 : champs fiche partenaire etendus (zone geographique + documents).
alter table public.partner_accounts
  add column if not exists geo_zone text,
  add column if not exists documents jsonb;
