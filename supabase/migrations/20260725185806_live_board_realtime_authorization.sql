-- Autorisation du canal PUBLIC-ish du direct (lot LIVE-B) : le « tableau de
-- marche » affiché sur l'écran TV du paddock. Topic : live:board:<sessionId>.
--
-- POURQUOI un canal distinct des canaux coach (live:session: / live:roster:) :
-- l'AUDIENCE n'est pas la même. Le canal coach porte, sous triple verrou et
-- consentement explicite, la biométrie vers le SEUL coach du binôme. Le canal
-- board alimente un écran que tout le paddock regarde.
--
-- INTERDIT DÉFINITIF : aucune donnée de santé (fréquence cardiaque, variabilité,
-- contact capteur, ou quoi que ce soit d'assimilable — article 9 RGPD) ne
-- transite sur ce canal. Le SQL ne peut pas inspecter le corps d'un message
-- realtime : la barrière est APPLICATIVE et se situe à l'émission —
-- src/services/v2/liveHealthGate.ts, stripHealth() applique une liste blanche
-- stricte, et le payload board est sa sortie EXCLUSIVE. Les policies ci-dessous
-- bornent QUI émet et QUI écoute ; elles ne remplacent pas cette barrière, elles
-- la complètent.
--
-- Doctrine : le tableau de marche est ordonné par NUMÉRO DE VOITURE, jamais par
-- chrono, sans rang ni tri de performance (un classement compétitif peut
-- requalifier juridiquement un track day en compétition). Cette règle vit côté
-- rendu ; le canal ne transporte aucun ordre.
--
-- Schéma constant : ce fichier ne crée ni table ni colonne.

-- ----------------------------------------------------------------------------
-- RECEVOIR le tableau de marche.
--
-- LIMITE ASSUMÉE — l'ouverture « tout inscrit de la journée » N'EST PAS écrite
-- ici, faute de lien fiable en base, et cela demande une DÉCISION DE SCHÉMA.
-- Le cahier LIVE-B veut que les inscrits de la journée puissent lire le board.
-- Or une séance de télémétrie (public.telemetry_sessions) ne porte AUCUNE
-- référence vers la journée de roulage (public.sessions) à laquelle on
-- s'inscrit (public.registrations.session_id) : à la création d'une capture,
-- seuls user_id / circuit_id / started_at sont renseignés, et event_id (table
-- héritée public.events, avec ses propres event_registrations) reste nul.
-- Rapprocher les deux par circuit + date serait une DEVINETTE : on n'écrit pas
-- une règle d'accès sur une devinette, et un circuit_id nul ferait s'ouvrir la
-- règle en grand. La brique côté journée existe déjà —
-- public.is_registered_for_session(uuid), SECURITY DEFINER, utilisée par les
-- convois et « Qui roule » ; il ne manque que le chaînon séance → journée (par
-- exemple une colonne telemetry_sessions.day_session_id vers public.sessions).
--
-- En attendant cette décision, fail-closed : l'audience la plus étroite qui soit
-- défendable — le pilote propriétaire de la séance, et les coachs de son binôme
-- ACTIF ayant reçu le consentement LIVE (même porte que live_session_recv).
--
-- SUITE (hors périmètre de cette migration) : le téléviseur du paddock, en tant
-- que device board dédié (compte de service, token propre), n'est pas traité
-- ici. Il lui faudra son propre chemin d'autorisation, à écrire le jour où ce
-- compte de service existe.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "board_recv" ON realtime.messages;
CREATE POLICY "board_recv" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (SELECT realtime.topic()) LIKE 'live:board:%'
    AND EXISTS (
      SELECT 1
      FROM public.telemetry_sessions ts
      WHERE ts.id::text = split_part((SELECT realtime.topic()), ':', 3)
        AND (
          ts.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.coach_pilots cp
            WHERE cp.pilot_id = ts.user_id
              AND cp.coach_id = (SELECT auth.uid())
              AND cp.active
              AND cp.live_sharing_at IS NOT NULL
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- ÉMETTRE sur le tableau de marche : le PILOTE propriétaire de la séance en
-- cours de capture, et lui seul — identique à live_session_send. Personne ne
-- peut publier des tours au nom d'un autre pilote sur un écran public.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "board_send" ON realtime.messages;
CREATE POLICY "board_send" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT realtime.topic()) LIKE 'live:board:%'
    AND EXISTS (
      SELECT 1 FROM public.telemetry_sessions ts
      WHERE ts.id::text = split_part((SELECT realtime.topic()), ':', 3)
        AND ts.user_id = (SELECT auth.uid())
    )
  );
