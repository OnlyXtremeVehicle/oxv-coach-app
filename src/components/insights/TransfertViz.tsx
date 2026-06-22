/**
 * TransfertViz — Transfert de charge / vitesse de mise en appui (lecture N4.5).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N4-5_transfert.html
 * Spec     : 02_moteur_insights.md §4.5.
 *
 * Pas combien de G, mais en combien de temps la masse se transfère. En entrée
 * de courbe, on lit la montée du G latéral (appui) et la vitesse de roulis
 * (gyro X) : le roulis est établi quand sa vitesse retombe à zéro. Au virage 3,
 * il se stabilise en 0,4 s ; au virage 9, en 0,7 s. Tracé + barres par virage.
 *
 * DÉMO : tracé et durées figés (V3 0,4 s … V9 0,7 s), telemetry_frames vide
 * jusqu'à Valence. Composant autonome, aucune télémétrie réelle.
 *
 * Doctrine : mesure la durée de mise en charge (constat). Ne dit jamais comment
 * attaquer l'appui. Couleur QDI accélération (dimension de la lecture) pour les
 * entrées progressives et la fenêtre ; bleu freinage pour l'appui, jaune
 * fluidité pour la vitesse de roulis. Aucune couleur heritage.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';

const C = theme.dataColors;

// Temps de prise de roulis par virage (entrée de courbe). Largeur ∝ durée.
interface Corner {
  corner: string;
  seconds: number;
  /** Libellé (« 0,4 s »). */
  label: string;
  color: string;
  /** Entrée remarquable (la plus progressive / la plus lente) → mise en avant. */
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
  return (
    <View>
      {/* Tracé V3 : montée du G latéral + vitesse de roulis, fenêtre 0,4 s. */}
      <View style={styles.card}>
        <View style={styles.cap}>
          <Text style={styles.capText}>Entrée virage 3 · prise de roulis</Text>
          <Text style={[styles.capText, { color: C.accel }]}>0,4 s</Text>
        </View>
        <Svg width="100%" height={130} viewBox="0 0 320 130">
          <Line x1={0} y1={100} x2={320} y2={100} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          {/* G latéral qui monte puis plafonne (appui). */}
          <Path
            d="M20,100 C60,98 80,60 120,44 C160,32 240,30 300,30"
            fill="none"
            stroke={C.brake}
            strokeWidth={2}
          />
          {/* Vitesse de roulis (gyro X) : pic puis retour à zéro = roulis établi. */}
          <Path
            d="M20,100 C50,98 70,42 95,40 C115,38 130,82 160,92 C200,99 240,99 300,99"
            fill="none"
            stroke={C.flow}
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
          <Line x1={70} y1={18} x2={160} y2={18} stroke={C.accel} strokeWidth={1} />
          <SvgText x={84} y={22} fill={C.accel} fontFamily={theme.fonts.mono} fontSize={8.5}>
            0,4 s
          </SvgText>
        </Svg>
        <View style={styles.legend}>
          <Legend color={C.brake} label="G latéral (appui)" />
          <Legend color={C.flow} label="Vitesse de roulis · gyro X" />
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
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  capText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
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
  fill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },
  val: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    width: 48,
    textAlign: 'right',
  },
});
