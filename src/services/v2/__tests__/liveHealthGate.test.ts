import { canEmitBiometry, stripHealth, type BiometryGate } from '../liveHealthGate';

describe('stripHealth', () => {
  it('ne laisse passer QUE les clés blanches, écarte toute la santé', () => {
    const payload = {
      position: { lat: 45.1, lon: -0.6 },
      lapMs: 92345,
      sector: 2,
      ts: 1_700_000_000_000,
      // Tout ce qui suit doit disparaître :
      hr: 172,
      rr: 348,
      rrMs: [812, 799, 805],
      contact: true,
      heartRate: 172,
      bpm: 172,
      foo: 'bar',
    };

    const out = stripHealth(payload);

    // Clés conservées, valeurs intactes.
    expect(out).toEqual({
      position: { lat: 45.1, lon: -0.6 },
      lapMs: 92345,
      sector: 2,
      ts: 1_700_000_000_000,
    });
    // Aucune trace de santé dans la sortie sérialisée (garde-fou critique).
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('hr');
    expect(serialized).not.toContain('rr');
    expect(serialized).not.toContain('contact');
    expect(serialized).not.toContain('bpm');
    expect(serialized).not.toContain('heart');
    // Nouvel objet, pas une mutation de l'entrée.
    expect(out).not.toBe(payload);
  });

  it('une charge entièrement santé → objet vide', () => {
    const health = {
      hr: 172,
      rrMs: [812, 799],
      contact: true,
      heartRate: 172,
      bpm: 172,
    };
    expect(stripHealth(health)).toEqual({});
  });

  it('ne recopie que les clés blanches PRÉSENTES (pas de undefined parasite)', () => {
    const out = stripHealth({ ts: 42, hr: 172 });
    expect(out).toEqual({ ts: 42 });
    // La clé absente reste absente, pas présente à undefined.
    expect(Object.prototype.hasOwnProperty.call(out, 'position')).toBe(false);
  });

  it('LIVE-B — un payload board complet passe INTACT', () => {
    // Les six champs du tableau de marche sont des faits publics de roulage :
    // ils traversent la barrière sans perte, sinon l'écran TV serait vide.
    const board = {
      pilotHandle: 'ana',
      carNo: 21,
      lastLapMs: 93000,
      bestLapMs: 91000,
      sector: 2,
      ts: 1_700_000_000_000,
    };
    expect(stripHealth(board)).toEqual(board);
  });

  it('LIVE-B — un payload board pollué de biométrie perd la biométrie', () => {
    const out = stripHealth({
      pilotHandle: 'ana',
      carNo: 21,
      lastLapMs: 93000,
      bestLapMs: 91000,
      sector: 2,
      ts: 1_700_000_000_000,
      // Injection : ce que le canal board ne doit JAMAIS porter.
      hr: 172,
      hrBpm: 172,
      rrTrend: 'en hausse',
      contact: 'ok',
      spo2: 98,
    });

    expect(out).toEqual({
      pilotHandle: 'ana',
      carNo: 21,
      lastLapMs: 93000,
      bestLapMs: 91000,
      sector: 2,
      ts: 1_700_000_000_000,
    });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('hr');
    expect(serialized).not.toContain('rr');
    expect(serialized).not.toContain('contact');
    expect(serialized).not.toContain('spo2');
  });

  it('LIVE-B — une clé santé NON prévue reste écartée (liste blanche, pas noire)', () => {
    // La liste énumère le publiable : un capteur inventé demain ne fuite pas.
    const out = stripHealth({ carNo: 21, ts: 1, glycemie: 0.9, tempCorpsC: 37.4, vo2: 52 });
    expect(out).toEqual({ carNo: 21, ts: 1 });
  });

  it('entrée non-objet → objet vide (fail-closed)', () => {
    // Cast contrôlés : on éprouve la robustesse face à une entrée hors contrat.
    expect(stripHealth(null as unknown as Record<string, unknown>)).toEqual({});
    expect(stripHealth(undefined as unknown as Record<string, unknown>)).toEqual({});
    expect(stripHealth(42 as unknown as Record<string, unknown>)).toEqual({});
    expect(stripHealth('hr=172' as unknown as Record<string, unknown>)).toEqual({});
  });
});

describe('canEmitBiometry', () => {
  it('les trois verrous stricts à true → true', () => {
    expect(
      canEmitBiometry({
        consentCapture: true,
        detailedBinome: true,
        flagBiometry: true,
      })
    ).toBe(true);
  });

  it('un seul verrou à false → false (chacun testé)', () => {
    expect(
      canEmitBiometry({ consentCapture: false, detailedBinome: true, flagBiometry: true })
    ).toBe(false);
    expect(
      canEmitBiometry({ consentCapture: true, detailedBinome: false, flagBiometry: true })
    ).toBe(false);
    expect(
      canEmitBiometry({ consentCapture: true, detailedBinome: true, flagBiometry: false })
    ).toBe(false);
  });

  it('un champ undefined ou null → false (fail-closed)', () => {
    expect(
      canEmitBiometry({
        consentCapture: undefined as unknown as boolean,
        detailedBinome: true,
        flagBiometry: true,
      })
    ).toBe(false);
    expect(
      canEmitBiometry({
        consentCapture: true,
        detailedBinome: null as unknown as boolean,
        flagBiometry: true,
      })
    ).toBe(false);
  });

  it('objet vide ou gate absent → false', () => {
    expect(canEmitBiometry({} as unknown as BiometryGate)).toBe(false);
    expect(canEmitBiometry(null as unknown as BiometryGate)).toBe(false);
    expect(canEmitBiometry(undefined as unknown as BiometryGate)).toBe(false);
  });
});
