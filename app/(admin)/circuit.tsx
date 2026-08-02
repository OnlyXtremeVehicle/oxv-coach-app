/**
 * Vue Admin — Inspecteur de circuit, POUR LES TROIS CIRCUITS OFFICIELS.
 *
 * *« L'inspecteur est codé en dur sur Haute Saintonge alors qu'il devient
 * l'éditeur des trois circuits. »* — Plan de montage, Jalon 7, Phase 6.
 *
 * ---
 *
 * CE QUI A CHANGÉ LE 02/08/2026
 *
 * L'écran importait `HAUTE_SAINTONGE_TRACK`, `HAUTE_SAINTONGE_SEGMENTS` et
 * `BELTOISE_CORNERS` — trois constantes locales — et affichait leur nom en dur.
 * La production compte pourtant QUATRE circuits, dont **Ricardo Tormo
 * (Valence)**, celui où la première capture réelle doit avoir lieu :
 * l'administrateur ne pouvait pas l'ouvrir.
 *
 * Il choisit désormais parmi les circuits OFFICIELS, et chaque fait affiché est
 * lu sur la ligne de ce circuit-là.
 *
 * ---
 *
 * DEUX LIMITES ASSUMÉES, DITES À L'ÉCRAN PLUTÔT QUE MASQUÉES
 *
 * 1. `CircuitMap` ne sait DESSINER que Haute Saintonge — c'est écrit dans son
 *    code (`estHauteSaintonge`), et elle affiche d'elle-même « le tracé de X
 *    n'est pas encore disponible ». On la laisse dire vrai plutôt que de lui
 *    faire tracer une piste approximative. Rendre la carte pilotable par une
 *    polyline touche un composant partagé avec l'espace pilote : c'est un lot
 *    à part entière.
 * 2. Les métadonnées riches — nom de virage, allure, bbox — n'existent QUE pour
 *    Haute Saintonge, dans les constantes locales. Les autres circuits n'ont en
 *    base que ce que le calcul a produit : numéro, sens, apex, rayon. On montre
 *    ce qui existe, on n'invente ni un nom ni une allure.
 *
 * ---
 *
 * Affiche tout ce qu'on a en base sur le circuit sélectionné :
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
import { BELTOISE_CORNERS, type CornerTopology } from '@/lib/circuitTopology';
import {
  type VirageCircuit,
  circuitParDefaut,
  resumeCircuit,
} from '@/features/admin/inspecteurCircuitLogic';
import {
  type CircuitInspectable,
  chargerCircuitsInspectables,
} from '@/services/circuitInspectionService';
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
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';
// Couleurs de donnée (zones de marge / pace) — toujours doublées d'un libellé.
// Rouge neutralisé en ambre pilote : le rouge de marque ne code jamais de
// donnée de perf (canon).
const ZONE = { green: theme.palette.green, yellow: '#EF9F27', red: theme.palette.pilotAmber };

export default function CircuitInspectorScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('pace');
  const [aggregates, setAggregates] = useState<SegmentAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // LES CIRCUITS — chargés une fois, jamais mis en cache : l'administrateur
  // inspecte l'état RÉEL de la base, pas celui d'hier.
  const [circuits, setCircuits] = useState<CircuitInspectable[]>([]);
  const [circuitsCharges, setCircuitsCharges] = useState(false);
  const [circuitId, setCircuitId] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    chargerCircuitsInspectables()
      .then((liste) => {
        if (annule) return;
        setCircuits(liste);
        setCircuitsCharges(true);
        // On ouvre sur le circuit le plus documenté : tomber sur un circuit sans
        // géométrie donnerait l'impression d'un écran cassé.
        const defaut = circuitParDefaut(liste, (c) => c.geometrie);
        setCircuitId(defaut?.id ?? null);
      })
      .catch(() => {
        if (!annule) setCircuitsCharges(true);
      });
    return () => {
      annule = true;
    };
  }, []);

  const circuit = useMemo(
    () => circuits.find((c) => c.id === circuitId) ?? null,
    [circuits, circuitId]
  );

  useEffect(() => {
    // Tant qu'aucun circuit n'est choisi, on ne charge RIEN : agréger sans
    // rattachement mélangerait les marges de deux circuits.
    if (circuitId === null) {
      setAggregates([]);
      setLoading(!circuitsCharges);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    aggregateSegmentStats(undefined, circuitId)
      .then((rows) => {
        if (!cancelled) {
          setAggregates(rows);
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
  }, [reloadKey, circuitId, circuitsCharges]);

  // Changer de circuit efface la sélection : le virage 3 de Valence n'est pas
  // le virage 3 de Haute Saintonge.
  useEffect(() => {
    setSelected(null);
  }, [circuitId]);

  /** Les constantes locales riches n'existent QUE pour Haute Saintonge. */
  const estHauteSaintonge = circuit?.nom === HAUTE_SAINTONGE_CIRCUIT.name;

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

  const historyState: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : aggregates.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="INSPECTEUR CIRCUIT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>ADMIN OXV · INSPECTEUR</Text>
        <Text style={s.title} accessibilityRole="header">
          {circuit?.nom ?? (circuitsCharges ? 'Aucun circuit officiel' : '—')}
        </Text>
        <Text style={s.meta}>
          {circuit !== null
            ? [circuit.ville, resumeCircuit(circuit.geometrie)].filter(Boolean).join(' · ')
            : '—'}
        </Text>

        {/* LE SÉLECTEUR. Sans lui, l'écran ne montrait que Haute Saintonge —
            et Valence, où la première capture doit avoir lieu, était
            inatteignable. */}
        {circuits.length > 1 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md,
            }}
          >
            {circuits.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected: c.id === circuitId }}
                accessibilityLabel={`Inspecter ${c.nom}`}
                onPress={() => setCircuitId(c.id)}
                style={({ pressed }) => ({
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: c.id === circuitId ? ADMIN : theme.palette.line,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: c.id === circuitId ? ADMIN : theme.palette.creamMute,
                  }}
                >
                  {c.nom}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Toggle mode de couleur */}
        <ColorModeToggle
          value={colorMode}
          onChange={setColorMode}
          hasHistoricalData={aggregates.length > 0}
        />

        {/* Carte SVG — composition manuelle pour mode admin (toggle pace/zone) */}
        <View style={{ marginTop: theme.spacing.xl }}>
          {/* `CircuitMap` ne sait dessiner que Haute Saintonge et le DIT
              elle-même pour les autres. On lui passe le vrai nom plutôt que de
              lui faire tracer une piste qui n'est pas la bonne. */}
          <CircuitMap height={360} circuitName={circuit?.nom ?? null}>
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
        <SectionHeader label="DONNÉES EN BASE" />
        <StatTable
          rows={[
            ['Ville', circuit?.ville ?? '—'],
            ['Statut de revue', circuit?.statut ?? '—'],
            [
              'Points de la centerline',
              circuit && circuit.geometrie.points.length > 0
                ? String(circuit.geometrie.points.length)
                : '—',
            ],
            [
              'Virages calculés',
              circuit && circuit.geometrie.virages.length > 0
                ? String(circuit.geometrie.virages.length)
                : '—',
            ],
          ]}
        />

        {/* CE BLOC N'EXISTE QUE POUR HAUTE SAINTONGE. Ces chiffres viennent des
            constantes locales (`BELTOISE_CORNERS`, `HAUTE_SAINTONGE_*`), pas de
            la base : les afficher sous un autre circuit lui attribuerait la
            géométrie de celui-ci. */}
        {estHauteSaintonge ? (
          <>
            <SectionHeader label="TOPOLOGIE LOCALE (HAUTE SAINTONGE)" />
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
          </>
        ) : null}

        {/* Stats historiques */}
        <SectionHeader label="DONNÉES HISTORIQUES" />
        <StateWrapper
          state={historyState}
          skeletonLines={5}
          emptyMessage="Aucune analyse de segment en base. Les statistiques agrégées apparaîtront après la première session analysée."
          emptySource="app_segment_analyses"
          errorCause="Les données historiques n'ont pas pu être chargées."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <StatTable
            rows={[
              ['Sessions analysées (max)', totalSessions > 0 ? String(totalSessions) : '—'],
              [
                'Virages avec donnée',
                // Le dénominateur suit le circuit choisi. L'ancien affichait les
                // 7 virages de Haute Saintonge quel que soit le circuit.
                circuit && circuit.geometrie.virages.length > 0
                  ? `${aggregates.length} / ${circuit.geometrie.virages.length}`
                  : aggregates.length > 0
                    ? String(aggregates.length)
                    : '—',
              ],
              ['Marge moyenne (tous virages)', formatGlobalMargin(aggregates)],
            ]}
          />
        </StateWrapper>

        {/* LES VIRAGES.
            Deux rendus, parce qu'il existe deux natures de donnée. Haute
            Saintonge dispose de métadonnées locales riches — nom, allure,
            position d'apex. Les autres circuits n'ont en base que ce que le
            calcul a produit. On montre ce qui existe de chacun ; on n'invente ni
            un nom ni une allure pour faire tenir un circuit dans le gabarit de
            l'autre. */}
        {estHauteSaintonge ? (
          <>
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
          </>
        ) : (
          <>
            <SectionHeader label="LES VIRAGES CALCULÉS" />
            {circuit && circuit.geometrie.virages.length > 0 ? (
              <View style={{ gap: theme.spacing.xs }}>
                {circuit.geometrie.virages.map((v) => (
                  <VirageBrutRow key={v.index} virage={v} />
                ))}
              </View>
            ) : (
              <Text style={[s.note, { marginTop: theme.spacing.md }]}>
                {circuit === null
                  ? 'Choisissez un circuit.'
                  : 'Aucun virage n’a encore été calculé pour ce circuit. La centerline est en base ; le découpage en virages ne l’est pas.'}
              </Text>
            )}
          </>
        )}

        {/* Détail du virage sélectionné */}
        {estHauteSaintonge && selectedCorner ? (
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
        ) : estHauteSaintonge ? (
          <Text style={[s.note, { marginTop: theme.spacing.xxl, textAlign: 'center' }]}>
            Un toucher révèle les détails d&apos;un virage.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

// ============================================================================
// Sous-composants
// ============================================================================

/**
 * Un virage tel que la base le décrit, sans habillage.
 *
 * Pas de nom : la colonne `name` vaut `null` en production. Pas d'allure : elle
 * n'est calculée nulle part pour ces circuits. Chaque champ absent s'écrit
 * « — » — jamais un zéro, qui se lirait comme une mesure.
 */
function VirageBrutRow({ virage }: { virage: VirageCircuit }) {
  const sens =
    virage.direction === 'left' ? 'gauche' : virage.direction === 'right' ? 'droite' : '—';
  const apex =
    virage.apexProgression !== null ? `${Math.round(virage.apexProgression * 100)} %` : '—';
  const rayon = virage.rayonM !== null ? `${Math.round(virage.rayonM)} m` : '—';
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Text style={[s.title, { fontSize: 20, color: ADMIN }]}>{virage.index}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.note}>
            {virage.nom ?? 'Sans nom'} · {sens}
          </Text>
          <Text style={s.note}>
            apex {apex} · rayon {rayon}
          </Text>
        </View>
      </View>
    </Card>
  );
}

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
        borderColor: props.active ? ADMIN : theme.palette.line,
        backgroundColor: props.active ? 'rgba(34,211,238,0.10)' : 'transparent',
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
        backgroundColor: isSelected ? 'rgba(34,211,238,0.10)' : theme.palette.card,
        borderColor: isSelected ? ADMIN : theme.palette.line,
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
    color: ADMIN,
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
    color: ADMIN,
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
