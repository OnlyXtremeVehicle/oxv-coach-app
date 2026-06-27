/**
 * Écran #11 — Vos données sont en sécurité.
 *
 * Pendant la préservation : upload .ubx (déjà câblé sem 3) PLUS
 * `analyzeAndPersistSession` (sem 13) qui calcule les marges par segment
 * et la marge globale, puis transitionne vers #12 « Bilan prêt ».
 *
 * Vocabulaire OXV : "Préservation" et pas "Sauvegarde" (la sauvegarde
 * sonne contrainte, la préservation sonne soin).
 *
 * Robustesse :
 *   - Si l'analyse échoue, on transitionne quand même vers #12 (le bilan
 *     affichera le fallback approprié — pas de blocage utilisateur).
 *   - Timeout de sécurité de 30 s : si l'analyse traîne, on passe à #12
 *     en arrière-plan et l'analyse continue son chemin.
 *   - La barre de progression est animée pour rester rassurante même si
 *     l'analyse est instantanée (lecture DB rapide).
 *
 * Reskin V2 : Screen (non défilant) + SectionLabel, typo/couleurs @/theme/v2.
 * Logique inchangée (progression animée, timeout de sécurité, analyse).
 */

import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { analyzeAndPersistSession } from '@/services/analyzeSessionService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const MIN_VISIBLE_MS = 3_500;
const SAFETY_TIMEOUT_MS = 30_000;

export default function DonneesSecuriteScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; ubxUri?: string }>();
  const userId = useAuthStore((s) => s.profile?.id);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'preserve' | 'analyze' | 'done'>('preserve');
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const startedAt = Date.now();

    // Progression animée — atteint 92% en MIN_VISIBLE_MS, puis attend la fin
    // réelle de l'analyse pour finir à 100%.
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const animated = Math.min(92, (elapsed / MIN_VISIBLE_MS) * 92);
      setProgress((cur) => (cur >= 100 ? 100 : Math.max(cur, animated)));
      if (elapsed > MIN_VISIBLE_MS / 2) setPhase((p) => (p === 'preserve' ? 'analyze' : p));
    }, 150);

    const safety = setTimeout(() => {
      if (cancelled.current) return;
      goToBilanPret();
    }, SAFETY_TIMEOUT_MS);

    runAnalysis(startedAt);

    return () => {
      cancelled.current = true;
      clearInterval(tick);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId, params.ubxUri, userId]);

  async function runAnalysis(startedAt: number) {
    // Sans sessionId ou sans userId, on temporise simplement et on transitionne.
    if (!params.sessionId || !userId) {
      await waitUntilMinVisible(startedAt);
      if (!cancelled.current) goToBilanPret();
      return;
    }

    try {
      const result = await analyzeAndPersistSession({
        telemetrySessionId: params.sessionId,
        userId,
        localUbxUri: params.ubxUri,
      });
      // Log non bloquant pour le debug — la doctrine veut zéro instruction
      // affichée au pilote, mais un log dev reste utile.
      console.warn('[OXV] analyse session :', result);
    } catch (e) {
      console.warn('[OXV] analyse session KO :', e);
    }

    await waitUntilMinVisible(startedAt);
    if (cancelled.current) return;
    setProgress(100);
    setPhase('done');
    setTimeout(goToBilanPret, 400);
  }

  function goToBilanPret() {
    if (cancelled.current) return;
    cancelled.current = true;
    router.replace({
      pathname: '/(app)/bilan-pret',
      params: { sessionId: params.sessionId ?? '' },
    });
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.lg }}>
        <View style={{ marginBottom: theme.spacing.lg }}>
          <SectionLabel>PRÉSERVATION</SectionLabel>
        </View>

        <Text style={styles.headline} accessibilityRole="header">
          Vos données sont en sécurité.
        </Text>

        <ProgressBar percent={progress} />

        <Text style={styles.caption} accessibilityLiveRegion="polite">
          {captionFor(phase, progress)}
        </Text>
      </View>
    </Screen>
  );
}

function captionFor(phase: 'preserve' | 'analyze' | 'done', percent: number): string {
  const rounded = Math.round(percent);
  if (phase === 'done') return 'Bilan prêt.';
  if (phase === 'analyze') return `Lecture de la session… ${rounded} %`;
  return `Préservation en cours… ${rounded} %`;
}

function waitUntilMinVisible(startedAt: number): Promise<void> {
  const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
  return new Promise((resolve) => setTimeout(resolve, remaining));
}

function ProgressBar({ percent }: { percent: number }) {
  const now = Math.round(percent);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now }}
      style={{
        height: 3,
        backgroundColor: theme.palette.card2,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${percent}%`,
          // Progression de préservation/lecture = donnée positive (or),
          // pas un compte à rebours de suppression (le rouge = acte).
          backgroundColor: theme.palette.gold,
        }}
      />
    </View>
  );
}

const styles = {
  headline: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    lineHeight: theme.fontSize.h2 * 1.25,
    color: theme.palette.cream,
    marginBottom: theme.spacing.xl,
  },
  caption: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
};
