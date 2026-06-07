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
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { type MarginZone } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>COMPARATIF PILOTES</Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          Deux pilotes, côte à côte.
        </Text>

        {loadingPilots ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : pilots.length < 2 ? (
          <EmptyPilots count={pilots.length} />
        ) : (
          <>
            {/* Sélecteurs A & B */}
            <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: spacing.lg }}>
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
                    gap: spacing.lg,
                    marginTop: spacing.xxl,
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
                <FadeInSection
                  delay={600}
                  style={{
                    marginTop: spacing.xxl,
                    padding: spacing.xl,
                    borderRadius: borderRadius.lg,
                    borderWidth: 0.5,
                    borderColor: colors.accent.coach,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <Text
                    style={[
                      typography.eyebrow,
                      { color: colors.accent.coach, marginBottom: spacing.md },
                    ]}
                  >
                    ÉCART B − A
                  </Text>
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
                </FadeInSection>

                {/* Marges par virage */}
                <FadeInSection delay={800} style={{ marginTop: spacing.xxl }}>
                  <Text
                    style={[
                      typography.eyebrow,
                      { color: colors.accent.coach, marginBottom: spacing.md },
                    ]}
                  >
                    MARGES PAR VIRAGE
                  </Text>
                  <View style={{ gap: spacing.xs }}>
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
                  Les chiffres sont là. Le sens, vous le posez avec chacun.
                </Text>
              </>
            ) : (
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.text.tertiary,
                    textAlign: 'center',
                    marginTop: spacing.xxl,
                    fontStyle: 'italic',
                  },
                ]}
              >
                Choisissez un pilote et une session de chaque côté.
              </Text>
            )}
          </>
        )}

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
      <Text style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.sm }]}>
        {label}
      </Text>
      {/* Pilotes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }}>
          {pilots.map((p) => {
            const active = side.pilot?.pilotId === p.pilotId;
            return (
              <Chip
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
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.sm }]}
          >
            Chargement des sessions…
          </Text>
        ) : side.sessions.length === 0 ? (
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.sm }]}
          >
            Aucune session analysée.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.sm }}
          >
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }}>
              {side.sessions.map((s) => (
                <Chip
                  key={s.id}
                  label={`${formatDateShort(s.startedAt)} · ${s.circuitName ?? '—'}`}
                  active={side.selectedSessionId === s.id}
                  onPress={() => onSelectSession(s.id)}
                />
              ))}
            </View>
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 0.5,
        borderColor: active ? colors.accent.coach : colors.border.subtle,
        backgroundColor: active ? 'rgba(30, 58, 95, 0.18)' : colors.background.secondary,
        opacity: pressed ? 0.85 : 1,
        maxWidth: 200,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          color: active ? colors.text.primary : colors.text.secondary,
          fontSize: fontSize.caption,
          fontWeight: active ? fontWeight.medium : fontWeight.regular,
        }}
      >
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
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.accent.coach,
        backgroundColor: colors.background.secondary,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.medium,
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              color: colors.text.tertiary,
              fontSize: fontSize.caption,
              marginTop: spacing.xs,
            }}
          >
            {formatDateShort(snap.startedAt)}
          </Text>
        </View>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.titleLarge,
            fontWeight: fontWeight.light,
            fontFamily: 'Menlo',
          }}
        >
          {marginStr}
        </Text>
      </View>
      <CoachPreset
        trajectory={snap.trajectory.length > 1 ? snap.trajectory : undefined}
        zoneByIndex={snap.zoneByIndex}
        height={200}
      />
      {lapStr ? (
        <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.sm }]}>
          {lapStr}
        </Text>
      ) : null}
    </View>
  );
}

function DeltaLine({ label, deltaText }: { label: string; deltaText: string }) {
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}
    >
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.body }}>{label}</Text>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
          fontFamily: 'Menlo',
        }}
      >
        {deltaText}
      </Text>
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      <Text
        style={{
          color: colors.text.tertiary,
          fontSize: fontSize.caption,
          width: 16,
          textAlign: 'center',
        }}
      >
        {cornerIndex}
      </Text>
      <Text style={{ flex: 1, color: colors.text.primary, fontSize: fontSize.body }}>
        {cornerName}
      </Text>
      <ZoneDot zone={zoneA} />
      <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>→</Text>
      <ZoneDot zone={zoneB} />
      <Text
        style={{
          width: 64,
          textAlign: 'right',
          color: colors.text.primary,
          fontSize: fontSize.caption,
          fontFamily: 'Menlo',
        }}
      >
        {formatDeltaPoints(marginA, marginB)}
      </Text>
    </View>
  );
}

function ZoneDot({ zone }: { zone: MarginZone | null }) {
  return (
    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorForZone(zone) }} />
  );
}

function EmptyPilots({ count }: { count: number }) {
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
        {count === 0 ? 'Aucun pilote suivi.' : 'Un seul pilote suivi.'}
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        La comparaison requiert au moins deux pilotes consentants.
      </Text>
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function colorForZone(zone: MarginZone | null): string {
  if (!zone) return colors.text.tertiary;
  return zone === 'green'
    ? colors.margin.green
    : zone === 'yellow'
      ? colors.margin.yellow
      : colors.margin.red;
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
