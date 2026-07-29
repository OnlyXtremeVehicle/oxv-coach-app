/**
 * AccountButton — accès au Compte, icône haut-droite des écrans racines.
 *
 * Canon plateforme : « Compte = icône haut-droite, JAMAIS un onglet ». Cette
 * icône (silhouette sobre, pas d'emoji) se passe en `trailing` de l'AppBar des
 * écrans de zone, ou directement dans un en-tête racine. Vouvoiement, sobre.
 *
 * ---
 *
 * LA CIBLE A CHANGÉ D'ARBRE (lot J5, étape 9)
 *
 * Elle visait `/(app)/compte`, classé « meurt ». Ce bouton était l'une des deux
 * attaches qui retenaient l'arbre V1 : cinq montages dans `app/(pro)`, trois
 * dans `app/(app)` — ces derniers sur des écrans que plus aucun pilote
 * n'atteint depuis la bascule L6.
 *
 * Elle vise désormais `/(app2)/vous`, le hub VOUS — le seul, selon le
 * classement J5, qui atteigne tous ses enfants.
 */

import { Pressable } from 'react-native';
import { Link } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '@/theme/v2';

export function AccountButton({ size = 22 }: { size?: number }) {
  return (
    <Link href={'/(app2)/vous' as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compte"
        hitSlop={theme.hitSlop}
        style={({ pressed }) => ({
          // Cercle plein (maquette §7.1) : glyphe dans une pastille surface-2.
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.palette.card2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
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
