/**
 * Admin — Événements : liste + accès création (PR-21).
 *
 * Le site crée aussi des événements (table partagée) ; l'app les gère ici.
 * Admin-only (RLS). Bronze = rôle admin. Doctrine : sobre, factuel.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  type AdminEvent,
  eventStatusLabel,
  eventTypeLabel,
  listEvents,
} from '@/services/eventsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

export default function AdminEventsScreen() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listEvents()
      .then((rows) => {
        if (!cancelled) {
          setEvents(rows);
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

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : events.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="ÉVÉNEMENTS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={[s.eyebrow, { color: ADMIN }]}>COORDINATION</Text>
        <Text style={s.title} accessibilityRole="header">
          Les événements.
        </Text>

        <View style={{ marginTop: theme.spacing.lg }}>
          <Button
            label="Créer un événement"
            onPress={() => router.push('/(admin)/evenements/nouveau' as never)}
          />
        </View>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <StateWrapper
            state={state}
            skeletonLines={5}
            emptyLabel="Aucun événement"
            emptyMessage="Aucun événement programmé."
            emptySource="events"
            errorCause="La liste des événements n'a pas pu être chargée."
            onRetry={reload}
          >
            {events.map((e) => (
              <Card
                key={e.id}
                onPress={() => router.push(`/(admin)/evenements/${e.id}` as never)}
                accessibilityLabel={`${e.name}, ${eventStatusLabel(e.status)}`}
              >
                <View style={s.top}>
                  <Text style={s.type}>{eventTypeLabel(e.eventType)}</Text>
                  <Text style={s.status}>{eventStatusLabel(e.status)}</Text>
                </View>
                <Text style={s.name}>{e.name}</Text>
                <Text style={s.meta}>
                  {formatDateShort(e.startsAt)} · {e.locationName} · {e.currentPilots}/{e.maxPilots}
                </Text>
              </Card>
            ))}
          </StateWrapper>
        </View>
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
  top: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  type: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: ADMIN,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
  },
};
