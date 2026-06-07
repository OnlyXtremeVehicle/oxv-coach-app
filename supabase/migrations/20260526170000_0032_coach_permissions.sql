-- ============================================================================
-- Migration 0032 — Permissions modulaires du coach (§8.1 OXV Mirror)
-- ============================================================================
--
-- Cahier §8.1 : « Les accès du coach ne sont pas figés en un bloc unique :
-- ils sont modulaires, activés à la carte selon chaque coach. Un coach
-- débutant peut n'avoir que la consultation de la data de ses élèves ;
-- un coach partenaire privilégié peut se voir activer la gestion de ses
-- propres roulages, le tableau de bord business, etc. »
--
-- Implication : la sécurité (RLS) doit reposer sur le rôle ET sur un jeu
-- de permissions granulaire par compte coach, pas sur un rôle monolithique.
--
-- Cette migration pose la FONDATION : table + helper + RLS + seed. Les
-- features gardées (dashboard business, roulages coach) viendront brancher
-- dessus dans des PRs ultérieures.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table coach_permissions
-- ----------------------------------------------------------------------------
-- Une ligne par coach. Colonnes booléennes explicites (lisibles, indexables,
-- plus simples qu'un JSONB pour un jeu de permissions fixe).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Permission de base : consulter la data des élèves assignés+consentis.
  -- Default true — un coach assigné voit ses pilotes (filtré par is_coach_of).
  can_view_pilots BOOLEAN NOT NULL DEFAULT true,

  -- Permissions avancées : activées à la carte par l'admin (default false).
  can_manage_own_sessions BOOLEAN NOT NULL DEFAULT false,
  can_view_business_dashboard BOOLEAN NOT NULL DEFAULT false,

  -- Tracking
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coach_permissions IS
  'Permissions modulaires par compte coach (§8.1). RLS data reste gérée par is_coach_of ; ces flags gatent les FEATURES (dashboard business, roulages).';
COMMENT ON COLUMN public.coach_permissions.can_view_pilots IS
  'Base : consulter la data des élèves. Default true.';
COMMENT ON COLUMN public.coach_permissions.can_manage_own_sessions IS
  'Avancé : gérer ses propres roulages organisés avec OXV. Default false.';
COMMENT ON COLUMN public.coach_permissions.can_view_business_dashboard IS
  'Avancé : tableau de bord business (revenus, remise dégressive). Default false.';

-- ----------------------------------------------------------------------------
-- 2. Helper coach_has_permission(coach_uuid, permission_name)
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER pour usage en RLS sans récursion. Retourne false si
-- pas de ligne (fail-safe : aucune permission avancée par défaut).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.coach_has_permission(coach_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT CASE permission_name
    WHEN 'view_pilots' THEN can_view_pilots
    WHEN 'manage_own_sessions' THEN can_manage_own_sessions
    WHEN 'view_business_dashboard' THEN can_view_business_dashboard
    ELSE false
  END
  INTO result
  FROM public.coach_permissions
  WHERE user_id = coach_uuid;

  RETURN COALESCE(result, false);
END;
$$;

COMMENT ON FUNCTION public.coach_has_permission(UUID, TEXT) IS
  'True si le coach a la permission nommée. Fail-safe : false si pas de ligne ou permission inconnue.';

REVOKE EXECUTE ON FUNCTION public.coach_has_permission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_has_permission(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS sur coach_permissions
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT : le coach lit ses propres permissions.
DROP POLICY IF EXISTS coach_permissions_select_self ON public.coach_permissions;
CREATE POLICY coach_permissions_select_self ON public.coach_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- SELECT/ALL : l'admin gère tout (active les permissions à la carte).
DROP POLICY IF EXISTS coach_permissions_admin_all ON public.coach_permissions;
CREATE POLICY coach_permissions_admin_all ON public.coach_permissions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 4. Seed : chaque coach existant reçoit une ligne (base : view_pilots only)
-- ----------------------------------------------------------------------------

INSERT INTO public.coach_permissions (user_id, can_view_pilots)
SELECT id, true
FROM public.users
WHERE role = 'coach'
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Trigger : à la promotion d'un user en coach, créer sa ligne de perms
-- ----------------------------------------------------------------------------
-- Garantit qu'un nouveau coach a toujours ses permissions de base, sans
-- dépendre de l'app. AFTER UPDATE OF role.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_coach_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'coach' THEN
    INSERT INTO public.coach_permissions (user_id, can_view_pilots)
    VALUES (NEW.id, true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_ensure_coach_permissions ON public.users;
CREATE TRIGGER users_ensure_coach_permissions
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_coach_permissions();
