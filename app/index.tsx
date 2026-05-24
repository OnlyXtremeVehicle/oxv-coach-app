import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { isOnboardingComplete } from '@/services/onboardingService';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/tokens';

export default function IndexRoute() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);

  if (status === 'idle' || status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </View>
    );
  }

  if (status !== 'authenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  // Profil chargé mais incomplet OU pas encore récupéré : on bascule vers
  // l'onboarding qui se chargera de tout signer puis de marquer le profil
  // comme terminé.
  if (!profile || !isOnboardingComplete(profile)) {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(app)" />;
}
