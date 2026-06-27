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
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel du kit. Accent coach =
 * theme.palette.coach (crème neutre). Cartes SVG (CoachPreset) inchangées.
 */

import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CoachPreset } from '@/components/CircuitMap';
import { FadeInSection } from '@/components/motion';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type SessionSnapshot, loadSessionSnapshot, logCoachView } from '@/services/coachService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
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
    <Screen>
      <AppBar title="COMPARATIF" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Deux sessions, côte à côte.</Text>

        {loading ? (
          <Text style={s.caption}>Chargement…</Text>
        ) : !snapA || !snapB ? (
          <EmptyState />
        ) : (
          <>
            {/* Cartes — apparition décalée pour laisser le coach lire A avant que B arrive */}
            <View
              style={{
                flexDirection: sideBySide ? 'row' : 'column',
                gap: theme.spacing.lg,
                marginTop: theme.spacing.lg,
              }}
            >
              <FadeInSection delay={0} style={{ flex: 1 }}>
                <SessionCard label="Session A" snap={snapA} />
              </FadeInSection>
              <FadeInSection delay={350} style={{ flex: 1 }}>
                <SessionCard label="Session B" snap={snapB} />
              </FadeInSection>
            </View>

            {/* Delta global */}
            <FadeInSection delay={700} style={{ marginTop: theme.spacing.xxl }}>
              <Card style={{ borderColor: theme.palette.coach }}>
                <SectionLabel>ÉCART B − A</SectionLabel>
                <View style={{ marginTop: theme.spacing.md }}>
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
              </Card>
            </FadeInSection>

            {/* Delta par virage */}
            <FadeInSection delay={900} style={{ marginTop: theme.spacing.xxl }}>
              <View style={{ marginBottom: theme.spacing.md }}>
                <SectionLabel>MARGES PAR VIRAGE</SectionLabel>
              </View>
              <View style={{ gap: theme.spacing.xs }}>
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
            </FadeInSection>
          </>
        )}
      </View>
    </Screen>
  );
}

function SessionCard({ label, snap }: { label: string; snap: SessionSnapshot }) {
  const dateStr = formatDateShort(snap.startedAt);
  const marginStr = snap.marginGlobal !== null ? `${Math.round(snap.marginGlobal)} %` : '—';
  const lapStr =
    snap.bestLapSeconds !== null ? `Meilleur tour ${formatLapTime(snap.bestLapSeconds)}` : null;
  return (
    <Card style={{ borderColor: theme.palette.coach }}>
      <View style={s.cardHead}>
        <View>
          <SectionLabel>{label}</SectionLabel>
          <Text style={s.cardDate}>{dateStr}</Text>
        </View>
        <Text style={s.cardMargin}>{marginStr}</Text>
      </View>
      <CoachPreset
        trajectory={snap.trajectory.length > 1 ? snap.trajectory : undefined}
        zoneByIndex={snap.zoneByIndex}
        height={220}
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
  // Les pastilles couleur restent décoratives pour l'œil ; on les double d'un
  // libellé accessible (zone A → zone B + écart) pour le lecteur d'écran.
  const a11yLabel = `Virage ${cornerIndex}, ${cornerName}. ${zoneLabelFr(zoneA)} vers ${zoneLabelFr(
    zoneB
  )}. Écart ${deltaStr}.`;
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

function EmptyState() {
  return (
    <Card
      style={{
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
        marginTop: theme.spacing.lg,
      }}
    >
      <Text style={s.emptyTitle}>Sélection incomplète.</Text>
      <Text style={s.emptyHint}>
        Le comparatif requiert deux sessions analysées. Revenez à la liste pour les choisir.
      </Text>
    </Card>
  );
}

// ============================================================================
// Helpers de formatage
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

function formatDeltaCount(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  const delta = b - a;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(delta)}`;
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
  cardHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: theme.spacing.sm,
  },
  cardDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
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
