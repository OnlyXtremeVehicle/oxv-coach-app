/**
 * FlowViz — Cohérence du flow (lecture N4.3).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N4-3_flow.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §4.3.
 *
 * La fluidité = régularité des transitions, lue dans le jerk (dérivée de
 * l'accélération). Cockpit : barre de statut, tour le plus fluide en nombre
 * héros (lueur dorée), trace de jerk lisse en OR à halo contre la trace hachée
 * en ambre, puis nuage fluidité × temps montrant que plus c'est fluide, plus
 * c'est rapide.
 *
 * DÉMO : tracés et points figés (rapide 1:42.8 / haché 1:45.1, 18 tours),
 * telemetry_frames vide jusqu'à Valence. Composant déterministe.
 *
 * Doctrine : révèle le lien entre douceur et vitesse. Ne dit jamais « soyez
 * plus fluide ». L'or est la donnée (fluidité) ; ambre pour le tour haché en
 * contraste. Aucune couleur heritage.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';

const GOLD = theme.palette.gold;

// Tour haché : dents de scie marquées (maquette N4-3).
const JAGGED =
  '4,65 18,40 28,88 40,38 54,92 64,50 78,30 90,95 104,45 118,85 130,42 144,90 158,48 172,30 186,92 200,52 214,86 228,40 242,88 256,46 270,82 284,44 298,72 312,60';
// Tour rapide : ondulation douce.
const SMOOTH =
  '4,65 24,58 44,68 64,56 84,70 104,60 124,64 144,57 164,67 184,59 204,66 224,58 244,67 264,60 284,64 312,62';

// Nuage fluidité × temps : fluide (gauche) = rapide (bas). Corrélation nette.
const SCATTER: { x: number; y: number }[] = [
  { x: 58, y: 52 },
  { x: 70, y: 48 },
  { x: 86, y: 60 },
  { x: 98, y: 56 },
  { x: 112, y: 66 },
  { x: 126, y: 62 },
  { x: 140, y: 72 },
  { x: 152, y: 68 },
  { x: 166, y: 78 },
  { x: 180, y: 74 },
  { x: 194, y: 84 },
  { x: 208, y: 80 },
  { x: 222, y: 92 },
  { x: 236, y: 88 },
  { x: 250, y: 98 },
  { x: 264, y: 104 },
  { x: 276, y: 100 },
  { x: 288, y: 112 },
];

export function FlowViz() {
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
      {/* Instrument : statut + héros + traces de jerk. */}
      <View style={styles.card}>
        <View style={styles.status}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.dotLive, { opacity: blink }]} />
            <Text style={styles.statusLabel}>Cohérence du flow</Text>
          </View>
          <Text style={styles.statusRight}>JERK · 18 TOURS</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroNum}>1:42.8</Text>
          <Text style={styles.heroLabel}>TOUR LE PLUS FLUIDE = LE PLUS RAPIDE</Text>
        </View>

        <Text style={styles.cap}>Tour le plus rapide vs tour le plus haché · un tour complet</Text>
        <Svg width="100%" height={130} viewBox="0 0 320 130">
          <Line x1={0} y1={65} x2={320} y2={65} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          {/* Tour haché — ambre en contraste. */}
          <Polyline points={JAGGED} fill="none" stroke="rgba(242,121,43,0.55)" strokeWidth={1.5} />
          {/* Tour rapide — fluidité (or), halo puis trait net. */}
          <Polyline points={SMOOTH} fill="none" stroke={GOLD} strokeWidth={5} opacity={0.16} />
          <Polyline points={SMOOTH} fill="none" stroke={GOLD} strokeWidth={2} />
        </Svg>
        <View style={styles.legend}>
          <Legend color={GOLD} label="Tour le + rapide (1:42.8)" />
          <Legend color="rgba(242,121,43,0.6)" label="Tour le + haché (1:45.1)" />
        </View>
      </View>
      <Text style={styles.hint}>↑ moins de pics = transitions plus douces</Text>

      {/* Nuage fluidité × temps : la corrélation douceur → vitesse. */}
      <View style={styles.card}>
        <Text style={styles.cap}>Fluidité × temps au tour · vos 18 tours</Text>
        <Svg width="100%" height={150} viewBox="0 0 300 150">
          {/* Axes. */}
          <Line x1={34} y1={12} x2={34} y2={124} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          <Line
            x1={34}
            y1={124}
            x2={288}
            y2={124}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />
          <SvgText
            x={10}
            y={70}
            fill={theme.palette.creamMute}
            fontFamily={theme.fonts.mono}
            fontSize={8}
            transform="rotate(-90 10 70)"
          >
            temps tour
          </SvgText>
          <SvgText
            x={120}
            y={138}
            fill={theme.palette.creamMute}
            fontFamily={theme.fonts.mono}
            fontSize={8}
          >
            ← plus fluide
          </SvgText>
          {/* Tendance : fluide (gauche) = rapide (bas). */}
          <Line
            x1={46}
            y1={44}
            x2={278}
            y2={110}
            stroke="rgba(255,183,3,0.40)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          {/* Les 18 tours. */}
          {SCATTER.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={GOLD} opacity={0.85} />
          ))}
          {/* Meilleur tour, le plus fluide — halo or. */}
          <Circle cx={70} cy={48} r={10} fill={GOLD} opacity={0.16} />
          <Circle cx={70} cy={48} r={5} fill="none" stroke={GOLD} strokeWidth={2} />
          <SvgText x={78} y={46} fill={GOLD} fontFamily={theme.fonts.mono} fontSize={8}>
            1:42.8
          </SvgText>
        </Svg>
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
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
  hero: { alignItems: 'center', marginBottom: theme.spacing.lg },
  heroNum: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -0.4,
    color: theme.palette.cream,
    textShadowColor: 'rgba(255,183,3,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: GOLD,
    marginTop: 4,
    textAlign: 'center',
  },
  cap: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  legend: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.line,
  },
  legw: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  sw: { width: 14, height: 3, borderRadius: 2 },
  legwText: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  hint: {
    textAlign: 'center',
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    opacity: 0.7,
    marginBottom: theme.spacing.lg,
  },
});
