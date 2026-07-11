/**
 * Couleur d'une zone de marge (carte + EXPORTS PDF/captures Data Lab).
 *
 * REFONTE V3 (handoff §7.6 — Carte du circuit) : la marge se lit sur un dégradé
 * MARGE faible→large = ROUGE → OR → VERT. Le « serré » (faible marge) est rendu
 * en ROUGE DE DONNÉE `#F65B5B` (= dataColors.brake), DISTINCT du rouge de MARQUE
 * `#C8102E` (REC/insigne) : l'invariant « jamais le rouge de marque sur une
 * donnée de perf » reste tenu, mais on assume enfin le rouge de donnée (une
 * couleur = une donnée). Pur et testé pour verrouiller l'invariant.
 */

import { dataColors, palette } from '@/theme/v2';

export type ZoneLike = 'green' | 'yellow' | 'red' | null;

/** Rouge de MARQUE OXV — interdit sur une donnée de perf. */
export const BRAND_RED = '#C8102E';

export function marginZoneExportColor(zone: ZoneLike): string {
  if (!zone) return 'rgba(255,255,255,0.35)';
  if (zone === 'green') return palette.green; // marge large = vert
  if (zone === 'yellow') return palette.gold; // marge moyenne = or (transition du dégradé)
  // 'red' (terrain serré) : ROUGE DE DONNÉE #F65B5B — jamais le rouge de marque.
  return dataColors.brake;
}
