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

import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CoachOnboardingHomeScreen() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.lg }]}
        >
          BIENVENUE
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.display,
            fontWeight: fontWeight.ultralight,
            lineHeight: fontSize.display * 1.15,
            marginBottom: spacing.xxxl,
          }}
        >
          Vous êtes coach OXV.
        </Text>

        <Text
          style={{
            color: colors.text.secondary,
            fontSize: fontSize.bodyLarge,
            fontWeight: fontWeight.light,
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
            fontSize: fontSize.bodyLarge,
            fontWeight: fontWeight.light,
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
            fontSize: fontSize.body,
            fontWeight: fontWeight.medium,
            letterSpacing: 0.5,
          }}
        >
          Continuer
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
