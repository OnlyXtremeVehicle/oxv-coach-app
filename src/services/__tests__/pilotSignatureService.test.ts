/**
 * Tests de la signature de pilotage — focus sur l'empreinte 5 axes (maquette 20.2).
 * Doctrine : chaque axe adossé à une mesure RÉELLE ; donnée absente => null (jamais
 * une fausse valeur) ; position normalisée bornée 0–1 ; les 4 traits restent intacts.
 */

import { type SignatureSegmentInput, computeSignature } from '../pilotSignatureService';

function turn(over: Partial<SignatureSegmentInput>): SignatureSegmentInput {
  return {
    segmentIndex: 1,
    segmentName: 'V1',
    kind: 'turn',
    entrySpeedKmh: 140,
    apexSpeedKmh: 90,
    exitSpeedKmh: 120,
    maxGLateral: 1.1,
    maxGBraking: 1.0,
    marginPercent: 80,
    ...over,
  };
}

const FULL_TURNS: SignatureSegmentInput[] = [
  turn({ segmentIndex: 1, entrySpeedKmh: 140 }),
  turn({ segmentIndex: 2, entrySpeedKmh: 142 }),
  turn({ segmentIndex: 3, entrySpeedKmh: 138 }),
];

describe('computeSignature — empreinte 5 axes', () => {
  it('produit 5 axes (cap/visee/plongee/trajectoire/anticipation) sur données complètes', () => {
    const sig = computeSignature({ segments: FULL_TURNS, lapTimesSeconds: [100, 101, 100.5] });
    expect(sig.axes.map((a) => a.key)).toEqual([
      'cap',
      'visee',
      'plongee',
      'trajectoire',
      'anticipation',
    ]);
    for (const a of sig.axes) {
      expect(a.value).not.toBeNull();
      expect(a.value as number).toBeGreaterThanOrEqual(0);
      expect(a.value as number).toBeLessThanOrEqual(1);
      expect(a.detail).not.toBeNull();
    }
  });

  it('borne les positions à 1 même pour une mesure extrême', () => {
    const sig = computeSignature({
      segments: [turn({ maxGLateral: 3, maxGBraking: 3 })],
      lapTimesSeconds: [],
    });
    const cap = sig.axes.find((a) => a.key === 'cap')!;
    const plongee = sig.axes.find((a) => a.key === 'plongee')!;
    expect(cap.value).toBe(1);
    expect(plongee.value).toBe(1);
  });

  it('marque l’axe « donnée à venir » (null) plutôt que d’inventer une valeur', () => {
    const sig = computeSignature({
      segments: [turn({ maxGLateral: null }), turn({ segmentIndex: 2, maxGLateral: null })],
      lapTimesSeconds: [],
    });
    const cap = sig.axes.find((a) => a.key === 'cap')!;
    expect(cap.value).toBeNull();
    expect(cap.detail).toBeNull();
  });

  it('ne touche pas aux 4 traits existants', () => {
    const sig = computeSignature({ segments: FULL_TURNS, lapTimesSeconds: [100, 102] });
    const keys = sig.traits.map((t) => t.key).sort();
    expect(keys).toEqual(['braking', 'lateral', 'reaccel', 'regularity']);
  });

  it('ignore les segments non-virage pour les axes', () => {
    const sig = computeSignature({
      segments: [
        turn({ segmentIndex: 1 }),
        { ...turn({ segmentIndex: 2 }), kind: 'straight', maxGLateral: 5, maxGBraking: 5 },
      ],
      lapTimesSeconds: [],
    });
    // La ligne droite (G fantaisistes) ne doit pas saturer l'empreinte.
    const cap = sig.axes.find((a) => a.key === 'cap')!;
    expect(cap.value).toBeLessThan(1);
  });
});
