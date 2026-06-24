/**
 * AnatomieViz — Anatomie de virage (lecture N2.1).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N2-1_anatomie.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §2.1.
 *
 * Décompose un virage en trois temps : freinage (bleu) / corde (ambre, minimum
 * de vitesse au pic de G latéral) / réaccélération (vert). Cockpit : barre de
 * statut, nombre héros (vitesse à la corde, à lueur dorée), profil de vitesse
 * en OR à halo sur fond de phases, puis cartouches et lignes de phase.
 *
 * Doctrine : l'or est la donnée. Pas de rouge (réservé marque/coach), pas de
 * heritageGold. DÉMO virage 3 (95 m / 78 km/h / 140 m), telemetry_frames vide.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';

const C = theme.dataColors;
const GOLD = theme.palette.gold;
const AMBER = '#F2792B';

interface Phase {
  color: string;
  label: string;
  /** Le segment **…** sort en mono. */
  text: string;
  value: string;
}

// Données DÉMO du virage 3 (maquette N2-1).
const PHASES: Phase[] = [
  {
    color: C.brake,
    label: 'Freinage',
    text: 'Freinage sur **95 m**, de 182 à 78 km/h',
    value: '−1,08 g',
  },
  {
    color: AMBER,
    label: 'Corde',
    text: 'Vitesse mini à la corde : **78 km/h**',
    value: '1,12 g lat.',
  },
  {
    color: C.accel,
    label: 'Réaccél.',
    text: 'Réaccélération sur **140 m** jusqu’à la prochaine zone',
    value: '+0,74 g',
  },
];

const ZONES = [
  { label: 'Freinage', value: '95 m', color: C.brake },
  { label: 'Corde', value: '78 km/h', color: AMBER },
  { label: 'Réaccél.', value: '140 m', color: C.accel },
];

export function AnatomieViz() {
  // Point de statut « vivant ».
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.32, duration: 1200, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  return (
    <View>
      <View style={styles.card}>
        {/* Barre de statut cockpit. */}
        <View style={styles.status}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.dotLive, { opacity: blink }]} />
            <Text style={styles.statusLabel}>Anatomie de virage</Text>
          </View>
          <Text style={styles.statusRight}>VIRAGE 3 · 18 TOURS</Text>
        </View>

        {/* Nombre héros : vitesse à la corde (le minimum, signature du virage). */}
        <View style={styles.hero}>
          <Text style={styles.heroNum}>
            78
            <Text style={styles.heroUnit}> km/h</Text>
          </Text>
          <Text style={styles.heroLabel}>VITESSE À LA CORDE · MINIMUM</Text>
        </View>

        {/* Profil de vitesse : courbe OR à halo sur fond de phases. */}
        <Svg width="100%" height={132} viewBox="0 0 320 132">
          {/* Grille horizontale ténue. */}
          <Line
            x1={0}
            y1={34}
            x2={320}
            y2={34}
            stroke={theme.palette.line}
            strokeWidth={1}
            opacity={0.5}
          />
          <Line
            x1={0}
            y1={70}
            x2={320}
            y2={70}
            stroke={theme.palette.line}
            strokeWidth={1}
            opacity={0.5}
          />
          <Line
            x1={0}
            y1={106}
            x2={320}
            y2={106}
            stroke={theme.palette.line}
            strokeWidth={1}
            opacity={0.5}
          />

          {/* Zones de fond : freinage / corde / réaccél. (teintes d'identité, ténues). */}
          <Rect x={0} y={0} width={110} height={120} fill="rgba(96,165,250,0.06)" />
          <Rect x={110} y={0} width={60} height={120} fill="rgba(242,121,43,0.07)" />
          <Rect x={170} y={0} width={150} height={120} fill="rgba(74,222,128,0.06)" />

          {/* Courbe de vitesse — halo or puis trait net. */}
          <Path
            d="M6,24 C50,28 85,62 110,86 C130,102 145,102 170,90 C210,70 260,42 314,26"
            fill="none"
            stroke={GOLD}
            strokeWidth={6}
            opacity={0.16}
            strokeLinecap="round"
          />
          <Path
            d="M6,24 C50,28 85,62 110,86 C130,102 145,102 170,90 C210,70 260,42 314,26"
            fill="none"
            stroke={GOLD}
            strokeWidth={2}
            opacity={0.95}
            strokeLinecap="round"
          />

          {/* Point de corde (minimum de vitesse) — halo ambre + point net. */}
          <Circle cx={140} cy={100} r={9} fill={AMBER} opacity={0.18} />
          <Circle cx={140} cy={100} r={3.4} fill={AMBER} />

          {/* Repères de vitesse (mono). */}
          <SvgText x={8} y={18} fontSize={8} fill={C.brake} fontFamily={theme.fonts.mono}>
            182 km/h
          </SvgText>
          <SvgText x={118} y={124} fontSize={8} fill={AMBER} fontFamily={theme.fonts.mono}>
            78 km/h
          </SvgText>
        </Svg>

        {/* Trois mesures de zone. */}
        <View style={styles.zones}>
          {ZONES.map((z) => (
            <View key={z.label} style={styles.zone}>
              <Text style={styles.zoneLabel}>{z.label}</Text>
              <Text style={[styles.zoneValue, { color: z.color }]}>{z.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Lignes de phase. */}
      {PHASES.map((p) => (
        <View key={p.label} style={styles.phase}>
          <View style={[styles.dot, { backgroundColor: p.color }]} />
          <Text style={styles.phaseText}>{renderEmphasis(p.text)}</Text>
          <Text style={styles.phaseValue}>{p.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Rend le segment **…** en mono crème (le chiffre = voix de l'instrument). */
function renderEmphasis(text: string) {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`b${i}`} style={styles.phaseEm}>
        {part}
      </Text>
    ) : (
      <Text key={`t${i}`}>{part}</Text>
    )
  );
}

const styles = StyleSheet.create({
  card: {
    ...cockpitPanel,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: GOLD,
  },
  statusRight: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  hero: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  heroNum: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 38,
    lineHeight: 40,
    color: theme.palette.cream,
    // Lueur dorée tempérée (« Ferrari minimaliste » : ≤ 0.36).
    textShadowColor: 'rgba(255,183,3,0.34)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  heroUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    color: GOLD,
  },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 2,
    color: GOLD,
    marginTop: 2,
  },
  zones: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  zone: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: 'rgba(255,255,255,0.014)',
  },
  zoneLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xs,
  },
  zoneValue: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 14,
  },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  phaseText: {
    flex: 1,
    fontFamily: theme.fonts.bodyLight,
    fontSize: 13,
    color: theme.palette.creamSoft,
  },
  phaseEm: {
    fontFamily: theme.fonts.monoMedium,
    color: theme.palette.cream,
  },
  phaseValue: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.palette.creamMute,
  },
});
