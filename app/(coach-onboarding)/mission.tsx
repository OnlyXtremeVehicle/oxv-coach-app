/**
 * Onboarding coach — Écran 2/3 : votre mission. Transposition gaming.
 *
 * 4 points clés (observation / consentement / confidentialité / trace).
 * Eyebrows de points en OR (accent cockpit), section en faint. Lecture
 * pédagogique, pas de case à cocher. Migration legacy→v2 achevée.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const STEP = 2;
const TOTAL = 3;

const POINTS: { eyebrow: string; title: string; body: string }[] = [
  {
    eyebrow: 'POSTURE',
    title: "Vous observez, vous n'instruisez pas.",
    body: "OXV Mirror vous donne les données. Le sens, c'est vous qui le posez avec le pilote. L'application ne génère pas d'instructions à transmettre, et vous-même restez libre de votre interprétation.",
  },
  {
    eyebrow: 'CONSENTEMENT',
    title: 'Le pilote contrôle ce que vous voyez.',
    body: "Tant qu'un pilote n'a pas explicitement consenti depuis son application, ses données vous restent invisibles. Il peut retirer son accord à tout moment, sans justification, et vous le perdrez immédiatement de votre liste.",
  },
  {
    eyebrow: 'CONFIDENTIALITÉ',
    title: "Vous voyez les données. Jamais l'identité.",
    body: "Vous accédez aux sessions, aux marges, à la progression. Vous n'accédez jamais à l'email, au téléphone, ni aux documents administratifs du pilote. Si vous avez besoin de le contacter, passez par OXV.",
  },
  {
    eyebrow: 'TRACE',
    title: 'Vos accès sont journalisés.',
    body: 'Chacune de vos consultations est enregistrée (date, heure, pilote consulté). Cette trace est conservée par OXV à des fins de conformité réglementaire. Le pilote peut la consulter sur demande.',
  },
];

export default function CoachOnboardingMissionScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.night }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl }}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Étape ${STEP} sur ${TOTAL}`}
          accessibilityValue={{ min: 0, max: TOTAL, now: STEP }}
          style={{ marginBottom: spacing.xxl }}
        >
          <View
            style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}
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
          <Text style={s.step} accessibilityElementsHidden importantForAccessibility="no">
            ÉTAPE {STEP} / {TOTAL}
          </Text>
        </View>

        <Text accessibilityRole="header" style={[s.label, { marginBottom: spacing.md }]}>
          MISSION
        </Text>
        <Text style={[s.title, { marginBottom: spacing.sm }]} accessibilityRole="header">
          Ce que vous faites ici.
        </Text>
        <Text style={[s.caption, { marginBottom: 40 }]}>
          Quatre principes qui guident chaque interaction avec un pilote.
        </Text>

        {POINTS.map((point) => (
          <View
            key={point.eyebrow}
            style={{ marginBottom: 40 }}
            accessible
            accessibilityLabel={`${point.eyebrow}. ${point.title} ${point.body}`}
          >
            <Text
              style={[s.pointEyebrow, { marginBottom: spacing.sm }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {point.eyebrow}
            </Text>
            <Text style={s.pointTitle} accessibilityElementsHidden importantForAccessibility="no">
              {point.title}
            </Text>
            <Text style={s.pointBody} accessibilityElementsHidden importantForAccessibility="no">
              {point.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuer vers le pacte"
          onPress={() => router.push('/(coach-onboarding)/pacte' as never)}
          style={({ pressed }) => ({
            minHeight: 52,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: palette.gold,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={s.ctaTxt}>Continuer vers le pacte</Text>
        </Pressable>
      </View>
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
  pointEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.gold,
  },
  title: { color: palette.cream, fontFamily: fonts.display, fontSize: fontSize.h2 },
  caption: { color: palette.creamMute, fontFamily: fonts.body, fontSize: fontSize.small },
  pointTitle: {
    color: palette.cream,
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    lineHeight: fontSize.h3 * 1.3,
    marginBottom: spacing.md,
  },
  pointBody: {
    color: palette.creamSoft,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.6,
  },
  ctaTxt: {
    color: palette.night,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
  },
};
