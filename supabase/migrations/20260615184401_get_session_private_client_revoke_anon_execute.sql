-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 a 18:44 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Least-privilege : les default privileges Supabase ont auto-accorde EXECUTE a
-- anon a la creation de la fonction. Le corps est deja garde par is_admin()
-- (anon -> 0 ligne), mais anon ne doit pas pouvoir l'appeler du tout : la PII
-- n'est lisible QUE par l'admin. On retire EXECUTE a anon (et re-REVOKE PUBLIC).
REVOKE EXECUTE ON FUNCTION public.get_session_private_client(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_session_private_client(uuid) FROM PUBLIC;
