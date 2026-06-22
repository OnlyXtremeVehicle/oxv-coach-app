/**
 * Écran #06 — Pacte de pilotage.
 *
 * LA signature manifeste. Fond noir absolu, les deux phrases-clés en
 * grand, une seule case à cocher "Je m'engage", bouton "Activer OXV Mirror".
 *
 * À l'acceptation : on persiste `pact_accepted_at` puis on appelle
 * `completeOnboarding` qui set `profile_completed_at`. À la prochaine
 * navigation, le router app/index.tsx renverra vers `(app)/`.
 *
 * Cohérence avec docs/juridique/01_PACTE_DE_PILOTAGE.md (versionné en
 * PACT_VERSION).
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { acceptPact, completeOnboarding } from '@/services/onboardingService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    // Le routeur app/index.tsx renverra automatiquement vers (app)/ à la
    // prochaine navigation grâce au refresh du profil dans le store.
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
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: borderRadius.sm,
              backgroundColor: colors.accent.red,
            }}
          />
        ))}
      </View>
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginTop: spacing.sm }]}>
        ÉTAPE 6 / 6
      </Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.xxxl, color: colors.text.tertiary }]}
        >
          PACTE DE PILOTAGE
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
          L'app est un miroir. Elle vous montre. Elle ne vous dirige pas.
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
              borderRadius: borderRadius.sm,
              borderWidth: 1.5,
              borderColor: committed ? colors.accent.red : colors.border.medium,
              backgroundColor: committed ? colors.accent.red : 'transparent',
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
          backgroundColor: committed ? colors.accent.red : colors.background.elevated,
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
          {submitting ? 'Activation…' : 'Activer OXV Mirror'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
