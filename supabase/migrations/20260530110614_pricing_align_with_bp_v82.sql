-- [Réimportée dans le repo le 2026-06-08 : appliquée en prod le 2026-05-30,
--  hors dépôt. Contenu = SQL réellement appliqué (schema_migrations).]
-- Migration : Alignement de la table pricing sur le BP v8.2
-- Source : Audit Supabase §3.1 / §9.1 / Annexe A
-- Décision porteur : conserver les prix BP, migrer la BDD

-- 1) Archiver les offres signature et promotion (pas dans le BP v8.2)
UPDATE pricing
SET active = false
WHERE offer_key IN ('signature', 'promotion')
  AND season = '2026';

-- 2) Access demi-journée : 200/250 € → 390/390 € (uniforme)
UPDATE pricing
SET price_first_session_cents = 39000,
    price_subsequent_cents = 39000
WHERE offer_key = 'access'
  AND format = 'half_day'
  AND season = '2026';

-- 3) Access journée pleine : 400 € → 690 € (uniforme)
UPDATE pricing
SET price_first_session_cents = 69000,
    price_subsequent_cents = 69000
WHERE offer_key = 'access'
  AND format = 'full_day'
  AND season = '2026';

-- 4) Heritage Pass : 3 500 € → 2 290 €
UPDATE pricing
SET price_first_session_cents = 229000,
    price_subsequent_cents = 229000
WHERE offer_key = 'heritage'
  AND season = '2026';

-- 5) Mettre à jour le default de heritage_packs.price_total
ALTER TABLE public.heritage_packs
ALTER COLUMN price_total
SET DEFAULT 229000;
