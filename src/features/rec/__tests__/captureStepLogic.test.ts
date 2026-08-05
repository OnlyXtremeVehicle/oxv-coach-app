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
    // S8/S9 : la séance vient de finir, mais `fin` est un TRANSIT atteint par
    // `roulage` AVEC le sessionId réel — jamais une redirection du hub sans
    // identifiant (vérif L2 [3]). En ouverture à froid, le hub rend son contenu.
    'S8_atterrissage',
    'S9_decantation',
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

  it('S8 atterrissage → hors-jour (fin est un transit avec sessionId, pas une redirection)', () => {
    expect(captureStep('S8_atterrissage')).toEqual({ step: 'hors-jour', route: null });
  });

  it('S9 décantation → hors-jour', () => {
    expect(captureStep('S9_decantation')).toEqual({ step: 'hors-jour', route: null });
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
    // Étapes 4a et 4b, posées le 05/08/2026 en scindant `rec/equipement`.
    //
    // CES DEUX LIGNES SONT LE SEUL MÉCANISME DU DÉPÔT qui fera échouer
    // bruyamment un futur renommage de route. `typedRoutes` est actif mais ne
    // connaît aucune route `(app2)`, et tous les appels sont castés `as never` :
    // une route morte ne se verrait nulle part ailleurs.
    expect(REC_ROUTES.appairage).toBe('/(app2)/rec/appairage');
    expect(REC_ROUTES.consentement).toBe('/(app2)/rec/consentement');
    expect(REC_ROUTES.roulage).toBe('/(app2)/rec/roulage');
    expect(REC_ROUTES.entreRuns).toBe('/(app2)/rec/entre-runs');
    expect(REC_ROUTES.fin).toBe('/(app2)/rec/fin');
  });
});
