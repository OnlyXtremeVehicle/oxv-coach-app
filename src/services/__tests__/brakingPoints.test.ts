/**
 * Tests de la détection de points de freinage (pilier §3.4).
 */

import { type TrajPoint, detectBrakingPoints } from '../brakingPointsService';

/**
 * Génère une trajectoire le long d'une ligne avec des vitesses données.
 *
 * ===========================================================================
 * L'ESPACEMENT A CHANGÉ LE 13/08/2026, ET CE N'EST PAS UN DÉTAIL
 * ===========================================================================
 *
 * Il valait 0,0005° de latitude, soit **~55 m entre deux points** — choisi pour
 * passer au-dessus du seuil de séparation, pas pour ressembler à une
 * trajectoire réelle. Un RaceBox à 25 Hz rend un point par mètre à 90 km/h.
 *
 * Conséquence, une fois la détection rendue PHYSIQUE : le cas dit « freinage
 * franc » — 120 → 60 km/h sur cinq intervalles, soit 278 mètres — donne
 * **−0,15 g**. C'est du frein moteur. Le test qui prouvait la détection de
 * freinage employait une trajectoire qui est, physiquement, un lever de pied.
 *
 * Il ne mentait pas sur le code d'alors, qui ne regardait que la chute de
 * vitesse. Il mentait sur ce que le code CROYAIT détecter.
 *
 * 12 m entre points ramène les mêmes vitesses dans le domaine du freinage réel,
 * tout en gardant les zones assez longues pour le seuil de séparation de 30 m.
 */
function traj(speeds: number[], pasM = 12): TrajPoint[] {
  const pasLat = pasM / 111_320;
  return speeds.map((speed, i) => ({
    lat: 45.24 + i * pasLat,
    lon: -0.09,
    speed,
  }));
}

describe('detectBrakingPoints', () => {
  it('retourne [] sur moins de 3 points', () => {
    expect(detectBrakingPoints(traj([100, 50]))).toEqual([]);
  });

  it('détecte une zone de freinage franche (chute ≥ 15 km/h ET ≤ −0,3 g)', () => {
    // 120 → 60 km/h sur 5 × 12 m = 60 m → environ −0,71 g. Un appui franc.
    const pts = traj([120, 110, 95, 80, 65, 60, 62, 70]);
    const bp = detectBrakingPoints(pts);
    expect(bp.length).toBeGreaterThanOrEqual(1);
    expect(bp[0].entrySpeed).toBeGreaterThan(bp[0].exitSpeed);
  });

  it('ignore les micro-variations sous le seuil', () => {
    // chutes de quelques km/h seulement
    const pts = traj([100, 98, 100, 97, 99, 98]);
    expect(detectBrakingPoints(pts)).toEqual([]);
  });

  it('normalise l intensité (la plus forte chute = 1)', () => {
    // 2 zones : grosse chute puis petite
    const pts = traj([
      150,
      120,
      90,
      60, // chute 90
      62,
      80,
      100, // remonte
      95,
      78, // chute 17
      80,
      90,
    ]);
    const bp = detectBrakingPoints(pts);
    const maxIntensity = Math.max(...bp.map((b) => b.intensity));
    expect(maxIntensity).toBeCloseTo(1);
    expect(bp.every((b) => b.intensity >= 0 && b.intensity <= 1)).toBe(true);
  });

  it('déduplique les points trop proches (garde le plus intense)', () => {
    // 2 freinages dont les milieux de zone tombent à < 30 m l'un de l'autre.
    // Pas géographique ~5,5 m (0.00005° lat) → midIdx 0 et 3 ≈ 16 m < 30 m.
    const pts: TrajPoint[] = [
      { lat: 45.24, lon: -0.09, speed: 120 },
      { lat: 45.24005, lon: -0.09, speed: 60 },
      { lat: 45.2401, lon: -0.09, speed: 62 },
      { lat: 45.24015, lon: -0.09, speed: 120 },
      { lat: 45.2402, lon: -0.09, speed: 55 },
    ];
    const bp = detectBrakingPoints(pts, 15, 30);
    // Les deux milieux de zone sont à < 30 m → un seul point retenu
    expect(bp.length).toBe(1);
  });

  it('gère les vitesses manquantes sans crash', () => {
    const pts: TrajPoint[] = [
      { lat: 45.24, lon: -0.09, speed: 120 },
      { lat: 45.2405, lon: -0.09, speed: null },
      { lat: 45.241, lon: -0.09, speed: 60 },
      { lat: 45.2415, lon: -0.09, speed: 58 },
    ];
    expect(() => detectBrakingPoints(pts)).not.toThrow();
  });
});
