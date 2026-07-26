-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 23 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Heritage : aligner le défaut de heritage_packs.price_total sur le prix réel
-- 2 490 € (249000 cents). La table pricing était déjà à 249000 ; ce défaut était
-- resté à 229000 (ancienne valeur 2 290 €). Table vide → aucune ligne impactée,
-- correction purement préventive avant ouverture des paiements.
ALTER TABLE public.heritage_packs
  ALTER COLUMN price_total SET DEFAULT 249000;
