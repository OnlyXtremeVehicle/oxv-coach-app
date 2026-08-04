/**
 * GGViz — Diagramme G-G / enveloppe d'adhérence (lecture N2.2).
 *
 * Maquette : docs/refonte-app/maquette_insight_gg_gaming.html (étalon cockpit riche).
 * Spec     : 02_moteur_insights.md §2.2.
 *
 * Cockpit : barre de statut (mono neutre + point vivant), radar gradué avec cercle-
 * limite d'enveloppe doré tireté, nuage de points dont le BORD s'allume en or
 * (halo) et le combiné se creuse (la signature « grip sur les axes purs »), et
 * un nombre central — le taux de remplissage de l'enveloppe — à lueur dorée.
 *
 * Doctrine : l'or est la donnée (neutre). Pas de rouge (réservé marque/coach),
 * pas de heritageGold (réservé Heritage / numéros de virage). Nuage câblé sur le
 * VRAI g-g de la séance (loadGGPoints → prop `points`). Aucune valeur inventée :
 * si le nuage est trop maigre (< 20 points), vide honnête, jamais un chart fabriqué.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';
import { useReduceMotion } from '@/components/motion/useReduceMotion';

// Nuage g-g = donnée de charge (ni chrono, ni alarme) → crème neutre. L'or reste
// au chrono/record. (Nom GOLD conservé pour limiter le churn ; valeur neutre.)
const GOLD = theme.palette.cream;

// Repère carré ; centre du nuage et rayons.
const VB = 240;
const CX = 120;
const CY = 120;
const R_LIM = 92; // cercle-limite (enveloppe d'adhérence max).
const R_MID = 68;
const R_IN = 42;

// Le cercle-limite (dashed doré, gradué « 1,5 g ») matérialise l'enveloppe.
// L'échelle est ancrée dessus : R_LIM px ↔ G_MAX g. Sert au placement ET au
// nombre central (taux de remplissage = pic atteint / enveloppe).
const G_MAX = 1.5;
const PX_PER_G = R_LIM / G_MAX;

// Nuage insuffisant sous ce seuil → vide honnête (pas de signature lisible).
const MIN_POINTS = 20;

type Tier = 'edge' | 'mid' | 'inner';
interface Pt {
  x: number;
  y: number;
  r: number;
  tier: Tier;
}

/** Point g-g réel (loadGGPoints). Conventions gLat/gLong : sessionTelemetryMapping. */
export interface GGPoint {
  gLat: number;
  gLong: number;
  speedKmh: number | null;
}

export interface GGVizProps {
  /** Nuage g-g réel de la séance (loadGGPoints). Absent/null/maigre → vide honnête. */
  points?: GGPoint[] | null;
}

interface GGModel {
  pts: Pt[];
  envelopePct: number;
  stats: { label: string; value: string; unit: string; tone: 'gold' | 'mute' }[];
}

/** g → libellé français « 1,3 » (une décimale, virgule). */
function fmtG(g: number): string {
  return g.toFixed(1).replace('.', ',');
}

/** Valeur au 95e centile d'une liste (robuste aux pointes IMU/GPS). */
function p95(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.floor(0.95 * (sortedAsc.length - 1));
  return sortedAsc[idx];
}

/**
 * Dérive le rendu (nuage + nombre central + 3 mesures) du VRAI g-g.
 * - Placement : gLat → axe G/D (x), gLong → axe FREIN/ACCÉL (y, accél vers le haut).
 * - Tier (halo bord / cœur / intérieur) : rayon atteint / R_LIM, mêmes seuils que
 *   l'ancienne démo — la couche visuelle est intacte.
 * - Enveloppe % : pic (p95) de la magnitude g rapporté à G_MAX, borné [0..100].
 * - Mesures : |G lat| max, freinage max, et « combiné » = max min(|lat|,|long|)
 *   (l'appui simultané réel se creuse dans les diagonales — signature g-g).
 * Renvoie null si le nuage est trop maigre → vide honnête.
 */
function deriveModel(points: GGPoint[] | null | undefined): GGModel | null {
  if (!points || points.length < MIN_POINTS) return null;

  const pts: Pt[] = [];
  const mags: number[] = [];
  let maxLat = 0;
  let maxBrake = 0;
  let maxCombined = 0;

  for (const p of points) {
    const x = CX + p.gLat * PX_PER_G; // + = droite (D), − = gauche (G)
    const y = CY - p.gLong * PX_PER_G; // + gLong = accél (haut), − = frein (bas)
    const mag = Math.hypot(p.gLat, p.gLong);
    const reach = (mag * PX_PER_G) / R_LIM; // 0 centre → ~1 bord de l'enveloppe
    const tier: Tier = reach > 0.74 ? 'edge' : reach > 0.5 ? 'mid' : 'inner';
    pts.push({ x, y, r: tier === 'edge' ? 2.1 : tier === 'mid' ? 1.8 : 1.6, tier });

    mags.push(mag);
    if (Math.abs(p.gLat) > maxLat) maxLat = Math.abs(p.gLat);
    if (p.gLong < 0 && -p.gLong > maxBrake) maxBrake = -p.gLong; // freinage = gLong négatif
    const combined = Math.min(Math.abs(p.gLat), Math.abs(p.gLong));
    if (combined > maxCombined) maxCombined = combined;
  }

  mags.sort((a, b) => a - b);
  const envelopePct = Math.max(0, Math.min(100, Math.round((p95(mags) / G_MAX) * 100)));

  const stats: GGModel['stats'] = [
    { label: 'G latéral', value: fmtG(maxLat), unit: 'g', tone: 'gold' },
    { label: 'G frein', value: fmtG(maxBrake), unit: 'g', tone: 'gold' },
    { label: 'Combiné', value: fmtG(maxCombined), unit: 'g', tone: 'mute' },
  ];

  return { pts, envelopePct, stats };
}

export function GGViz({ points }: GGVizProps) {
  // Point de statut « vivant » (respiration douce, pas une alarme).
  const reduceMotion = useReduceMotion();
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    // « Réduire les animations » : le point reste allumé, sans respirer. Cinq de
    // ces vues sont montées ensemble sur l'écran d'une séance — c'étaient donc
    // cinq boucles infinies simultanées chez qui a demandé l'absence de
    // mouvement. Relevé le 04/08/2026.
    if (reduceMotion) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.32, duration: 1200, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink, reduceMotion]);

  const model = deriveModel(points);

  // Vide honnête : nuage absent ou trop maigre → une ligne sobre, jamais un chart
  // fabriqué (prod quasi sans télémétrie jusqu'à Valence).
  if (!model) {
    return (
      <View style={styles.graph}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Données insuffisantes sur cette séance</Text>
        </View>
      </View>
    );
  }
  const { pts, envelopePct, stats } = model;

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
            {/* Axes : filets fins (le ton sombre porte la discrétion). */}
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
            {/* Cercles de grille : mêmes filets que les axes. */}
            <Circle
              cx={CX}
              cy={CY}
              r={R_IN}
              fill="none"
              stroke={theme.palette.line}
              strokeWidth={1}
            />
            <Circle
              cx={CX}
              cy={CY}
              r={R_MID}
              fill="none"
              stroke={theme.palette.line}
              strokeWidth={1}
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
              strokeLinecap="round"
              opacity={0.42}
            />

            {/* Nuage : halo doré sur le bord, dégradé d'opacité vers le centre. */}
            <G>
              {pts.map((p, i) =>
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

            {/* Graduations g (chiffres mono, ton tertiaire discret). */}
            <SvgText
              x={CX + 5}
              y={CY - R_MID + 3}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={7}
            >
              1,0 g
            </SvgText>
            <SvgText
              x={CX + 5}
              y={CY - R_LIM + 3}
              fill={theme.palette.faint}
              fontFamily={theme.fonts.mono}
              fontSize={7}
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
              {envelopePct}
              <Text style={styles.corePct}> %</Text>
            </Text>
            <Text style={styles.coreSub}>ENVELOPPE</Text>
          </View>
        </View>
      </View>

      {/* Trois mesures clés. */}
      <View style={styles.stats}>
        {stats.map((st) => (
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
  empty: {
    minHeight: VB,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    textAlign: 'center',
    color: theme.palette.creamMute,
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
    backgroundColor: theme.palette.creamMute,
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
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
    // Lueur dorée tempérée (« Ferrari minimaliste » : ≤ 0.36).
    textShadowColor: 'rgba(245,245,247,0.12)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
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
    // Label d'instrument sous le chiffre : faint, l'or reste à la donnée.
    color: theme.palette.faint,
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
    // Lueur secondaire tempérée (≤ 0.36) — pas d'empilement de lueurs fortes.
    textShadowColor: 'rgba(245,245,247,0.12)',
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
