/**
 * Onboarding coach — Écran 2/3 : votre mission.
 *
 * Présente sobrement les 4 points clés de la mission coach :
 *   1. Vous observez, vous n'instruisez pas
 *   2. Le pilote contrôle son consentement
 *   3. Vous voyez les données, jamais l'identité
 *   4. Vos accès sont journalisés (RGPD)
 *
 * Pas de check à cocher ici, juste de la lecture pédagogique.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: borderRadius.sm,
                backgroundColor: i < 2 ? colors.accent.coach : colors.border.subtle,
              }}
            />
          ))}
        </View>
        <Text
          style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
        >
          ÉTAPE 2 / 3
        </Text>

        <Text
          style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}
        >
          MISSION
        </Text>
        <Text style={[typography.screenTitle, { marginBottom: spacing.sm }]}>
          Ce que vous faites ici.
        </Text>
        <Text
          style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxxl }]}
        >
          Quatre principes qui guident chaque interaction avec un pilote.
        </Text>

        {POINTS.map((point) => (
          <View key={point.eyebrow} style={{ marginBottom: spacing.xxxl }}>
            <Text
              style={[typography.eyebrow, { marginBottom: spacing.sm, color: colors.accent.coach }]}
            >
              {point.eyebrow}
            </Text>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.title,
                fontWeight: fontWeight.light,
                lineHeight: fontSize.title * 1.3,
                marginBottom: spacing.md,
              }}
            >
              {point.title}
            </Text>
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.light,
                lineHeight: fontSize.body * 1.6,
              }}
            >
              {point.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(coach-onboarding)/pacte' as never)}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent.coach,
            alignItems: 'center',
            justifyContent: 'center',
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
            Continuer vers le pacte
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
