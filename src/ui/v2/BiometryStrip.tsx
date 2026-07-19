/**
 * BiometryStrip — sparkline FC Skia (lot L0, livrable 7).
 *
 * Le dernier point PULSE au rythme cardiaque moyen de la série (période =
 * 60/bpm s, bornée — détail d'orfèvre) : anneau qui s'étend et s'éteint à
 * chaque battement, sur le thread UI. Badge source (`montre`/`ceinture`,
 * icônes OxvIcon) + confiance, dernière valeur en mono.
 *
 * `samples` vide ou inexploitable → rend null. Le gating flag + consentement
 * biométrique est fait par l'ÉCRAN appelant, jamais ici.
 *
 * Doctrine : factuel uniquement (valeur, source, confiance) — aucune zone
 * cible, aucune interprétation. Reduce-motion : point fixe, aucun pulse.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { OxvIcon } from './icons';
import { useReduceMotion } from './motion/useReduceMotion';
import { colors, radius, space, type as typo } from './tokens';
import {
  cleanSamples,
  meanBpm,
  normalizeSparkline,
  pulsePeriodMs,
  sparklinePath,
  type BiometrySample,
} from './vizMath';

export type BiometrySource = 'montre' | 'ceinture';

export type BiometryQuality = 'haute' | 'moyenne' | 'basse';

export interface BiometryStripProps {
  /** Échantillons FC réels ({ts, hr}). Vide → null. */
  samples: readonly BiometrySample[];
  /** Capteur d'origine (badge + icône). */
  source: BiometrySource;
  /** Confiance de la mesure (badge). */
  quality?: BiometryQuality;
  /** Hauteur de la sparkline (px). Défaut 56. */
  height?: number;
  /** Couleur de la ligne. Défaut text.mid. */
  color?: string;
  /** Couleur du point pulsé. Défaut accent. */
  pulseColor?: string;
  style?: StyleProp<ViewStyle>;
}

const SOURCE_LABELS: Record<BiometrySource, string> = {
  montre: 'Montre',
  ceinture: 'Ceinture',
};

const DOT_R = 3;
const PULSE_SPREAD = 7;
const SPARK_PAD = 6;

export function BiometryStrip({
  samples,
  source,
  quality,
  height = 56,
  color = colors.text.mid,
  pulseColor = colors.accent,
  style,
}: BiometryStripProps) {
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);

  const clean = useMemo(() => cleanSamples(samples), [samples]);
  const period = useMemo(() => pulsePeriodMs(meanBpm(clean)), [clean]);

  const points = useMemo(
    () => (width > 0 ? normalizeSparkline(clean, width, height, SPARK_PAD) : []),
    [clean, width, height]
  );
  const path = useMemo(() => sparklinePath(points), [points]);
  const last = points.length > 0 ? points[points.length - 1] : null;

  // Phase 0 → 1 à chaque battement (période = 60/bpm s).
  // Dépendances STABLES uniquement (hasPoint, period) : `last` est un objet
  // neuf à chaque tick de `samples` — en dépendre redémarrait le pulse à
  // chaque échantillon. Le point suit la donnée via ses props cx/cy ; la
  // boucle, elle, ne repart que si la période (ou reduce) change.
  const hasPoint = last !== null;
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduce || !hasPoint) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    return () => {
      cancelAnimation(phase);
    };
  }, [reduce, period, hasPoint, phase]);

  const ringR = useDerivedValue(() => DOT_R + phase.value * PULSE_SPREAD);
  const ringOpacity = useDerivedValue(() => 0.5 * (1 - phase.value));

  // Aucune donnée exploitable → rien (l'écran appelant gère flag + consent).
  if (clean.length === 0) return null;

  const lastHr = Math.round(clean[clean.length - 1].hr);
  const accessibilityLabel = `Fréquence cardiaque, source ${SOURCE_LABELS[source]}${
    quality ? `, confiance ${quality}` : ''
  }, dernière valeur ${lastHr} battements par minute`;

  return (
    <View style={style} accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.header}>
        <OxvIcon name={source} size={14} color={colors.text.mid} />
        <Text style={styles.source}>{SOURCE_LABELS[source]}</Text>
        {quality ? (
          <View style={styles.qualityPill}>
            <Text style={styles.quality}>{`Confiance ${quality}`}</Text>
          </View>
        ) : null}
        <View style={styles.spacer} />
        <Text style={styles.bpm}>{`${lastHr} bpm`}</Text>
      </View>

      <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && last !== null ? (
          <Canvas style={{ width, height }}>
            {path !== '' ? (
              <Path
                path={path}
                style="stroke"
                strokeWidth={2}
                strokeCap="round"
                strokeJoin="round"
                color={color}
              />
            ) : null}
            {!reduce ? (
              <Circle cx={last.x} cy={last.y} r={ringR} color={pulseColor} opacity={ringOpacity} />
            ) : null}
            <Circle cx={last.x} cy={last.y} r={DOT_R} color={pulseColor} />
          </Canvas>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  source: {
    fontFamily: typo.bodyMedium,
    fontSize: 12,
    color: colors.text.mid,
  },
  qualityPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  quality: {
    fontFamily: typo.body,
    fontSize: 10,
    color: colors.text.low,
  },
  spacer: {
    flex: 1,
  },
  bpm: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.hi,
  },
});
