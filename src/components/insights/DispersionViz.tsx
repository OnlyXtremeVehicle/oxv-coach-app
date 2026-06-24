/**
 * DispersionViz — Dispersion de trajectoire par virage (lecture N3.1).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N3-1_dispersion.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §3.1.
 *
 * Superpose les tours d'une séance : là où le faisceau s'évase, la trajectoire
 * change d'un tour à l'autre. Cockpit : barre de statut, nombre héros (écart max
 * à lueur dorée), trajectoire médiane en OR à halo sur le faisceau de variation
 * ambre, puis barres de dispersion par virage (écart-type latéral, en mètres).
 *
 * Doctrine : montre où la ligne hésite. Ne demande jamais d'être plus régulier.
 * L'or est la donnée ; ambre pilote (#F2792B, neutralise le rouge trajectory)
 * pour la variation, accel (vert) pour la constance. Aucune couleur heritage.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';

const C = theme.dataColors;
const GOLD = theme.palette.gold;
const AMBER = '#F2792B';

// Variations DÉMO du faisceau (médiane + 5 traces, maquette N3-1).
const TRACES = [
  'M70,204 C41,150 46,96 96,71 C141,49 151,81 176,96 C206,114 250,96 269,130 C287,161 250,199 200,199 C150,199 120,209 70,204',
  'M70,206 C40,150 44,94 94,69 C138,46 148,77 178,92 C207,111 251,94 271,131 C289,163 251,201 201,201 C151,201 121,211 70,206',
  'M71,205 C42,151 47,97 97,72 C144,52 156,86 173,99 C204,116 249,97 268,129 C286,160 249,198 199,198 C149,198 119,208 71,205',
  'M69,205 C39,149 43,95 93,70 C135,44 143,73 181,89 C209,109 252,95 270,130 C288,162 250,200 200,200 C150,200 120,210 69,205',
  'M70,205 C41,150 45,95 95,70 C140,48 160,90 170,101 C202,117 250,96 269,130 C287,161 250,199 200,199 C150,199 120,209 70,205',
];

const MEDIAN =
  'M70,205 C40,150 45,95 95,70 C140,48 150,80 175,95 C205,113 250,95 270,130 C288,162 250,200 200,200 C150,200 120,210 70,205';

// Écart-type latéral par virage (mètres) → largeur de barre relative au max.
const BARS = [
  { corner: 'V4', meters: 1.8, color: AMBER },
  { corner: 'V7', meters: 1.2, color: C.flow },
  { corner: 'V2', meters: 0.7, color: C.flow },
  { corner: 'V5', meters: 0.5, color: C.accel },
  { corner: 'V1', meters: 0.3, color: C.accel },
];
const MAX_M = 1.8;

export function DispersionViz() {
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
            <Text style={styles.statusLabel}>Dispersion de trajectoire</Text>
          </View>
          <Text style={styles.statusRight}>18 TOURS SUPERPOSÉS</Text>
        </View>

        {/* Nombre héros : écart max (le point le moins reproductible). */}
        <View style={styles.hero}>
          <Text style={styles.heroNum}>
            1,8
            <Text style={styles.heroUnit}> m</Text>
          </Text>
          <Text style={styles.heroLabel}>ÉCART MAX · VIRAGE 4</Text>
        </View>

        <Svg width="100%" height={236} viewBox="0 0 320 236">
          {/* Faisceau de variation (large à l'évasement V4). */}
          <Path
            d="M70,205 C40,150 45,95 95,70 C140,48 150,80 175,95 C205,113 250,95 270,130 C288,162 250,200 200,200 C150,200 120,210 70,205 Z"
            fill="none"
            stroke="rgba(242,121,43,0.10)"
            strokeWidth={22}
            strokeLinecap="round"
          />
          {/* Les tours superposés (variations fines). */}
          {TRACES.map((d, i) => (
            <Path key={i} d={d} fill="none" stroke="rgba(248,249,250,0.26)" strokeWidth={1} />
          ))}
          {/* Trajectoire médiane — halo or puis trait net. */}
          <Path
            d={MEDIAN}
            fill="none"
            stroke={GOLD}
            strokeWidth={5}
            opacity={0.16}
            strokeLinecap="round"
          />
          <Path
            d={MEDIAN}
            fill="none"
            stroke={GOLD}
            strokeWidth={1.8}
            opacity={0.95}
            strokeLinecap="round"
          />

          {/* Marqueur V4 (dispersion large) — halo ambre. */}
          <Circle cx={150} cy={80} r={11} fill={AMBER} opacity={0.16} />
          <Circle cx={150} cy={80} r={5} fill="none" stroke={AMBER} strokeWidth={2} />
          <SvgText x={160} y={76} fontSize={9} fill={AMBER} fontFamily={theme.fonts.mono}>
            V4 · 1,8 m
          </SvgText>
          {/* Marqueur V1 (serré). */}
          <Circle cx={95} cy={70} r={4} fill="none" stroke={C.accel} strokeWidth={2} />
          <SvgText x={20} y={58} fontSize={9} fill={C.accel} fontFamily={theme.fonts.mono}>
            V1 · 0,3 m
          </SvgText>
          {/* Ligne start/finish. */}
          <Line
            x1={64}
            y1={200}
            x2={76}
            y2={210}
            stroke={theme.palette.creamMute}
            strokeWidth={2}
          />
        </Svg>

        <View style={styles.legend}>
          <Legend color={GOLD} label="Trajectoire médiane" />
          <Legend color="rgba(242,121,43,0.55)" label="Zone de variation" />
        </View>
      </View>

      {/* Dispersion par virage. */}
      <View style={styles.bars}>
        {BARS.map((b) => (
          <View key={b.corner} style={styles.barRow}>
            <Text style={styles.barLab}>{b.corner}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${(b.meters / MAX_M) * 100}%`, backgroundColor: b.color },
                ]}
              />
            </View>
            <Text style={styles.barVal}>{b.meters.toFixed(1).replace('.', ',')} m</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legw}>
      <View style={[styles.sw, { backgroundColor: color }]} />
      <Text style={styles.legwText}>{label}</Text>
    </View>
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
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
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
  hero: { alignItems: 'center', marginBottom: theme.spacing.md },
  heroNum: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 38,
    lineHeight: 40,
    color: theme.palette.cream,
    textShadowColor: 'rgba(255,183,3,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  heroUnit: { fontFamily: theme.fonts.mono, fontSize: 16, color: GOLD },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 2,
    color: GOLD,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.line,
  },
  legw: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  sw: { width: 14, height: 3, borderRadius: 2 },
  legwText: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  bars: { marginBottom: theme.spacing.xs },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  barLab: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: theme.palette.creamSoft,
    width: 40,
  },
  barTrack: {
    flex: 1,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: theme.radius.pill },
  barVal: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.palette.creamMute,
    width: 46,
    textAlign: 'right',
  },
});
