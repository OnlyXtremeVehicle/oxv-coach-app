-- ============================================================================
-- Migration 0039 — Priorisation du bilan (B) + gabarits de commentaire (C)
-- ============================================================================
-- §10.3c, décision Gabin (2026-06-07).
--
-- B — Priorisation / curation : le coach choisit, pour CE pilote, les virages
--     à mettre en avant sur son bilan (+ une note d'intro). Aucune donnée
--     nouvelle, aucune injonction : un ordre de lecture proposé et attribué
--     (« Mis en avant par votre coach »). Le plus sûr doctrinalement.
--
-- C — Gabarits de commentaire : modèles de texte réutilisables côté coach,
--     pour accélérer la saisie de ses annotations (déjà cadrées). Pur confort
--     coach, aucun impact pilote direct.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- B. coach_pilot_highlight
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_pilot_highlight (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pilot_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Virages mis en avant, dans l'ordre de lecture proposé par le coach.
  highlight_corner_indexes INTEGER[] NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, pilot_id),
  CHECK (coach_id <> pilot_id)
);

COMMENT ON TABLE public.coach_pilot_highlight IS
  'Priorisation du bilan par le coach (§10.3c-B) : virages mis en avant + note. Ordre de lecture proposé et attribué, aucune injonction.';

CREATE INDEX IF NOT EXISTS idx_coach_pilot_highlight_pilot
  ON public.coach_pilot_highlight(pilot_id);

-- ----------------------------------------------------------------------------
-- C. coach_annotation_template
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_annotation_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coach_annotation_template IS
  'Gabarits de commentaire réutilisables du coach (§10.3c-C). Confort de saisie ; insérés dans les annotations (déjà cadrées doctrine).';

CREATE INDEX IF NOT EXISTS idx_coach_annotation_template_coach
  ON public.coach_annotation_template(coach_id);

-- ----------------------------------------------------------------------------
-- updated_at automatique (fonction partagée pour les deux tables)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.coach_curation_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_pilot_highlight_updated_at ON public.coach_pilot_highlight;
CREATE TRIGGER coach_pilot_highlight_updated_at
  BEFORE UPDATE ON public.coach_pilot_highlight
  FOR EACH ROW EXECUTE FUNCTION public.coach_curation_set_updated_at();

DROP TRIGGER IF EXISTS coach_annotation_template_updated_at ON public.coach_annotation_template;
CREATE TRIGGER coach_annotation_template_updated_at
  BEFORE UPDATE ON public.coach_annotation_template
  FOR EACH ROW EXECUTE FUNCTION public.coach_curation_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — coach_pilot_highlight
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_pilot_highlight ENABLE ROW LEVEL SECURITY;

-- Coach : gère la priorisation de ses élèves consentis.
DROP POLICY IF EXISTS coach_pilot_highlight_coach_manage ON public.coach_pilot_highlight;
CREATE POLICY coach_pilot_highlight_coach_manage ON public.coach_pilot_highlight
  FOR ALL TO authenticated
  USING (coach_id = auth.uid() AND is_coach_of(pilot_id))
  WITH CHECK (coach_id = auth.uid() AND is_coach_of(pilot_id));

-- Pilote : lit la priorisation posée sur lui.
DROP POLICY IF EXISTS coach_pilot_highlight_pilot_select ON public.coach_pilot_highlight;
CREATE POLICY coach_pilot_highlight_pilot_select ON public.coach_pilot_highlight
  FOR SELECT TO authenticated
  USING (pilot_id = auth.uid());

-- Admin : tout.
DROP POLICY IF EXISTS coach_pilot_highlight_admin_all ON public.coach_pilot_highlight;
CREATE POLICY coach_pilot_highlight_admin_all ON public.coach_pilot_highlight
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- RLS — coach_annotation_template (coach only, jamais pilote)
-- ----------------------------------------------------------------------------

ALTER TABLE public.coach_annotation_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_annotation_template_coach_manage ON public.coach_annotation_template;
CREATE POLICY coach_annotation_template_coach_manage ON public.coach_annotation_template
  FOR ALL TO authenticated
  USING (coach_id = auth.uid() AND is_coach())
  WITH CHECK (coach_id = auth.uid() AND is_coach());

DROP POLICY IF EXISTS coach_annotation_template_admin_all ON public.coach_annotation_template;
CREATE POLICY coach_annotation_template_admin_all ON public.coach_annotation_template
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
