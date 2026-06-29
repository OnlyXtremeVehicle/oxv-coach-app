import {
  groupQueue,
  resolveQueueStatus,
  type QueueItem,
  type QueueStatus,
} from '../coachQueueLogic';

describe('resolveQueueStatus', () => {
  it('le statut explicite (coach_queue) fait foi', () => {
    expect(resolveQueueStatus('archived', false)).toBe('archived');
    expect(resolveQueueStatus('read', false)).toBe('read');
    expect(resolveQueueStatus('unread', true)).toBe('unread');
  });

  it('sans statut explicite, dérive de l’annotation (annotée → lue)', () => {
    expect(resolveQueueStatus(undefined, true)).toBe('read');
    expect(resolveQueueStatus(undefined, false)).toBe('unread');
  });
});

function item(status: QueueStatus, id: string): QueueItem {
  return {
    sessionId: id,
    pilotId: 'p',
    pilotName: 'Pilote',
    circuitName: null,
    startedAt: '2026-06-29T10:00:00Z',
    status,
  };
}

describe('groupQueue', () => {
  it('répartit par statut et compte', () => {
    const g = groupQueue([
      item('unread', 'a'),
      item('unread', 'b'),
      item('read', 'c'),
      item('archived', 'd'),
    ]);
    expect(g.counts).toEqual({ unread: 2, read: 1, archived: 1 });
    expect(g.unread.map((i) => i.sessionId)).toEqual(['a', 'b']);
    expect(g.archived[0].sessionId).toBe('d');
  });

  it('liste vide → compteurs à zéro', () => {
    expect(groupQueue([]).counts).toEqual({ unread: 0, read: 0, archived: 0 });
  });
});
