-- ============================================================================
-- L-21j : le fuseau horaire du pilote
-- ============================================================================
--
-- APPLIQUÉE EN PRODUCTION le 29/07/2026, sur accord du fondateur.
--
-- Le report nocturne 22 h – 8 h se décide côté SERVEUR, au moment de l envoi,
-- où l appareil du pilote n est pas joignable. Sans le fuseau en base, le
-- serveur ne peut que supposer — et supposer Paris pour tout le monde
-- réveillerait à trois heures du matin qui roule ailleurs.
--
-- Ce n est PAS une donnée de localisation : un fuseau ne dit ni la ville, ni la
-- position, ni le déplacement. Il n entre dans aucune analyse de pilotage.
-- ============================================================================

alter table public.users
  add column if not exists timezone text;

comment on column public.users.timezone is
  'Fuseau IANA du pilote (« Europe/Paris »), renseigné par l''appareil. SEUL usage : décaler l''envoi nocturne 22 h – 8 h côté serveur. Ce n''est pas une donnée de localisation et elle n''entre dans aucune analyse. NULL = inconnu → le serveur diffère par défaut, il n''envoie pas au hasard.';

-- Un fuseau IANA porte une barre oblique et pas d espace. La contrainte écarte
-- la faute de saisie, pas un fuseau exotique : la liste complète évolue, la
-- figer ici la périmerait.
alter table public.users
  drop constraint if exists users_timezone_forme;
alter table public.users
  add constraint users_timezone_forme
  check (timezone is null or timezone ~ '^[A-Za-z_]+/[A-Za-z0-9_+/-]+$');
