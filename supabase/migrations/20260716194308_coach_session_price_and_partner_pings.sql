-- ============================================================================
-- Retours build 23 — deux décisions fondateur (2026-07-16, AskUserQuestion) :
--
-- A. PRIX COACH À LA SESSION (« session remplace saison » à l'affichage).
--    coach_profiles ne portait qu'un season_price_eur : ajout de
--    session_price_eur, édité par le coach depuis son profil. Les listings et
--    la fiche coach affichent LE PRIX À LA SESSION ; la saison reste possible
--    en secondaire si renseignée.
--
-- B. POINTS PARTENAIRES SUR LA CARTE — workflow décidé par le fondateur :
--    « le partenaire crée le point, le fait valider à l'admin, et celui-ci
--    valide ou non pour affichage sur carte et dans un onglet événement,
--    garage, restaurant, hôtel ou autre ».
--    - social_pings.partner_id : le point appartient à un partenaire ;
--    - kind enrichi des catégories fondateur : garage, restaurant, hotel, autre ;
--    - is_published (existant, défaut false) = LA validation admin ;
--    - RLS : un partenaire VALIDÉ crée/modifie SON point, toujours en
--      non-publié (toute édition repasse par la validation) ; il voit ses
--      points (statut) ; les membres ne voient que le publié (policy
--      existante) ; l'admin garde tout (policy existante).
-- ============================================================================

-- A. Prix à la session du coach.
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS session_price_eur INTEGER
    CHECK (session_price_eur IS NULL OR session_price_eur >= 0);

COMMENT ON COLUMN public.coach_profiles.session_price_eur IS
  'Prix d''une session de coaching en euros (décision fondateur 2026-07-16 : affiché À LA SESSION dans les listings, édité par le coach). Réglé hors application — OXV n''encaisse pas.';

-- B1. Le point appartient (optionnellement) à un partenaire.
ALTER TABLE public.social_pings
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partner_accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_social_pings_partner ON public.social_pings(partner_id);

-- B2. Catégories fondateur ajoutées au CHECK de kind.
ALTER TABLE public.social_pings DROP CONSTRAINT IF EXISTS social_pings_kind_check;
ALTER TABLE public.social_pings ADD CONSTRAINT social_pings_kind_check CHECK (kind IN (
  'event_oxv', 'event_partner', 'soiree', 'partner_location',
  'filming_location', 'host_experience',
  'garage', 'restaurant', 'hotel', 'autre'
));

-- B3. RLS partenaire : créer/modifier SON point, jamais auto-publié.
DROP POLICY IF EXISTS social_pings_partner_insert ON public.social_pings;
CREATE POLICY social_pings_partner_insert ON public.social_pings
  FOR INSERT TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT id FROM public.partner_accounts
      WHERE profile_id = auth.uid() AND status = 'validated'
    )
    AND is_published = false
  );

DROP POLICY IF EXISTS social_pings_partner_update ON public.social_pings;
CREATE POLICY social_pings_partner_update ON public.social_pings
  FOR UPDATE TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.partner_accounts
      WHERE profile_id = auth.uid() AND status = 'validated'
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM public.partner_accounts
      WHERE profile_id = auth.uid() AND status = 'validated'
    )
    AND is_published = false  -- toute édition repasse par la validation admin
  );

DROP POLICY IF EXISTS social_pings_partner_select_own ON public.social_pings;
CREATE POLICY social_pings_partner_select_own ON public.social_pings
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.partner_accounts
      WHERE profile_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.social_pings.partner_id IS
  'Partenaire propriétaire du point (libre-service, 2026-07-16). NULL = point OXV/admin. Un partenaire validé crée/édite son point en non-publié ; l''admin publie (is_published) pour affichage carte + onglets par catégorie.';
