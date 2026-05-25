/**
 * Onboarding coach — Écran 3/3 : Pacte de coaching.
 *
 * Signature du pacte de coaching (distinct du pacte de pilotage).
 * Fond noir, deux phrases-manifestes du coach, case à cocher
 * "Je m'engage", bouton "Activer mon compte coach".
 *
 * Cohérence avec docs/juridique/06_PACTE_DE_COACHING.md (versionné en
 * COACH_PACT_VERSION).
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
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.xxxl, color: colors.accent.coach }]}
        >
          PACTE DE COACHING
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.title,
            fontWeight: fontWeight.light,
            fontStyle: 'italic',
            lineHeight: fontSize.title * 1.6,
            marginBottom: spacing.xxxl,
          }}
        >
          Je respecte la confidentialité du pilote, sans condition.
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.title,
            fontWeight: fontWeight.light,
            fontStyle: 'italic',
            lineHeight: fontSize.title * 1.6,
            marginBottom: spacing.giant,
          }}
        >
          Je n'instruis pas. Je propose un regard.
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
              borderRadius: borderRadius.sm,
              borderWidth: 1.5,
              borderColor: committed ? colors.accent.coach : colors.border.medium,
              backgroundColor: committed ? colors.accent.coach : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
            }}
          >
            {committed ? (
              <Text
                style={{
                  color: colors.text.primary,
                  fontWeight: fontWeight.semibold,
                  fontSize: 16,
                }}
              >
                ✓
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.bodyLarge,
              fontWeight: fontWeight.regular,
            }}
          >
            Je m'engage.
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onActivate}
        disabled={!committed || submitting}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: borderRadius.lg,
          backgroundColor: committed ? colors.accent.coach : colors.background.elevated,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {submitting ? <ActivityIndicator color={colors.text.primary} /> : null}
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.medium,
            letterSpacing: 0.5,
          }}
        >
          {submitting ? 'Activation…' : 'Activer mon compte coach'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
