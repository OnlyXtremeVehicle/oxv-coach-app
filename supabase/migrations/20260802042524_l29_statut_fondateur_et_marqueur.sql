-- =============================================================================
-- L29 — LE STATUT FONDATEUR + LE MARQUEUR RÉSOLU (jalon 6, phases 5 et 5bis)
--
-- APPLIQUÉE EN PRODUCTION le 02/08/2026 (version 20260802042524), sur accord
-- explicite du fondateur.
--
-- LE FICHIER DE RÉFÉRENCE EST CELUI DE LA BASE. Ce document conserve le
-- raisonnement ; la version exécutée porte en plus le marqueur (partie 2) et le
-- bras de purge complet (partie 3), écrits après les décisions du fondateur.
-- =============================================================================
--
-- CE QUE LE PLAN DEMANDE
--
-- *« `users.founder_since` · `founder_number` par SÉQUENCE DÉDIÉE · `user_id` sur
-- `founding_members` · propagation au rattachement. »*
--
-- ---------------------------------------------------------------------------
-- L'ÉTAT RÉEL, MESURÉ LE 01/08/2026
--
--   users.founder_since        ABSENTE
--   users.founder_number       ABSENTE
--   séquence dédiée            AUCUNE
--   founding_members.user_id   ABSENTE
--   founding_members           1 ligne · colonnes personnelles : prenom, nom, email
--   founder_applications       0 ligne
--
-- Rien n'existe. La phase est entièrement à poser.
--
-- ---------------------------------------------------------------------------
-- CE QUI N'EST PAS UNE EXPOSITION, ET QU'IL FAUT SAVOIR
--
-- `founding_members` a la RLS ACTIVE et **zéro policy**. Un compte connecté ou
-- anonyme n'y lit donc rien : la table est fermée par défaut, malgré les GRANT
-- présents. Seul `service_role` y accède — ce qui est exactement ce dont l'edge
-- function `capture-membre-fondateur` a besoin.
--
-- **C'est le bon état. Ne pas y ajouter de policy sans raison.**
--
-- ---------------------------------------------------------------------------
-- CE QUI EST UN VRAI TROU, ET QUE CETTE PROPOSITION FERME
--
-- `founding_members` porte `prenom`, `nom`, `email` — des données personnelles —
-- et **n'est PAS dans `purge_user_data`**. Elle ne peut pas y être : sans
-- `user_id`, rien ne relie une ligne à un compte.
--
-- Conséquence : un membre fondateur qui crée un compte puis exerce son droit à
-- l'effacement voit son compte anonymisé, et son nom rester ici.
--
-- Poser `user_id` sert donc deux choses d'un coup : la propagation du statut, et
-- l'effacement. La seconde justifie à elle seule la colonne.
--
-- ---------------------------------------------------------------------------
-- POURQUOI UNE SÉQUENCE DÉDIÉE, ET PAS UN COMPTAGE
--
-- Le numéro de fondateur est un RANG D'ARRIVÉE, pas une place dans un
-- classement : il dit quand on est entré, jamais qui vaut mieux. La doctrine
-- interdit les classements entre pilotes ; elle n'interdit pas de dater une
-- entrée.
--
-- `count(*) + 1` serait faux dès la première suppression : deux fondateurs
-- porteraient le même numéro. Une séquence ne recule pas — un numéro attribué ne
-- se réattribue jamais, même si le compte disparaît. C'est ce qu'on veut d'un
-- rang d'arrivée.
--
-- ---------------------------------------------------------------------------
-- LE RATTACHEMENT — TRANCHÉ : UN GESTE EXPLICITE D'ADMINISTRATEUR
--
-- Le plan disait « propagation au rattachement » sans dire par quoi on rattache.
-- Le seul point commun entre `founding_members` et `users` est l'**e-mail** —
-- une identification faible : une adresse change, se partage, se réutilise.
--
-- **Décision du fondateur, 02/08/2026 : aucune déduction.** Un administrateur
-- relie la candidature au compte. Attribuer un statut de fondateur par
-- déduction le donnerait à qui contrôle la boîte aux lettres, et le coût du
-- geste est nul — il restera juste quand ils seront cinquante.
-- =============================================================================

-- --- 1. La séquence — un rang d'arrivée, jamais réattribué -------------------

create sequence if not exists public.founder_number_seq as integer start with 1;

comment on sequence public.founder_number_seq is
  'Rang d''arrivée des membres fondateurs. Une séquence ne recule pas : un '
  'numéro attribué ne se réattribue jamais, même si le compte disparaît. '
  'count(*) + 1 donnerait deux fois le même numéro après une suppression.';

-- --- 2. Les deux colonnes sur users ------------------------------------------

alter table public.users
  add column if not exists founder_since timestamptz,
  add column if not exists founder_number integer;

comment on column public.users.founder_since is
  'Date à laquelle ce compte a été reconnu membre fondateur. NULL = ne l''est '
  'pas. Distincte de founding_members.created_at, qui date la CANDIDATURE.';

comment on column public.users.founder_number is
  'Rang d''arrivée, issu de founder_number_seq. C''est une DATE D''ENTRÉE mise '
  'en nombre, jamais une place dans un classement : la doctrine interdit de '
  'hiérarchiser les pilotes, elle n''interdit pas de dire qui est arrivé quand.';

-- Un numéro ne se partage pas. L''index partiel laisse les NULL tranquilles.
create unique index if not exists users_founder_number_unique
  on public.users (founder_number)
  where founder_number is not null;

-- --- 3. Le lien vers le compte ------------------------------------------------

alter table public.founding_members
  add column if not exists user_id uuid references public.users(id) on delete set null;

comment on column public.founding_members.user_id is
  'Compte rattaché à cette candidature, s''il existe. NULL tant que personne '
  'n''a relié les deux. Sert à la propagation du statut ET à l''effacement : '
  'sans ce lien, prenom/nom/email survivaient à la suppression du compte.';

create index if not exists founding_members_user_idx
  on public.founding_members (user_id)
  where user_id is not null;

-- --- 4. L'effacement, enfin possible -----------------------------------------
--
-- ATTENTION AU MOMENT : `purge_user_data` est une fonction de production dont la
-- dernière version vit dans `20260801150110_l10_...`. La modifier ici en aveugle
-- écraserait ce qui s'y trouve. Le bras à ajouter est celui-ci, à insérer dans
-- la version COURANTE de la fonction, relue au moment d'appliquer :
--
--   if to_regclass('public.founding_members') is not null then
--     execute 'update public.founding_members
--                 set prenom = null, nom = null, email = null, user_id = null
--               where user_id = $1'
--       using p_user;
--   end if;
--
-- On ANONYMISE plutôt que de supprimer : la candidature elle-même est une trace
-- de gestion (une demande de signature Yousign a pu être facturée sur elle). Ce
-- qui doit disparaître est l'identité, pas l'existence de la ligne.
--
-- Le garde `to_regclass` suit la règle apprise le 01/08 : une fonction ne doit
-- pas tomber parce qu'une table a disparu (cf. D-24, l'incident `duels`).

-- =============================================================================
-- PARTIE 2 — LE MARQUEUR RÉSOLU
--
-- AJOUTÉE AU FICHIER LE 02/08/2026, après qu'une revue adversariale a constaté
-- que ce fichier NE CONTENAIT PAS ce qui avait été appliqué. La proposition
-- d'origine ne portait que le statut fondateur ; les parties 2 et 3 ont été
-- écrites dans l'appel de migration et jamais reportées ici.
--
-- Conséquence de l'écart : quiconque aurait reconstruit la base depuis les
-- fichiers aurait obtenu un schéma DIFFÉRENT de la production. Le fichier doit
-- dire ce qui a tourné, toujours.
--
-- « L'application ne stocke pas un horodatage, elle le résout. » On stocke ce
-- que le GESTE produit : l'instant, et la position quand elle est connue.
-- =============================================================================

alter table public.coach_annotations
  add column if not exists marker_elapsed_ms integer,
  add column if not exists marker_lat numeric,
  add column if not exists marker_lon numeric;

comment on column public.coach_annotations.marker_elapsed_ms is
  'Instant du marqueur, en ms depuis le début de la capture. Ce que le geste produit. Le tour, le virage, la vitesse et le freinage s''en déduisent à la lecture.';

comment on column public.coach_annotations.marker_lat is
  'Latitude du pilote AU MOMENT du marqueur. Mesure directe, indépendante de toute géométrie de circuit : lisible même sans corde de référence.';

comment on column public.coach_annotations.marker_lon is
  'Longitude du pilote au moment du marqueur. Voir marker_lat.';

-- =============================================================================
-- PARTIE 3 — L'EFFACEMENT DES CANDIDATURES FONDATEUR (D-27)
--
-- Le corps complet de `purge_user_data` tel qu'appliqué vit dans la base. Il
-- reprend celui de `20260801150110_l10_...` avec DEUX ajouts : le bras
-- `founding_members` (anonymisation, pas suppression — la candidature est une
-- trace de gestion) et la remise à zéro des colonnes fondateur sur `users`.
--
-- Il n'est pas recopié ici pour ne pas entretenir deux versions divergentes du
-- même corps : la source de vérité est la base, et la commande qui la lit est
--
--   select pg_get_functiondef(oid) from pg_proc
--    where proname = 'purge_user_data' and pronamespace = 'public'::regnamespace;
--
-- Ce que le bras fait, en une ligne :
--   update founding_members set prenom = null, nom = null, email = null,
--          user_id = null where user_id = p_user;   -- gardé par to_regclass
-- =============================================================================
