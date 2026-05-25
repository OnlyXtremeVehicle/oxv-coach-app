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
  // comme terminé. Les coachs/admins ont aussi besoin de signer le pacte.
  if (!profile || !isOnboardingComplete(profile)) {
    return <Redirect href="/(onboarding)" />;
  }

  // Routing par rôle :
  //  - coach → écran dédié avec liste de ses pilotes
  //  - admin/pilot → flux pilote standard (admin a accès en plus à /(admin))
  if (profile.role === 'coach') {
    // Cast nécessaire le temps que les typed routes Expo se régénèrent
    // (la nouvelle route /(coach) est inconnue tant que Metro n'a pas tourné).
    return <Redirect href={'/(coach)' as never} />;
  }

  return <Redirect href="/(app)" />;
}
