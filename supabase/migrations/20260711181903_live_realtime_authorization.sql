-- Autorisation des canaux privés du direct coach (P5). Le consentement gate
-- l'AUDIENCE, pas seulement l'émission. Topics : live:session:<sessionId> (flux)
-- et live:roster:<coachId> (présence par-coach).

-- RECEVOIR le flux d'une séance : un coach du binôme ACTIF + consenti LIVE.
CREATE POLICY "live_session_recv" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (SELECT realtime.topic()) LIKE 'live:session:%'
    AND EXISTS (
      SELECT 1
      FROM public.telemetry_sessions ts
      JOIN public.coach_pilots cp ON cp.pilot_id = ts.user_id
      WHERE ts.id::text = split_part((SELECT realtime.topic()), ':', 3)
        AND cp.coach_id = (SELECT auth.uid())
        AND cp.active
        AND cp.live_sharing_at IS NOT NULL
    )
  );

-- ÉMETTRE le flux d'une séance : le PILOTE propriétaire de la séance.
CREATE POLICY "live_session_send" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT realtime.topic()) LIKE 'live:session:%'
    AND EXISTS (
      SELECT 1 FROM public.telemetry_sessions ts
      WHERE ts.id::text = split_part((SELECT realtime.topic()), ':', 3)
        AND ts.user_id = (SELECT auth.uid())
    )
  );

-- LIRE un roster : le coach lit UNIQUEMENT le sien (live:roster:<sonId>).
CREATE POLICY "live_roster_read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (SELECT realtime.topic()) LIKE 'live:roster:%'
    AND split_part((SELECT realtime.topic()), ':', 3) = (SELECT auth.uid())::text
  );

-- SE TRACKER dans un roster : le pilote, chez un coach à qui il a consenti le LIVE.
CREATE POLICY "live_roster_join" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT realtime.topic()) LIKE 'live:roster:%'
    AND EXISTS (
      SELECT 1 FROM public.coach_pilots cp
      WHERE cp.coach_id::text = split_part((SELECT realtime.topic()), ':', 3)
        AND cp.pilot_id = (SELECT auth.uid())
        AND cp.active
        AND cp.live_sharing_at IS NOT NULL
    )
  );
