/**
 * Admin — Business Dashboard / Analytique (PR-84).
 *
 * Métriques business dérivées des tables existantes : volume de séances (total +
 * 30 jours), pilotes uniques, marge moyenne anonymisée, communauté (pilotes,
 * coachs, partenaires validés), événements (total + à venir). Zéro schéma,
 * admin-only. Back-office : des volumes, jamais un classement entre pilotes.
 * Bronze = couleur de rôle admin. Un seul chiffre dominant (les séances).
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { type BusinessAnalytics, loadBusinessAnalytics } from '@/services/adminAnalyticsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

export default function AnalytiqueScreen() {
  const [data, setData] = useState<BusinessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadBusinessAnalytics(new Date())
      .then((d) => {
        if (cancelled) return;
        if (!d) setFailed(true);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const state: ScreenState = loading ? 'loading' : failed || !data ? 'error' : 'nominal';

  return (
    <Screen>
      <AppBar title="ANALYTIQUE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>ADMIN · BUSINESS</Text>
        <Text style={s.title} accessibilityRole="header">
          Vue d&apos;ensemble
        </Text>

        <StateWrapper
          state={state}
          skeletonLines={5}
          errorCause="La lecture a échoué. Vérifiez la connexion, puis réessayez."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {data ? (
            <>
              {/* Chiffre dominant unique : le volume de séances. */}
              <Card
                style={{
                  borderColor: ADMIN,
                  alignItems: 'center',
                  paddingVertical: theme.spacing.xxl,
                }}
              >
                <Text
                  style={s.heroValue}
                  accessibilityLabel={`${data.totalSessions} séances complétées`}
                >
                  {data.totalSessions}
                </Text>
                <Text style={s.statLabel}>Séances complétées</Text>
                <Text style={s.heroSub}>{data.sessions30d} sur les 30 derniers jours</Text>
              </Card>

              <View style={s.row}>
                <MiniStat label="Pilotes actifs" value={String(data.uniquePilots)} />
                <MiniStat
                  label="Marge moyenne"
                  value={data.avgMarginPct != null ? `${Math.round(data.avgMarginPct)} %` : '—'}
                />
              </View>

              <View style={{ marginTop: theme.spacing.xl }}>
                <SectionLabel>COMMUNAUTÉ</SectionLabel>
                <View style={[s.row, { marginTop: theme.spacing.sm }]}>
                  <MiniStat label="Pilotes" value={String(data.pilotsCount)} />
                  <MiniStat label="Coachs" value={String(data.coachesCount)} />
                  <MiniStat label="Partenaires" value={String(data.partnersValidated)} />
                </View>
              </View>

              <View style={{ marginTop: theme.spacing.xl }}>
                <SectionLabel>ÉVÉNEMENTS</SectionLabel>
                <View style={[s.row, { marginTop: theme.spacing.sm }]}>
                  <MiniStat label="Total" value={String(data.eventsTotal)} />
                  <MiniStat label="À venir" value={String(data.eventsUpcoming)} />
                </View>
              </View>

              <Text style={s.footnote}>
                Volumes anonymisés. Aucun classement individuel. Export PDF en V1.1.
              </Text>
            </>
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
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
    color: ADMIN,
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
  row: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  heroValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.palette.cream,
    marginBottom: theme.spacing.sm,
  },
  heroSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  miniValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
