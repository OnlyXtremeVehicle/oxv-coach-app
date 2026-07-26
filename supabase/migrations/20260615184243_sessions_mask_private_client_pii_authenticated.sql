-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 a 18:42 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Durcissement « Option B » : masque private_client_name / private_client_contact
-- aux pilotes connectes (role authenticated), admin garde la lecture via RPC
-- SECURITY DEFINER gardee par is_admin(). anon non touche (deja via vue
-- sessions_public). Verifie en prod : authenticated detient un SELECT table-level
-- DIRECT (aucun grant PUBLIC) -> le REVOKE ci-dessous est effectif.

-- 1) Retire le SELECT table-level pour authenticated (sinon REVOKE colonne ignore).
REVOKE SELECT ON public.sessions FROM authenticated;

-- 2) Re-accorde SELECT sur toutes les colonnes SAUF les 2 colonnes PII.
DO $$
DECLARE
  safe_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO safe_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'sessions'
    AND column_name NOT IN ('private_client_name', 'private_client_contact');

  IF safe_cols IS NULL THEN
    RAISE EXCEPTION 'public.sessions introuvable ou sans colonne — migration PII annulee';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON public.sessions TO authenticated',
    safe_cols
  );
END
$$;

-- 3) Porte unique pour l'admin : RPC SECURITY DEFINER gardee par is_admin().
CREATE OR REPLACE FUNCTION public.get_session_private_client(p_session_id uuid)
RETURNS TABLE (
  private_client_name    text,
  private_client_contact text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN; -- non-admin -> aucune ligne
  END IF;

  RETURN QUERY
  SELECT s.private_client_name::text, s.private_client_contact::text
  FROM public.sessions s
  WHERE s.id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_session_private_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_private_client(uuid) TO authenticated;
