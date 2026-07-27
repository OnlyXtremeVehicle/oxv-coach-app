-- ============================================================================
-- PROPOSITION — T2 : colonne ThumbHash sur les médias
-- ============================================================================
--
-- ⚠️  NON APPLIQUÉE. Nommée `PROPOSITION_` et non horodatée : elle n'est PAS
--     ramassée par `supabase db push`. Modifier le schéma de production demande
--     l'accord du fondateur (CLAUDE.md). À renommer en
--     `<timestamp>_t2_thumbhash.sql` le jour où c'est décidé.
--
-- ----------------------------------------------------------------------------
-- CE QU'ELLE FAIT
-- ----------------------------------------------------------------------------
--
-- Une colonne `thumbhash text` nullable par table de médias. Le ThumbHash tient
-- en une vingtaine d'octets, soit une trentaine de caractères en base64 : le
-- stocker en `text` coûte moins qu'une jointure, et il est lu à chaque affichage
-- de vignette.
--
-- `null` est l'ÉTAT NORMAL tant que la génération n'existe pas. L'affichage
-- retombe alors sur l'aplat titane, ce qui reste correct. Aucune valeur par
-- défaut n'est posée : un ThumbHash fabriqué serait un aperçu qui ne ressemble
-- à rien.
--
-- Purement additive : aucune colonne existante n'est touchée, aucune donnée
-- n'est réécrite, et le retour arrière est un simple DROP COLUMN.

ALTER TABLE public.session_media
  ADD COLUMN IF NOT EXISTS thumbhash text;

COMMENT ON COLUMN public.session_media.thumbhash IS
  'ThumbHash base64 du média (lot T2). NULL = pas encore généré : l''affichage retombe sur l''aplat titane. Jamais de valeur fabriquée.';

-- ----------------------------------------------------------------------------
-- LES AUTRES TABLES DE MÉDIAS — à confirmer avant d'appliquer
-- ----------------------------------------------------------------------------
--
-- Le dépôt porte aussi des médias de profil pilote et coach. Les lignes
-- ci-dessous sont COMMENTÉES : je n'ai pas vérifié que ces tables portent bien
-- leurs images plutôt qu'un simple chemin de stockage, et ajouter une colonne
-- sur une table qui n'en a pas l'usage est une dette, pas une avance.
--
-- ALTER TABLE public.pilot_media ADD COLUMN IF NOT EXISTS thumbhash text;
-- ALTER TABLE public.coach_media ADD COLUMN IF NOT EXISTS thumbhash text;

-- ----------------------------------------------------------------------------
-- RATTRAPAGE DE L'EXISTANT
-- ----------------------------------------------------------------------------
--
-- Les médias DÉJÀ déposés n'auront pas de ThumbHash. Aucun SQL ne peut le
-- calculer : il faut lire le fichier, ce que seul un traitement serveur fait.
-- Voir `docs/T2_THUMBHASH.md`, chemin A.
--
-- Le compte des lignes concernées, pour dimensionner ce rattrapage :
--
--   SELECT count(*) FROM public.session_media WHERE thumbhash IS NULL;
