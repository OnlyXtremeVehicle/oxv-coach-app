/**
 * Tests carnetLogic (V2-L4, porte VOUS, écran Carnet) — logique pure, node.
 *
 * Couvre : table des onglets + index bornés, décision de swipe (distance,
 * flick, direction, bornage aux extrémités), progression du pager, état
 * d'intention (honorée/en attente), météo du jour de la note sous garde
 * A-WEATHER-1 (jamais un 0° fabriqué, jamais un autre jour), mesurabilité
 * d'objectif (barre SI mesurable, sinon aucune).
 */

import {
  CARNET_SWIPE_VELOCITY,
  CARNET_TAB_LABELS,
  CARNET_TABS,
  clampTabIndex,
  goalProgress,
  goalStatusLabel,
  intentionState,
  intentionStateLabel,
  isGoalMeasurable,
  isSameLocalDay,
  nextTabIndex,
  pagerProgress,
  summarizeNoteWeather,
  tabAt,
  tabIndexOf,
} from '../carnetLogic';

// ---------------------------------------------------------------------------
// Onglets — table & index
// ---------------------------------------------------------------------------

describe('table des onglets', () => {
  it('les 4 onglets dans l’ordre canonique, avec libellés', () => {
    expect(CARNET_TABS).toEqual(['notes', 'intentions', 'objectifs', 'programme']);
    expect(CARNET_TABS.map((t) => CARNET_TAB_LABELS[t])).toEqual([
      'Notes',
      'Intentions',
      'Objectifs',
      'Programme',
    ]);
  });

  it('tabIndexOf / tabAt sont réciproques', () => {
    CARNET_TABS.forEach((tab, i) => {
      expect(tabIndexOf(tab)).toBe(i);
      expect(tabAt(i)).toBe(tab);
    });
  });

  it('clampTabIndex borne à [0, 3] et assainit les entrées douteuses', () => {
    expect(clampTabIndex(-1)).toBe(0);
    expect(clampTabIndex(0)).toBe(0);
    expect(clampTabIndex(3)).toBe(3);
    expect(clampTabIndex(9)).toBe(3);
    expect(clampTabIndex(1.4)).toBe(1);
    expect(clampTabIndex(Number.NaN)).toBe(0);
  });

  it('tabAt borne aussi (jamais undefined)', () => {
    expect(tabAt(-5)).toBe('notes');
    expect(tabAt(99)).toBe('programme');
  });
});

// ---------------------------------------------------------------------------
// Swipe du pager
// ---------------------------------------------------------------------------

describe('nextTabIndex', () => {
  const W = 400;

  it('sous le seuil de distance et sans flick : reste sur l’onglet', () => {
    expect(nextTabIndex(1, -40, 0, W)).toBe(1); // 40 < 0.28*400 = 112
    expect(nextTabIndex(1, 40, 0, W)).toBe(1);
  });

  it('tirage vers la gauche au-delà du seuil : onglet suivant', () => {
    expect(nextTabIndex(0, -150, 0, W)).toBe(1);
    expect(nextTabIndex(1, -150, 0, W)).toBe(2);
  });

  it('tirage vers la droite au-delà du seuil : onglet précédent', () => {
    expect(nextTabIndex(2, 150, 0, W)).toBe(1);
  });

  it('flick rapide (petit tirage) : suit la direction de la vitesse', () => {
    expect(nextTabIndex(0, -20, -CARNET_SWIPE_VELOCITY, W)).toBe(1);
    expect(nextTabIndex(2, 20, CARNET_SWIPE_VELOCITY, W)).toBe(1);
  });

  it('flick rapide mais tirage quasi nul : ignoré (pas de faux positif)', () => {
    expect(nextTabIndex(1, 2, -CARNET_SWIPE_VELOCITY, W)).toBe(1);
  });

  it('borné aux extrémités : jamais au-delà des onglets', () => {
    expect(nextTabIndex(0, 200, 0, W)).toBe(0); // déjà au premier
    expect(nextTabIndex(3, -200, 0, W)).toBe(3); // déjà au dernier
  });

  it('largeur ou entrées non finies : reste sur place', () => {
    expect(nextTabIndex(1, -200, 0, 0)).toBe(1);
    expect(nextTabIndex(1, Number.NaN, 0, W)).toBe(1);
    expect(nextTabIndex(1, -200, Number.NaN, W)).toBe(2); // distance suffit
  });
});

describe('pagerProgress', () => {
  const W = 400;
  it('0 au premier onglet, N−1 au dernier', () => {
    expect(pagerProgress(0, W)).toBe(0);
    expect(pagerProgress(-3 * W, W)).toBe(3);
  });
  it('continue entre deux onglets', () => {
    expect(pagerProgress(-W / 2, W)).toBeCloseTo(0.5, 5);
  });
  it('bornée et robuste', () => {
    expect(pagerProgress(W, W)).toBe(0); // pas de valeur négative
    expect(pagerProgress(-9 * W, W)).toBe(3); // plafonnée à 3
    expect(pagerProgress(-100, 0)).toBe(0);
    expect(pagerProgress(Number.NaN, W)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Intentions
// ---------------------------------------------------------------------------

describe('intentionState', () => {
  it('rattachée à une séance → honorée ; sans séance → en attente', () => {
    expect(intentionState('sess-1')).toBe('honored');
    expect(intentionState(null)).toBe('pending');
  });
  it('libellés factuels, jamais un jugement de réussite', () => {
    expect(intentionStateLabel('honored')).toBe('Portée en séance');
    expect(intentionStateLabel('pending')).toBe('En attente');
  });
});

// ---------------------------------------------------------------------------
// Météo du jour de la note — A-WEATHER-1
// ---------------------------------------------------------------------------

describe('isSameLocalDay', () => {
  it('même jour calendaire → true', () => {
    expect(isSameLocalDay('2026-07-18T08:00:00', '2026-07-18T21:30:00')).toBe(true);
  });
  it('jours différents → false', () => {
    expect(isSameLocalDay('2026-07-18T23:00:00', '2026-07-19T01:00:00')).toBe(false);
  });
  it('dates invalides → false', () => {
    expect(isSameLocalDay('', '2026-07-18T00:00:00')).toBe(false);
    expect(isSameLocalDay('pas-une-date', '2026-07-18T00:00:00')).toBe(false);
  });
});

describe('summarizeNoteWeather (A-WEATHER-1)', () => {
  const NOTE_DAY = '2026-07-18T20:00:00';

  it('relevé réel du même jour → résumé arrondi', () => {
    expect(
      summarizeNoteWeather(
        { capturedAt: '2026-07-18T09:15:00', temperatureC: 21.6, weatherLabel: 'Ciel dégagé' },
        NOTE_DAY
      )
    ).toEqual({ tempC: 22, label: 'Ciel dégagé' });
  });

  it('température NULLE → null (jamais un 0° fabriqué)', () => {
    expect(
      summarizeNoteWeather(
        { capturedAt: '2026-07-18T09:15:00', temperatureC: null, weatherLabel: 'Ciel dégagé' },
        NOTE_DAY
      )
    ).toBeNull();
  });

  it('température non finie → null', () => {
    expect(
      summarizeNoteWeather(
        { capturedAt: '2026-07-18T09:15:00', temperatureC: Number.NaN, weatherLabel: '' },
        NOTE_DAY
      )
    ).toBeNull();
  });

  it('0°C RÉEL le même jour → conservé (distinct de l’absence)', () => {
    expect(
      summarizeNoteWeather(
        { capturedAt: '2026-07-18T07:00:00', temperatureC: 0, weatherLabel: 'Brouillard' },
        NOTE_DAY
      )
    ).toEqual({ tempC: 0, label: 'Brouillard' });
  });

  it('relevé d’un autre jour → null (« du jour » doit être vrai)', () => {
    expect(
      summarizeNoteWeather(
        { capturedAt: '2026-07-15T09:15:00', temperatureC: 19, weatherLabel: 'Couvert' },
        NOTE_DAY
      )
    ).toBeNull();
  });

  it('snapshot absent → null', () => {
    expect(summarizeNoteWeather(null, NOTE_DAY)).toBeNull();
  });

  it('libellé manquant → chaîne vide (pas de crash)', () => {
    expect(
      summarizeNoteWeather(
        { capturedAt: '2026-07-18T09:15:00', temperatureC: 18, weatherLabel: null },
        NOTE_DAY
      )
    ).toEqual({ tempC: 18, label: '' });
  });
});

// ---------------------------------------------------------------------------
// Objectifs — mesurabilité
// ---------------------------------------------------------------------------

describe('goalProgress / isGoalMeasurable', () => {
  it('objectif sans mesure (cas réel du schéma pilot_goals) → null, aucune barre', () => {
    expect(goalProgress({})).toBeNull();
    expect(isGoalMeasurable({})).toBe(false);
    expect(goalProgress({ current: 3, target: null })).toBeNull();
    expect(goalProgress({ current: null, target: 10 })).toBeNull();
  });

  it('mesure valide → progression bornée 0..1', () => {
    expect(goalProgress({ current: 5, target: 10 })).toBe(0.5);
    expect(goalProgress({ current: 0, target: 10 })).toBe(0);
    expect(goalProgress({ current: 20, target: 10 })).toBe(1); // plafonnée
    expect(goalProgress({ current: -4, target: 10 })).toBe(0); // plancher
    expect(isGoalMeasurable({ current: 5, target: 10 })).toBe(true);
  });

  it('cible ≤ 0 ou valeurs non finies → null (jamais une barre douteuse)', () => {
    expect(goalProgress({ current: 5, target: 0 })).toBeNull();
    expect(goalProgress({ current: 5, target: -3 })).toBeNull();
    expect(goalProgress({ current: Number.NaN, target: 10 })).toBeNull();
    expect(goalProgress({ current: 5, target: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe('goalStatusLabel', () => {
  it('mappe les statuts d’auto-évaluation', () => {
    expect(goalStatusLabel('active')).toBe('En cours');
    expect(goalStatusLabel('achieved')).toBe('Atteint');
    expect(goalStatusLabel('continued')).toBe('Poursuivi');
    expect(goalStatusLabel('abandoned')).toBe('Écarté');
    expect(goalStatusLabel('inconnu')).toBe('En cours');
  });
});
