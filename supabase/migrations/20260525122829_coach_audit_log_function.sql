-- Feature Coach C — fonction de log d'accès coach aux données pilote
--
-- Permet aux clients (app coach) de logger leurs accès dans admin_audit
-- sans avoir besoin de droits INSERT directs sur la table (réservés admin).
--
-- Sécurité :
--   - SECURITY DEFINER pour bypass les RLS admin_audit
--   - Vérifie que auth.uid() est bien coach actif de target_pilot_id
--     (sinon refuse → empêche un user de bombarder les logs avec de faux events)
--   - GRANT EXECUTE TO authenticated uniquement (pas anon)
--   - search_path fixé (anti-injection)

CREATE OR REPLACE FUNCTION public.log_coach_view(
  target_pilot_uuid UUID,
  action_subtype TEXT DEFAULT 'coach_view',
  target_session_uuid UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_authorized BOOLEAN;
BEGIN
  -- Vérifier que l'appelant est bien coach de ce pilote
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_pilots
    WHERE coach_id = auth.uid()
      AND pilot_id = target_pilot_uuid
      AND active = true
      AND pilot_consent_at IS NOT NULL
  ) INTO is_authorized;

  IF NOT is_authorized THEN
    -- Pas de RAISE : on no-op silencieusement pour ne pas exposer l'info
    -- "ce pilote n'existe pas / vous n'êtes pas son coach" à un attaquant
    RETURN;
  END IF;

  INSERT INTO public.admin_audit (user_id, action, metadata)
  VALUES (
    auth.uid(),
    action_subtype,
    jsonb_build_object(
      'target_pilot_id', target_pilot_uuid,
      'target_session_id', target_session_uuid
    )
  );
END;
$$;

COMMENT ON FUNCTION public.log_coach_view(UUID, TEXT, UUID) IS
  'Loggue un accès coach aux données pilote dans admin_audit. Vérifie d''abord que auth.uid() est bien coach actif et consenti.';

REVOKE EXECUTE ON FUNCTION public.log_coach_view(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_coach_view(UUID, TEXT, UUID) TO authenticated;
