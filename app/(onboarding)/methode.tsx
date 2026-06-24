/**
 * Écran #03 — Méthode. Transposition gaming (cockpit factuel).
 *
 * Trois mots empilés : VOIR / COMPRENDRE / QUESTIONNER (en or, accent
 * cockpit), chacun avec une phrase de support. Manifeste en bas.
 * Barre de progression + CTA en or ; migration legacy→v2 achevée.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const STEP = 3;
const TOTAL = 6;

const STEPS: { eyebrow: string; body: string }[] = [
  { eyebrow: 'VOIR', body: "Ce qui s'est passé." },
  { eyebrow: 'COMPRENDRE', body: 'Ce que vous avez senti.' },
  { eyebrow: 'QUESTIONNER', body: 'Ce que vous voulez explorer.' },
];

export default function MethodeScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.night, paddingHorizontal: spacing.xl }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
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
        <Text style={[s.eyebrow, { marginTop: spacing.sm }]}>
          ÉTAPE {STEP} / {TOTAL}
        </Text>

        <View style={{ flex: 1, justifyContent: 'center', paddingTop: 40 }}>
          <Text style={[s.eyebrow, { marginBottom: 40 }]}>LA MÉTHODE OXV</Text>

          <View style={{ gap: 40, marginBottom: 56 }}>
            {STEPS.map((step) => (
              <View key={step.eyebrow}>
                <Text style={s.word}>{step.eyebrow}</Text>
                <Text style={s.wordBody}>{step.body}</Text>
              </View>
            ))}
          </View>

          <Text style={s.manifest}>Jamais d&apos;instruction. Toujours une observation.</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(onboarding)/niveau')}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.lg,
            backgroundColor: palette.gold,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={s.ctaTxt}>Suivant</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
  word: {
    color: palette.gold,
    fontFamily: fonts.mono,
    fontSize: fontSize.h2,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  wordBody: { color: palette.creamSoft, fontFamily: fonts.bodyLight, fontSize: fontSize.bodyLg },
  manifest: {
    color: palette.creamSoft,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: fontSize.bodyLg * 1.6,
    marginBottom: spacing.xl,
  },
  ctaTxt: {
    color: palette.night,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
  },
};
