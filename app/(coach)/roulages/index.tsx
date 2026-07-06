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
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button. Logique inchangée.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';

import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { type Roulage, ROULAGE_STATUS_LABELS, splitRoulagesByTime } from '@/services/roulagesLogic';
import { listMyRoulages } from '@/services/roulagesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateTime } from '@/utils/format';

export default function CoachRoulagesScreen() {
  const { permissions, loading: permLoading } = useCoachPermissions();
  const [roulages, setRoulages] = useState<Roulage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    listMyRoulages()
      .then((rows) => {
        setRoulages(rows);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(false);
      listMyRoulages()
        .then((rows) => {
          if (!cancelled) {
            setRoulages(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (permLoading) {
    return (
      <Screen scroll={false}>
        <AppBar title="ROULAGES" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  // Feature gardée : permission non accordée → message sobre.
  if (!permissions.canManageOwnSessions) {
    return (
      <Screen>
        <AppBar title="ROULAGES" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
          <Header />
          <Card style={{ marginTop: theme.spacing.xl }}>
            <Text style={s.manifest}>
              La gestion des roulages n&apos;est pas activée sur votre compte.
            </Text>
            <Text style={s.caption}>
              Cette fonctionnalité est ouverte au cas par cas par l&apos;équipe OXV.
            </Text>
          </Card>
        </View>
      </Screen>
    );
  }

  const { upcoming, past } = splitRoulagesByTime(roulages, new Date().toISOString());

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : roulages.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="ROULAGES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Header />

        <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl }}>
          <Link href={'/(coach)/roulages/nouveau' as never} asChild>
            <Button label="Créer un roulage" />
          </Link>
        </View>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucun roulage pour l'instant."
          emptyMessage="Créez-en un pour convier vos pilotes."
          errorCause="La liste de vos roulages n'a pas pu être chargée."
          onRetry={reload}
        >
          {upcoming.length > 0 ? (
            <Section title="À venir">
              {upcoming.map((r) => (
                <RoulageCard key={r.id} roulage={r} />
              ))}
            </Section>
          ) : null}
          {past.length > 0 ? (
            <Section title="Passés">
              {past.map((r) => (
                <RoulageCard key={r.id} roulage={r} muted />
              ))}
            </Section>
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

function Header() {
  return (
    <>
      <View style={{ marginBottom: theme.spacing.md }}>
        <RoleBadge role="coach" />
      </View>
      <Text style={s.eyebrow}>COACH OXV</Text>
      <Text style={s.title} accessibilityRole="header">
        Vos roulages.
      </Text>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: theme.spacing.xxl }}>
      <View style={{ marginBottom: theme.spacing.md }}>
        <SectionLabel>{title}</SectionLabel>
      </View>
      <View style={{ gap: theme.spacing.md }}>{children}</View>
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
        accessibilityRole="button"
        accessibilityLabel={`${roulage.title}, ${formatDateTime(roulage.startsAt)}, ${roulage.circuitName}${
          roulage.status !== 'open' ? `, ${ROULAGE_STATUS_LABELS[roulage.status]}` : ''
        }`}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : muted ? 0.7 : 1 })}
      >
        <Card style={muted ? undefined : { borderColor: theme.palette.coach }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[s.cardTitle, { flex: 1 }]}>{roulage.title}</Text>
            {roulage.status !== 'open' ? (
              <Text style={s.statusLabel}>{ROULAGE_STATUS_LABELS[roulage.status]}</Text>
            ) : null}
          </View>
          <Text style={[s.caption, { marginTop: theme.spacing.xs }]}>
            {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
          </Text>
        </Card>
      </Pressable>
    </Link>
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
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  // Statut = libellé (mot), donc pas en mono. Micro-badge sobre, tracké.
  statusLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginLeft: theme.spacing.sm,
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
