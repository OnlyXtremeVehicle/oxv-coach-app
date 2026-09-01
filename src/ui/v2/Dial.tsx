/**
 * Dial — LE cadran instrument V2 (lot L0, Livrable 7).
 *
 * Règles tokens (non négociables) : UN SEUL cadran par écran, jamais
 * décoratif. L'aiguille montre l'instantané (NeedleSweep, spring avec
 * overshoot mécanique) ; l'arc montre le cumul (Skia, glissement timing
 * `motion.needle`). Zéro texture métal : piste hairline, graduations fines,
 * valeur centrale en RollingCounter mono.
 *
 * Géométrie pure dans shellLogic (dialProgress, dialNeedleAngleDeg,
 * dialArcSweepDeg, dialTickAngles, DIAL_SPECS) — testée sous jest node.
 * Module natif Skia : pas d'Expo Go.
 */

import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { NeedleSweep } from './motion/NeedleSweep';
import { RollingCounter } from './motion/RollingCounter';
import { useReduceMotion } from './motion/useReduceMotion';
import {
  DIAL_ANGLE_MIN,
  DIAL_ARC_START_SKIA,
  DIAL_SPECS,
  DIAL_SWEEP_DEG,
  dialDisplayValue,
  dialNeedleAngleDeg,
  dialHorsHorizon,
  dialProgress,
  dialTickAngles,
  type DialSize,
} from './shellLogic';
import { colors, motion, type as typo } from './tokens';

/** Longueur d'une graduation (px). */
const TICK_LEN = 5;

export interface DialProps {
  /**
   * Valeur instantanée (aiguille) et cumul (arc), dans [0, max].
   * `null` = non mesuré : aiguille au repos, arc vide, « — » au centre —
   * une valeur absente ne devient JAMAIS un zéro d'apparence mesurée.
   */
  value: number | null;
  /** Borne haute de la plage. */
  max: number;
  /** Libellé sous la valeur (ex. 'Marge'). */
  label?: string;
  /** Unité accolée à la valeur (ex. '%'). */
  unit?: string;
  /** Taille du cadran : s 88px, m 132px, l 188px. */
  size: DialSize;
  style?: StyleProp<ViewStyle>;
}

/** Arc complet (270°) sur lequel la progression est trimée (start/end). */
function makeArcPath(diameter: number, stroke: number): SkPath {
  const inset = stroke / 2 + 1;
  const path = Skia.Path.Make();
  path.addArc(
    Skia.XYWHRect(inset, inset, diameter - inset * 2, diameter - inset * 2),
    DIAL_ARC_START_SKIA,
    DIAL_SWEEP_DEG
  );
  return path;
}

/** Graduations hairline : un seul chemin, un trait par angle du cadran. */
function makeTicksPath(diameter: number, stroke: number, count: number): SkPath {
  const path = Skia.Path.Make();
  const c = diameter / 2;
  const outer = c - stroke - 5;
  const inner = outer - TICK_LEN;
  for (const deg of dialTickAngles(count)) {
    const rad = (deg * Math.PI) / 180;
    // Convention cadran : 0° = midi, sens horaire.
    const ux = Math.sin(rad);
    const uy = -Math.cos(rad);
    path.moveTo(c + ux * outer, c + uy * outer);
    path.lineTo(c + ux * inner, c + uy * inner);
  }
  return path;
}

export function Dial({ value, max, label, unit, size, style }: DialProps) {
  const reduce = useReduceMotion();
  const spec = DIAL_SPECS[size];
  const diameter = spec.diameter;

  const arcPath = useMemo(() => makeArcPath(diameter, spec.stroke), [diameter, spec.stroke]);
  const ticksPath = useMemo(
    () => makeTicksPath(diameter, spec.stroke, spec.tickCount),
    [diameter, spec.stroke, spec.tickCount]
  );

  // Non mesuré (null ou non fini) : aiguille au repos, arc vide, « — ».
  const measured = value !== null && Number.isFinite(value);

  /**
   * AU-DELÀ DE SON HORIZON, LE CADRAN SE TAIT AU LIEU DE MENTIR.
   *
   * `dialProgress` écrête à 1, et `needleAngle` fait de même : une valeur
   * au-dessus du maximum donnait donc un arc COMPLET et une aiguille EN BUTÉE.
   * Sur l'accueil, le compte à rebours a un horizon de trente jours et la
   * prochaine journée de piste était à cent quinze : le cadran s'affichait
   * plein — la lecture d'une échéance imminente — pendant que le nombre au
   * centre disait 115.
   *
   * Un écrêtage est juste quand il borne un rendu ; il devient un mensonge
   * quand la valeur écrêtée porte le sens. On rend donc l'arc vide et
   * l'aiguille au repos, comme pour une absence de mesure — et le NOMBRE, lui,
   * reste affiché tel quel : c'est lui qui dit la vérité.
   *
   * La correction est ici et non aux deux appels : un écran = un objet, et deux
   * copies de la même règle finiraient par diverger.
   */
  const horsHorizon = dialHorsHorizon(value, max);
  const lisible = measured && !horsHorizon;
  const arcTarget = lisible ? dialProgress(value, max) : 0;
  const needleDeg = lisible ? dialNeedleAngleDeg(value, max) : DIAL_ANGLE_MIN;

  // L'arc (cumul) glisse vers sa cible — l'aiguille, elle, ressort en spring.
  const progress = useSharedValue(reduce ? arcTarget : 0);
  useEffect(() => {
    if (reduce) {
      progress.value = arcTarget;
      return;
    }
    progress.value = withTiming(arcTarget, {
      duration: motion.needle,
      easing: Easing.out(Easing.cubic),
    });
  }, [arcTarget, reduce, progress]);

  const display = dialDisplayValue(value);
  const a11y = measured
    ? `${label !== undefined ? `${label} : ` : ''}${display}${unit !== undefined ? ` ${unit}` : ''}`
    : `${label !== undefined ? `${label} : ` : ''}non mesuré`;

  return (
    <View
      style={[{ width: diameter, height: diameter }, style]}
      accessible
      accessibilityLabel={a11y}
    >
      <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {spec.tickCount > 0 ? (
          <Path
            path={ticksPath}
            style="stroke"
            strokeWidth={1}
            strokeCap="round"
            color={colors.border.strong}
          />
        ) : null}
        <Path
          path={arcPath}
          style="stroke"
          strokeWidth={spec.stroke}
          strokeCap="round"
          color={colors.border.card}
        />
        <Path
          path={arcPath}
          style="stroke"
          strokeWidth={spec.stroke}
          strokeCap="round"
          color={colors.accent}
          start={0}
          end={progress}
        />
      </Canvas>
      <NeedleSweep angle={needleDeg} size={diameter} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.valueBlock, { top: diameter * 0.56 }]} pointerEvents="none">
        <View style={styles.valueRow}>
          <RollingCounter value={display} fontSize={spec.valueSize} />
          {/* Pas d'unité accolée à « — » : elle donnerait au tiret l'air mesuré. */}
          {unit !== undefined && measured ? (
            <Text
              style={[styles.unit, { fontSize: spec.labelSize }]}
              allowFontScaling={false}
              accessible={false}
            >
              {unit}
            </Text>
          ) : null}
        </View>
        {label !== undefined ? (
          <Text
            style={[styles.label, { fontSize: spec.labelSize }]}
            allowFontScaling={false}
            accessible={false}
            numberOfLines={1}
          >
            {label.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  valueBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  unit: {
    fontFamily: typo.bodyMedium,
    color: colors.text.low,
    marginLeft: 2,
    marginBottom: 3,
  },
  label: {
    fontFamily: typo.bodyMedium,
    color: colors.text.low,
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
