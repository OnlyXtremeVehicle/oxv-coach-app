-- LE JOB 5 CESSE DE VISER UN MOTEUR RETIRÉ.
--
-- « compute-insights-hourly » postait {"all_pending": true} à
-- `compute-session-insights` (v1). Il était doublement mort, mesuré le
-- 05/09/2026 :
--
--   • la cible est en verify_jwt = true et le job n'envoie aucun JWT
--     → 401 UNAUTHORIZED_NO_AUTH_HEADER, six fois sur six en six heures ;
--   • et v1 n'a JAMAIS eu de mode `all_pending` : elle lit { sessionId } et
--     rend 400 sans lui. Même authentifié, il aurait répondu « sessionId
--     requis ». Il n'a donc jamais pu fonctionner, dans aucune configuration.
--
-- Piège à connaître : `cron.job_run_details` donnait « succeeded » pour ce job.
-- pg_cron dit vrai à sa façon — il a mis la requête en file. L'échec ne se lit
-- que dans `net._http_response`.
--
-- Il vise désormais `cron-analyze-pending-sessions`, qui EST déjà la porte du
-- cron : verify_jwt = false, contrôle de jeton fail-closed depuis la version 25,
-- et clé de service dans son environnement. Son mode `insights` balaye les
-- séances SEGMENTÉES sans lecture v3 et appelle `compute-session-insights-v3`
-- par `functions.invoke`, donc en appelant autorisé.
--
-- Aucune porte publique nouvelle : v3 garde verify_jwt = true et son code n'est
-- pas touché.
--
-- CONSÉQUENCE À CONNAÎTRE : `unschedule` puis `schedule` crée une NOUVELLE
-- ligne. Le travail s'appelle toujours « compute-insights-hourly » mais porte
-- désormais le `jobid` 14, plus le 5. Tout document qui le nomme par son
-- numéro est périmé.
select cron.unschedule('compute-insights-hourly');

select cron.schedule(
  'compute-insights-hourly',
  '30 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/cron-analyze-pending-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_token')
    ),
    body := '{"mode": "insights"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
