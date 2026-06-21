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
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
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
    return (
      <Screen scroll={false}>
        <AppBar title="ROULAGES" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
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

        {loading ? (
          <ActivityIndicator
            color={theme.palette.creamMute}
            style={{ marginTop: theme.spacing.xl }}
          />
        ) : roulages.length === 0 ? (
          <EmptyState />
        ) : (
          <>
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
          </>
        )}
      </View>
    </Screen>
  );
}

function Header() {
  return (
    <>
      <Text style={s.eyebrow}>COACH OXV</Text>
      <Text style={s.title}>Vos roulages.</Text>
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
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : muted ? 0.7 : 1 })}>
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

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={[s.manifest, { textAlign: 'center' }]}>Aucun roulage pour l&apos;instant.</Text>
      <Text style={[s.caption, { textAlign: 'center', marginTop: theme.spacing.md }]}>
        Créez-en un pour convier vos pilotes.
      </Text>
    </Card>
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
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
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
