/**
 * Onboarding coach — Écran 1/3 : accueil. Transposition gaming (cockpit factuel).
 *
 * Accent coach unifié à l'OR (cohérence avec le flux d'onboarding pilote).
 * L'identité prescriptive du coach reste portée par la bande coach ROUGE
 * ailleurs dans l'app. Migration legacy→v2 achevée.
 */

import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const STEP = 1;
const TOTAL = 3;

export default function CoachOnboardingHomeScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.night, paddingHorizontal: spacing.xl }}
    >
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Étape ${STEP} sur ${TOTAL}`}
        accessibilityValue={{ min: 0, max: TOTAL, now: STEP }}
        style={{ paddingTop: spacing.lg }}
      >
        <View
          style={{ flexDirection: 'row', gap: spacing.sm }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View
              key={i}
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
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[s.eyebrow, { marginBottom: spacing.lg }]}>BIENVENUE</Text>
        <Text style={[s.headline, { marginBottom: 40 }]} accessibilityRole="header">
          Vous êtes coach OXV.
        </Text>

        <Text style={[s.body, { marginBottom: spacing.lg }]}>
          Votre rôle est d&apos;accompagner les pilotes qui vous sont assignés et qui ont consenti
          au partage de leurs données.
        </Text>

        <Text style={[s.body, { marginBottom: 40 }]}>
          Avant de commencer, deux pages à lire calmement.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continuer vers la mission"
        onPress={() => router.push('/(coach-onboarding)/mission' as never)}
        style={({ pressed }) => ({
          minHeight: 52,
          borderRadius: radius.lg,
          backgroundColor: palette.gold,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={s.ctaTxt}>Continuer</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = {
  // Eyebrow décoratif (« BIENVENUE ») — peut rester `faint`.
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
  // Indicateur d'étape (info utile) — contraste AA.
  step: {
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
    lineHeight: fontSize.display * 1.15,
  },
  body: {
    color: palette.creamSoft,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    lineHeight: fontSize.bodyLg * 1.6,
  },
  ctaTxt: {
    color: palette.night,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
  },
};
