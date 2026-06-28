/**
 * Partenaire — Mes rapports B2B (PR-38).
 *
 * Affiche les rapports d'événement PARTAGÉS par OXV : participation (agrégat
 * figé), temps forts média, conclusion. Aucune donnée pilote individuelle.
 * Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { type MySharedReport, listMySharedReports } from '@/services/b2bReportService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';

export default function PartnerReportsScreen() {
  const [reports, setReports] = useState<MySharedReport[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listMySharedReports().then((rows) => {
      if (!cancelled) {
        setReports(rows);
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
      <AppBar title="MES RAPPORTS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>RAPPORTS B2B</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos événements.
        </Text>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          {!loading && reports.length === 0 ? (
            <EmptyState
              label="Aucun rapport"
              message="Vous n'avez pas encore de rapport partagé."
              source="b2b_event_reports"
            />
          ) : (
            reports.map((r) => (
              <Card key={r.id} style={{ gap: theme.spacing.md }}>
                <Text style={s.name}>{r.event?.name ?? 'Événement'}</Text>
                {r.event ? <Text style={s.meta}>{r.event.locationName}</Text> : null}
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <Fact value={r.registeredCount.toString()} label="inscrits" />
                  <Fact value={r.checkedInCount.toString()} label="présents" />
                </View>
                {r.mediaSummary ? (
                  <View>
                    <Text style={s.blockLabel}>TEMPS FORTS</Text>
                    <Text style={s.body}>{r.mediaSummary}</Text>
                  </View>
                ) : null}
                {r.conclusion ? (
                  <View>
                    <Text style={s.blockLabel}>CONCLUSION</Text>
                    <Text style={s.body}>{r.conclusion}</Text>
                  </View>
                ) : null}
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
    color: theme.palette.creamMute,
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
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  blockLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xs,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
