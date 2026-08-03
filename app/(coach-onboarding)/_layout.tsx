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
import { theme } from '@/theme/v2';

export default function CoachOnboardingLayout() {
  const profile = useAuthStore((s) => s.profile);
  const status = useAuthStore((s) => s.status);

  // Déconnexion : `profile` retombe à null et ce layout ne rendait plus rien —
  // écran noir définitif. Même garde que app/(app2)/_layout.tsx.
  if (status === 'unauthenticated') {
    return <Redirect href={'/(auth)/login' as never} />;
  }

  if (!profile) return null;
  if (profile.role !== 'coach') {
    return <Redirect href={'/(app2)' as never} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.palette.night },
        animation: 'fade',
        gestureEnabled: false,
      }}
    />
  );
}
