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

import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CoachPilotDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [pilot, setPilot] = useState<CoachPilotRow | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

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
            <Text
              style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}
            >
              {sessions.length} {sessions.length === 1 ? 'SESSION' : 'SESSIONS'}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </View>
          </>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour à mes pilotes
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionRow({ session }: { session: PilotSessionSummary }) {
  const dateStr = dateLong(session.startedAt);
  const lapStr = session.lapCount
    ? `${session.lapCount} tour${session.lapCount > 1 ? 's' : ''}`
    : '—';
  const marginStr = session.marginGlobal !== null ? `${Math.round(session.marginGlobal)} %` : '—';

  return (
    <Link href={{ pathname: '/(app)/bilan', params: { sessionId: session.id } }} asChild>
      <Pressable
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
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
          >
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

function dateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
