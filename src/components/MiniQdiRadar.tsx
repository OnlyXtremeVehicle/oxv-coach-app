/**
 * MiniQdiRadar — vignette pentagonale du style d'un MOIS (maquette §7.3,
 * « Votre style au fil des séances » : 3 mini-radars juxtaposés, le dernier
 * surligné). Constats juxtaposés, JAMAIS une courbe d'évolution.
 *
 * Rendu volontairement minimal : grille pentagonale + polygone du mois (trait
 * crème). Une branche absente est tirée au centre — rien n'est inventé.
 */

import { Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { QdiBranches } from '@/services/qdiLogic';
import { theme } from '@/theme/v2';

const { palette, spacing, radius, fonts } = theme;

const KEYS: (keyof QdiBranches)[] = [
  'trajectoire',
  'fluidite',
  'freinage',
  'acceleration',
  'regularite',
];

function points(size: number, values01: number[]): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  return values01
    .map((v, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / values01.length;
      return `${cx + Math.cos(angle) * r * v},${cy + Math.sin(angle) * r * v}`;
    })
    .join(' ');
}

export function MiniQdiRadar({
  label,
  branches,
  highlighted,
  size = 46,
}: {
  label: string;
  branches: QdiBranches;
  highlighted?: boolean;
  size?: number;
}) {
  const values = KEYS.map((k) => {
    const v = branches[k];
    return typeof v === 'number' ? Math.max(0, Math.min(100, v)) / 100 : 0;
  });
  return (
    <View
      accessibilityLabel={`Style de ${label}`}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: highlighted ? palette.edge : palette.line,
        backgroundColor: highlighted ? palette.card2 : 'transparent',
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* grille pentagonale (contour à 100 %) */}
        <Polygon
          points={points(
            size,
            KEYS.map(() => 1)
          )}
          fill="none"
          stroke={palette.line}
          strokeWidth={1}
        />
        {/* polygone du mois */}
        <Polygon
          points={points(size, values)}
          fill="rgba(245,245,247,0.08)"
          stroke={highlighted ? palette.cream : palette.creamMute}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </Svg>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: highlighted ? palette.cream : palette.faint,
          marginTop: spacing.sm,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
