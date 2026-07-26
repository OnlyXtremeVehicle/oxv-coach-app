-- ============================================================================
-- Valencia §4.6 — IDEMPOTENCE des trames télémétrie.
--
-- NON appliquée automatiquement ; à exécuter en prod par Gabin.
--
-- Problème : `telemetry_frames` n'a pas de contrainte UNIQUE sur
-- (session_id, elapsed_ms). La file de synchro de capture (captureSyncQueue)
-- rejoue des lots au retry réseau → des trames en DOUBLON peuvent apparaître.
-- Cette contrainte rend l'écriture idempotente : côté client, l'UPSERT
-- onConflict (session_id, elapsed_ms) ignore alors proprement les doublons.
--
-- ── PRÉREQUIS CLIENT — À NE PAS IGNORER ────────────────────────────────────
-- Cette contrainte n'est SÛRE qu'à partir de la version d'app qui génère un
-- `elapsed_ms` STRICTEMENT croissant (captureFrameMapping.nextElapsedMs).
--
-- Avant ce correctif, `elapsed_ms` était seulement MONOTONE
-- (`Math.max(now - startMs, lastElapsed)`, ex æquo autorisés). Or le RaceBox
-- livre plusieurs trames par notification BLE, émises dans le même tick
-- synchrone, et un recul d'horloge (resynchro NTP) figeait `elapsed_ms`
-- pendant plusieurs secondes : des trames RÉELLES et DISTINCTES partageaient
-- alors la clé. Posée sur cette génération-là, la contrainte censée protéger
-- aurait DÉTRUIT en silence des trames de pilote (UPSERT DO NOTHING), et le
-- dédoublonnage ci-dessous en aurait supprimé d'autres. Ne pas appliquer cette
-- migration à un parc encore sur une version antérieure.
--
-- ── POURQUOI elapsed_ms ET NON itow_ms ─────────────────────────────────────
-- `itow_ms` (temps GPS du boîtier) a été examiné comme clé : il est identique
-- par construction sur le chemin live ET sur le réimport .ubx. Écarté pour deux
-- raisons dirimantes :
--   1. son unicité est une propriété du BOÎTIER, pas du code — l'iTOW peut se
--      répéter ou rester à 0 avant fix GPS, et se réenroule chaque dimanche à
--      00:00 UTC. Sous ON CONFLICT DO NOTHING, toute répétition = une trame
--      réelle distincte détruite en silence ;
--   2. `itow_ms` est NULLABLE, et en Postgres les NULL sont DISTINCTS : un index
--      total ne dédoublonnerait pas les lignes à iTOW nul, un index partiel les
--      laisserait sans protection, et un SET NOT NULL interdirait toute source
--      de trame future sans iTOW.
-- `elapsed_ms` strict offre au contraire une garantie sous notre contrôle :
-- unique par séance par construction, et stable au rejeu (calculé une seule
-- fois à la capture, sérialisé dans le lot).
-- La cohérence du réimport .ubx est traitée là où est le problème — côté client,
-- dans `reimportUbxToFrames`, qui apparie sur `itow_ms` sans lui faire porter
-- une unicité qu'il ne garantit pas.
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
--
-- AUDIT PRÉALABLE si la table n'est PLUS vide (le DELETE de l'étape 1 détruit
-- des lignes) — inspecter AVANT d'exécuter :
--   SELECT session_id, elapsed_ms, count(*)
--     FROM public.telemetry_frames
--    GROUP BY 1, 2 HAVING count(*) > 1;
-- Des ex æquo ici signalent des trames capturées par une version antérieure du
-- client : ce sont des trames RÉELLES, pas des doublons de rejeu. Ne pas les
-- supprimer sans arbitrage.
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
  'Valencia §4.6 : idempotence des trames. Un couple (session_id, elapsed_ms) est unique ; permet l''UPSERT onConflict côté client (captureSyncQueue) et bloque les doublons au rejeu de la file de synchro. SÛRETÉ : suppose un client générant un elapsed_ms STRICTEMENT croissant (captureFrameMapping.nextElapsedMs) — sans quoi deux trames réelles distinctes peuvent partager la clé et l''une est jetée en silence.';
