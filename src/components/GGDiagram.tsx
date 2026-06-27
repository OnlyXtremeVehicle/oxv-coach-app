/**
 * GGDiagram — diagramme g-g (« cercle d'amitié »). Transposition gaming.
 *
 * Affiche la signature d'engagement d'un pilote : nuage de points
 * {gLat, gLong} sur fond de cercle théorique d'adhérence. Un pilote
 * pro remplit la totalité du cercle (toutes combinaisons accel+freinage
 * + appui latéral exploitées), un amateur laisse des zones vides.
 *
 * Cockpit factuel : nuage en OR (la donnée), anneau d'adhérence tireté
 * doré à halo, stats en or. AUCUN code-couleur de performance (pas de
 * heatmap rouge « vite = rouge » : le rouge est réservé marque + coach).
 *
 * Doctrine : pas de jugement « il manque ici, ajoutez là ». L'app montre
 * la forme, le pilote ou son coach interprètent.
 */

import { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { cockpitPanel } from '@/components/insights/vizChrome';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing } = theme;
const GOLD = palette.gold;

export interface GGPoint {
  /** g latéral (positif = droite, négatif = gauche). */
  gLat: number;
  /** g longitudinal (positif = accélération, négatif = freinage). */
  gLong: number;
  /** Vitesse km/h, optionnelle (non utilisée pour la couleur — cockpit factuel). */
  speedKmh?: number | null;
}

export interface GGDiagramProps {
  points: GGPoint[];
  /** Échelle max en g (rayon). Par défaut 2.0. */
  scaleMaxG?: number;
  /** Hauteur du composant en pixels. Carré, largeur = hauteur. */
  size?: number;
  /** Conservé pour compat de signature (non utilisé — plus de heatmap vitesse). */
  speedMaxKmh?: number;
  /** Affiche les labels cardinaux (FREIN/GAUCHE/DROITE/ACCEL). Par défaut true. */
  showLabels?: boolean;
}

export function GGDiagram({
  points,
  scaleMaxG = 2.0,
  size = 280,
  showLabels = true,
}: GGDiagramProps) {
  const margin = 1.15;
  const half = scaleMaxG * margin;
  const viewBox = `${-half} ${-half} ${half * 2} ${half * 2}`;

  const visiblePoints = useMemo(
    () =>
      points.filter(
        (p) => Math.abs(p.gLat) <= scaleMaxG * 1.1 && Math.abs(p.gLong) <= scaleMaxG * 1.1
      ),
    [points, scaleMaxG]
  );

  const maxLat = useMemo(
    () => visiblePoints.reduce((m, p) => Math.max(m, Math.abs(p.gLat)), 0),
    [visiblePoints]
  );
  const maxBraking = useMemo(
    () => visiblePoints.reduce((m, p) => Math.min(m, p.gLong), 0),
    [visiblePoints]
  );
  const maxAccel = useMemo(
    () => visiblePoints.reduce((m, p) => Math.max(m, p.gLong), 0),
    [visiblePoints]
  );

  return (
    <View style={s.panel}>
      <View style={s.status}>
        <View style={s.dot} />
        <Text style={s.statusLabel}>
          {visiblePoints.length} mesures · enveloppe d&apos;adhérence
        </Text>
      </View>

      <Svg width={size} height={size} viewBox={viewBox} style={{ alignSelf: 'center' }}>
        {/* Axes */}
        <Line x1={-half} y1={0} x2={half} y2={0} stroke={palette.line} strokeWidth={0.012} />
        <Line x1={0} y1={-half} x2={0} y2={half} stroke={palette.line} strokeWidth={0.012} />

        {/* Cercles concentriques 0.5 / 1.0 / 1.5 g */}
        {[0.5, 1.0, 1.5].map((r) =>
          r <= scaleMaxG ? (
            <Circle
              key={r}
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke={palette.line}
              strokeWidth={0.012}
              strokeDasharray="0.05 0.05"
              strokeLinecap="round"
            />
          ) : null
        )}

        {/* Anneau d'adhérence : halo doré large + tracé net tireté */}
        <Circle
          cx={0}
          cy={0}
          r={scaleMaxG}
          fill="none"
          stroke={GOLD}
          strokeWidth={0.05}
          opacity={0.16}
        />
        <Circle
          cx={0}
          cy={0}
          r={scaleMaxG}
          fill="none"
          stroke={GOLD}
          strokeWidth={0.02}
          opacity={0.6}
          strokeDasharray="0.08 0.06"
          strokeLinecap="round"
        />

        {/* Labels cardinaux */}
        {showLabels ? (
          <G>
            <SvgText
              x={0}
              y={-half + 0.15}
              fontSize={0.12}
              textAnchor="middle"
              fill={palette.creamMute}
              fontFamily={fonts.mono}
            >
              FREIN
            </SvgText>
            <SvgText
              x={0}
              y={half - 0.05}
              fontSize={0.12}
              textAnchor="middle"
              fill={palette.creamMute}
              fontFamily={fonts.mono}
            >
              ACCEL
            </SvgText>
            <SvgText
              x={-half + 0.15}
              y={0.04}
              fontSize={0.12}
              textAnchor="start"
              fill={palette.creamMute}
              fontFamily={fonts.mono}
            >
              G
            </SvgText>
            <SvgText
              x={half - 0.15}
              y={0.04}
              fontSize={0.12}
              textAnchor="end"
              fill={palette.creamMute}
              fontFamily={fonts.mono}
            >
              D
            </SvgText>
            <SvgText
              x={0.05}
              y={-1.05}
              fontSize={0.08}
              fill={palette.creamMute}
              opacity={0.7}
              fontFamily={fonts.mono}
            >
              1g
            </SvgText>
          </G>
        ) : null}

        {/* Nuage — OR uniforme (la donnée), Y inversé pour SVG (FREIN en haut) */}
        {visiblePoints.map((p, i) => (
          <Circle key={i} cx={p.gLat} cy={-p.gLong} r={0.04} fill={GOLD} opacity={0.5} />
        ))}
      </Svg>

      {/* Récap chiffré — valeurs en or */}
      <View style={s.statRow}>
        <Stat label="LAT MAX" value={maxLat > 0 ? `${maxLat.toFixed(2)} g` : '—'} />
        <Stat
          label="FREIN MAX"
          value={maxBraking < 0 ? `${Math.abs(maxBraking).toFixed(2)} g` : '—'}
        />
        <Stat label="ACCEL MAX" value={maxAccel > 0 ? `${maxAccel.toFixed(2)} g` : '—'} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = {
  panel: {
    ...cockpitPanel,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  status: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  statusLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: GOLD,
  },
  statRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    color: palette.creamMute,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    color: GOLD,
  },
};
