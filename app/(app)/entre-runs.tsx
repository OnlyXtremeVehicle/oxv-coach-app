/**
 * Écran #22 — Paddock entre runs. Transposition gaming (cockpit factuel).
 *
 * Pendant la session, entre deux runs (état S7 actif après un premier
 * roulage). Vue compacte du dernier run effectué + invitation à préparer
 * le suivant.
 *
 * Doctrine : *"À chaud, l'essentiel."* — pas le bilan complet, juste
 * l'indicateur principal pour ne pas surcharger entre deux tours.
 *
 * Gaming : le meilleur tour (seul nombre dominant) passe en boîtier cockpit
 * (`cockpitPanel`), chrono à lueur dorée, barre de statut « vivante » (point
 * clignotant or — la session est en cours). L'or = la donnée, jamais le
 * jugement ; aucune marge fabriquée à chaud. Logique de données inchangée.
 */

import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { router } from 'expo-router';

import { cockpitPanel } from '@/components/insights/vizChrome';
import { useSessionStore } from '@/store/useSessionStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { formatChronoMs } from '@/utils/time';

export default function EntreRunsScreen() {
  const lapCount = useSessionStore((s) => s.lapCount);
  const bestLapMs = useSessionStore((s) => s.bestLapMs);

  // Point de statut « vivant » : la session n'est pas finie, on est entre runs.
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.32, duration: 1200, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  return (
    <Screen scroll={false}>
      <AppBar title="ENTRE LES RUNS" />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        <Text style={s.title} accessibilityRole="header">
          À chaud, l&apos;essentiel.
        </Text>

        <View style={s.panel}>
          <View style={s.status}>
            <Animated.View
              style={[s.dotLive, { opacity: blink }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={s.statusLabel}>Meilleur tour · à chaud</Text>
          </View>
          <Text
            style={s.chrono}
            accessibilityLabel={
              bestLapMs !== null
                ? `Meilleur tour à chaud : ${formatChronoMs(bestLapMs)}`
                : 'Meilleur tour à chaud : non disponible'
            }
          >
            {bestLapMs !== null ? formatChronoMs(bestLapMs) : '—'}
          </Text>
          <Text style={s.note}>
            {lapCount} {lapCount > 1 ? 'tours' : 'tour'} · la marge se lit au bilan, après la
            session.
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <Button
          label="Préparer le prochain run"
          onPress={() => router.replace('/(app)/equipement')}
        />
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xxl,
  },
  panel: {
    ...cockpitPanel,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  status: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  dotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.gold,
  },
  chrono: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.hud,
    color: theme.palette.cream,
    textShadowColor: 'rgba(255,183,3,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
};
