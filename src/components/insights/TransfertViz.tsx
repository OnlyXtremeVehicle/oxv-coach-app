/**
 * TransfertViz — Transfert de charge / vitesse de mise en appui (lecture N4.5).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N4-5_transfert.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §4.5.
 *
 * Pas combien de G, mais en combien de temps la masse se transfère. Cockpit :
 * barre de statut, durée de mise en appui en nombre héros (lueur dorée), montée
 * du G latéral (bleu) et vitesse de roulis (or à halo) avec la fenêtre de mise
 * en charge, puis barres de durée par virage.
 *
 * DÉMO : tracé et durées figés (V3 0,4 s … V9 0,7 s), telemetry_frames vide
 * jusqu'à Valence. Composant autonome, aucune télémétrie réelle.
 *
 * Doctrine : mesure la durée de mise en charge (constat). Ne dit jamais comment
 * attaquer l'appui. L'or est la donnée (roulis, fenêtre) ; bleu freinage pour
 * l'appui, accel/vert pour les entrées progressives. Aucune couleur heritage.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';

const C = theme.dataColors;
const GOLD = theme.palette.gold;

// Temps de prise de roulis par virage (entrée de courbe). Largeur ∝ durée.
interface Corner {
  corner: string;
  seconds: number;
  label: string;
  color: string;
  hot: boolean;
}
const CORNERS: Corner[] = [
  { corner: 'V9', seconds: 0.7, label: '0,7 s', color: C.flow, hot: true },
  { corner: 'V6', seconds: 0.6, label: '0,6 s', color: C.flow, hot: false },
  { corner: 'V2', seconds: 0.5, label: '0,5 s', color: theme.palette.creamMute, hot: false },
  { corner: 'V7', seconds: 0.45, label: '0,45 s', color: C.accel, hot: false },
  { corner: 'V3', seconds: 0.4, label: '0,4 s', color: C.accel, hot: true },
];
const MAX_S = 0.7;

export function TransfertViz() {
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
      {/* Instrument : statut + héros + tracé d'appui. */}
      <View style={styles.card}>
        <View style={styles.status}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.dotLive, { opacity: blink }]} />
            <Text style={styles.statusLabel}>Transfert de charge</Text>
          </View>
          <Text style={styles.statusRight}>ROULIS · GYRO X</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroNum}>
            0,4
            <Text style={styles.heroUnit}> s</Text>
          </Text>
          <Text style={styles.heroLabel}>MISE EN APPUI · VIRAGE 3 · LA PLUS PROGRESSIVE</Text>
        </View>

        <Text style={styles.capSolo}>Entrée virage 3 · prise de roulis</Text>
        <Svg width="100%" height={130} viewBox="0 0 320 130">
          <Line x1={0} y1={100} x2={320} y2={100} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          {/* G latéral qui monte puis plafonne (appui). */}
          <Path
            d="M20,100 C60,98 80,60 120,44 C160,32 240,30 300,30"
            fill="none"
            stroke={C.brake}
            strokeWidth={2}
          />
          {/* Vitesse de roulis (gyro X) — or, halo puis trait net. */}
          <Path
            d="M20,100 C50,98 70,42 95,40 C115,38 130,82 160,92 C200,99 240,99 300,99"
            fill="none"
            stroke={GOLD}
            strokeWidth={5}
            opacity={0.16}
          />
          <Path
            d="M20,100 C50,98 70,42 95,40 C115,38 130,82 160,92 C200,99 240,99 300,99"
            fill="none"
            stroke={GOLD}
            strokeWidth={2}
          />
          {/* Fenêtre de mise en charge : début d'appui → stabilisation du roulis. */}
          <Line
            x1={70}
            y1={14}
            x2={70}
            y2={110}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Line
            x1={160}
            y1={14}
            x2={160}
            y2={110}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Line x1={70} y1={18} x2={160} y2={18} stroke={GOLD} strokeWidth={1.4} />
          <SvgText x={84} y={22} fill={GOLD} fontFamily={theme.fonts.mono} fontSize={8.5}>
            0,4 s
          </SvgText>
        </Svg>
        <View style={styles.legend}>
          <Legend color={C.brake} label="G latéral (appui)" />
          <Legend color={GOLD} label="Vitesse de roulis · gyro X" />
        </View>
      </View>
      <Text style={styles.hint}>
        ↑ la masse finit de se transférer quand le roulis se stabilise
      </Text>

      {/* Temps de prise de roulis par virage — constat, pas consigne. */}
      <View style={styles.card}>
        <Text style={styles.capSolo}>Temps de prise de roulis · entrée de courbe</Text>
        {CORNERS.map((c) => (
          <View key={c.corner} style={styles.row}>
            <Text style={styles.lab}>{c.corner}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${(c.seconds / MAX_S) * 100}%`, backgroundColor: c.color },
                  c.hot && styles.fillHot,
                ]}
              />
            </View>
            <Text style={[styles.val, { color: c.hot ? c.color : theme.palette.creamMute }]}>
              {c.label}
            </Text>
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
    color: theme.palette.cream,
    // Lueur dorée tempérée (« Ferrari minimaliste » : ≤ 0.36).
    textShadowColor: 'rgba(255,183,3,0.34)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  heroUnit: { fontFamily: theme.fonts.mono, fontSize: 16, color: GOLD },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: GOLD,
    marginTop: 4,
    textAlign: 'center',
  },
  capSolo: {
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
  row: {
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
  fill: { height: '100%', borderRadius: theme.radius.pill },
  fillHot: {
    // Lueur de donnée lisible mais sans bloom qui bave (≤ ~0.5).
    shadowColor: GOLD,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  val: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    width: 48,
    textAlign: 'right',
  },
});
