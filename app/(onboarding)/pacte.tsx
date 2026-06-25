/**
 * Écran #06 — Pacte de pilotage. Transposition gaming (cockpit factuel).
 *
 * LA signature manifeste. Fond noir, les deux phrases-clés en grand
 * (cream italic — cœur doctrinal, sobre), une case « Je m'engage »,
 * bouton « Activer OXV Mirror ». Barre/case/CTA en OR.
 * À l'acceptation : acceptPact + completeOnboarding, puis router.replace.
 * Cohérence docs/juridique/01_PACTE_DE_PILOTAGE.md (PACT_VERSION).
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { acceptPact, completeOnboarding } from '@/services/onboardingService';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const TOTAL = 6;

export default function PacteScreen() {
  const [committed, setCommitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onActivate = async () => {
    if (!committed || submitting) return;
    setSubmitting(true);

    const pactOk = await acceptPact();
    if (!pactOk) {
      setSubmitting(false);
      Alert.alert(
        'Pacte non enregistré',
        'Votre engagement sera rejoué dès que votre connexion sera de retour.'
      );
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
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Étape ${TOTAL} sur ${TOTAL}`}
        accessibilityValue={{ min: 0, max: TOTAL, now: TOTAL }}
        style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}
      >
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ flex: 1, height: 3, borderRadius: radius.sm, backgroundColor: palette.gold }}
          />
        ))}
      </View>
      <Text
        style={[s.step, { marginTop: spacing.sm }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        ÉTAPE {TOTAL} / {TOTAL}
      </Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text accessibilityRole="header" style={[s.label, { marginBottom: 40 }]}>
          PACTE DE PILOTAGE
        </Text>

        <Text style={[s.manifesto, { marginBottom: 40 }]}>
          L&apos;app est un miroir. Elle vous montre. Elle ne vous dirige pas.
        </Text>

        <Text style={[s.manifesto, { marginBottom: 56 }]}>
          La piste est à vous. Les décisions aussi.
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
            {committed ? (
              <Text style={s.check} accessibilityElementsHidden importantForAccessibility="no">
                ✓
              </Text>
            ) : null}
          </View>
          <Text style={s.commit}>Je m&apos;engage.</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitting ? 'Activation en cours' : 'Activer OXV Mirror'}
        accessibilityState={{ disabled: !committed || submitting, busy: submitting }}
        onPress={onActivate}
        disabled={!committed || submitting}
        style={({ pressed }) => ({
          minHeight: 52,
          paddingVertical: spacing.md,
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
        {submitting ? (
          <ActivityIndicator
            color={palette.night}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={[s.ctaTxt, { color: committed ? palette.night : palette.creamMute }]}>
          {submitting ? 'Activation…' : 'Activer OXV Mirror'}
        </Text>
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
