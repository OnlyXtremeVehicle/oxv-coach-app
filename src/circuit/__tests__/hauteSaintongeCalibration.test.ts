/**
 * Garde de calibration — ligne d'arrivée de Haute Saintonge.
 *
 * Ce test ne vérifie pas du code : il vérifie une CALIBRATION contre la
 * géométrie réelle du circuit (relevé fondateur 2026-07-16). Il existe parce
 * qu'un rayon trop large est un piège invisible : la VOIE DES STANDS longe la
 * ligne droite d'arrivée à ~23 m et lui est PARALLÈLE (2,3° d'écart), et la
 * détection de tour ne filtre QUE sur la distance (`src/utils/lapDetection.ts`)
 * — aucun filtre de cap ne pourrait les distinguer.
 *
 * Conséquence : avec les défauts du code (30 m dans `circuitsService`, 40 m dans
 * `BELTOISE_FINISH`), chaque passage aux stands compterait un FAUX TOUR, et le
 * compteur, le meilleur temps et la régularité du pilote seraient corrompus —
 * silencieusement. Si quelqu'un élargit le rayon un jour, ce test tombe.
 */

import {
  HAUTE_SAINTONGE_FINISH,
  HAUTE_SAINTONGE_FINISH_RADIUS_M,
  HAUTE_SAINTONGE_PIT_LANE,
  HAUTE_SAINTONGE_POINTS,
} from '../hauteSaintonge';
import type { LatLon } from '../circuitGenerator';

/** Demi-largeur de piste : tag OSM `width=6` sur la way 54412766. */
const TRACK_HALF_WIDTH_M = 3;
/** Demi-largeur de la voie des stands (~5 m) : bord le plus proche de la ligne. */
const PIT_HALF_WIDTH_M = 2.5;
/** Erreur GPS typique attendue du RaceBox Mini S. */
const GPS_ERROR_M = 5;

const rad = (d: number): number => (d * Math.PI) / 180;

/** Projection locale en mètres autour de la ligne (exacte à cette échelle). */
function toLocalMeters(p: LatLon, origin: LatLon): [number, number] {
  const mLat =
    111132.92 - 559.82 * Math.cos(rad(2 * origin.lat)) + 1.175 * Math.cos(rad(4 * origin.lat));
  const mLon = 111412.84 * Math.cos(rad(origin.lat)) - 93.5 * Math.cos(rad(3 * origin.lat));
  return [(p.lon - origin.lon) * mLon, (p.lat - origin.lat) * mLat];
}

/** Distance (m) de l'origine au segment [a,b], tous deux en mètres locaux. */
function distanceToSegment(a: [number, number], b: [number, number]): number {
  const [ax, ay] = a;
  const dx = b[0] - ax;
  const dy = b[1] - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(ax, ay);
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Distance (m) de la ligne d'arrivée à la polyligne donnée. */
function distanceFromFinishTo(line: LatLon[]): number {
  const pts = line.map((p) => toLocalMeters(p, HAUTE_SAINTONGE_FINISH));
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distanceToSegment(pts[i], pts[i + 1]));
  }
  return best;
}

describe('Calibration ligne d’arrivée — Haute Saintonge', () => {
  const distToTrack = distanceFromFinishTo(HAUTE_SAINTONGE_POINTS);
  const distToPit = distanceFromFinishTo(HAUTE_SAINTONGE_PIT_LANE);

  it('la ligne est bien SUR la piste (relevé cohérent avec le tracé OSM)', () => {
    // 1,47 m mesuré : la ligne est posée sur l'axe, à la précision du relevé.
    expect(distToTrack).toBeLessThan(TRACK_HALF_WIDTH_M);
  });

  it('la voie des stands longe la ligne — c’est elle qui borne le rayon', () => {
    // ~22,9 m mesuré. Si ce chiffre change (nouveau relevé), le rayon est à revoir.
    expect(distToPit).toBeGreaterThan(20);
    expect(distToPit).toBeLessThan(26);
  });

  it('le rayon COUVRE toute la largeur de piste, marge GPS comprise', () => {
    const floor = distToTrack + TRACK_HALF_WIDTH_M + GPS_ERROR_M;
    expect(HAUTE_SAINTONGE_FINISH_RADIUS_M).toBeGreaterThanOrEqual(floor);
  });

  it('le rayon EXCLUT la voie des stands (sinon : faux tours silencieux)', () => {
    const ceiling = distToPit - PIT_HALF_WIDTH_M;
    expect(HAUTE_SAINTONGE_FINISH_RADIUS_M).toBeLessThan(ceiling);
  });

  it('les défauts du code (30 m / 40 m) sont INADMISSIBLES ici — d’où ce garde-fou', () => {
    const ceiling = distToPit - PIT_HALF_WIDTH_M;
    // Documente le piège : ces valeurs feraient compter les stands comme des tours.
    expect(30).toBeGreaterThan(ceiling);
    expect(40).toBeGreaterThan(ceiling);
  });
});
