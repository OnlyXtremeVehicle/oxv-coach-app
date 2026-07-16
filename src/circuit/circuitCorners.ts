/**
 * Virages exploitables d'un CIRCUIT — socle des repères de virage multi-circuit
 * (demande fondateur build 23 : « choisir le circuit avant, page personnalisée
 * selon le circuit — 14 virages ou 7 »).
 *
 * Deux sources, JAMAIS un virage inventé :
 *   - Haute Saintonge (tracé Beltoise) : la topologie NOMMÉE existante
 *     (BELTOISE_CORNERS — 7 virages, noms officiels proposés) ;
 *   - tout autre circuit : virages DÉRIVÉS du tracé réel stocké en base
 *     (circuits.centerline_latlon) par la détection de courbure du
 *     circuitGenerator (port fidèle du module de référence). Libellés
 *     factuels « Virage N (gauche/droite) » ;
 *   - pas de centerline → [] : l'écran affiche un EmptyState honnête.
 *
 * Paramétrage de la dérivation : smoothWin = 0 (aucun lissage). Les
 * centerlines en base viennent d'OSM (tracés propres) ; le lissage par défaut
 * (fenêtre 1) fusionne les enchaînements serrés. Mesuré sur Ricardo Tormo
 * (Valence) : 12 virages avec lissage, 14 sans — pour 14 virages réels du
 * circuit (9 gauches, 5 droites). Vérifié par test sur la fixture
 * src/circuit/data/ricardo-tormo.geojson (même géométrie que la base).
 */

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';

import { type CornerDirection, type LatLon, generateCircuit } from './circuitGenerator';

/** Un virage listable d'un circuit (repères coach, écrans par circuit). */
export interface CircuitCorner {
  /** Numéro de virage, 1-based, stable pour un tracé donné. */
  index: number;
  /** « Saintonge 1 » (topologie nommée) ou « Virage 3 (gauche) » (dérivé). */
  name: string;
  /** Sens du virage — 'unknown' pour la topologie nommée (non renseigné). */
  direction: CornerDirection;
  /** Profil nommé Haute Saintonge — null pour un virage dérivé. */
  pace: 'fast' | 'medium' | 'slow' | null;
  /** Rayon estimé (m) depuis la géométrie réelle — null pour la topologie nommée. */
  radiusM: number | null;
}

/** Référence minimale d'un circuit (id + nom) — découple du service Supabase. */
export interface CircuitRef {
  id: string;
  name: string;
}

/** Normalisation d'un nom de circuit : minuscules, sans diacritiques. */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Vrai si le circuit est Haute Saintonge (variantes comprises, ex. « BACKUP ») :
 * même tracé physique → même topologie nommée.
 */
export function isHauteSaintonge(circuit: Pick<CircuitRef, 'name'>): boolean {
  return normalizeName(circuit.name).includes('haute saintonge');
}

/** Les 7 virages nommés du tracé Beltoise, au format commun CircuitCorner. */
export function hauteSaintongeCorners(): CircuitCorner[] {
  return BELTOISE_CORNERS.map((c) => ({
    index: c.index,
    name: c.name,
    direction: 'unknown' as const,
    pace: c.pace,
    radiusM: null,
  }));
}

/**
 * Paramètres de dérivation des virages depuis une centerline en base.
 * smoothWin: 0 — voir l'en-tête du fichier (mesuré, pas supposé).
 */
const DERIVE_PARAMS = { smoothWin: 0, resampleStep: 10, cornerRadius: 100 } as const;

/**
 * Dérive les virages d'un tracé réel (liste de points lat/lon) via la
 * détection de courbure existante. Pur et déterministe : testé sur la
 * fixture Ricardo Tormo. Tracé dégénéré (< 4 points) → [].
 */
export function deriveCornersFromCenterline(points: readonly LatLon[]): CircuitCorner[] {
  if (points.length < 4) return [];
  const circuit = generateCircuit([...points], DERIVE_PARAMS);
  return circuit.corners.map((c) => ({
    index: c.index,
    name:
      c.direction === 'unknown'
        ? `Virage ${c.index}`
        : `Virage ${c.index} (${c.direction === 'left' ? 'gauche' : 'droite'})`,
    direction: c.direction,
    pace: null,
    radiusM: Number.isFinite(c.radius_m) ? c.radius_m : null,
  }));
}

/**
 * Les virages d'un circuit donné :
 *   - Haute Saintonge → topologie nommée (7 virages) ;
 *   - autre circuit  → dérivés de sa centerline en base ; [] si absente
 *     (l'appelant affiche alors un état honnête, aucun virage inventé).
 *
 * `fetchCenterline` est injectable pour les tests purs ; par défaut, lecture
 * réelle via circuitsService (import paresseux : le service tire supabase et
 * mmkv, indésirables dans l'environnement Jest node).
 */
export async function cornersForCircuit(
  circuit: CircuitRef,
  fetchCenterline?: (circuitId: string) => Promise<LatLon[] | null>
): Promise<CircuitCorner[]> {
  if (isHauteSaintonge(circuit)) return hauteSaintongeCorners();

  const fetcher =
    fetchCenterline ??
    (require('@/services/circuitsService') as typeof import('@/services/circuitsService'))
      .fetchCircuitCenterline;

  const points = await fetcher(circuit.id);
  if (!points || points.length === 0) return [];
  return deriveCornersFromCenterline(points);
}
