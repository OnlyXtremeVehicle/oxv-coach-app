import {
  type LiveFrame,
  type RosterMeta,
  deriveLiveConn,
  formatLiveChrono,
  liveAlert,
  reduceRoster,
  shouldEmitFrame,
} from '@/services/liveSessionLogic';

function frame(over: Partial<LiveFrame> = {}): LiveFrame {
  return {
    lap: 3,
    sector: 2,
    speedKmh: 120,
    gLat: 0.8,
    gLong: -0.4,
    chronoMs: 24318,
    cornerIndex: null,
    cornerWatch: false,
    atMs: 1000,
    ...over,
  };
}

function meta(over: Partial<RosterMeta> = {}): RosterMeta {
  return {
    pilotId: 'p1',
    firstName: 'Adrien',
    sessionId: 's1',
    circuit: 'Haute Saintonge',
    onTrack: true,
    sinceMs: 1000,
    ...over,
  };
}

describe('shouldEmitFrame (throttle ~3-4 Hz côté pilote)', () => {
  it('émet toujours la première trame', () => {
    expect(shouldEmitFrame(null, 5000)).toBe(true);
  });
  it('émet quand l’écart atteint minIntervalMs', () => {
    expect(shouldEmitFrame(1000, 1300, 300)).toBe(true);
    expect(shouldEmitFrame(1000, 1400, 300)).toBe(true);
  });
  it('n’émet pas avant minIntervalMs (on ne relaie pas 25 Hz)', () => {
    expect(shouldEmitFrame(1000, 1100, 300)).toBe(false);
    expect(shouldEmitFrame(1000, 1299, 300)).toBe(false);
  });
});

describe('reduceRoster (présence → qui est en piste, pas un classement)', () => {
  it('dédoublonne par pilote en gardant la méta la plus récente', () => {
    const presence = {
      keyA: [meta({ pilotId: 'p1', sinceMs: 1000, onTrack: false })],
      keyB: [meta({ pilotId: 'p1', sinceMs: 2000, onTrack: true })],
    };
    const roster = reduceRoster(presence);
    expect(roster).toHaveLength(1);
    expect(roster[0].sinceMs).toBe(2000);
    expect(roster[0].onTrack).toBe(true);
  });

  it('trie « en piste » d’abord, puis par ancienneté croissante', () => {
    const presence = {
      a: [meta({ pilotId: 'p1', firstName: 'Adrien', onTrack: true, sinceMs: 3000 })],
      b: [meta({ pilotId: 'p2', firstName: 'Bruno', onTrack: false, sinceMs: 1000 })],
      c: [meta({ pilotId: 'p3', firstName: 'Chloé', onTrack: true, sinceMs: 2000 })],
    };
    const roster = reduceRoster(presence);
    expect(roster.map((r) => r.pilotId)).toEqual(['p3', 'p1', 'p2']);
  });

  it('roster vide si personne en piste', () => {
    expect(reduceRoster({})).toEqual([]);
  });
});

describe('deriveLiveConn (état de flux honnête)', () => {
  it('offline si non abonné', () => {
    expect(deriveLiveConn({ subscribed: false, lastFrameMs: 1000, nowMs: 1000 })).toBe('offline');
  });
  it('connecting si abonné sans trame encore', () => {
    expect(deriveLiveConn({ subscribed: true, lastFrameMs: null, nowMs: 5000 })).toBe('connecting');
  });
  it('live si trame récente', () => {
    expect(deriveLiveConn({ subscribed: true, lastFrameMs: 9000, nowMs: 10000 })).toBe('live');
  });
  it('stale si le flux se tait un moment', () => {
    expect(deriveLiveConn({ subscribed: true, lastFrameMs: 1000, nowMs: 5000 })).toBe('stale');
  });
  it('offline si silence prolongé (réseau circuit coupé)', () => {
    expect(deriveLiveConn({ subscribed: true, lastFrameMs: 1000, nowMs: 20000 })).toBe('offline');
  });
});

describe('liveAlert (factuel, jamais une consigne)', () => {
  it('null si aucun virage signalé', () => {
    expect(liveAlert(frame({ cornerWatch: false }), 'Virage du Musée')).toBeNull();
  });
  it('null si cornerWatch mais pas d’index', () => {
    expect(liveAlert(frame({ cornerWatch: true, cornerIndex: null }), null)).toBeNull();
  });
  it('nomme le virage « à surveiller » (registre autorisé)', () => {
    expect(liveAlert(frame({ cornerWatch: true, cornerIndex: 3 }), 'Virage du Musée')).toBe(
      'Virage du Musée · à surveiller'
    );
  });
  it('retombe sur « Virage N » sans nom', () => {
    expect(liveAlert(frame({ cornerWatch: true, cornerIndex: 5 }), null)).toBe(
      'Virage 5 · à surveiller'
    );
  });
  it('ne contient aucun verbe prescriptif', () => {
    const txt = liveAlert(frame({ cornerWatch: true, cornerIndex: 3 }), 'Virage 3') ?? '';
    expect(txt).not.toMatch(/frein|accél|ralent|devriez|il faut|évitez/i);
  });
});

describe('formatLiveChrono', () => {
  it('formate m:ss.d', () => {
    expect(formatLiveChrono(84318)).toBe('1:24.3');
    expect(formatLiveChrono(5000)).toBe('0:05.0');
  });
  it('tiret si null/invalide', () => {
    expect(formatLiveChrono(null)).toBe('—');
    expect(formatLiveChrono(-1)).toBe('—');
    expect(formatLiveChrono(Number.NaN)).toBe('—');
  });
});
