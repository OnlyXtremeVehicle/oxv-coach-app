/**
 * Programme — vue pilote en LECTURE SEULE des programmes partagés par son coach
 * (C-2, V1.5). Zone Progression.
 *
 * Le pilote consulte ce que son coach a façonné et partagé. Il ne modifie rien,
 * ne coche rien (le statut « atteint » est l'observation du coach). S'il veut
 * réagir, c'est dans son carnet. Doctrine : la piste est à vous, les décisions
 * aussi. Vouvoiement, pas d'emoji, pas de score chiffré.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import { type SharedCycle, listSharedCyclesForMe } from '@/services/developmentCycleService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function ProgrammeScreen() {
  const [cycles, setCycles] = useState<SharedCycle[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listSharedCyclesForMe().then((rows) => {
      if (!cancelled) {
        setCycles(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  return (
    <Screen>
      <AppBar title="PROGRAMME" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE COACH</Text>
        <Text style={s.title} accessibilityRole="header">
          Votre programme.
        </Text>
        <Text style={s.intro}>
          Ce que votre coach a façonné avec vous. À lire posément. Les décisions restent les vôtres.
        </Text>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.lg }}>
          {!loading && cycles.length === 0 ? (
            <EmptyState
              label="Aucun programme"
              message="Votre coach n'a pas encore partagé de programme."
            />
          ) : (
            cycles.map((c) => (
              <Card key={c.id} style={{ gap: theme.spacing.md, borderColor: theme.palette.coach }}>
                <Text style={s.cycleTitle}>{c.title}</Text>
                {c.intention ? <Text style={s.intention}>{c.intention}</Text> : null}
                <View style={{ gap: theme.spacing.sm }}>
                  <SectionLabel>{`Axes (${c.steps.length})`}</SectionLabel>
                  {c.steps.map((step) => (
                    <View key={step.id} style={s.stepRow}>
                      <View
                        style={[
                          s.dot,
                          {
                            backgroundColor:
                              step.status === 'atteint' ? theme.palette.gold : theme.palette.faint,
                          },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.focus}>{step.focus}</Text>
                        {step.note ? <Text style={s.caption}>{step.note}</Text> : null}
                        <Text style={s.statusLabel}>
                          {step.status === 'atteint' ? 'Atteint' : 'En cours'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            ))
          )}
        </View>
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
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  cycleTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  intention: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.body * 1.5,
  },
  stepRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    alignItems: 'flex-start' as const,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  focus: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.45,
    marginTop: theme.spacing.xs,
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
};
