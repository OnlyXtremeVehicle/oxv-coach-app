/**
 * Layout admin OXV — section bronze réservée au staff.
 *
 * Guard : redirige vers `(app)/` si le user n'est pas `is_admin`.
 * Les sous-routes portent un accent distinct du mode pilote pour
 * repérer visuellement la section staff.
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile?.is_admin) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.palette.night },
        animation: 'fade',
      }}
    />
  );
}
