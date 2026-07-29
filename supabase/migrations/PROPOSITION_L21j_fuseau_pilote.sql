-- ============================================================================
-- PROPOSITION — L-21j : le fuseau horaire du pilote
-- ============================================================================
--
-- ⚠️  NON APPLIQUÉE. Nommée `PROPOSITION_` et non horodatée : elle n'est PAS
--     ramassée par `supabase db push`. Modifier le schéma de production demande
--     l'accord du fondateur (CLAUDE.md).
--
-- ----------------------------------------------------------------------------
-- POURQUOI LE SERVEUR EN A BESOIN
-- ----------------------------------------------------------------------------
--
-- Le plan de montage, phase 4ter : *« Le fuseau du pilote doit être stocké — le
-- report nocturne 22 h – 8 h se calcule côté serveur. Il diffère, il n'annule
-- pas : un bilan prêt à 23h40 se pousse le lendemain. »*
--
-- La règle est simple et l'implication l'est moins : le report se décide au
-- moment de l'envoi, dans une fonction serveur, où l'appareil du pilote n'est
-- pas joignable. Sans le fuseau en base, le serveur ne peut que supposer — et
-- supposer Paris pour tout le monde enverrait une notification à 3 h du matin à
-- un pilote qui roule ailleurs.
--
-- Vérifié : `users` ne porte aucune colonne `timezone` aujourd'hui.
--
-- ----------------------------------------------------------------------------
-- CE QUE CETTE COLONNE N'EST PAS
-- ----------------------------------------------------------------------------
--
-- Ce n'est pas une donnée de localisation. Un fuseau ne dit ni la ville, ni la
-- position, ni le déplacement : il dit un décalage. Il est renseigné par
-- l'appareil au moment de la connexion, et se corrige tout seul au voyage.
--
-- Il n'entre dans AUCUNE analyse de pilotage. Sa seule lecture est l'heure
-- d'envoi d'une notification.
--
-- ----------------------------------------------------------------------------

begin;

alter table public.users
  add column if not exists timezone text;

comment on column public.users.timezone is
  'Fuseau IANA du pilote (« Europe/Paris »), renseigné par l''appareil. '
  'SEUL usage : décaler l''envoi nocturne 22 h – 8 h côté serveur. '
  'Ce n''est pas une donnée de localisation et elle n''entre dans aucune analyse. '
  'NULL = inconnu → le serveur diffère par défaut, il n''envoie pas au hasard.';

-- Un fuseau IANA porte toujours une barre oblique et pas d'espace. La
-- contrainte écarte la faute de saisie, pas un fuseau exotique : la liste
-- complète évolue, la figer dans une contrainte la périmerait.
alter table public.users
  drop constraint if exists users_timezone_forme;
alter table public.users
  add constraint users_timezone_forme
  check (timezone is null or timezone ~ '^[A-Za-z_]+/[A-Za-z0-9_+/-]+$');

commit;

-- ----------------------------------------------------------------------------
-- CE QUI RESTE À FAIRE CÔTÉ APPLICATION
-- ----------------------------------------------------------------------------
--
--   1. Écrire le fuseau à la connexion, depuis `Intl.DateTimeFormat().
--      resolvedOptions().timeZone`. Une écriture, pas une demande de permission.
--   2. Le répartiteur de rituels lit la colonne et diffère plutôt qu'il n'annule.
--   3. NULL doit faire DIFFÉRER, jamais envoyer : un fuseau inconnu ne justifie
--      pas de réveiller quelqu'un.
