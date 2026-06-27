/**
 * Écran Côte à côte — comparaison amicale entre deux copains pilotes.
 *
 * Ce n'est PAS du coaching ni un classement : c'est un partage entre amis
 * qui ont chacun opt-in. Deux pilotes consentants regardent leurs chiffres
 * l'un à côté de l'autre, par jeu, sans hiérarchie.
 *
 * 2 modes au choix :
 *   1. SNAPSHOT  — 1 session vs 1 session (sélecteur des 2 côtés)
 *   2. AGRÉGÉ    — moyenne + best des N dernières sessions des 2
 *
 * Doctrine OXV Mirror :
 *   - PAS DE GAGNANT DÉSIGNÉ. Pas de badge, pas de "vainqueur".
 *   - Pas de conseil, pas d'interprétation : l'app montre, elle ne juge pas.
 *   - Juste les chiffres côte à côte, neutres, entre deux copains.
 *   - Phrase manifeste en bas : « Entre copains. Pas de classement. »
 *
 * Sécurité : 100% RLS (migration 0027). Si l'ami a révoqué l'amitié
 * pendant qu'on est sur l'écran, le fetch retourne [] et on tombe sur
 * l'état vide.
 *
 * Reskin V2 : Screen + AppBar, Segmented pour les bascules, Card pour les
 * colonnes et la grille virage par virage. La logique de données, le RLS et
 * les couleurs de zone de marge sont inchangés.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ABTrace } from '@/components/instruments';

import { listRecentAnalyses, type RecentAnalysisRow } from '@/services/analysesService';
import {
  type DuelSessionRow,
  type AggregatedStats,
  loadAggregatedStats,
  loadFriendSessionList,
} from '@/services/duelService';
import { listAcceptedFriends } from '@/services/friendshipsService';
import {
  type SegmentAnalysisRow,
  listSegmentAnalysesForSession,
} from '@/services/segmentAnalysesService';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { useAuthStore } from '@/store/useAuthStore';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { Segmented } from '@/ui/Segmented';
import { formatDateShort } from '@/utils/format';

// Couleurs sémantiques des zones de marge (vert/jaune/rouge). Conservées à
// l'identique : ce sont des couleurs de donnée doublées d'un libellé, sans
// équivalent dans la palette V2 générique.
const MARGIN_COLORS = {
  green: '#97C459',
  yellow: '#EF9F27',
  red: '#C8102E',
} as const;

type Mode = 'snapshot' | 'aggregated';
const AGGREGATE_OPTIONS = [3, 5, 10] as const;
type AggregateN = (typeof AGGREGATE_OPTIONS)[number];

const MODE_OPTIONS: { id: Mode; label: string }[] = [
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'aggregated', label: 'Agrégé' },
];

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

  const [mySegments, setMySegments] = useState<SegmentAnalysisRow[]>([]);
  const [theirSegments, setTheirSegments] = useState<SegmentAnalysisRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

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

  // En mode snapshot, fetch les segment analyses des 2 côtés quand
  // les sessions sélectionnées changent. RLS strict côté DB.
  useEffect(() => {
    if (mode !== 'snapshot') return;
    let cancelled = false;
    (async () => {
      setSegmentsLoading(true);
      const [mine, theirs] = await Promise.all([
        selectedMine ? listSegmentAnalysesForSession(selectedMine) : Promise.resolve([]),
        selectedTheirs ? listSegmentAnalysesForSession(selectedTheirs) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setMySegments(mine);
      setTheirSegments(theirs);
      setSegmentsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, selectedMine, selectedTheirs]);

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
      <Screen scroll={false}>
        <AppBar title="CÔTE À CÔTE" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="CÔTE À CÔTE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={st.title}>Vous & {friendDisplayName}</Text>

        <View style={{ marginBottom: theme.spacing.xl }}>
          <Segmented
            options={MODE_OPTIONS.map((o) => o.label)}
            value={MODE_OPTIONS.find((o) => o.id === mode)!.label}
            onChange={(label) => {
              const next = MODE_OPTIONS.find((o) => o.label === label);
              if (next) setMode(next.id);
            }}
          />
        </View>

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
            mySegments={mySegments}
            theirSegments={theirSegments}
            segmentsLoading={segmentsLoading}
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

        <Text style={st.manifest}>Entre copains. Pas de classement.</Text>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={st.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
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
  mySegments: SegmentAnalysisRow[];
  theirSegments: SegmentAnalysisRow[];
  segmentsLoading: boolean;
}

function SnapshotView(props: SnapshotProps) {
  if (props.mySessions.length === 0 || props.friendSessions.length === 0) {
    return <Text style={st.empty}>Pas assez de sessions des deux côtés pour comparer.</Text>;
  }
  return (
    <>
      <SessionPicker
        label="Votre session"
        items={props.mySessions.map((s) => ({
          id: s.telemetrySessionId,
          label: `${formatDateShort(s.sessionStartedAt)} · ${s.circuitName ?? '—'}`,
        }))}
        selectedId={props.selectedMine}
        onSelect={props.onSelectMine}
      />
      <SessionPicker
        label="Sa session"
        items={props.friendSessions.map((s) => ({
          id: s.sessionId,
          label: `${formatDateShort(s.startedAt)} · ${s.circuitName ?? '—'}`,
        }))}
        selectedId={props.selectedTheirs}
        onSelect={props.onSelectTheirs}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
        <DuelColumn
          eyebrow="Vous"
          accent={theme.palette.gold}
          marginGlobal={props.selectedMineRow?.marginGlobal ?? null}
          marginZone={props.selectedMineRow?.marginZone ?? null}
          context={
            props.selectedMineRow?.sessionStartedAt
              ? formatDateShort(props.selectedMineRow.sessionStartedAt)
              : null
          }
        />
        <DuelColumn
          eyebrow="Eux"
          accent={theme.palette.cream}
          marginGlobal={props.selectedTheirsRow?.marginGlobal ?? null}
          marginZone={props.selectedTheirsRow?.marginZone ?? null}
          context={
            props.selectedTheirsRow?.startedAt
              ? formatDateShort(props.selectedTheirsRow.startedAt)
              : null
          }
        />
      </View>

      {/* Superposition factuelle des deux tours (vous vs ami) : votre meilleur
          tour en or, le sien en neutre, sur le même tracé. Partage consenti
          entre amis acceptés (RLS telemetry_frames_select_friend) — pas de
          gagnant, pas de classement. */}
      {props.selectedMine && props.selectedTheirs ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <ABTrace
            sessionA={props.selectedMine}
            sessionB={props.selectedTheirs}
            labelA="Vous"
            labelB="Eux"
            statusLabel="VOS DEUX TOURS · CÔTE À CÔTE"
            note="Vos deux lignes, côte à côte — pas de classement."
            emptyMessage="La superposition apparaîtra dès que vos deux tours auront des frames réelles."
          />
        </View>
      ) : null}

      {/* Comparaison virage par virage */}
      <CornerComparisonSection
        mySegments={props.mySegments}
        theirSegments={props.theirSegments}
        loading={props.segmentsLoading}
      />
    </>
  );
}

function CornerComparisonSection({
  mySegments,
  theirSegments,
  loading,
}: {
  mySegments: SegmentAnalysisRow[];
  theirSegments: SegmentAnalysisRow[];
  loading: boolean;
}) {
  const mineByIdx = useMemo(() => {
    const map = new Map<number, SegmentAnalysisRow>();
    for (const s of mySegments) map.set(s.segmentIndex, s);
    return map;
  }, [mySegments]);

  const theirsByIdx = useMemo(() => {
    const map = new Map<number, SegmentAnalysisRow>();
    for (const s of theirSegments) map.set(s.segmentIndex, s);
    return map;
  }, [theirSegments]);

  if (!loading && mySegments.length === 0 && theirSegments.length === 0) return null;

  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
        <SectionLabel>Virage par virage</SectionLabel>
      </View>
      {loading ? (
        <ActivityIndicator
          color={theme.palette.creamMute}
          style={{ marginVertical: theme.spacing.lg }}
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {BELTOISE_CORNERS.map((corner, i) => (
            <CornerRow
              key={corner.index}
              cornerIndex={corner.index}
              cornerName={corner.name}
              mine={mineByIdx.get(corner.index) ?? null}
              theirs={theirsByIdx.get(corner.index) ?? null}
              isLast={i === BELTOISE_CORNERS.length - 1}
            />
          ))}
        </Card>
      )}
    </View>
  );
}

function CornerRow({
  cornerIndex,
  cornerName,
  mine,
  theirs,
  isLast,
}: {
  cornerIndex: number;
  cornerName: string;
  mine: SegmentAnalysisRow | null;
  theirs: SegmentAnalysisRow | null;
  isLast: boolean;
}) {
  // Doctrine côte à côte : on situe les deux marges, sans verdict. Le libellé
  // accessible attribue chaque côté (vous / eux) — pas de « gagnant ».
  const a11yLabel = `Virage ${cornerIndex}, ${cornerName}. Vous : ${margePhrase(
    mine
  )}. Eux : ${margePhrase(theirs)}.`;
  return (
    <View
      accessible
      accessibilityLabel={a11yLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.palette.line,
        gap: theme.spacing.md,
      }}
    >
      <View style={{ width: 70 }}>
        <Text style={st.cornerIdx}>V{cornerIndex}</Text>
        <Text style={st.cornerName} numberOfLines={1}>
          {cornerName}
        </Text>
      </View>

      <SegmentMargeCell row={mine} />
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ color: theme.palette.creamMute, fontSize: theme.fontSize.small }}
      >
        ·
      </Text>
      <SegmentMargeCell row={theirs} />
    </View>
  );
}

function margePhrase(row: SegmentAnalysisRow | null): string {
  if (!row || row.marginPercent === null) return 'marge indisponible';
  const pct = Math.round(row.marginPercent);
  return row.marginZone ? `${pct} pour cent, ${marginLabelOf(row.marginZone)}` : `${pct} pour cent`;
}

function SegmentMargeCell({ row }: { row: SegmentAnalysisRow | null }) {
  if (!row || row.marginPercent === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ color: theme.palette.creamMute, fontSize: theme.fontSize.body }}>—</Text>
      </View>
    );
  }
  const color = colorForZone(row.marginZone);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[st.cellValue, { color }]}>{Math.round(row.marginPercent)}%</Text>
    </View>
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
      <View style={{ marginBottom: theme.spacing.xl }}>
        <Segmented
          options={AGGREGATE_OPTIONS.map((o) => `${o} dernières`)}
          value={`${n} dernières`}
          onChange={(label) => {
            const opt = AGGREGATE_OPTIONS.find((o) => `${o} dernières` === label);
            if (opt) onChangeN(opt);
          }}
        />
      </View>

      {loading ? (
        <ActivityIndicator
          color={theme.palette.creamMute}
          style={{ marginVertical: theme.spacing.xxl }}
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <DuelStatColumn eyebrow="Vous" accent={theme.palette.gold} stats={myStats} n={n} />
          <DuelStatColumn eyebrow="Eux" accent={theme.palette.cream} stats={theirStats} n={n} />
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
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View style={{ marginBottom: theme.spacing.sm }}>
        <SectionLabel>{label}</SectionLabel>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {items.map((it) => {
            const active = it.id === selectedId;
            return (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(it.id)}
                style={({ pressed }) => [
                  st.pill,
                  active && st.pillOn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[st.pillT, active && st.pillTOn]}>{it.label}</Text>
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
  accent,
  marginGlobal,
  marginZone,
  context,
}: {
  eyebrow: string;
  accent: string;
  marginGlobal: number | null;
  marginZone: MarginZone | null;
  context: string | null;
}) {
  const color = colorForZone(marginZone);
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.lg }}>
      <View style={{ marginBottom: theme.spacing.md }}>
        <Text style={[st.sideTag, { color: accent }]}>{eyebrow}</Text>
      </View>
      {marginGlobal !== null ? (
        <>
          <Text style={[st.heroNumber, { color, marginBottom: theme.spacing.sm }]}>
            {Math.round(marginGlobal)}%
          </Text>
          {marginZone ? (
            <Text style={[st.zoneLabel, { color }]}>{marginLabelOf(marginZone)}</Text>
          ) : null}
        </>
      ) : (
        <Text style={st.empty}>—</Text>
      )}
      {context ? <Text style={st.colContext}>{context}</Text> : null}
    </Card>
  );
}

function DuelStatColumn({
  eyebrow,
  accent,
  stats,
  n,
}: {
  eyebrow: string;
  accent: string;
  stats: AggregatedStats | null;
  n: number;
}) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.lg }}>
      <View style={{ marginBottom: theme.spacing.md }}>
        <Text style={[st.sideTag, { color: accent }]}>{eyebrow}</Text>
      </View>
      {!stats || stats.count === 0 ? (
        <Text style={st.empty}>Pas assez de sessions</Text>
      ) : (
        <>
          <Text style={st.statCaption}>
            MARGE MOYENNE ({stats.count}/{n})
          </Text>
          <Text style={[st.heroNumber, { color: theme.palette.cream }]}>
            {stats.marginAvg !== null ? `${Math.round(stats.marginAvg)}%` : '—'}
          </Text>
          <Text style={[st.statCaption, { marginTop: theme.spacing.lg }]}>MEILLEURE</Text>
          <Text style={st.statBest}>
            {stats.marginBest !== null ? `${Math.round(stats.marginBest)}%` : '—'}
          </Text>
          <View
            accessible
            accessibilityLabel={`Répartition des marges : ${stats.marginZoneDistribution.green} confortable, ${stats.marginZoneDistribution.yellow} à explorer, ${stats.marginZoneDistribution.red} terrain serré.`}
            style={{
              flexDirection: 'row',
              gap: theme.spacing.xs,
              marginTop: theme.spacing.lg,
              alignItems: 'center',
            }}
          >
            <ZoneDot color={MARGIN_COLORS.green} count={stats.marginZoneDistribution.green} />
            <ZoneDot color={MARGIN_COLORS.yellow} count={stats.marginZoneDistribution.yellow} />
            <ZoneDot color={MARGIN_COLORS.red} count={stats.marginZoneDistribution.red} />
          </View>
        </>
      )}
    </Card>
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
      <Text style={{ color: theme.palette.creamMute, fontSize: theme.fontSize.small }}>
        {count}
      </Text>
    </View>
  );
}

function colorForZone(zone: MarginZone | null): string {
  if (zone === 'green') return MARGIN_COLORS.green;
  if (zone === 'yellow') return MARGIN_COLORS.yellow;
  if (zone === 'red') return MARGIN_COLORS.red;
  return theme.palette.creamSoft;
}

const st = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.2,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  empty: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    padding: theme.spacing.lg,
  },
  pill: {
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  pillOn: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: theme.palette.edge },
  pillT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  sideTag: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  heroNumber: {
    fontFamily: theme.fonts.mono,
    fontSize: 44,
    letterSpacing: -1,
    color: theme.palette.cream,
  },
  zoneLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    textAlign: 'center' as const,
  },
  colContext: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  cornerIdx: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamMute,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
  },
  cornerName: {
    fontFamily: theme.fonts.body,
    color: theme.palette.creamSoft,
    fontSize: theme.fontSize.small,
    marginTop: 2,
  },
  cellValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.bodyLg,
  },
  statCaption: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamMute,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textAlign: 'center' as const,
  },
  statBest: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.cream,
    fontSize: theme.fontSize.bodyLg,
  },
};
