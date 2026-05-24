/**
 * Écran #11 — Vos données sont en sécurité.
 *
 * Pendant la sync UBX → Supabase Storage. Vocabulaire OXV : "Préservation"
 * et pas "Sauvegarde" (la sauvegarde sonne contrainte, la préservation
 * sonne soin).
 *
 * V1 : sync UBX déjà câblée via uploadTelemetryFile (sem 3). Pour
 * l'instant, l'écran est purement visuel (compteur factice + transition
 * temporisée). En sem 11, on branchera la progression réelle de l'upload.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

const SIMULATED_UPLOAD_MS = 6_000;

export default function DonneesSecuriteScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / SIMULATED_UPLOAD_MS) * 100);
      setProgress(pct);
    }, 200);
    const done = setTimeout(() => {
      router.replace({
        pathname: '/(app)/bilan-pret',
        params: { sessionId: params.sessionId ?? '' },
      });
    }, SIMULATED_UPLOAD_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [params.sessionId]);

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
          PRÉSERVATION
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.headline,
            fontWeight: fontWeight.light,
            lineHeight: fontSize.headline * 1.2,
            marginBottom: spacing.xl,
          }}
        >
          Vos données sont en sécurité.
        </Text>

        <ProgressBar percent={progress} />

        <Text style={[typography.caption, { marginTop: spacing.md }]}>
          Préservation en cours… {Math.round(progress)} %
        </Text>
      </View>
    </SafeAreaView>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <View
      style={{
        height: 3,
        backgroundColor: colors.background.secondary,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${percent}%`,
          backgroundColor: colors.accent.red,
        }}
      />
    </View>
  );
}
