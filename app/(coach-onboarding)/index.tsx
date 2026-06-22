/**
 * Onboarding coach — Écran 1/3 : accueil.
 *
 * Premier contact du coach avec l'app. Ton sobre et clair : on lui
 * explique brièvement ce qu'il fait (et ne fait pas) chez OXV, puis il
 * passe au pacte.
 */

import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { borderRadius, colors, fontSize, spacing, typography } from '@/theme/tokens';
import { theme } from '@/theme/v2';

export default function CoachOnboardingHomeScreen() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: borderRadius.sm,
              backgroundColor: i < 1 ? colors.accent.coach : colors.border.subtle,
            }}
          />
        ))}
      </View>
      <Text
        style={[
          typography.eyebrow,
          { fontFamily: theme.fonts.mono, color: theme.palette.faint, marginTop: spacing.sm },
        ]}
      >
        ÉTAPE 1 / 3
      </Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[
            typography.eyebrow,
            { fontFamily: theme.fonts.mono, color: colors.accent.coach, marginBottom: spacing.lg },
          ]}
        >
          BIENVENUE
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontFamily: theme.fonts.display,
            fontSize: fontSize.display,
            lineHeight: fontSize.display * 1.15,
            marginBottom: spacing.xxxl,
          }}
        >
          Vous êtes coach OXV.
        </Text>

        <Text
          style={{
            color: colors.text.secondary,
            fontFamily: theme.fonts.bodyLight,
            fontSize: fontSize.bodyLarge,
            lineHeight: fontSize.bodyLarge * 1.6,
            marginBottom: spacing.lg,
          }}
        >
          Votre rôle est d'accompagner les pilotes qui vous sont assignés et qui ont consenti au
          partage de leurs données.
        </Text>

        <Text
          style={{
            color: colors.text.secondary,
            fontFamily: theme.fonts.bodyLight,
            fontSize: fontSize.bodyLarge,
            lineHeight: fontSize.bodyLarge * 1.6,
            marginBottom: spacing.xxxl,
          }}
        >
          Avant de commencer, deux pages à lire calmement.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(coach-onboarding)/mission' as never)}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.accent.coach,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontFamily: theme.fonts.bodyMedium,
            fontSize: fontSize.body,
            letterSpacing: 0.5,
          }}
        >
          Continuer
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
