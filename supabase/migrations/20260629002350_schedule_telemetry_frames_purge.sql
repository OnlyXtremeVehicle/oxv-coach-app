-- PR-49 / decision Gabin 2026-06-29 : planification de la purge des trames
-- brutes de plus de 12 mois (retention ~1 saison, fenetre glissante). La fonction
-- public.cleanup_old_telemetry_frames() existe deja (migration retention). Execution
-- quotidienne a 03h30 UTC. Idempotent : cron.schedule remplace le job s'il porte
-- deja ce nom. Les analyses / segments / insights / laps DERIVES sont conserves.
select cron.schedule(
  'cleanup-telemetry-frames',
  '30 3 * * *',
  $$ select public.cleanup_old_telemetry_frames(); $$
);
