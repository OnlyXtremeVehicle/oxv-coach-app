/**
 * RadarEmpreinte — la silhouette de pilotage sur 5 axes factuels (maquette 20.2).
 *
 * « Empreinte, PAS score. » Une forme dérivée de mesures réelles (Cap, Visée,
 * Plongée, Trajectoire, Anticipation), jamais une note ni un idéal à atteindre.
 * Grille neutre (filets), liseré OR = donnée. Un axe sans donnée n'est jamais
 * inventé : il est marqué « donnée à venir » et la silhouette n'est tracée que
 * lorsqu'elle est complète. Doctrine : un seul visuel dominant, descriptif,
 * aucune zone cible, vouvoiement, pas d'emoji.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import type { SignatureAxis } from '@/services/pilotSignatureService';
import { theme } from '@/theme/v2';

const GOLD = theme.palette.gold;
const VB = 240;
const CX = 120;
const CY = 120;
const R = 88;

// Anchor + décalage vertical du libellé selon la position de l'axe (haut → milieu…).
const LABEL = [
  { anchor: 'middle' as const, dy: -4 }, // Cap (haut)
  { anchor: 'start' as const, dy: 2 }, // Visée (haut-droite)
  { anchor: 'start' as const, dy: 11 }, // Plongée (bas-droite)
  { anchor: 'end' as const, dy: 11 }, // Trajectoire (bas-gauche)
  { anchor: 'end' as const, dy: 2 }, // Anticipation (haut-gauche)
];

function pt(i: number, frac: number): { x: number; y: number } {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return { x: CX + R * frac * Math.cos(a), y: CY + R * frac * Math.sin(a) };
}

function gridPoints(frac: number): string {
  return [0, 1, 2, 3, 4]
    .map((i) => {
      const p = pt(i, frac);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
}

export function RadarEmpreinte({ axes }: { axes: SignatureAxis[] }) {
  const complete = axes.length === 5 && axes.every((a) => a.value !== null);
  const empreinte = complete
    ? axes
        .map((a, i) => {
          const p = pt(i, a.value as number);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(' ')
    : null;
  const missing = axes.filter((a) => a.value === null).map((a) => a.label.toLowerCase());

  return (
    <View style={styles.wrap}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Votre empreinte</Text>
        <Text style={styles.statusRight}>5 AXES FACTUELS</Text>
      </View>

      <View style={styles.radarWrap}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB} ${VB}`}>
          {/* Grille : 3 pentagones concentriques (filets neutres). */}
          {[0.34, 0.67, 1].map((f) => (
            <Polygon
              key={f}
              points={gridPoints(f)}
              fill="none"
              stroke={theme.palette.line}
              strokeWidth={1}
            />
          ))}
          {/* Rayons. */}
          {[0, 1, 2, 3, 4].map((i) => {
            const p = pt(i, 1);
            return (
              <Line
                key={i}
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
                stroke={theme.palette.line}
                strokeWidth={1}
              />
            );
          })}
          {/* Empreinte (or = donnée), tracée seulement si complète. */}
          {empreinte ? (
            <Polygon
              points={empreinte}
              fill="rgba(255,183,3,0.10)"
              stroke={GOLD}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          ) : null}
          {/* Sommets présents : points or. */}
          {axes.map((a, i) => {
            if (a.value === null) return null;
            const p = pt(i, a.value);
            return <Circle key={a.key} cx={p.x} cy={p.y} r={2.6} fill={GOLD} />;
          })}
          {/* Libellés des axes (mono faint). */}
          {axes.map((a, i) => {
            const p = pt(i, 1.16);
            const cfg = LABEL[i] ?? LABEL[0];
            return (
              <SvgText
                key={a.key}
                x={p.x}
                y={p.y + cfg.dy}
                fill={theme.palette.faint}
                fontFamily={theme.fonts.mono}
                fontSize={9}
                textAnchor={cfg.anchor}
              >
                {a.label.toUpperCase()}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      {/* Légende : la mesure réelle adossée à chaque axe (transparence). */}
      <View style={styles.legend}>
        {axes.map((a) => (
          <View key={a.key} style={styles.legendRow}>
            <Text style={styles.legendLabel}>{a.label}</Text>
            <Text style={[styles.legendVal, a.value === null && styles.legendMute]}>
              {a.detail ?? 'donnée à venir'}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        {complete
          ? 'Une silhouette, pas une note. Votre forme, telle que mesurée.'
          : `La silhouette se trace quand tous les axes ont une mesure${
              missing.length ? ` (manque : ${missing.join(', ')})` : ''
            }.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.palette.card2,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.palette.line,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
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
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  radarWrap: {
    width: VB,
    maxWidth: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
  },
  legend: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.md,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  legendLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  legendVal: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  legendMute: {
    color: theme.palette.faint,
  },
  note: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic',
    color: theme.palette.creamMute,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
});
