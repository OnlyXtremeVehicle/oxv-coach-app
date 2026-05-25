/**
 * Écran Coach — Comparatif de 2 sessions d'un même pilote.
 *
 * Deux cartes empilées (mobile portrait) ou côte à côte (tablette / paysage),
 * chacune affichant la trajectoire réelle GPS du pilote et la coloration
 * des 7 virages par zone de marge.
 *
 * Doctrine coach :
 *   - Pas de "winner" — pas de "session B est meilleure que A"
 *   - Delta neutre (« +12 pts », « -0.4 s ») sans interprétation
 *   - Le coach interprète, l'app décrit
 *   - Lecture seule, pas d'écriture
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { CoachPreset } from '@/components/CircuitMap';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type SessionSnapshot, loadSessionSnapshot, logCoachView } from '@/services/coachService';
import { type MarginZone } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort, formatLapTime } from '@/utils/format';

export default function CoachComparerScreen() {
  const params = useLocalSearchParams<{
    pilotId?: string;
    sessionA?: string;
    sessionB?: string;
  }>();
  const { width } = useWindowDimensions();
  const sideBySide = width >= 760;

  const [snapA, setSnapA] = useState<SessionSnapshot | null>(null);
  const [snapB, setSnapB] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.sessionA || !params.sessionB) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    // Audit log côté coach : un accès à 2 sessions = 1 event "coach_view_compare"
    if (params.pilotId) {
      logCoachView(params.pilotId, {
        subtype: 'coach_view_compare',
        sessionId: params.sessionA,
      });
      logCoachView(params.pilotId, {
        subtype: 'coach_view_compare',
        sessionId: params.sessionB,
      });
    }

    Promise.all([loadSessionSnapshot(params.sessionA), loadSessionSnapshot(params.sessionB)])
      .then(([a, b]) => {
        if (cancelled) return;
        setSnapA(a);
        setSnapB(b);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[OXV][coach] comparer :', err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.sessionA, params.sessionB, params.pilotId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>COMPARATIF</Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          Deux sessions, côte à côte.
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : !snapA || !snapB ? (
          <EmptyState />
        ) : (
          <>
            {/* Cartes */}
            <View
              style={{
                flexDirection: sideBySide ? 'row' : 'column',
                gap: spacing.lg,
              }}
            >
              <View style={{ flex: 1 }}>
                <SessionCard label="Session A" snap={snapA} accent={colors.accent.coach} />
              </View>
              <View style={{ flex: 1 }}>
                <SessionCard label="Session B" snap={snapB} accent={colors.accent.coach} />
              </View>
            </View>

            {/* Delta global */}
            <View
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
                deltaText={formatDeltaPoints(snapA.marginGlobal, snapB.marginGlobal)}
              />
              <DeltaLine
                label="Meilleur tour"
                deltaText={formatDeltaSeconds(snapA.bestLapSeconds, snapB.bestLapSeconds)}
              />
              <DeltaLine
                label="Nombre de tours"
                deltaText={formatDeltaCount(snapA.lapCount, snapB.lapCount)}
              />
            </View>

            {/* Delta par virage */}
            <View style={{ marginTop: spacing.xxl }}>
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
                  <CornerDeltaRow
                    key={corner.index}
                    cornerIndex={corner.index}
                    cornerName={corner.name}
                    zoneA={snapA.zoneByIndex[corner.index] ?? null}
                    zoneB={snapB.zoneByIndex[corner.index] ?? null}
                    marginA={snapA.marginByIndex[corner.index] ?? null}
                    marginB={snapB.marginByIndex[corner.index] ?? null}
                  />
                ))}
              </View>
            </View>
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

function SessionCard({
  label,
  snap,
  accent,
}: {
  label: string;
  snap: SessionSnapshot;
  accent: string;
}) {
  const dateStr = formatDateShort(snap.startedAt);
  const marginStr = snap.marginGlobal !== null ? `${Math.round(snap.marginGlobal)} %` : '—';
  const lapStr =
    snap.bestLapSeconds !== null ? `Meilleur tour ${formatLapTime(snap.bestLapSeconds)}` : null;
  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: accent,
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
        <View>
          <Text style={[typography.eyebrow, { color: accent }]}>{label}</Text>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
              marginTop: spacing.xs,
            }}
          >
            {dateStr}
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
        height={220}
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
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
      }}
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

function CornerDeltaRow({
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
        {deltaStr}
      </Text>
    </View>
  );
}

function ZoneDot({ zone }: { zone: MarginZone | null }) {
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colorForZone(zone),
      }}
    />
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
        Sélection incomplète.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Le comparatif requiert deux sessions analysées. Revenez à la liste pour les choisir.
      </Text>
    </View>
  );
}

// ============================================================================
// Helpers de formatage
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

function formatDeltaCount(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  const delta = b - a;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(delta)}`;
}
