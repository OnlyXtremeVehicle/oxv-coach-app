/**
 * Tests de la logique pure de la Signature de pilotage (pilier §3.1).
 *
 * Vérifie que les traits dérivés sont FACTUELS et que les seuils
 * classent correctement — sans jamais produire de jugement.
 */

import { type SignatureSegmentInput, computeSignature } from '../pilotSignatureService';

function turn(index: number, over: Partial<SignatureSegmentInput> = {}): SignatureSegmentInput {
  return {
    segmentIndex: index,
    segmentName: `Virage ${index}`,
    kind: 'turn',
    entrySpeedKmh: 120,
    apexSpeedKmh: 80,
    exitSpeedKmh: 100,
    maxGLateral: 0.9,
    maxGBraking: 0.8,
    marginPercent: 40,
    ...over,
  };
}

describe('computeSignature', () => {
  it('classe un freinage appuyé quand le pic moyen ≥ 1.0 g', () => {
    const sig = computeSignature({
      segments: [turn(1, { maxGBraking: 1.2 }), turn(2, { maxGBraking: 1.1 })],
      lapTimesSeconds: [],
    });
    const braking = sig.traits.find((t) => t.key === 'braking');
    expect(braking?.value).toBe('appuyé');
  });

  it('classe un freinage progressif quand le pic moyen < 0.6 g', () => {
    const sig = computeSignature({
      segments: [turn(1, { maxGBraking: 0.4 }), turn(2, { maxGBraking: 0.5 })],
      lapTimesSeconds: [],
    });
    expect(sig.traits.find((t) => t.key === 'braking')?.value).toBe('progressif');
  });

  it('classe un engagement latéral soutenu à ≥ 1.1 g', () => {
    const sig = computeSignature({
      segments: [turn(1, { maxGLateral: 1.2 }), turn(2, { maxGLateral: 1.3 })],
      lapTimesSeconds: [],
    });
    expect(sig.traits.find((t) => t.key === 'lateral')?.value).toBe('soutenu');
  });

  it('classe des tours très réguliers quand écart-type ≤ 0.5 s', () => {
    const sig = computeSignature({
      segments: [turn(1)],
      lapTimesSeconds: [92.1, 92.3, 92.0, 92.2],
    });
    expect(sig.traits.find((t) => t.key === 'regularity')?.value).toBe('très réguliers');
  });

  it('classe des tours variables quand écart-type > 1.5 s', () => {
    const sig = computeSignature({
      segments: [turn(1)],
      lapTimesSeconds: [90, 95, 88, 99],
    });
    expect(sig.traits.find((t) => t.key === 'regularity')?.value).toBe('variables');
  });

  it('retourne les 2 virages les plus confortables (plus haute marge)', () => {
    const sig = computeSignature({
      segments: [
        turn(1, { marginPercent: 20 }),
        turn(2, { marginPercent: 60 }),
        turn(3, { marginPercent: 45 }),
      ],
      lapTimesSeconds: [],
    });
    expect(sig.comfortCorners).toHaveLength(2);
    expect(sig.comfortCorners[0].segmentIndex).toBe(2); // 60 % en tête
    expect(sig.comfortCorners[1].segmentIndex).toBe(3); // 45 % ensuite
  });

  it('ignore les segments de type ligne droite pour les traits virage', () => {
    const sig = computeSignature({
      segments: [turn(1, { maxGBraking: 1.2 }), { ...turn(2), kind: 'straight', maxGBraking: 0.1 }],
      lapTimesSeconds: [],
    });
    // Seul le virage compte → freinage appuyé (1.2), pas dilué par la ligne droite
    expect(sig.traits.find((t) => t.key === 'braking')?.value).toBe('appuyé');
    expect(sig.turnSampleCount).toBe(1);
  });

  it('ne produit aucun trait jugeant (pas de "bon"/"mauvais"/"à améliorer")', () => {
    const sig = computeSignature({
      segments: [turn(1), turn(2)],
      lapTimesSeconds: [92, 93],
    });
    const allText = sig.traits
      .map((t) => `${t.label} ${t.value} ${t.detail ?? ''}`)
      .join(' ')
      .toLowerCase();
    for (const banned of ['bon', 'mauvais', 'améliorer', 'corriger', 'meilleur', 'pire']) {
      expect(allText).not.toContain(banned);
    }
  });

  it('gère gracieusement une session sans données (traits vides, pas de crash)', () => {
    const sig = computeSignature({ segments: [], lapTimesSeconds: [] });
    expect(sig.traits).toHaveLength(0);
    expect(sig.comfortCorners).toHaveLength(0);
    expect(sig.manifest).toBeNull();
  });
});
