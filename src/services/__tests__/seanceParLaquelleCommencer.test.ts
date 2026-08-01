/**
 * LA SÉANCE PAR LAQUELLE COMMENCER — une seule marque dans la file.
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * `une seule séance est désignée, jamais deux`. Marquer toutes les séances non
 * lues ne dirait rien : si tout est signalé, rien ne l'est, et le coach se
 * retrouve devant un mur rouge qui ne l'aide pas à choisir. Une file où tout est
 * urgent n'est plus une file.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT AUSSI
 *
 * L'ordre. La plus ANCIENNE est désignée, parce que c'est le pilote qui attend
 * depuis le plus longtemps. Trier par autre chose — la marge la plus courte, le
 * pilote le plus assidu — reviendrait à hiérarchiser les élèves, ce que la
 * doctrine refuse.
 */

import {
  type QueueItem,
  ordonnePourLecture,
  seanceParLaquelleCommencer,
} from '@/services/coachQueueLogic';

const item = (p: Partial<QueueItem>): QueueItem => ({
  sessionId: 's1',
  pilotId: 'p1',
  pilotName: 'Pilote',
  circuitName: null,
  startedAt: '2026-07-01T10:00:00.000Z',
  lapCount: null,
  status: 'unread',
  ...p,
});

describe('seanceParLaquelleCommencer', () => {
  it('désigne la plus ANCIENNE des séances en attente', () => {
    const choisie = seanceParLaquelleCommencer([
      item({ sessionId: 'recente', startedAt: '2026-07-20T10:00:00.000Z' }),
      item({ sessionId: 'ancienne', startedAt: '2026-07-02T10:00:00.000Z' }),
      item({ sessionId: 'moyenne', startedAt: '2026-07-10T10:00:00.000Z' }),
    ]);
    expect(choisie).toBe('ancienne');
  });

  it('une seule séance est désignée, jamais deux', () => {
    // La fonction rend UN identifiant : le type l'impose. Ce test vérifie qu'on
    // ne bascule pas vers « toutes les non lues » au premier refactor.
    const choisie = seanceParLaquelleCommencer([
      item({ sessionId: 'a', startedAt: '2026-07-01T10:00:00.000Z' }),
      item({ sessionId: 'b', startedAt: '2026-07-01T10:00:01.000Z' }),
    ]);
    expect(typeof choisie).toBe('string');
    expect(choisie).toBe('a');
  });

  it('ignore les séances déjà lues et archivées', () => {
    const choisie = seanceParLaquelleCommencer([
      item({ sessionId: 'lue', status: 'read', startedAt: '2026-06-01T10:00:00.000Z' }),
      item({ sessionId: 'archivee', status: 'archived', startedAt: '2026-06-02T10:00:00.000Z' }),
      item({ sessionId: 'attente', status: 'unread', startedAt: '2026-07-15T10:00:00.000Z' }),
    ]);
    expect(choisie).toBe('attente');
  });

  it('une file à jour ne porte AUCUNE marque', () => {
    // Rendre null est une information : il n'y a rien à commencer.
    expect(seanceParLaquelleCommencer([item({ status: 'read' })])).toBe(null);
    expect(seanceParLaquelleCommencer([])).toBe(null);
  });

  describe('fail-closed sur les entrées douteuses', () => {
    it('une date illisible ne peut pas être désignée', () => {
      // La séance reste dans la file ; elle ne peut simplement pas servir de
      // point de départ, faute de pouvoir être comparée.
      const choisie = seanceParLaquelleCommencer([
        item({ sessionId: 'cassee', startedAt: 'pas une date' }),
        item({ sessionId: 'bonne', startedAt: '2026-07-30T10:00:00.000Z' }),
      ]);
      expect(choisie).toBe('bonne');
    });

    it('une séance sans identifiant n’est pas désignable', () => {
      expect(seanceParLaquelleCommencer([item({ sessionId: '' })])).toBe(null);
    });

    it('des entrées absentes ne font pas tomber la sélection', () => {
      const avecTrou = [null as unknown as QueueItem, item({ sessionId: 'ok' })];
      expect(seanceParLaquelleCommencer(avecTrou)).toBe('ok');
    });

    it('une liste absente rend null plutôt que d’échouer', () => {
      expect(seanceParLaquelleCommencer(null as unknown as QueueItem[])).toBe(null);
    });
  });
});

/**
 * L'ORDRE D'AFFICHAGE — la désignée doit être la PREMIÈRE.
 *
 * La file arrive du plus récent au plus ancien, alors que la séance par laquelle
 * commencer est la plus ANCIENNE : elle se retrouvait en bas de l'écran, et
 * « à commencer par celle-ci » désignait la dernière ligne. Relevé par la revue
 * adversariale du 01/08/2026.
 */
describe('ordonnePourLecture', () => {
  const recente = item({ sessionId: 'recente', startedAt: '2026-07-20T10:00:00.000Z' });
  const moyenne = item({ sessionId: 'moyenne', startedAt: '2026-07-10T10:00:00.000Z' });
  const ancienne = item({ sessionId: 'ancienne', startedAt: '2026-07-02T10:00:00.000Z' });
  // Telle que la base la rend : du plus récent au plus ancien.
  const file = [recente, moyenne, ancienne];

  it('la séance désignée passe en TÊTE', () => {
    const ordre = ordonnePourLecture(file, 'ancienne');
    expect(ordre.map((i) => i.sessionId)).toEqual(['ancienne', 'recente', 'moyenne']);
  });

  it('le reste garde son ordre — on ne renverse pas la file', () => {
    // L'ordre du plus récent au plus ancien est celui qu'on attend d'une liste
    // d'arrivées : seule la désignée remonte.
    const ordre = ordonnePourLecture(file, 'ancienne');
    expect(ordre.slice(1).map((i) => i.sessionId)).toEqual(['recente', 'moyenne']);
  });

  it('aucune désignation → l’ordre est intact', () => {
    expect(ordonnePourLecture(file, null).map((i) => i.sessionId)).toEqual([
      'recente',
      'moyenne',
      'ancienne',
    ]);
  });

  it('une désignation absente de la file ne perd aucune ligne', () => {
    const ordre = ordonnePourLecture(file, 'inconnue');
    expect(ordre).toHaveLength(3);
  });

  it('ne mute pas la liste reçue', () => {
    const copie = [...file];
    ordonnePourLecture(file, 'ancienne');
    expect(file.map((i) => i.sessionId)).toEqual(copie.map((i) => i.sessionId));
  });

  it('une liste absente rend un tableau vide', () => {
    expect(ordonnePourLecture(null as unknown as QueueItem[], 'x')).toEqual([]);
  });
});
