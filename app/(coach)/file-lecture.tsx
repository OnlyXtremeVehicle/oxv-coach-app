/**
 * Coach — File de lecture (V9 §14, sur `coach_queue`).
 *
 * Les sessions des pilotes consentis, avec un statut de lecture EXPLICITE et
 * persistant : à lire / lues / archivées (filtrable, marquable). Un tap ouvre la
 * fiche du pilote. Lecture seule côté pilote — rien de ceci ne lui est exposé.
 * « À votre rythme » : la file aide le coach, elle ne le presse pas. Accent
 * coach neutre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import * as haptics from '@/lib/haptics';
import { groupQueue, type QueueItem, type QueueStatus } from '@/services/coachQueueLogic';
import { loadCoachQueue, setQueueStatus } from '@/services/coachQueueService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

const FILTERS: { key: QueueStatus; label: string }[] = [
  { key: 'unread', label: 'À lire' },
  { key: 'read', label: 'Lues' },
  { key: 'archived', label: 'Archivées' },
];

const EMPTY: Record<QueueStatus, string> = {
  unread: 'Rien à lire pour l’instant. Les séances de vos pilotes apparaîtront ici.',
  read: 'Aucune séance lue pour l’instant.',
  archived: 'Aucune séance archivée.',
};

export default function FileLectureScreen() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<QueueStatus>('unread');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadCoachQueue()
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
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

  const mark = useCallback(
    (item: QueueItem, status: QueueStatus) => {
      haptics.tap();
      // Optimiste : reflète tout de suite, recharge en cas d'échec.
      setItems((prev) => prev.map((i) => (i.sessionId === item.sessionId ? { ...i, status } : i)));
      setQueueStatus({ sessionId: item.sessionId, pilotId: item.pilotId, status }).then((res) => {
        if (!res.ok) reload();
      });
    },
    [reload]
  );

  const groups = groupQueue(items);
  const active = groups[filter];
  const listState: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : active.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="FILE DE LECTURE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>À VOTRE RYTHME</Text>
        <Text style={s.title} accessibilityRole="header">
          Votre file de lecture.
        </Text>

        {/* Filtres + compteurs. */}
        <View style={s.filterRow} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const isActive = f.key === filter;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${f.label}, ${groups.counts[f.key]}`}
                onPress={() => setFilter(f.key)}
                style={[s.chip, isActive ? s.chipActive : null]}
              >
                <Text style={[s.chipLabel, isActive ? s.chipLabelActive : null]}>
                  {f.label} · {groups.counts[f.key]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: theme.spacing.lg }}>
          <StateWrapper
            state={listState}
            skeletonLines={4}
            emptyLabel="Rien ici"
            emptyMessage={EMPTY[filter]}
            emptySource="telemetry_sessions"
            errorCause="La file n'a pas pu être chargée."
            onRetry={reload}
          >
            <View style={{ gap: theme.spacing.sm }}>
              {active.map((item) => (
                <QueueRow key={item.sessionId} item={item} onMark={mark} />
              ))}
            </View>
          </StateWrapper>
        </View>
      </View>
    </Screen>
  );
}

function QueueRow({
  item,
  onMark,
}: {
  item: QueueItem;
  onMark: (item: QueueItem, status: QueueStatus) => void;
}) {
  const meta = [item.circuitName, formatDateShort(item.startedAt)].filter(Boolean).join(' · ');

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.pilotName}. ${meta}. Ouvrir la fiche.`}
        onPress={() =>
          router.push({ pathname: '/(coach)/pilote/[id]', params: { id: item.pilotId } } as never)
        }
        style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
      >
        {item.status === 'unread' ? (
          <View style={s.dot} accessibilityElementsHidden importantForAccessibility="no" />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={s.pilot}>{item.pilotName}</Text>
          {meta ? <Text style={s.meta}>{meta}</Text> : null}
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>

      {/* Marquage — actions sobres selon le statut courant. */}
      <View style={s.actions}>
        {/* Studio : la lecture télémétrique de CETTE séance (P0). */}
        <RowAction
          label="Studio"
          onPress={() =>
            router.push({
              pathname: '/(coach)/studio',
              params: { sessionId: item.sessionId },
            } as never)
          }
        />
        {/* Rapport : bilan du coach + PDF de synthèse. */}
        <RowAction
          label="Rapport"
          onPress={() =>
            router.push({
              pathname: '/(coach)/rapport',
              params: { sessionId: item.sessionId, startedAt: item.startedAt },
            } as never)
          }
        />
        {item.status !== 'read' ? (
          <RowAction label="Marquer lue" onPress={() => onMark(item, 'read')} />
        ) : null}
        {item.status !== 'unread' ? (
          <RowAction label="À relire" onPress={() => onMark(item, 'unread')} />
        ) : null}
        {item.status !== 'archived' ? (
          <RowAction label="Archiver" onPress={() => onMark(item, 'archived')} />
        ) : null}
      </View>
    </Card>
  );
}

function RowAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [s.action, pressed && { opacity: 0.6 }]}
    >
      <Text style={s.actionText}>{label}</Text>
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
  filterRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chipActive: {
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
  },
  chipLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  chipLabelActive: {
    color: theme.palette.cream,
  },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: theme.spacing.md },
  // Marqueur « non-lu » = rouge d'identité de rôle coach (roleColors.coach).
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.roleColors.coach },
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
  chevron: { color: theme.palette.creamMute, fontSize: 17 },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  action: { minHeight: 32, justifyContent: 'center' as const },
  actionText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
};
