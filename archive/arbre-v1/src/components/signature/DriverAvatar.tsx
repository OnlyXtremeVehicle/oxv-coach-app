/**
 * DriverAvatar — emblème d'identité DÉRIVÉ de la signature (PR-64).
 *
 * Une « empreinte digitale » : 5 rayons dont la longueur reflète les axes de la
 * signature (cap, visée, plongée, trajectoire, anticipation). Déterministe et
 * factuel — deux pilotes au pilotage différent ont un emblème différent. Or =
 * donnée. Aucune note, aucun rang : juste une identité visuelle. Zéro schéma.
 */

import Svg, { Circle, Line } from 'react-native-svg';

import type { SignatureAxis } from '@/services/pilotSignatureService';
import { theme } from '@/theme/v2';

export function DriverAvatar({ axes, size = 56 }: { axes: SignatureAxis[]; size?: number }) {
  const c = size / 2;
  const rInner = size * 0.14;
  const rOuter = size * 0.42;
  // Valeur neutre 0.4 quand un axe n'a pas de donnée (jamais inventée à 0 ni à 1).
  const vals = (axes.length ? axes : Array.from({ length: 5 })).map((a) => {
    const v = (a as SignatureAxis | undefined)?.value;
    return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.4;
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={c}
        cy={c}
        r={rOuter + 1.5}
        stroke={theme.palette.line}
        strokeWidth={1}
        fill={theme.palette.card2}
      />
      <Circle cx={c} cy={c} r={rInner * 0.5} fill={theme.palette.gold} opacity={0.9} />
      {vals.slice(0, 5).map((v, i) => {
        const ang = ((-90 + i * 72) * Math.PI) / 180;
        const len = rInner + (rOuter - rInner) * v;
        return (
          <Line
            key={i}
            x1={c + Math.cos(ang) * rInner * 0.6}
            y1={c + Math.sin(ang) * rInner * 0.6}
            x2={c + Math.cos(ang) * len}
            y2={c + Math.sin(ang) * len}
            stroke={theme.palette.gold}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
    </Svg>
  );
}
