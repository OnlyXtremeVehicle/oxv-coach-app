/**
 * Couleur d'une zone de marge pour les EXPORTS (PDF, captures Data Lab) — PR-69.
 *
 * Garde-fou doctrinal : le rouge de marque OXV (#C8102E) code la marque / le REC,
 * JAMAIS une donnée de performance. La zone « serrée » (faible marge) est donc
 * rendue en AMBRE neutralisé — jamais en rouge — exactement comme à l'écran
 * (cf. CircuitMap colorForZone). Pur et testé pour verrouiller l'invariant.
 */

import { palette } from '@/theme/v2';

export type ZoneLike = 'green' | 'yellow' | 'red' | null;

/** Rouge de marque OXV — interdit sur une donnée de perf. */
export const BRAND_RED = '#C8102E';

export function marginZoneExportColor(zone: ZoneLike): string {
  if (!zone) return 'rgba(255,255,255,0.35)';
  if (zone === 'green') return palette.green;
  if (zone === 'yellow') return '#EF9F27';
  // 'red' (terrain serré) : ambre pilote, rouge-perf neutralisé (doctrine).
  return palette.pilotAmber;
}
