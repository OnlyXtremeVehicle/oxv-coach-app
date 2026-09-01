/**
 * FlowViz — Cohérence du flow (lecture N4.3), sur données RÉELLES.
 *
 * Spec : docs/architecture/A-FLOW-1_flowService_definition.md, validée le 19/07.
 *
 * Ce que la vue montre, et rien d'autre :
 *   1. la MESURE : jerk résiduel moyen, en g/s, nommée comme telle ;
 *      — à l'écran depuis le 26/08 : « brusquerie moyenne non expliquée par la
 *        trajectoire ». Même grandeur, même unité, mot du pilote (charte
 *        anti-jargon §02). Le code, lui, garde `jerk` : c'est le nom juste ;
 *   2. sa trace dans le temps ;
 *   3. sa distribution — où la variation d'accélération se concentre.
 *
 * Le résiduel est la part du jerk que la sévérité de trajectoire n'explique pas
 * (VERROU 2) : on décrit le geste INATTENDU, jamais le jerk absolu — sinon on
 * pénaliserait mécaniquement les pilotes rapides, ce qui serait un jugement
 * déguisé.
 *
 * Ce que la vue ne fait PAS, volontairement :
 *   - aucun score, aucune note, aucune échelle 0-100 : « 1,8 g/s » est un
 *     constat, « 78 » serait un verdict ;
 *   - aucun seuil, aucune case colorée : le seuil « fluide » n'a pas été décrété,
 *     il émergera des percentiles réels après la première séance dense ;
 *   - aucune corrélation douceur / vitesse. La version précédente affichait un
 *     nuage affirmant que le tour le plus fluide était le plus rapide, et un
 *     chrono héros de 1:42.8 : c'étaient des affirmations sur le pilotage que
 *     rien ne mesurait.
 *
 * Doctrine : crème neutre, l'or reste réservé au chrono et au record. Absence de
 * mesure = état vide dit, jamais un 0.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { theme } from '@/theme/v2';
import { cockpitPanel } from '@/components/insights/vizChrome';
import { jerkDistribution, meanResidualGPerS, type FlowPoint } from '@/services/flowLogic';

const CREAM = theme.palette.cream;
const TRACE_W = 320;
const TRACE_H = 120;
const HIST_W = 320;
const HIST_H = 90;

/** « 1,8 » — une mesure en g/s, à une décimale. */
function fmtGPerS(v: number): string {
  return v.toFixed(1).replace('.', ',');
}

/**
 * Trace du résiduel dans le temps, mise à l'échelle sur ce qui a été MESURÉ.
 * L'échelle est donc propre à la séance : deux séances ne se superposent pas, et
 * c'est voulu — une échelle commune inventerait une comparaison.
 */
function tracePoints(points: readonly FlowPoint[], maxResidual: number): string {
  if (points.length === 0 || maxResidual <= 0) return '';
  const first = points[0].elapsedMs;
  const span = points[points.length - 1].elapsedMs - first;
  if (span <= 0) return '';
  return points
    .map((p) => {
      const x = ((p.elapsedMs - first) / span) * TRACE_W;
      const y = TRACE_H - (p.jerkResidual / maxResidual) * TRACE_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function FlowViz({ points }: { points: readonly FlowPoint[] }) {
  const moyenne = meanResidualGPerS(points);

  /**
   * LE ZÉRO PLAT EST UNE ABSENCE, PAS UNE MESURE — corrigé le 01/09/2026.
   *
   * Le garde ci-dessous ne fermait que `null`. Or `meanResidualGPerS` rend un
   * NOMBRE dès qu'il reste un point lisible, et ce nombre vaut zéro quand tous
   * les résidus sont nuls. L'en-tête affichait alors « 0,0 g/s » — exactement la
   * lecture que le commentaire d'origine interdisait : une conduite parfaitement
   * continue, ce qu'aucune séance réelle n'est.
   *
   * Un résidu identiquement nul sur des milliers de points ne décrit pas un
   * pilotage, il décrit un canal qui n'a rien produit. On le dit donc au lieu de
   * le chiffrer. Un maximum strictement positif suffit à distinguer les deux :
   * dès qu'une seule transition ressort, la moyenne redevient une mesure, même
   * très petite.
   */
  const residuelMax = points.reduce((m, p) => (p.jerkResidual > m ? p.jerkResidual : m), 0);
  const platEtNul = moyenne === 0 && residuelMax === 0;

  if (points.length === 0 || moyenne === null || platEtNul) {
    return (
      <View style={styles.card}>
        <Text style={styles.statusLabel}>Cohérence du flow</Text>
        <Text style={styles.vide}>
          Pas encore de mesure pour cette séance. La brusquerie des transitions se calcule sur les
          trames enregistrées : elle apparaîtra dès qu’une séance en aura déposé.
        </Text>
      </View>
    );
  }

  const bins = jerkDistribution(points);
  const maxResidual = residuelMax;
  const maxCount = bins.reduce((m, b) => (b.count > m ? b.count : m), 0);
  const trace = tracePoints(points, maxResidual);
  const binW = bins.length > 0 ? HIST_W / bins.length : 0;

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.status}>
          <Text style={styles.statusLabel}>Cohérence du flow</Text>
          <Text style={styles.statusRight}>{`TRANSITIONS · ${points.length} POINTS`}</Text>
        </View>

        {/* La mesure, nommée. Pas un score : une grandeur avec son unité.
            « Jerk » → « transition plus ou moins brusque » (charte anti-jargon
            §02). Le mot technique reste partout où il n'est pas lu — le service
            `flowLogic`, les props, ce commentaire — et disparaît des deux
            étiquettes que le pilote lit en premier. Le sens ne bouge pas : c'est
            toujours la part de brusquerie que la trajectoire n'explique PAS. */}
        <View style={styles.hero}>
          <Text style={styles.heroNum}>{fmtGPerS(moyenne)}</Text>
          <Text style={styles.heroUnit}>g/s</Text>
        </View>
        <Text style={styles.heroLabel}>BRUSQUERIE MOYENNE NON EXPLIQUÉE PAR LA TRAJECTOIRE</Text>

        <Text style={styles.cap}>Sa trace au fil de la séance</Text>
        <Svg width="100%" height={TRACE_H + 10} viewBox={`0 0 ${TRACE_W} ${TRACE_H + 10}`}>
          <Line
            x1={0}
            y1={TRACE_H}
            x2={TRACE_W}
            y2={TRACE_H}
            stroke={theme.palette.line}
            strokeWidth={1}
          />
          {trace ? (
            <>
              <Polyline
                points={trace}
                fill="none"
                stroke={CREAM}
                strokeWidth={5}
                opacity={0.16}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Polyline
                points={trace}
                fill="none"
                stroke={CREAM}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          ) : null}
        </Svg>
        <Text style={styles.echelle}>{`sommet de l'échelle : ${fmtGPerS(maxResidual)} g/s`}</Text>
      </View>

      {bins.length > 0 && maxCount > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cap}>Où la variation se concentre</Text>
          <Svg width="100%" height={HIST_H + 10} viewBox={`0 0 ${HIST_W} ${HIST_H + 10}`}>
            {bins.map((b, i) => {
              const h = (b.count / maxCount) * HIST_H;
              return (
                <Rect
                  key={b.binStart}
                  x={i * binW + 1}
                  y={HIST_H - h}
                  width={Math.max(1, binW - 2)}
                  height={h}
                  fill={CREAM}
                  opacity={0.55}
                />
              );
            })}
            <Line
              x1={0}
              y1={HIST_H}
              x2={HIST_W}
              y2={HIST_H}
              stroke={theme.palette.line}
              strokeWidth={1}
            />
          </Svg>
          <Text style={styles.echelle}>
            {`de 0 à ${fmtGPerS(bins[bins.length - 1].binStart)} g/s · effectifs bruts`}
          </Text>
        </View>
      ) : null}

      <Text style={styles.hint}>
        Une mesure, pas une note. Aucun seuil ne dit ce qui serait « fluide » : il émergera des
        séances réelles.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cockpitPanel,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
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
  statusLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
  },
  statusRight: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    color: theme.palette.creamMute,
  },
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroNum: {
    fontFamily: theme.fonts.mono,
    fontSize: 40,
    color: theme.palette.cream,
  },
  heroUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  heroLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  cap: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xs,
  },
  echelle: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  vide: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
});
