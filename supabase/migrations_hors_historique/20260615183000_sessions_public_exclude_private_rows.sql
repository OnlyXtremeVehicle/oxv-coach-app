-- Discretion OXV : le planning public ne surface plus les journees privatisees.
-- La vue sessions_public (cf. 20260614120000) masquait deja les colonnes PII mais
-- laissait visibles les LIGNES is_private=true (sans PII). On les exclut desormais :
-- la vue publique ne montre que les creneaux reservables.
--
-- Aucun consommateur public n'a besoin des lignes privees : le wizard de reservation
-- filtre deja is_private=false ; les pilotes et l'admin lisent la table de base, pas
-- la vue. Filtrer au niveau de la VUE (et non du code site) garantit que tout futur
-- consommateur de sessions_public herite de la regle (coherent avec le multi-circuits).
--
-- Appliquee en prod via le SQL Editor le 2026-06-15 (hors apply_migration, comme
-- 20260614120000_secure_sessions_public_calendar.sql). Idempotente (CREATE OR REPLACE).
-- Verifie : 44 lignes de base, 2 privees -> 42 lignes dans la vue, 0 privee.

CREATE OR REPLACE VIEW public.sessions_public
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
FROM public.sessions
WHERE is_private IS NOT TRUE;
