/**
 * Écran #05 — CGU / RGPD. Transposition gaming (cockpit factuel).
 *
 * 3 cases à cocher obligatoires. Acceptation horodatée via
 * onboardingService.acceptCguAndPrivacy. Cases cochées en OR (✓ sombre).
 * Migration legacy→v2 achevée.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { acceptCguAndPrivacy } from '@/services/onboardingService';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const STEP = 5;
const TOTAL = 6;

interface Checks {
  cgu: boolean;
  privacy: boolean;
  age: boolean;
  aiDebrief: boolean;
}

export default function CguScreen() {
  const [checks, setChecks] = useState<Checks>({
    cgu: false,
    privacy: false,
    age: false,
    aiDebrief: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const allChecked = checks.cgu && checks.privacy && checks.age;

  const toggle = (key: keyof Checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onContinue = async () => {
    if (!allChecked || submitting) return;
    setSubmitting(true);
    const ok = await acceptCguAndPrivacy(checks.aiDebrief);
    setSubmitting(false);
    if (!ok) {
      Alert.alert('Acceptation non enregistrée', 'Réessayez quand votre connexion sera de retour.');
      return;
    }
    router.push('/(onboarding)/pacte');
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
            CGU ET CONFIDENTIALITÉ
          </Text>
          <Text style={[s.title, { marginBottom: spacing.xxl }]}>Avant de continuer.</Text>

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

          <Text style={[s.optional, { marginTop: spacing.xl, marginBottom: spacing.xs }]}>
            OPTIONNEL
          </Text>
          <Checkbox
            checked={checks.aiDebrief}
            onToggle={() => toggle('aiDebrief')}
            label="J'autorise le débrief enrichi par une IA (transfert de données non nominatives hors UE). Sans cela, votre débrief reste rédigé localement. Modifiable à tout moment."
          />

          <Text style={[s.caption, { marginTop: spacing.xl }]}>
            Les documents complets sont consultables à tout moment depuis vos paramètres.
          </Text>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xxl }} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitting ? 'Enregistrement en cours' : "J'accepte"}
          accessibilityState={{ disabled: !allChecked || submitting, busy: submitting }}
          onPress={onContinue}
          disabled={!allChecked || submitting}
          style={({ pressed }) => ({
            minHeight: 52,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: allChecked ? palette.gold : palette.card2,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            marginTop: spacing.xl,
          })}
        >
          <Text style={[s.ctaTxt, { color: allChecked ? palette.night : palette.creamMute }]}>
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
          borderRadius: radius.sm,
          borderWidth: 1.5,
          borderColor: checked ? palette.gold : palette.edge,
          backgroundColor: checked ? palette.gold : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
          marginTop: 2,
        }}
      >
        {checked ? (
          <Text style={s.check} accessibilityElementsHidden importantForAccessibility="no">
            ✓
          </Text>
        ) : null}
      </View>
      <Text style={s.checkLabel}>{label}</Text>
    </Pressable>
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
  optional: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
  check: { color: palette.night, fontFamily: fonts.bodySemi, fontSize: 14 },
  checkLabel: {
    flex: 1,
    color: palette.cream,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.4,
  },
  ctaTxt: { fontFamily: fonts.bodyMedium, fontSize: fontSize.body, letterSpacing: 0.5 },
};
