/**
 * Admin — Tour de contrôle du jour (PR-28).
 *
 * La photo opérationnelle d'aujourd'hui en un coup d'œil : événements en cours,
 * pilotes attendus / pointés, sessions enregistrées, sessions à surveiller. Puis
 * les accès rapides vers les outils du jour (en cours, scan présence, qualité,
 * événements).
 *
 * Lecture seule. Aucune télémétrie pilote — seulement des comptes opérationnels.
 * Doctrine : surface admin factuelle, bronze = couleur de rôle admin.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import {
  type ControlTower,
  type ControlTowerEvent,
  loadControlTower,
} from '@/services/adminControlTowerService';
import { eventStatusLabel, eventTypeLabel } from '@/services/eventsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

const LINKS: { href: string; label: string; hint: string }[] = [
  { href: '/(admin)/en-cours', label: 'En cours', hint: 'État Bluetooth en temps réel' },
  { href: '/(admin)/scan-checkin', label: 'Scan présence', hint: 'Pointer les arrivées' },
  { href: '/(admin)/qualite-data', label: 'Qualité data', hint: 'Sessions à surveiller' },
  { href: '/(admin)/evenements', label: 'Événements', hint: 'Gérer et inscrire' },
];

function timeWindow(startsAt: string, endsAt: string): string {
  try {
    const opt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    return `${new Date(startsAt).toLocaleTimeString('fr-FR', opt)} – ${new Date(
      endsAt
    ).toLocaleTimeString('fr-FR', opt)}`;
  } catch {
    return '';
  }
}

export default function TourControleScreen() {
  const [data, setData] = useState<ControlTower | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadControlTower(new Date())
      .then((d) => {
        if (!cancelled) {
          setData(d);
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
  }, []);

  useFocusEffect(reload);

  const ct = data;
  // Pas d'état « vide » : le tour de contrôle affiche toujours son tableau de
  // bord une fois chargé (une journée calme reste une journée à surveiller —
  // 0 événement + N pilotes attendus ne doit jamais masquer le dashboard).
  const state: ScreenState = loading ? 'loading' : error || !ct ? 'error' : 'nominal';

  return (
    <Screen>
      <AppBar title="TOUR DE CONTRÔLE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <StateWrapper
          state={state}
          skeletonLines={5}
          errorCause="Le tour de contrôle n'a pas pu être chargé."
          onRetry={reload}
        >
          <Text style={s.eyebrow}>AUJOURD’HUI</Text>
          <Text style={s.title} accessibilityRole="header">
            La journée en cours
          </Text>

          {/* Chiffre dominant : pilotes attendus aujourd'hui. */}
          <View style={s.heroRow}>
            <Text style={s.hero}>{ct?.expectedPilots ?? 0}</Text>
            <Text style={s.heroLabel}>
              {(ct?.expectedPilots ?? 0) > 1 ? 'pilotes attendus' : 'pilote attendu'}
            </Text>
          </View>

          {/* Comptes secondaires. */}
          <View style={s.factsRow}>
            <Fact value={String(ct?.checkedInPilots ?? 0)} label="pointés" />
            <Fact value={String(ct?.sessionsToday ?? 0)} label="sessions du jour" />
            <Fact
              value={String(ct?.anomaliesCount ?? 0)}
              label="à surveiller"
              tone={(ct?.anomaliesCount ?? 0) > 0 ? 'warn' : 'ok'}
            />
          </View>

          {/* Événements du jour. */}
          <View style={{ marginTop: theme.spacing.xl }}>
            <SectionLabel>ÉVÉNEMENTS DU JOUR</SectionLabel>
            {!ct || ct.todayEvents.length === 0 ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <EmptyState
                  label="Journée calme"
                  message="Aucun événement actif aujourd'hui."
                  source="events"
                />
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {ct.todayEvents.map((e) => (
                  <EventRow key={e.event.id} item={e} />
                ))}
              </View>
            )}
          </View>

          {/* Accès rapides. */}
          <View style={{ marginTop: theme.spacing.xl }}>
            <SectionLabel>OUTILS DU JOUR</SectionLabel>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              {LINKS.map((l) => (
                <Card
                  key={l.href}
                  onPress={() => router.push(l.href as never)}
                  accessibilityLabel={`${l.label}. ${l.hint}`}
                  style={{ borderColor: ADMIN }}
                >
                  <View style={s.linkHead}>
                    <Text style={s.linkLabel}>{l.label}</Text>
                    <Text style={s.linkChevron}>›</Text>
                  </View>
                  <Text style={s.linkHint}>{l.hint}</Text>
                </Card>
              ))}
            </View>
          </View>
        </StateWrapper>
      </View>
    </Screen>
  );
}

function EventRow({ item }: { item: ControlTowerEvent }) {
  const { event, ongoing, registered, checkedIn } = item;
  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/(admin)/evenements/[id]', params: { id: event.id } } as never)
      }
      accessibilityLabel={`${event.name}. ${checkedIn} sur ${registered} pointés.`}
      style={{ borderColor: ongoing ? ADMIN : theme.palette.line }}
    >
      <View style={s.eventHead}>
        <Text style={s.eventName} numberOfLines={1}>
          {event.name}
        </Text>
        {ongoing ? <Text style={s.ongoing}>EN COURS</Text> : null}
      </View>
      <Text style={s.eventMeta}>
        {eventTypeLabel(event.eventType)} · {timeWindow(event.startsAt, event.endsAt)} ·{' '}
        {eventStatusLabel(event.status)}
      </Text>
      <Text style={s.eventCount}>
        <Text style={s.eventCountStrong}>
          {checkedIn}/{registered}
        </Text>{' '}
        pointés · {event.maxPilots} places
      </Text>
    </Card>
  );
}

function Fact({
  value,
  label,
  tone = 'ok',
}: {
  value: string;
  label: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <View style={s.fact}>
      <Text style={[s.factValue, tone === 'warn' ? { color: ADMIN } : null]}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
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
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  hero: {
    fontFamily: theme.fonts.display,
    fontSize: 56,
    letterSpacing: -1,
    color: theme.palette.cream,
  },
  heroLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  factsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  fact: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.palette.card2,
  },
  factValue: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  factLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: 4,
  },
  eventHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  eventName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  ongoing: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: ADMIN,
  },
  eventMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  eventCount: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  eventCountStrong: {
    fontFamily: theme.fonts.bodyMedium,
    color: theme.palette.cream,
  },
  linkHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  linkLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  linkChevron: { color: theme.palette.faint, fontSize: 17 },
  linkHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
};
