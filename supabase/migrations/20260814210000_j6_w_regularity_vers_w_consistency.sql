-- =============================================================================
-- APPLIQUÉE le 14/08/2026 — `coach_reading_weights.w_regularity` → `w_consistency`
-- =============================================================================
--
-- APPLIQUÉE le 14/08/2026, sur accord du fondateur. (Était : NON APPLIQUÉE.) C'est un renommage de COLONNE, donc du schéma, donc une
-- décision du fondateur (CLAUDE.md). Le fichier est prêt ; il attend un mot.
--
-- -----------------------------------------------------------------------------
-- POURQUOI
--
-- Le 13/08/2026, la sous-composante `margin_breakdown.regularity` a été renommée
-- `consistency` : elle porte la dispersion des temps au tour, calculée par une
-- formule qui n'est PAS celle de la branche QDI `regularite` — et qui rend 0 là
-- où le QDI rend 34, sur la même séance et les mêmes tours.
--
-- Cette colonne-ci porte le POIDS que le coach donne à cette sous-composante
-- dans sa lecture. `computeCoachReading` multiplie littéralement l'un par
-- l'autre. Tant qu'elle s'appelle `w_regularity` alors que ce qu'elle pondère
-- s'appelle `consistency`, on lit dans le même calcul deux noms pour une même
-- chose — exactement le défaut qu'on vient de retirer, en plus discret.
--
-- Le champ TypeScript est DÉJÀ passé à `wConsistency` : la correspondance se
-- fait aujourd'hui au seul endroit qui mappe la table
-- (`coachReadingService.mapRow`). L'application est donc cohérente ; c'est la
-- base qui garde l'ancien mot.
--
-- -----------------------------------------------------------------------------
-- CE QUE ÇA COÛTE, ET CE QUE ÇA NE CASSE PAS
--
-- Le renommage est SÛR à une condition : appliquer la migration ET livrer le
-- code dans le même mouvement. `coachReadingService` lit et écrit la colonne
-- par son nom, à deux endroits (`mapRow`, et le `payload` d'upsert). Entre les
-- deux déploiements, ces deux lectures échouent.
--
-- Nombre de lignes concernées, à vérifier avant d'appliquer :
--
--     select count(*) from public.coach_reading_weights;
--
-- La table est vide ou presque tant qu'aucun compte coach n'existe en
-- production — ce qui est le cas au 14/08/2026 (zéro coach). Le renommage est
-- donc, aujourd'hui, sans conséquence sur des données réelles. C'est le meilleur
-- moment pour le faire ; il ne le restera pas.
--
-- -----------------------------------------------------------------------------
-- APRÈS APPLICATION, deux lignes à changer dans le code :
--
--   src/services/coachReadingService.ts
--     - `w_regularity: number;`            → `w_consistency: number;`
--     - `Number(row.w_regularity)`         → `Number(row.w_consistency)`
--     - `w_regularity: input.wConsistency` → `w_consistency: input.wConsistency`
--
-- =============================================================================

ALTER TABLE public.coach_reading_weights
  RENAME COLUMN w_regularity TO w_consistency;

COMMENT ON COLUMN public.coach_reading_weights.w_consistency IS
  'Poids donné par le coach à margin_breakdown.consistency (dispersion des temps au tour). '
  'S''appelait w_regularity jusqu''au renommage du 14/08/2026 : le mot désignait la même chose '
  'que la branche QDI regularite sans être la même mesure ni la même formule.';

-- -----------------------------------------------------------------------------
-- ANNULATION
--
-- ALTER TABLE public.coach_reading_weights
--   RENAME COLUMN w_consistency TO w_regularity;
-- -----------------------------------------------------------------------------
