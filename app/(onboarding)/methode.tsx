/**
 * Écran #03 — Méthode.
 *
 * Trois mots verticalement empilés : VOIR / COMPRENDRE / QUESTIONNER.
 * Chacun avec une phrase de support en gris discret. Phrase manifeste
 * "Jamais d'instruction. Toujours une observation." en bas.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { borderRadius, colors, fontSize, spacing, typography } from '@/theme/tokens';
import { theme } from '@/theme/v2';

const STEPS: { eyebrow: string; body: string }[] = [
  { eyebrow: 'VOIR', body: "Ce qui s'est passé." },
  { eyebrow: 'COMPRENDRE', body: 'Ce que vous avez senti.' },
  { eyebrow: 'QUESTIONNER', body: 'Ce que vous voulez explorer.' },
];

export default function MethodeScreen() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: borderRadius.sm,
                backgroundColor: i < 3 ? colors.accent.red : colors.border.subtle,
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
          ÉTAPE 3 / 6
        </Text>

        <View style={{ flex: 1, justifyContent: 'center', paddingTop: spacing.xxxl }}>
          <Text
            style={[
              typography.eyebrow,
              {
                fontFamily: theme.fonts.mono,
                marginBottom: spacing.xxxl,
                color: theme.palette.faint,
              },
            ]}
          >
            LA MÉTHODE OXV
          </Text>

          <View style={{ gap: spacing.xxxl, marginBottom: spacing.giant }}>
            {STEPS.map((step) => (
              <View key={step.eyebrow}>
                <Text
                  style={{
                    color: colors.accent.red,
                    fontFamily: theme.fonts.mono,
                    fontSize: fontSize.title,
                    letterSpacing: 3,
                    marginBottom: spacing.sm,
                  }}
                >
                  {step.eyebrow}
                </Text>
                <Text
                  style={{
                    color: colors.text.secondary,
                    fontFamily: theme.fonts.bodyLight,
                    fontSize: fontSize.bodyLarge,
                  }}
                >
                  {step.body}
                </Text>
              </View>
            ))}
          </View>

          <Text
            style={[
              typography.manifest,
              {
                fontFamily: theme.fonts.bodyLight,
                color: colors.text.secondary,
                marginBottom: spacing.xl,
              },
            ]}
          >
            Jamais d'instruction. Toujours une observation.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(onboarding)/niveau')}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent.red,
            alignItems: 'center',
            justifyContent: 'center',
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
            Suivant
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
