/**
 * Coach — Studio télémétrique (P0/VISION_COACH_STUDIO.md), RESPONSIVE DEUX
 * FORMATS (décision fondateur 2026-07-13, handoff §12).
 *
 *  - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : l'atelier de lecture
 *    d'UNE séance en trois colonnes, fidèle à la maquette coach/03-studio :
 *      · gauche  = signature QDI (radar 5 branches) + lecture rapide (moments),
 *      · centre  = trajectoire & marge par virage (carte + légende de marge) +
 *                  le chiffre roi (marge globale de la séance),
 *      · droite  = « où regarder » (triage factuel) + la liste des tours.
 *  - COMPAGNON téléphone : la même matière, empilée en une colonne compacte.
 *
 * Le MÊME composant s'adapte à la largeur ; aucune navigation n'est cassée.
 *
 * Doctrine : des FAITS. Le triage désigne les virages les plus serrés — il ne
 * dit jamais quoi faire (la cause reste au coach, ou à une suggestion IA qu'il
 * valide, C3). QDI en 5 branches, JAMAIS un score composite (garde-fou T6).
 * L'or reste au chrono/record ; la marge se lit sur son dégradé §7.6.
 *
 * Données réelles uniquement : getStudioSession (agrégation testée), plus les
 * tours (fetchSessionLaps) et la trace GPS (loadSessionTrajectory) en
 * best-effort. La carte et sa trace se remplissent avec les premières TRAMES du
 * boîtier ; sans trame, la topologie du circuit reste lisible. On n'invente rien.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';

import { CoachPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { QdiRadar } from '@/components/QdiRadar';
import { EmptyState } from '@/components/instruments';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { getStudioSession, type StudioSession } from '@/services/coachStudioService';
import { marginZoneExportColor } from '@/services/marginZoneColorLogic';
import { loadSessionTrajectory } from '@/services/sessionTelemetryService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { theme } from '@/theme/v2';
import type { MarginZone } from '@/types/domain';
import type { Lap } from '@/types/telemetry';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { KingNumber } from '@/ui/KingNumber';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatLapTimeMs } from '@/utils/format';

const { palette, dataColors, spacing } = theme;

export default function CoachStudioScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [data, setData] = useState<StudioSession | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getStudioSession(sessionId)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    // Tours + trace GPS : best-effort, ne conditionnent pas l'état de l'écran
    // (vides tant que le boîtier n'a pas déposé de tours/trames).
    fetchSessionLaps(sessionId)
      .then((rows) => {
        if (!cancelled) setLaps(rows);
      })
      .catch(() => undefined);
    loadSessionTrajectory(sessionId)
      .then((pts) => {
        if (!cancelled && pts.length > 1) setTrajectory(pts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !sessionId || !data
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="STUDIO" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        <StateWrapper
          state={state}
          skeletonLines={6}
          emptyLabel="Aucune séance"
          emptyMessage="Ouvrez le Studio depuis une séance de votre file de lecture."
          errorCause="La séance n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {data ? (
            <StudioBody data={data} laps={laps} trajectory={trajectory} isConsole={isConsole} />
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

function StudioBody({
  data,
  laps,
  trajectory,
  isConsole,
}: {
  data: StudioSession;
  laps: Lap[];
  trajectory: TrajectoryPoint[] | null;
  isConsole: boolean;
}) {
  // Couleur des pastilles de virage sur la carte = zone de marge du triage
  // (dégradé §7.6 rouge→or→vert). Seules les zones réellement mesurées colorent.
  const zoneByIndex = useMemo(() => {
    const out: Record<number, MarginZone> = {};
    for (const c of data.triage) {
      if (c.marginZone) out[c.segmentIndex] = c.marginZone as MarginZone;
    }
    return out;
  }, [data.triage]);
  const hasZones = Object.keys(zoneByIndex).length > 0;

  // Tours volants (hors entrée/sortie de stand), meilleur mis en avant en or.
  const timedLaps = useMemo(
    () => laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0),
    [laps]
  );
  const bestLapNumber = useMemo(() => {
    if (timedLaps.length === 0) return null;
    const flagged = timedLaps.find((l) => l.is_best_lap);
    if (flagged) return flagged.lap_number;
    return timedLaps.reduce((m, l) => (l.duration_seconds < m.duration_seconds ? l : m)).lap_number;
  }, [timedLaps]);

  const header = <StudioHeader data={data} isConsole={isConsole} />;

  const qdiPanel = <QdiPanel qdi={data.qdi} />;
  const readsPanel = <ReadsPanel moments={data.keyMoments} />;
  const trajectoryPanel = (
    <TrajectoryPanel
      trajectory={trajectory}
      zoneByIndex={zoneByIndex}
      hasZones={hasZones}
      bestLapSeconds={data.bestLapSeconds}
      height={isConsole ? 320 : 240}
    />
  );
  const marginPanel = <MarginKingPanel margins={data.margins} />;
  const watchPanel = <WatchPanel triage={data.triage} sessionId={data.sessionId} />;
  const lapsPanel = <LapsPanel laps={timedLaps} bestLapNumber={bestLapNumber} />;

  if (isConsole) {
    // Console : trois colonnes (gauche lecture · centre carte+chiffre · droite triage+tours).
    return (
      <View>
        {header}
        <View style={s.consoleRow}>
          <View style={[s.col, { flex: 1 }]}>
            {qdiPanel}
            {readsPanel}
          </View>
          <View style={[s.col, { flex: 1.3 }]}>
            {trajectoryPanel}
            {marginPanel}
          </View>
          <View style={[s.col, { flex: 1 }]}>
            {watchPanel}
            {lapsPanel}
          </View>
        </View>
        <DoctrineLine />
      </View>
    );
  }

  // Compagnon : une colonne, le chiffre roi en tête pour ancrer la lecture.
  return (
    <View style={{ gap: spacing.xl }}>
      {header}
      {marginPanel}
      {qdiPanel}
      {trajectoryPanel}
      {watchPanel}
      {lapsPanel}
      {readsPanel}
      <DoctrineLine />
    </View>
  );
}

// ── En-tête : identité de la séance + actions réelles ───────────────────────

function StudioHeader({ data, isConsole }: { data: StudioSession; isConsole: boolean }) {
  const dateLabel = data.startedAt
    ? new Date(data.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;
  const initials = data.pilotName
    ? data.pilotName
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : null;
  const subParts = [
    data.circuitName ?? null,
    dateLabel,
    `${data.lapCount} tour${data.lapCount > 1 ? 's' : ''}`,
    data.bestLapSeconds != null ? `meilleur ${formatLapTimeMs(data.bestLapSeconds)}` : null,
  ].filter(Boolean);
  const identity = (
    <View style={s.identityRow}>
      {initials ? (
        <View style={s.studioAvatar}>
          <Text style={s.studioAvatarTxt}>{initials}</Text>
        </View>
      ) : null}
      <View style={{ flexShrink: 1 }}>
        <Text style={s.eyebrow}>Studio · 25 Hz</Text>
        <Text style={s.title} accessibilityRole="header">
          {data.pilotName ?? data.circuitName ?? 'Séance'}
        </Text>
        <Text style={s.meta}>{subParts.join(' · ')}</Text>
        <PresentationLink sessionId={data.sessionId} />
      </View>
    </View>
  );

  if (isConsole) {
    return (
      <View style={s.headerRow}>
        {identity}
        <ReportButton sessionId={data.sessionId} />
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {identity}
      <ReportButton sessionId={data.sessionId} full />
    </View>
  );
}

function ReportButton({ sessionId, full }: { sessionId: string; full?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Rédiger le rapport de la séance"
      hitSlop={8}
      onPress={() => router.push({ pathname: '/(coach)/rapport', params: { sessionId } } as never)}
      style={({ pressed }) => [
        s.reportBtn,
        full ? { alignSelf: 'stretch' } : null,
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Text style={s.reportBtnTxt}>Rédiger le rapport</Text>
    </Pressable>
  );
}

function PresentationLink({ sessionId }: { sessionId: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le mode présentation du débrief"
      hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
      onPress={() => router.push({ pathname: '/(coach)/debrief', params: { sessionId } } as never)}
      style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
    >
      <Text style={s.link}>Mode présentation ›</Text>
    </Pressable>
  );
}

// ── Signature QDI (radar 5 branches) ────────────────────────────────────────

function QdiPanel({ qdi }: { qdi: StudioSession['qdi'] }) {
  return (
    <View>
      {qdi ? (
        <CockpitPanel>
          <Text style={s.panelLabel}>Signature QDI · cette séance</Text>
          <QdiRadar current={qdi} reference={null} detail />
        </CockpitPanel>
      ) : (
        <EmptyState
          label="QDI en préparation"
          message="Les cinq branches apparaîtront après l'analyse de la séance."
        />
      )}
    </View>
  );
}

// ── Lecture rapide : les moments factuels de la séance ──────────────────────

function ReadsPanel({ moments }: { moments: StudioSession['keyMoments'] }) {
  return (
    <Card>
      <Text style={s.panelLabel}>Lecture rapide</Text>
      {moments.length === 0 ? (
        <Text style={s.empty}>
          Les repères de lecture suivent l'analyse des tours de la séance.
        </Text>
      ) : (
        <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
          {moments.map((m) => (
            <View key={m.key} style={s.readRow}>
              <View style={s.readDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.readTitle}>{m.title}</Text>
                <Text style={s.readFact}>{m.fact}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ── Trajectoire & marge par virage : carte + légende de marge ───────────────

function TrajectoryPanel({
  trajectory,
  zoneByIndex,
  hasZones,
  bestLapSeconds,
  height,
}: {
  trajectory: TrajectoryPoint[] | null;
  zoneByIndex: Record<number, MarginZone>;
  hasZones: boolean;
  bestLapSeconds: number | null;
  height: number;
}) {
  return (
    <View>
      <View style={s.panelHead}>
        <Text style={s.panelLabel}>Trajectoire & marge par virage</Text>
        {bestLapSeconds != null ? (
          <Text style={s.panelNote}>meilleur {formatLapTimeMs(bestLapSeconds)}</Text>
        ) : null}
      </View>
      <CoachPreset trajectory={trajectory ?? undefined} zoneByIndex={zoneByIndex} height={height} />
      {hasZones ? (
        <MarginLegendBar />
      ) : (
        <Text style={s.mapCaption}>
          La trace GPS et la coloration des marges apparaîtront avec les premières trames du
          boîtier.
        </Text>
      )}
    </View>
  );
}

/**
 * Légende de marge (handoff §7.6) : faible→large = rouge de DONNÉE → or → vert,
 * le même dégradé que les pastilles de virage (source cohérente). L'or ici est
 * le midpoint assumé du dégradé de marge, jamais un chrono.
 */
function MarginLegendBar() {
  return (
    <View
      accessible
      accessibilityLabel="Légende des marges : du rouge, marge faible, à l'or puis au vert, marge large."
      style={s.legendRow}
    >
      <Text style={s.legendLabel}>Marge</Text>
      <View style={{ flex: 1 }}>
        <Svg width="100%" height={6}>
          <Defs>
            <LinearGradient id="studioMarginGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={dataColors.brake} />
              <Stop offset="50%" stopColor={palette.gold} />
              <Stop offset="100%" stopColor={dataColors.accel} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={6} rx={3} fill="url(#studioMarginGradient)" />
        </Svg>
      </View>
      <Text style={[s.legendEnd, { color: dataColors.brake }]}>faible</Text>
      <Text style={[s.legendEnd, { color: dataColors.accel }]}>large</Text>
    </View>
  );
}

// ── Chiffre roi : marge globale de la séance ────────────────────────────────

function MarginKingPanel({ margins }: { margins: StudioSession['margins'] }) {
  if (margins.global == null) return null;
  return (
    <CockpitPanel plain>
      <Text style={s.panelLabel}>Marge globale de la séance</Text>
      {/* Marge = dégradé §7.6 selon la zone (serré→rouge de donnée, moyen→or,
          large→vert), jamais l'or par défaut. L'or reste au chrono/record. */}
      <KingNumber
        value={`${Math.round(margins.global)}`}
        unit="%"
        label="Marge"
        color={marginZoneExportColor(margins.zone)}
      />
    </CockpitPanel>
  );
}

// ── Où regarder : triage factuel des virages les plus serrés ────────────────

function WatchPanel({ triage, sessionId }: { triage: StudioSession['triage']; sessionId: string }) {
  return (
    <View>
      <View style={s.panelHead}>
        <Text style={s.sectionLabel}>Où regarder</Text>
        {triage.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir le triage sur la carte"
            hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
            onPress={() =>
              router.push({ pathname: '/(coach)/triage', params: { sessionId } } as never)
            }
          >
            <Text style={s.link}>Sur la carte ›</Text>
          </Pressable>
        ) : null}
      </View>
      {triage.length === 0 ? (
        <EmptyState
          label="Triage en attente"
          message="Le classement des virages suit l'analyse des marges de la séance."
          source="app_segment_analyses"
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {triage.map((c, i) => (
            <Card key={c.segmentIndex} style={s.watchRow}>
              <Text style={[s.watchRank, { color: marginZoneExportColor(c.marginZone) }]}>
                {i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={s.watchName}>{c.label}</Text>
                <Text style={s.watchFact}>{c.fact}</Text>
              </View>
              <Text style={s.watchMargin}>{Math.round(c.marginPercent)} %</Text>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Tours : la liste des chronos, le meilleur en or ─────────────────────────

function LapsPanel({ laps, bestLapNumber }: { laps: Lap[]; bestLapNumber: number | null }) {
  return (
    <View>
      <Text style={[s.sectionLabel, { marginBottom: spacing.md }]}>Tours</Text>
      {laps.length === 0 ? (
        <EmptyState
          label="Tours en attente"
          message="Les chronos par tour apparaîtront avec les premiers tours du boîtier."
          source="laps"
        />
      ) : (
        <Card>
          {laps.map((l, i) => {
            const isBest = l.lap_number === bestLapNumber;
            return (
              <View
                key={l.id}
                accessibilityRole="text"
                accessibilityLabel={`Tour ${l.lap_number}, ${formatLapTimeMs(l.duration_seconds)}${
                  isBest ? ', votre meilleur' : ''
                }`}
                style={[s.lapRow, i > 0 ? s.lapRowBorder : null, isBest ? s.lapRowBest : null]}
              >
                <Text style={[s.lapNo, isBest ? s.lapTextBest : null]}>T{l.lap_number}</Text>
                <Text style={[s.lapChrono, isBest ? s.lapTextBest : null]}>
                  {formatLapTimeMs(l.duration_seconds)}
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

function DoctrineLine() {
  return (
    <Text style={s.doctrine}>
      Le Studio décrit la séance. La lecture, et la suite, restent à vous.
    </Text>
  );
}

const s = StyleSheet.create({
  // Layout
  consoleRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  col: {
    gap: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },

  // En-tête séance
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flexShrink: 1 },
  studioAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioAvatarTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: palette.cream,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  link: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: palette.creamSoft,
  },

  // CTA rapport (identité coach : rouge d'accent)
  reportBtn: {
    backgroundColor: palette.coachAccent,
    borderRadius: theme.radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBtnTxt: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.body,
    color: palette.night,
    letterSpacing: 0.2,
  },

  // Panneaux
  panelLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  panelNote: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: palette.gold,
  },
  mapCaption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: spacing.md,
  },
  empty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: spacing.xs,
  },

  // Lecture rapide
  readRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  readDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.creamMute,
    marginTop: 6,
  },
  readTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },
  readFact: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
    lineHeight: theme.fontSize.small * 1.4,
  },

  // Légende de marge
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  legendEnd: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Où regarder (triage)
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  watchRank: {
    fontFamily: theme.fonts.king,
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  watchName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  watchFact: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
    lineHeight: theme.fontSize.small * 1.4,
  },
  watchMargin: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.h3,
    // Valeur de marge (pas un chrono) → neutre crème ; la zone se code via le
    // dégradé §7.6 (rang coloré + carte), jamais via l'or.
    color: palette.cream,
  },

  // Tours
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  lapRowBorder: {
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  lapRowBest: {
    backgroundColor: 'rgba(255,183,3,0.10)',
    borderRadius: theme.radius.sm,
    borderTopWidth: 0,
  },
  lapNo: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },
  lapChrono: {
    fontFamily: theme.fonts.monoSemi,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
    fontVariant: ['tabular-nums'],
  },
  // Meilleur tour = record → OR (seule donnée dorée autorisée).
  lapTextBest: {
    color: palette.gold,
  },

  doctrine: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
});
