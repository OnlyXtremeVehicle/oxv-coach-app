/**
 * QdiRadar — LE radar de l'app (Lot M1, décision fondateur 2026-07-04).
 *
 * 5 branches (Trajectoire · Fluidité · Freinage · Accélération · Régularité),
 * valeurs 0-100 calculées par qdiLogic (déterministe, algo_version). Absorbe
 * l'ancienne empreinte signature : une seule vérité radar côté pilote.
 *
 * Self-only : le polygone de référence (pointillé neutre) est la médiane des
 * dernières sessions DU PILOTE — jamais un autre pilote. Une branche null
 * (données insuffisantes) est affichée « — » et tirée au centre, avec la
 * légende honnête. Or = donnée (trait courant) ; jamais de rouge de marque.
 *
 * `detail` (Signature/Heritage) affiche la valeur par branche ; Access = forme
 * seule (prompt v2).
 */

import { Text, View } from 'react-native';
import Svg, { Circle, Polygon, Text as SvgText } from 'react-native-svg';

import type { QdiBranches } from '@/services/qdiLogic';
import { theme } from '@/theme/v2';

const BRANCHES: { key: keyof QdiBranches; label: string; color: string }[] = [
  { key: 'trajectoire', label: 'Trajectoire', color: theme.palette.pilotAmber },
  { key: 'fluidite', label: 'Fluidité', color: theme.dataColors.flow },
  { key: 'freinage', label: 'Freinage', color: theme.dataColors.brake },
  { key: 'acceleration', label: 'Accélération', color: theme.palette.green },
  { key: 'regularite', label: 'Régularité', color: theme.dataColors.regularity },
];

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2 + 6;
const R = 104;

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
}: {
  current: QdiBranches;
  reference?: QdiBranches | null;
  referenceSessions?: number;
  detail: boolean;
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
            stroke={theme.palette.line}
            strokeWidth={1}
          />
        ))}

        {/* Référence self-only (médiane de vos sessions) */}
        {hasReference ? (
          <Polygon
            points={polygonPoints(referenceValues)}
            fill="none"
            stroke={theme.palette.creamMute}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ) : null}

        {/* Session courante — or = donnée */}
        {hasAnyValue ? (
          <Polygon
            points={polygonPoints(currentValues)}
            fill="rgba(255,183,3,0.10)"
            stroke={theme.palette.gold}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : null}

        {/* Sommets + libellés */}
        {BRANCHES.map((b, i) => {
          const tip = point(i, 1.18);
          const v = current[b.key];
          const dot = point(i, (v ?? 0) / 100);
          return (
            <>
              {typeof v === 'number' ? (
                <Circle key={`d-${b.key}`} cx={dot.x} cy={dot.y} r={3} fill={theme.palette.gold} />
              ) : null}
              <SvgText
                key={`l-${b.key}`}
                x={tip.x}
                y={tip.y - (detail ? 5 : 0)}
                fill={theme.palette.creamSoft}
                fontSize={11}
                fontFamily={theme.fonts.mono}
                textAnchor="middle"
              >
                {b.label.toUpperCase()}
              </SvgText>
              {detail ? (
                <SvgText
                  key={`v-${b.key}`}
                  x={tip.x}
                  y={tip.y + 10}
                  fill={typeof v === 'number' ? b.color : theme.palette.faint}
                  fontSize={12}
                  fontFamily={theme.fonts.mono}
                  textAnchor="middle"
                >
                  {typeof v === 'number' ? String(v) : '—'}
                </SvgText>
              ) : null}
            </>
          );
        })}
      </Svg>

      <Text style={legendStyle}>
        {hasReference
          ? `Trait plein : cette session. Pointillé : la médiane de vos ${referenceSessions ?? ''} dernières sessions.`
          : 'Votre première lecture ici : la référence se construira au fil de vos sessions.'}
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
  color: theme.palette.creamMute,
  lineHeight: theme.fontSize.small * 1.5,
  textAlign: 'center' as const,
  marginTop: theme.spacing.sm,
};
