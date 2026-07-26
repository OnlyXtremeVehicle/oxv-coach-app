-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 14:04:26, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- OXV — Verrou partner_accounts : passage service_role
-- La création du compte entreprise par validate-inscription (v10)
-- intervient APRÈS validation humaine de la candidature par l'admin :
-- le service_role (edge function, jamais exposé client) est donc
-- traité comme la voie admin. Les clients (anon/authenticated)
-- restent verrouillés comme avant (testé le 2026-07-18).
-- ============================================================
CREATE OR REPLACE FUNCTION public.oxv_partner_accounts_validation_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'validated' THEN
      NEW.status := 'pending';
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'validated' AND OLD.status IS DISTINCT FROM 'validated' THEN
      NEW.status := OLD.status; -- pas d'auto-validation
    END IF;
  END IF;
  RETURN NEW;
END $$;
