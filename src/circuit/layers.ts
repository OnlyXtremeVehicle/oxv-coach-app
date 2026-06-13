/**
 * Couches de lecture de <CircuitTrace> (specs v4 §05 §3).
 *
 * Chaque couche colore le tracé virage par virage à partir d'une clé RÉELLE des
 * insights. Logique PURE (aucune dépendance three) → testable. Les couleurs sont
 * des RGB normalisés (0..1) que le composant convertit en THREE.Color.
 *
 * Doctrine : l'échelle de couleur est un SUPPORT DE LECTURE (montrer où), pas un
 * jugement. Une couche sans donnée → état vide explicite (jamais inventé).
 */

import type { Circuit } from './circuitGenerator';
import type { AnatomyCorner, CornerRecord, SessionInsights } from './sessionInsights';

export type LayerId = 'geometry' | 'regularity' | 'apexSpeed' | 'chassisBalance' | 'loadTransfer';
export type LayerKind = 'geometry' | 'sequential' | 'diverging';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface LayerDescriptor {
  id: LayerId;
  label: string;
  role: 'pilot' | 'coach';
  kind: LayerKind;
  unit: string;
  valueForCorner: (s: SessionInsights, cornerIndex: number) => number | null;
  available: (s: SessionInsights | null) => boolean;
}

// --- Charte OXV en RGB 0..1 (00_CLAUDE §3) -----------------------------------
function hex(n: number): RGB {
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
const C = {
  green: hex(0x4ade80),
  gold: hex(0xffb703),
  red: hex(0xc8102e),
  redUI: hex(0xe63946),
  blue: hex(0x60a5fa),
  steel: hex(0x5c5c66),
};

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}
function lerp(a: RGB, b: RGB, t: number): RGB {
  const u = clamp01(t);
  return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
}

/** Échelle séquentielle t∈[0,1] → vert → or → rouge. */
export function sequentialColor(t: number): RGB {
  const u = clamp01(t);
  return u < 0.5 ? lerp(C.green, C.gold, u * 2) : lerp(C.gold, C.red, (u - 0.5) * 2);
}

/** Échelle divergente v∈[-1,1] → bleu (négatif) … acier (0) … rouge (positif). */
export function divergingColor(v: number): RGB {
  return v >= 0 ? lerp(C.steel, C.redUI, clamp01(v)) : lerp(C.steel, C.blue, clamp01(-v));
}

function cornerKey(i: number): string {
  return `corner_${i}`;
}
function recordValue(rec: CornerRecord | null, cornerIndex: number): number | null {
  if (!rec) return null;
  const v = rec[cornerKey(cornerIndex)];
  return typeof v === 'number' ? v : null;
}
function recordAvailable(rec: CornerRecord | null): boolean {
  return !!rec && Object.keys(rec).length > 0;
}
function anatomyValue(
  s: SessionInsights,
  cornerIndex: number,
  pick: (c: AnatomyCorner) => number
): number | null {
  const c = s.anatomy?.find((a) => a.corner_index === cornerIndex);
  return c ? pick(c) : null;
}

export const LAYERS: Record<LayerId, LayerDescriptor> = {
  geometry: {
    id: 'geometry',
    label: 'Tracé',
    role: 'pilot',
    kind: 'geometry',
    unit: '',
    valueForCorner: () => null,
    available: () => true,
  },
  regularity: {
    id: 'regularity',
    label: 'Régularité',
    role: 'pilot',
    kind: 'sequential',
    unit: 'm',
    valueForCorner: (s, i) => recordValue(s.dispersion, i),
    available: (s) => !!s && recordAvailable(s.dispersion),
  },
  apexSpeed: {
    id: 'apexSpeed',
    label: "Vitesse d'apex",
    role: 'pilot',
    kind: 'sequential',
    unit: 'km/h',
    valueForCorner: (s, i) => anatomyValue(s, i, (c) => c.apex_speed_kmh),
    available: (s) => !!s && !!s.anatomy && s.anatomy.length > 0,
  },
  chassisBalance: {
    id: 'chassisBalance',
    label: 'Équilibre châssis',
    role: 'pilot',
    kind: 'diverging',
    unit: '%',
    valueForCorner: (s, i) => recordValue(s.chassis_balance, i),
    available: (s) => !!s && recordAvailable(s.chassis_balance),
  },
  loadTransfer: {
    id: 'loadTransfer',
    label: 'Transfert de charge',
    role: 'pilot',
    kind: 'sequential',
    unit: 's',
    valueForCorner: (s, i) => recordValue(s.load_transfer, i),
    available: (s) => !!s && recordAvailable(s.load_transfer),
  },
};

/** Couches accessibles au pilote (factuelles, ordre du sélecteur). */
export const PILOT_LAYERS: LayerId[] = [
  'geometry',
  'regularity',
  'apexSpeed',
  'chassisBalance',
  'loadTransfer',
];

// Sens de normalisation des couches séquentielles : true = valeur haute → vert.
// apexSpeed : vitesse élevée = vert. régularité/transfert : valeur faible = vert.
const SEQ_INVERT: Partial<Record<LayerId, boolean>> = { apexSpeed: true };

export interface CornerColoring {
  byCorner: (RGB | null)[];
  min: number | null;
  max: number | null;
}

/** Couleur de chaque virage (index 0 = virage 1). null si la donnée manque. */
export function colorByCorner(
  layerId: LayerId,
  session: SessionInsights | null,
  nCorners: number
): CornerColoring {
  const layer = LAYERS[layerId];
  const out: (RGB | null)[] = new Array<RGB | null>(nCorners).fill(null);
  if (layerId === 'geometry' || !session) return { byCorner: out, min: null, max: null };

  const vals: (number | null)[] = [];
  for (let i = 1; i <= nCorners; i++) vals.push(layer.valueForCorner(session, i));
  const present = vals.filter((v): v is number => v !== null);
  if (present.length === 0) return { byCorner: out, min: null, max: null };

  const min = Math.min(...present);
  const max = Math.max(...present);

  if (layer.kind === 'diverging') {
    const amax = Math.max(...present.map((v) => Math.abs(v))) || 1;
    vals.forEach((v, idx) => {
      if (v !== null) out[idx] = divergingColor(v / amax);
    });
  } else {
    const span = max - min || 1;
    const invert = !!SEQ_INVERT[layerId];
    vals.forEach((v, idx) => {
      if (v !== null) {
        let t = (v - min) / span;
        if (invert) t = 1 - t;
        out[idx] = sequentialColor(t);
      }
    });
  }
  return { byCorner: out, min, max };
}

/** Pour chaque section du ruban, l'index (1-based) du virage auquel elle appartient, ou null. */
export function sectionCornerMap(circuit: Circuit): (number | null)[] {
  const map: (number | null)[] = new Array<number | null>(circuit.ribbon.length).fill(null);
  for (const c of circuit.corners) {
    for (let i = c.startIdx; i < c.endIdx && i < map.length; i++) map[i] = c.index;
  }
  return map;
}
