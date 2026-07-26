-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 3 juillet 2026 a 19:27:25 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-04 : appairage compte site <-> app (code court a duree limitee, usage unique).
-- Additive, aucune donnee existante touchee. Ecriture UNIQUEMENT via Edge Function (service role).
create table public.app_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_user_agent text
);
comment on table public.app_pairing_codes is 'PR-HUB-04 — codes d''appairage app (8 car., 10 min, usage unique). INSERT/UPDATE reserves au service role (Edge Function pair-app). Le client ne peut que LIRE ses propres codes.';

alter table public.app_pairing_codes enable row level security;

-- Lecture : un utilisateur voit uniquement ses propres codes (affichage espace compte).
create policy app_pairing_codes_select_own on public.app_pairing_codes
  for select to authenticated using (user_id = (select auth.uid()));
-- Aucune policy INSERT/UPDATE/DELETE : seule l'Edge Function (service role, bypass RLS) ecrit.

-- Un seul code actif par valeur (anti-collision) + acces rapide par utilisateur.
create unique index app_pairing_codes_active_code on public.app_pairing_codes (code) where used_at is null;
create index app_pairing_codes_user_idx on public.app_pairing_codes (user_id, created_at desc);

-- Anti-brute-force du redeem (comptage par IP hashee, service role uniquement).
create table public.app_pairing_redeem_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
comment on table public.app_pairing_redeem_attempts is 'PR-HUB-04 — tentatives de redeem (rate-limit). Service role uniquement, purge par la fonction.';
alter table public.app_pairing_redeem_attempts enable row level security;
-- Aucune policy : invisible et inaccessible aux roles client.
create index app_pairing_attempts_idx on public.app_pairing_redeem_attempts (ip_hash, created_at desc);
