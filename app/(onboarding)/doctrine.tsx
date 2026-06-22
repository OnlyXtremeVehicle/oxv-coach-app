/**
 * Écran #02 — Doctrine.
 *
 * Pose la philosophie OXV en quatre phrases empilées avant tout le reste.
 * Maximum de sobriété typographique, vouvoiement, doctrine "miroir pas
 * coach" exprimée en clair.
 */

import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function DoctrineScreen() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: borderRadius.sm,
              backgroundColor: i < 2 ? colors.accent.red : colors.border.subtle,
            }}
          />
        ))}
      </View>
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginTop: spacing.sm }]}>
        ÉTAPE 2 / 6
      </Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.xxl, color: colors.text.tertiary }]}
        >
          DOCTRINE
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.headline,
            fontWeight: fontWeight.light,
            lineHeight: fontSize.headline * 1.2,
            marginBottom: spacing.xl,
          }}
        >
          Une app qui vous montre.
        </Text>

        <View style={{ gap: spacing.md, marginBottom: spacing.xxxl }}>
          <DoctrineLine text="Pas un coach." />
          <DoctrineLine text="Pas un instructeur." />
          <DoctrineLine text="Un miroir." />
        </View>

        <Text
          style={[typography.manifest, { color: colors.text.secondary, paddingRight: spacing.lg }]}
        >
          Les décisions de pilotage vous appartiennent. Toujours.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(onboarding)/methode')}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.accent.red,
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
          Compris
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

function DoctrineLine({ text }: { text: string }) {
  return (
    <Text
      style={{
        color: colors.text.primary,
        fontSize: fontSize.titleLarge,
        fontWeight: fontWeight.ultralight,
      }}
    >
      {text}
    </Text>
  );
}
