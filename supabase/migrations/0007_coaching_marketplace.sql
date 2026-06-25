-- ============================================================================
-- PROPOSITION Phase 1 — à valider par Gabin avant `supabase db push`. NON appliquée.
-- ============================================================================
-- Place de marché coaching — MVP Phase 1 (mise en relation, SANS paiement,
-- SANS avis). Réf. spec : docs/specs-bundle-v4/MVP_PLACE_DE_MARCHE_COACHING.md.
--
-- ⚠️  AUCUNE de ces instructions ne doit être exécutée tant que Gabin n'a pas
--     tranché les décisions §5 de la spec (notamment : cadrage doctrine
--     « parcourir un coach », unité monétaire, agrément des fiches).
--     Ce fichier est une PROPOSITION DE SCHÉMA, pas une migration appliquée.
--     Ne PAS lancer `supabase db push` / `supabase migration up` dessus.
--
-- Périmètre strict Phase 1 :
--   1. Policy SELECT pilote sur `coach_profiles` publiés (manquante en prod).
--   2. Table NOUVELLE `coach_availability` (créneaux déclarés par le coach).
--   3. Table NOUVELLE `coaching_bookings` (demande de séance pilote → coach).
--
-- Hors périmètre (Phase 2, NON inclus ici) : paiement / commission / Stripe,
-- table `coach_reviews`. Les colonnes prix restent volontairement minimales.
--
-- Sécurité (pattern repris de la prod, cf. 0034_coach_roulages) :
--   - Helpers `is_admin()` et `is_coach()` DÉJÀ EN PLACE — ne PAS les redéfinir.
--   - RGPD : une demande `pending` n'ouvre AUCUN accès aux données du pilote.
--     L'affiliation `coach_pilots` (consentement) reste le seul vecteur d'accès
--     télémétrie ; ce MVP ne la modifie pas. Cf. spec §4.
--   - Tables existantes (`coach_profiles`, `coach_pilots`, `coach_roulages`)
--     NON modifiées, sauf l'ajout d'UNE policy SELECT sur `coach_profiles`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. coach_profiles — policy SELECT pilote sur les fiches PUBLIÉES
-- ----------------------------------------------------------------------------
-- Constat : l'export RLS de production (06_RLS_POLICIES_ACTUELLES.sql) ne
-- contient AUCUNE policy `coach_profiles`, et aucune migration du dépôt n'en
-- crée. La découverte de coachs côté pilote exige donc une policy de lecture
-- des fiches publiées. RLS = vérité ; l'UI ne suffit pas (cf. doctrine RGPD).
--
-- Lecture limitée à `is_published = true`. Le propriétaire (le coach) garde la
-- main sur sa propre fiche via les policies qu'il possède déjà côté espace
-- coach ; on n'ajoute QUE l'ouverture en lecture publique-authentifiée.
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_profiles_select_published ON public.coach_profiles;
CREATE POLICY coach_profiles_select_published ON public.coach_profiles
  FOR SELECT TO authenticated
  USING (is_published = true);

COMMENT ON POLICY coach_profiles_select_published ON public.coach_profiles IS
  'Phase 1 marketplace : un pilote authentifié lit les fiches coach publiées (découverte). Aucune donnée pilote ici — pas de risque RGPD.';

-- ----------------------------------------------------------------------------
-- 1. Table coach_availability — créneaux déclarés par le coach
-- ----------------------------------------------------------------------------
-- Un coach ouvre des créneaux (date, circuit, capacité). Le pilote les
-- consulte sur la fiche pour appuyer sa demande. Circuit en texte libre
-- (un seul circuit OXV pour l'instant), comme `coach_roulages.circuit_name`.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Circuit du créneau. Texte libre en V1 (cohérent avec coach_roulages).
  circuit_name  TEXT NOT NULL DEFAULT 'Circuit de Haute Saintonge',
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  -- Places offertes sur ce créneau. >= 1.
  capacity      INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'full', 'closed', 'cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

COMMENT ON TABLE public.coach_availability IS
  'Créneaux ouverts par un coach (Phase 1 marketplace). Le coach gère les siens ; un pilote lit ceux des coachs publiés. Aucun flux d''argent.';
COMMENT ON COLUMN public.coach_availability.status IS
  'open = ouvert ; full = complet ; closed = fermé manuellement ; cancelled = annulé.';

CREATE INDEX IF NOT EXISTS idx_coach_availability_coach
  ON public.coach_availability (coach_id, starts_at);

-- updated_at automatique (même motif que coach_roulages).
CREATE OR REPLACE FUNCTION public.coach_availability_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_availability_updated_at ON public.coach_availability;
CREATE TRIGGER coach_availability_updated_at
  BEFORE UPDATE ON public.coach_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.coach_availability_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Table coaching_bookings — demande de séance pilote → coach
-- ----------------------------------------------------------------------------
-- Le pilote crée une demande (status 'pending') sur un créneau ou un horaire
-- souhaité libre. Le coach confirme ou décline. Phase 1 s'arrête à 'confirmed'.
-- Les états 'paid'/'refunded' sont prévus pour la Phase 2 (écriture serveur
-- uniquement) et ne sont JAMAIS posés par le client en Phase 1.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coaching_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coach_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Créneau choisi (optionnel) ; sinon horaire souhaité libre + circuit.
  availability_id     UUID REFERENCES public.coach_availability(id) ON DELETE SET NULL,
  requested_starts_at TIMESTAMPTZ,
  circuit_name        TEXT,
  -- Mot du pilote à la demande.
  message             TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending',     -- demande envoyée
                          'accepted',    -- coach a accepté (Phase 1 s'arrête ici)
                          'declined',    -- coach a refusé
                          'cancelled',   -- annulée (pilote ou coach)
                          'paid',        -- Phase 2 — réglée (écriture serveur)
                          'completed',   -- séance faite
                          'refunded'     -- Phase 2 — remboursée (écriture serveur)
                        )),
  responded_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coaching_bookings IS
  'Demandes de séance pilote → coach (Phase 1 marketplace, SANS paiement). pending → accepted/declined par le coach. Une demande pending n''ouvre aucun accès aux données du pilote (RGPD, cf. spec §4).';
COMMENT ON COLUMN public.coaching_bookings.status IS
  'pending → accepted/declined (coach) ; cancelled (pilote ou coach). paid/completed/refunded réservés Phase 2 (écriture serveur, jamais client).';

CREATE INDEX IF NOT EXISTS idx_coaching_bookings_coach
  ON public.coaching_bookings (coach_id, status);
CREATE INDEX IF NOT EXISTS idx_coaching_bookings_pilot
  ON public.coaching_bookings (pilot_id, status);

DROP TRIGGER IF EXISTS coaching_bookings_updated_at ON public.coaching_bookings;
CREATE TRIGGER coaching_bookings_updated_at
  BEFORE UPDATE ON public.coaching_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.coach_availability_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS — coach_availability
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;

-- Coach : gère ses propres créneaux.
DROP POLICY IF EXISTS coach_availability_manage_own ON public.coach_availability;
CREATE POLICY coach_availability_manage_own ON public.coach_availability
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Pilote : lit les créneaux des coachs dont la fiche est publiée.
DROP POLICY IF EXISTS coach_availability_select_published ON public.coach_availability;
CREATE POLICY coach_availability_select_published ON public.coach_availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles p
      WHERE p.coach_id = coach_availability.coach_id
        AND p.is_published = true
    )
  );

-- Admin : tout.
DROP POLICY IF EXISTS coach_availability_admin_all ON public.coach_availability;
CREATE POLICY coach_availability_admin_all ON public.coach_availability
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 4. RLS — coaching_bookings
-- ----------------------------------------------------------------------------

ALTER TABLE public.coaching_bookings ENABLE ROW LEVEL SECURITY;

-- Pilote : crée SA demande, sur un coach dont la fiche est publiée, à l'état
-- 'pending' seulement (pas d'auto-confirmation, pas d'écriture d'un état Phase 2).
DROP POLICY IF EXISTS coaching_bookings_pilot_insert ON public.coaching_bookings;
CREATE POLICY coaching_bookings_pilot_insert ON public.coaching_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    pilot_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.coach_profiles p
      WHERE p.coach_id = coaching_bookings.coach_id
        AND p.is_published = true
    )
  );

-- Pilote : lit ses propres demandes.
DROP POLICY IF EXISTS coaching_bookings_pilot_select ON public.coaching_bookings;
CREATE POLICY coaching_bookings_pilot_select ON public.coaching_bookings
  FOR SELECT TO authenticated
  USING (pilot_id = auth.uid());

-- Pilote : peut annuler SA demande (l'app n'envoie que status='cancelled').
DROP POLICY IF EXISTS coaching_bookings_pilot_cancel ON public.coaching_bookings;
CREATE POLICY coaching_bookings_pilot_cancel ON public.coaching_bookings
  FOR UPDATE TO authenticated
  USING (pilot_id = auth.uid())
  WITH CHECK (pilot_id = auth.uid());

-- Coach : lit les demandes qui le concernent.
DROP POLICY IF EXISTS coaching_bookings_coach_select ON public.coaching_bookings;
CREATE POLICY coaching_bookings_coach_select ON public.coaching_bookings
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

-- Coach : répond à ses demandes (accepter/décliner/annuler). L'app n'envoie
-- que status + responded_at/cancelled_at ; aucun champ Phase 2 en Phase 1.
DROP POLICY IF EXISTS coaching_bookings_coach_respond ON public.coaching_bookings;
CREATE POLICY coaching_bookings_coach_respond ON public.coaching_bookings
  FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Admin : tout.
DROP POLICY IF EXISTS coaching_bookings_admin_all ON public.coaching_bookings;
CREATE POLICY coaching_bookings_admin_all ON public.coaching_bookings
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- FIN — PROPOSITION NON APPLIQUÉE. Ne rien exécuter sans validation Gabin.
-- ============================================================================
