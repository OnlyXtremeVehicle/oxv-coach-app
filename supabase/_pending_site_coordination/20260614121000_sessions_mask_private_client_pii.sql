-- ============================================================================
-- FUITE PII (RGPD art. 5/32) : public.sessions est le calendrier PUBLIC des
-- roulages (policy sessions_select_public USING(true), rôle public/anon). La RLS
-- filtre les LIGNES, pas les COLONNES : un visiteur non authentifié peut donc
-- lire private_client_name + private_client_contact (nom + coordonnées des
-- clients de roulages privés) via `select *`.
--
-- ⚠️ POURQUOI PAS UN SIMPLE `REVOKE SELECT (col) ...` :
-- En PostgreSQL, un REVOKE au niveau COLONNE est un NO-OP tant qu'un privilège
-- SELECT au niveau TABLE existe (et anon en détient un — c'est ce qui fait
-- fonctionner le calendrier public). Le masquage par colonne exige donc de :
--   1) retirer le SELECT table-level pour anon/authenticated,
--   2) re-GRANT SELECT sur les SEULES colonnes non-PII.
-- Le GRANT ci-dessous est DYNAMIQUE (lit information_schema) pour couvrir toutes
-- les colonnes réelles sans en oublier (database.types.ts est périmé : 18 col
-- listées vs 44 réelles d'après docs/architecture/05).
--
-- ⚠️⚠️ NE PAS APPLIQUER SANS COORDINATION SITE ⚠️⚠️
-- Décision Gabin (2026-06-14) : « À vérifier ». Conséquences à confirmer AVANT :
--   - Si oxvehicle.fr lit sessions via la clé anon/authenticated en faisant un
--     `select *`, il CASSERA (le * inclut les colonnes révoquées). Le site doit
--     soit lister ses colonnes explicitement, soit lire private_client_* via
--     service_role/RPC admin.
--   - Toute colonne AJOUTÉE après cette migration ne sera pas auto-couverte par
--     le GRANT : la rejouer (ou ajouter la colonne au GRANT) après un ADD COLUMN.
-- Même précaution que 20260614023457 (oxvehicle.fr/share). Fichier hors
-- supabase/migrations/ pour qu'aucun db push ne l'applique par accident.
-- ============================================================================

-- 1) Retire le privilège SELECT table-level (sinon le REVOKE colonne est ignoré).
REVOKE SELECT ON public.sessions FROM anon, authenticated;

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
    RAISE EXCEPTION 'public.sessions introuvable ou sans colonne — migration PII annulée';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON public.sessions TO anon, authenticated',
    safe_cols
  );
END
$$;

-- service_role (backend site oxvehicle.fr) conserve l'accès complet (non révoqué).
