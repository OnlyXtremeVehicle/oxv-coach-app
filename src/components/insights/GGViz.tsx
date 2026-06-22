/**
 * GGViz — Diagramme G-G / enveloppe d'adhérence (lecture N2.2).
 *
 * Maquette : docs/refonte-app/maquette_insight_gg_refondu.html
 * Spec     : 02_moteur_insights.md §2.2.
 *
 * Nuage de points (G longitudinal vs G latéral) sur fond de cercle théorique
 * d'adhérence. Le nuage DÉMO se concentre sur les axes purs (freiner OU
 * tourner) et se creuse dans le combiné — la signature décrite par la lecture.
 * Trois chiffres sous le graphe : latéral / freinage / combiné.
 *
 * Couleur QDI de la dimension (brake) pour le nuage. Aucune couleur heritage.
 * Le nuage est figé (déterministe), donc autonome et stable — pas de hasard,
 * pas de télémétrie réelle (telemetry_frames vide jusqu'à Valence).
 *
 * Doctrine : montre la forme de l'enveloppe. Ne dit jamais quoi corriger.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';

const C = theme.dataColors;

const CX = 120;
const CY = 120;
const R_MAX = 90; // rayon de l'enveloppe (≈ adhérence max).

/**
 * Génère un nuage DÉMO déterministe « axes purs » : sur chaque axe (haut/bas/
 * gauche/droite) une grappe dense près du bord ; dans les diagonales (combiné)
 * peu de points et proches du centre. Aucun Math.random → rendu stable.
 */
function buildPoints(): { x: number; y: number; r: number }[] {
  const pts: { x: number; y: number; r: number }[] = [];
  const total = 90;
  for (let i = 0; i < total; i++) {
    const theta = (i / total) * Math.PI * 2;
    // « axisness » : 1 sur les axes, 0 dans les diagonales.
    const axisness = Math.abs(Math.cos(2 * theta));
    // Densité : on saute la plupart des points hors-axe (combiné creux).
    const keep = 0.28 + 0.72 * axisness;
    if ((i * 0.6180339887) % 1 > keep) continue;
    // Rayon : grand sur l'axe, réduit dans le combiné.
    const rlim = R_MAX * (0.5 + 0.5 * axisness);
    // Position pseudo-déterministe dans [0.45..1] du rayon limite.
    const frac = 0.45 + 0.55 * ((i * 0.7548776662) % 1);
    const r = rlim * frac;
    pts.push({
      x: CX + r * Math.cos(theta),
      y: CY - r * Math.sin(theta),
      r: 1.9,
    });
  }
  return pts;
}

const POINTS = buildPoints();

const STATS = [
  { label: 'Latéral', value: '1,3', unit: 'g', weak: false },
  { label: 'Freinage', value: '1,1', unit: 'g', weak: false },
  { label: 'Combiné', value: '0,7', unit: 'g', weak: true },
];

export function GGViz() {
  return (
    <View>
      <View style={styles.graph}>
        <Svg width="100%" height={240} viewBox="0 0 240 240" style={styles.svg}>
          {/* Enveloppe théorique (cercle pointillé neutre, pas de heritage). */}
          <Circle
            cx={CX}
            cy={CY}
            r={R_MAX + 2}
            fill="none"
            stroke={theme.palette.creamMute}
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.4}
          />
          <Circle cx={CX} cy={CY} r={46} fill="none" stroke={theme.palette.line} strokeWidth={1} />
          <Line x1={CX} y1={20} x2={CX} y2={220} stroke={theme.palette.line} strokeWidth={1} />
          <Line x1={20} y1={CY} x2={220} y2={CY} stroke={theme.palette.line} strokeWidth={1} />

          {/* Nuage de points — couleur QDI de la dimension. */}
          <G>
            {POINTS.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={C.brake} opacity={0.5} />
            ))}
          </G>

          {/* Axes nommés (mono faint). */}
          <SvgText
            x={CX}
            y={14}
            fill={theme.palette.faint}
            fontFamily={theme.fonts.mono}
            fontSize={9}
            textAnchor="middle"
          >
            FREINAGE
          </SvgText>
          <SvgText
            x={CX}
            y={234}
            fill={theme.palette.faint}
            fontFamily={theme.fonts.mono}
            fontSize={9}
            textAnchor="middle"
          >
            TRACTION
          </SvgText>
          <SvgText
            x={8}
            y={124}
            fill={theme.palette.faint}
            fontFamily={theme.fonts.mono}
            fontSize={9}
            textAnchor="middle"
          >
            G
          </SvgText>
          <SvgText
            x={232}
            y={124}
            fill={theme.palette.faint}
            fontFamily={theme.fonts.mono}
            fontSize={9}
            textAnchor="middle"
          >
            D
          </SvgText>
        </Svg>
        <Text style={styles.cap}>Accélérations mesurées · 42 tours</Text>
      </View>

      <View style={styles.stats}>
        {STATS.map((st) => (
          <View key={st.label} style={styles.stat}>
            <Text style={styles.statLabel}>{st.label}</Text>
            <Text style={[styles.statValue, st.weak && styles.statWeak]}>
              {st.value}
              <Text style={styles.statUnit}> {st.unit}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  graph: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  svg: {
    alignSelf: 'center',
    maxWidth: 280,
  },
  cap: {
    textAlign: 'center',
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.palette.line,
  },
  statLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  statValue: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 21,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  statWeak: {
    color: C.brake,
  },
  statUnit: {
    fontSize: 12,
    color: theme.palette.creamMute,
  },
});
