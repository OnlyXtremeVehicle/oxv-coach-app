/**
 * QdiRadar — LE radar de l'app (refonte V3, handoff §7.3 « Signature/QDI »).
 *
 * 5 branches (Trajectoire · Fluidité · Freinage · Accélération · Régularité),
 * valeurs 0-100 (qdiLogic déterministe). Système couleur QDI : chaque branche a
 * SA couleur (trajectoire bleu · fluidité jaune · freinage rouge · accélération
 * vert · régularité violet), utilisée sur l'axe teinté, le sommet et le libellé.
 *
 * - polygone SÉANCE : trait BLANC `#F5F5F7`, un point de la couleur de la branche
 *   à chaque sommet.
 * - polygone EMPREINTE (self-only) : pointillé neutre `#54545C` = la médiane de
 *   VOS dernières sessions — jamais un autre pilote.
 * Une branche null (données insuffisantes) est « — », tirée au centre, honnête.
 * JAMAIS un score unique (QDI reste 5 branches). `detail` affiche la valeur.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import type { QdiBranches } from '@/services/qdiLogic';
import { theme } from '@/theme/v2';

const { dataColors, palette } = theme;

const BRANCHES: { key: keyof QdiBranches; label: string; color: string }[] = [
  { key: 'trajectoire', label: 'Trajectoire', color: dataColors.trajectory },
  { key: 'fluidite', label: 'Fluidité', color: dataColors.flow },
  { key: 'freinage', label: 'Freinage', color: dataColors.brake },
  { key: 'acceleration', label: 'Accélération', color: dataColors.accel },
  { key: 'regularite', label: 'Régularité', color: dataColors.regularity },
];

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2 + 6;
const R = 104;

/** Annotation courte optionnelle près d'une branche (ex. « votre point fort »). */
export type QdiAnnotations = Partial<Record<keyof QdiBranches, string>>;

function point(index: number, value01: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / BRANCHES.length;
  return { x: CX + Math.cos(angle) * R * value01, y: CY + Math.sin(angle) * R * value01 };
}

function polygonPoints(values: (number | null)[]): string {
  return values
    .map((v, i) => {
      const p = point(i, (v ?? 0) / 100);
      return `${p.x},${p.y}`;
    })
    .join(' ');
}

export function QdiRadar({
  current,
  reference,
  referenceSessions,
  detail,
  annotations,
}: {
  current: QdiBranches;
  reference?: QdiBranches | null;
  referenceSessions?: number;
  detail: boolean;
  annotations?: QdiAnnotations;
}) {
  const currentValues = BRANCHES.map((b) => current[b.key]);
  const referenceValues = reference ? BRANCHES.map((b) => reference[b.key]) : null;
  const hasReference =
    referenceValues !== null && referenceValues.some((v) => typeof v === 'number');
  const hasAnyValue = currentValues.some((v) => typeof v === 'number');

  return (
    <View accessibilityLabel="Radar QDI cinq branches, comparé à votre propre historique">
      <Svg width="100%" height={SIZE + 8} viewBox={`0 0 ${SIZE} ${SIZE + 8}`}>
        {/* Grille : anneaux 25/50/75/100 */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Polygon
            key={f}
            points={polygonPoints(BRANCHES.map(() => f * 100))}
            fill="none"
            stroke={palette.line}
            strokeWidth={1}
          />
        ))}

        {/* Axes teintés dans la couleur de chaque branche (35 %). */}
        {BRANCHES.map((b, i) => {
          const tip = point(i, 1);
          return (
            <Line
              key={`ax-${b.key}`}
              x1={CX}
              y1={CY}
              x2={tip.x}
              y2={tip.y}
              stroke={b.color}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          );
        })}

        {/* Empreinte self-only (médiane de vos sessions) — pointillé neutre */}
        {hasReference ? (
          <Polygon
            points={polygonPoints(referenceValues)}
            fill="none"
            stroke={palette.faint}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ) : null}

        {/* Séance courante — trait BLANC (la couleur vit sur les sommets) */}
        {hasAnyValue ? (
          <Polygon
            points={polygonPoints(currentValues)}
            fill="rgba(245,245,247,0.06)"
            stroke={palette.cream}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : null}

        {/* Sommets colorés + libellés colorés (+ valeur si detail) */}
        {BRANCHES.map((b, i) => {
          const tip = point(i, 1.18);
          const v = current[b.key];
          const dot = point(i, (v ?? 0) / 100);
          return (
            <React.Fragment key={b.key}>
              {typeof v === 'number' ? (
                <Circle cx={dot.x} cy={dot.y} r={3.5} fill={b.color} />
              ) : null}
              <SvgText
                x={tip.x}
                y={tip.y - (detail ? 5 : 0)}
                fill={b.color}
                fontSize={10.5}
                fontFamily={theme.fonts.mono}
                textAnchor="middle"
              >
                {b.label.toUpperCase()}
              </SvgText>
              {detail ? (
                <SvgText
                  x={tip.x}
                  y={tip.y + 10}
                  fill={typeof v === 'number' ? b.color : palette.faint}
                  fontSize={12}
                  fontFamily={theme.fonts.mono}
                  textAnchor="middle"
                >
                  {typeof v === 'number' ? String(v) : '—'}
                </SvgText>
              ) : null}
              {annotations?.[b.key] ? (
                <SvgText
                  x={tip.x}
                  y={tip.y + (detail ? 22 : 12)}
                  fill={palette.creamMute}
                  fontSize={8.5}
                  fontFamily={theme.fonts.body}
                  textAnchor="middle"
                >
                  {annotations[b.key]}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>

      <Text style={legendStyle}>
        {hasReference
          ? `Trait plein : cette séance. Pointillé : la médiane de vos ${referenceSessions ?? ''} dernières séances.`
          : 'Votre première lecture ici : la référence se construira au fil de vos séances.'}
      </Text>
      {currentValues.some((v) => v === null) ? (
        <Text style={legendStyle}>
          Une branche sans valeur manque de données pour être mesurée — rien n'est inventé.
        </Text>
      ) : null}
    </View>
  );
}

const legendStyle = {
  fontFamily: theme.fonts.body,
  fontSize: theme.fontSize.small,
  color: palette.creamMute,
  lineHeight: theme.fontSize.small * 1.5,
  textAlign: 'center' as const,
  marginTop: theme.spacing.sm,
};
