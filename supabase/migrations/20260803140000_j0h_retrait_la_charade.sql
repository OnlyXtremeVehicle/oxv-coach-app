-- =============================================================================
-- JALON 0, POINT 0.H — RETRAIT DU CIRCUIT « LA CHARADE »
--
-- Appliquée le 03/08/2026, sur décision explicite du fondateur.
-- =============================================================================
--
-- CE QUE C'ÉTAIT
--
-- Une fiche PRIVÉE créée le 16/05/2026, sans tracé, sans centerline, sans
-- virages, sans longueur. Sa ligne d'arrivée tombe à une centaine de mètres de
-- celle de Haute Saintonge : un doublon d'essai, jamais un circuit.
--
-- Elle n'était pas inerte pour autant. `src/utils/lapDetection.ts:25` la cite
-- comme LE cas qui justifie le repli en mode rayon — « La charade a
-- finish_line_heading NULL » — c'est-à-dire qu'une fiche d'essai servait de
-- référence documentaire au comportement du moteur de détection de tours.
--
-- VÉRIFICATIONS FAITES AVANT, PAS APRÈS
--
-- 1. Sauvegarde : `supabase/sauvegardes/la_charade_20260803_avant_suppression.sql`
--    contient la ligne complète et la marche à suivre pour revenir en arrière.
--    Règle 0.5 : aucune suppression sans sauvegarde vérifiée.
--
-- 2. D-24 — balayage des corps de fonctions. `plpgsql` ne vérifie pas
--    l'existence des tables ni des lignes à la création : une suppression peut
--    casser une fonction sans que rien ne le dise. C'est arrivé le 01/08 avec
--    `duels` et `purge_user_data`. Requête passée :
--
--      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname not in ('pg_catalog','information_schema')
--         and p.prokind = 'f'
--         and pg_get_functiondef(p.oid) ilike '%charade%';
--      → aucune ligne.
--
-- 3. Les DIX tables qui référencent `circuits` par clé étrangère ont été
--    comptées une par une. Une seule portait une référence :
--    `telemetry_sessions`, une ligne. Les neuf autres à zéro.
--
--    À noter : `sessions.circuit_id` est en NO ACTION — elle aurait BLOQUÉ la
--    suppression si elle avait porté une ligne. Elle n'en portait aucune.
--
-- POURQUOI DÉTACHER PLUTÔT QUE LAISSER LA CASCADE FAIRE
--
-- `telemetry_sessions.circuit_id` est en ON DELETE SET NULL : la suppression
-- aurait suffi. On détache explicitement quand même, parce que l'ordre importe
-- pour qui relira : la séance perd son lien AVANT que la fiche disparaisse, et
-- `circuit_name` — déjà renseigné à « La charade » — reste. Le pilote continue
-- de lire le nom du lieu où il a roulé ; seule la fiche fantôme s'en va.
-- =============================================================================

-- 1. Détacher la séance. Le nom reste : rien de ce que le pilote voit ne bouge.
update public.telemetry_sessions
   set circuit_id = null
 where circuit_id = 'ed3ce247-040d-45a8-925c-ba7e5c1f7cde';

-- 2. Retirer la fiche.
delete from public.circuits
 where id = 'ed3ce247-040d-45a8-925c-ba7e5c1f7cde';

-- =============================================================================
-- APRÈS APPLICATION — CE QU'IL FAUT VOIR
--
--   select count(*) from public.circuits where name ilike '%charade%';  -- 0
--   select circuit_id, circuit_name from public.telemetry_sessions
--    where id = 'f13545a1-21a4-4d0d-86e2-914047ea33e1';
--   -- attendu : circuit_id NULL, circuit_name toujours « La charade »
-- =============================================================================
