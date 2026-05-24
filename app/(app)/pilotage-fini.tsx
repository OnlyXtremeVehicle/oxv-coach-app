/**
 * Écran #10 — Vous avez piloté.
 *
 * Reconnaissance émotionnelle de la fin de session. Transition automatique
 * vers #11 après 4 secondes — pas de bouton, on respecte le rythme.
 *
 * Doctrine : utilise le passé composé ("Vous avez piloté.") pour marquer
 * l'événement, sans valorisation ni jugement.
 */

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useSessionStore } from '@/store/useSessionStore';
import { colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

const TRANSITION_MS = 4_000;

export default function PilotageFiniScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const lapCount = useSessionStore((s) => s.lapCount);
  const meta = useSessionStore((s) => s.meta);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/(app)/donnees-securite',
        params: { sessionId: params.sessionId ?? '' },
      });
    }, TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [params.sessionId]);

  const startedAt = meta?.startedAt ?? null;
  const endedAt = meta?.endedAt ?? new Date();
  const durationMin =
    startedAt && endedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000) : null;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
        >
          SESSION TERMINÉE
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.display,
            fontWeight: fontWeight.ultralight,
            lineHeight: fontSize.display * 1.15,
            textAlign: 'center',
            marginBottom: spacing.xxl,
          }}
        >
          Vous avez piloté.
        </Text>

        {durationMin !== null || lapCount > 0 ? (
          <Text style={[typography.caption, { textAlign: 'center' }]}>
            {[
              durationMin !== null ? `${durationMin} min` : null,
              lapCount > 0 ? `${lapCount} tour${lapCount > 1 ? 's' : ''}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
