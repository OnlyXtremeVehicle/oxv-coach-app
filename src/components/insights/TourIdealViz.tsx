/**
 * TourIdealViz — Tour idéal composé (lecture N3.2).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N3-2_tour_ideal.html
 * Spec     : 02_moteur_insights.md §3.2.
 *
 * Assemble le meilleur micro-secteur de chaque tour en un « tour théorique »
 * (1:41.2, −1,6 s sous le meilleur tour réel), montre la provenance de chaque
 * secteur (barre composite), puis où se loge l'écart : 80 % dans le secteur 2.
 * Deux chronos en tête, barre de provenance, répartition du temps perdu.
 *
 * DÉMO : valeurs figées de la maquette (1:42.8 / 1:41.2 ; S2 80 %), telemetry_
 * frames vide jusqu'à Valence. Composant autonome, aucune télémétrie réelle.
 *
 * Doctrine : constate où le temps se loge (« 80 % en S2 »). Ne dit jamais d'y
 * travailler. Couleur QDI accélération (dimension de la lecture) ; le secteur
 * qui concentre la perte sort en trajectoire (rouge = là où ça coûte). Aucune
 * couleur heritage.
 */

import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';

const C = theme.dataColors;

// Deux chronos DÉMO (maquette N3-2).
const REAL_BEST = '1:42.8';
const IDEAL = '1:41.2';
const DELTA = '−1,6 s';

// Provenance de chaque secteur du tour idéal (largeur = part de tour).
interface Segment {
  sector: string;
  /** Tour d'où vient le meilleur secteur. */
  from: string;
  /** Part du tour (%) → largeur du segment. */
  width: number;
  color: string;
}
const SEGMENTS: Segment[] = [
  { sector: 'S1', from: 'tour 9', width: 31, color: C.accel },
  { sector: 'S2', from: 'tour 14', width: 38, color: C.brake },
  { sector: 'S3', from: 'tour 11', width: 31, color: C.accel },
];

// Répartition du temps perdu (où se loge l'écart de 1,6 s).
interface Lost {
  sector: string;
  /** Part de l'écart total (%) → largeur de barre. */
  pct: number;
  /** Libellé « % · s ». */
  label: string;
  color: string;
  /** Secteur dominant (la perte s'y concentre) → mis en avant. */
  hot: boolean;
}
const LOST: Lost[] = [
  { sector: 'S2', pct: 80, label: '80 % · 1,28 s', color: C.trajectory, hot: true },
  { sector: 'S1', pct: 13, label: '13 % · 0,21 s', color: C.flow, hot: false },
  { sector: 'S3', pct: 7, label: '7 % · 0,11 s', color: C.flow, hot: false },
];

export function TourIdealViz() {
  return (
    <View>
      {/* Deux chronos : meilleur tour réel vs tour idéal composé. */}
      <View style={styles.duo}>
        <View style={styles.chrono}>
          <Text style={styles.chronoKey}>Meilleur tour réel</Text>
          <Text style={styles.chronoVal}>{REAL_BEST}</Text>
        </View>
        <View style={[styles.chrono, styles.chronoIdeal]}>
          <Text style={styles.chronoKey}>Tour idéal composé</Text>
          <Text style={[styles.chronoVal, styles.chronoValIdeal]}>{IDEAL}</Text>
        </View>
      </View>
      <Text style={styles.delta}>
        En assemblant vos meilleurs secteurs : <Text style={styles.deltaEm}>{DELTA}</Text> sous
        votre meilleur tour réel
      </Text>

      {/* Barre composite : provenance de chaque secteur du tour idéal. */}
      <View style={styles.card}>
        <Text style={styles.cap}>Provenance de chaque secteur du tour idéal</Text>
        <View style={styles.secbar}>
          {SEGMENTS.map((s) => (
            <View key={s.sector} style={[styles.seg, { flex: s.width, backgroundColor: s.color }]}>
              <Text style={styles.segName}>{s.sector}</Text>
              <Text style={styles.segFrom}>{s.from}</Text>
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
              <View style={[styles.fill, { width: `${l.pct}%`, backgroundColor: l.color }]} />
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
  duo: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chrono: {
    flex: 1,
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  chronoIdeal: {
    borderColor: 'rgba(74,222,128,0.30)',
  },
  chronoKey: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.sm,
  },
  chronoVal: {
    fontFamily: theme.fonts.display,
    fontSize: 26,
    letterSpacing: -0.4,
    color: theme.palette.cream,
  },
  chronoValIdeal: {
    color: C.accel,
  },
  delta: {
    textAlign: 'center',
    fontFamily: theme.fonts.bodyLight,
    fontSize: 12,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  deltaEm: {
    fontFamily: theme.fonts.monoMedium,
    color: theme.palette.cream,
  },
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
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  secbar: {
    flexDirection: 'row',
    height: 42,
    borderRadius: theme.radius.sm,
    borderColor: theme.palette.line,
    borderWidth: 1,
    overflow: 'hidden',
  },
  seg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  segName: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 9,
    color: 'rgba(0,0,0,0.65)',
  },
  segFrom: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: 'rgba(0,0,0,0.75)',
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
  pct: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    width: 76,
    textAlign: 'right',
  },
});
