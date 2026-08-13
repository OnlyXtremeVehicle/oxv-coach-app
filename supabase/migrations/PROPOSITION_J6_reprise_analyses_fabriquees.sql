-- =============================================================================
-- PROPOSITION — reprendre les analyses de marge, plutôt que renommer leur clé
-- =============================================================================
--
-- NON APPLIQUÉE. Elle EFFACE des lignes ; c'est au fondateur.
--
-- Elle REMPLACE `20260813233000_j6_margin_breakdown_consistency.sql`, qui
-- renommait la clé `regularity` en `consistency` sur quatorze lignes. Ce fichier
-- a été supprimé, pour deux raisons données par le fondateur puis vérifiées :
--
--   1. l'`upsert` de recalcul réécrit `margin_breakdown` EN ENTIER. Renommer une
--      clé sur un objet destiné à être remplacé est un travail perdu ;
--   2. le déploiement de la fonction serveur doit porter la CLÉ ET LA FORMULE
--      d'un seul coup. Déployer le renommage seul obligeait à redéployer dans la
--      semaine.
--
-- -----------------------------------------------------------------------------
-- CE QUE LES QUATORZE LIGNES CONTIENNENT RÉELLEMENT — mesuré le 14/08/2026
-- -----------------------------------------------------------------------------
--
--   • CINQ portent `margin_global = 100.00` ;
--   • TREIZE portent `margin_pilot = 100.00` — la valeur par défaut de la
--     fonction serveur, conservée quand la séance n'a pas deux tours valides ;
--   • TROIS ont `telemetry_sessions.max_g_lateral IS NULL` et pourtant
--     `margin_vehicle = 100.00` — le `?? 0` lu comme « zéro g observé » ;
--   • plusieurs portent des G latéraux de 5 à 6,7 g, physiquement impossibles
--     pour une voiture de route : de la donnée de test.
--
-- UNE SEULE séance porte des tours valides, et c'est Bouteville. Autrement dit :
-- treize de ces quatorze analyses ne mesurent rien. Ce ne sont pas des chiffres
-- justes qu'il faudrait renommer, ce sont des valeurs par défaut persistées.
--
-- Les trois défauts qui les ont produites sont corrigés dans le code du
-- 14/08 — marge pilote, marge véhicule et constance rendent désormais `null`
-- plutôt qu'une valeur d'attente, et la fonction n'écrit plus rien quand une
-- composante manque.
--
-- -----------------------------------------------------------------------------
-- CE QUE FAIT CETTE MIGRATION
-- -----------------------------------------------------------------------------
--
-- Elle vide la marge des lignes fabriquées SANS les supprimer : le reste de la
-- ligne — `qdi`, `debrief_text`, `next_focus_*` — est conservé. La fonction
-- serveur, une fois redéployée, les reprendra au prochain passage horaire
-- (elle balaye les séances dont `margin_global IS NULL`) et n'écrira que ce
-- qu'elle peut réellement calculer.
--
-- ORDRE IMPÉRATIF : déployer la fonction D'ABORD. Appliquée avant, cette
-- migration ferait recalculer les lignes par l'ANCIEN code, qui les
-- refabriquerait à l'identique.
-- =============================================================================

UPDATE public.app_session_analyses a
SET margin_global   = NULL,
    margin_zone     = NULL,
    margin_vehicle  = NULL,
    margin_pilot    = NULL,
    margin_breakdown = NULL
WHERE
  -- Aucune des deux composantes ne peut avoir été mesurée : pas deux tours
  -- valides, ou pas de G latéral de séance.
  (
    (SELECT count(*) FROM public.laps l
      WHERE l.session_id = a.telemetry_session_id
        AND l.is_outlap = false AND l.is_inlap = false
        AND l.duration_seconds > 0) < 3
    OR (SELECT ts.max_g_lateral FROM public.telemetry_sessions ts
         WHERE ts.id = a.telemetry_session_id) IS NULL
  );

-- Contrôle : ce qui reste doit être calculable. Si une ligne survit sans avoir
-- trois tours valides ET un G latéral, la clause ci-dessus est à revoir.
DO $$
DECLARE
  survivantes integer;
BEGIN
  SELECT count(*) INTO survivantes
  FROM public.app_session_analyses a
  WHERE a.margin_global IS NOT NULL
    AND (
      (SELECT count(*) FROM public.laps l
        WHERE l.session_id = a.telemetry_session_id
          AND l.is_outlap = false AND l.is_inlap = false
          AND l.duration_seconds > 0) < 3
      OR (SELECT ts.max_g_lateral FROM public.telemetry_sessions ts
           WHERE ts.id = a.telemetry_session_id) IS NULL
    );

  IF survivantes > 0 THEN
    RAISE EXCEPTION 'reprise des marges : % ligne(s) gardent une marge non calculable', survivantes;
  END IF;
END $$;
