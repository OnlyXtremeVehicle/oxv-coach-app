-- ============================================================================
-- OXV App — Module A v0.2 : Suppression données médicales (RGPD)
-- À exécuter dans Supabase SQL Editor APRÈS la migration 0001
-- Date : 16 mai 2026
-- ============================================================================
--
-- CONTEXTE LÉGAL :
-- Les données de santé sont des "catégories particulières" (Article 9 RGPD).
-- Leur traitement nécessite :
--   1. Consentement explicite ET séparé du consentement général
--   2. Hébergeur HDS (Hébergement de Données de Santé) certifié
--   3. DPO et registre des traitements
--
-- Supabase Frankfurt n'est PAS HDS certifié.
-- → Ces données seront collectées le jour J en piste sur fiche papier
--   remise au médecin / ambulancier présent.
-- ============================================================================

-- Supprimer la colonne blood_type
ALTER TABLE users DROP COLUMN IF EXISTS blood_type;

-- Supprimer la colonne medical_notes
ALTER TABLE users DROP COLUMN IF EXISTS medical_notes;

-- ============================================================================
-- Vérification (optionnel)
-- ============================================================================

-- Pour vérifier que les colonnes sont bien supprimées :
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Vous ne devez plus voir 'blood_type' ni 'medical_notes' dans le résultat.
