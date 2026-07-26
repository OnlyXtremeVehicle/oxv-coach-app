-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 à 23:14:15, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Ajoute le rôle partenaire à l'enum (additif, irréversible mais sans risque : une valeur de plus).
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'partner';
