-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 3 juillet 2026 a 20:13:30 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-02 : relances éligibilité quotidiennes (J-14/J-7/J-2) à 06:00 UTC via pg_cron.
-- Dormant sans secrets vault (la fonction edge refuse sans secret). Idempotent (unschedule si existe).
select cron.unschedule('oxv-eligibility-reminders')
where exists (select 1 from cron.job where jobname = 'oxv-eligibility-reminders');
select cron.schedule(
  'oxv-eligibility-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := oxv_get_secret('edge_functions_base_url') || '/eligibility-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret', oxv_get_secret('edge_functions_invoke_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
