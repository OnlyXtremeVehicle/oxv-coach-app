/**
 * Data Lab — vitrine d'analyse d'une session (build 23 « datalab-parlant »).
 *
 * Index de navigation PUR : regroupe les écrans d'analyse rangés sous le Bilan
 * (cf. `appMap.dataLabScreens()`), chacun ouvert avec le `sessionId` courant.
 * AUCUNE logique d'analyse propre — chaque écran cible garde ses services.
 *
 * Présentation (direction fondateur build 23 : « plus de présentation, plus
 * parlant ») : chaque tuile devient une CARTE PARLANTE — insigne SVG dans une
 * pastille de famille, phrase de promesse factuelle, et un APERÇU RÉEL quand la
 * donnée existe :
 *  - Carte / Rejouer : mini-tracé du circuit de la séance (centerline réelle,
 *    fetchSessionCircuitCenterline — même source que le héros du bilan et la
 *    carte trophée), dessiné au DrawInPath. Pas de centerline → pas de tracé.
 *  - Tour par tour : mini-barres des derniers tours valides (chronos réels,
 *    GrowBar) ; le meilleur tour de la séance sort en or (or = chrono/record).
 *  - Télémétrie : pastilles G réelles (max latéral/freinage/accélération des
 *    tours en base — mêmes champs que l'écran Tours, mêmes couleurs QDI).
 *  - Insights : compteur réel de constats — MÊME dérivation que l'écran
 *    Insights (computeRegularity + branches QDI persistées, gating offre
 *    respecté). Comptage identique, jamais un chiffre inventé.
 * Aperçu absent = carte sobre, éventuellement une ligne méta à compteur réel
 * (virages lus, points de mesure, tours valides) — jamais un faux graphique.
 *
 * COULEUR PAR FAMILLE D'ANALYSE — identité de NAVIGATION, pas une donnée :
 * la couleur marque le rayon (pastille d'insigne, en-tête de section), elle
 * n'encode jamais une valeur. Tracé = bleu trajectoire, Mesure = cyan (écho de
 * la rampe vitesse), Constats = violet. L'or de la famille Chrono suit le
 * canon (or = chrono/record) et la maquette §7.5 (icône d'index, pas une
 * donnée QDI).
 *
 * En tête : contexte réel de la séance (circuit + date + tours + virages),
 * ligne de confiance conservée (même calcul que le Bilan). L'entrée par
 * `sessionId` (sélection faite en amont, Bilan/Carnet) est préservée telle
 * quelle. Vouvoiement, pas d'emoji, descriptif jamais prescriptif.
 */

import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { generateCircuit, type LatLon } from '@/circuit/circuitGenerator';
import { BlindspotsBlock, SourceMethodBlock } from '@/components/InsightTransparency';
import {
  CountUpNumber,
  DrawInPath,
  FadeInSection,
  GrowBar,
  polylineLength,
  polylineToPathD,
  PressableScale,
  Stagger,
  type Point2D,
} from '@/components/motion';
import { dataLabScreens } from '@/lib/appMap';
import { supabase } from '@/lib/supabase';
import { OxvEvent } from '@/services/analyticsEvents';
import { fetchSessionCircuitCenterline } from '@/services/circuitsService';
import { type DataConfidence, computeDataConfidence } from '@/services/dataConfidenceLogic';
import { type DataLabSessionView, getDataLabSessionView } from '@/services/dataLabService';
import { exportSessionFramesCsv } from '@/services/dataExportService';
import {
  getOrComputeQdiForSession,
  getQdiAccessLevel,
  type QdiRecord,
} from '@/services/qdiService';
import { computeRegularity, type RegularityProfile } from '@/services/regularityService';
import { fetchSessionInsights } from '@/services/sessionInsightsService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { type Lap } from '@/types/telemetry';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { formatDateLong, formatLapTime } from '@/utils/format';

const { palette, dataColors, speedHeat, fonts, fontSize, spacing, radius } = theme;

/* ------------------------------------------------------------------ */
/* Familles d'analyse — couleur d'IDENTITÉ DE NAVIGATION (voir en-tête) */
/* ------------------------------------------------------------------ */

const FAMILY = {
  trace: { label: 'Le tracé', color: dataColors.trajectory },
  // Or canonique : la famille Chrono ne contient QUE des lectures de chrono.
  chrono: { label: 'Le chrono', color: palette.gold },
  // Cyan « mesure » : écho de la rampe vitesse (speedHeat), identité seule.
  mesure: { label: 'La mesure', color: speedHeat[1] },
  constats: { label: 'Les constats', color: dataColors.regularity },
} as const;

type FamilyKey = keyof typeof FAMILY;

/* ------------------------------------------------------------------ */
/* Insignes SVG — décoratifs, 20 px, teintés par la famille (identité) */
/* ------------------------------------------------------------------ */

const ICON = 20;

interface IconProps {
  color: string;
}

/** Carte du circuit — anneau irrégulier (tracé de piste). */
function IconCircuit({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M12 3.5 C17 3.5 20.5 6.5 20.5 10.5 C20.5 14 17.5 15 14.5 16 C11.5 17 11.5 20.5 8 20.5 C5 20.5 3.5 17.5 3.5 13.5 C3.5 8 7 3.5 12 3.5 Z"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
    </Svg>
  );
}

/** Zoom virage — courbe (trajectoire) + point d'apex. */
function IconVirage({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M5 19.5 C11 19.5 10.5 12.5 14.5 9.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={17.5} cy={6.5} r={2} fill={color} />
    </Svg>
  );
}

/** Rejouer un tour — cercle + triangle de lecture. */
function IconReplay({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M10.4 8.9 L15.2 12 L10.4 15.1 Z" fill={color} />
    </Svg>
  );
}

/** Vue unifiée — boucle du tracé + trajectoire intérieure neutre. */
function IconUnified({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M12 3.5 C17 3.5 20.5 6.5 20.5 10.5 C20.5 14 17.5 15 14.5 16 C11.5 17 11.5 20.5 8 20.5 C5 20.5 3.5 17.5 3.5 13.5 C3.5 8 7 3.5 12 3.5 Z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
      <Path
        d="M7 15.5 C10 12.5 12.5 12.5 16 8"
        stroke={palette.creamSoft}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Tour par tour — lignes de chronos empilées. */
function IconTours({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Line x1={4} y1={7} x2={20} y2={7} stroke={color} strokeWidth={1.8} />
      <Line x1={4} y1={12} x2={15} y2={12} stroke={color} strokeWidth={1.8} />
      <Line x1={4} y1={17} x2={18} y2={17} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/** Comparer — deux barres côte à côte. */
function IconComparer({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Rect x={6.5} y={9} width={3.5} height={9} rx={1} fill={color} />
      <Rect x={13} y={6} width={3.5} height={12} rx={1} fill={palette.faint} />
    </Svg>
  );
}

/** Carte de chaleur — grille de la rampe vitesse `speedHeat` (identité du rayon). */
function IconHeat() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Rect x={4} y={4} width={7.5} height={7.5} rx={2} fill={speedHeat[0]} />
      <Rect x={12.5} y={4} width={7.5} height={7.5} rx={2} fill={speedHeat[1]} />
      <Rect x={4} y={12.5} width={7.5} height={7.5} rx={2} fill={speedHeat[2]} />
      <Rect x={12.5} y={12.5} width={7.5} height={7.5} rx={2} fill={speedHeat[3]} />
    </Svg>
  );
}

/** Télémétrie — courbe de canal brut. */
function IconTelemetry({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M3 12 C5.5 5.5 8 5.5 10.5 12 C13 18.5 15.5 18.5 18 12"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Insights — ampoule (constats qualitatifs). */
function IconInsights({ color }: IconProps) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M12 3.5 a5.2 5.2 0 0 1 5.2 5.2 c0 2.1 -1.2 3.2 -2 4.4 c-.5 .7 -.8 1.2 -.8 2.1 h-4.8 c0 -.9 -.3 -1.4 -.8 -2.1 c-.8 -1.2 -2 -2.3 -2 -4.4 A5.2 5.2 0 0 1 12 3.5 Z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
      <Line x1={9.8} y1={18.5} x2={14.2} y2={18.5} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

/** Chevron d'ouverture (décoratif). */
function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        d="M9 5 L16 12 L9 19"
        stroke={palette.faint}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Cartes — routes ACTUELLES (appMap), promesses factuelles vouvoyées  */
/* ------------------------------------------------------------------ */

type PreviewKind = 'trace' | 'replay' | 'laps' | 'g' | 'constats';

interface CardDef {
  screen: string;
  title: string;
  /** Promesse factuelle — décrit ce que l'écran montre, jamais quoi faire. */
  promise: string;
  Icon: (props: IconProps) => React.JSX.Element;
  /** Aperçu réel à afficher quand la donnée existe. */
  preview?: PreviewKind;
  /** Ligne méta à compteur réel (null = rien, la carte reste sobre). */
  meta?: (v: DataLabSessionView) => string | null;
}

interface SectionDef {
  family: FamilyKey;
  cards: CardDef[];
}

/** Groupement de milliers fr (11 800) — espace fine insécable. */
function fmtInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const SECTIONS: SectionDef[] = [
  {
    family: 'trace',
    cards: [
      {
        screen: 'carte',
        title: 'Carte du circuit',
        promise: 'La carte — votre marge, virage par virage.',
        Icon: IconCircuit,
        preview: 'trace',
      },
      {
        screen: 'virage',
        title: 'Zoom virage',
        promise: 'Chaque virage isolé — entrée, apex, sortie.',
        Icon: IconVirage,
        meta: (v) =>
          v.cornerCount > 0
            ? `${v.cornerCount} virage${v.cornerCount > 1 ? 's' : ''} lu${
                v.cornerCount > 1 ? 's' : ''
              } sur cette séance`
            : null,
      },
      {
        screen: 'replay',
        title: 'Rejouer un tour',
        promise: 'Votre tour se rejoue, à votre rythme.',
        Icon: IconReplay,
        preview: 'replay',
      },
      {
        screen: 'data-lab-canvas',
        title: 'Vue unifiée',
        promise: 'Le tracé et votre trajectoire, d’un seul tenant.',
        Icon: IconUnified,
      },
    ],
  },
  {
    family: 'chrono',
    cards: [
      {
        screen: 'tours',
        title: 'Tour par tour',
        promise: 'Vos chronos, tour après tour, et leurs écarts.',
        Icon: IconTours,
        preview: 'laps',
      },
      {
        screen: 'virage-comparer',
        title: 'Comparer',
        promise: 'Deux tours côte à côte — ce qui change, ce qui tient.',
        Icon: IconComparer,
        meta: (v) =>
          v.validLapCount >= 2 ? `${v.validLapCount} tours valides à mettre côte à côte` : null,
      },
    ],
  },
  {
    family: 'mesure',
    cards: [
      {
        screen: 'heatmap',
        title: 'Carte de chaleur',
        promise: 'Votre vitesse, posée sur la piste.',
        Icon: IconHeat,
        meta: (v) =>
          v.frameCount > 0 ? `${fmtInt(v.frameCount)} points de mesure sur cette séance` : null,
      },
      {
        screen: 'telemetry',
        title: 'Télémétrie',
        promise: 'Les canaux bruts — G, vitesses, freinages.',
        Icon: IconTelemetry,
        preview: 'g',
      },
    ],
  },
  {
    family: 'constats',
    cards: [
      {
        screen: 'insights',
        title: 'Insights',
        promise: 'Ce que la donnée raconte de votre séance.',
        Icon: IconInsights,
        preview: 'constats',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Aperçus réels — la donnée existe ou l'aperçu n'existe pas           */
/* ------------------------------------------------------------------ */

// Scène du mini-tracé : large et basse, comme une carte posée dans la carte.
const TRACE_W = 288;
const TRACE_H = 118;
const TRACE_PAD = 10;

/**
 * Projette la centerline réelle dans la scène du mini-tracé (aspect préservé,
 * y inversé — même géométrie que la carte trophée). Renvoie le `d` du Path,
 * sa longueur (pour DrawInPath) et le point de départ.
 */
function projectTrace(points: LatLon[]): { d: string; length: number; start: Point2D } | null {
  const circuit = generateCircuit(points);
  const cl = circuit.centerline;
  if (cl.length < 2) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of cl) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((TRACE_W - TRACE_PAD * 2) / spanX, (TRACE_H - TRACE_PAD * 2) / spanY);
  const offsetX = (TRACE_W - spanX * scale) / 2;
  const offsetY = (TRACE_H - spanY * scale) / 2;
  const projected: Point2D[] = cl.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: TRACE_H - (offsetY + (p.y - minY) * scale),
  }));

  return {
    d: polylineToPathD(projected, 1, circuit.closed),
    length: polylineLength(projected, circuit.closed),
    start: projected[0],
  };
}

/** Mini-tracé du circuit — centerline réelle, dessinée au DrawInPath. */
function MiniTrace({
  points,
  delay,
  showStart,
}: {
  points: LatLon[];
  delay: number;
  showStart?: boolean;
}) {
  const trace = useMemo(() => projectTrace(points), [points]);
  if (!trace) return null;
  return (
    <View style={s.preview} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width="100%" height={92} viewBox={`0 0 ${TRACE_W} ${TRACE_H}`}>
        <DrawInPath
          d={trace.d}
          length={trace.length}
          duration={1100}
          delay={delay}
          stroke={FAMILY.trace.color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {showStart ? (
          <Circle cx={trace.start.x} cy={trace.start.y} r={3.2} fill={palette.cream} />
        ) : null}
      </Svg>
    </View>
  );
}

/**
 * Mini-barres des derniers tours valides — chronos réels ; le meilleur tour
 * DE LA SÉANCE (flag `is_best_lap` en base) sort en or (or = chrono/record).
 * Barre proportionnelle au chrono : des tours réguliers font des barres
 * égales — c'est la vérité, le chiffre est posé à côté.
 */
function LapBars({ laps, delay }: { laps: Lap[]; delay: number }) {
  const shown = laps.filter((l) => l.duration_seconds > 0).slice(-4);
  if (shown.length === 0) return null;
  const max = Math.max(...shown.map((l) => l.duration_seconds));
  return (
    <View style={s.preview} accessibilityElementsHidden importantForAccessibility="no">
      {shown.map((l, i) => {
        const pct = Math.max(6, Math.round((l.duration_seconds / max) * 100));
        const gold = l.is_best_lap;
        return (
          <View key={l.id} style={s.lapRow}>
            <Text style={s.lapNum}>T{l.lap_number}</Text>
            <View style={s.lapTrack}>
              <GrowBar
                delay={delay + i * 90}
                style={[
                  s.lapBar,
                  {
                    width: `${pct}%` as `${number}%`,
                    backgroundColor: gold ? palette.gold : palette.creamSoft,
                  },
                ]}
              />
            </View>
            <Text style={[s.lapTime, gold && { color: palette.gold }]}>
              {formatLapTime(l.duration_seconds)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Pastilles G réelles — maxima de la séance depuis les tours en base (mêmes
 * champs que l'écran Tours). Couleurs QDI : une couleur = une donnée.
 */
function GDots({ laps }: { laps: Lap[] }) {
  const maxOf = (pick: (l: Lap) => number | null): number | null => {
    const values = laps.map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
    return values.length > 0 ? Math.max(...values) : null;
  };
  interface GItem {
    key: string;
    label: string;
    color: string;
    value: number;
  }
  const items: GItem[] = [
    {
      key: 'lat',
      label: 'LATÉRAL',
      color: dataColors.trajectory,
      value: maxOf((l) => l.max_g_lateral),
    },
    {
      key: 'brk',
      label: 'FREINAGE',
      color: dataColors.brake,
      value: maxOf((l) => l.max_g_braking),
    },
    {
      key: 'acc',
      label: 'ACCÉLÉRATION',
      color: dataColors.accel,
      value: maxOf((l) => l.max_g_accel),
    },
  ].flatMap((it) => (it.value !== null ? [{ ...it, value: it.value }] : []));
  if (items.length === 0) return null;
  return (
    <View style={[s.preview, s.gRow]} accessibilityElementsHidden importantForAccessibility="no">
      {items.map((it) => (
        <View key={it.key} style={s.gChip}>
          <View style={[s.gDot, { backgroundColor: it.color }]} />
          <Text style={s.gValue}>{it.value.toFixed(2).replace('.', ',')} G</Text>
          <Text style={s.gLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Compteur réel de constats — même dérivation que l'écran Insights. */
function ConstatCount({ count }: { count: number }) {
  return (
    <View
      style={[s.preview, s.constatRow]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <CountUpNumber value={count} duration={800} style={s.constatValue} />
      <Text style={s.constatCaption}>constat{count > 1 ? 's' : ''} sur cette séance</Text>
    </View>
  );
}

/**
 * Compte les constats EXACTEMENT comme `buildConstats` (app/(app)/insights.tsx) :
 * régularité (≥ 3 tours valides) + une entrée par branche QDI disponible.
 */
function countConstats(reg: RegularityProfile, qdi: QdiRecord | null): number {
  let n = 0;
  if (reg.lapCount >= 3 && reg.spreadSeconds !== null && reg.stdDevSeconds !== null) n += 1;
  if (qdi && qdi.freinage !== null) n += 1;
  if (qdi && qdi.acceleration !== null) n += 1;
  if (qdi && qdi.fluidite !== null) n += 1;
  return n;
}

/* ------------------------------------------------------------------ */
/* Confiance de lecture (inchangée — même donnée que le Bilan)         */
/* ------------------------------------------------------------------ */

/**
 * Ligne d'état de confiance (maquette : pastille + texte court). Même donnée
 * que le Bilan (`computeDataConfidence`) — seule la présentation change.
 * Honnête : verte uniquement si la lecture est complète ; sinon pastille
 * neutre + raisons factuelles ; masquée s'il n'y a encore aucune trame.
 */
function ConfidenceLine({ confidence }: { confidence: DataConfidence | null }) {
  if (!confidence) return null;
  const good = confidence.level === 'complete';
  const dotColor = good
    ? palette.green
    : confidence.level === 'partial'
      ? palette.creamMute
      : palette.faint;
  const text = good
    ? 'Données fiables sur cette séance'
    : [confidence.label, ...confidence.reasons].join(' · ');
  return (
    <View style={s.confidenceRow} accessibilityRole="text" accessibilityLabel={text}>
      <View
        style={[s.confidenceDot, { backgroundColor: dotColor }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[s.confidenceText, good && { color: palette.green }]}>{text}</Text>
    </View>
  );
}

/** En-tête de famille : pastille d'identité + libellé mono + filet. */
function FamilyHeader({ family }: { family: FamilyKey }) {
  const fam = FAMILY[family];
  return (
    <View style={s.famRow}>
      <View style={[s.famDot, { backgroundColor: fam.color }]} />
      <Text style={s.famLabel} accessibilityRole="header">
        {fam.label.toUpperCase()}
      </Text>
      <View style={s.famRule} />
    </View>
  );
}

export default function DataLabScreen() {
  const profileId = useAuthStore((st) => st.profile)?.id;
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sid = params.sessionId ?? '';
  const [view, setView] = useState<DataLabSessionView | null>(null);
  const [confidence, setConfidence] = useState<DataConfidence | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [tracePoints, setTracePoints] = useState<LatLon[] | null>(null);
  const [constatCount, setConstatCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  async function onExportCsv() {
    if (!sid || exporting) return;
    setExporting(true);
    await exportSessionFramesCsv(sid);
    setExporting(false);
  }

  useEffect(() => {
    if (!sid) return;
    let cancelled = false;
    getDataLabSessionView(sid)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch(() => undefined);
    // Confiance de lecture (PR-53) — même source et même calcul que le Bilan,
    // pour une vérité affichée identique aux deux endroits.
    fetchSessionInsights(sid)
      .then((ins) => {
        if (cancelled) return;
        const dq = ins?.data_quality;
        setConfidence(
          computeDataConfidence(
            dq
              ? {
                  pctValid: dq.pct_valid,
                  framesUsed: dq.frames_used,
                  cornersDetected: dq.corners_detected,
                  lapsValid: dq.laps_detected,
                }
              : null
          )
        );
      })
      .catch(() => undefined);
    // Date réelle de la séance (contexte d'en-tête).
    supabase
      .from('telemetry_sessions')
      .select('started_at')
      .eq('id', sid)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const iso = (data as { started_at?: string | null } | null)?.started_at ?? null;
        setStartedAt(iso);
      });
    // Centerline réelle du circuit de la séance (mini-tracés Carte/Rejouer).
    // null → pas d'aperçu, carte sobre (jamais un faux tracé).
    fetchSessionCircuitCenterline(sid)
      .then((pts) => {
        if (!cancelled) setTracePoints(pts);
      })
      .catch(() => undefined);
    // Tours réels (mini-barres + pastilles G) puis compteur de constats —
    // même chaîne que l'écran Insights (gating offre compris).
    (async () => {
      const ls = await fetchSessionLaps(sid);
      if (cancelled) return;
      setLaps(ls);
      const access = profileId ? await getQdiAccessLevel(profileId) : ('full' as const);
      const qdi = access === 'full' ? await getOrComputeQdiForSession(sid).catch(() => null) : null;
      if (cancelled) return;
      const reg = computeRegularity(
        ls
          .filter((l) => !l.is_outlap && !l.is_inlap)
          .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
      );
      setConstatCount(countConstats(reg, qdi));
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sid, profileId]);

  // Garde appMap : seules les couches connues de la carte de l'app sont rendues
  // (la Vue unifiée garde sa route à part, hors index — comportement conservé).
  const known = new Set(dataLabScreens());

  const validLaps = laps.filter((l) => !l.is_outlap && !l.is_inlap);

  function openLayer(screen: string) {
    if (screen !== 'data-lab-canvas') OxvEvent.datalabCoucheOuverte(screen);
    router.push((sid ? `/(app)/${screen}?sessionId=${sid}` : `/(app)/${screen}`) as never);
  }

  // Contexte réel de la séance — chaque segment présent uniquement s'il existe.
  const metaParts: string[] = [];
  if (view?.circuitName) metaParts.push(view.circuitName);
  if (startedAt) metaParts.push(formatDateLong(startedAt));
  if (view && view.validLapCount > 0)
    metaParts.push(`${view.validLapCount} tour${view.validLapCount > 1 ? 's' : ''}`);
  if (view && view.cornerCount > 0)
    metaParts.push(`${view.cornerCount} virage${view.cornerCount > 1 ? 's' : ''}`);
  const metaLine = metaParts.join(' · ');

  /** Aperçu réel d'une carte — null tant que la donnée n'existe pas. */
  function previewFor(kind: PreviewKind | undefined, delay: number): React.JSX.Element | null {
    switch (kind) {
      case 'trace':
        return tracePoints ? <MiniTrace points={tracePoints} delay={delay} /> : null;
      case 'replay':
        return tracePoints ? <MiniTrace points={tracePoints} delay={delay} showStart /> : null;
      case 'laps':
        return validLaps.length > 0 ? <LapBars laps={validLaps} delay={delay} /> : null;
      case 'g':
        return laps.length > 0 ? <GDots laps={laps} /> : null;
      case 'constats':
        return constatCount !== null && constatCount > 0 ? (
          <ConstatCount count={constatCount} />
        ) : null;
      default:
        return null;
    }
  }

  return (
    <Screen>
      <AppBar title="Data Lab" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        <FadeInSection>
          <Text style={s.eyebrow}>DATA LAB · LECTURE DE SÉANCE</Text>
          <Text style={s.title} accessibilityRole="header">
            Allez voir de plus près.
          </Text>
          {metaLine ? <Text style={s.headerMeta}>{metaLine}</Text> : null}

          {/* Confiance de lecture (T-2, PR-53) — la solidité de la donnée AVANT
              d'ouvrir les couches. Honnête, descriptif, jamais un jugement. */}
          <ConfidenceLine confidence={confidence} />
        </FadeInSection>

        {view?.emptyReason ? (
          <FadeInSection delay={60}>
            <View style={s.banner}>
              <Text style={s.bannerText}>{view.emptyReason}</Text>
            </View>
          </FadeInSection>
        ) : null}

        {/* Vitrine par famille d'analyse : en-tête de rayon + cartes parlantes
            en cascade (Stagger), retour tactile du kit (PressableScale). */}
        {SECTIONS.map((section, si) => {
          const cards = section.cards.filter(
            (c) => known.has(c.screen) || c.screen === 'data-lab-canvas'
          );
          if (cards.length === 0) return null;
          const base = 140 + si * 160;
          const fam = FAMILY[section.family];
          return (
            <View key={section.family}>
              <FadeInSection delay={base - 60}>
                <FamilyHeader family={section.family} />
              </FadeInSection>
              <Stagger style={s.sectionList} interval={70} initialDelay={base}>
                {cards.map((def, ci) => {
                  const available = !view || screenHasData(def.screen, view);
                  const meta = available && view && def.meta ? def.meta(view) : null;
                  const preview = available ? previewFor(def.preview, base + ci * 70 + 320) : null;
                  const a11y =
                    view && !available
                      ? `${def.title}. ${def.promise} Pas de données pour cette session.`
                      : `${def.title}. ${def.promise}`;
                  return (
                    <PressableScale
                      key={def.screen}
                      style={s.card}
                      haptic="tap"
                      onPress={() => openLayer(def.screen)}
                      accessibilityRole="button"
                      accessibilityLabel={a11y}
                    >
                      <View style={s.cardHead}>
                        <View style={[s.badge, { backgroundColor: `${fam.color}14` }]}>
                          <def.Icon color={fam.color} />
                        </View>
                        <View style={s.cardText}>
                          <Text style={s.cardTitle}>{def.title}</Text>
                          <Text style={s.promise}>{def.promise}</Text>
                        </View>
                        <Chevron />
                      </View>
                      {meta ? <Text style={s.metaText}>{meta}</Text> : null}
                      {view && !available ? (
                        <Text style={s.noData}>Pas de données pour cette session</Text>
                      ) : null}
                      {preview}
                    </PressableScale>
                  );
                })}
              </Stagger>
            </View>
          );
        })}

        {/* Transparence (charte 11 §T1/T5, obligatoire) : source/méthode + limites,
            pour cadrer toute la lecture détaillée comme descriptive, jamais un verdict. */}
        <FadeInSection delay={760}>
          <View style={{ marginTop: spacing.xxl }}>
            <SourceMethodBlock
              items={[
                'Chaque couche est calculée à partir des trames de votre boîtier — votre séance, rien d’autre.',
                'Les virages et les tours sont des estimations dérivées du tracé, pas une vérité du circuit.',
              ]}
            />
            <BlindspotsBlock
              items={[
                'L’app montre ce qui s’est passé. Elle ne dit jamais ce qu’il fallait faire.',
                'Elle ignore vos intentions, la trajectoire que vous visiez, votre ressenti.',
                'Aucune couche n’est une note ni un classement.',
              ]}
            />
          </View>
        </FadeInSection>

        {/* Souveraineté data (PR-66) : récupérer la donnée la plus brute du boîtier,
            lisible par n'importe quel tableur, sans dépendre d'OXV (anti-lock-in). */}
        {sid ? (
          <FadeInSection delay={800}>
            <View style={{ marginTop: spacing.xl }}>
              <Button
                label="Exporter les données brutes (CSV)"
                variant="ghost"
                loading={exporting}
                onPress={onExportCsv}
              />
              <Text style={s.exportHint}>
                Les trames du boîtier (25 points/seconde) de cette séance. Vos données vous
                appartiennent.
              </Text>
            </View>
          </FadeInSection>
        ) : null}
      </View>
    </Screen>
  );
}

/** Une couche a-t-elle de la matière pour cette session ? (annotation honnête, non bloquante). */
function screenHasData(screen: string, v: DataLabSessionView): boolean {
  switch (screen) {
    case 'carte':
      return v.frameCount > 0 || v.cornerCount > 0;
    case 'virage':
    case 'virage-comparer':
      return v.cornerCount > 0;
    case 'tours':
      return v.validLapCount > 0;
    case 'heatmap':
    case 'replay':
    case 'telemetry':
      return v.frameCount > 0;
    default:
      return true;
  }
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: palette.eyebrow,
    marginTop: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
    marginTop: spacing.sm,
  },
  headerMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.sm,
  },
  confidenceRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  confidenceText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.45,
  },
  // En-tête de famille — pastille d'identité + libellé mono + filet.
  famRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  famDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  famLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: palette.creamMute,
  },
  famRule: {
    flex: 1,
    height: 1,
    backgroundColor: palette.separator,
  },
  sectionList: {
    gap: spacing.md,
  },
  // Carte parlante — surface standard, cible ≥ 44 px assurée par le contenu.
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 64,
  },
  cardHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  promise: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.legend,
    lineHeight: fontSize.small * 1.45,
    marginTop: 2,
  },
  metaText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  // Zone d'aperçu — séparée du titre par un cheveu, jamais un faux graphique.
  preview: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  lapRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    height: 20,
  },
  lapNum: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: palette.faint,
    width: 28,
  },
  lapTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.surface3,
    overflow: 'hidden' as const,
  },
  lapBar: {
    height: '100%' as const,
    borderRadius: 3,
  },
  lapTime: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    color: palette.creamSoft,
    width: 64,
    textAlign: 'right' as const,
  },
  gRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    columnGap: spacing.lg,
    rowGap: spacing.sm,
  },
  gChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  gDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  gValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 12.5,
    color: palette.creamSoft,
  },
  gLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: palette.eyebrow,
  },
  constatRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: spacing.sm,
  },
  constatValue: {
    fontFamily: fonts.king,
    fontSize: 24,
    color: palette.cream,
  },
  constatCaption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  banner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  bannerText: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  noData: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: palette.faint,
    marginTop: spacing.sm,
  },
  exportHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.sm,
  },
};
