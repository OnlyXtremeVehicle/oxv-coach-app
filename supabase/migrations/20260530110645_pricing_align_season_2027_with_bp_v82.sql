-- [Réimportée dans le repo le 2026-06-08 : appliquée en prod le 2026-05-30,
--  hors dépôt. Contenu = SQL réellement appliqué (schema_migrations).]
-- Migration corrective : aligner aussi la saison 2027 (saison commerciale de lancement)
-- Heritage 2027 : 2 490 € → 2 290 €
-- Signature 2027 : archiver
-- Access full_day 2027 : créer à 690 €

-- 1) Heritage 2027 : aligner à 2 290 €
UPDATE pricing
SET price_first_session_cents = 229000,
    price_subsequent_cents = 229000
WHERE offer_key = 'heritage'
  AND season = '2027';

-- 2) Archiver signature 2027 (offre non commercialisée dans BP v8.2)
UPDATE pricing
SET active = false
WHERE offer_key = 'signature'
  AND season = '2027';

-- 3) Créer access full_day 2027 (manquant) à 690 €
INSERT INTO pricing (season, offer_key, format, price_first_session_cents, price_subsequent_cents, active)
VALUES ('2027', 'access', 'full_day', 69000, 69000, true)
ON CONFLICT DO NOTHING;
