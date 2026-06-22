/**
 * DispersionViz — Dispersion de trajectoire par virage (lecture N3.1).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N3-1_dispersion.html
 * Spec     : 02_moteur_insights.md §3.1.
 *
 * Superpose les tours d'une séance : là où le faisceau s'évase, la trajectoire
 * change d'un tour à l'autre. Tracé (médiane + variations + halo large au V4)
 * en SVG, puis barres de dispersion par virage (écart-type latéral, en mètres).
 *
 * DÉMO : faisceau et valeurs figés (V4 1,8 m … V1 0,3 m), telemetry_frames vide
 * jusqu'à Valence. Composant autonome, aucune télémétrie réelle.
 *
 * Doctrine : montre où la ligne hésite. Ne demande jamais d'être plus régulier.
 * Couleur QDI trajectoire (#E63946) pour la dispersion élevée, accel pour la
 * constance. Aucune couleur heritage.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';

const C = theme.dataColors;

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
  { corner: 'V4', meters: 1.8, color: C.trajectory },
  { corner: 'V7', meters: 1.2, color: C.flow },
  { corner: 'V2', meters: 0.7, color: C.flow },
  { corner: 'V5', meters: 0.5, color: C.accel },
  { corner: 'V1', meters: 0.3, color: C.accel },
];
const MAX_M = 1.8;

export function DispersionViz() {
  return (
    <View>
      <View style={styles.card}>
        <View style={styles.cap}>
          <Text style={styles.capText}>18 tours superposés</Text>
          <Text style={[styles.capText, { color: C.trajectory }]}>écart max 1,8 m</Text>
        </View>

        <Svg width="100%" height={240} viewBox="0 0 320 240">
          {/* Halo de dispersion (large au V4). */}
          <Path
            d="M70,205 C40,150 45,95 95,70 C140,48 150,80 175,95 C205,113 250,95 270,130 C288,162 250,200 200,200 C150,200 120,210 70,205 Z"
            fill="none"
            stroke="rgba(230,57,70,0.10)"
            strokeWidth={22}
            strokeLinecap="round"
          />
          {/* Les tours superposés (variations fines). */}
          {TRACES.map((d, i) => (
            <Path key={i} d={d} fill="none" stroke="rgba(248,249,250,0.30)" strokeWidth={1} />
          ))}
          {/* Trajectoire médiane nette. */}
          <Path
            d={MEDIAN}
            fill="none"
            stroke={theme.palette.cream}
            strokeWidth={1.6}
            opacity={0.85}
          />
          {/* Marqueur V4 (dispersion large). */}
          <Circle cx={150} cy={80} r={5} fill="none" stroke={C.trajectory} strokeWidth={2} />
          <SvgText x={158} y={76} fontSize={9} fill={C.trajectory} fontFamily={theme.fonts.mono}>
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
          <Legend color={theme.palette.cream} label="Trajectoire médiane" />
          <Legend color="rgba(230,57,70,0.55)" label="Zone de variation" />
        </View>
      </View>

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
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  capText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  legend: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.line,
  },
  legw: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  sw: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  legwText: {
    fontFamily: theme.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  bars: {
    marginBottom: theme.spacing.xs,
  },
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
  barFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },
  barVal: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.palette.creamMute,
    width: 46,
    textAlign: 'right',
  },
});
