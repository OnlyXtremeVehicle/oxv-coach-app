-- =============================================================================
-- RGPD — MINIMISER À LA SOURCE PLUTÔT QUE PURGER EN AVAL
-- =============================================================================
--
-- Troisième et dernier temps du dossier `resend_events`, ouvert le 12/08/2026.
--
-- -----------------------------------------------------------------------------
-- POURQUOI LES DEUX PREMIERS CORRECTIFS NE SUFFISAIENT PAS
-- -----------------------------------------------------------------------------
--
-- 1. `purge_user_data` rattache désormais ces lignes par l'ADRESSE contenue
--    dans la charge — 28 lignes sur 49 s'y rattachent.
-- 2. `purge_old_resend_events()` les borne à six mois.
--
-- Restaient **21 lignes portant des adresses qui n'ont jamais eu de compte** :
-- candidats fondateurs captés par le site, destinataires de test. Aucune purge
-- par utilisateur ne peut les atteindre, par construction — il n'y a personne à
-- qui les rattacher. Et la borne des six mois les gardait jusqu'en décembre.
--
-- -----------------------------------------------------------------------------
-- LA VRAIE QUESTION N'ÉTAIT PAS « QUAND EFFACER »
-- -----------------------------------------------------------------------------
--
-- **Rien ne relit `raw_payload`.** Vérifié : aucune lecture dans
-- `supabase/functions/`, aucune dans `src/`, et l'événement est appliqué par
-- `apply_resend_event` à partir de paramètres séparés. La colonne était une
-- archive brute sans lecteur.
--
-- Une donnée que personne ne lit et qui porte onze adresses en clair n'a pas de
-- raison d'être écrite. C'est l'article 5.1.c — minimisation — et il se règle
-- en amont, pas par une purge mieux réglée.
--
-- Le webhook cesse donc d'écrire la charge brute
-- (`supabase/functions/resend_webhook/index.ts`) : il n'écrit plus que le
-- diagnostic de rebond. **Cette fonction serveur doit être redéployée** pour
-- que le correctif prenne effet sur les événements à venir.
--
-- La présente migration traite les 49 lignes déjà écrites.
--
-- -----------------------------------------------------------------------------
-- CE QU'ON GARDE, ET POURQUOI
-- -----------------------------------------------------------------------------
--
-- Le type et la description du rebond — seule information non identifiante de
-- la charge, et la seule qui serve à comprendre pourquoi un courriel n'est pas
-- arrivé. Six lignes en portent.
--
-- `event_type`, `resend_email_id` et `occurred_at` vivent en colonnes propres
-- et ne sont pas touchés : ils suffisent à compter et à recouper.
-- `resend_email_id` est l'identifiant technique de Resend, pas une adresse.
--
-- -----------------------------------------------------------------------------
-- APPLIQUÉE ET VÉRIFIÉE LE 12/08/2026
-- -----------------------------------------------------------------------------
--
--   49 lignes au total
--   49 minimisées
--   **0 ligne contenant encore un caractère « @ »**
--   6 diagnostics de rebond conservés
--
-- =============================================================================

update public.resend_events
   set raw_payload = jsonb_strip_nulls(jsonb_build_object(
         'minimise', true,
         'bounce_type', raw_payload->'data'->'bounce'->>'type',
         'bounce_description', raw_payload->'data'->'bounce'->>'description'
       ))
 where not (raw_payload ? 'minimise');

comment on column public.resend_events.raw_payload is
  'Diagnostic de délivrance UNIQUEMENT. La charge brute du webhook portait le destinataire, le sujet et les en-têtes ; elle n''était lue par personne. Minimisée le 12/08/2026 (art. 5.1.c), et le webhook ne l''écrit plus.';
