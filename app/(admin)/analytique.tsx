/**
 * Admin vue 3 — Analytique.
 *
 * Métriques globales post-session : nombre de sessions sur la période,
 * pilotes uniques, marge moyenne par tier (anonymisée). Export PDF en
 * V1.1 (Edge Function dédiée).
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel. Accent bronze conservé
 * (couleur de rôle admin). Logique de données inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';

interface AnalyticsSummary {
  totalSessions: number;
  totalPilots: number;
  avgMargin: number | null;
}

export default function AnalytiqueScreen() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sessionsRes, analysesRes] = await Promise.all([
        supabase
          .from('telemetry_sessions')
          .select('id, user_id', { count: 'exact' })
          .eq('status', 'completed'),
        supabase.from('app_session_analyses').select('margin_global'),
      ]);
      if (cancelled) return;

      const sessions = sessionsRes.data ?? [];
      const analyses = analysesRes.data ?? [];
      const uniquePilots = new Set(sessions.map((s) => s.user_id)).size;
      const margins = analyses
        .map((a) => Number(a.margin_global ?? 0))
        .filter((m) => Number.isFinite(m));
      const avgMargin =
        margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : null;

      setSummary({
        totalSessions: sessionsRes.count ?? sessions.length,
        totalPilots: uniquePilots,
        avgMargin,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="ANALYTIQUE" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRONZE} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="ANALYTIQUE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ADMIN · ANALYTIQUE</Text>
        <Text style={s.title}>Vue d&apos;ensemble</Text>

        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
          <BigStat label="Sessions complétées" value={String(summary?.totalSessions ?? 0)} />
          <BigStat label="Pilotes uniques" value={String(summary?.totalPilots ?? 0)} />
          <BigStat
            label="Marge moyenne"
            value={summary?.avgMargin !== null ? `${Math.round(summary?.avgMargin ?? 0)}%` : '—'}
          />
        </View>

        <Text style={s.footnote}>Export PDF et tris avancés en V1.1.</Text>
      </View>
    </Screen>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ borderColor: BRONZE, alignItems: 'center', paddingVertical: theme.spacing.xl }}>
      <Text style={s.bigValue}>{value}</Text>
      <Text style={s.bigLabel}>{label}</Text>
    </Card>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  bigValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.palette.cream,
    marginBottom: theme.spacing.sm,
  },
  bigLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
};
