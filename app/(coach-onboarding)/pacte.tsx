/**
 * Onboarding coach — Écran 3/3 : Pacte de coaching. Transposition gaming.
 *
 * Signature du pacte de coaching (distinct du pacte de pilotage). Fond
 * noir, deux phrases-manifestes (cream italic, sobre), case « Je m'engage »,
 * bouton « Activer mon compte coach ». Barre/case/CTA en OR.
 * Cohérence docs/juridique/06_PACTE_DE_COACHING.md (COACH_PACT_VERSION).
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  acceptCguAndPrivacy,
  acceptCoachPact,
  completeOnboarding,
} from '@/services/onboardingService';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const TOTAL = 3;

export default function CoachPacteScreen() {
  const [committed, setCommitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onActivate = async () => {
    if (!committed || submitting) return;
    setSubmitting(true);

    // Pour V1 : on accepte le pacte coach + les CGU/RGPD en un seul flow.
    // Le pacte coach contient déjà les engagements RGPD spécifiques au
    // coach (article 5 : journalisation, article 6 : droit d'accès).
    const pactOk = await acceptCoachPact();
    if (!pactOk) {
      setSubmitting(false);
      Alert.alert(
        'Pacte non enregistré',
        'Votre engagement sera rejoué dès que votre connexion sera de retour.'
      );
      return;
    }
    const cguOk = await acceptCguAndPrivacy();
    if (!cguOk) {
      setSubmitting(false);
      Alert.alert('CGU non enregistrées', 'Réessayez quand votre connexion sera de retour.');
      return;
    }
    const completeOk = await completeOnboarding();
    setSubmitting(false);
    if (!completeOk) {
      Alert.alert('Finalisation impossible', 'Réessayez quand votre connexion sera de retour.');
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.night, paddingHorizontal: spacing.xl }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 3, borderRadius: radius.sm, backgroundColor: palette.gold }}
          />
        ))}
      </View>
      <Text style={[s.eyebrow, { marginTop: spacing.sm }]}>
        ÉTAPE {TOTAL} / {TOTAL}
      </Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[s.eyebrow, { marginBottom: 40 }]}>PACTE DE COACHING</Text>

        <Text style={[s.manifesto, { marginBottom: 40 }]}>
          Je respecte la confidentialité du pilote, sans condition.
        </Text>

        <Text style={[s.manifesto, { marginBottom: 56 }]}>
          Je n&apos;instruis pas. Je propose un regard.
        </Text>

        <Pressable
          onPress={() => setCommitted((c) => !c)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: committed }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.md,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.sm,
              borderWidth: 1.5,
              borderColor: committed ? palette.gold : palette.edge,
              backgroundColor: committed ? palette.gold : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
            }}
          >
            {committed ? <Text style={s.check}>✓</Text> : null}
          </View>
          <Text style={s.commit}>Je m&apos;engage.</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onActivate}
        disabled={!committed || submitting}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: radius.lg,
          backgroundColor: committed ? palette.gold : palette.card2,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {submitting ? <ActivityIndicator color={palette.night} /> : null}
        <Text style={[s.ctaTxt, { color: committed ? palette.night : palette.creamMute }]}>
          {submitting ? 'Activation…' : 'Activer mon compte coach'}
        </Text>
      </Pressable>
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
  manifesto: {
    color: palette.cream,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.h2,
    fontStyle: 'italic' as const,
    lineHeight: fontSize.h2 * 1.6,
  },
  check: { color: palette.night, fontFamily: fonts.bodySemi, fontSize: 16 },
  commit: { color: palette.cream, fontFamily: fonts.body, fontSize: fontSize.bodyLg },
  ctaTxt: { fontFamily: fonts.bodyMedium, fontSize: fontSize.body, letterSpacing: 0.5 },
};
