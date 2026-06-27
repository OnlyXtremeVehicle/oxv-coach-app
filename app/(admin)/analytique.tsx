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
  const [failed, setFailed] = useState(false);

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

      if (sessionsRes.error || analysesRes.error) {
        setFailed(true);
        setLoading(false);
        return;
      }

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
        <Text style={s.title} accessibilityRole="header">
          Vue d&apos;ensemble
        </Text>

        {failed ? (
          <Card style={{ borderColor: theme.palette.line, paddingVertical: theme.spacing.xl }}>
            <Text style={s.errorTitle}>Métriques indisponibles</Text>
            <Text style={s.errorHint}>
              La lecture des sessions a échoué. Vérifiez la connexion, puis rouvrez cet écran.
            </Text>
          </Card>
        ) : (
          <>
            {/* Chiffre dominant unique : le volume de sessions. Le reste est secondaire. */}
            <HeroStat label="Sessions complétées" value={String(summary?.totalSessions ?? 0)} />

            <View
              style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md }}
            >
              <MiniStat label="Pilotes uniques" value={String(summary?.totalPilots ?? 0)} />
              <MiniStat
                label="Marge moyenne"
                value={summary?.avgMargin != null ? `${Math.round(summary.avgMargin)} %` : '—'}
              />
            </View>

            <Text style={s.footnote}>Export PDF et tris avancés en V1.1.</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ borderColor: BRONZE, alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.heroValue} accessibilityLabel={`${value} ${label}`}>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.lg }}>
      <Text style={s.miniValue} accessibilityLabel={`${value} ${label}`}>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
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
    marginBottom: theme.spacing.xl,
  },
  // Chiffre dominant : mono (la voix de l'instrument), taille hud-réduite.
  heroValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.palette.cream,
    marginBottom: theme.spacing.sm,
  },
  // Chiffres secondaires : mono mais plus discrets, pour ne pas concurrencer.
  miniValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.xs,
  },
  // Libellé = corps (jamais mono sur un libellé, doctrine).
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  errorTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  errorHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
  },
};
