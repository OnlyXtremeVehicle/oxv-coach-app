-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 16 juin 2026 à 17:51:25, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ===== Communauté : modèle de visibilité (défaut anonymous_only — choix fondateur) =====
CREATE TYPE public.community_visibility AS ENUM ('private','anonymous_only','nominative');
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS community_visibility public.community_visibility NOT NULL DEFAULT 'anonymous_only';
COMMENT ON COLUMN public.users.community_visibility IS
  'private = exclu de tout classement/observatoire ; anonymous_only (défaut) = compte dans les agrégats sans nom ; nominative = nom (public_handle) affiché.';

-- ===== DUEL : défi asynchrone entre pilotes (fantôme a_vs_b) =====
CREATE TYPE public.duel_status AS ENUM ('pending','accepted','declined','completed','expired','cancelled');
CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  challenger_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES public.users(id) ON DELETE SET NULL,   -- NULL = défi ouvert
  status public.duel_status NOT NULL DEFAULT 'pending',
  challenger_session_id uuid REFERENCES public.telemetry_sessions(id) ON DELETE SET NULL,
  challenger_lap_number integer,
  challenger_lap_s numeric,
  opponent_session_id uuid REFERENCES public.telemetry_sessions(id) ON DELETE SET NULL,
  opponent_lap_number integer,
  opponent_lap_s numeric,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_duels_circuit ON public.duels(circuit_id);
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON public.duels(challenger_id);
CREATE INDEX IF NOT EXISTS idx_duels_opponent ON public.duels(opponent_id);

ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY duels_select_participant ON public.duels FOR SELECT
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid());
CREATE POLICY duels_insert_challenger ON public.duels FOR INSERT
  WITH CHECK (challenger_id = auth.uid());
CREATE POLICY duels_update_participant ON public.duels FOR UPDATE
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid())
  WITH CHECK (challenger_id = auth.uid() OR opponent_id = auth.uid());
CREATE POLICY duels_admin_all ON public.duels FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
