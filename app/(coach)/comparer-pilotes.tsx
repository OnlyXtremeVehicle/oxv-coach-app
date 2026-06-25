/**
 * Écran Coach — Comparatif de DEUX pilotes différents.
 *
 * Distinct de comparer.tsx (qui compare 2 sessions d'UN même pilote).
 * Ici le coach choisit pilote A + une de ses sessions, et pilote B + une
 * de ses sessions, pour les regarder côte à côte.
 *
 * Légitimité doctrinale (cahier OXV Mirror §8) : le coach est le tiers
 * professionnel agréé qui interprète. La comparaison entre élèves est son
 * outil de travail. L'app reste descriptive — elle montre les chiffres,
 * c'est le coach qui en tire le sens avec chaque pilote.
 *
 * Sécurité : le coach ne voit QUE ses pilotes consentis (RLS coach_pilots
 * + is_coach_of). loadSessionSnapshot échoue si la session n'appartient
 * pas à un pilote suivi.
 *
 * Doctrine :
 *   - Delta neutre, jamais "pilote A meilleur que B"
 *   - Lecture seule
 *   - Audit RGPD : chaque consultation loggée via logCoachView
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel du kit. Accent coach =
 * theme.palette.coach (crème neutre). Cartes SVG (CoachPreset) inchangées.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { CoachPreset } from '@/components/CircuitMap';
import { FadeInSection } from '@/components/motion';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  type SessionSnapshot,
  listMyPilots,
  listPilotSessions,
  loadSessionSnapshot,
  logCoachView,
} from '@/services/coachService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort, formatLapTime } from '@/utils/format';

interface Side {
  pilot: CoachPilotRow | null;
  sessions: PilotSessionSummary[];
  selectedSessionId: string | null;
  snapshot: SessionSnapshot | null;
  loadingSessions: boolean;
  loadingSnapshot: boolean;
}

const EMPTY_SIDE: Side = {
  pilot: null,
  sessions: [],
  selectedSessionId: null,
  snapshot: null,
  loadingSessions: false,
  loadingSnapshot: false,
};

export default function CoachComparerPilotesScreen() {
  const { width } = useWindowDimensions();
  const sideBySide = width >= 760;

  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [loadingPilots, setLoadingPilots] = useState(true);
  const [sideA, setSideA] = useState<Side>(EMPTY_SIDE);
  const [sideB, setSideB] = useState<Side>(EMPTY_SIDE);

  useEffect(() => {
    let cancelled = false;
    listMyPilots().then((rows) => {
      if (!cancelled) {
        setPilots(rows);
        setLoadingPilots(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function pilotName(p: CoachPilotRow): string {
    return (
      [p.firstName, p.lastName].filter(Boolean).join(' ').trim() ||
      `Pilote ${p.pilotId.slice(0, 6)}`
    );
  }

  async function selectPilot(side: 'A' | 'B', pilot: CoachPilotRow) {
    const setter = side === 'A' ? setSideA : setSideB;
    setter({ ...EMPTY_SIDE, pilot, loadingSessions: true });
    const sessions = await listPilotSessions(pilot.pilotId);
    setter((prev) =>
      prev.pilot?.pilotId === pilot.pilotId ? { ...prev, sessions, loadingSessions: false } : prev
    );
  }

  async function selectSession(side: 'A' | 'B', pilotId: string, sessionId: string) {
    const setter = side === 'A' ? setSideA : setSideB;
    setter((prev) => ({ ...prev, selectedSessionId: sessionId, loadingSnapshot: true }));
    logCoachView(pilotId, { subtype: 'coach_view_compare_pilots', sessionId });
    const snap = await loadSessionSnapshot(sessionId);
    setter((prev) =>
      prev.selectedSessionId === sessionId
        ? { ...prev, snapshot: snap, loadingSnapshot: false }
        : prev
    );
  }

  const bothReady = sideA.snapshot && sideB.snapshot;

  return (
    <Screen>
      <AppBar title="COMPARATIF PILOTES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Deux pilotes, côte à côte.</Text>

        {loadingPilots ? (
          <Text style={s.caption}>Chargement…</Text>
        ) : pilots.length < 2 ? (
          <EmptyPilots count={pilots.length} />
        ) : (
          <>
            {/* Sélecteurs A & B */}
            <View
              style={{
                flexDirection: sideBySide ? 'row' : 'column',
                gap: theme.spacing.lg,
                marginTop: theme.spacing.lg,
              }}
            >
              <SidePicker
                label="PILOTE A"
                side={sideA}
                pilots={pilots}
                pilotName={pilotName}
                onSelectPilot={(p) => selectPilot('A', p)}
                onSelectSession={(sid) =>
                  sideA.pilot && selectSession('A', sideA.pilot.pilotId, sid)
                }
              />
              <SidePicker
                label="PILOTE B"
                side={sideB}
                pilots={pilots}
                pilotName={pilotName}
                onSelectPilot={(p) => selectPilot('B', p)}
                onSelectSession={(sid) =>
                  sideB.pilot && selectSession('B', sideB.pilot.pilotId, sid)
                }
              />
            </View>

            {/* Cartes côte à côte */}
            {bothReady ? (
              <>
                <View
                  style={{
                    flexDirection: sideBySide ? 'row' : 'column',
                    gap: theme.spacing.lg,
                    marginTop: theme.spacing.xxl,
                  }}
                >
                  <FadeInSection delay={0} style={{ flex: 1 }}>
                    <SnapshotCard
                      name={sideA.pilot ? pilotName(sideA.pilot) : 'A'}
                      snap={sideA.snapshot!}
                    />
                  </FadeInSection>
                  <FadeInSection delay={300} style={{ flex: 1 }}>
                    <SnapshotCard
                      name={sideB.pilot ? pilotName(sideB.pilot) : 'B'}
                      snap={sideB.snapshot!}
                    />
                  </FadeInSection>
                </View>

                {/* Delta neutre B − A */}
                <FadeInSection delay={600} style={{ marginTop: theme.spacing.xxl }}>
                  <Card style={{ borderColor: theme.palette.coach }}>
                    <SectionLabel>ÉCART B − A</SectionLabel>
                    <View style={{ marginTop: theme.spacing.md }}>
                      <DeltaLine
                        label="Marge globale"
                        deltaText={formatDeltaPoints(
                          sideA.snapshot!.marginGlobal,
                          sideB.snapshot!.marginGlobal
                        )}
                      />
                      <DeltaLine
                        label="Meilleur tour"
                        deltaText={formatDeltaSeconds(
                          sideA.snapshot!.bestLapSeconds,
                          sideB.snapshot!.bestLapSeconds
                        )}
                      />
                    </View>
                  </Card>
                </FadeInSection>

                {/* Marges par virage */}
                <FadeInSection delay={800} style={{ marginTop: theme.spacing.xxl }}>
                  <View style={{ marginBottom: theme.spacing.md }}>
                    <SectionLabel>MARGES PAR VIRAGE</SectionLabel>
                  </View>
                  <View style={{ gap: theme.spacing.xs }}>
                    {BELTOISE_CORNERS.map((corner) => (
                      <CornerRow
                        key={corner.index}
                        cornerIndex={corner.index}
                        cornerName={corner.name}
                        zoneA={sideA.snapshot!.zoneByIndex[corner.index] ?? null}
                        zoneB={sideB.snapshot!.zoneByIndex[corner.index] ?? null}
                        marginA={sideA.snapshot!.marginByIndex[corner.index] ?? null}
                        marginB={sideB.snapshot!.marginByIndex[corner.index] ?? null}
                      />
                    ))}
                  </View>
                </FadeInSection>

                {/* Manifeste doctrinal coach */}
                <Text style={s.manifest}>
                  Les chiffres sont là. Le sens, vous le posez avec chacun.
                </Text>
              </>
            ) : (
              <Text style={s.hint}>Choisissez un pilote et une session de chaque côté.</Text>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SidePicker({
  label,
  side,
  pilots,
  pilotName,
  onSelectPilot,
  onSelectSession,
}: {
  label: string;
  side: Side;
  pilots: CoachPilotRow[];
  pilotName: (p: CoachPilotRow) => string;
  onSelectPilot: (p: CoachPilotRow) => void;
  onSelectSession: (sessionId: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginBottom: theme.spacing.sm }}>
        <SectionLabel>{label}</SectionLabel>
      </View>
      {/* Pilotes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View
          style={{ flexDirection: 'row', gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
        >
          {pilots.map((p) => {
            const active = side.pilot?.pilotId === p.pilotId;
            return (
              <PickChip
                key={p.pilotId}
                label={pilotName(p)}
                active={active}
                onPress={() => onSelectPilot(p)}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Sessions du pilote choisi */}
      {side.pilot ? (
        side.loadingSessions ? (
          <Text style={[s.caption, { marginTop: theme.spacing.sm }]}>Chargement des sessions…</Text>
        ) : side.sessions.length === 0 ? (
          <Text style={[s.caption, { marginTop: theme.spacing.sm }]}>Aucune session analysée.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: theme.spacing.sm }}
          >
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                paddingBottom: theme.spacing.sm,
              }}
            >
              {side.sessions.map((sess) => (
                <PickChip
                  key={sess.id}
                  label={`${formatDateShort(sess.startedAt)} · ${sess.circuitName ?? '—'}`}
                  active={side.selectedSessionId === sess.id}
                  onPress={() => onSelectSession(sess.id)}
                />
              ))}
            </View>
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

function PickChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [s.chip, active ? s.chipOn : null, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text numberOfLines={1} style={[s.chipText, active ? s.chipTextOn : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SnapshotCard({ name, snap }: { name: string; snap: SessionSnapshot }) {
  const marginStr = snap.marginGlobal !== null ? `${Math.round(snap.marginGlobal)} %` : '—';
  const lapStr =
    snap.bestLapSeconds !== null ? `Meilleur tour ${formatLapTime(snap.bestLapSeconds)}` : null;
  return (
    <Card style={{ borderColor: theme.palette.coach }}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={s.cardName}>
            {name}
          </Text>
          <Text style={s.cardDate}>{formatDateShort(snap.startedAt)}</Text>
        </View>
        <Text style={s.cardMargin}>{marginStr}</Text>
      </View>
      <CoachPreset
        trajectory={snap.trajectory.length > 1 ? snap.trajectory : undefined}
        zoneByIndex={snap.zoneByIndex}
        height={200}
      />
      {lapStr ? <Text style={s.lapStr}>{lapStr}</Text> : null}
    </Card>
  );
}

function DeltaLine({ label, deltaText }: { label: string; deltaText: string }) {
  return (
    <View style={s.deltaLine}>
      <Text style={s.deltaLabel}>{label}</Text>
      <Text style={s.deltaValue}>{deltaText}</Text>
    </View>
  );
}

function CornerRow({
  cornerIndex,
  cornerName,
  zoneA,
  zoneB,
  marginA,
  marginB,
}: {
  cornerIndex: number;
  cornerName: string;
  zoneA: MarginZone | null;
  zoneB: MarginZone | null;
  marginA: number | null;
  marginB: number | null;
}) {
  const deltaStr = formatDeltaPoints(marginA, marginB);
  const a11yLabel = `Virage ${cornerIndex}, ${cornerName}. A : ${zoneLabelFr(
    zoneA
  )}. B : ${zoneLabelFr(zoneB)}. Écart ${deltaStr}.`;
  return (
    <View accessible accessibilityLabel={a11yLabel} style={s.cornerRow}>
      <Text style={s.cornerIndex}>{cornerIndex}</Text>
      <Text style={s.cornerName}>{cornerName}</Text>
      <ZoneDot zone={zoneA} />
      <Text style={s.arrow}>→</Text>
      <ZoneDot zone={zoneB} />
      <Text style={s.cornerDelta}>{deltaStr}</Text>
    </View>
  );
}

function ZoneDot({ zone }: { zone: MarginZone | null }) {
  return <View style={[s.zoneDot, { backgroundColor: colorForZone(zone) }]} />;
}

function EmptyPilots({ count }: { count: number }) {
  return (
    <Card
      style={{
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
        marginTop: theme.spacing.lg,
      }}
    >
      <Text style={s.emptyTitle}>
        {count === 0 ? 'Aucun pilote suivi.' : 'Un seul pilote suivi.'}
      </Text>
      <Text style={s.emptyHint}>La comparaison requiert au moins deux pilotes consentants.</Text>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function colorForZone(zone: MarginZone | null): string {
  switch (zone) {
    case 'green':
      return theme.dataColors.accel;
    case 'yellow':
      return theme.palette.gold;
    case 'red':
      return theme.palette.red;
    default:
      return theme.palette.creamMute;
  }
}

function zoneLabelFr(zone: MarginZone | null): string {
  return zone ? marginLabelOf(zone) : 'marge indisponible';
}

function formatDeltaPoints(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  const delta = b - a;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(Math.round(delta))} pts`;
}

function formatDeltaSeconds(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  const delta = b - a;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(delta).toFixed(2)} s`;
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
  },
  hint: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
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
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
    maxWidth: 200,
  },
  chipOn: {
    borderColor: theme.palette.coach,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  chipText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
  },
  chipTextOn: {
    color: theme.palette.cream,
  },
  cardHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: theme.spacing.sm,
  },
  cardName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardDate: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  cardMargin: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
  },
  lapStr: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  deltaLine: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: theme.spacing.xs,
  },
  deltaLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  deltaValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  cornerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  cornerIndex: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    width: 16,
    textAlign: 'center' as const,
  },
  cornerName: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  arrow: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  cornerDelta: {
    width: 64,
    textAlign: 'right' as const,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
  },
  zoneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
