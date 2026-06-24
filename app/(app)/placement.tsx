/**
 * Écran #09 — Placement. Design V2 (charte oxv-mirror-app).
 *
 * Dernière étape paddock avant le silence en piste. Instructions de
 * placement physique du boîtier. À l'action "C'est fait", l'app entre
 * dans S6 (roulage) — aucun écran ne sera affiché jusqu'à la fin de
 * session.
 *
 * Doctrine : sous-titre rassurant *"Vous le verrez peu. Il s'occupera
 * du reste."* — pose la promesse du silence.
 *
 * Reskin V2 : Screen + AppBar, titres Syncopate, illustration en Card.
 * Écran d'état de flux sans retour manuel. Le CTA reste un Pressable
 * (indicateur de chargement pendant le démarrage de la capture). Logique
 * de capture inchangée.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { success as hapticSuccess } from '@/lib/haptics';
import { startCaptureSession } from '@/services/captureSessionService';
import { getDefaultCircuit } from '@/services/circuitsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function PlacementScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onStart() {
    if (starting) return;
    if (!profile?.id) {
      setError('Profil non chargé. Reconnectez-vous.');
      return;
    }
    setStarting(true);
    setError(null);
    // Rattache la session au circuit courant réel (multi-circuit) plutôt qu'à un
    // nom en dur. Si la base ne répond pas, le service applique son repli générique.
    const circuit = await getDefaultCircuit();
    // Démarre l'enregistrement réel (création session + écriture des trames).
    const res = await startCaptureSession({
      userId: profile.id,
      circuitId: circuit?.id ?? null,
      circuitName: circuit?.name ?? null,
    });
    if (res.ok) {
      hapticSuccess();
      router.replace('/(app)/roulage');
    } else {
      setStarting(false);
      setError(res.error ?? "L'enregistrement n'a pas pu démarrer.");
    }
  }

  return (
    <Screen scroll={false}>
      <AppBar title="PLACEMENT" />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={s.eyebrow}>PLACEMENT</Text>

          <Text style={s.headline}>Posez le boîtier sur le support magnétique côté passager.</Text>

          {/* Illustration schématique simple : un bloc qui évoque le tableau de bord */}
          <Card
            style={{
              height: 160,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing.xxl,
            }}
          >
            <View style={s.badge}>
              <Text style={s.badgeTxt}>OXV</Text>
            </View>
            <View style={{ marginTop: theme.spacing.md }}>
              <SectionLabel>Support magnétique</SectionLabel>
            </View>
          </Card>

          <Text style={s.manifest}>Vous le verrez peu. Il s'occupera du reste.</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={starting}
          onPress={onStart}
          style={({ pressed }) => [
            s.cta,
            starting && s.ctaDisabled,
            (pressed || starting) && { opacity: 0.85 },
          ]}
        >
          {starting ? <ActivityIndicator color="#000" /> : <Text style={s.ctaTxt}>C'est fait</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginBottom: theme.spacing.lg,
  },
  headline: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.3,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginBottom: theme.spacing.xxl,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.red,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeTxt: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.small,
    letterSpacing: 1,
    color: theme.palette.cream,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    lineHeight: theme.fontSize.body * 1.5,
    color: theme.palette.red,
    marginTop: theme.spacing.lg,
  },
  cta: {
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.palette.cream,
  },
  ctaDisabled: { backgroundColor: '#2a2a2e' },
  ctaTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: '#000',
  },
};
