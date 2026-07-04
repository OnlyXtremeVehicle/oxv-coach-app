-- QDI 5 branches (Lot M1, décision fondateur 2026-07-04, spec QDI_CARTOGRAPHIE_M1).
-- APPLIQUÉE en production le 2026-07-04 via MCP — ne pas ré-exécuter.
-- Additif strict : une colonne jsonb sur la table d'analyse existante.
-- Contenu : { trajectoire, fluidite, freinage, acceleration, regularite,
--             algo_version, computed_at, reference: { sessions, circuit } }
-- Valeurs 0-100 par branche (null = pas assez de données, honnêteté).
-- RLS inchangée (own-row + coach consenti + admin, policies existantes).
alter table public.app_session_analyses
  add column if not exists qdi jsonb;
