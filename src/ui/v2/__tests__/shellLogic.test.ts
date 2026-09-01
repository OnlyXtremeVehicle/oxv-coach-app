/**
 * Tests shellLogic — logique pure des composants coquille V2 (Livrable 7) :
 * géométrie du Dial, mapping du CentralButton, décisions du Sheet, portes
 * de la TabBar. .ts pur, aucun rendu de composant.
 */

import { OXV_ICON_NAMES } from '../icons/registry';
import {
  CENTRAL_BUTTON_SIZE,
  CENTRAL_FLOAT_OFFSET,
  DIAL_ANGLE_MAX,
  DIAL_ANGLE_MIN,
  DIAL_ARC_START_SKIA,
  DIAL_SPECS,
  DIAL_SWEEP_DEG,
  SHEET_DISMISS_RATIO,
  SHEET_DISMISS_VELOCITY,
  SHEET_FLICK_MIN_DRAG,
  SHEET_OVERDRAG_MAX,
  TAB_BAR_HEIGHT,
  TAB_ITEMS,
  centralButtonAccessibilityLabel,
  centralButtonVisual,
  defaultSnapHeight,
  dialArcSweepDeg,
  dialDisplayValue,
  dialHorsHorizon,
  dialNeedleAngleDeg,
  dialProgress,
  dialTickAngles,
  sheetDragOffset,
  sheetShouldDismiss,
  tabScale,
} from '../shellLogic';

describe('Dial — géométrie', () => {
  it('course de 270°, symétrique autour de midi', () => {
    expect(DIAL_ANGLE_MIN).toBe(-135);
    expect(DIAL_ANGLE_MAX).toBe(135);
    expect(DIAL_SWEEP_DEG).toBe(270);
    // Convention Skia (0° = 3 heures) : le départ du cadran est à -225°.
    expect(DIAL_ARC_START_SKIA).toBe(-225);
  });

  it('dialProgress borne dans [0, 1] et refuse les plages dégénérées', () => {
    expect(dialProgress(50, 100)).toBe(0.5);
    expect(dialProgress(-10, 100)).toBe(0);
    expect(dialProgress(150, 100)).toBe(1);
    expect(dialProgress(50, 0)).toBe(0);
    expect(dialProgress(50, -5)).toBe(0);
    expect(dialProgress(Number.NaN, 100)).toBe(0);
    expect(dialProgress(50, Number.NaN)).toBe(0);
  });

  /**
   * L'ÉCRÊTAGE EST JUSTE, ET IL DEVIENT UN MENSONGE QUAND IL PORTE LE SENS.
   *
   * Le compte à rebours de l'accueil a un horizon de trente jours ; la
   * prochaine journée de piste était à cent quinze. L'arc s'affichait COMPLET
   * et l'aiguille en butée — la lecture d'une échéance imminente — pendant que
   * le nombre au centre disait 115.
   */
  it('dialHorsHorizon repère la valeur que le cadran ne peut pas montrer', () => {
    expect(dialHorsHorizon(115, 30)).toBe(true);
    expect(dialHorsHorizon(31, 30)).toBe(true);
    expect(dialHorsHorizon(30, 30)).toBe(false);
    expect(dialHorsHorizon(0, 30)).toBe(false);
  });

  it('une absence de mesure n’est PAS un dépassement — deux états distincts', () => {
    expect(dialHorsHorizon(null, 30)).toBe(false);
    expect(dialHorsHorizon(Number.NaN, 30)).toBe(false);
  });

  it('une plage dégénérée ne déclenche rien : il n’y a pas d’horizon à dépasser', () => {
    expect(dialHorsHorizon(50, 0)).toBe(false);
    expect(dialHorsHorizon(50, -5)).toBe(false);
    expect(dialHorsHorizon(50, Number.NaN)).toBe(false);
  });

  it("dialNeedleAngleDeg mappe [0, max] sur l'amplitude du cadran", () => {
    expect(dialNeedleAngleDeg(0, 100)).toBe(DIAL_ANGLE_MIN);
    expect(dialNeedleAngleDeg(100, 100)).toBe(DIAL_ANGLE_MAX);
    expect(dialNeedleAngleDeg(50, 100)).toBeCloseTo(0, 6);
    // Hors plage : borné, jamais au-delà des butées.
    expect(dialNeedleAngleDeg(-20, 100)).toBe(DIAL_ANGLE_MIN);
    expect(dialNeedleAngleDeg(250, 100)).toBe(DIAL_ANGLE_MAX);
  });

  it('dialArcSweepDeg est proportionnel et borné', () => {
    expect(dialArcSweepDeg(0)).toBe(0);
    expect(dialArcSweepDeg(0.5)).toBe(135);
    expect(dialArcSweepDeg(1)).toBe(270);
    expect(dialArcSweepDeg(-1)).toBe(0);
    expect(dialArcSweepDeg(2)).toBe(270);
  });

  it('dialTickAngles couvre la course, extrémités comprises, monotone', () => {
    expect(dialTickAngles(0)).toEqual([]);
    expect(dialTickAngles(1)).toEqual([]);
    const ticks = dialTickAngles(7);
    expect(ticks).toHaveLength(7);
    expect(ticks[0]).toBe(DIAL_ANGLE_MIN);
    expect(ticks[ticks.length - 1]).toBeCloseTo(DIAL_ANGLE_MAX, 6);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });

  it("dialDisplayValue n'affiche jamais NaN et garde une décimale utile", () => {
    expect(dialDisplayValue(87)).toBe('87');
    expect(dialDisplayValue(87.46)).toBe('87,5');
    // Un zéro MESURÉ s'affiche ; une valeur absente ne devient jamais un
    // zéro d'apparence mesurée (règle données réelles) : tiret.
    expect(dialDisplayValue(0)).toBe('0');
    expect(dialDisplayValue(Number.NaN)).toBe('—');
    expect(dialDisplayValue(Number.POSITIVE_INFINITY)).toBe('—');
    expect(dialDisplayValue(null)).toBe('—');
  });

  it('DIAL_SPECS : 3 tailles croissantes, graduations aux extrémités valides', () => {
    expect(DIAL_SPECS.s.diameter).toBeLessThan(DIAL_SPECS.m.diameter);
    expect(DIAL_SPECS.m.diameter).toBeLessThan(DIAL_SPECS.l.diameter);
    for (const size of ['s', 'm', 'l'] as const) {
      const spec = DIAL_SPECS[size];
      expect(spec.stroke).toBeGreaterThan(0);
      expect(spec.valueSize).toBeGreaterThan(spec.labelSize);
      expect(spec.tickCount === 0 || spec.tickCount >= 2).toBe(true);
    }
  });
});

describe('CentralButton — mapping état → visuel', () => {
  it('rec : cercle plein, point pulsant, haptic arm, pas d icône', () => {
    expect(centralButtonVisual('rec')).toEqual({
      filled: true,
      pulse: true,
      haptic: 'arm',
      icon: null,
    });
  });

  it('reserve et countdown : bord accent, pas de pulse, haptic tap', () => {
    const reserve = centralButtonVisual('reserve');
    const countdown = centralButtonVisual('countdown');
    for (const visual of [reserve, countdown]) {
      expect(visual.filled).toBe(false);
      expect(visual.pulse).toBe(false);
      expect(visual.haptic).toBe('tap');
    }
    expect(reserve.icon).toBe('drapeau-damier');
    expect(countdown.icon).toBe('chrono');
  });

  it('les icônes de repli existent dans le registre', () => {
    for (const mode of ['reserve', 'countdown', 'rec'] as const) {
      const { icon } = centralButtonVisual(mode);
      if (icon !== null) {
        expect(OXV_ICON_NAMES).toContain(icon);
      }
    }
  });

  it("labels d'accessibilité : contexte composé, jamais un « J-3 » nu", () => {
    // Un « J-3 » brut est cryptique au lecteur d'écran : on compose.
    expect(centralButtonAccessibilityLabel('countdown', 'J-3')).toBe('Prochain track day · J-3');
    expect(centralButtonAccessibilityLabel('reserve')).toBe('Réserver');
    expect(centralButtonAccessibilityLabel('countdown')).toBe('Prochain track day');
    expect(centralButtonAccessibilityLabel('rec')).toBe('Capture');
    // Un label vide ne masque pas le repli ; un label identique ne double pas.
    expect(centralButtonAccessibilityLabel('rec', '')).toBe('Capture');
    expect(centralButtonAccessibilityLabel('rec', 'Capture')).toBe('Capture');
  });

  it('constantes de géométrie : 60 px, flottant -8 px', () => {
    expect(CENTRAL_BUTTON_SIZE).toBe(60);
    expect(CENTRAL_FLOAT_OFFSET).toBe(-8);
  });
});

describe('Sheet — décisions de geste', () => {
  const HEIGHT = 420;

  it('suit le doigt vers le bas, résiste vers le haut avec butée', () => {
    expect(sheetDragOffset(0)).toBe(0);
    expect(sheetDragOffset(120)).toBe(120);
    expect(sheetDragOffset(-30)).toBe(-5);
    // Butée : jamais plus haut que SHEET_OVERDRAG_MAX.
    expect(sheetDragOffset(-100000)).toBe(-SHEET_OVERDRAG_MAX);
  });

  it('ferme au-delà du tiers de la hauteur, quelle que soit la vitesse', () => {
    const third = HEIGHT * SHEET_DISMISS_RATIO;
    expect(sheetShouldDismiss(third + 1, 0, HEIGHT)).toBe(true);
    expect(sheetShouldDismiss(third - 1, 0, HEIGHT)).toBe(false);
  });

  it('ferme sur un flick franc vers le bas, même sur un petit tirage', () => {
    expect(sheetShouldDismiss(SHEET_FLICK_MIN_DRAG, SHEET_DISMISS_VELOCITY, HEIGHT)).toBe(true);
    // Tirage trop court : le flick ne compte pas comme une intention.
    expect(sheetShouldDismiss(SHEET_FLICK_MIN_DRAG - 1, SHEET_DISMISS_VELOCITY, HEIGHT)).toBe(
      false
    );
    // Flick vers le haut : jamais un dismiss.
    expect(sheetShouldDismiss(10, -SHEET_DISMISS_VELOCITY, HEIGHT)).toBe(false);
  });

  it('hauteur dégénérée → ferme (jamais un sheet fantôme)', () => {
    expect(sheetShouldDismiss(0, 0, 0)).toBe(true);
  });

  it('defaultSnapHeight : 60 % de la fenêtre, plancher 240', () => {
    expect(defaultSnapHeight(800)).toBe(480);
    expect(defaultSnapHeight(300)).toBe(240);
    expect(defaultSnapHeight(0)).toBe(240);
  });
});

describe('TabBar — les 5 portes', () => {
  it('4 portes latérales dans l ordre, clés uniques', () => {
    expect(TAB_ITEMS.map((t) => t.key)).toEqual(['miroir', 'data', 'club', 'vous']);
    expect(new Set(TAB_ITEMS.map((t) => t.key)).size).toBe(TAB_ITEMS.length);
  });

  it('chaque icône existe dans le registre ; « vous » porte le casque', () => {
    for (const item of TAB_ITEMS) {
      expect(OXV_ICON_NAMES).toContain(item.icon);
    }
    expect(TAB_ITEMS.find((t) => t.key === 'vous')?.icon).toBe('casque');
  });

  it('labels en français, sans emoji, capitalisés', () => {
    for (const item of TAB_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      // ASCII étendu latin uniquement — aucun emoji.
      expect(/^[A-Za-zÀ-ÖØ-öø-ÿ ]+$/.test(item.label)).toBe(true);
      expect(item.label.charAt(0)).toBe(item.label.charAt(0).toUpperCase());
    }
  });

  it('tabScale : 1.06 actif, 1 inactif ; hauteur de barre stable', () => {
    expect(tabScale(true)).toBe(1.06);
    expect(tabScale(false)).toBe(1);
    expect(TAB_BAR_HEIGHT).toBe(56);
  });
});
