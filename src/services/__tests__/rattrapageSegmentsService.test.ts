/**
 * LE RATTRAPAGE — quatre refus, et un seul cas qui part.
 *
 * Ce module relance une analyse complète : plusieurs milliers de trames, un
 * recalage, un découpage, des écritures. Chacun de ses refus vaut donc plus
 * cher qu'il n'en a l'air, et c'est ce que ces tests tiennent.
 */

import {
  motifSansRattrapage,
  oublierTentatives,
  rattraperSegments,
} from '../rattrapageSegmentsService';
import { analyzeAndPersistSession } from '../analyzeSessionService';

jest.mock('../analyzeSessionService', () => ({
  analyzeAndPersistSession: jest.fn(),
  // Le vrai prédicat : une séance n'est analysable qu'une fois CLOSE.
  isAnalyzableSession: (s: { status: string | null }) => s.status === 'completed',
}));

const analyse = analyzeAndPersistSession as unknown as jest.Mock;

function entree(p: Partial<Parameters<typeof motifSansRattrapage>[0]> = {}) {
  return {
    sessionId: 's1',
    pilotId: 'p1',
    lectureDAutrui: false,
    statut: 'completed',
    segmentsExistants: 0,
    ...p,
  };
}

beforeEach(() => {
  analyse.mockReset();
  analyse.mockResolvedValue({ segmentsPersisted: 12, sampleCount: 3000, notes: [] });
  oublierTentatives();
});

describe('motifSansRattrapage', () => {
  it('une séance close, à moi, sans segments : rien ne s’y oppose', () => {
    expect(motifSansRattrapage(entree())).toBeNull();
  });

  it('des segments existent déjà — le plus fréquent, et le moins cher à voir', () => {
    expect(motifSansRattrapage(entree({ segmentsExistants: 12 }))).toBe('segments-presents');
  });

  /**
   * `app_segment_analyses_insert_own` interdit au coach d'écrire les segments
   * d'un pilote, et c'est juste : il n'est pas l'auteur de cette mesure. Tenter
   * l'analyse produirait une erreur RLS à chaque ouverture.
   */
  it('une lecture d’autrui ne rattrape rien', () => {
    expect(motifSansRattrapage(entree({ lectureDAutrui: true }))).toBe('lecture-d-autrui');
  });

  it('une séance non close n’a pas fini de s’écrire', () => {
    expect(motifSansRattrapage(entree({ statut: 'recording' }))).toBe('seance-non-close');
    expect(motifSansRattrapage(entree({ statut: null }))).toBe('seance-non-close');
  });
});

describe('rattraperSegments', () => {
  it('lance l’analyse sur le PROPRIÉTAIRE, pas sur le lecteur', async () => {
    await rattraperSegments(entree({ pilotId: 'proprietaire' }));
    expect(analyse).toHaveBeenCalledWith({
      telemetrySessionId: 's1',
      userId: 'proprietaire',
    });
  });

  /**
   * LE CAS QUI COMPTE : deux montages simultanés du même écran — ce qui arrive
   * — ne doivent pas lancer deux analyses. Le marquage se fait AVANT le calcul.
   */
  it('ne part qu’une fois, même sur deux appels simultanés', async () => {
    await Promise.all([rattraperSegments(entree()), rattraperSegments(entree())]);
    expect(analyse).toHaveBeenCalledTimes(1);
  });

  it('une seconde ouverture ne relance rien', async () => {
    await rattraperSegments(entree());
    const motif = await rattraperSegments(entree());
    expect(motif).toBe('deja-tente');
    expect(analyse).toHaveBeenCalledTimes(1);
  });

  it('une analyse qui échoue ne rejette pas — l’écran s’affiche quand même', async () => {
    analyse.mockRejectedValue(new Error('réseau'));
    await expect(rattraperSegments(entree())).resolves.toBeNull();
  });

  it('aucun des quatre refus ne touche à la base', async () => {
    await rattraperSegments(entree({ segmentsExistants: 3 }));
    await rattraperSegments(entree({ lectureDAutrui: true }));
    await rattraperSegments(entree({ statut: 'recording' }));
    expect(analyse).not.toHaveBeenCalled();
  });
});
