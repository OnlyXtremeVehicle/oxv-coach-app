-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 à 23:25:56, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

create type public.affiliation_initiator as enum ('coach','pilot');
create type public.affiliation_status as enum ('pending','active','declined','ended');
create type public.subscription_scope as enum ('coach','pilot');
create type public.subscription_status as enum ('active','past_due','canceled');
