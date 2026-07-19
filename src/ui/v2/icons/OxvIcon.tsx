/**
 * OxvIcon — rendu du set d'icônes « instrument » V2 (lot L0, livrable 3).
 *
 * Grille 24×24, trait 1.5 aux terminaisons rondes, monochrome : la couleur
 * vient de la prop (`colors.text.hi` par défaut), jamais du registre.
 * `rec` est la seule icône pleine (fill), le reste est au trait. Le trait
 * reste proportionnel à la grille quel que soit `size` (viewBox fixe).
 */

import Svg, { Path } from 'react-native-svg';

import { colors } from '@/ui/v2/tokens';

import { OXV_FILLED_ICONS, OXV_ICONS, OxvIconName } from './registry';

export interface OxvIconProps {
  name: OxvIconName;
  size?: number;
  color?: string;
}

export function OxvIcon({ name, size = 24, color = colors.text.hi }: OxvIconProps) {
  const filled = OXV_FILLED_ICONS.includes(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {OXV_ICONS[name].map((d, i) => (
        <Path
          key={i}
          d={d}
          fill={filled ? color : 'none'}
          stroke={filled ? 'none' : color}
          strokeWidth={filled ? 0 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
