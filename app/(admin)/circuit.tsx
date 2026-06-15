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
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  CircuitMap,
  CornersLayer,
  StartArrowLayer,
  TrackLayer,
  type CornerColorMode as ColorMode,
} from '@/components/CircuitMap';
import { BELTOISE_CORNERS, type CornerTopology } from '@/lib/circuitTopology';
import { type SegmentAggregate, aggregateSegmentStats } from '@/services/segmentAnalysesService';
import {
  HAUTE_SAINTONGE_CIRCUIT,
  HAUTE_SAINTONGE_SEGMENTS,
  HAUTE_SAINTONGE_TRACK,
} from '@/trackviz/hauteSaintonge';
import { type MarginZone, marginZoneOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    ? (HAUTE_SAINTONGE_SEGMENTS.find((s) => s.order === selected) ?? null)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.bronze }]}>
          ADMIN OXV · INSPECTEUR
        </Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          {HAUTE_SAINTONGE_CIRCUIT.name}
        </Text>
        <Text style={[typography.caption, { marginBottom: spacing.xxl }]}>
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
        <View style={{ marginTop: spacing.xl }}>
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
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : aggregates.length === 0 ? (
          <Text
            style={[
              typography.caption,
              { paddingVertical: spacing.lg, color: colors.text.tertiary },
            ]}
          >
            Aucune analyse `app_segment_analyses` en base. Première session analysée : les stats
            agrégées apparaîtront ici.
          </Text>
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
        <View style={{ gap: spacing.xs }}>
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
          <Text
            style={[
              typography.caption,
              {
                marginTop: spacing.xxl,
                color: colors.text.tertiary,
                textAlign: 'center',
              },
            ]}
          >
            Un toucher révèle les détails d&apos;un virage.
          </Text>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour admin
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
      }}
    >
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
      accessibilityRole="button"
      onPress={props.disabled ? undefined : props.onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: props.active ? colors.accent.bronze : colors.border.subtle,
        backgroundColor: props.active ? 'rgba(184, 115, 51, 0.10)' : 'transparent',
        alignItems: 'center',
        opacity: props.disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: props.active ? colors.text.primary : colors.text.secondary,
          fontSize: fontSize.caption,
          fontWeight: props.active ? fontWeight.medium : fontWeight.regular,
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
          { color: colors.margin.green, label: 'Vitesse élevée' },
          { color: colors.margin.yellow, label: 'Vitesse moyenne' },
          { color: colors.margin.red, label: 'Vitesse basse' },
        ]
      : [
          { color: colors.margin.green, label: 'Confortable (≥ 30%)' },
          { color: colors.margin.yellow, label: 'À explorer (15-30%)' },
          { color: colors.margin.red, label: 'Terrain serré (< 15%)' },
          { color: colors.text.tertiary, label: 'Pas de donnée' },
        ];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.lg,
        flexWrap: 'wrap',
        marginTop: spacing.md,
      }}
    >
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: item.color,
            }}
          />
          <Text style={[typography.caption, { color: colors.text.tertiary }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text
      style={[
        typography.eyebrow,
        {
          color: colors.accent.bronze,
          marginTop: spacing.xxxl,
          marginBottom: spacing.md,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function StatTable({ rows }: { rows: [string, string][] }) {
  return (
    <View
      style={{
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        overflow: 'hidden',
      }}
    >
      {rows.map(([label, value], i) => (
        <View
          key={label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: i === 0 ? 0 : 0.5,
            borderTopColor: colors.border.subtle,
          }}
        >
          <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>{label}</Text>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.caption,
              fontFamily: 'Menlo',
            }}
          >
            {value}
          </Text>
        </View>
      ))}
    </View>
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
  const marginText =
    aggregate?.avgMarginPercent !== null && aggregate?.avgMarginPercent !== undefined
      ? `${aggregate.avgMarginPercent.toFixed(0)}% · ${aggregate.sessionCount} sess.`
      : '—';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: isSelected ? 'rgba(184, 115, 51, 0.10)' : colors.background.secondary,
        borderWidth: 0.5,
        borderColor: isSelected ? colors.accent.bronze : colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
      })}
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
        <Text
          style={{
            color: colors.background.primary,
            fontSize: 12,
            fontWeight: fontWeight.semibold,
          }}
        >
          {corner.index}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.regular,
          }}
        >
          {corner.name}
        </Text>
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
          {paceLabel} · {marginText}
        </Text>
      </View>
    </Pressable>
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
    <View style={{ marginTop: spacing.xxl }}>
      <SectionHeader label={`VIRAGE ${corner.index} — DÉTAIL`} />
      <StatTable rows={staticRows} />

      {aggregate ? (
        <>
          <Text
            style={[
              typography.eyebrow,
              {
                marginTop: spacing.lg,
                marginBottom: spacing.sm,
                color: colors.accent.bronze,
              },
            ]}
          >
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
        <Text
          style={[
            typography.caption,
            {
              marginTop: spacing.lg,
              color: colors.text.tertiary,
              textAlign: 'center',
            },
          ]}
        >
          Pas encore d'analyse historique pour ce virage.
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
      return colors.margin.green;
    case 'medium':
      return colors.margin.yellow;
    case 'slow':
      return colors.margin.red;
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
  const sum = valid.reduce((s, a) => s + (a.avgMarginPercent ?? 0), 0);
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
