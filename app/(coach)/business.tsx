/**
 * Vue Coach — tableau de bord business (§10.2 OXV Mirror).
 *
 * Décision Gabin (2026-06-07, cahier v3 §10.2 sans la remise) : suivi
 * factuel de l'activité du coach — ses pilotes, ses roulages, ses présences
 * confirmées, le revenu cumulé de ses roulages tarifés.
 *
 * Gating : permission can_view_business_dashboard (§8.1). Si non activée,
 * message sobre, aucune donnée exposée.
 *
 * Doctrine : chiffres factuels, aucun classement, aucune remise, vouvoiement.
 * Aucun chiffre fabriqué — le revenu n'apparaît que si des roulages sont
 * tarifés.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Fact, accent coach neutre.
 * Logique inchangée (permissions, chargement, calculs de revenu).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { loadCoachBusinessSummary } from '@/services/coachBusinessService';
import { type CoachBusinessSummary } from '@/services/roulagesLogic';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatPriceCents } from '@/utils/format';

export default function CoachBusinessScreen() {
  const { permissions, loading: permLoading } = useCoachPermissions();
  const [summary, setSummary] = useState<CoachBusinessSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      loadCoachBusinessSummary()
        .then((s) => {
          if (!cancelled) {
            setSummary(s);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (permLoading) {
    return (
      <Screen scroll={false}>
        <AppBar title="BUSINESS" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  // Feature gardée : permission non accordée → message sobre.
  if (!permissions.canViewBusinessDashboard) {
    return (
      <Screen>
        <AppBar title="BUSINESS" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
          <Header />
          <Card style={{ marginTop: theme.spacing.xl }}>
            <Text style={s.manifest}>
              Le tableau de bord business n&apos;est pas activé sur votre compte.
            </Text>
            <Text style={s.caption}>
              Cet accès est ouvert au cas par cas par l&apos;équipe OXV.
            </Text>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="BUSINESS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Header />

        {loading || !summary ? (
          <ActivityIndicator
            color={theme.palette.creamMute}
            style={{ marginTop: theme.spacing.xxl }}
          />
        ) : (
          <View style={{ marginTop: theme.spacing.xl }}>
            {/* Revenu cumulé — l'indicateur central */}
            <Card
              style={{
                borderColor: theme.palette.coach,
                alignItems: 'center',
                paddingVertical: theme.spacing.xl,
                marginBottom: theme.spacing.xl,
              }}
            >
              <SectionLabel>Revenu de vos roulages</SectionLabel>
              <Text style={s.hero}>{formatPriceCents(summary.totalRevenueCents)}</Text>
              <Text style={[s.caption, { textAlign: 'center', marginTop: theme.spacing.xs }]}>
                {summary.totalRevenueCents === 0
                  ? 'Renseignez un prix sur vos roulages pour suivre vos revenus.'
                  : 'Cumul des présences confirmées sur vos roulages tarifés.'}
              </Text>
            </Card>

            {/* Stats secondaires */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Fact
                label={summary.pilotCount > 1 ? 'Pilotes' : 'Pilote'}
                value={String(summary.pilotCount)}
              />
              <Fact
                label={summary.activeRoulageCount > 1 ? 'Roulages' : 'Roulage'}
                value={String(summary.activeRoulageCount)}
              />
              <Fact
                label={summary.totalAccepted > 1 ? 'Présences' : 'Présence'}
                value={String(summary.totalAccepted)}
              />
            </View>

            <View style={{ marginTop: theme.spacing.xxl }}>
              <Button
                label="Gérer mes roulages"
                variant="ghost"
                onPress={() => router.push('/(coach)/roulages' as never)}
              />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

function Header() {
  return (
    <>
      <Text style={s.eyebrow}>COACH OXV</Text>
      <Text style={s.title}>Votre activité.</Text>
    </>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  hero: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
