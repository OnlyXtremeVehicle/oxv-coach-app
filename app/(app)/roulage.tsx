/**
 * Écran #S6 — Roulage (enregistrement en cours).
 *
 * Doctrine « silence en piste » : pendant que le véhicule bouge, aucun écran
 * n'est consulté. Cet écran est volontairement minimal — il dit au pilote de
 * poser l'appareil, et n'offre qu'une action : terminer le roulage une fois
 * rentré au paddock. Aucune donnée live clignotante.
 *
 * Le service captureSessionService enregistre les trames en base en arrière-plan
 * tant que cet écran (l'app au premier plan) est actif. « Terminer le roulage »
 * clôt la session et bascule vers le flux de bilan (#10 → #11 → #13).
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { success as hapticSuccess } from '@/lib/haptics';
import { abortCaptureSession, stopCaptureSession } from '@/services/captureSessionService';
import { useSessionStore } from '@/store/useSessionStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function RoulageScreen() {
  const status = useSessionStore((s) => s.status);
  const lapCount = useSessionStore((s) => s.lapCount);
  const [ending, setEnding] = useState(false);

  async function onFinish() {
    if (ending) return;
    setEnding(true);
    const res = await stopCaptureSession();
    hapticSuccess();
    if (res.ok && res.sessionId) {
      router.replace({ pathname: '/(app)/pilotage-fini', params: { sessionId: res.sessionId } });
    } else {
      // Capture déjà close ou erreur : on ne bloque pas le pilote.
      router.replace('/(app)');
    }
  }

  async function onAbort() {
    if (ending) return;
    setEnding(true);
    await abortCaptureSession();
    router.replace('/(app)');
  }

  const recording = status === 'recording';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background.primary, paddingHorizontal: spacing.xl }}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: recording ? colors.accent.red : colors.text.tertiary,
            marginBottom: spacing.xl,
          }}
        />
        <Text
          style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.lg }]}
        >
          {recording ? 'ENREGISTREMENT EN COURS' : 'ENREGISTREMENT'}
        </Text>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.headline,
            fontWeight: fontWeight.light,
            lineHeight: fontSize.headline * 1.2,
            textAlign: 'center',
            marginBottom: spacing.xl,
          }}
        >
          Posez l'appareil. L'app s'occupe du reste.
        </Text>
        <Text style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}>
          La piste est à vous.
        </Text>
        {lapCount > 0 ? (
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xxl }]}
          >
            {lapCount} tour{lapCount > 1 ? 's' : ''} enregistré{lapCount > 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={ending}
        onPress={onFinish}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.accent.red,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
          opacity: pressed || ending ? 0.85 : 1,
        })}
      >
        {ending ? (
          <ActivityIndicator color={colors.text.primary} />
        ) : (
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.medium,
              letterSpacing: 0.5,
            }}
          >
            Terminer le roulage
          </Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={ending}
        onPress={onAbort}
        style={{
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
        }}
      >
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
          Annuler sans enregistrer
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
