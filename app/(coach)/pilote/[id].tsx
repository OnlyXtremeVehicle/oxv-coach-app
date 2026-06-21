/**
 * Vue Coach — Détail d'un pilote : liste de ses sessions analysées.
 *
 * Lecture seule. Tap sur une session → ouvre l'écran bilan existant
 * (/(app)/bilan?sessionId=xxx) qui fonctionne grâce aux RLS coach SELECT
 * sur app_session_analyses et autres tables analyses.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Segmented/Button. Logique
 * inchangée (sélection comparaison FIFO, navigation bilan/contexte/priorités).
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import * as haptics from '@/lib/haptics';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

type Mode = 'browse' | 'compare';

// Couleurs de zone de marge (donnée, toujours doublée du libellé marginLabelOf).
const ZONE_COLORS = { green: '#97C459', yellow: '#EF9F27', red: theme.palette.red } as const;

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
      try {
        // Charge les détails pilote (filtré par RLS via coach_pilots_view)
        const pilots = await listMyPilots();
        if (cancelled) return;
        const found = pilots.find((p) => p.pilotId === params.id) ?? null;
        setPilot(found);

        // Charge les sessions (filtré par RLS via telemetry_sessions_coach_select)
        const sess = await listPilotSessions(params.id);
        if (cancelled) return;
        setSessions(sess);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const fullName = pilot
    ? [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || 'Pilote'
    : 'Chargement…';

  return (
    <Screen>
      <AppBar title="PILOTE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>PILOTE SUIVI</Text>
        <Text style={s.title}>{fullName}</Text>

        {/* Priorisation du bilan (§10.3c-B) */}
        <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
          <Button
            label="Priorités du bilan"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/(coach)/priorites',
                params: { pilotId: params.id },
              } as never)
            }
          />
        </View>

        {loading ? (
          <Text style={s.caption}>Chargement…</Text>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <View style={s.rowBetween}>
              <SectionLabel>
                {`${sessions.length} ${sessions.length === 1 ? 'SESSION' : 'SESSIONS'}`}
              </SectionLabel>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMode(mode === 'browse' ? 'compare' : 'browse');
                  setSelectedIds([]);
                }}
              >
                <Text style={s.action}>
                  {mode === 'browse' ? 'Comparer 2 sessions' : 'Annuler'}
                </Text>
              </Pressable>
            </View>

            {mode === 'compare' ? (
              <Text style={[s.caption, { marginTop: theme.spacing.md }]}>
                Sélectionnez deux sessions à comparer ({selectedIds.length}/2).
              </Text>
            ) : null}

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  pilotId={params.id}
                  mode={mode}
                  selected={selectedIds.includes(session.id)}
                  onToggle={() => toggleSelected(session.id)}
                />
              ))}
            </View>

            {mode === 'compare' ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <Button
                  label="Ouvrir le comparatif"
                  disabled={!canCompare}
                  onPress={openComparison}
                />
              </View>
            ) : null}
          </>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.back}>Retour à mes pilotes</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function SessionRow({
  session,
  pilotId,
  mode = 'browse',
  selected = false,
  onToggle,
}: {
  session: PilotSessionSummary;
  pilotId?: string;
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
        <Text style={s.sessionDate}>{dateStr}</Text>
        <Text style={[s.caption, { marginTop: theme.spacing.xs }]}>
          {session.circuitName ?? 'Beltoise'} · {lapStr}
          {session.marginZone ? ` · ${marginLabelOf(session.marginZone)}` : ''}
        </Text>
      </View>
      <Text style={s.sessionValue}>{marginStr}</Text>
    </>
  );

  if (mode === 'compare') {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        onPress={onToggle}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Card
          style={{
            borderColor: selected ? theme.palette.coach : theme.palette.line,
            borderWidth: selected ? 1.5 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          {rowContent}
        </Card>
      </Pressable>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir le bilan du ${dateStr}`}
        onPress={() =>
          router.push({ pathname: '/(app)/bilan', params: { sessionId: session.id } } as never)
        }
        style={({ pressed }) => ({
          padding: theme.spacing.md,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        })}
      >
        {rowContent}
      </Pressable>
      {/* Saisie du contexte coach (§10.3) sur cette session */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter le contexte de cette séance"
        onPress={() =>
          router.push({
            pathname: '/(coach)/contexte',
            params: { pilotId: pilotId ?? '', sessionId: session.id },
          } as never)
        }
        style={({ pressed }) => ({
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.palette.line,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={s.action}>Contexte de séance</Text>
      </Pressable>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={[s.manifest, { textAlign: 'center' }]}>Aucune session pour ce pilote.</Text>
      <Text style={[s.caption, { textAlign: 'center', marginTop: theme.spacing.md }]}>
        Les sessions apparaissent ici dès qu&apos;elles sont analysées.
      </Text>
    </Card>
  );
}

function colorForZone(zone: MarginZone | null): string {
  if (!zone) return theme.palette.creamMute;
  return zone === 'green'
    ? ZONE_COLORS.green
    : zone === 'yellow'
      ? ZONE_COLORS.yellow
      : ZONE_COLORS.red;
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
  rowBetween: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  action: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 1,
    color: theme.palette.coach,
  },
  sessionDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  sessionValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
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
    lineHeight: theme.fontSize.small * 1.5,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.micro,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
