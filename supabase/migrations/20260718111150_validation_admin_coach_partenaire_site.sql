-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 11:11:50, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- OXV — Validation admin par élément (arbitrages fondateur 2026-07-18)
-- GO fondateur explicite du 2026-07-18 (« applique et continue »).
-- « Rien n'apparaît dans l'app avant approbation admin » :
--   · partner_accounts   : seul un admin peut passer status='validated'
--   · partner_offers     : seul un admin peut publier ; modification
--     non-admin d'une offre publiée → retour 'draft' (sauf archivage)
--   · coach_availability : seul un admin peut ouvrir un créneau ('open')
-- Aucun changement de schéma, aucune valeur de statut nouvelle.
-- ============================================================

CREATE OR REPLACE FUNCTION public.oxv_partner_accounts_validation_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'validated' THEN
      NEW.status := 'pending';
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'validated' AND OLD.status IS DISTINCT FROM 'validated' THEN
      NEW.status := OLD.status; -- pas d'auto-validation
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_partner_accounts_validation_gate ON public.partner_accounts;
CREATE TRIGGER trg_partner_accounts_validation_gate
  BEFORE INSERT OR UPDATE ON public.partner_accounts
  FOR EACH ROW EXECUTE FUNCTION public.oxv_partner_accounts_validation_gate();

CREATE OR REPLACE FUNCTION public.oxv_partner_offers_publish_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status = 'published' THEN NEW.status := 'draft'; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status = 'published' THEN
        IF NEW.status <> 'archived' THEN NEW.status := 'draft'; END IF; -- re-validation par élément
      ELSIF NEW.status = 'published' THEN
        NEW.status := OLD.status; -- pas d'auto-publication
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_partner_offers_publish_gate ON public.partner_offers;
CREATE TRIGGER trg_partner_offers_publish_gate
  BEFORE INSERT OR UPDATE ON public.partner_offers
  FOR EACH ROW EXECUTE FUNCTION public.oxv_partner_offers_publish_gate();

CREATE OR REPLACE FUNCTION public.oxv_coach_availability_open_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
      NEW.status := 'closed'; -- créneau proposé → en attente de validation OXV
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
      NEW.status := OLD.status; -- ouverture réservée à l'admin
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_coach_availability_open_gate ON public.coach_availability;
CREATE TRIGGER trg_coach_availability_open_gate
  BEFORE INSERT OR UPDATE ON public.coach_availability
  FOR EACH ROW EXECUTE FUNCTION public.oxv_coach_availability_open_gate();
