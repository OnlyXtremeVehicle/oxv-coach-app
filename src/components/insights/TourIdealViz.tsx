/**
 * TourIdealViz — Tour idéal composé (lecture N3.2).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N3-2_tour_ideal.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §3.2.
 *
 * Assemble le meilleur micro-secteur de chaque tour en un « tour théorique »
 * (1:41.2, −1,6 s sous le meilleur tour réel). Cockpit : barre de statut, chrono
 * idéal en nombre héros (lueur dorée) avec le réel en référence, barre de
 * provenance des secteurs, puis répartition du temps perdu (80 % en S2).
 *
 * DÉMO : valeurs figées (1:42.8 / 1:41.2 ; S2 80 %), telemetry_frames vide.
 *
 * Doctrine : constate où le temps se loge (« 80 % en S2 »). Ne dit jamais d'y
 * travailler. L'or est la donnée ; ambre pilote (#F2792B) pour le secteur qui
 * concentre la perte. Aucune couleur heritage.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';

const C = theme.dataColors;
const GOLD = theme.palette.gold;
const AMBER = '#F2792B';

// Deux chronos DÉMO (maquette N3-2).
const REAL_BEST = '1:42.8';
const IDEAL = '1:41.2';
const DELTA = '−1,6 s';

// Provenance de chaque secteur du tour idéal (largeur = part de tour).
interface Segment {
  sector: string;
  from: string;
  width: number;
  accent: string;
  tint: string;
}
const SEGMENTS: Segment[] = [
  { sector: 'S1', from: 'tour 9', width: 31, accent: C.accel, tint: 'rgba(74,222,128,0.16)' },
  { sector: 'S2', from: 'tour 14', width: 38, accent: C.brake, tint: 'rgba(96,165,250,0.16)' },
  { sector: 'S3', from: 'tour 11', width: 31, accent: C.accel, tint: 'rgba(74,222,128,0.16)' },
];

// Répartition du temps perdu (où se loge l'écart de 1,6 s).
interface Lost {
  sector: string;
  pct: number;
  label: string;
  color: string;
  hot: boolean;
}
const LOST: Lost[] = [
  { sector: 'S2', pct: 80, label: '80 % · 1,28 s', color: AMBER, hot: true },
  { sector: 'S1', pct: 13, label: '13 % · 0,21 s', color: C.flow, hot: false },
  { sector: 'S3', pct: 7, label: '7 % · 0,11 s', color: C.flow, hot: false },
];

export function TourIdealViz() {
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
      {/* Chrono idéal en héros, réel en référence. */}
      <View style={styles.card}>
        <View style={styles.status}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.dotLive, { opacity: blink }]} />
            <Text style={styles.statusLabel}>Tour idéal composé</Text>
          </View>
          <Text style={styles.statusRight}>MICRO-SECTEURS</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroNum}>{IDEAL}</Text>
          <Text style={styles.heroLabel}>TOUR IDÉAL · {DELTA} SOUS VOTRE MEILLEUR RÉEL</Text>
        </View>

        <View style={styles.refRow}>
          <Text style={styles.refKey}>Meilleur tour réel</Text>
          <Text style={styles.refVal}>{REAL_BEST}</Text>
        </View>
      </View>

      {/* Barre composite : provenance de chaque secteur du tour idéal. */}
      <View style={styles.card}>
        <Text style={styles.cap}>Provenance de chaque secteur du tour idéal</Text>
        <View style={styles.secbar}>
          {SEGMENTS.map((seg) => (
            <View
              key={seg.sector}
              style={[styles.seg, { flex: seg.width, backgroundColor: seg.tint }]}
            >
              <View style={[styles.segAccent, { backgroundColor: seg.accent }]} />
              <Text style={styles.segName}>{seg.sector}</Text>
              <Text style={styles.segFrom}>{seg.from}</Text>
            </View>
          ))}
        </View>
        <View style={styles.secLegend}>
          <Text style={styles.secLegendText}>Départ</Text>
          <Text style={styles.secLegendText}>Ligne d’arrivée</Text>
        </View>
      </View>

      {/* Où se loge l'écart de 1,6 s — constat, pas consigne. */}
      <View style={styles.card}>
        <Text style={styles.cap}>Où se loge l’écart de 1,6 s</Text>
        {LOST.map((l) => (
          <View key={l.sector} style={styles.lrow}>
            <Text style={styles.lab}>{l.sector}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${l.pct}%`, backgroundColor: l.color },
                  l.hot && styles.fillHot,
                ]}
              />
            </View>
            <Text style={[styles.pct, { color: l.hot ? l.color : theme.palette.creamMute }]}>
              {l.label}
            </Text>
          </View>
        ))}
      </View>
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
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: theme.palette.cream,
    textShadowColor: 'rgba(255,183,3,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: GOLD,
    marginTop: 4,
    textAlign: 'center',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.md,
  },
  refKey: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  refVal: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 16,
    color: theme.palette.creamSoft,
  },
  cap: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  secbar: {
    flexDirection: 'row',
    height: 46,
    borderRadius: theme.radius.sm,
    borderColor: theme.palette.line,
    borderWidth: 1,
    overflow: 'hidden',
  },
  seg: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.palette.line,
  },
  segAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  segName: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 11,
    color: theme.palette.cream,
  },
  segFrom: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  secLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  secLegendText: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  lrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  lab: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.palette.creamSoft,
    width: 28,
  },
  track: {
    flex: 1,
    height: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },
  fillHot: {
    shadowColor: AMBER,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pct: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    width: 76,
    textAlign: 'right',
  },
});
