-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 30 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Anti double-inscription : remplace la contrainte unique TOTALE (user_id, session_id)
-- par un index unique PARTIEL excluant les inscriptions annulées.
-- Permet à un pilote de se réinscrire à une session qu'il avait annulée,
-- tout en interdisant deux inscriptions actives simultanées. (PR-SITE-06)
-- Sûr : 0 doublon existant vérifié au préalable.
alter table public.registrations drop constraint if exists registrations_user_id_session_id_key;

create unique index if not exists registrations_user_session_active_uniq
  on public.registrations (user_id, session_id)
  where status <> 'cancelled';
