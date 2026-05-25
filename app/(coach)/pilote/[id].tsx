/**
 * Vue Coach — Détail d'un pilote : liste de ses sessions analysées.
 *
 * Lecture seule. Tap sur une session → ouvre l'écran bilan existant
 * (/(app)/bilan?sessionId=xxx) qui fonctionne grâce aux RLS coach SELECT
 * sur app_session_analyses et autres tables analyses.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useLocalSearchParams } from 'expo-router';

import * as haptics from '@/lib/haptics';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateLong } from '@/utils/format';

type Mode = 'browse' | 'compare';

export default function CoachPilotDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [pilot, setPilot] = useState<CoachPilotRow | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('browse');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelected = (sessionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(sessionId)) return prev.filter((id) => id !== sessionId);
      if (prev.length >= 2) return [prev[1], sessionId]; // FIFO max 2
      return [...prev, sessionId];
    });
  };

  const canCompare = selectedIds.length === 2;

  const openComparison = () => {
    if (!canCompare || !params.id) return;
    haptics.confirm();
    // Cast nécessaire le temps que les typed routes Expo se régénèrent
    router.push({
      pathname: '/(coach)/comparer',
      params: {
        pilotId: params.id,
        sessionA: selectedIds[0],
        sessionB: selectedIds[1],
      },
    } as never);
  };

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    (async () => {
      // Charge les détails pilote (filtré par RLS via coach_pilots_view)
      const pilots = await listMyPilots();
      if (cancelled) return;
      const found = pilots.find((p) => p.pilotId === params.id) ?? null;
      setPilot(found);

      // Charge les sessions (filtré par RLS via telemetry_sessions_coach_select)
      const sess = await listPilotSessions(params.id);
      if (cancelled) return;
      setSessions(sess);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const fullName = pilot
    ? [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || 'Pilote'
    : 'Chargement…';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>PILOTE SUIVI</Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          {fullName}
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>
                {sessions.length} {sessions.length === 1 ? 'SESSION' : 'SESSIONS'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMode(mode === 'browse' ? 'compare' : 'browse');
                  setSelectedIds([]);
                }}
              >
                <Text
                  style={{
                    color: colors.accent.coach,
                    fontSize: fontSize.caption,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {mode === 'browse' ? 'Comparer 2 sessions' : 'Annuler'}
                </Text>
              </Pressable>
            </View>

            {mode === 'compare' ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.text.tertiary, marginBottom: spacing.md },
                ]}
              >
                Sélectionnez deux sessions à comparer ({selectedIds.length}/2).
              </Text>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  mode={mode}
                  selected={selectedIds.includes(session.id)}
                  onToggle={() => toggleSelected(session.id)}
                />
              ))}
            </View>

            {mode === 'compare' ? (
              <Pressable
                accessibilityRole="button"
                disabled={!canCompare}
                onPress={openComparison}
                style={{
                  marginTop: spacing.xl,
                  padding: spacing.lg,
                  borderRadius: borderRadius.md,
                  backgroundColor: canCompare ? colors.accent.coach : colors.background.secondary,
                  borderWidth: 0.5,
                  borderColor: canCompare ? colors.accent.coach : colors.border.subtle,
                  alignItems: 'center',
                  opacity: canCompare ? 1 : 0.5,
                }}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  Ouvrir le comparatif
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour à mes pilotes
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionRow({
  session,
  mode = 'browse',
  selected = false,
  onToggle,
}: {
  session: PilotSessionSummary;
  mode?: Mode;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const dateStr = formatDateLong(session.startedAt);
  const lapStr = session.lapCount
    ? `${session.lapCount} tour${session.lapCount > 1 ? 's' : ''}`
    : '—';
  const marginStr = session.marginGlobal !== null ? `${Math.round(session.marginGlobal)} %` : '—';

  const rowContent = (
    <>
      <View
        style={{
          width: 6,
          height: 40,
          borderRadius: 3,
          backgroundColor: colorForZone(session.marginZone),
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.regular,
          }}
        >
          {dateStr}
        </Text>
        <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}>
          {session.circuitName ?? 'Beltoise'} · {lapStr}
          {session.marginZone ? ` · ${marginLabelOf(session.marginZone)}` : ''}
        </Text>
      </View>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.title,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
        }}
      >
        {marginStr}
      </Text>
    </>
  );

  if (mode === 'compare') {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        onPress={onToggle}
        style={({ pressed }) => ({
          padding: spacing.lg,
          borderRadius: borderRadius.md,
          borderWidth: selected ? 1.5 : 0.5,
          borderColor: selected ? colors.accent.coach : colors.border.subtle,
          backgroundColor: selected ? colors.background.elevated : colors.background.secondary,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
        })}
      >
        {rowContent}
      </Pressable>
    );
  }

  return (
    <Link href={{ pathname: '/(app)/bilan', params: { sessionId: session.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => ({
          padding: spacing.lg,
          borderRadius: borderRadius.md,
          borderWidth: 0.5,
          borderColor: colors.border.subtle,
          backgroundColor: colors.background.secondary,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
        })}
      >
        {rowContent}
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
        Aucune session pour ce pilote.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Les sessions apparaissent ici dès qu'elles sont analysées.
      </Text>
    </View>
  );
}

function colorForZone(zone: MarginZone | null): string {
  if (!zone) return colors.text.tertiary;
  return zone === 'green'
    ? colors.margin.green
    : zone === 'yellow'
      ? colors.margin.yellow
      : colors.margin.red;
}
