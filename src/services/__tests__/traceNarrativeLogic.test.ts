import { assembleTraceOfDay, type TraceOfDayParts } from '../traceNarrativeLogic';
import type { DataConfidence } from '../dataConfidenceLogic';
import type { KeyMoment } from '../keyMomentsLogic';

const REFERENCE: KeyMoment = {
  key: 'reference',
  title: 'Votre tour de référence',
  fact: 'Tour 4 — 1:42.300.',
};
const ENGAGED: KeyMoment = {
  key: 'engaged',
  title: 'Le passage le plus engagé',
  fact: 'Virage 3 — 1.10 g.',
};
const VARIATION: KeyMoment = { key: 'variation', title: 'L’écart le plus net', fact: '0,8 s.' };

const COMPLETE: DataConfidence = { level: 'complete', label: 'Lecture complète', reasons: [] };

function parts(over: Partial<TraceOfDayParts> = {}): TraceOfDayParts {
  return {
    circuitName: 'Circuit de Haute Saintonge',
    lapCount: 6,
    bestSeconds: 102.3,
    spreadSeconds: 0.9,
    band: 'régulier',
    confidence: COMPLETE,
    keyMoments: [REFERENCE, ENGAGED, VARIATION],
    hasRessenti: false,
    sessionsHere: 3,
    ...over,
  };
}

describe('assembleTraceOfDay', () => {
  it('expose la qualité de lecture (libellé + niveau)', () => {
    const t = assembleTraceOfDay(parts());
    expect(t.qualityLabel).toBe('Lecture complète');
    expect(t.qualityLevel).toBe('complete');
  });

  it('sans insights, la qualité reste nulle (état honnête, pas de score inventé)', () => {
    const t = assembleTraceOfDay(parts({ confidence: null }));
    expect(t.qualityLabel).toBeNull();
    expect(t.qualityLevel).toBeNull();
  });

  it('retient en priorité le tour de référence comme moment-clé', () => {
    const t = assembleTraceOfDay(parts());
    expect(t.highlight?.key).toBe('reference');
  });

  it('à défaut de référence, retient le passage engagé', () => {
    const t = assembleTraceOfDay(parts({ keyMoments: [VARIATION, ENGAGED] }));
    expect(t.highlight?.key).toBe('engaged');
  });

  it('sans aucun moment, highlight est null (rien inventé)', () => {
    const t = assembleTraceOfDay(parts({ keyMoments: [] }));
    expect(t.highlight).toBeNull();
  });

  it('situe la séance dans le fil du circuit (soi contre soi)', () => {
    const t = assembleTraceOfDay(parts({ sessionsHere: 3 }));
    expect(t.narrative).toContain('3ᵉ séance');
  });

  it('première venue : le fil commence ici', () => {
    const t = assembleTraceOfDay(parts({ sessionsHere: 1 }));
    expect(t.narrative).toContain('Première trace');
  });

  it('trop peu de tours : narration sobre, sans fil inventé', () => {
    const t = assembleTraceOfDay(parts({ lapCount: 1 }));
    expect(t.narrative).not.toContain('séance sur ce circuit');
    expect(t.narrative).toContain('La trace s’écrit');
  });

  it('le ressenti reste une invitation tant qu’aucune note n’existe', () => {
    expect(assembleTraceOfDay(parts({ hasRessenti: false })).ressentiPrompt).toBe(
      'Ajouter votre ressenti.'
    );
    expect(assembleTraceOfDay(parts({ hasRessenti: true })).ressentiPrompt).toBe(
      'Votre ressenti est noté.'
    );
  });

  it('ne formule jamais de consigne (doctrine miroir)', () => {
    const t = assembleTraceOfDay(parts());
    const forbidden = /freinez|accélérez|vous devriez|il faut|évitez/i;
    expect(forbidden.test(t.narrative)).toBe(false);
    expect(forbidden.test(t.ressentiPrompt)).toBe(false);
  });
});
