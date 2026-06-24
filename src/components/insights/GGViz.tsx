/**
 * GGViz — Diagramme G-G / enveloppe d'adhérence (lecture N2.2).
 *
 * Maquette : docs/refonte-app/maquette_insight_gg_gaming.html (étalon cockpit riche).
 * Spec     : 02_moteur_insights.md §2.2.
 *
 * Cockpit : barre de statut (or mono + point vivant), radar gradué avec cercle-
 * limite d'enveloppe doré tireté, nuage de points dont le BORD s'allume en or
 * (halo) et le combiné se creuse (la signature « grip sur les axes purs »), et
 * un nombre central — le taux de remplissage de l'enveloppe — à lueur dorée.
 *
 * Doctrine : l'or est la donnée (neutre). Pas de rouge (réservé marque/coach),
 * pas de heritageGold (réservé Heritage / numéros de virage). Nuage DÉMO figé,
 * déterministe, autonome — telemetry_frames vide jusqu'à Valence.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';

const GOLD = theme.palette.gold;

// Repère carré ; centre du nuage et rayons.
const VB = 240;
const CX = 120;
const CY = 120;
const R_LIM = 92; // cercle-limite (enveloppe d'adhérence max).
const R_MID = 68;
const R_IN = 42;

type Tier = 'edge' | 'mid' | 'inner';
interface Pt {
  x: number;
  y: number;
  r: number;
  tier: Tier;
}

/**
 * Nuage DÉMO déterministe « axes purs » : dense et au bord sur chaque axe
 * (freiner OU tourner), clairsemé et rentré dans les diagonales (le combiné se
 * creuse). Aucun Math.random → rendu stable. Le tier dérive du rayon atteint :
 * bord (allumé), cœur, intérieur (sombre).
 */
function buildPoints(): Pt[] {
  const pts: Pt[] = [];
  const total = 132;
  for (let i = 0; i < total; i++) {
    const theta = (i / total) * Math.PI * 2;
    // « axisness » : 1 sur les axes, 0 dans les diagonales (combiné).
    const axisness = Math.abs(Math.cos(2 * theta));
    // Densité : on saute la plupart des points hors-axe.
    const keep = 0.24 + 0.76 * axisness;
    if ((i * 0.6180339887) % 1 > keep) continue;
    // Rayon limite local : grand sur l'axe, réduit dans le combiné.
    const rlim = R_LIM * (0.46 + 0.54 * axisness);
    // Position pseudo-déterministe dans [0.40..1] du rayon limite.
    const frac = 0.4 + 0.6 * ((i * 0.7548776662) % 1);
    const r = rlim * frac;
    const reach = r / R_LIM; // 0 centre → ~1 bord absolu.
    const tier: Tier = reach > 0.74 ? 'edge' : reach > 0.5 ? 'mid' : 'inner';
    pts.push({
      x: CX + r * Math.cos(theta),
      y: CY - r * Math.sin(theta),
      r: tier === 'edge' ? 2.1 : tier === 'mid' ? 1.8 : 1.6,
      tier,
    });
  }
  return pts;
}

const POINTS = buildPoints();

// Taux de remplissage de l'enveloppe (DÉMO) — le chiffre dominant.
const ENVELOPPE_PCT = 72;

const STATS = [
  { label: 'G latéral', value: '1,3', unit: 'g', tone: 'gold' as const },
  { label: 'G frein', value: '1,1', unit: 'g', tone: 'gold' as const },
  { label: 'Combiné', value: '0,7', unit: 'g', tone: 'mute' as const },
];

export function GGViz() {
  // Point de statut « vivant » (respiration douce, pas une alarme).
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
      <View style={styles.graph}>
        {/* Barre de statut cockpit. */}
        <View style={styles.status}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.dot, { opacity: blink }]} />
            <Text style={styles.statusLabel}>Enveloppe d’adhérence</Text>
          </View>
          <Text style={styles.statusRight}>COMBINÉ G-G</Text>
        </View>

        {/* Radar + nombre central superposé. */}
        <View style={styles.radarWrap}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${VB} ${VB}`}>
            {/* Axes. */}
            <Line
              x1={CX}
              y1={18}
              x2={CX}
              y2={VB - 18}
              stroke={theme.palette.line}
              strokeWidth={1}
            />
            <Line
              x1={18}
              y1={CY}
              x2={VB - 18}
              y2={CY}
              stroke={theme.palette.line}
              strokeWidth={1}
            />
            {/* Cercles de grille. */}
            <Circle
              cx={CX}
              cy={CY}
              r={R_IN}
              fill="none"
              stroke={theme.palette.line}
              strokeWidth={1}
              opacity={0.7}
            />
            <Circle
              cx={CX}
              cy={CY}
              r={R_MID}
              fill="none"
              stroke={theme.palette.line}
              strokeWidth={1}
              opacity={0.7}
            />
            {/* Cercle-limite : enveloppe max, doré tireté (donnée, pas jugement). */}
            <Circle
              cx={CX}
              cy={CY}
              r={R_LIM}
              fill="none"
              stroke={GOLD}
              strokeWidth={1.2}
              strokeDasharray="3 5"
              opacity={0.38}
            />

            {/* Nuage : halo doré sur le bord, dégradé d'opacité vers le centre. */}
            <G>
              {POINTS.map((p, i) =>
                p.tier === 'edge' ? (
                  <G key={i}>
                    <Circle cx={p.x} cy={p.y} r={p.r * 2.7} fill={GOLD} opacity={0.16} />
                    <Circle cx={p.x} cy={p.y} r={p.r} fill={GOLD} opacity={0.95} />
                  </G>
                ) : (
                  <Circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={GOLD}
                    opacity={p.tier === 'mid' ? 0.6 : 0.32}
                  />
                )
              )}
            </G>

            {/* Graduations g (très discrètes). */}
            <SvgText
              x={CX + 5}
              y={CY - R_MID + 3}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={7}
              opacity={0.7}
            >
              1,0 g
            </SvgText>
            <SvgText
              x={CX + 5}
              y={CY - R_LIM + 3}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={7}
              opacity={0.7}
            >
              1,5 g
            </SvgText>

            {/* Axes nommés (mono faint). */}
            <SvgText
              x={CX}
              y={13}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={9}
              textAnchor="middle"
            >
              ACCÉL
            </SvgText>
            <SvgText
              x={CX}
              y={VB - 5}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={9}
              textAnchor="middle"
            >
              FREIN
            </SvgText>
            <SvgText
              x={7}
              y={CY + 3}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={9}
              textAnchor="start"
            >
              G
            </SvgText>
            <SvgText
              x={VB - 7}
              y={CY + 3}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={9}
              textAnchor="end"
            >
              D
            </SvgText>
          </Svg>

          {/* Nombre central : remplissage d'enveloppe, à lueur dorée. */}
          <View style={styles.core} pointerEvents="none">
            <Text style={styles.coreNum}>
              {ENVELOPPE_PCT}
              <Text style={styles.corePct}> %</Text>
            </Text>
            <Text style={styles.coreSub}>ENVELOPPE</Text>
          </View>
        </View>
      </View>

      {/* Trois mesures clés. */}
      <View style={styles.stats}>
        {STATS.map((st) => (
          <View key={st.label} style={styles.stat}>
            <Text style={styles.statLabel}>{st.label}</Text>
            <Text
              style={[styles.statValue, st.tone === 'gold' ? styles.statGold : styles.statMute]}
            >
              {st.value}
              <Text style={styles.statUnit}> {st.unit}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  graph: {
    ...cockpitPanel,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
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
  dot: {
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
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  radarWrap: {
    width: VB,
    maxWidth: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
    position: 'relative',
  },
  core: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreNum: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 40,
    lineHeight: 42,
    color: theme.palette.cream,
    textShadowColor: 'rgba(255,183,3,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  corePct: {
    fontFamily: theme.fonts.mono,
    fontSize: 18,
    color: GOLD,
  },
  coreSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 2.4,
    color: GOLD,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.palette.line,
  },
  statLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  statValue: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 21,
    marginTop: theme.spacing.sm,
  },
  statGold: {
    color: GOLD,
    textShadowColor: 'rgba(255,183,3,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  statMute: {
    color: theme.palette.creamMute,
  },
  statUnit: {
    fontSize: 12,
    color: theme.palette.creamMute,
  },
});
