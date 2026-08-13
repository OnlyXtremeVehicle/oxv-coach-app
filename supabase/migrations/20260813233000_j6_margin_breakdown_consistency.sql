-- =============================================================================
-- margin_breakdown : la clé `regularity` devient `consistency`
-- =============================================================================
--
-- POURQUOI
--
-- `app_session_analyses` porte deux colonnes voisines, `qdi` et
-- `margin_breakdown`. Sur la séance de Bouteville du 13/08/2026, LA MÊME LIGNE
-- disait :
--
--     qdi -> 'regularite'              = 34
--     margin_breakdown -> 'regularity' = 0
--
-- Deux mots à une lettre près, deux mesures qui n'ont rien à voir, deux chiffres
-- qui se contredisent. Le QDI mesure la constance du geste sur le tour ; la
-- marge mesure la dispersion des TEMPS au tour.
--
-- Cette homonymie ne se voit pas : personne ne la remarque tant qu'il n'ouvre
-- pas les deux colonnes côte à côte. Le jour où quelqu'un le fait, il cherche un
-- bug qui n'existe pas.
--
-- -----------------------------------------------------------------------------
-- CE QUI ACCOMPAGNE CETTE MIGRATION, ET SANS QUOI ELLE NE SERT À RIEN
--
--   1. `src/services/marginCalculator.ts` — le calcul côté application ;
--   2. `supabase/functions/cron-analyze-pending-sessions` — le second écrivain,
--      qui doit être REDÉPLOYÉ. Il tourne (pg_cron job 4, actif, toutes les
--      heures). Il ne balaye que les séances DÉPOURVUES d'analyse : il ne
--      réécrira donc pas les lignes converties ci-dessous, mais chaque séance
--      neuve repartirait avec l'ancienne clé, et la colonne porterait deux
--      formes ;
--   3. la présente réécriture des lignes déjà en base.
--
-- -----------------------------------------------------------------------------
-- IDEMPOTENTE
--
-- La clause `WHERE ? 'regularity'` fait de cette migration une opération sûre à
-- rejouer : une ligne déjà convertie n'est pas touchée. Aucune valeur n'est
-- modifiée — seul le nom de la clé change.
-- =============================================================================

UPDATE public.app_session_analyses
SET margin_breakdown =
      (margin_breakdown - 'regularity')
      || jsonb_build_object('consistency', margin_breakdown -> 'regularity')
WHERE margin_breakdown ? 'regularity';

-- Vérification en dur : si une seule ligne portait encore l'ancienne clé après
-- l'UPDATE, la migration échoue plutôt que de se déclarer réussie. Une migration
-- qui ne vérifie pas son propre effet est une garde posée, non armée.
DO $$
DECLARE
  restantes integer;
BEGIN
  SELECT count(*) INTO restantes
  FROM public.app_session_analyses
  WHERE margin_breakdown ? 'regularity';

  IF restantes > 0 THEN
    RAISE EXCEPTION 'margin_breakdown : % ligne(s) portent encore la clé regularity', restantes;
  END IF;
END $$;
