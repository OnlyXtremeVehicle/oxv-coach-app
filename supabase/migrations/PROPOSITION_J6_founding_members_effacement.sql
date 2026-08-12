-- =============================================================================
-- PROPOSITION — L'EFFACEMENT RGPD D'UN MEMBRE FONDATEUR LÈVERAIT UNE ERREUR
-- =============================================================================
--
-- NON HORODATÉE VOLONTAIREMENT : `supabase db push` ignore ce fichier. Il
-- attend une décision. Renommez-le avec un horodatage pour l'appliquer.
--
-- Découvert le 12/08/2026, en cartographiant le jalon 6.
--
-- -----------------------------------------------------------------------------
-- LE DÉFAUT
-- -----------------------------------------------------------------------------
--
-- `purge_user_data` porte, en production, ce bras d'anonymisation (D-27) :
--
--     update public.founding_members
--        set prenom = null, nom = null, email = null, user_id = null
--      where user_id = $1
--
-- Or les trois colonnes sont NOT NULL depuis leur création
-- (20260721060455_founding_members.sql, lignes 13, 15, 18), et cette contrainte
-- n'a jamais été relâchée. Vérifié en production :
-- `information_schema.columns` rend `is_nullable = 'NO'` pour prenom, nom et
-- email.
--
-- L'UPDATE lèverait donc 23502 (not_null_violation), et la purge ENTIÈRE
-- échouerait — pas seulement ce bras : la fonction n'a pas de bloc d'exception
-- autour de lui.
--
-- -----------------------------------------------------------------------------
-- POURQUOI PERSONNE NE S'EN EST APERÇU, ET POURQUOI C'EST MAINTENANT QUE ÇA
-- COMPTE
-- -----------------------------------------------------------------------------
--
-- **Le défaut ne se déclenche pas aujourd'hui.** Le garde `where user_id = $1`
-- ne correspond à aucune ligne : `founding_members` compte une seule ligne, et
-- son `user_id` est NULL. Zéro ligne touchée, zéro erreur levée.
--
-- Il se déclenchera au PREMIER rattachement d'une candidature à un compte —
-- c'est-à-dire exactement ce que la phase 5bis du jalon 6 demande de
-- construire : *« `user_id` sur `founding_members` · propagation au
-- rattachement »*.
--
-- Autrement dit : **livrer la phase 5bis sans ce correctif, c'est armer une
-- purge RGPD qui échoue.** Un pilote exerçant son droit à l'effacement
-- recevrait une erreur, et ses données resteraient en place.
--
-- C'est le même motif que D-24 (« avant tout drop, balayer
-- `pg_get_functiondef` ») pris par l'autre bout : ici ce n'est pas une table
-- disparue qui casse une fonction, c'est une contrainte qui interdit ce que la
-- fonction promet.
--
-- -----------------------------------------------------------------------------
-- CE QUI EST PROPOSÉ, ET CE QUI NE L'EST PAS
-- -----------------------------------------------------------------------------
--
-- Relâcher NOT NULL sur les trois colonnes d'identité. C'est le minimum : la
-- ligne reste, c'est l'identité qui disparaît — la trace de gestion est
-- conservée, conformément à D-27.
--
-- CE N'EST PAS UNE DDL ADDITIVE. Elle modifie une contrainte existante, et
-- c'est pourquoi elle est soumise plutôt qu'appliquée.
--
-- Effet secondaire à assumer, et il est réel : une candidature pourra désormais
-- être insérée sans nom ni courriel. La captation vient du site (service_role
-- seul, aucune policy sur cette table) ; si vous voulez garder la contrainte à
-- l'insertion, la variante commentée en bas la rétablit par un CHECK qui ne
-- s'applique qu'aux lignes encore rattachées.
--
-- =============================================================================

alter table public.founding_members alter column prenom drop not null;
alter table public.founding_members alter column nom drop not null;
alter table public.founding_members alter column email drop not null;

comment on column public.founding_members.prenom is
  'Nullable depuis le 12/08/2026 : purge_user_data l''annule à l''effacement (D-27). NOT NULL faisait échouer la purge entière avec 23502.';
comment on column public.founding_members.nom is
  'Nullable depuis le 12/08/2026 — voir prenom.';
comment on column public.founding_members.email is
  'Nullable depuis le 12/08/2026 — voir prenom.';

-- -----------------------------------------------------------------------------
-- VARIANTE, si vous voulez garder l'exigence à l'insertion
-- -----------------------------------------------------------------------------
--
-- Une candidature VIVANTE (non anonymisée) doit porter son identité ; une
-- candidature anonymisée n'a plus ni identité ni `user_id`. Le CHECK dit
-- exactement cela, et laisse passer l'UPDATE de la purge.
--
-- alter table public.founding_members add constraint founding_members_identite_ou_anonyme
--   check (
--     (prenom is not null and nom is not null and email is not null)
--     or (prenom is null and nom is null and email is null and user_id is null)
--   );

-- -----------------------------------------------------------------------------
-- APRÈS APPLICATION — la vérification qui compte
-- -----------------------------------------------------------------------------
--
-- Ne vous fiez pas au fait que la migration passe : elle passera de toute
-- façon. Ce qu'il faut éprouver, c'est la purge sur une ligne RATTACHÉE.
--
--   begin;
--     insert into public.founding_members (prenom, nom, email, user_id)
--     values ('Essai', 'Effacement', 'essai@example.invalid', '<un uuid users>');
--     select public.purge_user_data('<le même uuid>');
--     select prenom, nom, email, user_id from public.founding_members
--      where email is null;   -- doit rendre la ligne, anonymisée
--   rollback;
--
-- Sans le `rollback`, cette vérification EFFACE des données réelles : la purge
-- ne se limite pas à `founding_members`.
