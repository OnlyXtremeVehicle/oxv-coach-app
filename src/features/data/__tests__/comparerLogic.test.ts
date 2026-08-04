import { readFileSync } from 'fs';
import { join } from 'path';

import { compareFacts, formatDeltaMs, signedNumber, type SideFacts } from '../comparerLogic';

const FULL_A: SideFacts = {
  bestLapMs: 84318,
  regularityPct: 92,
  maxSpeedKmh: 210,
  distanceKm: 12.4,
};
const FULL_B: SideFacts = {
  bestLapMs: 84730,
  regularityPct: 89,
  maxSpeedKmh: 207,
  distanceKm: 12.1,
};

describe('signedNumber', () => {
  it('préfixe un signe qui n’indique que le sens de la valeur', () => {
    expect(signedNumber(0.412, 3)).toBe('+0.412');
    expect(signedNumber(-3, 0)).toBe('-3');
    expect(signedNumber(0, 0)).toBe('±0');
  });
  it('n’émet jamais de « -0 » sur une valeur négligeable', () => {
    expect(signedNumber(-0.0001, 0)).toBe('±0');
  });
  it('rend « — » sur une valeur non finie', () => {
    expect(signedNumber(Number.NaN, 2)).toBe('—');
  });
});

describe('formatDeltaMs', () => {
  it('exprime un écart de temps en secondes signées', () => {
    expect(formatDeltaMs(412)).toBe('+0.412 s');
    expect(formatDeltaMs(-1200)).toBe('-1.200 s');
    expect(formatDeltaMs(0)).toBe('±0.000 s');
  });
});

describe('compareFacts — écarts NEUTRES signés', () => {
  const rows = compareFacts(FULL_A, FULL_B);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

  it('rend les quatre lignes attendues avec des faits situés', () => {
    expect(rows.map((r) => r.key)).toEqual(['bestLap', 'regularity', 'maxSpeed', 'distance']);
    expect(byKey.bestLap.aText).toBe('1:24,318');
    expect(byKey.regularity.aText).toBe('92 %');
    expect(byKey.maxSpeed.aText).toBe('210 km/h');
    expect(byKey.distance.aText).toBe('12,4 km');
  });

  it('chaque écart est une chaîne signée neutre (b − a), sans lexique de mérite', () => {
    expect(byKey.bestLap.deltaText).toBe('+0.412 s');
    expect(byKey.regularity.deltaText).toBe('-3 %');
    expect(byKey.maxSpeed.deltaText).toBe('-3 km/h');
    expect(byKey.distance.deltaText).toBe('-0,3 km');

    for (const r of rows) {
      expect(r.deltaText).not.toBeNull();
      // Commence par un signe d'orientation seul (+ / - / ±), jamais un mot.
      expect(r.deltaText as string).toMatch(/^[+\-±]/);
    }
  });
});

describe('compareFacts — côté absent', () => {
  it('un côté null ⇒ texte « — » et écart null (aucun chiffre fabriqué)', () => {
    const partialB: SideFacts = {
      bestLapMs: null,
      regularityPct: null,
      maxSpeedKmh: null,
      distanceKm: null,
    };
    const rows = compareFacts(FULL_A, partialB);
    for (const r of rows) {
      expect(r.aText).not.toBe('—'); // A reste lisible
      expect(r.bText).toBe('—'); // B absent
      expect(r.deltaText).toBeNull(); // pas d'écart si un côté manque
    }
  });

  it('les deux côtés absents ⇒ tout est « — » / null', () => {
    const empty: SideFacts = {
      bestLapMs: null,
      regularityPct: null,
      maxSpeedKmh: null,
      distanceKm: null,
    };
    const rows = compareFacts(empty, empty);
    for (const r of rows) {
      expect(r.aText).toBe('—');
      expect(r.bText).toBe('—');
      expect(r.deltaText).toBeNull();
    }
  });
});

describe('DOCTRINE — verrou lexical de la source', () => {
  it('le module comparerLogic.ts ne contient aucun jeton de mérite / vainqueur', () => {
    const source = readFileSync(join(__dirname, '..', 'comparerLogic.ts'), 'utf8').toLowerCase();
    const banned = [
      'gagnant',
      'winner',
      'better',
      'worse',
      'mieux',
      'pire',
      'meilleur',
      'loses',
      'beats',
    ];
    for (const token of banned) {
      expect(source).not.toContain(token);
    }
  });
});
