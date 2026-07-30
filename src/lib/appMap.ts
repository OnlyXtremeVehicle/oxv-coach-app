/**
 * appMap — ce qu'il reste de la navigation pilote de première génération.
 *
 * ---
 *
 * CE FICHIER A ÉTÉ RÉDUIT LE 29/07/2026 (lot J5, étape 10)
 *
 * Il décrivait l'arbre `app/(app)` en entier : cinq zones, une table de
 * soixante-dix segments vers leur zone, les routes racines de chaque onglet, la
 * liste des écrans du Data Lab. Cet arbre est archivé sous `archive/arbre-v1/` —
 * aucune de ces routes n'existe plus.
 *
 * Un seul export survivait à l'inventaire des consommateurs :
 * `shouldShowTabBar`, appelée par `app/(app2)/_layout.tsx`. Tout le reste
 * décrivait des chemins morts, et la garde de cohérence du dépôt l'a signalé au
 * premier lancement suivant le retrait — cinquante et une entrées pointant vers
 * des écrans absents.
 *
 * L'état complet d'avant figure sous le tag `avant-suppression-arbre-v1`.
 *
 * ---
 *
 * POURQUOI `shouldShowTabBar` RESTE ICI PLUTÔT QUE DE PARTIR EN app2
 *
 * Parce qu'elle porte une règle de DOCTRINE, pas une règle de navigation :
 * pendant que le véhicule roule, aucune barre ne s'affiche. Cette règle ne
 * dépend d'aucun arbre, et elle survivra à celui-ci comme elle a survécu au
 * précédent. L'arbre V2 a sa propre détection de flux de capture
 * (`isV2CaptureFlowPath`), et les deux se composent dans son layout.
 */

/**
 * La barre d'onglets est-elle visible ?
 *
 * Masquée pendant le roulage — **Principe 3, silence en piste** : le pilote
 * conduit, l'équipement enregistre, l'application dort. Aucun écran, aucune
 * barre, aucune notification.
 *
 * Le paramètre `path` n'est plus interrogé. Il l'était pour reconnaître les sept
 * segments du flux de capture V1 (`equipement`, `placement`, `roulage`,
 * `entre-runs`, `pilotage-fini`, `preservation`, `bilan-pret`), tous archivés :
 * aucun chemin ne peut plus les porter, et les tester reviendrait à interroger
 * une liste qui ne peut jamais répondre.
 *
 * Il est CONSERVÉ dans la signature parce que l'arbre V2 le passe déjà, et que
 * son propre flux de capture est traité chez lui — le jour où cette règle devra
 * de nouveau lire le chemin, l'appel n'aura pas à changer.
 */
export function shouldShowTabBar(_path: string, pilotState: string): boolean {
  return pilotState !== 'S6_roulage';
}
