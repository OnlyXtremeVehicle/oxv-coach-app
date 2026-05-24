import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

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
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade',
        gestureEnabled: false,
      }}
    />
  );
}
