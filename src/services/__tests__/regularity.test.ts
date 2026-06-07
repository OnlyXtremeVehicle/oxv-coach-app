/**
 * Tests de la logique pure de Régularité (pilier §3.2).
 * Vérifie les calculs statistiques et la neutralité doctrinale.
 */

import { computeRegularity } from '../regularityService';

function laps(times: number[]): { lapNumber: number; durationSeconds: number }[] {
  return times.map((t, i) => ({ lapNumber: i + 1, durationSeconds: t }));
}

describe('computeRegularity', () => {
  it('classe "resserré" quand écart-type ≤ 0.5 s', () => {
    const r = computeRegularity(laps([92.0, 92.2, 92.1, 92.3]));
    expect(r.band).toBe('resserré');
  });

  it('classe "régulier" entre 0.5 et 1.5 s', () => {
    const r = computeRegularity(laps([91.0, 92.0, 91.5, 92.5]));
    expect(r.band).toBe('régulier');
  });

  it('classe "dispersé" au-dessus de 1.5 s', () => {
    const r = computeRegularity(laps([88, 95, 90, 99]));
    expect(r.band).toBe('dispersé');
  });

  it('calcule la médiane (robuste aux aberrants)', () => {
    const r = computeRegularity(laps([90, 91, 92, 200]));
    // médiane de [90,91,92,200] = (91+92)/2 = 91.5
    expect(r.medianSeconds).toBe(91.5);
  });

  it('calcule le meilleur tour et l amplitude', () => {
    const r = computeRegularity(laps([90, 93, 91]));
    expect(r.bestSeconds).toBe(90);
    expect(r.spreadSeconds).toBe(3);
  });

  it('renseigne l écart à la médiane signé par tour', () => {
    const r = computeRegularity(laps([90, 92]));
    // médiane = 91 → tour1 -1, tour2 +1
    expect(r.laps[0].deltaToMedianSeconds).toBeCloseTo(-1);
    expect(r.laps[1].deltaToMedianSeconds).toBeCloseTo(1);
  });

  it('ignore les tours à durée nulle', () => {
    const r = computeRegularity(laps([92, 0, 92.2]));
    expect(r.lapCount).toBe(2);
  });

  it('reste neutre : pas de "bon"/"mauvais"/"lent"/"rapide" dans le manifeste', () => {
    // Limites de mots pour éviter les faux positifs (ex : "ressemblent" ⊃ "lent")
    const bannedWords = [
      /\bbon\b/,
      /\bmauvais\b/,
      /\blent\b/,
      /\brapide\b/,
      /\bmeilleur\b/,
      /\bpire\b/,
    ];
    for (const set of [
      [92, 92.1],
      [90, 95],
      [88, 99, 90],
    ]) {
      const r = computeRegularity(laps(set));
      const m = (r.manifest ?? '').toLowerCase();
      for (const banned of bannedWords) {
        expect(m).not.toMatch(banned);
      }
    }
  });

  it('gère 0 ou 1 tour sans crash (pas de band, pas de manifeste)', () => {
    expect(computeRegularity(laps([])).band).toBeNull();
    const one = computeRegularity(laps([92]));
    expect(one.band).toBeNull();
    expect(one.manifest).toBeNull();
    expect(one.medianSeconds).toBe(92);
  });
});
