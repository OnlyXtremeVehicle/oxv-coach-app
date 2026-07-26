-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 19 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Champs d'entreprise pour les demandes de type 'partenaire' (nullable, comme les
-- champs spécifiques pilote/coach existants).
alter table public.demandes_inscription add column if not exists company_name    text;
alter table public.demandes_inscription add column if not exists company_siret   text;
alter table public.demandes_inscription add column if not exists company_role    text;
alter table public.demandes_inscription add column if not exists company_website text;
