-- ============================================================================
-- Migration 0036 — Carte écosystème & référencement national (§8 étape A)
-- ============================================================================
-- Décision Gabin (2026-06-07, cahier v3 §8) : OXV Mirror devient le point
-- d'entrée du track day en France. Étape A = annuaire enrichi (référencement
-- + mise en relation), SANS encaissement / commission / réservation
-- (compatible micro-entreprise). L'étape B (marketplace) viendra plus tard.
--
-- Les circuits sont déjà en base (table `circuits`). On ajoute uniquement la
-- couche « services autour du circuit » : restauration, hébergement, loisirs,
-- et journées de roulage (OXV et autres organisateurs — annuaire neutre).
--
-- Modèle d'accès (cahier §8.1) : la couche circuits est gratuite (aimant) ;
-- les services détaillés sont à terme réservés aux abonnés premium. Comme il
-- n'existe AUCUNE notion d'abonnement aujourd'hui (app gratuite au lancement,
-- §12), le drapeau is_premium est posé pour un usage FUTUR et n'est PAS encore
-- imposé par la RLS. À activer quand le modèle d'abonnement existera.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.circuit_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('restaurant', 'lodging', 'entertainment', 'roulage', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  lat NUMERIC,
  lon NUMERIC,
  url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  -- Pour les journées de roulage : organisateur (OXV ou concurrent). Annuaire
  -- neutre et exhaustif (cahier §8.1).
  organizer TEXT,
  -- Réservé premium (usage futur, non imposé par la RLS pour l'instant).
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.circuit_services IS
  'Services de l''écosystème autour des circuits (§8 étape A) : restauration, hébergement, loisirs, roulages. Annuaire/mise en relation uniquement — aucun encaissement.';
COMMENT ON COLUMN public.circuit_services.is_premium IS
  'Réservé abonnés premium (cahier §8.1). Usage FUTUR : non imposé par la RLS tant qu''il n''existe pas d''abonnement.';
COMMENT ON COLUMN public.circuit_services.organizer IS
  'Organisateur pour kind=roulage (OXV ou autre). Annuaire neutre et exhaustif.';

CREATE INDEX IF NOT EXISTS idx_circuit_services_circuit ON public.circuit_services(circuit_id);
CREATE INDEX IF NOT EXISTS idx_circuit_services_kind ON public.circuit_services(kind);

-- updated_at automatique
CREATE OR REPLACE FUNCTION public.circuit_services_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circuit_services_updated_at ON public.circuit_services;
CREATE TRIGGER circuit_services_updated_at
  BEFORE UPDATE ON public.circuit_services
  FOR EACH ROW
  EXECUTE FUNCTION public.circuit_services_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — annuaire ouvert en lecture aux membres connectés (aimant gratuit),
-- écriture réservée à l'admin. Le gating premium viendra plus tard.
-- ----------------------------------------------------------------------------

ALTER TABLE public.circuit_services ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur connecté voit les services publiés.
DROP POLICY IF EXISTS circuit_services_select_published ON public.circuit_services;
CREATE POLICY circuit_services_select_published ON public.circuit_services
  FOR SELECT TO authenticated
  USING (is_published = true);

-- Écriture : admin uniquement (back-office OXV référence les services).
DROP POLICY IF EXISTS circuit_services_admin_all ON public.circuit_services;
CREATE POLICY circuit_services_admin_all ON public.circuit_services
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
