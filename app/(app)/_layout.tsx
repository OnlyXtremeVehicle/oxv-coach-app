import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/tokens';

export default function AppLayout() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    // Sentinel : si la session expire en cours d'usage, le store passe
    // automatiquement en 'unauthenticated' via onAuthStateChange.
  }, [status]);

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
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
