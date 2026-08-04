/**
 * DispersionViz — Dispersion de trajectoire par virage (lecture N3.1).
 *
 * Spec : 02_moteur_insights.md §3.1.
 *
 * Lit la tranche `dispersion` (écart-type latéral par virage, en mètres) et la
 * rend telle quelle : nombre héros (l'écart max, le point le moins reproductible),
 * lecture du virage le plus régulier, puis une barre par virage relative au pire.
 * Aucune trajectoire n'est dessinée : la tranche ne porte que des scalaires par
 * virage, jamais une série point par point — on n'invente donc pas de tracé.
 *
 * Doctrine : montre où la ligne hésite. Ne demande jamais d'être plus régulier.
 * Chrome (cadre, séparateur, piste de barre) reste atténué ; le crème (donnée)
 * n'habille que le pire virage réel. L'or reste réservé au chrono ; aucun ici.
 *
 * Données réelles : chaque valeur affichée provient de `dispersion`. Sans virage
 * exploitable, on affiche un état sobre — jamais une valeur ni une forme inventée.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';
import type { CornerRecord } from '@/circuit/sessionInsights';
import { useReduceMotion } from '@/components/motion/useReduceMotion';

const C = theme.dataColors;

export interface DispersionVizProps {
  /**
   * Dispersion réelle par virage : écart-type latéral en mètres, clés
   * « corner_1 », « corner_2 »… `null` ou `{}` → état sobre (aucune fabrication).
   */
  dispersion: CornerRecord | null;
}

/** Décimal en français (virgule). Scalaire non fini → « — » (jamais de crash). */
function frDec(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals).replace('.', ',');
}

/** Numéro de virage depuis une clé « corner_4 » → 4 (null si non parsable). */
function cornerNum(key: string): number | null {
  const m = key.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Teinte de barre par magnitude : le pire virage en crème, médian jaune, serré vert. */
function barColor(meters: number, maxM: number): string {
  if (maxM <= 0) return C.accel;
  const ratio = meters / maxM;
  if (ratio >= 0.999) return theme.palette.cream;
  if (ratio >= 0.4) return C.flow;
  return C.accel;
}

export function DispersionViz({ dispersion }: DispersionVizProps) {
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

  // Dérivation depuis la tranche réelle : un point (label + écart-type) par virage,
  // trié du plus dispersé (le moins reproductible) au plus serré. Le garde
  // Number.isFinite écarte tout scalaire null/manquant/NaN (jamais de crash).
  const rows = dispersion
    ? Object.entries(dispersion)
        .map(([key, meters]) => {
          const num = cornerNum(key);
          return { num, label: num !== null ? `V${num}` : key.toUpperCase(), meters };
        })
        .filter((r) => Number.isFinite(r.meters))
        .sort((a, b) => b.meters - a.meters)
    : [];

  // HONNÊTE-VIDE : sans virage exploitable (tous scalaires manquants inclus), on
  // ne fabrique ni forme ni barre.
  if (rows.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>Données insuffisantes sur cette séance</Text>
      </View>
    );
  }

  const worst = rows[0];
  const tight = rows[rows.length - 1];
  const maxM = worst.meters;
  const heroLabel =
    worst.num !== null ? `ÉCART MAX · VIRAGE ${worst.num}` : `ÉCART MAX · ${worst.label}`;

  return (
    <View style={styles.card}>
      {/* Barre de statut cockpit. */}
      <View style={styles.status}>
        <View style={styles.statusLeft}>
          <Animated.View style={[styles.dotLive, { opacity: blink }]} />
          <Text style={styles.statusLabel}>Dispersion de trajectoire</Text>
        </View>
        {/* Le nombre de tours superposés n'est pas dans la tranche → on affiche
            le nombre de virages mesurés (dérivable, non fabriqué). */}
        <Text style={styles.statusRight}>{rows.length} VIRAGES MESURÉS</Text>
      </View>

      {/* Nombre héros : écart max (le point le moins reproductible). */}
      <View style={styles.hero}>
        <Text style={styles.heroNum}>
          {frDec(maxM, 1)}
          <Text style={styles.heroUnit}> m</Text>
        </Text>
        <Text style={styles.heroLabel}>{heroLabel}</Text>
      </View>

      {/* Lecture d'appui : le virage le plus régulier (seulement s'il diffère). */}
      {rows.length > 1 && (
        <View style={styles.subReadout}>
          <Text style={styles.subVal}>{frDec(tight.meters, 1)} m</Text>
          <Text style={styles.subLabel}>PLUS RÉGULIER · {tight.label}</Text>
        </View>
      )}

      {/* Séparateur chrome (atténué, jamais dans la couleur donnée). */}
      <View style={styles.divider} />

      {/* Dispersion par virage (écart-type latéral réel, barre relative au max). */}
      <Text style={styles.barsHeader}>Écart-type latéral par virage</Text>
      <View style={styles.bars}>
        {rows.map((b) => (
          <View key={b.label} style={styles.barRow}>
            <Text style={styles.barLab}>{b.label}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${maxM > 0 ? (b.meters / maxM) * 100 : 0}%`,
                    backgroundColor: barColor(b.meters, maxM),
                  },
                ]}
              />
            </View>
            <Text style={styles.barVal}>{frDec(b.meters, 1)} m</Text>
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
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
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
  hero: { alignItems: 'center', marginBottom: theme.spacing.sm },
  heroNum: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 38,
    lineHeight: 40,
    color: theme.palette.cream,
    // Lueur crème tempérée (« Ferrari minimaliste » : ≤ 0.36). L'or reste au chrono.
    textShadowColor: 'rgba(245,245,247,0.34)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  heroUnit: { fontFamily: theme.fonts.mono, fontSize: 16, color: theme.palette.cream },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 2,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  subReadout: { alignItems: 'center', marginBottom: theme.spacing.md },
  subVal: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 14,
    color: theme.palette.creamSoft,
  },
  subLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.6,
    color: theme.palette.faint,
    marginTop: 1,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.line,
    marginBottom: theme.spacing.md,
  },
  barsHeader: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
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
