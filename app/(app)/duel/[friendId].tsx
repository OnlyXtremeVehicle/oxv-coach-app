/**
 * Écran Duel pédagogique — comparaison côte à côte avec un ami pilote.
 *
 * 2 modes au choix :
 *   1. SNAPSHOT  — 1 session vs 1 session (sélecteur des 2 côtés)
 *   2. AGRÉGÉ    — moyenne + best des N dernières sessions des 2
 *
 * Doctrine OXV :
 *   - PAS DE GAGNANT DÉSIGNÉ. Pas de badge, pas de "vainqueur", pas de %.
 *   - Juste les chiffres côte à côte, neutres.
 *   - Phrase manifeste en bas : « Pas de gagnant. Juste de quoi observer. »
 *
 * Sécurité : 100% RLS (migration 0027). Si l'ami a révoqué l'amitié
 * pendant qu'on est sur l'écran, le fetch retourne [] et on tombe sur
 * l'état vide.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { listRecentAnalyses, type RecentAnalysisRow } from '@/services/analysesService';
import {
  type DuelSessionRow,
  type AggregatedStats,
  loadAggregatedStats,
  loadFriendSessionList,
} from '@/services/duelService';
import { listAcceptedFriends } from '@/services/friendshipsService';
import { useAuthStore } from '@/store/useAuthStore';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort } from '@/utils/format';

type Mode = 'snapshot' | 'aggregated';
const AGGREGATE_OPTIONS = [3, 5, 10] as const;
type AggregateN = (typeof AGGREGATE_OPTIONS)[number];

interface FriendInfo {
  id: string;
  handle: string | null;
  firstName: string | null;
}

export default function DuelScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { friendId } = useLocalSearchParams<{ friendId: string }>();

  const [mode, setMode] = useState<Mode>('snapshot');
  const [aggregateN, setAggregateN] = useState<AggregateN>(5);

  const [friendInfo, setFriendInfo] = useState<FriendInfo | null>(null);
  const [mySessions, setMySessions] = useState<RecentAnalysisRow[]>([]);
  const [friendSessions, setFriendSessions] = useState<DuelSessionRow[]>([]);
  const [selectedMine, setSelectedMine] = useState<string | null>(null);
  const [selectedTheirs, setSelectedTheirs] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<AggregatedStats | null>(null);
  const [theirStats, setTheirStats] = useState<AggregatedStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  // Chargement initial : sessions des 2 côtés + info friend
  useEffect(() => {
    if (!profile?.id || !friendId) return;
    let cancelled = false;
    (async () => {
      const [mine, theirs, friends] = await Promise.all([
        listRecentAnalyses(profile.id, 20),
        loadFriendSessionList(friendId, 20),
        listAcceptedFriends(profile.id),
      ]);
      if (cancelled) return;
      setMySessions(mine);
      setFriendSessions(theirs);

      const friend = friends.find((f) => f.friendId === friendId);
      if (friend) {
        setFriendInfo({
          id: friend.friendId,
          handle: friend.friendHandle,
          firstName: friend.friendFirstName,
        });
      }

      if (mine.length > 0) setSelectedMine(mine[0].telemetrySessionId);
      if (theirs.length > 0) setSelectedTheirs(theirs[0].sessionId);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, friendId]);

  // Recharge stats agrégées quand mode/n change
  const reloadAggregated = useCallback(async () => {
    if (!profile?.id || !friendId || mode !== 'aggregated') return;
    setStatsLoading(true);
    const [mine, theirs] = await Promise.all([
      loadAggregatedStats(profile.id, aggregateN),
      loadAggregatedStats(friendId, aggregateN),
    ]);
    setMyStats(mine);
    setTheirStats(theirs);
    setStatsLoading(false);
  }, [profile?.id, friendId, mode, aggregateN]);

  useEffect(() => {
    void reloadAggregated();
  }, [reloadAggregated]);

  const friendDisplayName = useMemo(() => {
    if (!friendInfo) return 'Cet ami';
    return (
      friendInfo.firstName ??
      (friendInfo.handle ? `@${friendInfo.handle}` : `Pilote ${friendId?.slice(0, 6)}`)
    );
  }, [friendInfo, friendId]);

  const selectedMineRow = mySessions.find((s) => s.telemetrySessionId === selectedMine);
  const selectedTheirsRow = friendSessions.find((s) => s.sessionId === selectedTheirs);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>DUEL PÉDAGOGIQUE</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Vous & {friendDisplayName}
        </Text>

        <ModeToggle mode={mode} onChange={setMode} />

        {mode === 'snapshot' ? (
          <SnapshotView
            mySessions={mySessions}
            friendSessions={friendSessions}
            selectedMine={selectedMine}
            selectedTheirs={selectedTheirs}
            onSelectMine={setSelectedMine}
            onSelectTheirs={setSelectedTheirs}
            selectedMineRow={selectedMineRow}
            selectedTheirsRow={selectedTheirsRow}
          />
        ) : (
          <AggregatedView
            n={aggregateN}
            onChangeN={setAggregateN}
            myStats={myStats}
            theirStats={theirStats}
            loading={statsLoading}
          />
        )}

        <Text
          style={[
            typography.manifest,
            {
              marginTop: spacing.huge,
              textAlign: 'center',
              color: colors.text.tertiary,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          Pas de gagnant. Juste de quoi observer.
        </Text>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const options: { id: Mode; label: string }[] = [
    { id: 'snapshot', label: 'Snapshot' },
    { id: 'aggregated', label: 'Agrégé' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.xxl,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === mode;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            onPress={() => onChange(opt.id)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.md,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: active ? colors.accent.red : colors.border.subtle,
              backgroundColor: active ? 'rgba(200, 16, 46, 0.10)' : 'transparent',
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: active ? colors.text.primary : colors.text.secondary,
                fontSize: fontSize.body,
                fontWeight: active ? fontWeight.medium : fontWeight.regular,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface SnapshotProps {
  mySessions: RecentAnalysisRow[];
  friendSessions: DuelSessionRow[];
  selectedMine: string | null;
  selectedTheirs: string | null;
  onSelectMine: (id: string) => void;
  onSelectTheirs: (id: string) => void;
  selectedMineRow: RecentAnalysisRow | undefined;
  selectedTheirsRow: DuelSessionRow | undefined;
}

function SnapshotView(props: SnapshotProps) {
  if (props.mySessions.length === 0 || props.friendSessions.length === 0) {
    return <Text style={emptyTextStyle}>Pas assez de sessions des deux côtés pour comparer.</Text>;
  }
  return (
    <>
      <SessionPicker
        label="VOTRE SESSION"
        items={props.mySessions.map((s) => ({
          id: s.telemetrySessionId,
          label: `${formatDateShort(s.sessionStartedAt)} · ${s.circuitName ?? '—'}`,
        }))}
        selectedId={props.selectedMine}
        onSelect={props.onSelectMine}
      />
      <SessionPicker
        label="SA SESSION"
        items={props.friendSessions.map((s) => ({
          id: s.sessionId,
          label: `${formatDateShort(s.startedAt)} · ${s.circuitName ?? '—'}`,
        }))}
        selectedId={props.selectedTheirs}
        onSelect={props.onSelectTheirs}
      />

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl }}>
        <DuelColumn
          eyebrow="VOUS"
          marginGlobal={props.selectedMineRow?.marginGlobal ?? null}
          marginZone={props.selectedMineRow?.marginZone ?? null}
          context={
            props.selectedMineRow?.sessionStartedAt
              ? formatDateShort(props.selectedMineRow.sessionStartedAt)
              : null
          }
        />
        <DuelColumn
          eyebrow="EUX"
          marginGlobal={props.selectedTheirsRow?.marginGlobal ?? null}
          marginZone={props.selectedTheirsRow?.marginZone ?? null}
          context={
            props.selectedTheirsRow?.startedAt
              ? formatDateShort(props.selectedTheirsRow.startedAt)
              : null
          }
        />
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface AggregatedProps {
  n: AggregateN;
  onChangeN: (n: AggregateN) => void;
  myStats: AggregatedStats | null;
  theirStats: AggregatedStats | null;
  loading: boolean;
}

function AggregatedView({ n, onChangeN, myStats, theirStats, loading }: AggregatedProps) {
  return (
    <>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl }}>
        {AGGREGATE_OPTIONS.map((opt) => {
          const active = opt === n;
          return (
            <Pressable
              key={opt}
              accessibilityRole="button"
              onPress={() => onChangeN(opt)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.sm,
                borderWidth: 1,
                borderColor: active ? colors.accent.red : colors.border.subtle,
                backgroundColor: active ? 'rgba(200, 16, 46, 0.10)' : 'transparent',
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: active ? colors.text.primary : colors.text.secondary,
                  fontSize: fontSize.caption,
                  fontWeight: active ? fontWeight.medium : fontWeight.regular,
                }}
              >
                {opt} dernières
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.text.secondary} style={{ marginVertical: spacing.xxl }} />
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <DuelStatColumn eyebrow="VOUS" stats={myStats} n={n} />
          <DuelStatColumn eyebrow="EUX" stats={theirStats} n={n} />
        </View>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SessionPicker({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.sm }]}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {items.map((it) => {
            const active = it.id === selectedId;
            return (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                onPress={() => onSelect(it.id)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.sm,
                  borderWidth: 0.5,
                  borderColor: active ? colors.accent.red : colors.border.subtle,
                  backgroundColor: active ? 'rgba(200, 16, 46, 0.10)' : colors.background.secondary,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? colors.text.primary : colors.text.secondary,
                    fontSize: fontSize.caption,
                  }}
                >
                  {it.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DuelColumn({
  eyebrow,
  marginGlobal,
  marginZone,
  context,
}: {
  eyebrow: string;
  marginGlobal: number | null;
  marginZone: MarginZone | null;
  context: string | null;
}) {
  const color = colorForZone(marginZone);
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.md }]}>
        {eyebrow}
      </Text>
      {marginGlobal !== null ? (
        <>
          <Text style={[typography.heroNumber, { color, marginBottom: spacing.sm }]}>
            {Math.round(marginGlobal)}%
          </Text>
          {marginZone ? (
            <Text
              style={{
                color,
                fontSize: fontSize.caption,
                fontWeight: fontWeight.light,
                textAlign: 'center',
              }}
            >
              {marginLabelOf(marginZone)}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={emptyTextStyle}>—</Text>
      )}
      {context ? (
        <Text
          style={{
            color: colors.text.tertiary,
            fontSize: fontSize.eyebrow,
            marginTop: spacing.md,
          }}
        >
          {context}
        </Text>
      ) : null}
    </View>
  );
}

function DuelStatColumn({
  eyebrow,
  stats,
  n,
}: {
  eyebrow: string;
  stats: AggregatedStats | null;
  n: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.md }]}>
        {eyebrow}
      </Text>
      {!stats || stats.count === 0 ? (
        <Text style={emptyTextStyle}>Pas assez de sessions</Text>
      ) : (
        <>
          <Text
            style={{
              color: colors.text.tertiary,
              fontSize: fontSize.eyebrow,
              marginBottom: spacing.xs,
            }}
          >
            MARGE MOYENNE ({stats.count}/{n})
          </Text>
          <Text style={[typography.heroNumber, { color: colors.text.primary }]}>
            {stats.marginAvg !== null ? `${Math.round(stats.marginAvg)}%` : '—'}
          </Text>
          <Text
            style={{
              color: colors.text.tertiary,
              fontSize: fontSize.eyebrow,
              marginTop: spacing.lg,
            }}
          >
            MEILLEURE
          </Text>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.bodyLarge,
              fontWeight: fontWeight.medium,
            }}
          >
            {stats.marginBest !== null ? `${Math.round(stats.marginBest)}%` : '—'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.xs,
              marginTop: spacing.lg,
              alignItems: 'center',
            }}
          >
            <ZoneDot color={colors.margin.green} count={stats.marginZoneDistribution.green} />
            <ZoneDot color={colors.margin.yellow} count={stats.marginZoneDistribution.yellow} />
            <ZoneDot color={colors.margin.red} count={stats.marginZoneDistribution.red} />
          </View>
        </>
      )}
    </View>
  );
}

function ZoneDot({ color, count }: { color: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>{count}</Text>
    </View>
  );
}

function colorForZone(zone: MarginZone | null): string {
  if (zone === 'green') return colors.margin.green;
  if (zone === 'yellow') return colors.margin.yellow;
  if (zone === 'red') return colors.margin.red;
  return colors.text.secondary;
}

const emptyTextStyle = {
  color: colors.text.tertiary,
  fontSize: fontSize.caption,
  textAlign: 'center' as const,
  padding: spacing.lg,
  fontStyle: 'italic' as const,
};
