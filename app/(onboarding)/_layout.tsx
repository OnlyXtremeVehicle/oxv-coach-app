import { Stack } from 'expo-router';

import { theme } from '@/theme/v2';

/**
 * Stack onboarding : flux strictement linéaire. Le retour par geste est
 * désactivé pour ne pas permettre au pilote de revenir à mi-chemin et
 * laisser le profil dans un état partiellement signé.
 */
export default function OnboardingLayout() {
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
