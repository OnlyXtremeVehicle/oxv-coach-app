/**
 * Stack onboarding coach. Flux strictement linéaire : pas de retour
 * geste pour ne pas laisser un coach dans un état partiellement signé.
 *
 * Guard : redirige /(app) si l'user n'est pas role='coach'. Le routing
 * principal app/index.tsx vérifie déjà ce cas, ce layout est une
 * sécurité supplémentaire.
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/tokens';

export default function CoachOnboardingLayout() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile) return null;
  if (profile.role !== 'coach') {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade',
        gestureEnabled: false,
      }}
    />
  );
}
