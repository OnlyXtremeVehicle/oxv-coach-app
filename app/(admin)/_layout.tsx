/**
 * Layout admin OXV — section bronze réservée au staff.
 *
 * Guard : redirige vers `(app)/` si le user n'est pas `is_admin`.
 * Toutes les sous-routes utilisent `colors.accent.bronze` comme accent
 * principal pour distinguer visuellement du mode pilote (rouge OXV).
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/tokens';

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile?.is_admin) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade',
      }}
    />
  );
}
