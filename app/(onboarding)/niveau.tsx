/**
 * Écran #04 — Niveau pilote.
 *
 * 4 cards verticales sélectionnables. Le niveau choisi est écrit dans
 * users.pilot_level via onboardingService.setPilotLevel, puis on passe
 * à l'écran CGU.
 *
 * Doctrine : ce niveau n'est PAS visible aux autres pilotes. Il sert
 * uniquement à calibrer les seuils internes des algorithmes.
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { type PilotLevelChoice, setPilotLevel } from '@/services/onboardingService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

interface LevelOption {
  id: PilotLevelChoice;
  title: string;
  description: string;
}

const LEVELS: LevelOption[] = [
  {
    id: 'debutant',
    title: 'Débutant',
    description: 'Quelques journées circuit, je découvre.',
  },
  {
    id: 'intermediaire',
    title: 'Apprivoisé',
    description: 'Je connais Beltoise, je progresse session après session.',
  },
  {
    id: 'confirme',
    title: 'Confirmé',
    description: 'Je tourne régulièrement, je connais mes limites.',
  },
  {
    id: 'expert',
    title: 'Expert',
    description: "J'ai un fond compétition, je cherche la précision.",
  },
];

export default function NiveauScreen() {
  const [selected, setSelected] = useState<PilotLevelChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onContinue = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    await setPilotLevel(selected);
    setSubmitting(false);
    router.push('/(onboarding)/cgu');
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, flexGrow: 1 }}>
        <View style={{ marginTop: spacing.xxxl }}>
          <Text
            style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
          >
            NIVEAU PILOTE
          </Text>
          <Text style={[typography.screenTitle, { marginBottom: spacing.sm }]}>
            Où vous situez-vous ?
          </Text>
          <Text
            style={[typography.caption, { marginBottom: spacing.xxl, color: colors.text.tertiary }]}
          >
            Cette information reste privée. Elle calibre vos analyses.
          </Text>

          <View style={{ gap: spacing.md }}>
            {LEVELS.map((level) => {
              const active = selected === level.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={level.id}
                  onPress={() => setSelected(level.id)}
                  style={({ pressed }) => ({
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    borderWidth: active ? 1 : 0.5,
                    borderColor: active ? colors.accent.red : colors.border.subtle,
                    backgroundColor: active
                      ? 'rgba(200, 16, 46, 0.08)'
                      : colors.background.secondary,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: fontSize.title,
                      fontWeight: fontWeight.light,
                      marginBottom: spacing.xs,
                    }}
                  >
                    {level.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.text.secondary,
                      fontSize: fontSize.body,
                    }}
                  >
                    {level.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xxl }} />

        <Pressable
          accessibilityRole="button"
          onPress={onContinue}
          disabled={!selected || submitting}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            backgroundColor: selected ? colors.accent.red : colors.background.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: spacing.xl,
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
            {submitting ? 'Enregistrement…' : 'Continuer'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
