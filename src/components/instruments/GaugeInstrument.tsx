/**
 * GaugeInstrument — instrument gradué « cockpit factuel ».
 *
 * Cadran circulaire (arc 270° façon tachymètre) qui situe UNE valeur sur une
 * échelle [min, max] : arc de remplissage en or, graduations, repère optionnel,
 * chiffre géant à halo au centre. C'est le primitif central de l'étalon
 * « débrief » de la refonte gaming.
 *
 * DÉCISION (arbitrée) : on adopte le LANGAGE cockpit, jamais son JUGEMENT.
 *   - Aucune zone vert/jaune/rouge de performance.
 *   - Pas de redline rouge (le rouge reste réservé marque + bande coach).
 *   - L'or est une couleur de DONNÉE, neutre : l'arc situe, il ne récompense pas.
 *   - Le chiffre est le seul fait. Pas de verdict, pas de comparaison aux autres.
 * NB : `GForceBars` (kit v2) porte une note anti-gauge-cockpit antérieure à la
 * refonte ; à harmoniser plus tard pour cohérence.
 *
 * Usage :
 *   <GaugeInstrument
 *     label="MEILLEUR TOUR" value={83.4} min={80} max={95}
 *     unit="s" formatValue={fmtLap}
 *     reference={84.1} referenceLabel="précédent"
 *     caption="Haute-Saintonge" />
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { fonts, fontSize, motion, palette } from '@/theme/v2';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const START_ANGLE = 135; // bas-gauche
const SWEEP = 270; // jusqu'à 45° (bas-droite)

export interface GaugeInstrumentProps {
  /** Valeur factuelle affichée au centre. */
  value: number;
  /** Borne basse de l'échelle. */
  min: number;
  /** Borne haute de l'échelle. */
  max: number;
  /** Unité affichée sous le chiffre ('s', 'km/h', 'g'…). */
  unit?: string;
  /** Eyebrow mono au-dessus du chiffre. */
  label?: string;
  /** Formatage du chiffre géant. Défaut : 1 décimale. */
  formatValue?: (v: number) => string;
  /** Repère optionnel (record précédent, étalon…) → tick heritageGold. */
  reference?: number | null;
  /** Libellé discret du repère. */
  referenceLabel?: string;
  /** Sous-texte factuel sous l'instrument. */
  caption?: string | null;
  /** Variation « soi vs soi » déjà formatée (ex. « ▲ 0,3 vs dernière »). Couleur neutre, jamais un verdict. */
  delta?: string | null;
  /** Diamètre en pixels. Défaut 240. */
  size?: number;
  /** Couleur de l'arc de valeur. Défaut or (donnée). */
  color?: string;
  /** Animation de remplissage + apparition à l'entrée. Défaut true. */
  animate?: boolean;
  /** Nombre de graduations majeures. Défaut 6. */
  majorTicks?: number;
  /** Graduations mineures entre deux majeures. Défaut 4. */
  minorPerMajor?: number;
}

// ----------------------------------------------------------------------------
// Géométrie (hors composant)
// ----------------------------------------------------------------------------

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = (endDeg - startDeg) % 360 > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const defaultFormat = (v: number) => v.toFixed(1);

// ----------------------------------------------------------------------------
// Composant
// ----------------------------------------------------------------------------

export function GaugeInstrument({
  value,
  min,
  max,
  unit,
  label,
  formatValue = defaultFormat,
  reference = null,
  referenceLabel,
  caption = null,
  delta = null,
  size = 240,
  color = palette.gold,
  animate = true,
  majorTicks = 6,
  minorPerMajor = 4,
}: GaugeInstrumentProps) {
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = size * 0.045;
  const r = size / 2 - strokeW / 2 - size * 0.075;

  // Géométrie statique (ne dépend pas de l'animation → mémoïsée)
  const geom = useMemo(() => {
    const span = max - min || 1;
    const f = clamp01((value - min) / span);
    const arcLen = r * SWEEP * (Math.PI / 180);
    const railD = arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP);

    // Graduations
    const tickOuter = r + strokeW * 0.5 + size * 0.012;
    const majorLen = size * 0.05;
    const minorLen = size * 0.028;
    const steps = (majorTicks - 1) * (minorPerMajor + 1);
    const ticks: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let k = 0; k <= steps; k++) {
      const frac = k / steps;
      const major = k % (minorPerMajor + 1) === 0;
      const angle = START_ANGLE + SWEEP * frac;
      const o = polar(cx, cy, tickOuter, angle);
      const i = polar(cx, cy, tickOuter - (major ? majorLen : minorLen), angle);
      ticks.push({ x1: o.x, y1: o.y, x2: i.x, y2: i.y, major });
    }

    // Repère
    let ref: { x1: number; y1: number; x2: number; y2: number } | null = null;
    if (reference != null) {
      const fRef = clamp01((reference - min) / span);
      const angle = START_ANGLE + SWEEP * fRef;
      const o = polar(cx, cy, tickOuter + size * 0.01, angle);
      const i = polar(cx, cy, tickOuter - majorLen * 1.15, angle);
      ref = { x1: o.x, y1: o.y, x2: i.x, y2: i.y };
    }

    return { f, arcLen, railD, ticks, ref };
  }, [value, min, max, reference, size, r, cx, cy, strokeW, majorTicks, minorPerMajor]);

  // Animations
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const fade = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.reveal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(fade, {
      toValue: 1,
      duration: motion.slow,
      delay: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animate, progress, fade]);

  const dashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [geom.arcLen, geom.arcLen * (1 - geom.f)],
  });

  return (
    <View style={[styles.root, { width: size }]}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Rail */}
          <Path
            d={geom.railD}
            stroke={palette.line}
            strokeWidth={strokeW}
            strokeLinecap="round"
            fill="none"
          />
          {/* Graduations */}
          {geom.ticks.map((t, i) => (
            <Line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={palette.faint}
              strokeWidth={t.major ? size * 0.008 : size * 0.004}
              strokeLinecap="round"
              opacity={t.major ? 0.9 : 0.5}
            />
          ))}
          {/* Repère (heritageGold, jamais rouge) */}
          {geom.ref ? (
            <Line
              x1={geom.ref.x1}
              y1={geom.ref.y1}
              x2={geom.ref.x2}
              y2={geom.ref.y2}
              stroke={palette.heritageGold}
              strokeWidth={size * 0.012}
              strokeLinecap="round"
            />
          ) : null}
          {/* Arc de valeur — halo (large, faible opacité) */}
          <AnimatedPath
            d={geom.railD}
            stroke={color}
            strokeWidth={strokeW * 2.1}
            strokeLinecap="round"
            fill="none"
            opacity={0.12}
            strokeDasharray={`${geom.arcLen}`}
            strokeDashoffset={dashoffset}
          />
          {/* Arc de valeur — cœur */}
          <AnimatedPath
            d={geom.railD}
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${geom.arcLen}`}
            strokeDashoffset={dashoffset}
          />
        </Svg>

        {/* Bloc central */}
        <Animated.View style={[styles.center, { opacity: fade }]} pointerEvents="none">
          {label ? <Text style={styles.label}>{label}</Text> : null}
          <View style={styles.valueRow}>
            <Text style={[styles.value, { fontSize: size * 0.2 }]}>{formatValue(value)}</Text>
          </View>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
          {delta ? <Text style={styles.delta}>{delta}</Text> : null}
        </Animated.View>
      </View>

      {/* Repère — libellé discret */}
      {reference != null && referenceLabel ? (
        <Text style={styles.refLabel}>
          {referenceLabel} · {formatValue(reference)}
          {unit ? ` ${unit}` : ''}
        </Text>
      ) : null}

      {/* Légende factuelle */}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    color: palette.faint,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: {
    fontFamily: fonts.display,
    color: palette.cream,
    letterSpacing: -1,
    textShadowColor: 'rgba(255,183,3,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1,
    color: palette.creamMute,
    marginTop: 2,
  },
  delta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: palette.creamMute,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  refLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: palette.heritageGold,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    color: palette.creamMute,
    textTransform: 'uppercase',
    marginTop: 6,
  },
});
