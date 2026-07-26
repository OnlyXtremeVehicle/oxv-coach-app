-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 00:12:10 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-07 : email retour J+1, quotidien 07:00 UTC. Dormant sans secrets. Idempotent.
select cron.unschedule('oxv-feedback-requests')
where exists (select 1 from cron.job where jobname = 'oxv-feedback-requests');
select cron.schedule(
  'oxv-feedback-requests',
  '0 7 * * *',
  $$
  select net.http_post(
    url := oxv_get_secret('edge_functions_base_url') || '/feedback-request',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret', oxv_get_secret('edge_functions_invoke_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
