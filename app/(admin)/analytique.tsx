/**
 * Admin vue 3 — Analytique.
 *
 * Métriques globales post-session : nombre de sessions sur la période,
 * pilotes uniques, marge moyenne par tier (anonymisée). Export PDF en
 * V1.1 (Edge Function dédiée).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.accent.bronze} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.bronze }]}>
          ADMIN · ANALYTIQUE
        </Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          Vue d'ensemble
        </Text>

        <View style={{ gap: spacing.md, marginBottom: spacing.xxxl }}>
          <BigStat label="Sessions complétées" value={String(summary?.totalSessions ?? 0)} />
          <BigStat label="Pilotes uniques" value={String(summary?.totalPilots ?? 0)} />
          <BigStat
            label="Marge moyenne"
            value={summary?.avgMargin !== null ? `${Math.round(summary?.avgMargin ?? 0)}%` : '—'}
          />
        </View>

        <Text style={[typography.caption, { color: colors.text.tertiary, textAlign: 'center' }]}>
          Export PDF et tris avancés en V1.1.
        </Text>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        padding: spacing.xl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.accent.bronze,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.hero,
          fontWeight: fontWeight.ultralight,
          marginBottom: spacing.sm,
        }}
      >
        {value}
      </Text>
      <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>{label}</Text>
    </View>
  );
}
