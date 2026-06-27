/**
 * Écran #04 — Niveau pilote. Transposition gaming (cockpit factuel).
 *
 * 4 cartes sélectionnables. Le niveau choisi est écrit dans
 * users.pilot_level via onboardingService.setPilotLevel, puis CGU.
 * Doctrine : ce niveau n'est PAS visible aux autres pilotes ; il calibre
 * les seuils internes. État sélectionné en OR (accent cockpit).
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { type PilotLevelChoice, setPilotLevel } from '@/services/onboardingService';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const STEP = 4;
const TOTAL = 6;

interface LevelOption {
  id: PilotLevelChoice;
  title: string;
  description: string;
}

const LEVELS: LevelOption[] = [
  { id: 'debutant', title: 'Débutant', description: 'Quelques journées circuit, je découvre.' },
  {
    id: 'intermediaire',
    title: 'Apprivoisé',
    description: 'Je connais mon circuit, je progresse session après session.',
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
      style={{ flex: 1, backgroundColor: palette.night, paddingHorizontal: spacing.xl }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, flexGrow: 1 }}>
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

        <View style={{ marginTop: 40 }}>
          <Text accessibilityRole="header" style={[s.label, { marginBottom: spacing.lg }]}>
            NIVEAU PILOTE
          </Text>
          <Text style={[s.title, { marginBottom: spacing.sm }]}>Où vous situez-vous ?</Text>
          <Text style={[s.caption, { marginBottom: spacing.xxl }]}>
            Cette information reste privée. Elle calibre vos analyses.
          </Text>

          <View style={{ gap: spacing.md }}>
            {LEVELS.map((level) => {
              const active = selected === level.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${level.title}. ${level.description}`}
                  key={level.id}
                  onPress={() => setSelected(level.id)}
                  style={({ pressed }) => ({
                    padding: spacing.lg,
                    borderRadius: radius.lg,
                    borderWidth: active ? 1 : 0.5,
                    borderColor: active ? palette.gold : palette.line,
                    backgroundColor: active ? 'rgba(255,183,3,0.08)' : palette.card2,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={s.cardTitle}>{level.title}</Text>
                  <Text style={s.cardDesc}>{level.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xxl }} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitting ? 'Enregistrement en cours' : 'Continuer'}
          accessibilityState={{ disabled: !selected || submitting, busy: submitting }}
          onPress={onContinue}
          disabled={!selected || submitting}
          style={({ pressed }) => ({
            minHeight: 52,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: selected ? palette.gold : palette.card2,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: spacing.xl,
          })}
        >
          <Text style={[s.ctaTxt, { color: selected ? palette.night : palette.creamMute }]}>
            {submitting ? 'Enregistrement…' : 'Continuer'}
          </Text>
        </Pressable>
      </ScrollView>
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
  title: { color: palette.cream, fontFamily: fonts.display, fontSize: fontSize.h2 },
  caption: { color: palette.creamMute, fontFamily: fonts.body, fontSize: fontSize.small },
  cardTitle: {
    color: palette.cream,
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    marginBottom: spacing.xs,
  },
  cardDesc: { color: palette.creamSoft, fontFamily: fonts.body, fontSize: fontSize.body },
  ctaTxt: { fontFamily: fonts.bodyMedium, fontSize: fontSize.body, letterSpacing: 0.5 },
};
