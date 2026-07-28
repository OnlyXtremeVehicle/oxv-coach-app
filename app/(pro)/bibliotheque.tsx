/**
 * Pilote Pro — Bibliothèque de sessions (recherche multi-critères, PR-72).
 *
 * Retrouver n'importe quelle séance passée par circuit et par période. Tri
 * CHRONOLOGIQUE par défaut (la séance la plus récente d'abord) — jamais un
 * classement « meilleure séance », jamais un palmarès. RLS own-row : le pro ne
 * voit que ses propres séances. Réutilise fetchAllSessions / fetchUsedCircuits.
 * Doctrine : sobre, vouvoiement, pas d'emoji, un seul chiffre dominant.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { fetchAllSessions, fetchUsedCircuits } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { type TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const PAGE = 20;

type Period = 'all' | '90' | '30';
const PERIODS: { v: Period; label: string }[] = [
  { v: 'all', label: 'Tout' },
  { v: '90', label: '90 jours' },
  { v: '30', label: '30 jours' },
];

function fromDateFor(period: Period): string | undefined {
  if (period === 'all') return undefined;
  const days = period === '90' ? 90 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function ProBibliothequeScreen() {
  const userId = useAuthStore((s) => s.profile?.id);
  const [circuits, setCircuits] = useState<{ id: string; name: string; count: number }[]>([]);
  const [circuitId, setCircuitId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('all');

  const [sessions, setSessions] = useState<TelemetrySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  // Compteur courant pour l'offset de pagination — évite une closure périmée
  // (load est mémoïsé sur les filtres, pas sur sessions.length).
  const countRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchUsedCircuits(userId).then((c) => {
      if (!cancelled) setCircuits(c.sort((a, b) => b.count - a.count));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const load = useCallback(
    async (reset: boolean) => {
      if (!userId) {
        setLoading(false);
        return;
      }
      if (reset) setLoading(true);
      else setLoadingMore(true);
      const offset = reset ? 0 : countRef.current;
      const rows = await fetchAllSessions(userId, {
        limit: PAGE,
        offset,
        circuitId: circuitId ?? undefined,
        fromDate: fromDateFor(period),
      });
      setExhausted(rows.length < PAGE);
      setSessions((prev) => {
        const next = reset ? rows : [...prev, ...rows];
        countRef.current = next.length;
        return next;
      });
      setLoading(false);
      setLoadingMore(false);
    },
    [userId, circuitId, period]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  return (
    <Screen>
      <AppBar title="BIBLIOTHÈQUE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOS SÉANCES</Text>
        <Text style={s.title} accessibilityRole="header">
          Retrouver une séance.
        </Text>

        {/* Filtre circuit. */}
        {circuits.length > 0 ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionLabel>Circuit</SectionLabel>
            <View style={s.pills}>
              <FilterPill label="Tous" on={circuitId === null} onPress={() => setCircuitId(null)} />
              {circuits.map((c) => (
                <FilterPill
                  key={c.id}
                  label={c.name}
                  on={circuitId === c.id}
                  onPress={() => setCircuitId(c.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Filtre période. */}
        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionLabel>Période</SectionLabel>
          <View style={s.pills}>
            {PERIODS.map((p) => (
              <FilterPill
                key={p.v}
                label={p.label}
                on={period === p.v}
                onPress={() => setPeriod(p.v)}
              />
            ))}
          </View>
        </View>

        {/* Résultats. */}
        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : sessions.length === 0 ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Aucune séance"
              message="Aucune séance ne correspond à ces filtres."
              source="telemetry_sessions"
            />
          </View>
        ) : (
          <>
            <Text style={s.count}>
              {sessions.length}
              {exhausted ? '' : '+'} séance{sessions.length > 1 ? 's' : ''}
            </Text>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              {sessions.map((sess) => (
                <Card
                  key={sess.id}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/bilan',
                      params: { sessionId: sess.id },
                    } as never)
                  }
                  accessibilityLabel={`${sess.name || sess.circuit_name}, ${formatDate(
                    sess.started_at
                  )}`}
                >
                  <Text style={s.sessTitle} numberOfLines={1}>
                    {sess.name || sess.circuit_name}
                  </Text>
                  <Text style={s.sessMeta}>
                    {formatDate(sess.started_at)} · {sess.lap_count} tours
                    {sess.distance_km != null ? ` · ${Math.round(sess.distance_km)} km` : ''}
                  </Text>
                </Card>
              ))}
            </View>

            {!exhausted ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Charger plus de séances"
                accessibilityState={{ busy: loadingMore }}
                disabled={loadingMore}
                onPress={() => load(false)}
                style={({ pressed }) => [s.more, pressed && { opacity: 0.8 }]}
              >
                {loadingMore ? (
                  <ActivityIndicator
                    color={theme.palette.creamMute}
                    accessibilityLabel="Chargement"
                  />
                ) : (
                  <Text style={s.moreT}>Charger plus</Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function FilterPill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      hitSlop={6}
      style={[s.pill, on ? s.pillOn : null]}
    >
      <Text style={[s.pillT, on ? s.pillTOn : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
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
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  pill: {
    maxWidth: 220,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 40,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: { borderColor: theme.palette.edge, backgroundColor: theme.palette.card },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  count: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xl,
  },
  sessTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  sessMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  more: {
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    marginTop: theme.spacing.lg,
  },
  moreT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
};
