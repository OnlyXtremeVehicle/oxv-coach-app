-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 13 juin 2026 a 21:00 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Tables dédiées de la Carte : partenaires, hébergements, restaurants.
-- Schéma validé (fiche 08, §4). RLS activé ; politiques d'écriture différées
-- (en attente de l'arbitrage admin-seul vs création par utilisateurs).

-- 1. PARTENAIRES -------------------------------------------------------------
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  partner_type text,                          -- concessionnaire, équipementier, média, assureur…
  description text,
  logo_url text,
  address text, city text, region text,
  lat numeric, lon numeric,
  url text, contact_email text, contact_phone text,
  circuit_id uuid references public.circuits(id) on delete set null,
  is_official_partner boolean default false,  -- partenaire OXV officiel
  is_premium boolean default false,
  is_published boolean default false,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. HÉBERGEMENTS ------------------------------------------------------------
create table public.lodgings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lodging_type text,                          -- hôtel, villa, location, chambre d'hôtes…
  description text,
  address text, city text, region text,
  lat numeric, lon numeric,
  url text, booking_url text, contact_email text, contact_phone text,
  price_range text,                           -- €, €€, €€€ (pas de prix exact figé)
  distance_to_circuit_km numeric,
  circuit_id uuid references public.circuits(id) on delete set null,
  is_premium boolean default false,
  is_published boolean default false,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. RESTAURANTS -------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cuisine_type text,
  description text,
  address text, city text, region text,
  lat numeric, lon numeric,
  url text, contact_email text, contact_phone text,
  price_range text,                           -- €, €€, €€€
  distance_to_circuit_km numeric,
  circuit_id uuid references public.circuits(id) on delete set null,
  is_premium boolean default false,
  is_published boolean default false,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index sur les FK (Postgres n'indexe pas les FK automatiquement) + filtrage carte
create index idx_partners_circuit on public.partners(circuit_id);
create index idx_partners_published on public.partners(is_published);
create index idx_lodgings_circuit on public.lodgings(circuit_id);
create index idx_lodgings_published on public.lodgings(is_published);
create index idx_restaurants_circuit on public.restaurants(circuit_id);
create index idx_restaurants_published on public.restaurants(is_published);

-- RLS activé sur les trois tables (sécurité : sinon exposées via l'API publique)
alter table public.partners enable row level security;
alter table public.lodgings enable row level security;
alter table public.restaurants enable row level security;

-- Lecture : lignes publiées pour tout utilisateur authentifié, + ses propres brouillons.
-- Écriture : AUCUNE politique pour l'instant → seul le rôle de service écrit (défaut prudent).
create policy partners_read on public.partners
  for select to authenticated
  using (is_published = true or created_by = auth.uid());
create policy lodgings_read on public.lodgings
  for select to authenticated
  using (is_published = true or created_by = auth.uid());
create policy restaurants_read on public.restaurants
  for select to authenticated
  using (is_published = true or created_by = auth.uid());
