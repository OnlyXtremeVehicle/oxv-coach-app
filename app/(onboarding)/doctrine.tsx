/**
 * Écran #02 — Doctrine. Transposition gaming (cockpit factuel).
 *
 * Pose la philosophie OXV en quatre phrases empilées. Sobriété
 * typographique, vouvoiement, « miroir pas coach » en clair.
 * Barre de progression + CTA en or ; migration legacy→v2 achevée.
 */

import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const STEP = 2;
const TOTAL = 6;

export default function DoctrineScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.night, paddingHorizontal: spacing.xl }}
    >
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Étape ${STEP} sur ${TOTAL}`}
        accessibilityValue={{ min: 0, max: TOTAL, now: STEP }}
        style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}
      >
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              flex: 1,
              height: 3,
              borderRadius: radius.sm,
              backgroundColor: i < STEP ? palette.gold : palette.line,
            }}
          />
        ))}
      </View>
      <Text
        style={[s.step, { marginTop: spacing.sm }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        ÉTAPE {STEP} / {TOTAL}
      </Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text accessibilityRole="header" style={[s.label, { marginBottom: spacing.xxl }]}>
          DOCTRINE
        </Text>
        <Text style={s.headline}>Une app qui vous montre.</Text>

        <View style={{ gap: spacing.md, marginBottom: 40 }}>
          <Text style={s.line}>Pas un coach.</Text>
          <Text style={s.line}>Pas un instructeur.</Text>
          <Text style={s.line}>Un miroir.</Text>
        </View>

        <Text style={s.manifest}>Les décisions de pilotage vous appartiennent. Toujours.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compris"
        onPress={() => router.push('/(onboarding)/methode')}
        style={({ pressed }) => ({
          minHeight: 52,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: palette.gold,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={s.ctaTxt}>Compris</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = {
  // Indicateur d'étape (info utile) — contraste AA.
  step: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  // Libellé de section (info utile, sert d'en-tête) — contraste AA.
  label: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  headline: {
    color: palette.cream,
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    lineHeight: fontSize.display * 1.2,
    marginBottom: spacing.xl,
  },
  line: { color: palette.cream, fontFamily: fonts.display, fontSize: fontSize.h2 },
  manifest: {
    color: palette.creamSoft,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: fontSize.bodyLg * 1.6,
    paddingRight: spacing.lg,
  },
  ctaTxt: {
    color: palette.night,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
  },
};
