import {
  BREAK_DIAL_MAX_MS,
  computeBreakCountdown,
  dayBestKey,
  dayRecordCelebratedKey,
  decidePauseBiometry,
  evaluateDayBest,
  formatMmSs,
  localDayIso,
} from '../entreRunsLogic';

describe('formatMmSs', () => {
  it('formate en m:ss avec secondes paddées', () => {
    expect(formatMmSs(0)).toBe('0:00');
    expect(formatMmSs(5_000)).toBe('0:05');
    expect(formatMmSs(65_000)).toBe('1:05');
    expect(formatMmSs(32 * 60_000)).toBe('32:00');
  });
  it('borne le négatif à 0:00', () => {
    expect(formatMmSs(-1000)).toBe('0:00');
  });
});

describe('computeBreakCountdown', () => {
  const now = new Date('2026-07-19T14:00:00').getTime();

  it('masque le cadran sans départ connu', () => {
    expect(computeBreakCountdown(null, now).show).toBe(false);
  });

  it('masque le cadran si le départ est un autre jour', () => {
    const tomorrow = new Date('2026-07-20T09:00:00').getTime();
    expect(computeBreakCountdown(tomorrow, now).show).toBe(false);
  });

  it('masque le cadran si le départ est déjà passé', () => {
    const past = new Date('2026-07-19T13:30:00').getTime();
    expect(computeBreakCountdown(past, now).show).toBe(false);
  });

  it('affiche le rebours réel pour un départ aujourd’hui et à venir', () => {
    const start = new Date('2026-07-19T14:20:00').getTime();
    const cd = computeBreakCountdown(start, now);
    expect(cd.show).toBe(true);
    expect(cd.remainingMs).toBe(20 * 60_000);
    expect(cd.label).toBe('20:00');
    expect(cd.progress).toBeGreaterThan(0);
    expect(cd.progress).toBeLessThanOrEqual(1);
  });

  it('borne l’arc à l’échelle du cadran au-delà du max', () => {
    const start = now + BREAK_DIAL_MAX_MS + 10 * 60_000;
    // même jour requis : reste dans la journée
    const sameDayStart = new Date('2026-07-19T23:00:00').getTime();
    const cd = computeBreakCountdown(sameDayStart, now);
    expect(cd.show).toBe(true);
    expect(cd.progress).toBeLessThanOrEqual(1);
    void start;
  });
});

describe('evaluateDayBest', () => {
  it('sans tour courant valide, garde le meilleur persisté et ne célèbre pas', () => {
    expect(evaluateDayBest(90_000, null)).toEqual({ dayBestMs: 90_000, isNewDayRecord: false });
    expect(evaluateDayBest(null, 0)).toEqual({ dayBestMs: null, isNewDayRecord: false });
    expect(evaluateDayBest(null, Number.NaN)).toEqual({ dayBestMs: null, isNewDayRecord: false });
  });

  it('premier tour du jour : pose la référence, pas de célébration', () => {
    expect(evaluateDayBest(null, 92_500)).toEqual({ dayBestMs: 92_500, isNewDayRecord: false });
  });

  it('record du jour uniquement si le run courant bat STRICTEMENT un run antérieur', () => {
    expect(evaluateDayBest(92_000, 90_000)).toEqual({ dayBestMs: 90_000, isNewDayRecord: true });
    expect(evaluateDayBest(90_000, 90_000)).toEqual({ dayBestMs: 90_000, isNewDayRecord: false });
    expect(evaluateDayBest(90_000, 95_000)).toEqual({ dayBestMs: 90_000, isNewDayRecord: false });
  });
});

describe('clés MMKV', () => {
  it('dérive des clés distinctes et stables', () => {
    expect(dayBestKey('2026-07-19')).toBe('day-best:2026-07-19');
    expect(dayRecordCelebratedKey('s1')).toBe('day-record:s1');
  });
  it('localDayIso rend une date locale YYYY-MM-DD', () => {
    expect(localDayIso(new Date('2026-07-19T23:30:00'))).toBe('2026-07-19');
    expect(localDayIso(new Date('2026-01-05T08:00:00'))).toBe('2026-01-05');
  });
});

describe('decidePauseBiometry (fail-closed)', () => {
  it('flag OFF → none, quoi qu’il arrive', () => {
    expect(
      decidePauseBiometry({ flagEnabled: false, captureConsent: true, polarPaired: true })
    ).toBe('none');
  });
  it('consentement absent → none', () => {
    expect(
      decidePauseBiometry({ flagEnabled: true, captureConsent: false, polarPaired: true })
    ).toBe('none');
  });
  it('flag + consentement sans Polar → hint (honnêteté phase A)', () => {
    expect(
      decidePauseBiometry({ flagEnabled: true, captureConsent: true, polarPaired: false })
    ).toBe('hint');
  });
  it('flag + consentement + Polar appairé → strip', () => {
    expect(
      decidePauseBiometry({ flagEnabled: true, captureConsent: true, polarPaired: true })
    ).toBe('strip');
  });
});
