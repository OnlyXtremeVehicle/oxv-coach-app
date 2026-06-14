-- ============================================================================
-- FUITE PII (RGPD art. 5/32) : public.sessions est le calendrier PUBLIC des
-- roulages (policy sessions_select_public USING(true), rôle public/anon). La RLS
-- filtre les LIGNES, pas les COLONNES : un visiteur non authentifié peut donc
-- lire private_client_name + private_client_contact (nom + coordonnées des
-- clients de roulages privés) via `select *`.
--
-- Correctif column-level : on retire le privilège SELECT sur ces 2 colonnes
-- pour anon + authenticated. Le calendrier public reste lisible ; `select *`
-- n'expose plus la PII. service_role (backend) conserve l'accès complet.
--
-- ⚠️⚠️ NE PAS APPLIQUER SANS COORDINATION SITE ⚠️⚠️
-- Décision Gabin (2026-06-14) : « À vérifier ». Si oxvehicle.fr lit ces colonnes
-- côté FRONT avec la clé anon/authenticated, ce REVOKE casse la vue admin du
-- site. Avant apply : confirmer que le site lit private_client_* via
-- service_role (backend) OU une RPC admin (is_admin()). Même précaution que la
-- migration 20260614023457 (oxvehicle.fr/share). Cette migration reste DANS LE
-- REPO mais hors application tant que ce point n'est pas tranché.
-- ============================================================================

REVOKE SELECT (private_client_name, private_client_contact)
  ON public.sessions FROM anon, authenticated;
