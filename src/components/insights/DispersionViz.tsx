/**
 * DispersionViz — Dispersion de trajectoire par virage (lecture N3.1).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N3-1_dispersion.html
 * Patron cockpit : maquette_insight_gg_gaming.html (porté au niveau riche).
 * Spec     : 02_moteur_insights.md §3.1.
 *
 * Superpose les tours d'une séance : là où le faisceau s'évase, la trajectoire
 * change d'un tour à l'autre. Cockpit : barre de statut, nombre héros (écart max),
 * trajectoire médiane en crème atténuée (référence) à halo sur le faisceau de
 * variation crème, puis barres de dispersion par virage (écart-type latéral, en m).
 *
 * Doctrine : montre où la ligne hésite. Ne demande jamais d'être plus régulier.
 * Deux séries superposées : médiane = crème atténuée (creamMute), variation = crème
 * (cream). accel (vert) pour la constance. Or réservé au chrono ; aucun ici.
 *
 * Données réelles : la tranche `dispersion` (écart-type latéral par virage, en m)
 * alimente le nombre héros, les repères V worst/tight et les barres. Le faisceau
 * SVG est un décor schématique (aucune valeur n'en est lue) ; sans donnée
 * exploitable on affiche un état sobre, jamais une valeur inventée.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';
import type { CornerRecord } from '@/circuit/sessionInsights';

const C = theme.dataColors;
// Médiane = série de RÉFÉRENCE → crème atténuée (distincte de la variation crème).
const MEDIAN_COLOR = theme.palette.creamMute;
// Faisceau/marqueur de variation = série PRINCIPALE → crème (neutralise l'ambre pilote).
const VARIATION_COLOR = theme.palette.cream;

// Décor schématique (faisceau générique + traces + médiane). Aucune valeur n'en
// est lue : c'est l'habillage cockpit, pas la donnée. Les chiffres affichés
// viennent tous de la tranche `dispersion` (canon « valeur = source réelle »).
const BEAM_PATH =
  'M70,205 C40,150 45,95 95,70 C140,48 150,80 175,95 C205,113 250,95 270,130 C288,162 250,200 200,200 C150,200 120,210 70,205 Z';
const MEDIAN_PATH =
  'M70,205 C40,150 45,95 95,70 C140,48 150,80 175,95 C205,113 250,95 270,130 C288,162 250,200 200,200 C150,200 120,210 70,205';
const TRACE_PATHS = [
  'M70,204 C41,150 46,96 96,71 C141,49 151,81 176,96 C206,114 250,96 269,130 C287,161 250,199 200,199 C150,199 120,209 70,204',
  'M70,206 C40,150 44,94 94,69 C138,46 148,77 178,92 C207,111 251,94 271,131 C289,163 251,201 201,201 C151,201 121,211 70,206',
  'M71,205 C42,151 47,97 97,72 C144,52 156,86 173,99 C204,116 249,97 268,129 C286,160 249,198 199,198 C149,198 119,208 71,205',
  'M69,205 C39,149 43,95 93,70 C135,44 143,73 181,89 C209,109 252,95 270,130 C288,162 250,200 200,200 C150,200 120,210 69,205',
  'M70,205 C41,150 45,95 95,70 C140,48 160,90 170,101 C202,117 250,96 269,130 C287,161 250,199 200,199 C150,199 120,209 70,205',
];

export interface DispersionVizProps {
  /**
   * Dispersion réelle par virage : écart-type latéral en mètres, clés
   * « corner_1 », « corner_2 »… `null` ou `{}` → état sobre (aucune fabrication).
   */
  dispersion: CornerRecord | null;
}

/** Décimal en français (virgule) — écart-type en m à une décimale. */
function frDec(n: number, decimals: number): string {
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
  if (ratio >= 0.999) return VARIATION_COLOR;
  if (ratio >= 0.4) return C.flow;
  return C.accel;
}

export function DispersionViz({ dispersion }: DispersionVizProps) {
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

  // Dérivation depuis la tranche réelle : un point (label + écart-type) par virage,
  // trié du plus dispersé (le moins reproductible) au plus serré.
  const rows = dispersion
    ? Object.entries(dispersion)
        .map(([key, meters]) => {
          const num = cornerNum(key);
          return { num, label: num !== null ? `V${num}` : key.toUpperCase(), meters };
        })
        .filter((r) => Number.isFinite(r.meters))
        .sort((a, b) => b.meters - a.meters)
    : [];

  // HONNÊTE-VIDE : sans virage exploitable, on ne fabrique ni faisceau ni barre.
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
    <View>
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

        {/* Faisceau schématique (décor) — aucune valeur n'en est lue. */}
        <Svg width="100%" height={236} viewBox="0 0 320 236">
          {/* Faisceau de variation (large à l'évasement). */}
          <Path
            d={BEAM_PATH}
            fill="none"
            stroke="rgba(245,245,247,0.10)"
            strokeWidth={22}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Les tours superposés (variations fines). */}
          {TRACE_PATHS.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(248,249,250,0.24)"
              strokeWidth={1}
              strokeLinejoin="round"
            />
          ))}
          {/* Trajectoire médiane (référence) — halo crème atténué puis trait net. */}
          <Path
            d={MEDIAN_PATH}
            fill="none"
            stroke={MEDIAN_COLOR}
            strokeWidth={5}
            opacity={0.16}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={MEDIAN_PATH}
            fill="none"
            stroke={MEDIAN_COLOR}
            strokeWidth={1.8}
            opacity={0.95}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Repère du virage le PLUS dispersé — halo crème (variation), valeur réelle. */}
          <Circle cx={150} cy={80} r={11} fill={VARIATION_COLOR} opacity={0.16} />
          <Circle
            cx={150}
            cy={80}
            r={5}
            fill="none"
            stroke={VARIATION_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <SvgText x={160} y={76} fontSize={9} fill={VARIATION_COLOR} fontFamily={theme.fonts.mono}>
            {worst.label} · {frDec(worst.meters, 1)} m
          </SvgText>
          {/* Repère du virage le plus serré (constance) — seulement s'il diffère. */}
          {rows.length > 1 && (
            <>
              <Circle
                cx={95}
                cy={70}
                r={4}
                fill="none"
                stroke={C.accel}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <SvgText x={20} y={58} fontSize={9} fill={C.accel} fontFamily={theme.fonts.mono}>
                {tight.label} · {frDec(tight.meters, 1)} m
              </SvgText>
            </>
          )}
          {/* Ligne start/finish. */}
          <Line
            x1={64}
            y1={200}
            x2={76}
            y2={210}
            stroke={theme.palette.creamMute}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>

        <View style={styles.legend}>
          <Legend color={MEDIAN_COLOR} label="Trajectoire médiane" />
          <Legend color="rgba(245,245,247,0.55)" label="Zone de variation" />
        </View>
      </View>

      {/* Dispersion par virage (écart-type latéral réel, barre relative au max). */}
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
  hero: { alignItems: 'center', marginBottom: theme.spacing.md },
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
