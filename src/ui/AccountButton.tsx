/**
 * AccountButton — accès au Compte, icône haut-droite des écrans racines.
 *
 * Canon plateforme : « Compte = icône haut-droite, JAMAIS un onglet ». Cette
 * icône (silhouette sobre, pas d'emoji) se passe en `trailing` de l'AppBar des
 * écrans de zone, ou directement dans un en-tête racine. Vouvoiement, sobre.
 */

import { Pressable } from 'react-native';
import { Link } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '@/theme/v2';

export function AccountButton({ size = 22 }: { size?: number }) {
  return (
    <Link href={'/(app)/compte' as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compte"
        hitSlop={theme.hitSlop}
        style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.4} stroke={theme.palette.creamMute} strokeWidth={1.6} />
          <Path
            d="M5.5 19c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6"
            stroke={theme.palette.creamMute}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </Link>
  );
}
