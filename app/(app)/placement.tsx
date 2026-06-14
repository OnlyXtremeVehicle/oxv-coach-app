/**
 * Écran #09 — Placement.
 *
 * Dernière étape paddock avant le silence en piste. Instructions de
 * placement physique du boîtier. À l'action "C'est fait", l'app entre
 * dans S6 (roulage) — aucun écran ne sera affiché jusqu'à la fin de
 * session.
 *
 * Doctrine : sous-titre rassurant *"Vous le verrez peu. Il s'occupera
 * du reste."* — pose la promesse du silence.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { success as hapticSuccess } from '@/lib/haptics';
import { startCaptureSession } from '@/services/captureSessionService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    // Démarre l'enregistrement réel (création session + écriture des trames).
    const res = await startCaptureSession({ userId: profile.id, circuitName: 'Beltoise' });
    if (res.ok) {
      hapticSuccess();
      router.replace('/(app)/roulage');
    } else {
      setStarting(false);
      setError(res.error ?? "L'enregistrement n'a pas pu démarrer.");
    }
  }

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
          style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
        >
          PLACEMENT
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.headline,
            fontWeight: fontWeight.light,
            lineHeight: fontSize.headline * 1.2,
            marginBottom: spacing.xxl,
          }}
        >
          Posez le boîtier sur le support magnétique côté passager.
        </Text>

        {/* Illustration schématique simple : un rectangle qui évoque le tableau de bord */}
        <View
          style={{
            height: 160,
            borderRadius: borderRadius.lg,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            backgroundColor: colors.background.secondary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xxl,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: borderRadius.md,
              backgroundColor: colors.accent.red,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.caption,
                fontWeight: fontWeight.semibold,
                letterSpacing: 1,
              }}
            >
              OXV
            </Text>
          </View>
          <Text style={[typography.caption, { marginTop: spacing.md }]}>Support magnétique</Text>
        </View>

        <Text style={[typography.manifest, { color: colors.text.secondary }]}>
          Vous le verrez peu. Il s'occupera du reste.
        </Text>

        {error ? (
          <Text
            style={{
              color: colors.system.error,
              fontSize: fontSize.caption,
              marginTop: spacing.lg,
            }}
          >
            {error}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={starting}
        onPress={onStart}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.accent.red,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          opacity: pressed || starting ? 0.85 : 1,
        })}
      >
        {starting ? (
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
            C'est fait
          </Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}
