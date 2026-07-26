-- Corrige une fuite RGPD : la policy sessions_select_public (FOR SELECT TO public
-- USING (true)) rend le calendrier de roulage lisible par tous — c'est voulu pour
-- les dates/capacités/statut (le site oxvehicle.fr l'affiche). MAIS RLS filtre les
-- LIGNES, jamais les COLONNES : avec la clé anon (publique, embarquée dans le JS du
-- site), n'importe qui peut `GET /rest/v1/sessions?select=*` et récupérer les
-- colonnes PII des privatisations sur les 44 lignes :
--   private_client_name, private_client_contact.
--
-- Le fix doit restreindre les COLONNES. On écarte le REVOKE de colonnes (Option 1) :
-- l'admin lit private_client_name EN TANT QUE rôle `authenticated` (client anon-key
-- + JWT admin, RLS sessions_admin_all USING(is_admin())), pas via service_role. Or un
-- grant de colonne s'applique au rôle, et « admin » n'est pas un rôle Postgres séparé
-- — c'est un `authenticated` qui satisfait is_admin(). Révoquer la colonne à
-- `authenticated` casserait l'écran admin Médias du site ; ne la révoquer qu'à `anon`
-- laisserait tout pilote connecté lire le PII.
--
-- Option retenue (validée par Gabin) — projection publique scopée, même esprit que
-- la fonction SECURITY DEFINER de 20260614023457_secure_progression_share_read.sql :
--   1. Vue public.sessions_public = toutes les colonnes SAUF les 2 colonnes PII.
--   2. DROP de la policy sessions_select_public sur la table de base → anon et
--      pilotes connectés (non-admin) ne lisent plus DU TOUT la table sessions.
--   3. La policy sessions_admin_all (FOR ALL TO authenticated USING(is_admin()))
--      reste intacte → l'admin garde l'accès complet (dont le PII) via la table.
--
-- Périmètre d'impact :
--   - App mobile OXV Mirror : AUCUN (elle ne lit jamais `sessions`, seulement
--     `telemetry_sessions`).
--   - Site oxvehicle.fr : le calendrier public et le helper OXVApi.sessions.list()
--     doivent lire `sessions_public` au lieu de `sessions` (voir PR repo oxv-site).
--     L'écran admin Médias (select private_client_name) reste sur `sessions` et
--     continue de fonctionner pour les is_admin().
--
-- ⚠️ Note advisor Supabase : la vue est volontairement en SECURITY DEFINER
-- (security_invoker = false) — c'est ce qui lui permet de projeter des lignes que
-- `anon` ne peut plus lire en direct. C'est INTENTIONNEL et sûr ici : la vue
-- n'expose que des colonnes non sensibles. Ne pas la « corriger » en invoker (cf.
-- 20260525111333_security_hardening.sql §1) — ça la rendrait vide pour anon.
--
-- ⚠️ Colonne `notes` : conservée dans la vue (elle était déjà publique via
-- select('*')). Si elle contient des remarques internes admin, l'exclure aussi —
-- décision produit à part, hors périmètre de ce correctif PII.

-- ============================================================================
-- 1. Vue publique sans les colonnes PII
-- ============================================================================

DROP VIEW IF EXISTS public.sessions_public;

CREATE VIEW public.sessions_public
  WITH (security_invoker = false) AS
SELECT
  id,
  date,
  start_time,
  end_time,
  format,
  season_type,
  status,
  weather_status,
  is_private,
  max_capacity,
  capacity_access,
  capacity_morning,
  capacity_afternoon,
  capacity_promotion,
  capacity_signature,
  available_offers,
  notes,
  created_at
FROM public.sessions;

COMMENT ON VIEW public.sessions_public IS
  'Projection publique du calendrier de roulage : toutes les colonnes de '
  'public.sessions SAUF private_client_name et private_client_contact (PII des '
  'privatisations). SECURITY DEFINER volontaire (security_invoker=false) pour '
  'rester lisible par anon après le retrait de sessions_select_public sur la '
  'table de base. Voir migration 20260614120000.';

-- ============================================================================
-- 2. Exposition de la vue à anon + authenticated (et seulement SELECT)
-- ============================================================================

REVOKE ALL ON public.sessions_public FROM PUBLIC;
GRANT SELECT ON public.sessions_public TO anon, authenticated;

-- ============================================================================
-- 3. Retrait de l'accès public en lecture sur la table de base
-- ============================================================================
-- Après ce DROP, plus aucune policy SELECT ne s'applique à anon ni aux pilotes
-- connectés non-admin → la table `sessions` leur renvoie 0 ligne. Seuls les
-- is_admin() la lisent (policy sessions_admin_all, inchangée).

DROP POLICY IF EXISTS sessions_select_public ON public.sessions;

-- Défense en profondeur : anon ne doit JAMAIS lire la table de base en direct
-- (il passe exclusivement par la vue). Même si une future policy USING(true)
-- réapparaissait, anon resterait sans privilège colonne sur la table.
-- `authenticated` conserve son grant : l'admin (authenticated + is_admin) en a
-- besoin pour lire le PII via sessions_admin_all.
REVOKE SELECT ON public.sessions FROM anon;
