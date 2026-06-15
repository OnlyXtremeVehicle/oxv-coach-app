import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { isOnboardingComplete } from '@/services/onboardingService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function IndexRoute() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const initialize = useAuthStore((s) => s.initialize);

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

  // Échec d'initialisation (réseau / session) : on n'envoie PAS vers login en
  // silence — on explique et on propose de réessayer (relance initialize()).
  if (status === 'error') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>IMPRÉVU</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, textAlign: 'center' }]}>
          Connexion impossible.
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.text.tertiary, marginTop: spacing.md, textAlign: 'center' },
          ]}
        >
          Vérifiez votre réseau, puis réessayez.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => initialize()}
          style={({ pressed }) => ({
            marginTop: spacing.xxxl,
            height: 52,
            paddingHorizontal: spacing.xxl,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.medium,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            Réessayer
          </Text>
        </Pressable>
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
