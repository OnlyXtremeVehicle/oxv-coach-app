/**
 * Écran #S6 — Roulage (enregistrement en cours). Design V2 (charte oxv-mirror-app).
 *
 * Doctrine « silence en piste » : pendant que le véhicule bouge, aucun écran
 * n'est consulté. Cet écran est volontairement minimal — il dit au pilote de
 * poser l'appareil, et n'offre qu'une action : terminer le roulage une fois
 * rentré au paddock. Aucune donnée live clignotante.
 *
 * Le service captureSessionService enregistre les trames en base en arrière-plan
 * tant que cet écran (l'app au premier plan) est actif. « Terminer le roulage »
 * clôt la session et bascule vers le flux de bilan (#10 → #11 → #13).
 *
 * Reskin V2 : couleurs et typographie portées sur @/theme/v2 (Screen + AppBar,
 * libellés mono, manifeste Inter Light). Aucune UI ajoutée — l'écran reste
 * volontairement nu, conformément au silence en piste. Logique de capture
 * inchangée.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { success as hapticSuccess } from '@/lib/haptics';
import { abortCaptureSession, stopCaptureSession } from '@/services/captureSessionService';
import { useSessionStore } from '@/store/useSessionStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

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
      router.replace({
        pathname: '/(app)/pilotage-fini',
        params: { sessionId: res.sessionId, ubxUri: res.ubxUri ?? '' },
      });
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
    <Screen scroll={false}>
      <AppBar title="ROULAGE" />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: recording ? theme.palette.red : theme.palette.creamMute,
              marginBottom: theme.spacing.xl,
            }}
          />
          <Text style={s.eyebrow}>{recording ? 'ENREGISTREMENT EN COURS' : 'ENREGISTREMENT'}</Text>
          <Text style={s.headline}>Posez l'appareil. L'app s'occupe du reste.</Text>
          <Text style={s.manifest}>La piste est à vous.</Text>
          {lapCount > 0 ? (
            <Text style={s.lapCount}>
              {lapCount} tour{lapCount > 1 ? 's' : ''} enregistré{lapCount > 1 ? 's' : ''}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={ending}
          onPress={onFinish}
          style={({ pressed }) => [s.finish, (pressed || ending) && { opacity: 0.85 }]}
        >
          {ending ? (
            <ActivityIndicator color={theme.palette.cream} />
          ) : (
            <Text style={s.finishTxt}>Terminer le roulage</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={ending}
          onPress={onAbort}
          style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={s.abortTxt}>Annuler sans enregistrer</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.lg,
  },
  headline: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.3,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xl,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  lapCount: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xxl,
  },
  finish: {
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.palette.red,
    marginBottom: theme.spacing.md,
  },
  finishTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  abortTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
