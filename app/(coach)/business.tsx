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
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { loadCoachBusinessSummary } from '@/services/coachBusinessService';
import { type CoachBusinessSummary } from '@/services/roulagesLogic';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  // Feature gardée : permission non accordée → message sobre.
  if (!permissions.canViewBusinessDashboard) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
          <Header />
          <View
            style={{
              marginTop: spacing.xl,
              padding: spacing.xxl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
            }}
          >
            <Text style={[typography.manifest, { color: colors.text.secondary }]}>
              Le tableau de bord business n&apos;est pas activé sur votre compte.
            </Text>
            <Text
              style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.md }]}
            >
              Cet accès est ouvert au cas par cas par l&apos;équipe OXV.
            </Text>
          </View>
          <BackLink />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Header />

        {loading || !summary ? (
          <ActivityIndicator color={colors.text.secondary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <View style={{ marginTop: spacing.xl }}>
            {/* Revenu cumulé — l'indicateur central */}
            <View
              style={{
                padding: spacing.xl,
                borderRadius: borderRadius.lg,
                borderWidth: 0.5,
                borderColor: colors.accent.coach,
                backgroundColor: colors.background.secondary,
                alignItems: 'center',
                marginBottom: spacing.xl,
              }}
            >
              <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>
                REVENU DE VOS ROULAGES
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: 44,
                  fontWeight: fontWeight.light,
                  fontFamily: 'Menlo',
                  marginTop: spacing.sm,
                }}
              >
                {formatPriceCents(summary.totalRevenueCents)}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center' },
                ]}
              >
                {summary.totalRevenueCents === 0
                  ? 'Renseignez un prix sur vos roulages pour suivre vos revenus.'
                  : 'Cumul des présences confirmées sur vos roulages tarifés.'}
              </Text>
            </View>

            {/* Stats secondaires */}
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Stat
                value={summary.pilotCount}
                label={summary.pilotCount > 1 ? 'pilotes' : 'pilote'}
              />
              <Stat
                value={summary.activeRoulageCount}
                label={summary.activeRoulageCount > 1 ? 'roulages' : 'roulage'}
              />
              <Stat
                value={summary.totalAccepted}
                label={summary.totalAccepted > 1 ? 'présences' : 'présence'}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(coach)/roulages' as never)}
              style={({ pressed }) => ({
                marginTop: spacing.xxl,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.accent.coach,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.accent.coach,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.medium,
                }}
              >
                Gérer mes roulages
              </Text>
            </Pressable>
          </View>
        )}

        <BackLink />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <>
      <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>COACH OXV</Text>
      <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>Votre activité.</Text>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.titleLarge,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
        }}
      >
        {value}
      </Text>
      <Text
        style={[
          typography.eyebrow,
          { color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center' },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function BackLink() {
  return (
    <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
      </Pressable>
    </View>
  );
}
