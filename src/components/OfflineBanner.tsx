/**
 * Bannière offline (#26 du sitemap).
 *
 * Discrète, jaune, affichée en haut de l'écran courant quand le
 * réseau est perdu. Ne bloque pas l'usage de l'app — signale juste
 * l'état. Pilotée par useUIStore.offlineBannerVisible (alimenté par
 * src/lib/netinfo.ts).
 */

import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStateStore } from '@/store/useAppStateStore';
import { useUIStore } from '@/store/useUIStore';
import { colors, fontSize, fontWeight, spacing } from '@/theme/tokens';

export function OfflineBanner() {
  const visible = useUIStore((s) => s.offlineBannerVisible);
  // Principe 3 « silence en piste » : pas de bannière pendant le roulage.
  const driving = useAppStateStore((s) => s.state === 'S6_roulage');
  const insets = useSafeAreaInsets();

  if (!visible || driving) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        backgroundColor: colors.system.warning,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        zIndex: 1000,
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          color: colors.background.primary,
          fontSize: fontSize.caption,
          fontWeight: fontWeight.medium,
          letterSpacing: 0.5,
        }}
      >
        Mode hors-ligne
      </Text>
    </View>
  );
}
