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
-- VÉRIFIÉ AVANT D'ÉCRIRE — une seule table est concernée
-- ----------------------------------------------------------------------------
--
-- Une première rédaction laissait `pilot_media` et `coach_media` en commentaire,
-- faute de vérification. Vérification faite : CES TABLES N'EXISTENT PAS.
-- `database.types.ts` ne déclare que `session_media` et `media_exports`, et les
-- médias de PROFIL vivent en colonnes — `pilotMediaService` écrit sur `users`,
-- `coachMediaService` sur `coach_profiles`.
--
-- Les lignes commentées ont donc été RETIRÉES plutôt que laissées : un
-- commentaire qui désigne une table inexistante n'est pas une précaution, c'est
-- une fausse piste pour qui reprendra ce fichier.
--
-- ----------------------------------------------------------------------------
-- POURQUOI LES AVATARS N'EN SONT PAS
-- ----------------------------------------------------------------------------
--
-- Un avatar est petit et mis en cache dès son premier affichage : le gain d'un
-- ThumbHash y est marginal. `session_media` porte au contraire des photos pleine
-- largeur, affichées en galerie, souvent sur un réseau de paddock lent. C'est là
-- que l'aperçu compte.
--
-- Ce n'est pas un oubli mais un arbitrage, et il est réversible : la même
-- colonne s'ajouterait à `users` et `coach_profiles` le jour où le besoin
-- apparaît.
--
-- ----------------------------------------------------------------------------
-- CE QUE FAIT CETTE MIGRATION
-- ----------------------------------------------------------------------------
--
-- Une colonne `thumbhash text` nullable. Le hash tient en une vingtaine
-- d'octets, soit une trentaine de caractères en base64 : le stocker en `text`
-- coûte moins qu'une jointure, et il est lu à chaque affichage de vignette.
--
-- `null` est l'ÉTAT NORMAL tant que la génération n'a pas tourné. L'affichage
-- retombe alors sur l'aplat titane, ce qui reste correct. Aucune valeur par
-- défaut : un ThumbHash fabriqué serait un aperçu qui ne ressemble à rien.
--
-- Purement additive. Retour arrière : `ALTER TABLE … DROP COLUMN thumbhash`.

ALTER TABLE public.session_media
  ADD COLUMN IF NOT EXISTS thumbhash text;

COMMENT ON COLUMN public.session_media.thumbhash IS
  'ThumbHash base64 du média (lot T2). NULL = pas encore généré : l''affichage retombe sur l''aplat titane. Jamais de valeur fabriquée.';

-- Index partiel sur les lignes SANS hash : c'est la file de travail de la
-- fonction de rattrapage, et elle se vide au fur et à mesure. Un index sur la
-- colonne entière serait inutile — personne ne cherche un média PAR son hash.
CREATE INDEX IF NOT EXISTS idx_session_media_thumbhash_manquant
  ON public.session_media (uploaded_at)
  WHERE thumbhash IS NULL AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- RATTRAPAGE DE L'EXISTANT
-- ----------------------------------------------------------------------------
--
-- Aucun SQL ne peut calculer ces hashs : il faut LIRE le fichier, ce que seul un
-- traitement serveur fait. La fonction est écrite —
-- `supabase/functions/generate-thumbhash/` — et traite par lots les lignes que
-- l'index ci-dessus désigne.
--
-- Dimensionner le rattrapage avant de le lancer :
--
--   SELECT count(*) FROM public.session_media
--   WHERE thumbhash IS NULL AND deleted_at IS NULL AND media_type = 'photo';
