/**
 * Topologie statique du circuit Haute Saintonge (tracé Beltoise).
 *
 * Données réelles depuis OSM (Open Street Map) — way 54412766
 * "highway=raceway". 7 virages identifiés par analyse automatique des
 * changements de cap (script scripts/analyze-track-corners.ts).
 *
 * Coordonnées GPS réelles bbox :
 *   lat ∈ [45.2389, 45.2429] (~440 m d'amplitude N/S)
 *   lon ∈ [-0.0968, -0.0881] (~660 m d'amplitude E/W)
 *
 * Les noms ci-dessous sont des propositions sobres OXV à confirmer
 * avec le circuit de Haute Saintonge (Q19 ouverte). Modifier
 * BELTOISE_CORNERS[*].name pour les noms officiels quand vous les
 * recevrez.
 */

import type { MarginZone } from '@/types/domain';

export interface CornerTopology {
  /** Numéro de virage, 1-7. */
  index: number;
  /** Nom du virage — à valider avec le circuit Beltoise. */
  name: string;
  /** Position GPS réelle du point de corde (depuis OSM way 54412766). */
  apexLat: number;
  apexLon: number;
  /** Index du point apex dans HAUTE_SAINTONGE_TRACK (référence interne). */
  trackPointIndex: number;
  /** Profil de virage — utilisé pour le manifeste contextuel. */
  pace: 'fast' | 'medium' | 'slow';
}

/**
 * Les 7 virages du tracé Beltoise, identifiés automatiquement par analyse
 * des changements de cap sur la polyline OSM. L'angle de braquage indique
 * la classification pace :
 *   - angle ≥ 28°  → slow (épingle)
 *   - 20-28°       → medium (virage moyen)
 *   - < 20°        → fast (courbe rapide)
 */
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

/**
 * @deprecated Suppose la Haute Saintonge SANS le vérifier.
 *
 * Cette topologie ne décrit qu'un seul circuit. Appelée sur une séance courue
 * ailleurs, elle renvoie un nom de virage de Beltoise — « L'épingle Sud » sur un
 * tour de Valence. Préférez `getCornerDuCircuit`, qui refuse quand le circuit
 * n'est pas celui-ci.
 */
export function getCorner(index: number): CornerTopology | null {
  return BELTOISE_CORNERS.find((c) => c.index === index) ?? null;
}

/**
 * Les façons dont le circuit de Haute Saintonge est nommé en base.
 *
 * `telemetry_sessions.circuit_name` est du texte libre, saisi au placement : on
 * compare sur une forme normalisée plutôt que sur une égalité stricte.
 */
const NOMS_HAUTE_SAINTONGE = ['hautesaintonge', 'beltoise', 'circuitdehautesaintonge'];

function normaliser(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Cette séance a-t-elle été courue sur le circuit dont nous avons la géométrie ?
 *
 * Fail-closed : un nom absent, vide ou inconnu vaut NON. Sans certitude, on
 * n'affiche ni tracé ni nom de virage — mieux vaut ne rien montrer que montrer
 * la forme d'un autre circuit sous le nom de celui-ci.
 */
export function estHauteSaintonge(circuitName: string | null | undefined): boolean {
  if (!circuitName) return false;
  return NOMS_HAUTE_SAINTONGE.includes(normaliser(circuitName));
}

/**
 * Les virages du circuit demandé, ou une liste VIDE si sa géométrie nous est
 * inconnue. Une liste vide se rend en état vide honnête ; les sept virages de
 * Beltoise plaqués sur un autre circuit se rendent en mensonge.
 */
export function cornersDuCircuit(
  circuitName: string | null | undefined
): readonly CornerTopology[] {
  return estHauteSaintonge(circuitName) ? BELTOISE_CORNERS : [];
}

/** Un virage nommé, uniquement si la séance est bien sur ce circuit. */
export function getCornerDuCircuit(
  index: number,
  circuitName: string | null | undefined
): CornerTopology | null {
  if (!estHauteSaintonge(circuitName)) return null;
  return getCorner(index);
}

export function nextCornerIndex(currentIndex: number): number {
  if (currentIndex >= BELTOISE_CORNERS.length) return 1;
  return currentIndex + 1;
}

export function previousCornerIndex(currentIndex: number): number {
  if (currentIndex <= 1) return BELTOISE_CORNERS.length;
  return currentIndex - 1;
}

/**
 * Marges par virage pour une session donnée. V1 = mock random reproductible
 * basé sur le sessionId (pour que la même session affiche les mêmes couleurs
 * d'ouverture en ouverture). Remplacé par les vraies marges depuis
 * app_segment_analyses dès qu'une analyse trackviz a tourné sur la session.
 */
export function mockCornerMargins(sessionId: string): Record<number, MarginZone> {
  const margins: Record<number, MarginZone> = {};
  const seed = hashString(sessionId);
  for (let i = 1; i <= BELTOISE_CORNERS.length; i++) {
    const r = pseudoRandom(seed + i);
    if (r < 0.15) margins[i] = 'red';
    else if (r < 0.45) margins[i] = 'yellow';
    else margins[i] = 'green';
  }
  return margins;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
