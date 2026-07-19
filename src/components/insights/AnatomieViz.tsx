/**
 * AnatomieViz — Anatomie de virage (lecture N2.1).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N2-1_anatomie.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §2.1.
 *
 * Décompose un virage en trois temps : freinage (rouge donnée) / corde (crème,
 * minimum de vitesse au pic de G latéral) / réaccélération (vert). Cockpit :
 * barre de statut, nombre héros (vitesse à la corde, à lueur crème neutre),
 * profil de vitesse en CRÈME à halo sur fond de phases, puis cartouches et
 * lignes de phase.
 *
 * Doctrine V3 : l'or est réservé au chrono/record — la vitesse (donnée de perf)
 * est neutre (crème). Pas de rouge de marque (réservé marque/coach). DÉMO virage
 * 3 (95 m / 78 km/h / 140 m), telemetry_frames vide.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';
import type { AnatomyCorner } from '@/circuit/sessionInsights';

const C = theme.dataColors;
// V3 : vitesse = donnée de perf → neutre crème (l'or reste au chrono/record).
const CREAM = theme.palette.cream;
const CREAM_MUTE = theme.palette.creamMute;

interface Phase {
  color: string;
  label: string;
  /** Le segment **…** sort en mono. */
  text: string;
  value: string;
}

export interface AnatomieVizProps {
  /** Anatomie réelle par virage de la séance (null/vide → état sobre). */
  anatomy: AnatomyCorner[] | null;
}

/** Entier en français (séparateur d'unités implicite, arrondi km/h & m). */
function frInt(n: number): string {
  return String(Math.round(n));
}

/** Décimal en français (virgule) — utilisé pour les g. */
function frDec(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',');
}

export function AnatomieViz({ anatomy }: AnatomieVizProps) {
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

  // HONNÊTE-VIDE : sans virage exploitable, on ne fabrique aucun profil.
  const corner = anatomy && anatomy.length > 0 ? anatomy[0] : null;
  if (!corner) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>Données insuffisantes sur cette séance</Text>
      </View>
    );
  }

  // Dérivation des entrées du rendu depuis la tranche réelle (un virage).
  const apex = frInt(corner.apex_speed_kmh);
  const brake = frInt(corner.brake_dist_m);
  const accel = frInt(corner.accel_dist_m);
  const gLat = frDec(corner.g_lat_apex, 2);

  // Trois temps : freinage (distance) / corde (vitesse mini + g lat.) / réaccél.
  // (distance). Le g d'entrée/sortie n'est pas dans la tranche → non fabriqué.
  const PHASES: Phase[] = [
    {
      color: C.brake,
      label: 'Freinage',
      text: `Freinage sur **${brake} m** avant la corde`,
      value: `${brake} m`,
    },
    {
      color: CREAM,
      label: 'Corde',
      text: `Vitesse mini à la corde : **${apex} km/h**`,
      value: `${gLat} g lat.`,
    },
    {
      color: C.accel,
      label: 'Réaccél.',
      text: `Réaccélération sur **${accel} m** jusqu’à la prochaine zone`,
      value: `${accel} m`,
    },
  ];

  const ZONES = [
    { label: 'Freinage', value: `${brake} m`, color: C.brake },
    { label: 'Corde', value: `${apex} km/h`, color: CREAM },
    { label: 'Réaccél.', value: `${accel} m`, color: C.accel },
  ];

  return (
    <View>
      <View style={styles.card}>
        {/* Barre de statut cockpit. */}
        <View style={styles.status}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.dotLive, { opacity: blink }]} />
            <Text style={styles.statusLabel}>Anatomie de virage</Text>
          </View>
          <Text style={styles.statusRight}>VIRAGE {corner.corner_index}</Text>
        </View>

        {/* Nombre héros : vitesse à la corde (le minimum, signature du virage). */}
        <View style={styles.hero}>
          <Text style={styles.heroNum}>
            {apex}
            <Text style={styles.heroUnit}> km/h</Text>
          </Text>
          <Text style={styles.heroLabel}>VITESSE À LA CORDE · MINIMUM</Text>
        </View>

        {/* Profil de vitesse : courbe CRÈME (donnée neutre) à halo sur fond de phases. */}
        <Svg width="100%" height={132} viewBox="0 0 320 132">
          {/* Zones de fond : freinage / corde / réaccél. (teintes d'identité, ténues). */}
          <Rect x={0} y={0} width={110} height={120} fill="rgba(230,57,70,0.06)" />
          <Rect x={110} y={0} width={60} height={120} fill="rgba(245,245,247,0.07)" />
          <Rect x={170} y={0} width={150} height={120} fill="rgba(74,222,128,0.06)" />

          {/* Grille horizontale : filets fins (le ton sombre porte la discrétion). */}
          {[34, 70, 106].map((y) => (
            <Line
              key={y}
              x1={0}
              y1={y}
              x2={320}
              y2={y}
              stroke={theme.palette.line}
              strokeWidth={1}
            />
          ))}

          {/* Courbe de vitesse — halo crème atténué puis trait net crème. */}
          <Path
            d="M6,24 C50,28 85,62 110,86 C130,102 145,102 170,90 C210,70 260,42 314,26"
            fill="none"
            stroke={CREAM_MUTE}
            strokeWidth={6}
            opacity={0.16}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M6,24 C50,28 85,62 110,86 C130,102 145,102 170,90 C210,70 260,42 314,26"
            fill="none"
            stroke={CREAM}
            strokeWidth={2}
            opacity={0.95}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Point de corde (minimum de vitesse) — halo crème + point net crème. */}
          <Circle cx={140} cy={100} r={9} fill={CREAM} opacity={0.16} />
          <Circle cx={140} cy={100} r={3.4} fill={CREAM} />

          {/* Repère de vitesse à la corde (mono). La vitesse d'entrée n'est pas
              dans la tranche → aucun repère fabriqué. */}
          <SvgText x={118} y={124} fontSize={8} fill={CREAM} fontFamily={theme.fonts.mono}>
            {apex} km/h
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
  emptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
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
    // V3 : la vitesse n'est pas le chrono → lueur crème neutre tempérée
    // (« Ferrari minimaliste » : ≤ 0.36). L'or reste réservé au chrono/record.
    textShadowColor: 'rgba(245,245,247,0.34)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  heroUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    color: CREAM,
  },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 2,
    color: theme.palette.creamMute,
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
