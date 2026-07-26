-- Migration RECONSTITUÉE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquée en production le 21 juillet 2026 à 06:04:55 (UTC), elle n'avait jamais été
-- versionnée dans ce dépôt. Source : colonne statements, recollée dans l'ordre d'exécution.
-- Le formatage d'origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a réellement tourné. Ne pas rejouer : déjà appliquée.

-- OXV — Table de captation Membres Fondateurs
-- Écriture réservée à l'edge function (service_role). Aucun accès anon.

create table if not exists public.founding_members (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  prenom         text not null,
  nom            text not null,
  fonction_pro   text,
  vehicule       text,
  session_pref   text check (session_pref in ('lundi', 'vendredi')),
  email          text not null,
  statut         text not null default 'interesse',   -- interesse | signature_envoyee | signe
  yousign_request_id text,
  consent_rgpd   boolean not null default false
);

create index if not exists founding_members_email_idx on public.founding_members (email);

-- RLS activé, aucune policy anon : seul le service_role (edge function) peut lire/écrire.
alter table public.founding_members enable row level security;
