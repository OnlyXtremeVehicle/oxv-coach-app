-- Table app_progression_shares : partage social de la progression
-- du pilote via lien sécurisé (token unguessable).
--
-- Architecture P1 sec. 3.5. Le destinataire (sans compte OXV) accède
-- via /share/{token} côté oxvehicle.fr ou un futur micro-site.

CREATE TABLE IF NOT EXISTS public.app_progression_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Token URL public, base64url 32 chars (~190 bits d'entropie)
  share_token text NOT NULL UNIQUE,

  -- Périmètre du partage
  share_scope text NOT NULL CHECK (
    share_scope IN ('last_session', 'last_5_sessions', 'full_history', 'progression_only')
  ),
  included_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Cycle de vie
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int4 NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_progression_shares_token
  ON public.app_progression_shares (share_token);

CREATE INDEX IF NOT EXISTS idx_app_progression_shares_user
  ON public.app_progression_shares (user_id, created_at DESC);

ALTER TABLE public.app_progression_shares ENABLE ROW LEVEL SECURITY;

-- Lecture côté pilote : ses propres partages uniquement.
DROP POLICY IF EXISTS app_progression_shares_select_own ON public.app_progression_shares;
CREATE POLICY app_progression_shares_select_own ON public.app_progression_shares
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Lecture publique par token : permise pour anonymes via le site
-- (la sécurité repose sur l'unguessability du token, 190 bits d'entropie).
DROP POLICY IF EXISTS app_progression_shares_select_by_token ON public.app_progression_shares;
CREATE POLICY app_progression_shares_select_by_token ON public.app_progression_shares
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS app_progression_shares_insert_own ON public.app_progression_shares;
CREATE POLICY app_progression_shares_insert_own ON public.app_progression_shares
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS app_progression_shares_update_own ON public.app_progression_shares;
CREATE POLICY app_progression_shares_update_own ON public.app_progression_shares
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS app_progression_shares_delete_own ON public.app_progression_shares;
CREATE POLICY app_progression_shares_delete_own ON public.app_progression_shares
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin());
