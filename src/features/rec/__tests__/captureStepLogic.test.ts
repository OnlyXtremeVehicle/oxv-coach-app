/**
 * Tests captureStepLogic — projection PURE de l'état pilote sur l'étape du flux
 * de capture v2 (lot V2-L2). Couvre TOUS les états S1..S10 (fonction totale) et
 * vérifie que les routes de jour J pointent sur les segments immersifs attendus.
 * .ts pur, aucun rendu de composant, aucune lecture de store.
 */

import { ALL_PILOT_STATES, type PilotState } from '@/types/state';

import { captureStep, REC_ROUTES } from '../captureStepLogic';

describe('captureStep — hors jour J (le hub rend son propre contenu)', () => {
  const horsJour: PilotState[] = [
    'S1_decouverte',
    'S2_initiation',
    'S3_attente',
    'S4_anticipation',
    'S10_repos',
  ];

  it.each(horsJour)('%s → step hors-jour, route null (aucune redirection)', (state) => {
    expect(captureStep(state)).toEqual({ step: 'hors-jour', route: null });
  });
});

describe('captureStep — jour J (le hub redirige vers l’étape courante)', () => {
  it('S5 approche → arrivee', () => {
    expect(captureStep('S5_approche')).toEqual({
      step: 'arrivee',
      route: REC_ROUTES.arrivee,
    });
  });

  it('S6 roulage → roulage (silence en piste)', () => {
    expect(captureStep('S6_roulage')).toEqual({
      step: 'roulage',
      route: REC_ROUTES.roulage,
    });
  });

  it('S7 paddock → entre-runs', () => {
    expect(captureStep('S7_paddock')).toEqual({
      step: 'entre-runs',
      route: REC_ROUTES.entreRuns,
    });
  });

  it('S8 atterrissage → fin', () => {
    expect(captureStep('S8_atterrissage')).toEqual({ step: 'fin', route: REC_ROUTES.fin });
  });

  it('S9 décantation → fin', () => {
    expect(captureStep('S9_decantation')).toEqual({ step: 'fin', route: REC_ROUTES.fin });
  });
});

describe('captureStep — fonction totale et cohérence route/segment', () => {
  it('couvre chaque état de ALL_PILOT_STATES sans trou', () => {
    for (const state of ALL_PILOT_STATES) {
      const res = captureStep(state);
      // hors-jour ⇔ route null ; toute autre étape ⇔ route non nulle.
      if (res.step === 'hors-jour') {
        expect(res.route).toBeNull();
      } else {
        expect(res.route).not.toBeNull();
      }
    }
  });

  it('les routes de jour J vivent bien sous /(app2)/rec/', () => {
    for (const state of ALL_PILOT_STATES) {
      const { route } = captureStep(state);
      if (route !== null) expect(route.startsWith('/(app2)/rec/')).toBe(true);
    }
  });

  it('les segments immersifs redirigés sont ceux masquant la TabBar', () => {
    // arrivee / roulage sont dans V2_HIDDEN_SEGMENTS ; entre-runs et fin sont
    // portés par leurs propres missions — on vérifie ici seulement le préfixe.
    expect(REC_ROUTES.arrivee).toBe('/(app2)/rec/arrivee');
    expect(REC_ROUTES.roulage).toBe('/(app2)/rec/roulage');
    expect(REC_ROUTES.entreRuns).toBe('/(app2)/rec/entre-runs');
    expect(REC_ROUTES.fin).toBe('/(app2)/rec/fin');
  });
});
