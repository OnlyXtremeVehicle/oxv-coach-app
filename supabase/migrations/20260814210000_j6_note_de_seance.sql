-- =============================================================================
-- APPLIQUÉE le 14/08/2026 — autoriser une note de SÉANCE dans `coach_annotations`
-- =============================================================================
--
-- APPLIQUÉE le 14/08/2026, sur accord du fondateur. (Était : NON APPLIQUÉE.) Elle élargit une contrainte de vérification ; c'est du schéma.
--
-- -----------------------------------------------------------------------------
-- CE QUE LE PLAN DEMANDE
--
-- *« `rapport` devient la composition de la carte de séance — le PDF reste un
-- export, plus le produit. »* — jalon 6, phase 5.
--
-- Aujourd'hui, `app/(coach)/rapport.tsx` fait l'inverse : le coach rédige son
-- bilan, l'écran génère un PDF, et **le bilan n'est stocké nulle part** — il
-- voyage dans le document. Le produit EST le PDF. Si le pilote perd le fichier,
-- le bilan de sa séance n'existe plus.
--
-- Et le critère d'acceptation n° 3 du jalon — *« une carte de séance est-elle
-- reçue par un pilote, avec l'audio ? »* — ne peut pas être satisfait : rien
-- n'est reçu, quelque chose est partagé.
--
-- -----------------------------------------------------------------------------
-- POURQUOI CETTE MIGRATION EXISTE PLUTÔT QU'UN SIMPLE CÂBLAGE
--
-- `coach_annotations` semblait convenir : `telemetry_session_id` y est présent,
-- `corner_index` est nullable, et la table porte déjà `audio_url`. La carte de
-- séance paraissait tenir sans une ligne de schéma.
--
-- LE CHECK DIT NON, et il fallait le lire :
--
--     coach_annotations_virage_note_ou_marqueur
--     CHECK ( (corner_index IS NULL AND marker_elapsed_ms IS NOT NULL)
--          OR (corner_index BETWEEN 1 AND 30) )
--
-- `corner_index` nul n'est permis QUE pour un marqueur horodaté. Une note qui
-- porte sur la séance entière — sans virage et sans instant — est refusée.
--
-- Le typage ne voyait rien : l'insertion est castée. C'est le même piège que le
-- 02/08 sur cette même table, et que le 01/08 sur `purge_user_data`.
--
-- -----------------------------------------------------------------------------
-- CE QUE LA CONTRAINTE ÉLARGIE AUTORISE, ET RIEN DE PLUS
--
-- Trois formes, exclusives :
--
--   1. note de virage      — `corner_index` entre 1 et 30 ;
--   2. marqueur horodaté   — `corner_index` nul, `marker_elapsed_ms` présent ;
--   3. NOTE DE SÉANCE      — les deux nuls, mais `telemetry_session_id`
--                            PRÉSENT et un texte non vide.
--
-- La troisième forme exige la séance : sans elle, on créerait une note qui ne
-- porte sur rien — ni virage, ni instant, ni séance. La contrainte l'interdit
-- plutôt que de compter sur l'appelant.
--
-- Le texte reste obligatoire pour cette forme : une carte de séance vide n'est
-- pas une carte de séance. L'audio, lui, reste facultatif — `audio_url` existe
-- déjà et n'a pas à être dupliqué.
--
-- -----------------------------------------------------------------------------
-- CE QU'ELLE NE CHANGE PAS
--
-- Aucune colonne ajoutée, aucune RLS touchée. La politique pilote lit déjà
-- `visibility = 'shared'` et rien d'autre : une note de séance privée reste
-- privée, exactement comme une note de virage.
-- =============================================================================

ALTER TABLE public.coach_annotations
  DROP CONSTRAINT IF EXISTS coach_annotations_virage_note_ou_marqueur;

ALTER TABLE public.coach_annotations
  ADD CONSTRAINT coach_annotations_virage_note_ou_marqueur CHECK (
    -- 1. note de virage
    (corner_index BETWEEN 1 AND 30)
    -- 2. marqueur horodaté, sans virage
    OR (corner_index IS NULL AND marker_elapsed_ms IS NOT NULL)
    -- 3. note de SÉANCE : ni virage ni instant, mais une séance et un texte
    OR (
      corner_index IS NULL
      AND marker_elapsed_ms IS NULL
      AND telemetry_session_id IS NOT NULL
      AND length(body) >= 1
    )
  );

-- -----------------------------------------------------------------------------
-- VÉRIFICATION APRÈS APPLICATION — les trois formes passent, la quatrième non.
--
--   begin;
--     -- doit ÉCHOUER : ni virage, ni instant, ni séance
--     insert into public.coach_annotations
--       (coach_id, pilot_id, body, visibility)
--     values (auth.uid(), auth.uid(), 'orpheline', 'private');
--   rollback;
--
-- ANNULATION : rétablir la contrainte à deux branches (voir en-tête).
-- -----------------------------------------------------------------------------
