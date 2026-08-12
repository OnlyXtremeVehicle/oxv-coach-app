-- =============================================================================
-- RGPD — UNE TABLE DE JOURNAUX SANS CLÉ UTILISATEUR NE SERA JAMAIS PURGÉE
-- =============================================================================
--
-- Suite directe de `20260812213000_rgpd_purge_tables_oubliees.sql`, et d'un
-- constat que la première correction a rendu visible.
--
-- -----------------------------------------------------------------------------
-- CE QUE LA PREMIÈRE CORRECTION NE POUVAIT PAS ATTEINDRE
-- -----------------------------------------------------------------------------
--
-- `purge_user_data` rattache désormais `resend_events` par l'ADRESSE contenue
-- dans `raw_payload->'data'->'to'`. Mesuré juste après application :
--
--   49 lignes au total
--   28 rattachables à un compte existant
--   **21 qui ne le sont pas**
--
-- Ces vingt et une lignes portent des adresses qui n'ont jamais eu de compte —
-- candidats fondateurs captés par le site, destinataires de test, personnes
-- ayant écrit sans s'inscrire. **Aucune purge PAR UTILISATEUR ne les atteindra
-- jamais**, par construction : il n'y a pas d'utilisateur à qui les rattacher.
--
-- C'est le défaut que la veille du 12/08 nomme précisément : une table de
-- journaux dépourvue de clé utilisateur échappe à toute purge individuelle, et
-- sa conservation illimitée est un manquement à la limitation de conservation
-- (article 5.1.e RGPD). La seule réponse possible est une DURÉE.
--
-- -----------------------------------------------------------------------------
-- SIX MOIS, ET POURQUOI CE NOMBRE
-- -----------------------------------------------------------------------------
--
-- La CNIL recommande, pour les journaux techniques, une durée comprise entre
-- six mois et un an (délibération n° 2021-122 du 14 octobre 2021). Six mois est
-- la borne basse de cette fourchette, et elle suffit à l'usage réel : un
-- journal de délivrabilité sert à comprendre pourquoi un courriel n'est pas
-- arrivé, ce qui se constate en jours, pas en trimestres. Une saison OXV
-- compte six journées ; six mois en couvrent largement le cycle.
--
-- Ce n'est pas une mesure, c'est un CHOIX — et il est écrit ici plutôt que
-- dissous dans une constante.
--
-- La table la plus ancienne date du 16/06/2026. **Au premier passage, aucune
-- ligne ne sera donc supprimée** : la borne des six mois tombe le 16/12/2026.
-- Le mécanisme est posé avant d'être utile, ce qui est le bon ordre.
--
-- -----------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION NE RÈGLE PAS
-- -----------------------------------------------------------------------------
--
-- Elle borne la conservation ; elle n'ouvre pas un chemin d'effacement à la
-- demande pour quelqu'un qui n'a jamais eu de compte. Ce chemin-là n'existe
-- toujours pas — ni pour `resend_events`, ni pour `founding_members`, dont
-- l'unique ligne porte un `user_id` nul et que la purge ne rattache donc à
-- personne.
--
-- **C'est un manquement en cours**, distinct de celui-ci, et il se règle par
-- une procédure documentée autant que par du code.
--
-- =============================================================================

create or replace function public.purge_old_resend_events()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  delete from public.resend_events
   where occurred_at < now() - interval '6 months';
$function$;

comment on function public.purge_old_resend_events() is
  'Limitation de conservation (art. 5.1.e) sur le journal du prestataire d''envoi : six mois, borne basse de la fourchette CNIL pour les journaux techniques. Nécessaire parce que la table n''a AUCUNE clé utilisateur — 21 de ses 49 lignes portent des adresses sans compte, qu''aucune purge individuelle n''atteindra jamais.';

-- Personne d'autre que le planificateur n'a à l'appeler.
revoke execute on function public.purge_old_resend_events() from public;
revoke execute on function public.purge_old_resend_events() from anon;
revoke execute on function public.purge_old_resend_events() from authenticated;
