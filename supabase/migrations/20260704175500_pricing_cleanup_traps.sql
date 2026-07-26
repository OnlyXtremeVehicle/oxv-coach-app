-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 17:55:00, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Nettoyage grille pricing (constat audit lancement) : désactivation RÉVERSIBLE,
-- aucune suppression. La grille effective 2027 reste : access_half_day 39000 ·
-- signature_full_day 69000 · heritage_full_day 249000 (conforme grille canonique v9).
-- 1) Piège dormant : « Access journée complète » à 69000 (offre inexistante au
--    catalogue — Access est une demi-journée). Jamais consommée par le booking
--    aujourd'hui, mais bombe si un futur code lisait access_full_day.
update public.pricing set active = false
where id = '5d75effe-0ece-4da8-ad18-c4e803c5e8f4';
-- 2) Lignes saison 2026 (hors filtre season='2027', saison de test passée)
update public.pricing set active = false where season = '2026' and active = true;
