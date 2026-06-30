-- =============================================================================
-- OXV — Anti double-inscription : contrainte unique partielle sur registrations
-- =============================================================================
-- Coordination site <-> Supabase (PR-SITE-06).
-- Remplace la contrainte unique TOTALE (user_id, session_id) par un index unique
-- PARTIEL excluant les inscriptions annulées : un pilote peut se réinscrire à une
-- session qu'il avait annulée, mais pas avoir deux inscriptions actives.
-- Sûr : 0 doublon (user_id, session_id) existant vérifié avant application.
-- =============================================================================

alter table public.registrations drop constraint if exists registrations_user_id_session_id_key;

create unique index if not exists registrations_user_session_active_uniq
  on public.registrations (user_id, session_id)
  where status <> 'cancelled';
