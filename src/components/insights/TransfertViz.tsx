/**
 * TransfertViz — Transfert de charge / vitesse de mise en appui (lecture N4.5).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N4-5_transfert.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §4.5.
 *
 * Pas combien de G, mais en combien de temps la masse se transfère. Cockpit :
 * barre de statut, durée de mise en appui la plus progressive en nombre héros,
 * puis barres de durée de prise de roulis par virage.
 *
 * DONNÉES : `transfer` (relevé par virage `load_transfer`, en secondes). Les
 * barres de durée et le virage héros en sont dérivés — chaque valeur affichée
 * trace vers ce relevé. Aucun tracé capteur n'est dessiné : le relevé ne porte
 * que des scalaires par virage, pas de série image-par-image (celle-ci attend
 * telemetry_frames / Valence). Prop nulle, `{}` ou tous scalaires absents →
 * état vide honnête, jamais de courbe ni de valeur inventée.
 *
 * Doctrine : mesure la durée de mise en charge (constat). Ne dit jamais comment
 * attaquer l'appui. Barres = donnée dérivée (crème/accel/flow selon le rang) ;
 * l'or reste au chrono/record. Aucune couleur heritage.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';
import type { CornerRecord } from '@/circuit/sessionInsights';

const C = theme.dataColors;
// Roulis / transfert = donnée (ni chrono, ni alarme) → crème neutre. L'or reste
// au chrono/record. (Nom GOLD conservé pour limiter le churn ; valeur neutre.)
const GOLD = theme.palette.cream;

export interface TransfertVizProps {
  /**
   * Temps de prise de roulis / transfert de charge par virage (secondes),
   * clés « corner_1 », « corner_2 »… (slice `load_transfer` des insights).
   */
  transfer: CornerRecord | null;
}

// Temps de prise de roulis par virage (entrée de courbe). Largeur ∝ durée.
interface Corner {
  corner: string;
  seconds: number;
  label: string;
  color: string;
  hot: boolean;
}

interface TransfertData {
  corners: Corner[];
  maxSeconds: number;
  heroSeconds: number;
  heroIndex: number;
}

/** « corner_3 » → 3 (0 si aucun indice lisible). */
function cornerIndex(key: string): number {
  const m = key.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** 0.4 → « 0,4 » ; 0.42 → « 0,42 » (virgule décimale). Non fini → « — ». */
function fmtSeconds(s: number): string {
  if (!Number.isFinite(s)) return '—';
  return String(Math.round(s * 100) / 100).replace('.', ',');
}

/**
 * Dérive les barres de durée + le virage héros depuis le relevé par virage.
 * Renvoie `null` si la donnée est absente ou insuffisante (honnêteté d'abord).
 */
function deriveTransfer(transfer: CornerRecord | null): TransfertData | null {
  if (!transfer) return null;
  const entries = Object.entries(transfer)
    .map(([key, seconds]) => ({ index: cornerIndex(key), seconds }))
    .filter((e) => Number.isFinite(e.seconds) && e.seconds > 0);
  if (entries.length === 0) return null;

  // Ordre décroissant : la mise en appui la plus longue en tête (grammaire maquette).
  const sorted = [...entries].sort((a, b) => b.seconds - a.seconds);
  const maxSeconds = sorted[0].seconds;
  const minSeconds = sorted[sorted.length - 1].seconds;

  const corners: Corner[] = sorted.map((e, i) => {
    const p = sorted.length > 1 ? i / (sorted.length - 1) : 0;
    const color = p <= 1 / 3 ? C.flow : p >= 2 / 3 ? C.accel : theme.palette.creamMute;
    return {
      corner: `V${e.index}`,
      seconds: e.seconds,
      label: `${fmtSeconds(e.seconds)} s`,
      color,
      // Extrêmes (la plus longue et la plus courte) mis en avant.
      hot: e.seconds === maxSeconds || e.seconds === minSeconds,
    };
  });

  // Héros : la mise en appui la plus progressive = la plus longue à s'établir.
  const hero = sorted[0];
  return { corners, maxSeconds, heroSeconds: hero.seconds, heroIndex: hero.index };
}

export function TransfertViz({ transfer }: TransfertVizProps) {
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

  const data = deriveTransfer(transfer);
  if (!data) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Données insuffisantes sur cette séance</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Instrument : statut + héros (durée de mise en appui la plus progressive). */}
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
            {fmtSeconds(data.heroSeconds)}
            <Text style={styles.heroUnit}> s</Text>
          </Text>
          <Text style={styles.heroLabel}>
            {`MISE EN APPUI · VIRAGE ${data.heroIndex} · LA PLUS PROGRESSIVE`}
          </Text>
        </View>
      </View>

      {/* Temps de prise de roulis par virage — constat, pas consigne. */}
      <View style={styles.card}>
        <Text style={styles.capSolo}>Temps de prise de roulis · entrée de courbe</Text>
        {data.corners.map((c) => (
          <View key={c.corner} style={styles.row}>
            <Text style={styles.lab}>{c.corner}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${(c.seconds / data.maxSeconds) * 100}%`, backgroundColor: c.color },
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

const styles = StyleSheet.create({
  card: {
    ...cockpitPanel,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  empty: {
    ...cockpitPanel,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    textAlign: 'center',
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
    color: theme.palette.creamMute,
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
    textShadowColor: 'rgba(245,245,247,0.12)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  heroUnit: { fontFamily: theme.fonts.mono, fontSize: 16, color: GOLD },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: theme.palette.creamMute,
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
