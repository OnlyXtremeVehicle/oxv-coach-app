-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 30 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-SITE-02 : durcissement défense-en-profondeur.
-- anon n'écrit jamais ces tables (déjà bloqué par RLS, aucune policy anon en écriture).
-- On retire les privilèges d'écriture dormants pour éviter tout risque futur.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payments      FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.registrations FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.users         FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sessions      FROM anon;
