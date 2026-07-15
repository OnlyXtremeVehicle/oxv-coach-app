-- ============================================================================
-- Valencia §4.6 — IDEMPOTENCE des trames télémétrie.
--
-- NON appliquée automatiquement ; à exécuter en prod par Gabin.
--
-- Problème (audit §4.6) : `telemetry_frames` n'a pas de contrainte UNIQUE sur
-- (session_id, elapsed_ms). La file de synchro de capture (captureSyncQueue)
-- rejoue des lots au retry réseau → des trames en DOUBLON peuvent apparaître.
-- Cette contrainte rend l'écriture idempotente : côté client, l'UPSERT
-- onConflict (session_id, elapsed_ms) ignore alors proprement les doublons.
--
-- Cette migration :
--   1. DÉDOUBLONNE les lignes existantes (garde une seule ligne par couple
--      (session_id, elapsed_ms), au plus petit ctid) — sans quoi l'ajout de la
--      contrainte échouerait s'il existait déjà des doublons ;
--   2. AJOUTE la contrainte UNIQUE (idempotente : garde IF NOT EXISTS via
--      pg_constraint, pour pouvoir être rejouée sans erreur).
--
-- La table est vide en prod avant Valence (07/2026) : le dédoublonnage est un
-- no-op au moment prévu de l'exécution, mais reste nécessaire par sûreté.
-- ============================================================================

-- 1. Dédoublonnage : idiome standard Postgres. Pour chaque couple
--    (session_id, elapsed_ms), on ne garde que la ligne au plus petit ctid ;
--    toute ligne au ctid supérieur d'un même couple est supprimée.
DELETE FROM public.telemetry_frames a
USING public.telemetry_frames b
WHERE a.session_id = b.session_id
  AND a.elapsed_ms = b.elapsed_ms
  AND a.ctid > b.ctid;

-- 2. Contrainte UNIQUE, posée de façon idempotente (rejeu sans erreur).
--    NB : un index NON unique idx_telemetry_frames_session (session_id, elapsed_ms)
--    préexiste ; la contrainte crée son propre index unique. L'index non unique
--    devient redondant mais est laissé en place (sa suppression est hors périmètre).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'telemetry_frames_session_elapsed_unique'
      AND conrelid = 'public.telemetry_frames'::regclass
  ) THEN
    ALTER TABLE public.telemetry_frames
      ADD CONSTRAINT telemetry_frames_session_elapsed_unique
      UNIQUE (session_id, elapsed_ms);
  END IF;
END $$;

COMMENT ON CONSTRAINT telemetry_frames_session_elapsed_unique ON public.telemetry_frames IS
  'Valencia §4.6 : idempotence des trames. Un couple (session_id, elapsed_ms) est unique ; permet l''UPSERT onConflict côté client (captureSyncQueue) et bloque les doublons au rejeu de la file de synchro.';
