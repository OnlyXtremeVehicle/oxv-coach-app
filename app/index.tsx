import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { isOnboardingComplete } from '@/services/onboardingService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;

export default function IndexRoute() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const initialize = useAuthStore((s) => s.initialize);

  if (status === 'idle' || status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.night,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={palette.creamSoft} />
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
          backgroundColor: palette.night,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Text style={s.eyebrow}>IMPRÉVU</Text>
        <Text style={[s.title, { marginTop: spacing.md, textAlign: 'center' }]}>
          Connexion impossible.
        </Text>
        <Text style={[s.caption, { marginTop: spacing.md, textAlign: 'center' }]}>
          Vérifiez votre réseau, puis réessayez.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => initialize()}
          style={({ pressed }) => ({
            marginTop: 40,
            height: 52,
            paddingHorizontal: spacing.xxl,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: palette.edge,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={s.retry}>Réessayer</Text>
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
    // Le partenaire ne passe pas l'onboarding pilote : il rejoint son espace.
    if (profile?.role === 'partner') {
      return <Redirect href={'/(partner)' as never} />;
    }
    return <Redirect href="/(onboarding)" />;
  }

  // Routing par rôle une fois onboarding complet :
  //  - coach → écran dédié avec liste de ses pilotes
  //  - admin/pilot → flux pilote standard (admin a accès en plus à /(admin))
  if (profile.role === 'coach') {
    return <Redirect href={'/(coach)' as never} />;
  }
  if (profile.role === 'partner') {
    return <Redirect href={'/(partner)' as never} />;
  }
  if (profile.role === 'pro_pilot') {
    return <Redirect href={'/(pro)' as never} />;
  }

  // Lot L6 — le pilote arrive dans l'arbre V2.
  //
  // Ce commentaire disait que l'arbre v1 restait atteignable « pour trois
  // écrans non portés : planificateur de route, import de tracé, carte
  // trophée ». **Les trois sont portés depuis le 29/07/2026** — lots 19 et 20 —
  // et `app/(app2)` ne pointe plus une seule fois vers `app/(app)`.
  //
  // L'arbre v1 reste néanmoins en place, pour deux raisons qui n'ont rien à
  // voir avec le pilote : `app/(pro)` en dépend (cinq écrans montent
  // `AccountButton`, qui vise `/(app)/compte`), et les espaces coach et admin
  // vivent encore à côté. Le retrait passe donc par le classement écran par
  // écran du lot 21, pas par une suppression de dossier.
  return <Redirect href={'/(app2)' as never} />;
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  title: { color: palette.cream, fontFamily: fonts.display, fontSize: fontSize.h2 },
  caption: { color: palette.creamMute, fontFamily: fonts.body, fontSize: fontSize.small },
  retry: { color: palette.cream, fontFamily: fonts.body, fontSize: fontSize.body },
};
