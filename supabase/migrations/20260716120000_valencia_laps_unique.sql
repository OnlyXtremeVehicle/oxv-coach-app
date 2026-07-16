-- ============================================================================
-- Valencia §4.6 (suite) — IDEMPOTENCE des tours.
--
-- NON appliquée automatiquement ; à exécuter en prod par Gabin.
--
-- Problème : `laps` était la SEULE opération non idempotente de la file de
-- synchro de capture, qui est at-least-once par construction. `execLaps` faisait
-- un `.insert()` nu, et les lignes produites par `buildLapRows` ne portent aucun
-- `id` client : le serveur applique `gen_random_uuid()` à chaque insert. Un rejeu
-- ne pouvait donc PAS entrer en collision — il créait des lignes NEUVES.
--
-- Trois chemins de rejeu, tous réels :
--   - réponse HTTP perdue APRÈS le COMMIT (timeout / coupure Wi-Fi au paddock) :
--     l'erreur est classée réseau → l'op est CONSERVÉE et rejouée ;
--   - `deleteOp` raté (suppression best-effort, rejeu assumé au drain suivant) ;
--   - app tuée entre l'exécution de l'op et la suppression de son fichier.
--
-- Conséquence en base : 24 tours pour une séance de 12, `lap_number` dupliqué,
-- `is_best_lap` vrai sur deux lignes, `telemetry_sessions.lap_count` en
-- contradiction, la signature pilote (passportService) calculée sur des chronos
-- comptés double — et `loadLapFrames` (sessionTelemetryService, `.maybeSingle()`
-- sur (session_id, lap_number)) qui ERREUR en « multiple rows returned », donc
-- le détail par tour qui casse en silence. Contrairement aux trames, dont
-- `total_frames` est réconcilié par recomptage, rien ne réconcilie les tours.
--
-- Cette migration applique aux tours le patron déjà retenu pour les trames :
--   1. DÉDOUBLONNE les lignes existantes (garde la ligne au plus petit ctid par
--      couple (session_id, lap_number)) — sans quoi l'ADD CONSTRAINT échouerait
--      s'il existe déjà des doublons, et répare au passage le `.maybeSingle()` ;
--   2. AJOUTE la contrainte UNIQUE, de façon idempotente (garde IF NOT EXISTS
--      via pg_constraint, rejouable sans erreur).
--
-- Côté client, `insertLapsIdempotent` (captureSyncQueue) passe en UPSERT
-- onConflict (session_id, lap_number) ignoreDuplicates, avec la MÊME garde
-- anti-casse que les trames : repli sur insert simple tant que la contrainte
-- n'est pas en prod (42P10), RÉ-ARMÉ dès qu'un 23505 prouve qu'elle est passée.
-- L'ordre d'application n'a donc pas d'importance : le client est correct avant
-- comme après.
--
-- `ignoreDuplicates` est exact ici : l'op porte le lot COMPLET et immuable des
-- tours de la séance — un rejeu est identique à l'original, il n'y a rien à
-- mettre à jour.
--
-- AUDIT PRÉALABLE (le DELETE de l'étape 1 détruit des lignes) — inspecter AVANT :
--   SELECT session_id, lap_number, count(*)
--     FROM public.laps
--    GROUP BY 1, 2 HAVING count(*) > 1;
-- Tout résultat ici est un doublon de rejeu (deux tours réels ne partagent
-- jamais un `lap_number` dans une même séance) : la suppression est sûre.
-- ============================================================================

-- 1. Dédoublonnage : pour chaque couple (session_id, lap_number), on ne garde
--    que la ligne au plus petit ctid.
DELETE FROM public.laps a
USING public.laps b
WHERE a.session_id = b.session_id
  AND a.lap_number = b.lap_number
  AND a.ctid > b.ctid;

-- 2. Contrainte UNIQUE, posée de façon idempotente (rejeu sans erreur).
--    NB : l'index NON unique idx_laps_session (session_id, lap_number) préexiste
--    (cf. 0004_laps_and_circuits.sql) ; la contrainte crée son propre index
--    unique. L'index non unique devient redondant mais est laissé en place (sa
--    suppression est hors périmètre) — même parti pris que pour telemetry_frames.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'laps_session_lap_number_unique'
      AND conrelid = 'public.laps'::regclass
  ) THEN
    ALTER TABLE public.laps
      ADD CONSTRAINT laps_session_lap_number_unique
      UNIQUE (session_id, lap_number);
  END IF;
END $$;

COMMENT ON CONSTRAINT laps_session_lap_number_unique ON public.laps IS
  'Valencia §4.6 : idempotence des tours. Un couple (session_id, lap_number) est unique ; permet l''UPSERT onConflict côté client (captureSyncQueue.insertLapsIdempotent) et bloque la duplication des tours au rejeu de la file de synchro (at-least-once). Répare aussi loadLapFrames, dont le .maybeSingle() sur (session_id, lap_number) erreurait en présence de doublons.';
