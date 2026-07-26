-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 00:38:17 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-03 : la colonne `referral` existait déjà (formulaire demande câblé dessus).
-- Suppression de mon doublon `referral_code` ajouté par erreur d'audit — on utilise l'existant.
alter table public.demandes_inscription drop column if exists referral_code;
comment on column public.demandes_inscription.referral is 'Code parrain déclaré à la candidature (PR-HUB-03) : demande prioritaire fast-track, badge admin.';
