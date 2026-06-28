/**
 * Coach — File de lecture (§6.2).
 *
 * Les sessions des pilotes consentis, priorisées : « à lire » tant que le coach
 * ne les a pas annotées, puis « déjà lues ». Un tap ouvre la fiche du pilote
 * (ses sessions). Lecture seule, pas d'injonction au coach. Accent coach neutre.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { type ReadingQueueEntry, loadReadingQueue } from '@/services/coachService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

export default function FileLectureScreen() {
  const [entries, setEntries] = useState<ReadingQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadReadingQueue()
      .then((e) => {
        if (!cancelled) {
          setEntries(e);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toRead = entries.filter((e) => !e.annotated);
  const read = entries.filter((e) => e.annotated);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="FILE DE LECTURE" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="FILE DE LECTURE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>À VOTRE RYTHME</Text>
        <Text style={s.title} accessibilityRole="header">
          Votre file de lecture.
        </Text>

        {entries.length === 0 ? (
          <EmptyState
            label="Rien à lire"
            message="Les sessions de vos pilotes apparaîtront ici."
            source="telemetry_sessions"
          />
        ) : (
          <>
            {toRead.length > 0 ? (
              <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
                <SectionLabel>{`À LIRE — ${toRead.length}`}</SectionLabel>
                {toRead.map((e) => (
                  <QueueRow key={e.sessionId} entry={e} unread />
                ))}
              </View>
            ) : null}

            {read.length > 0 ? (
              <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
                <SectionLabel>DÉJÀ LUES</SectionLabel>
                {read.map((e) => (
                  <QueueRow key={e.sessionId} entry={e} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function QueueRow({ entry, unread }: { entry: ReadingQueueEntry; unread?: boolean }) {
  const meta = [entry.circuitName, formatDateShort(entry.startedAt)].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.pilotName}. ${meta}.${unread ? ' À lire.' : ''}`}
      onPress={() =>
        router.push({ pathname: '/(coach)/pilote/[id]', params: { id: entry.pilotId } } as never)
      }
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Card>
        <View style={s.row}>
          {unread ? (
            <View style={s.dot} accessibilityElementsHidden importantForAccessibility="no" />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={s.pilot}>{entry.pilotName}</Text>
            {meta ? <Text style={s.meta}>{meta}</Text> : null}
          </View>
          <Text style={s.chevron}>›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
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
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: theme.spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.palette.coach },
  pilot: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  chevron: { color: theme.palette.faint, fontSize: 17 },
};
