/**
 * Tests de la state machine OXV (determineState + isScreenValid).
 *
 * Vise une couverture exhaustive des 10 états + transitions principales
 * + cas edge (cooldown post-session, anticipation 14j, etc.).
 */

import {
  AppContext,
  DEFAULT_CONDITIONS,
  PilotState,
  SessionRef,
  STATE_THRESHOLDS,
  determineState,
  isScreenValid,
} from '../state';

const NOW = new Date('2026-05-24T12:00:00Z');

function baseCtx(overrides: Partial<AppContext> = {}): AppContext {
  return {
    hasAccount: true,
    onboardingComplete: true,
    upcomingSessions: [],
    pastSessions: [],
    activeRecording: null,
    position: null,
    conditions: { ...DEFAULT_CONDITIONS },
    now: NOW,
    ...overrides,
  };
}

function makeSession(opts: {
  id?: string;
  startsAtIso: string;
  endsAtIso?: string;
}): SessionRef {
  return {
    id: opts.id ?? 's1',
    startsAt: new Date(opts.startsAtIso),
    endsAt: opts.endsAtIso ? new Date(opts.endsAtIso) : null,
    circuitId: 'c1',
  };
}

describe('determineState — pré-conditions', () => {
  it('renvoie S1 quand pas de compte', () => {
    expect(determineState(baseCtx({ hasAccount: false }))).toBe<PilotState>('S1_decouverte');
  });

  it('renvoie S2 quand onboarding non complété', () => {
    expect(determineState(baseCtx({ onboardingComplete: false }))).toBe<PilotState>(
      'S2_initiation'
    );
  });

  it("priorise S1 sur S2 quand pas de compte ET onboarding non fait", () => {
    expect(
      determineState(baseCtx({ hasAccount: false, onboardingComplete: false }))
    ).toBe<PilotState>('S1_decouverte');
  });
});

describe('determineState — pilotage actif', () => {
  it('renvoie S6 (roulage) quand recording avec vitesse moyenne au-dessus du seuil', () => {
    expect(
      determineState(
        baseCtx({
          activeRecording: {
            sessionId: 'live',
            startedAt: NOW,
            status: 'recording',
            recentAverageSpeedKmh: STATE_THRESHOLDS.drivingMinSpeedKmh + 10,
          },
        })
      )
    ).toBe<PilotState>('S6_roulage');
  });

  it('renvoie S7 (paddock) quand recording mais véhicule arrêté', () => {
    expect(
      determineState(
        baseCtx({
          activeRecording: {
            sessionId: 'live',
            startedAt: NOW,
            status: 'recording',
            recentAverageSpeedKmh: 0,
          },
        })
      )
    ).toBe<PilotState>('S7_paddock');
  });

  it("le pilotage actif l'emporte sur tout — même position en route", () => {
    expect(
      determineState(
        baseCtx({
          activeRecording: {
            sessionId: 'live',
            startedAt: NOW,
            status: 'recording',
            recentAverageSpeedKmh: 80,
          },
          position: {
            lat: 0,
            lon: 0,
            distanceToCircuitKm: 50,
            moving: true,
            headingToCircuit: true,
            measuredAt: NOW,
          },
        })
      )
    ).toBe<PilotState>('S6_roulage');
  });
});

describe('determineState — atterrissage et décantation', () => {
  it('renvoie S8 dans les 2h après la fin de la dernière session', () => {
    const endedAt = new Date(NOW.getTime() - 30 * 60 * 1000).toISOString(); // -30 min
    expect(
      determineState(
        baseCtx({
          pastSessions: [
            makeSession({ startsAtIso: '2026-05-24T10:00:00Z', endsAtIso: endedAt }),
          ],
        })
      )
    ).toBe<PilotState>('S8_atterrissage');
  });

  it('renvoie S9 entre 2h et 48h après la session', () => {
    const endedAt = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString(); // -25h
    expect(
      determineState(
        baseCtx({
          pastSessions: [
            makeSession({ startsAtIso: '2026-05-23T10:00:00Z', endsAtIso: endedAt }),
          ],
        })
      )
    ).toBe<PilotState>('S9_decantation');
  });

  it('renvoie S10 quand la dernière session date de plus de 48h', () => {
    const endedAt = new Date(NOW.getTime() - 72 * 60 * 60 * 1000).toISOString(); // -3 jours
    expect(
      determineState(
        baseCtx({
          pastSessions: [
            makeSession({ startsAtIso: '2026-05-21T10:00:00Z', endsAtIso: endedAt }),
          ],
        })
      )
    ).toBe<PilotState>('S10_repos');
  });
});

describe('determineState — anticipation et approche', () => {
  it('renvoie S4 pour une session dans les 14 prochains jours', () => {
    expect(
      determineState(
        baseCtx({
          upcomingSessions: [makeSession({ startsAtIso: '2026-05-30T09:00:00Z' })], // +6 jours
        })
      )
    ).toBe<PilotState>('S4_anticipation');
  });

  it('renvoie S3 (attente) quand la prochaine session est au-delà de 14 jours', () => {
    expect(
      determineState(
        baseCtx({
          upcomingSessions: [makeSession({ startsAtIso: '2026-07-01T09:00:00Z' })], // +38 j
        })
      )
    ).toBe<PilotState>('S3_attente');
  });

  it('renvoie S5 (approche) quand on roule en direction du circuit le jour J', () => {
    expect(
      determineState(
        baseCtx({
          upcomingSessions: [makeSession({ startsAtIso: '2026-05-24T18:00:00Z' })], // +6h
          position: {
            lat: 45.7,
            lon: -0.2,
            distanceToCircuitKm: 30,
            moving: true,
            headingToCircuit: true,
            measuredAt: NOW,
          },
        })
      )
    ).toBe<PilotState>('S5_approche');
  });

  it("renvoie S7 (paddock) à l'arrivée au circuit avec session du jour", () => {
    expect(
      determineState(
        baseCtx({
          upcomingSessions: [makeSession({ startsAtIso: '2026-05-24T14:00:00Z' })],
          position: {
            lat: 45.6004,
            lon: -0.141,
            distanceToCircuitKm: 0.3,
            moving: false,
            headingToCircuit: false,
            measuredAt: NOW,
          },
        })
      )
    ).toBe<PilotState>('S7_paddock');
  });

  it('renvoie S3 par défaut si aucun signal exploitable', () => {
    expect(determineState(baseCtx())).toBe<PilotState>('S3_attente');
  });
});

describe('isScreenValid', () => {
  it('accepte le bilan dans les états post-session', () => {
    expect(isScreenValid('13_bilan', 'S8_atterrissage')).toBe(true);
    expect(isScreenValid('13_bilan', 'S9_decantation')).toBe(true);
    expect(isScreenValid('13_bilan', 'S10_repos')).toBe(true);
  });

  it("refuse tout écran pilote en S6 (silence en piste)", () => {
    expect(isScreenValid('13_bilan', 'S6_roulage')).toBe(false);
    expect(isScreenValid('20_accueil', 'S6_roulage')).toBe(false);
    expect(isScreenValid('22_paddock_entre_runs', 'S6_roulage')).toBe(false);
  });

  it('autorise les écrans d\'onboarding uniquement en S2', () => {
    expect(isScreenValid('01_accueil_philosophique', 'S2_initiation')).toBe(true);
    expect(isScreenValid('06_pacte', 'S2_initiation')).toBe(true);
    expect(isScreenValid('01_accueil_philosophique', 'S10_repos')).toBe(false);
  });

  it('autorise les écrans système hors initiation et roulage', () => {
    expect(isScreenValid('24_settings', 'S3_attente')).toBe(true);
    expect(isScreenValid('24_settings', 'S10_repos')).toBe(true);
    expect(isScreenValid('24_settings', 'S2_initiation')).toBe(false);
    expect(isScreenValid('24_settings', 'S6_roulage')).toBe(false);
  });
});
