/**
 * Tests du garde-fou de rendu du débrief (T-1, PR-05).
 */

import { guardDebriefActs } from '../debriefRenderGuard';

const SIGN = 'Un constat, pas une consigne.';

describe('guardDebriefActs', () => {
  it('laisse passer des actes conformes', () => {
    const acts = {
      act1: 'Vous avez piloté avec aisance.',
      act2: "L'appui latéral montait à 1,1 g.",
      act3: 'Une zone à observer la prochaine fois.',
      sign: SIGN,
    };
    expect(guardDebriefActs(acts)).toEqual(acts);
  });

  it('blanchit un acte contenant une tournure prescriptive, garde les autres', () => {
    const out = guardDebriefActs({
      act1: 'Vous avez piloté avec aisance.',
      act2: 'Freinez plus tôt au virage 3.',
      act3: 'Une zone à observer.',
      sign: SIGN,
    });
    expect(out.act1).toBe('Vous avez piloté avec aisance.');
    expect(out.act2).toBe(''); // non conforme → blanchi (repli sur texte d'attente)
    expect(out.act3).toBe('Une zone à observer.');
  });

  it('préserve le champ sign (constant, neutre)', () => {
    const out = guardDebriefActs({ act1: '', act2: '', act3: '', sign: SIGN });
    expect(out.sign).toBe(SIGN);
  });
});
