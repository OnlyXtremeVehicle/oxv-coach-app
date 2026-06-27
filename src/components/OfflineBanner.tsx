/**
 * Bannière offline (#26 du sitemap). Transposition gaming.
 *
 * Discrète, en OR (attention, pas alarme), affichée en haut quand le
 * réseau est perdu. Ne bloque pas l'usage. Pilotée par
 * useUIStore.offlineBannerVisible. Migration legacy→v2 achevée.
 */

import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStateStore } from '@/store/useAppStateStore';
import { useUIStore } from '@/store/useUIStore';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing } = theme;

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
        backgroundColor: palette.gold,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        zIndex: 1000,
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          color: palette.night,
          fontSize: fontSize.small,
          fontFamily: fonts.bodyMedium,
          letterSpacing: 0.5,
        }}
      >
        Mode hors-ligne
      </Text>
    </View>
  );
}
