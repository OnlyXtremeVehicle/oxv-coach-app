-- ============================================================================
-- Feature Duel pédagogique — étape 1/4 : table pilot_friendships + RLS
-- ============================================================================
-- Brief : 2 pilotes peuvent se déclarer amis (consentement réciproque) pour
-- comparer leurs bilans côte à côte sur un même circuit. Pas de gagnant
-- désigné, pas de classement. Juste les chiffres.
--
-- Doctrine :
--   - L'app est un miroir, pas un coach. Comparer ≠ classer.
--   - Opt-in mutuel obligatoire (RGPD + esprit OXV).
--   - Un ami voit UNIQUEMENT les bilans (app_session_analyses) et les
--     métadonnées de session (circuit, date), JAMAIS le .ubx brut ni les
--     virages annotés ni les coach_annotations.
--
-- Sécurité : symétrique à coach_pilots, mais réciproque (pas de role asym).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table pilot_friendships
-- ----------------------------------------------------------------------------
-- Convention canonique : pilot_a < pilot_b (UUID lexicographique).
-- Cela évite les doublons (a,b) vs (b,a) sans avoir besoin d'index complexe.
-- Le code applicatif normalise via LEAST/GREATEST avant INSERT.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pilot_friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Paire canonique : pilot_a < pilot_b
  pilot_a UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pilot_b UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Qui a initié la demande (toujours pilot_a OU pilot_b)
  initiator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),

  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,

  CHECK (pilot_a < pilot_b),
  CHECK (initiator_id = pilot_a OR initiator_id = pilot_b),
  UNIQUE (pilot_a, pilot_b)
);

COMMENT ON TABLE public.pilot_friendships IS
  'Amitié réciproque entre 2 pilotes pour le duel pédagogique. Ordre canonique pilot_a < pilot_b.';
COMMENT ON COLUMN public.pilot_friendships.initiator_id IS
  'Qui a envoyé la demande (toujours pilot_a OU pilot_b). Permet d''afficher "X souhaite vous duellier".';
COMMENT ON COLUMN public.pilot_friendships.status IS
  'pending = demande en attente | accepted = amis | declined = refus initial | revoked = ex-amis (l''un des 2 a quitté).';

CREATE INDEX IF NOT EXISTS idx_pilot_friendships_pilot_a
  ON public.pilot_friendships(pilot_a) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_pilot_friendships_pilot_b
  ON public.pilot_friendships(pilot_b) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_pilot_friendships_pending_recipient
  ON public.pilot_friendships(pilot_a, pilot_b)
  WHERE status = 'pending';

-- ----------------------------------------------------------------------------
-- 2. Helper are_friends(uuid, uuid) — utilisé par les RLS
-- ----------------------------------------------------------------------------
-- Retourne true si les 2 UUIDs sont amis acceptés (peu importe l'ordre).
-- SECURITY DEFINER pour éviter récursion RLS sur pilot_friendships.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  lo UUID;
  hi UUID;
BEGIN
  IF user_a IS NULL OR user_b IS NULL OR user_a = user_b THEN
    RETURN false;
  END IF;
  -- Normaliser à l'ordre canonique
  lo := LEAST(user_a, user_b);
  hi := GREATEST(user_a, user_b);
  RETURN EXISTS (
    SELECT 1 FROM public.pilot_friendships
    WHERE pilot_a = lo AND pilot_b = hi AND status = 'accepted'
  );
END;
$$;

COMMENT ON FUNCTION public.are_friends(UUID, UUID) IS
  'True si les 2 users sont amis acceptés. Peu importe l''ordre des arguments. SECURITY DEFINER pour éviter récursion RLS.';

REVOKE EXECUTE ON FUNCTION public.are_friends(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS sur pilot_friendships
-- ----------------------------------------------------------------------------

ALTER TABLE public.pilot_friendships ENABLE ROW LEVEL SECURITY;

-- SELECT : les 2 membres voient leur friendship (peu importe le status).
DROP POLICY IF EXISTS pilot_friendships_select_member ON public.pilot_friendships;
CREATE POLICY pilot_friendships_select_member ON public.pilot_friendships
  FOR SELECT TO authenticated
  USING (pilot_a = auth.uid() OR pilot_b = auth.uid() OR is_admin());

-- INSERT : l'initiator doit être auth.uid(), et fait partie de la paire.
DROP POLICY IF EXISTS pilot_friendships_insert_self ON public.pilot_friendships;
CREATE POLICY pilot_friendships_insert_self ON public.pilot_friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    initiator_id = auth.uid()
    AND (pilot_a = auth.uid() OR pilot_b = auth.uid())
  );

-- UPDATE : status passage pending → accepted/declined par le destinataire
--         OU revoked par n'importe quel membre d'une friendship accepted.
-- On garde simple : tout membre peut UPDATE son status (l'app valide les transitions).
DROP POLICY IF EXISTS pilot_friendships_update_member ON public.pilot_friendships;
CREATE POLICY pilot_friendships_update_member ON public.pilot_friendships
  FOR UPDATE TO authenticated
  USING (pilot_a = auth.uid() OR pilot_b = auth.uid())
  WITH CHECK (pilot_a = auth.uid() OR pilot_b = auth.uid());

-- DELETE : les 2 membres ou admin.
DROP POLICY IF EXISTS pilot_friendships_delete_member ON public.pilot_friendships;
CREATE POLICY pilot_friendships_delete_member ON public.pilot_friendships
  FOR DELETE TO authenticated
  USING (pilot_a = auth.uid() OR pilot_b = auth.uid() OR is_admin());

-- ----------------------------------------------------------------------------
-- 4. Étendre RLS sur app_session_analyses pour permettre lecture par ami
-- ----------------------------------------------------------------------------
-- Un ami accepté peut SELECT les analyses du pilote. Read-only.
-- Note : on ne touche PAS aux policies existantes (owner, coach, admin), on
-- en ajoute une supplémentaire. Postgres applique l'UNION des USING.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS app_session_analyses_select_friend ON public.app_session_analyses;
CREATE POLICY app_session_analyses_select_friend ON public.app_session_analyses
  FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), user_id));

COMMENT ON POLICY app_session_analyses_select_friend ON public.app_session_analyses IS
  'Un ami accepté peut lire les analyses (bilan) du pilote. Read-only, jamais INSERT/UPDATE/DELETE.';

-- ----------------------------------------------------------------------------
-- 5. Étendre RLS sur telemetry_sessions pour permettre lecture métadonnées par ami
-- ----------------------------------------------------------------------------
-- Métadonnées de session : circuit_name, started_at, ended_at, status.
-- Pas le .ubx brut (storage RLS séparé), pas les laps détaillés non plus.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS telemetry_sessions_select_friend ON public.telemetry_sessions;
CREATE POLICY telemetry_sessions_select_friend ON public.telemetry_sessions
  FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), user_id));

COMMENT ON POLICY telemetry_sessions_select_friend ON public.telemetry_sessions IS
  'Un ami accepté peut lire les métadonnées de session (circuit, date) pour pouvoir afficher quelle session est comparée. Pas accès au .ubx brut.';

-- ----------------------------------------------------------------------------
-- 6. NOTE : volontairement PAS étendu aux tables suivantes
-- ----------------------------------------------------------------------------
--   - app_segment_analyses (détails par virage) : un ami n'a pas besoin des
--     virages détaillés pour faire un duel sur la marge globale.
--   - coach_annotations : RGPD pur, note privée pilote/coach.
--   - pilot_goals : objectif personnel, ne se partage pas même entre amis.
--   - laps (détaillé) : pas exposé.
--
-- Si on veut étendre plus tard (V1.2 : "comparer virage par virage"), on
-- ajoute une migration dédiée. Pour l'instant, le duel est sur le bilan.
-- ============================================================================
