/**
 * Vue Coach — mes roulages (§8 OXV Mirror).
 *
 * Liste les roulages organisés par le coach courant (à venir / passés),
 * avec un accès à la création et au détail (invitations).
 *
 * Gating : permission modulaire `manage_own_sessions` (§8.1). Si elle n'est
 * pas activée par l'admin, l'écran l'indique sobrement sans rien exposer.
 *
 * Doctrine : lecture factuelle, aucun classement, vouvoiement.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useFocusEffect } from 'expo-router';

import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { type Roulage, ROULAGE_STATUS_LABELS, splitRoulagesByTime } from '@/services/roulagesLogic';
import { listMyRoulages } from '@/services/roulagesService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateTime } from '@/utils/format';

export default function CoachRoulagesScreen() {
  const { permissions, loading: permLoading } = useCoachPermissions();
  const [roulages, setRoulages] = useState<Roulage[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listMyRoulages().then((rows) => {
        if (!cancelled) {
          setRoulages(rows);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (permLoading) {
    return <Centered>{<ActivityIndicator color={colors.text.secondary} />}</Centered>;
  }

  // Feature gardée : permission non accordée → message sobre.
  if (!permissions.canManageOwnSessions) {
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
              La gestion des roulages n&apos;est pas activée sur votre compte.
            </Text>
            <Text
              style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.md }]}
            >
              Cette fonctionnalité est ouverte au cas par cas par l&apos;équipe OXV.
            </Text>
          </View>
          <BackLink />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { upcoming, past } = splitRoulagesByTime(roulages, new Date().toISOString());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Header />

        <Link href={'/(coach)/roulages/nouveau' as never} asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: spacing.xl,
              marginBottom: spacing.xl,
              padding: spacing.lg,
              borderRadius: borderRadius.md,
              backgroundColor: colors.accent.coach,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: colors.background.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.medium,
              }}
            >
              Créer un roulage
            </Text>
          </Pressable>
        </Link>

        {loading ? (
          <ActivityIndicator color={colors.text.secondary} style={{ marginTop: spacing.xl }} />
        ) : roulages.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <Section title="À VENIR">
                {upcoming.map((r) => (
                  <RoulageCard key={r.id} roulage={r} />
                ))}
              </Section>
            ) : null}
            {past.length > 0 ? (
              <Section title="PASSÉS">
                {past.map((r) => (
                  <RoulageCard key={r.id} roulage={r} muted />
                ))}
              </Section>
            ) : null}
          </>
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
      <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>Vos roulages.</Text>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <Text style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}>
        {title}
      </Text>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

function RoulageCard({ roulage, muted }: { roulage: Roulage; muted?: boolean }) {
  return (
    <Link
      href={{ pathname: '/(coach)/roulages/[id]', params: { id: roulage.id } } as never}
      asChild
    >
      <Pressable
        style={({ pressed }) => ({
          padding: spacing.xl,
          borderRadius: borderRadius.lg,
          borderWidth: 0.5,
          borderColor: muted ? colors.border.subtle : colors.accent.coach,
          backgroundColor: colors.background.secondary,
          opacity: pressed ? 0.85 : muted ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.title,
              fontWeight: fontWeight.light,
              flex: 1,
            }}
          >
            {roulage.title}
          </Text>
          {roulage.status !== 'open' ? (
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>
              {ROULAGE_STATUS_LABELS[roulage.status]}
            </Text>
          ) : null}
        </View>
        <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}>
          {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
        </Text>
      </Pressable>
    </Link>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        padding: spacing.xxl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}>
        Aucun roulage pour l&apos;instant.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Créez-en un pour convier vos pilotes.
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </SafeAreaView>
  );
}
