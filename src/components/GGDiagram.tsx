/**
 * GGDiagram — diagramme g-g (« cercle d'amitié »).
 *
 * Affiche la signature d'engagement d'un pilote : nuage de points
 * {gLat, gLong} sur fond de cercle théorique d'adhérence. Un pilote
 * pro remplit la totalité du cercle (toutes combinaisons accel+freinage
 * + appui latéral exploitées), un amateur laisse des zones vides.
 *
 * Lecture sobre :
 *   - Quadrants : N=freinage, S=accélération, E=virage droit, O=virage gauche
 *   - Cercles concentriques : 0.5 / 1.0 / 1.5 g (par défaut max 2.0 g)
 *   - Points colorés par la vitesse (heatmap discrète) ou uniformes
 *
 * Doctrine : pas de jugement « il manque ici, ajoutez là ». L'app montre
 * la forme, le pilote ou son coach interprètent.
 */

import { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export interface GGPoint {
  /** g latéral (positif = droite, négatif = gauche). */
  gLat: number;
  /** g longitudinal (positif = accélération, négatif = freinage). */
  gLong: number;
  /** Vitesse km/h, optionnelle, pour colorer le point. */
  speedKmh?: number | null;
}

export interface GGDiagramProps {
  points: GGPoint[];
  /** Échelle max en g (rayon). Par défaut 2.0. */
  scaleMaxG?: number;
  /** Hauteur du composant en pixels. Carré, largeur = hauteur. */
  size?: number;
  /** Vitesse max attendue pour calibrer le heatmap. Par défaut 250. */
  speedMaxKmh?: number;
  /** Affiche les labels cardinaux (FREIN/GAUCHE/DROITE/ACCEL). Par défaut true. */
  showLabels?: boolean;
}

export function GGDiagram({
  points,
  scaleMaxG = 2.0,
  size = 280,
  speedMaxKmh = 250,
  showLabels = true,
}: GGDiagramProps) {
  // viewBox centré sur 0,0 avec scaleMaxG comme demi-côté + une marge
  const margin = 1.15;
  const half = scaleMaxG * margin;
  const viewBox = `${-half} ${-half} ${half * 2} ${half * 2}`;

  // Filtre les points hors-scale (rares mais sécurité) et calcule un alpha
  // basé sur la densité approximative (= nombre de points)
  const visiblePoints = useMemo(
    () =>
      points.filter(
        (p) => Math.abs(p.gLat) <= scaleMaxG * 1.1 && Math.abs(p.gLong) <= scaleMaxG * 1.1
      ),
    [points, scaleMaxG]
  );

  // Stats pour affichage en dessous
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
    <View>
      <Svg width={size} height={size} viewBox={viewBox} style={{ alignSelf: 'center' }}>
        {/* Quadrillage : axes */}
        <Line x1={-half} y1={0} x2={half} y2={0} stroke={colors.border.subtle} strokeWidth={0.01} />
        <Line x1={0} y1={-half} x2={0} y2={half} stroke={colors.border.subtle} strokeWidth={0.01} />

        {/* Cercles concentriques 0.5g, 1.0g, 1.5g */}
        {[0.5, 1.0, 1.5].map((r) =>
          r <= scaleMaxG ? (
            <Circle
              key={r}
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke={colors.border.subtle}
              strokeWidth={0.01}
              strokeDasharray="0.05 0.05"
            />
          ) : null
        )}

        {/* Cercle théorique max (limite enveloppe) */}
        <Circle
          cx={0}
          cy={0}
          r={scaleMaxG}
          fill="none"
          stroke={colors.text.tertiary}
          strokeWidth={0.02}
          opacity={0.5}
        />

        {/* Labels cardinaux */}
        {showLabels ? (
          <G>
            <SvgText
              x={0}
              y={-half + 0.15}
              fontSize={0.12}
              textAnchor="middle"
              fill={colors.text.tertiary}
              fontWeight="bold"
            >
              FREIN
            </SvgText>
            <SvgText
              x={0}
              y={half - 0.05}
              fontSize={0.12}
              textAnchor="middle"
              fill={colors.text.tertiary}
              fontWeight="bold"
            >
              ACCEL
            </SvgText>
            <SvgText
              x={-half + 0.15}
              y={0.04}
              fontSize={0.12}
              textAnchor="start"
              fill={colors.text.tertiary}
              fontWeight="bold"
            >
              G
            </SvgText>
            <SvgText
              x={half - 0.15}
              y={0.04}
              fontSize={0.12}
              textAnchor="end"
              fill={colors.text.tertiary}
              fontWeight="bold"
            >
              D
            </SvgText>
            {/* Repère 1g */}
            <SvgText x={0.05} y={-1.05} fontSize={0.08} fill={colors.text.tertiary} opacity={0.7}>
              1g
            </SvgText>
          </G>
        ) : null}

        {/* Points — note : Y inversé pour SVG (y positif = bas), donc on
            stocke (gLat, -gLong) pour que ACCEL = haut visuellement.
            En fait non : on veut FREIN en haut (convention apps coach),
            donc on stocke (gLat, gLong) tel quel. */}
        {visiblePoints.map((p, i) => {
          const color = colorForSpeed(p.speedKmh, speedMaxKmh);
          return (
            <Circle
              key={i}
              cx={p.gLat}
              cy={-p.gLong} // SVG Y inversé : -p.gLong = ACCEL en bas, FREIN en haut
              r={0.04}
              fill={color}
              opacity={0.55}
            />
          );
        })}
      </Svg>

      {/* Récap chiffré sobre */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginTop: spacing.lg,
          paddingHorizontal: spacing.md,
        }}
      >
        <Stat label="LAT MAX" value={maxLat > 0 ? `${maxLat.toFixed(2)} g` : '—'} />
        <Stat
          label="FREIN MAX"
          value={maxBraking < 0 ? `${Math.abs(maxBraking).toFixed(2)} g` : '—'}
        />
        <Stat label="ACCEL MAX" value={maxAccel > 0 ? `${maxAccel.toFixed(2)} g` : '—'} />
      </View>

      <Text
        style={[
          typography.caption,
          {
            color: colors.text.tertiary,
            textAlign: 'center',
            marginTop: spacing.md,
          },
        ]}
      >
        {visiblePoints.length} mesures · cercle = enveloppe d'adhérence
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={{
          fontSize: fontSize.eyebrow,
          color: colors.text.tertiary,
          letterSpacing: 2,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
          fontFamily: 'Menlo',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Heatmap de vitesse — bleu (lent) → blanc (médian) → rouge (rapide).
 * Si pas de vitesse, blanc neutre.
 */
function colorForSpeed(speed: number | null | undefined, maxKmh: number): string {
  if (speed === null || speed === undefined) return colors.text.tertiary;
  const t = Math.min(1, Math.max(0, speed / maxKmh));
  if (t < 0.33) return '#4A8FCC'; // bleu lent
  if (t < 0.66) return colors.text.primary; // blanc médian
  return colors.accent.red; // rouge rapide
}
