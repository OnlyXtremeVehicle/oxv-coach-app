-- ============================================================================
-- Migration 0033 — Volet social : pings de localisation (§7 OXV Mirror)
-- ============================================================================
--
-- Cahier §7 : « L'application intègre un onglet social réservé aux membres
-- validés, dont l'élément central est une carte interactive. »
--   - Pings par type : événements OXV et partenaires, soirées, emplacements
--     partenaires, lieux de tournage, expériences chez membres-hôtes
--   - Chaque point porte : lien de diffusion en direct, e-mail, adresse
--     physique, ou détail d'un événement
--   - Réservé aux membres validés (kyc_status = 'validated')
--   - Aucune mécanique de classement / gamification (doctrine)
--
-- Cette migration pose le schéma + RLS. Les groupes privés sur invitation
-- (§7) sont un sous-chantier distinct (V2), non couvert ici.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table social_pings
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.social_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  kind TEXT NOT NULL CHECK (kind IN (
    'event_oxv',        -- événement OXV
    'event_partner',    -- événement partenaire
    'soiree',           -- soirée
    'partner_location', -- emplacement d'un partenaire
    'filming_location', -- lieu de tournage de contenu
    'host_experience'   -- expérience chez un membre-hôte sélectionné
  )),

  title TEXT NOT NULL,
  description TEXT,

  -- Géolocalisation (centrée France / Nouvelle-Aquitaine côté affichage)
  lat NUMERIC(9, 6) NOT NULL,
  lon NUMERIC(9, 6) NOT NULL,

  -- Informations dédiées au point (toutes optionnelles selon le type)
  address TEXT,            -- adresse physique
  contact_email TEXT,      -- e-mail de contact
  live_url TEXT,           -- lien de diffusion en direct
  event_url TEXT,          -- détail d'un événement

  -- Fenêtre temporelle (pour les événements datés)
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- Publication : un ping non publié n'est visible que des admins
  is_published BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.social_pings IS
  'Points de la carte sociale (§7). Réservés aux membres validés en lecture, gérés par admin.';
COMMENT ON COLUMN public.social_pings.kind IS
  'Type de point : event_oxv | event_partner | soiree | partner_location | filming_location | host_experience.';
COMMENT ON COLUMN public.social_pings.is_published IS
  'False = brouillon visible admin uniquement. True = visible des membres validés.';

CREATE INDEX IF NOT EXISTS idx_social_pings_published
  ON public.social_pings (kind, starts_at)
  WHERE is_published;

-- ----------------------------------------------------------------------------
-- 2. Helper is_validated_member() — un membre dont le KYC est validé
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_validated_member()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  ok BOOLEAN;
BEGIN
  SELECT (kyc_status = 'validated')
  INTO ok
  FROM public.users
  WHERE id = auth.uid();
  RETURN COALESCE(ok, false);
END;
$$;

COMMENT ON FUNCTION public.is_validated_member() IS
  'True si l''utilisateur courant a kyc_status = validated. Sert le gating du volet social (§7).';

REVOKE EXECUTE ON FUNCTION public.is_validated_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_validated_member() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS sur social_pings
-- ----------------------------------------------------------------------------

ALTER TABLE public.social_pings ENABLE ROW LEVEL SECURITY;

-- SELECT : membres validés voient les pings publiés ; admin voit tout.
DROP POLICY IF EXISTS social_pings_select_member ON public.social_pings;
CREATE POLICY social_pings_select_member ON public.social_pings
  FOR SELECT TO authenticated
  USING ((is_published AND is_validated_member()) OR is_admin());

-- INSERT/UPDATE/DELETE : admin uniquement.
DROP POLICY IF EXISTS social_pings_admin_all ON public.social_pings;
CREATE POLICY social_pings_admin_all ON public.social_pings
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
