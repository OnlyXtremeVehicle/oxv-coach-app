/**
 * Écran #22 — Paddock entre runs. Design V2 (charte oxv-mirror-app).
 *
 * Pendant la session, entre deux runs (état S7 actif après un premier
 * roulage). Vue compacte du dernier run effectué + invitation à préparer
 * le suivant.
 *
 * Doctrine : *"À chaud, l'essentiel."* — pas le bilan complet, juste
 * l'indicateur principal pour ne pas surcharger entre deux tours.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button du kit, chrono en
 * mono (voix de l'instrument). Écran d'état de flux sans retour manuel.
 * Logique de données inchangée.
 */

import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { useSessionStore } from '@/store/useSessionStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatChronoMs } from '@/utils/time';

export default function EntreRunsScreen() {
  const lapCount = useSessionStore((s) => s.lapCount);
  const bestLapMs = useSessionStore((s) => s.bestLapMs);

  // Doctrine « jamais de fausse donnée » : aucune marge fabriquée à chaud.
  // La marge composite se calcule au bilan, après la session. Ici, on ne
  // montre que du réel : le meilleur tour et le nombre de tours.

  return (
    <Screen scroll={false}>
      <AppBar title="ENTRE LES RUNS" />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        <Text style={s.title}>À chaud, l'essentiel.</Text>

        <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <SectionLabel>Meilleur tour</SectionLabel>
          <Text style={s.chrono}>{bestLapMs !== null ? formatChronoMs(bestLapMs) : '—'}</Text>
          <Text style={s.note}>
            {lapCount} {lapCount > 1 ? 'tours' : 'tour'} · la marge se lit au bilan, après la
            session.
          </Text>
        </Card>

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
  chrono: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.hud,
    color: theme.palette.cream,
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
