/**
 * shellLogic — logique pure des composants coquille V2 (lot L0, Livrable 7) :
 * géométrie de l'arc du Dial, mapping visuel du CentralButton, décisions de
 * dismiss du Sheet, table des portes de la TabBar.
 *
 * Module .ts pur, sans React ni react-native : testé sous ts-jest/node
 * (src/ui/v2/__tests__/shellLogic.test.ts). Les fonctions appelées depuis
 * l'UI thread portent la directive 'worklet'.
 */

import type { OxvIconName } from './icons/registry';
import { clamp, needleAngle } from './motion/motionMath';
import { virgule } from '@/utils/format';

// ---------------------------------------------------------------------------
// Dial — LE cadran instrument
// ---------------------------------------------------------------------------

/** Course angulaire du cadran : 270°, de 7h30 à 4h30 (0° = midi, horaire). */
export const DIAL_ANGLE_MIN = -135;
export const DIAL_ANGLE_MAX = 135;
export const DIAL_SWEEP_DEG = DIAL_ANGLE_MAX - DIAL_ANGLE_MIN;

/**
 * Angle de départ de l'arc en convention Skia (0° = 3 heures, sens horaire) :
 * le -135° du cadran (0° = midi) correspond à -225° côté Skia.
 */
export const DIAL_ARC_START_SKIA = DIAL_ANGLE_MIN - 90;

export type DialSize = 's' | 'm' | 'l';

export interface DialSpec {
  /** Diamètre du cadran (px). */
  diameter: number;
  /** Épaisseur de la piste et de l'arc (px). */
  stroke: number;
  /** Corps de la valeur centrale (px). */
  valueSize: number;
  /** Corps du label et de l'unité (px). */
  labelSize: number;
  /** Nombre de graduations hairline (0 = aucune). */
  tickCount: number;
}

/** Les trois tailles du cadran — hairlines fines, zéro texture métal. */
export const DIAL_SPECS: Record<DialSize, DialSpec> = {
  s: { diameter: 88, stroke: 3, valueSize: 18, labelSize: 9, tickCount: 0 },
  m: { diameter: 132, stroke: 4, valueSize: 26, labelSize: 10, tickCount: 7 },
  l: { diameter: 188, stroke: 4, valueSize: 36, labelSize: 11, tickCount: 10 },
};

/** Progression 0..1 du cumul. Plage dégénérée (max <= 0) → 0, jamais de NaN. */
export function dialProgress(value: number, max: number): number {
  'worklet';
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp(value / max, 0, 1);
}

/**
 * LA VALEUR DÉPASSE-T-ELLE L'HORIZON DU CADRAN ?
 *
 * `dialProgress` et `dialNeedleAngleDeg` ÉCRÊTENT — c'est leur contrat, et il
 * est juste : un rendu se borne. Mais un écrêtage devient un mensonge quand la
 * valeur écrêtée porte le sens.
 *
 * Le cas réel : le compte à rebours de l'accueil a un horizon de trente jours,
 * la prochaine journée de piste était à cent quinze. L'arc s'affichait COMPLET
 * et l'aiguille EN BUTÉE — la lecture d'une échéance imminente — pendant que le
 * nombre au centre disait 115.
 *
 * Cette fonction dit quand se taire. Elle vit ici plutôt que dans le composant
 * pour être testée sans monter d'écran.
 */
export function dialHorsHorizon(value: number | null, max: number): boolean {
  'worklet';
  if (value === null || !Number.isFinite(value)) return false;
  if (!Number.isFinite(max) || max <= 0) return false;
  return value > max;
}

/** Angle de l'aiguille (instantané) pour `value` dans [0, max]. */
export function dialNeedleAngleDeg(value: number, max: number): number {
  'worklet';
  return needleAngle(value, 0, max, DIAL_ANGLE_MIN, DIAL_ANGLE_MAX);
}

/** Balayage de l'arc (cumul) en degrés, pour une progression 0..1. */
export function dialArcSweepDeg(progress: number): number {
  'worklet';
  return clamp(progress, 0, 1) * DIAL_SWEEP_DEG;
}

/**
 * Angles des graduations (convention cadran, 0° = midi), réparties
 * uniformément de DIAL_ANGLE_MIN à DIAL_ANGLE_MAX inclus. count < 2 → [].
 */
export function dialTickAngles(count: number): number[] {
  const n = Math.floor(count);
  if (n < 2) return [];
  const step = DIAL_SWEEP_DEG / (n - 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(DIAL_ANGLE_MIN + i * step);
  }
  return out;
}

/**
 * Valeur affichée au centre du cadran : entier tel quel, sinon une décimale.
 * Non fini (ou null) → '—' : une valeur absente ne devient JAMAIS un zéro
 * d'apparence mesurée (règle données réelles).
 */
export function dialDisplayValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return virgule(value.toFixed(1));
}

// ---------------------------------------------------------------------------
// CentralButton — mapping état → visuel
// ---------------------------------------------------------------------------

export type CentralButtonMode = 'reserve' | 'countdown' | 'rec';

export interface CentralButtonVisual {
  /** Cercle plein accent (rec) ou fond carte bordé accent (les autres). */
  filled: boolean;
  /** Point central pulsant (rec uniquement). */
  pulse: boolean;
  /** Vocabulaire tactile à l'appui : armer la capture = 'arm'. */
  haptic: 'tap' | 'arm';
  /** Icône affichée si aucun label n'est fourni (null : jamais d'icône). */
  icon: OxvIconName | null;
}

/** Le mapping visuel des 3 états — la seule source de vérité du composant. */
export function centralButtonVisual(mode: CentralButtonMode): CentralButtonVisual {
  switch (mode) {
    case 'rec':
      return { filled: true, pulse: true, haptic: 'arm', icon: null };
    case 'countdown':
      return { filled: false, pulse: false, haptic: 'tap', icon: 'chrono' };
    case 'reserve':
      return { filled: false, pulse: false, haptic: 'tap', icon: 'drapeau-damier' };
  }
}

/**
 * Label d'accessibilité. Le contexte prime toujours : un « J-3 » nu est
 * cryptique au lecteur d'écran, on compose « Prochain track day · J-3 ».
 */
export function centralButtonAccessibilityLabel(mode: CentralButtonMode, label?: string): string {
  const base = ((): string => {
    switch (mode) {
      case 'rec':
        return 'Capture';
      case 'countdown':
        return 'Prochain track day';
      case 'reserve':
        return 'Réserver';
    }
  })();
  if (label !== undefined && label.length > 0 && label !== base) {
    return `${base} · ${label}`;
  }
  return base;
}

/** Diamètre du bouton central (px). */
export const CENTRAL_BUTTON_SIZE = 60;
/** Flottement au-dessus de la barre (px, négatif = vers le haut). */
export const CENTRAL_FLOAT_OFFSET = -8;

// ---------------------------------------------------------------------------
// Sheet — décisions de dismiss
// ---------------------------------------------------------------------------

/** Vitesse de flick (px/s) qui emporte le sheet même sur un petit tirage. */
export const SHEET_DISMISS_VELOCITY = 900;
/** Fraction de la hauteur au-delà de laquelle le relâchement ferme. */
export const SHEET_DISMISS_RATIO = 1 / 3;
/** Tirage minimal (px) pour qu'un flick rapide compte comme une intention. */
export const SHEET_FLICK_MIN_DRAG = 24;
/** Butée de la résistance vers le haut (px). */
export const SHEET_OVERDRAG_MAX = 24;

/**
 * Décalage du sheet pendant le drag : vers le bas il suit le doigt,
 * vers le haut il résiste (1/6 de la course, butée SHEET_OVERDRAG_MAX).
 */
export function sheetDragOffset(translationY: number): number {
  'worklet';
  if (translationY >= 0) return translationY;
  return Math.max(translationY / 6, -SHEET_OVERDRAG_MAX);
}

/**
 * Ferme-t-on au relâchement ? Oui si le tirage dépasse le tiers de la
 * hauteur, ou si le flick vers le bas est franc (vitesse + tirage minimal).
 */
export function sheetShouldDismiss(
  translationY: number,
  velocityY: number,
  snapHeight: number
): boolean {
  'worklet';
  if (snapHeight <= 0) return true;
  if (translationY >= snapHeight * SHEET_DISMISS_RATIO) return true;
  return velocityY >= SHEET_DISMISS_VELOCITY && translationY >= SHEET_FLICK_MIN_DRAG;
}

/** Hauteur par défaut : 60 % de la fenêtre, plancher 240 px. */
export function defaultSnapHeight(windowHeight: number): number {
  return Math.max(240, Math.round(windowHeight * 0.6));
}

// ---------------------------------------------------------------------------
// TabBar — les 5 portes
// ---------------------------------------------------------------------------

export type TabKey = 'miroir' | 'data' | 'club' | 'vous';

export interface TabItem {
  key: TabKey;
  icon: OxvIconName;
  /** Label d'accessibilité (la barre est iconographique). */
  label: string;
}

/** Les 4 portes latérales, dans l'ordre — le CentralButton s'insère au milieu. */
export const TAB_ITEMS: readonly TabItem[] = [
  { key: 'miroir', icon: 'miroir', label: 'Miroir' },
  { key: 'data', icon: 'data', label: 'Data' },
  { key: 'club', icon: 'club', label: 'Club' },
  { key: 'vous', icon: 'casque', label: 'Vous' },
] as const;

/** Hauteur du contenu de la barre, hors safe-area (px). */
export const TAB_BAR_HEIGHT = 56;

/**
 * Débord du CentralButton au-dessus de la barre (px) : cercle de 60 px dans
 * une rangée de 56, flotté de 8 → 10 px hors bounds, arrondi à 12 pour la
 * marge. La racine de la TabBar DOIT inclure ce débord dans ses bounds,
 * sinon le haut du bouton est une zone morte tactile (hit-testing clippé).
 */
export const TAB_BAR_OVERHANG = 12;

/**
 * Espace vertical total occupé par la barre en bas d'écran — LA formule
 * unique que tout écran (app2) utilise pour son paddingBottom. Reproduit
 * exactement la hauteur réelle de la TabBar (contenu + safe-area, plancher
 * space.sm) ; toute formule ad hoc dans un écran finit par diverger.
 */
export function tabBarSpace(insetsBottom: number): number {
  return TAB_BAR_HEIGHT + Math.max(insetsBottom, 8);
}

/** Échelle d'une porte : active = 1.06 (spring), inactive = 1. */
export function tabScale(active: boolean): number {
  'worklet';
  return active ? 1.06 : 1;
}
