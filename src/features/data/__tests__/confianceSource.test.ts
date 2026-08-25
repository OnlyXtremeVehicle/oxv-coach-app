/**
 * Le mapper des trames de qualité — la position se DÉRIVE, jamais ne s'invente.
 *
 * Ce qui est protégé : la conversion ∫ v dt (trapèzes, même convention que
 * `kinematics.distance`), le tri sur `elapsed_ms` (jamais l'ordre d'arrivée),
 * et le `null` des trames sans vitesse — une trame non située reste non située.
 */

import { longueurDerivee, versTramesQualite, type LigneQualite } from '../confianceSource';

function ligne(
  elapsed_ms: number,
  speed_kmh: number | null,
  extra?: Partial<LigneQualite>
): LigneQualite {
  return {
    elapsed_ms,
    speed_kmh,
    gps_accuracy_m: 1,
    pdop: 1.5,
    satellites: 14,
    fix_valid: true,
    ...extra,
  };
}

describe('versTramesQualite', () => {
  it('dérive la distance par ∫ v dt (trapèzes) : 36 km/h pendant 1 s = 10 m', () => {
    const trames = versTramesQualite([ligne(0, 36), ligne(1000, 36), ligne(2000, 36)]);
    expect(trames.map((t) => t.distanceM)).toEqual([0, 10, 20]);
  });

  it('trie sur elapsed_ms, jamais sur l’ordre d’arrivée', () => {
    const trames = versTramesQualite([ligne(1000, 36), ligne(0, 36)]);
    expect(trames.map((t) => t.elapsedMs)).toEqual([0, 1000]);
    expect(trames.map((t) => t.distanceM)).toEqual([0, 10]);
  });

  it('une trame sans vitesse est non située (null), et l’intégration l’enjambe', () => {
    const trames = versTramesQualite([ligne(0, 36), ligne(500, null), ligne(1000, 36)]);
    expect(trames[1].distanceM).toBeNull();
    // Le trapèze court de 0 à 1000 ms à 10 m/s : la distance suivante reste juste.
    expect(trames[2].distanceM).toBe(10);
  });

  it('une vitesse négative est du bruit : trame non située, pas une marche arrière', () => {
    const trames = versTramesQualite([ligne(0, 36), ligne(1000, -5)]);
    expect(trames[1].distanceM).toBeNull();
  });

  it('recopie les canaux de qualité en préservant le null (inconnu ≠ mauvais)', () => {
    const [t] = versTramesQualite([
      ligne(0, 36, { gps_accuracy_m: null, pdop: null, satellites: null, fix_valid: null }),
    ]);
    expect(t.gpsAccuracyM).toBeNull();
    expect(t.pdop).toBeNull();
    expect(t.satellites).toBeNull();
    expect(t.fixValid).toBeNull();
  });

  it('accepte elapsed_ms en chaîne (PostgREST rend les numeric en string)', () => {
    const trames = versTramesQualite([
      ligne('0' as unknown as number, 36),
      ligne('1000' as unknown as number, 36),
    ]);
    expect(trames.map((t) => t.distanceM)).toEqual([0, 10]);
  });
});

describe('longueurDerivee', () => {
  it('rend la distance maximale située', () => {
    const trames = versTramesQualite([ligne(0, 36), ligne(1000, 36)]);
    expect(longueurDerivee(trames)).toBe(10);
  });

  it('rend null sans trame située : un découpage de rien n’existe pas', () => {
    expect(longueurDerivee(versTramesQualite([ligne(0, null)]))).toBeNull();
    expect(longueurDerivee([])).toBeNull();
  });
});
