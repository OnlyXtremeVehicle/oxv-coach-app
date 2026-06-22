/**
 * Écran #05 — CGU / RGPD consent.
 *
 * 3 cases à cocher, toutes obligatoires. Acceptation horodatée
 * via onboardingService.acceptCguAndPrivacy qui écrit dans users
 * (cgu_accepted_at, cgu_version, privacy_accepted_at, privacy_version).
 *
 * Les liens "Lire en entier" ouvrent les documents juridiques en plein
 * écran (à câbler en sem 10 quand on aura Settings → Légal). En V1, on
 * affiche un message d'attente — la doctrine impose au moins d'avoir
 * coché les cases, le détail est consultable plus tard.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { acceptCguAndPrivacy } from '@/services/onboardingService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

interface Checks {
  cgu: boolean;
  privacy: boolean;
  age: boolean;
}

export default function CguScreen() {
  const [checks, setChecks] = useState<Checks>({ cgu: false, privacy: false, age: false });
  const [submitting, setSubmitting] = useState(false);

  const allChecked = checks.cgu && checks.privacy && checks.age;

  const toggle = (key: keyof Checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onContinue = async () => {
    if (!allChecked || submitting) return;
    setSubmitting(true);
    const ok = await acceptCguAndPrivacy();
    setSubmitting(false);
    if (!ok) {
      Alert.alert('Acceptation non enregistrée', 'Réessayez quand votre connexion sera de retour.');
      return;
    }
    router.push('/(onboarding)/pacte');
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
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: borderRadius.sm,
                backgroundColor: i < 5 ? colors.accent.red : colors.border.subtle,
              }}
            />
          ))}
        </View>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginTop: spacing.sm }]}>
          ÉTAPE 5 / 6
        </Text>

        <View style={{ marginTop: spacing.xxxl }}>
          <Text
            style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
          >
            CGU ET CONFIDENTIALITÉ
          </Text>
          <Text style={[typography.screenTitle, { marginBottom: spacing.xxl }]}>
            Avant de continuer.
          </Text>

          <Checkbox
            checked={checks.cgu}
            onToggle={() => toggle('cgu')}
            label="J'accepte les Conditions Générales d'Utilisation."
          />
          <Checkbox
            checked={checks.privacy}
            onToggle={() => toggle('privacy')}
            label="J'ai lu la Politique de confidentialité."
          />
          <Checkbox
            checked={checks.age}
            onToggle={() => toggle('age')}
            label="Je confirme avoir 18 ans révolus et un permis B valide."
          />

          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xl }]}
          >
            Les documents complets sont consultables à tout moment depuis vos paramètres.
          </Text>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xxl }} />

        <Pressable
          accessibilityRole="button"
          onPress={onContinue}
          disabled={!allChecked || submitting}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            backgroundColor: allChecked ? colors.accent.red : colors.background.elevated,
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
            {submitting ? 'Enregistrement…' : "J'accepte"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: borderRadius.sm,
          borderWidth: 1.5,
          borderColor: checked ? colors.accent.red : colors.border.medium,
          backgroundColor: checked ? colors.accent.red : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
          marginTop: 2,
        }}
      >
        {checked ? (
          <Text
            style={{ color: colors.text.primary, fontWeight: fontWeight.semibold, fontSize: 14 }}
          >
            ✓
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          flex: 1,
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.light,
          lineHeight: fontSize.body * 1.4,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
