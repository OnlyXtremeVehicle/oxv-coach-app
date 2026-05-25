/**
 * Topologie statique du circuit Haute Saintonge — pack web.
 *
 * COPIE EXACTE de src/lib/circuitTopology.ts du repo app mobile,
 * sans les helpers mockCornerMargins (non utilisés côté public web).
 *
 * SYNCHRONISATION : si vous modifiez les noms, apex ou pace ici, mettez
 * à jour aussi src/lib/circuitTopology.ts dans le repo app.
 */

export type MarginZone = 'green' | 'yellow' | 'red';

export interface CornerTopology {
  index: number;
  name: string;
  apexLat: number;
  apexLon: number;
  trackPointIndex: number;
  pace: 'fast' | 'medium' | 'slow';
}

export const BELTOISE_CORNERS: readonly CornerTopology[] = [
  {
    index: 1,
    name: 'Saintonge 1',
    apexLat: 45.2424763,
    apexLon: -0.0967393,
    trackPointIndex: 22,
    pace: 'medium',
  },
  {
    index: 2,
    name: 'Saintonge 2',
    apexLat: 45.2418313,
    apexLon: -0.0881423,
    trackPointIndex: 33,
    pace: 'medium',
  },
  {
    index: 3,
    name: "L'épingle Est",
    apexLat: 45.2416307,
    apexLon: -0.0881483,
    trackPointIndex: 36,
    pace: 'slow',
  },
  {
    index: 4,
    name: 'Le balcon',
    apexLat: 45.2415943,
    apexLon: -0.0907899,
    trackPointIndex: 43,
    pace: 'medium',
  },
  {
    index: 5,
    name: 'Le retour',
    apexLat: 45.2399848,
    apexLon: -0.0914963,
    trackPointIndex: 53,
    pace: 'medium',
  },
  {
    index: 6,
    name: "L'épingle Sud",
    apexLat: 45.239662,
    apexLon: -0.0904954,
    trackPointIndex: 57,
    pace: 'slow',
  },
  {
    index: 7,
    name: 'La ramenée',
    apexLat: 45.2390839,
    apexLon: -0.0889951,
    trackPointIndex: 69,
    pace: 'fast',
  },
] as const;
