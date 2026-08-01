-- =============================================================================
-- L27 — canal biométrie PAR COACH (jalon 6, lot 27a-bis)
--
-- APPLIQUÉE EN PRODUCTION le 01/08/2026 (version 20260801140838), sur accord
-- explicite du fondateur.
-- =============================================================================
--
-- CE QU'ELLE CORRIGE
--
-- La fréquence cardiaque voyageait sur `live:session:<id>`, canal PARTAGÉ par
-- tous les coachs consentis d'un pilote. Ce qui part sur ce canal part à tout le
-- monde : impossible de réserver un message à certains.
--
-- La seule position tenable était donc le TOUT OU RIEN — n'émettre que si CHAQUE
-- coach à l'écoute était au niveau détaillé. Elle protégeait, mais son prix
-- était absurde : un coach détaillé perdait le cardio parce qu'un confrère en
-- lecture simple s'était connecté.
--
-- Le code applicatif est passé à un canal par coach,
-- `live:bio:<coachId>:<sessionId>`. **Ces deux policies sont ce qui rend le
-- découpage réel.** Sans elles, le canal serait privé et sans autorisation :
-- personne ne lirait, et le cardio ne circulerait pas du tout.
--
-- ---------------------------------------------------------------------------
-- CE QUI CHANGE PAR RAPPORT À `live_session_recv`
--
-- La policy de séance exige du lecteur qu'il soit un coach actif du pilote, avec
-- le direct consenti. Celle-ci ajoute DEUX exigences :
--
--   1. **Être le coach nommé dans le topic.** Deviner le nom d'un canal n'est
--      pas difficile ; c'est cette ligne, et elle seule, qui empêche un coach de
--      lire le canal d'un confrère.
--   2. **Être au niveau détaillé.** Le verrou qui était appliqué à l'émission —
--      et de façon grossière — devient une règle du serveur, par destinataire.
--
-- Le niveau vit dans `coach_pilots.level` (enum `coach_access_level` :
-- `lecture_simple` · `lecture_detaillee` · `programme`). Seuls les deux derniers
-- ouvrent, comme dans le code (`liveRelayRunner`, `LiveCoach.detailed`).
--
-- ---------------------------------------------------------------------------
-- DÉCOUPAGE DU TOPIC
--
-- `live:bio:<coachId>:<sessionId>` → split_part(topic, ':', 3) = coachId,
-- split_part(topic, ':', 4) = sessionId. Même technique que les policies déjà
-- en place, qui lisent `split_part(topic, ':', 3)` sur `live:session:<id>`.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE PROPOSITION NE FAIT PAS
--
-- Elle ne touche AUCUNE table applicative, ne crée ni ne supprime de colonne,
-- n'écrit aucune donnée. Deux policies sur `realtime.messages`, rien d'autre.
-- Elle est réversible par les deux `drop policy` en tête.
--
-- Elle ne remplace pas non plus les verrous applicatifs : le consentement
-- biométrie du pilote et le flag serveur restent évalués à chaque tick côté
-- émission. Une policy autorise à lire un canal ; elle ne décide pas qu'il faut
-- émettre.
--
-- ---------------------------------------------------------------------------
-- CE QU'ELLE NE PROTÈGE PAS — À LIRE AVANT DE LA CROIRE SUFFISANTE
--
-- La branche coach s'appuie sur trois colonnes de `coach_pilots` : `active`,
-- `live_sharing_at`, `level`. **Un compte coach peut poser les trois lui-même**,
-- pour un pilote qu'il n'a jamais rencontré, en un seul INSERT.
--
-- La policy `coach_pilots_insert_by_coach` n'impose que
-- `coach_id = auth.uid() AND is_coach() AND initiated_by = 'coach'` — aucune
-- restriction de colonne. Le garde-fou SEC-3 qui interdit d'écrire ces colonnes
-- est un trigger `BEFORE UPDATE` **seulement** : il ne voit pas les insertions.
-- Vérifié en production le 01/08/2026.
--
-- Autrement dit : la condition « consenti au direct » n'est pas posée par le
-- pilote, elle est posée par celui-là même qu'elle est censée filtrer. Cette
-- proposition n'y change rien — le trou lui est antérieur, et il ouvre aussi
-- `is_detailed_coach_of` (télémétrie, analyses de segments), pas seulement la
-- biométrie. Il est traité à part, dans
-- `PROPOSITION_L28_coach_pilots_insert.sql`.
--
-- Deux verrous restent hors de portée d'un tel compte : les consentements
-- biométrie du pilote (`users.biometry_capture_consent_at`,
-- `biometry_coach_share_consent_at`) et le drapeau serveur `biometry`. Il ne
-- fabrique donc pas du cardio à partir de rien — mais ces deux verrous sont
-- GLOBAUX. Ils disent « je partage avec mes coachs », pas « avec celui-ci ».
-- =============================================================================

-- Idempotence : rejouable sans erreur si la proposition est reprise.
drop policy if exists live_bio_recv on realtime.messages;
drop policy if exists live_bio_send on realtime.messages;

-- LECTURE — le pilote propriétaire de la séance, OU le coach nommé dans le topic
-- au niveau détaillé.
--
-- POURQUOI LE PILOTE FIGURE DANS UNE POLICY DE *LECTURE*
--
-- Une première rédaction ne nommait que le coach. Elle aurait rendu la
-- fonctionnalité entièrement muette — la revue adversariale du 01/08 l'a
-- montré AVANT toute application : **Realtime exige une autorisation de LECTURE pour REJOINDRE un canal
-- privé**, y compris pour n'y écrire que des messages. Le serveur
-- (`realtime_channel.ex`, `maybe_assign_policies`) n'évalue que
-- `get_read_authorizations` au moment du join ; la policy d'INSERT n'est pas
-- consultée là.
--
-- Le pilote n'étant pas le coach nommé dans le topic, son `.subscribe()` aurait
-- échoué, `state.subscribed` serait resté faux, et `openBiometryBroadcast.sendTo`
-- aurait jeté chaque mesure — silencieusement, à 0,5 Hz, pour toujours.
--
-- La policy `board_recv` déjà en production porte exactement cette branche
-- (`ts.user_id = auth.uid() OR <branche coach>`). On suit le même motif.
--
-- Le pilote ne lit ainsi que SA propre biométrie, sur SES propres séances : la
-- condition `ts.user_id = auth.uid()` l'y enferme.
create policy live_bio_recv
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.topic()) like 'live:bio:%'
    and exists (
      select 1
      from public.telemetry_sessions ts
      where ts.id::text = split_part((select realtime.topic()), ':', 4)
        and (
          -- L'ÉMETTEUR : sans cette branche, rien ne part jamais.
          ts.user_id = (select auth.uid())
          or (
            -- Être CE coach : la ligne qui isole les confrères les uns des autres.
            split_part((select realtime.topic()), ':', 3) = (select auth.uid())::text
            and exists (
              select 1
              from public.coach_pilots cp
              where cp.pilot_id = ts.user_id
                and cp.coach_id = (select auth.uid())
                and cp.active
                and cp.live_sharing_at is not null
                -- Le niveau détaillé, exigé par le SERVEUR et par destinataire.
                and cp.level in ('lecture_detaillee', 'programme')
            )
          )
        )
    )
  );

-- ÉMISSION — le pilote propriétaire de la séance, vers n'importe lequel de ses
-- coachs. Le choix du destinataire est fait en amont (destinatairesBiometrie) ;
-- ici on vérifie seulement que l'émetteur est bien chez lui.
create policy live_bio_send
  on realtime.messages
  for insert
  to authenticated
  with check (
    (select realtime.topic()) like 'live:bio:%'
    and exists (
      select 1
      from public.telemetry_sessions ts
      where ts.id::text = split_part((select realtime.topic()), ':', 4)
        and ts.user_id = (select auth.uid())
    )
  );
