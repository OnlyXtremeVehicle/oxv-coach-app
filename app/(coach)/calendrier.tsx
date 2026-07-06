/**
 * Coach — Calendrier (agenda). Réintégration Claude Design (coach__calendrier).
 *
 * Vue calme, non une grille chargée : les séances CONFIRMÉES (demandes
 * acceptées, datées) et les CRÉNEAUX ouverts, groupés par jour, à venir. Agrège
 * des données déjà en place (coachMarketplaceService), sans schéma nouveau.
 *
 * Doctrine : un seul chiffre dominant (séances à venir), vouvoiement, sobre.
 * Aucune injonction — un agenda, pas un rappel qui presse.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  type CoachBooking,
  type MyAvailabilitySlot,
  listCoachBookings,
  listMyAvailability,
} from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { KingNumber } from '@/ui/KingNumber';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing } = theme;

interface AgendaItem {
  key: string;
  startsAt: string;
  kind: 'session' | 'slot';
  title: string;
  meta: string;
  onPress?: () => void;
}

interface DayGroup {
  dayKey: string;
  dayLabel: string;
  items: AgendaItem[];
}

function dayLabelOf(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function buildAgenda(bookings: CoachBooking[], slots: MyAvailabilitySlot[]): DayGroup[] {
  // Début de journée courante : on garde ce qui est à venir (aujourd'hui inclus).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const floor = startOfToday.getTime();

  const items: AgendaItem[] = [];

  for (const b of bookings) {
    if (b.status !== 'accepted' || !b.requestedStartsAt) continue;
    if (new Date(b.requestedStartsAt).getTime() < floor) continue;
    const name = b.pilotFirstName?.trim() || 'Pilote';
    items.push({
      key: `b-${b.id}`,
      startsAt: b.requestedStartsAt,
      kind: 'session',
      title: name,
      meta: [b.circuitName, `${timeOf(b.requestedStartsAt)}`].filter(Boolean).join(' · '),
      onPress: () =>
        router.push({ pathname: '/(coach)/pilote/[id]', params: { id: b.pilotId } } as never),
    });
  }

  for (const sl of slots) {
    if (sl.status !== 'open' || !sl.startsAt) continue;
    if (new Date(sl.startsAt).getTime() < floor) continue;
    items.push({
      key: `s-${sl.id}`,
      startsAt: sl.startsAt,
      kind: 'slot',
      title: 'Créneau ouvert',
      meta: [
        sl.circuitName,
        timeOf(sl.startsAt),
        `${sl.capacity} place${sl.capacity > 1 ? 's' : ''}`,
      ]
        .filter(Boolean)
        .join(' · '),
      onPress: () => router.push('/(coach)/disponibilites' as never),
    });
  }

  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const groups: DayGroup[] = [];
  for (const it of items) {
    const dayKey = it.startsAt.slice(0, 10);
    let g = groups.find((x) => x.dayKey === dayKey);
    if (!g) {
      g = { dayKey, dayLabel: dayLabelOf(it.startsAt), items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

export default function CoachCalendrierScreen() {
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [slots, setSlots] = useState<MyAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([listCoachBookings(), listMyAvailability()])
      .then(([b, sl]) => {
        if (!cancelled) {
          setBookings(b);
          setSlots(sl);
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
  }, [reloadKey]);

  const groups = useMemo(() => buildAgenda(bookings, slots), [bookings, slots]);
  const upcomingSessions = useMemo(
    () => groups.reduce((n, g) => n + g.items.filter((i) => i.kind === 'session').length, 0),
    [groups]
  );

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : groups.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="CALENDRIER" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        {/* Chiffre roi : séances à venir (fait). */}
        {!loading && !error && upcomingSessions > 0 ? (
          <View style={{ marginBottom: spacing.lg }}>
            <CockpitPanel>
              <Text style={s.eyebrow}>À venir</Text>
              <KingNumber
                value={String(upcomingSessions)}
                label={`séance${upcomingSessions > 1 ? 's' : ''}`}
              />
            </CockpitPanel>
          </View>
        ) : null}

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Rien de programmé"
          emptyMessage="Vos séances confirmées et vos créneaux ouverts à venir apparaîtront ici."
          errorCause="Votre agenda n'a pas pu être chargé."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <View style={{ gap: spacing.xl }}>
            {groups.map((g) => (
              <View key={g.dayKey}>
                <Text style={s.dayLabel}>{g.dayLabel}</Text>
                <View style={{ gap: spacing.sm }}>
                  {g.items.map((it) => (
                    <Pressable
                      key={it.key}
                      accessibilityRole="button"
                      accessibilityLabel={`${it.title}. ${it.meta}.`}
                      onPress={it.onPress}
                      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                    >
                      <Card
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.md,
                          // Séance confirmée = voix coach (rouge d'identité) ; créneau = neutre.
                          borderColor:
                            it.kind === 'session' ? theme.roleColors.coach : palette.line,
                        }}
                      >
                        <View
                          style={[
                            s.dot,
                            {
                              backgroundColor:
                                it.kind === 'session' ? theme.roleColors.coach : palette.creamMute,
                            },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemTitle}>{it.title}</Text>
                          <Text style={s.itemMeta}>{it.meta}</Text>
                        </View>
                        <Text style={s.itemKind}>
                          {it.kind === 'session' ? 'Séance' : 'Créneau'}
                        </Text>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  dayLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  itemMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  itemKind: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
};
