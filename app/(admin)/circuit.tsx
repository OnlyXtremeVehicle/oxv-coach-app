/**
 * Vue Admin — Inspecteur de circuit.
 *
 * Affiche tout ce qu'on a en base sur le circuit Beltoise :
 *   - Tracé SVG calculé depuis les GPS (HAUTE_SAINTONGE_TRACK)
 *   - Les virages avec leurs métadonnées (nom, pace, lat/lon, progress)
 *   - Stats agrégées sur l'historique des analyses (sessions × pilotes)
 *   - Toggle de colorisation : par pace (statique) ou par marge moyenne
 *     historique (`aggregateSegmentStats`)
 *   - Tap sur un virage : highlight + détails étendus
 *
 * Vue purement d'inspection — ne génère pas d'action utilisateur, ne
 * modifie pas de donnée. Sert au staff OXV à valider la richesse et la
 * cohérence des données collectées.
 *
 * Reskin V2 : Screen + AppBar, Card. Accent bronze conservé (couleur de
 * rôle admin) ; couleurs de donnée (pace / zones de marge) conservées.
 * SVG (topologie + heatmap) gardé tel quel. Logique inchangée.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  CircuitMap,
  CornersLayer,
  StartArrowLayer,
  TrackLayer,
  type CornerColorMode as ColorMode,
} from '@/components/CircuitMap';
import { EmptyState } from '@/components/instruments/EmptyState';
import { BELTOISE_CORNERS, type CornerTopology } from '@/lib/circuitTopology';
import { type SegmentAggregate, aggregateSegmentStats } from '@/services/segmentAnalysesService';
import {
  HAUTE_SAINTONGE_CIRCUIT,
  HAUTE_SAINTONGE_SEGMENTS,
  HAUTE_SAINTONGE_TRACK,
} from '@/trackviz/hauteSaintonge';
import { type MarginZone, marginZoneOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';
// Couleurs de donnée (zones de marge / pace) — toujours doublées d'un libellé.
const ZONE = { green: '#97C459', yellow: '#EF9F27', red: '#C8102E' };

export default function CircuitInspectorScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('pace');
  const [aggregates, setAggregates] = useState<SegmentAggregate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    aggregateSegmentStats().then((rows) => {
      if (!cancelled) {
        setAggregates(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const aggregateByIndex = useMemo(() => {
    const map = new Map<number, SegmentAggregate>();
    for (const a of aggregates) map.set(a.segmentIndex, a);
    return map;
  }, [aggregates]);

  const zoneByIndex = useMemo(() => {
    const result: Record<number, MarginZone> = {};
    for (const a of aggregates) {
      if (a.avgMarginPercent !== null) {
        result[a.segmentIndex] = marginZoneOf(a.avgMarginPercent);
      }
    }
    return result;
  }, [aggregates]);

  const totalSessions = useMemo(() => {
    if (aggregates.length === 0) return 0;
    return Math.max(...aggregates.map((a) => a.sessionCount));
  }, [aggregates]);

  const paceDistribution = useMemo(() => {
    const counts = { fast: 0, medium: 0, slow: 0 };
    for (const c of BELTOISE_CORNERS) counts[c.pace] += 1;
    return counts;
  }, []);

  const selectedCorner = selected ? BELTOISE_CORNERS.find((c) => c.index === selected) : null;
  const selectedAggregate = selected ? (aggregateByIndex.get(selected) ?? null) : null;
  const selectedSegment = selected
    ? (HAUTE_SAINTONGE_SEGMENTS.find((seg) => seg.order === selected) ?? null)
    : null;

  return (
    <Screen>
      <AppBar title="INSPECTEUR CIRCUIT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ADMIN OXV · INSPECTEUR</Text>
        <Text style={s.title} accessibilityRole="header">
          {HAUTE_SAINTONGE_CIRCUIT.name}
        </Text>
        <Text style={s.meta}>
          {HAUTE_SAINTONGE_TRACK.length} points GPS · {HAUTE_SAINTONGE_SEGMENTS.length} segments ·{' '}
          {HAUTE_SAINTONGE_CIRCUIT.totalLengthM} m
        </Text>

        {/* Toggle mode de couleur */}
        <ColorModeToggle
          value={colorMode}
          onChange={setColorMode}
          hasHistoricalData={aggregates.length > 0}
        />

        {/* Carte SVG — composition manuelle pour mode admin (toggle pace/zone) */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <CircuitMap height={360}>
            <TrackLayer animate={false} />
            <StartArrowLayer />
            <CornersLayer
              colorMode={colorMode}
              zoneByIndex={zoneByIndex}
              selectedIndex={selected}
            />
          </CircuitMap>
        </View>

        {/* Légende */}
        <Legend mode={colorMode} />

        {/* Stats globales */}
        <SectionHeader label="DONNÉES STATIQUES" />
        <StatTable
          rows={[
            ['Bbox latitude', formatBboxLat()],
            ['Bbox longitude', formatBboxLon()],
            ['Apex rapides (fast)', String(paceDistribution.fast)],
            ['Apex moyens (medium)', String(paceDistribution.medium)],
            ['Apex lents (slow)', String(paceDistribution.slow)],
            ['Polyline interpolée', `${HAUTE_SAINTONGE_TRACK.length} points`],
            [
              'Segments uniformes',
              `${HAUTE_SAINTONGE_SEGMENTS.length} (span 1/${HAUTE_SAINTONGE_SEGMENTS.length} chacun)`,
            ],
          ]}
        />

        {/* Stats historiques */}
        <SectionHeader label="DONNÉES HISTORIQUES" />
        {loading ? (
          <Text style={s.note}>Chargement…</Text>
        ) : aggregates.length === 0 ? (
          <EmptyState
            message="Aucune analyse de segment en base. Les statistiques agrégées apparaîtront après la première session analysée."
            source="app_segment_analyses"
          />
        ) : (
          <StatTable
            rows={[
              ['Sessions analysées (max)', String(totalSessions)],
              ['Virages avec donnée', `${aggregates.length} / ${BELTOISE_CORNERS.length}`],
              ['Marge moyenne (tous virages)', formatGlobalMargin(aggregates)],
            ]}
          />
        )}

        {/* Liste des virages */}
        <SectionHeader label={`LES ${BELTOISE_CORNERS.length} VIRAGES`} />
        <View style={{ gap: theme.spacing.xs }}>
          {BELTOISE_CORNERS.map((corner) => (
            <CornerRow
              key={corner.index}
              corner={corner}
              aggregate={aggregateByIndex.get(corner.index) ?? null}
              isSelected={selected === corner.index}
              onPress={() => setSelected(selected === corner.index ? null : corner.index)}
            />
          ))}
        </View>

        {/* Détail du virage sélectionné */}
        {selectedCorner ? (
          <CornerDetail
            corner={selectedCorner}
            aggregate={selectedAggregate}
            segmentProgress={
              selectedSegment
                ? {
                    start: selectedSegment.progressStart,
                    end: selectedSegment.progressEnd,
                    apex: selectedSegment.apexProgress ?? 0,
                  }
                : null
            }
          />
        ) : (
          <Text style={[s.note, { marginTop: theme.spacing.xxl, textAlign: 'center' }]}>
            Un toucher révèle les détails d&apos;un virage.
          </Text>
        )}
      </View>
    </Screen>
  );
}

// ============================================================================
// Sous-composants
// ============================================================================

function ColorModeToggle(props: {
  value: ColorMode;
  onChange: (v: ColorMode) => void;
  hasHistoricalData: boolean;
}) {
  const { value, onChange, hasHistoricalData } = props;
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
      <ToggleButton
        active={value === 'pace'}
        label="Pace statique"
        onPress={() => onChange('pace')}
      />
      <ToggleButton
        active={value === 'zone'}
        label="Marge historique"
        disabled={!hasHistoricalData}
        onPress={() => onChange('zone')}
      />
    </View>
  );
}

function ToggleButton(props: {
  active: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.active, disabled: !!props.disabled }}
      accessibilityHint={
        props.disabled ? 'Indisponible : aucune donnée historique en base.' : undefined
      }
      onPress={props.disabled ? undefined : props.onPress}
      hitSlop={theme.hitSlop}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        justifyContent: 'center',
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: props.active ? BRONZE : theme.palette.line,
        backgroundColor: props.active ? 'rgba(184,115,51,0.10)' : 'transparent',
        alignItems: 'center',
        opacity: props.disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          fontSize: theme.fontSize.small,
          letterSpacing: 0.3,
          color: props.active ? theme.palette.cream : theme.palette.creamMute,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function Legend({ mode }: { mode: ColorMode }) {
  const items =
    mode === 'pace'
      ? [
          { color: ZONE.green, label: 'Vitesse élevée' },
          { color: ZONE.yellow, label: 'Vitesse moyenne' },
          { color: ZONE.red, label: 'Vitesse basse' },
        ]
      : [
          { color: ZONE.green, label: 'Confortable (≥ 30%)' },
          { color: ZONE.yellow, label: 'À explorer (15-30%)' },
          { color: ZONE.red, label: 'Terrain serré (< 15%)' },
          { color: theme.palette.creamMute, label: 'Pas de donnée' },
        ];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.lg,
        flexWrap: 'wrap',
        marginTop: theme.spacing.md,
      }}
    >
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
          <Text style={s.legendTxt}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={s.sectionHeader}>{label}</Text>;
}

function StatTable({ rows }: { rows: [string, string][] }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {rows.map(([label, value], i) => (
        <View
          key={label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: theme.palette.line,
          }}
        >
          <Text style={s.statLabel}>{label}</Text>
          <Text style={s.statValue}>{value}</Text>
        </View>
      ))}
    </Card>
  );
}

function CornerRow(props: {
  corner: CornerTopology;
  aggregate: SegmentAggregate | null;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { corner, aggregate, isSelected, onPress } = props;
  const paceLabel =
    corner.pace === 'fast'
      ? 'Vitesse élevée'
      : corner.pace === 'medium'
        ? 'Vitesse moyenne'
        : 'Vitesse basse';
  const margin = aggregate?.avgMarginPercent ?? null;
  const sessions = aggregate?.sessionCount ?? 0;
  const marginText = margin !== null ? `${margin.toFixed(0)}% · ${sessions} sess.` : '—';
  const a11yLabel = `Virage ${corner.index}, ${corner.name}. ${paceLabel}. ${
    margin !== null
      ? `Marge moyenne ${margin.toFixed(0)} pour cent sur ${sessions} sessions.`
      : 'Pas de donnée historique.'
  }`;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={a11yLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        backgroundColor: isSelected ? 'rgba(184,115,51,0.10)' : theme.palette.card,
        borderColor: isSelected ? BRONZE : theme.palette.line,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: paceColor(corner.pace),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={s.cornerIndex}>{corner.index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cornerName}>{corner.name}</Text>
        <Text style={s.cornerMeta}>
          {paceLabel} · {marginText}
        </Text>
      </View>
    </Card>
  );
}

function CornerDetail(props: {
  corner: CornerTopology;
  aggregate: SegmentAggregate | null;
  segmentProgress: { start: number; end: number; apex: number } | null;
}) {
  const { corner, aggregate, segmentProgress } = props;
  const staticRows: [string, string][] = [
    ['Index', String(corner.index)],
    ['Nom', corner.name],
    ['Pace', corner.pace],
    ['Apex latitude', corner.apexLat.toFixed(6)],
    ['Apex longitude', corner.apexLon.toFixed(6)],
    ['Track point index', String(corner.trackPointIndex)],
  ];
  if (segmentProgress) {
    staticRows.push(
      ['Progress start', segmentProgress.start.toFixed(4)],
      ['Progress apex', segmentProgress.apex.toFixed(4)],
      ['Progress end', segmentProgress.end.toFixed(4)]
    );
  }

  return (
    <View style={{ marginTop: theme.spacing.xxl }}>
      <SectionHeader label={`VIRAGE ${corner.index} — DÉTAIL`} />
      <StatTable rows={staticRows} />

      {aggregate ? (
        <>
          <Text style={[s.sectionHeader, { marginTop: theme.spacing.lg }]}>
            HISTORIQUE ({aggregate.sessionCount} sessions)
          </Text>
          <StatTable
            rows={[
              ['Marge moyenne', formatPct(aggregate.avgMarginPercent)],
              ['Vitesse entrée moy.', formatSpeed(aggregate.avgEntrySpeedKmh)],
              ['Vitesse apex moy.', formatSpeed(aggregate.avgApexSpeedKmh)],
              ['Vitesse sortie moy.', formatSpeed(aggregate.avgExitSpeedKmh)],
              ['G_lat max moy.', formatG(aggregate.avgMaxGLateral)],
              ['Écart latéral moy.', formatMeter(aggregate.avgLateralErrorM)],
              [
                'Distribution zones',
                `${aggregate.zoneDistribution.green} vert · ${aggregate.zoneDistribution.yellow} jaune · ${aggregate.zoneDistribution.red} rouge`,
              ],
            ]}
          />
        </>
      ) : (
        <Text style={[s.note, { marginTop: theme.spacing.lg, textAlign: 'center' }]}>
          Pas encore d&apos;analyse historique pour ce virage.
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function paceColor(pace: 'fast' | 'medium' | 'slow'): string {
  switch (pace) {
    case 'fast':
      return ZONE.green;
    case 'medium':
      return ZONE.yellow;
    case 'slow':
      return ZONE.red;
  }
}

function formatBboxLat(): string {
  let min = Infinity;
  let max = -Infinity;
  for (const c of BELTOISE_CORNERS) {
    if (c.apexLat < min) min = c.apexLat;
    if (c.apexLat > max) max = c.apexLat;
  }
  return `${min.toFixed(5)} → ${max.toFixed(5)}`;
}

function formatBboxLon(): string {
  let min = Infinity;
  let max = -Infinity;
  for (const c of BELTOISE_CORNERS) {
    if (c.apexLon < min) min = c.apexLon;
    if (c.apexLon > max) max = c.apexLon;
  }
  return `${min.toFixed(5)} → ${max.toFixed(5)}`;
}

function formatGlobalMargin(aggregates: SegmentAggregate[]): string {
  const valid = aggregates.filter((a) => a.avgMarginPercent !== null);
  if (valid.length === 0) return '—';
  const sum = valid.reduce((acc, a) => acc + (a.avgMarginPercent ?? 0), 0);
  return `${(sum / valid.length).toFixed(1)} %`;
}

function formatPct(v: number | null): string {
  return v !== null ? `${v.toFixed(1)} %` : '—';
}

function formatSpeed(v: number | null): string {
  return v !== null ? `${v.toFixed(0)} km/h` : '—';
}

function formatG(v: number | null): string {
  return v !== null ? `${v.toFixed(2)} g` : '—';
}

function formatMeter(v: number | null): string {
  return v !== null ? `${v.toFixed(2)} m` : '—';
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xxl,
  },
  sectionHeader: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
    lineHeight: theme.fontSize.small * 1.5,
  },
  legendTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  statValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
  },
  cornerIndex: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.palette.night,
  },
  cornerName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  cornerMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
};
