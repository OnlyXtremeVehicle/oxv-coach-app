CREATE TABLE IF NOT EXISTS public.coach_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_pilot_id uuid NOT NULL REFERENCES public.coach_pilots(id) ON DELETE CASCADE,
  coach_id       uuid NOT NULL REFERENCES public.users(id),
  pilot_id       uuid NOT NULL REFERENCES public.users(id),
  sender_id      uuid NOT NULL REFERENCES public.users(id),
  body           text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  session_id     uuid NULL REFERENCES public.telemetry_sessions(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  read_at        timestamptz NULL
);

CREATE INDEX IF NOT EXISTS coach_messages_pair_idx
  ON public.coach_messages (coach_pilot_id, created_at DESC);

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_messages_select ON public.coach_messages
  FOR SELECT USING (auth.uid() = coach_id OR auth.uid() = pilot_id);

CREATE POLICY coach_messages_insert ON public.coach_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (auth.uid() = coach_id OR auth.uid() = pilot_id)
    AND EXISTS (
      SELECT 1 FROM public.coach_pilots cp
      WHERE cp.id = coach_pilot_id
        AND cp.coach_id = coach_messages.coach_id
        AND cp.pilot_id = coach_messages.pilot_id
        AND cp.active
        AND cp.pilot_consent_at IS NOT NULL
    )
  );

CREATE POLICY coach_messages_mark_read ON public.coach_messages
  FOR UPDATE USING (
    (auth.uid() = coach_id OR auth.uid() = pilot_id) AND sender_id <> auth.uid()
  ) WITH CHECK (
    (auth.uid() = coach_id OR auth.uid() = pilot_id) AND sender_id <> auth.uid()
  );
