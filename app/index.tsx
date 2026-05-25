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
  // l'onboarding adapté au rôle :
  //  - coach → /(coach-onboarding) (pacte de coaching distinct)
  //  - pilote/admin → /(onboarding) standard (pacte de pilotage)
  if (!profile || !isOnboardingComplete(profile)) {
    if (profile?.role === 'coach') {
      return <Redirect href={'/(coach-onboarding)' as never} />;
    }
    return <Redirect href="/(onboarding)" />;
  }

  // Routing par rôle une fois onboarding complet :
  //  - coach → écran dédié avec liste de ses pilotes
  //  - admin/pilot → flux pilote standard (admin a accès en plus à /(admin))
  if (profile.role === 'coach') {
    return <Redirect href={'/(coach)' as never} />;
  }

  return <Redirect href="/(app)" />;
}
