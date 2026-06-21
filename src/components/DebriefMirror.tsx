// DebriefMirror.tsx
// OXV Mirror — Écran de débrief (composant présentiel autonome).
//
// Branché sur les contrats RÉELS :
//   • app_session_analyses (algo v1.0) : margin_*, margin_breakdown, next_focus_*, debrief_text (3 actes)
//   • session_insights (mirror-insights-v3) : anatomy, reference_laps, ideal_lap, data_quality
//   • session_insights (modules rb-1) : throttle_brake, flow_coherence, gg_envelope, load_transfer
//
// Doctrine OXV : un miroir. Faits côté pilote, jamais de prescription. Le coach (espace séparé,
// cuivre) transforme le constat en plan. Signature réelle : « Un constat, pas une consigne. »
// Honnêteté : un module dont le champ est vide ({}) ou dont data_quality.modules.state != 'ok'
// s'affiche en état « en attente de la télémétrie RaceBox », avec le nom du champ source.
//
// Dépendances : react, react-native, react-native-svg. (Pas de Reanimated : Animated natif suffit.)
// Police : mappé sur les polices réellement chargées par oxv-app (mono = Menlo, display/body = système).
//
// Composant vendored (livré clé en main). Deux règles désactivées au niveau fichier,
// par intention et non par négligence (cf. « pas de any sauf cas exceptionnel justifié ») :
//   - no-explicit-any : `any` aux frontières de données (JSON Supabase de forme libre,
//     ex. ideal_lap) et à l'interpolation Animated → SVG (cx/cy).
//   - react-hooks/exhaustive-deps : les effets d'animation tournent volontairement une
//     seule fois au montage ; lister les deps relancerait/casserait les animations.
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

/* ============================ THÈME ============================ */
export const C = {
  night: '#050505',
  card: '#0B0B0D',
  card2: '#141416',
  cream: '#F8F9FA',
  soft: '#E5E5EA',
  mute: '#9A9AA3',
  grey: '#7A7A82',
  line: 'rgba(255,255,255,0.09)',
  edge: 'rgba(255,255,255,0.18)',
  red: '#C8102E',
  copper: '#B87333',
  gold: '#C4A459',
  green: '#4ADE80',
};
// oxv-app ne charge pas Syncopate/Inter/JetBrains : on mappe sur ses polices réelles
// (mono = Menlo comme tokens.ts ; display/body = police système). Si ces familles sont
// chargées plus tard (charte site), remettre 'Syncopate'/'Inter'/'JetBrainsMono'.
export const F: { display?: string; body?: string; mono?: string } = {
  display: undefined,
  body: undefined,
  mono: 'Menlo',
};

/* ============================ TYPES (contrats) ============================ */
export type Anatomy = {
  corner_index: number;
  apex_speed_kmh: number;
  brake_dist_m: number;
  accel_dist_m: number;
  g_lat_apex: number;
};
export type RefLaps = {
  best_of_day: { lap_index: number; lap_time_s: number } | null;
  personal_record: {
    lap_time_s: number;
    scope: { circuit: boolean; vehicle: boolean; condition: 'dry' | 'wet' | null };
  } | null;
} | null;
export type ModulesMeta = {
  engine: string;
  state: 'no_frames' | 'insufficient_frames' | 'ok' | 'error';
  frames_window?: string;
  frames_in_window?: number;
  apex_count?: number;
  axes?: { long: number; lat: number; vert: number; yaw: number };
  accel_to_g?: number;
  rot_to_degs?: number;
  confidence?: { long: number; yaw: number; vertical_mean_g: number };
  detail?: string;
};
export type ThrottleBrake = {
  coasting_s: number;
  coasting_pct: number;
  longest_zone: { t_start_s: number; dur_s: number; corner_index: number | null };
  phases: ('a' | 'b' | 'c')[];
  threshold_g: number;
};
export type FlowCoherence = {
  svj: number;
  jerk_mean: number;
  jerk_p95: number;
  harshest: { t_s: number; corner_index: number | null };
  n: number;
};
export type GgCorner = {
  corner_index: number;
  apex_kmh: number;
  g_lat?: number;
  R_m?: number;
  v_theo_kmh?: number;
  delta_kmh?: number;
};
export type GgEnvelope = {
  g_lat_max: number;
  g_brake_max: number;
  g_accel_max: number;
  g_comb_max: number;
  ref_g: number;
  corners: GgCorner[];
};
export type LoadTransfer = {
  yaw_rate_max_degs: number;
  transitions: {
    t_s: number;
    switch_time_s: number;
    corner_from: number | null;
    corner_to: number | null;
  }[];
};

export type Insights = {
  anatomy?: Anatomy[];
  reference_laps?: RefLaps;
  ideal_lap?: any;
  data_quality?: {
    frames_used: number;
    frames_dropped: number;
    pct_valid: number;
    corners_detected: number;
    laps_total: number;
    laps_valid: number;
    modules?: ModulesMeta;
  };
  throttle_brake?: ThrottleBrake | Record<string, never>;
  flow_coherence?: FlowCoherence | Record<string, never>;
  gg_envelope?: GgEnvelope | Record<string, never>;
  load_transfer?: LoadTransfer | Record<string, never>;
  n_laps?: number;
  n_frames?: number;
  condition?: string;
};
export type Analysis = {
  margin_global?: number | string;
  margin_zone?: string;
  margin_vehicle?: number | string;
  margin_pilot?: number | string;
  margin_breakdown?: { pilot: number; vehicle: number; regularity: number; smoothness: number };
  next_focus_corner_index?: number | null;
  next_focus_phrase?: string | null;
  debrief_text?: string | null;
  algo_version?: string | null;
};
export type Meta = {
  circuit: string;
  date: string;
  condition?: string;
  vehicle?: string;
  laps?: number;
};
export type Coach = {
  name?: string;
  role?: string;
  focus?: { corner: number | null; phrase: string | null };
  notes?: { tag: string; text: string }[];
  voiceNoteSeconds?: number;
  precisionBefore?: number;
  precisionAfter?: number;
};
export type DebriefMirrorProps = {
  meta: Meta;
  analysis?: Analysis | null;
  insights?: Insights | null;
  coach?: Coach | null;
  trackPoints?: [number, number][]; // schéma du tracé ; à remplacer par la polyligne GPS réelle
};

/* ============================ HELPERS ============================ */
const n = (v: any, d = 0) => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : d;
};
const isFilled = (o: any) => !!o && typeof o === 'object' && Object.keys(o).length > 0;
const fmtLap = (s?: number | null) => {
  if (s == null || !Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, '0')}`;
};
const PHASE_COLOR: Record<string, string> = { a: C.green, b: C.red, c: C.grey };

function parseActs(text?: string | null) {
  const out = { act1: '', act2: '', act3: '', sign: 'Un constat, pas une consigne.' };
  if (!text) return out;
  const acts = text.split(/-{2,}\s*ACTE\s*([123])[^:]*:/i);
  // acts = [pre, '1', body1, '2', body2, '3', body3]
  for (let i = 1; i < acts.length; i += 2) {
    const num = acts[i];
    let body = (acts[i + 1] || '').trim();
    const sm = body.match(/(.*?)(?:-{2,}\s*)?(Un constat[^.]*\.)\s*$/is);
    if (sm) {
      body = sm[1].trim();
      out.sign = sm[2].trim();
    }
    if (num === '1') out.act1 = body;
    else if (num === '2') out.act2 = body;
    else out.act3 = body;
  }
  if (!out.act1 && !out.act3) out.act1 = text.trim();
  return out;
}

// Schéma de tracé par défaut (à remplacer par la trace GPS réelle du circuit).
const DEFAULT_TRACK: [number, number][] = [
  [45, 165],
  [235, 178],
  [285, 140],
  [250, 98],
  [285, 55],
  [205, 42],
  [150, 75],
  [95, 45],
  [40, 95],
];
function resampleClosed(pts: [number, number][], N: number) {
  const P = [...pts, pts[0]];
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const d = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
    seg.push(d);
    total += d;
  }
  const xs: number[] = [],
    ys: number[] = [];
  for (let k = 0; k < N; k++) {
    let dist = (k / N) * total,
      i = 0;
    while (i < seg.length && dist > seg[i]) {
      dist -= seg[i];
      i++;
    }
    if (i >= seg.length) i = seg.length - 1;
    const t = seg[i] > 0 ? dist / seg[i] : 0;
    xs.push(P[i][0] + (P[i + 1][0] - P[i][0]) * t);
    ys.push(P[i][1] + (P[i + 1][1] - P[i][1]) * t);
  }
  return { xs, ys, total };
}

/* ============================ ANIMATIONS ============================ */
function useReveal(delay = 0) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, {
        toValue: 1,
        duration: 620,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: 0,
        duration: 620,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity: op, transform: [{ translateY: ty }] };
}
const AnimatedBar: React.FC<{ pct: number; color?: string; delay?: number; h?: number }> = ({
  pct,
  color = C.copper,
  delay = 0,
  h = 6,
}) => {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: 1,
      duration: 1100,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  const width = w.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(0, Math.min(100, pct))}%`],
  });
  return (
    <View
      style={{
        height: h,
        borderRadius: h / 2,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{ height: '100%', width, backgroundColor: color, borderRadius: h / 2 }}
      />
    </View>
  );
};
const Counter: React.FC<{
  value: number;
  dec?: number;
  suffix?: string;
  style?: any;
  delay?: number;
}> = ({ value, dec = 0, suffix = '', style, delay = 200 }) => {
  const [d, setD] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setD(x));
    Animated.timing(v, {
      toValue: value,
      duration: 1000,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => v.removeListener(id);
  }, [value]);
  return (
    <Text style={style}>
      {d.toFixed(dec)}
      {suffix}
    </Text>
  );
};

/* ============================ TRACÉ ANIMÉ (faisceau + point) ============================ */
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const TrackMini: React.FC<{
  points: [number, number][];
  markers?: number[];
  height?: number;
  loopMs?: number;
}> = ({ points, markers = [], height = 150, loopMs = 5400 }) => {
  const { xs, ys, total } = useMemo(() => resampleClosed(points, 140), [points]);
  const d = useMemo(
    () => points.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ') + ' Z',
    [points]
  );
  const draw = useRef(new Animated.Value(1)).current; // 1 -> 0 (dessine)
  const prog = useRef(new Animated.Value(0)).current; // 0 -> 1 (point)
  useEffect(() => {
    Animated.timing(draw, {
      toValue: 0,
      duration: 1700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.loop(
      Animated.timing(prog, {
        toValue: 1,
        duration: loopMs,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, []);
  const dashoffset = draw.interpolate({ inputRange: [0, 1], outputRange: [0, total] });
  const stops = xs.map((_, i) => i / (xs.length - 1));
  const cx = prog.interpolate({ inputRange: stops, outputRange: xs });
  const cy = prog.interpolate({ inputRange: stops, outputRange: ys });
  return (
    <Svg width="100%" height={height} viewBox="0 0 320 210">
      <Path
        d={d}
        fill="none"
        stroke="#1b1b1f"
        strokeWidth={14}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <APath
        d={d}
        fill="none"
        stroke={C.cream}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={total}
        strokeDashoffset={dashoffset}
      />
      {markers.map(
        (mi) =>
          points[mi] && (
            <Circle
              key={mi}
              cx={points[mi][0]}
              cy={points[mi][1]}
              r={3}
              fill={C.cream}
              stroke={C.red}
            />
          )
      )}
      <Circle cx={45} cy={165} r={3.6} fill={C.red} />
      <ACircle cx={cx as any} cy={cy as any} r={4.5} fill={C.red} />
    </Svg>
  );
};

/* ============================ PETITS BLOCS UI ============================ */
const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = C.copper,
}) => <Text style={[s.eyebrow, { color }]}>{children}</Text>;
const Source: React.FC<{ field: string; live?: boolean }> = ({ field, live = true }) => (
  <View style={s.sourceRow}>
    <View style={[s.dot, { backgroundColor: live ? C.green : C.copper }]} />
    <Text style={s.sourceTxt}>
      {live ? 'Champ réel : ' : 'Champ : '}
      <Text style={{ color: C.soft }}>{field}</Text>
    </Text>
  </View>
);
const HowTo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={s.howto}>
    <Text style={s.howtoL}>COMMENT LIRE</Text>
    <Text style={s.howtoS}>{children}</Text>
  </View>
);
const Fact: React.FC<{ k: string; v: string; first?: boolean }> = ({ k, v, first }) => (
  <View style={[s.fact, first && { borderTopWidth: 0 }]}>
    <Text style={s.factK}>{k}</Text>
    <Text style={s.factV}>{v}</Text>
  </View>
);
const Section: React.FC<{ delay: number; children: React.ReactNode; style?: any }> = ({
  delay,
  children,
  style,
}) => {
  const r = useReveal(delay);
  return <Animated.View style={[s.sec, r, style]}>{children}</Animated.View>;
};

// Carte d'un module : affiche la viz si rempli, sinon l'état d'attente honnête.
const ModuleCard: React.FC<{
  title: string;
  badge: string;
  field: string;
  filled: boolean;
  live?: boolean;
  children?: React.ReactNode;
}> = ({ title, badge, field, filled, live, children }) => (
  <View style={s.subcard}>
    <View style={s.subTitleRow}>
      <Text style={s.subTitle}>{title}</Text>
      <Text style={[s.badge, !filled && { color: C.copper, borderColor: 'rgba(184,115,51,0.4)' }]}>
        {badge}
      </Text>
    </View>
    {filled ? (
      children
    ) : (
      <View style={s.waiting}>
        <Text style={s.waitingTxt}>Prêt. S'active à la première télémétrie RaceBox.</Text>
      </View>
    )}
    <Source field={field} live={!!filled && !!live} />
  </View>
);

/* ============================ ÉCRAN ============================ */
const DebriefMirror: React.FC<DebriefMirrorProps> = ({
  meta,
  analysis,
  insights,
  coach,
  trackPoints,
}) => {
  const track = trackPoints && trackPoints.length >= 3 ? trackPoints : DEFAULT_TRACK;
  const acts = useMemo(() => parseActs(analysis?.debrief_text), [analysis?.debrief_text]);

  const dq = insights?.data_quality;
  const pctValid = n(dq?.pct_valid, 0);
  const modState = dq?.modules?.state;

  const anatomy = insights?.anatomy ?? [];
  const speeds = anatomy.map((a) => n(a.apex_speed_kmh)).filter((x) => x > 0);
  const vMin = speeds.length ? Math.min(...speeds) : null;
  const vMax = speeds.length ? Math.max(...speeds) : null;
  const ref = insights?.reference_laps ?? null;

  const mb = analysis?.margin_breakdown;
  const mVeh = n(analysis?.margin_vehicle, NaN);
  const mPil = n(analysis?.margin_pilot, NaN);

  const tb = insights?.throttle_brake;
  const tbOK = isFilled(tb) && modState === 'ok';
  const fc = insights?.flow_coherence;
  const fcOK = isFilled(fc) && modState === 'ok';
  const gg = insights?.gg_envelope;
  const ggOK = isFilled(gg) && modState === 'ok';
  const lt = insights?.load_transfer;
  const ltOK = isFilled(lt) && modState === 'ok';

  const focusPhrase = analysis?.next_focus_phrase || (coach?.focus?.phrase ?? null);
  const focusCorner = analysis?.next_focus_corner_index ?? coach?.focus?.corner ?? null;

  let delay = 0;
  const D = () => (delay += 90);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* En-tête */}
      <Section delay={D()} style={s.head}>
        <Eyebrow>DÉBRIEF · {meta.date}</Eyebrow>
        <Text style={s.title}>{meta.circuit}</Text>
        <Text style={s.meta}>
          {[meta.condition, meta.vehicle, meta.laps != null ? `${meta.laps} tours` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={s.precis}>
          <View style={{ flex: 1 }}>
            <Text style={s.precisLab}>PRÉCISION DE LA LECTURE</Text>
            <Text style={s.precisSub}>Frames GNSS valides · calibration coach</Text>
          </View>
          <Counter value={pctValid} suffix="%" style={s.precisPc} />
          <View style={{ width: 70, marginLeft: 10 }}>
            <AnimatedBar pct={pctValid} delay={250} />
          </View>
        </View>
      </Section>

      {/* ACTE 1 */}
      <Section delay={D()}>
        <Eyebrow>ACTE 1 · RÉCIT</Eyebrow>
        <Text style={s.actH}>Ce qui s'est passé</Text>
        <Text style={s.prose}>{acts.act1 || 'Le récit de votre séance apparaîtra ici.'}</Text>
        <Source field={`app_session_analyses.debrief_text · ${analysis?.algo_version || 'v1.0'}`} />
      </Section>

      {/* ACTE 2 */}
      <Section delay={D()}>
        <Eyebrow>ACTE 2 · CE QUE MONTRENT LES CHIFFRES</Eyebrow>
        <Text style={s.actH}>Le détail, posé sur le circuit</Text>
        {!!acts.act2 && <Text style={[s.prose, { marginBottom: 6 }]}>{acts.act2}</Text>}

        {/* Tour de référence */}
        <Text style={s.kicker}>LE TOUR DE RÉFÉRENCE</Text>
        <View style={s.panel}>
          <TrackMini points={track} markers={[1, 3, 5, 6, 7]} />
        </View>
        <HowTo>
          La ligne, c'est votre trajectoire. Le point la parcourt. Les repères, vos virages.
        </HowTo>
        <Fact first k="Meilleur du jour" v={fmtLap(ref?.best_of_day?.lap_time_s)} />
        <Fact k="Record comparable" v={fmtLap(ref?.personal_record?.lap_time_s)} />
        {vMax != null && <Fact k="Vitesse maxi" v={`${vMax} km/h`} />}
        {ref?.personal_record?.scope && (
          <Text style={s.chip}>
            {[
              ref.personal_record.scope.circuit && 'même circuit',
              ref.personal_record.scope.vehicle && 'même voiture',
              ref.personal_record.scope.condition,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        <Source field="session_insights.reference_laps" />

        {/* Vitesse */}
        <ModuleCard
          title="Vitesse"
          badge="live · anatomy"
          field="session_insights.anatomy[].apex_speed_kmh"
          filled={anatomy.length > 0}
          live
        >
          {vMin != null && <Fact first k="Le plus lent" v={`${vMin} km/h`} />}
          {vMax != null && <Fact k="Le plus rapide" v={`${vMax} km/h`} />}
        </ModuleCard>

        {/* 4 piliers */}
        <ModuleCard
          title="Vos quatre piliers"
          badge="live · margin_breakdown"
          field="app_session_analyses.margin_breakdown"
          filled={!!mb}
          live
        >
          {!!mb && (
            <View style={s.pillars}>
              {(
                [
                  ['Pilote', mb.pilot],
                  ['Véhicule', mb.vehicle],
                  ['Régularité', mb.regularity],
                  ['Fluidité', mb.smoothness],
                ] as [string, number][]
              ).map(([lab, val], i) => (
                <View key={lab} style={s.pill}>
                  <Text style={s.pillLab}>{lab.toUpperCase()}</Text>
                  <Text style={s.pillVal}>{n(val)}</Text>
                  <View style={{ marginTop: 8 }}>
                    <AnimatedBar pct={n(val)} delay={300 + i * 90} h={5} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ModuleCard>

        {/* Marge voiture / pilote */}
        <ModuleCard
          title="Voiture ou pilote ?"
          badge="live · margins"
          field="app_session_analyses.margin_vehicle / margin_pilot"
          filled={Number.isFinite(mVeh) && Number.isFinite(mPil)}
          live
        >
          {Number.isFinite(mVeh) && Number.isFinite(mPil) && (
            <>
              <View style={s.splitLab}>
                <Text style={{ color: C.soft, fontSize: 11 }}>Voiture {Math.round(mVeh)}%</Text>
                <Text style={{ color: C.red, fontSize: 11 }}>Vous {Math.round(mPil)}%</Text>
              </View>
              <View style={s.splitTrack}>
                <View style={{ width: `${mVeh}%`, backgroundColor: 'rgba(255,255,255,0.16)' }} />
                <View style={{ width: `${mPil}%`, backgroundColor: C.red }} />
              </View>
              <HowTo>
                Plus la part « Vous » est grande, plus il vous reste de marge à prendre.
              </HowTo>
            </>
          )}
        </ModuleCard>

        {/* Fluidité — temps morts (throttle_brake) */}
        <ModuleCard
          title="Fluidité — temps morts"
          badge={tbOK ? 'RaceBox · live' : 'RaceBox'}
          field="session_insights.throttle_brake"
          filled={tbOK}
          live
        >
          {tbOK &&
            (() => {
              const t = tb as ThrottleBrake;
              return (
                <>
                  <View style={s.phaseStrip}>
                    {t.phases?.map((p, i) => (
                      <View
                        key={i}
                        style={{ flex: 1, backgroundColor: PHASE_COLOR[p] || C.grey }}
                      />
                    ))}
                  </View>
                  <View style={s.legendRow}>
                    <Legend c={C.green} t="Accélère" />
                    <Legend c={C.red} t="Freine" />
                    <Legend c={C.grey} t="Roue libre" />
                  </View>
                  <Fact
                    first
                    k="Temps en roue libre"
                    v={`${t.coasting_s.toFixed(1)} s · ${t.coasting_pct.toFixed(0)}%`}
                  />
                  <Fact
                    k="Plus longue zone"
                    v={`${t.longest_zone.dur_s.toFixed(1)} s${t.longest_zone.corner_index ? ` · V${t.longest_zone.corner_index}` : ''}`}
                  />
                </>
              );
            })()}
        </ModuleCard>

        {/* Fluidité — transferts (flow_coherence) */}
        <ModuleCard
          title="Fluidité — transferts"
          badge={fcOK ? 'RaceBox · live' : 'RaceBox'}
          field="session_insights.flow_coherence"
          filled={fcOK}
          live
        >
          {fcOK &&
            (() => {
              const f = fc as FlowCoherence;
              return (
                <>
                  <Fact first k="Indice de fluidité (SVJ)" v={f.svj.toFixed(1)} />
                  <Fact
                    k="À-coup le plus fort"
                    v={`${f.harshest.t_s.toFixed(1)} s${f.harshest.corner_index ? ` · V${f.harshest.corner_index}` : ''}`}
                  />
                  <HowTo>
                    Plus l'indice est bas, plus vos transitions sont continues. Élevé = haché.
                  </HowTo>
                </>
              );
            })()}
        </ModuleCard>

        {/* Vitesse vs limite physique (gg_envelope) */}
        <ModuleCard
          title="Vitesse vs limite physique"
          badge={ggOK ? 'RaceBox · live' : 'RaceBox'}
          field="session_insights.gg_envelope"
          filled={ggOK}
          live
        >
          {ggOK &&
            (() => {
              const g = gg as GgEnvelope;
              return (
                <>
                  {(g.corners || [])
                    .filter((c) => c.v_theo_kmh)
                    .slice(0, 4)
                    .map((c) => {
                      const pct = c.v_theo_kmh
                        ? Math.min(100, (c.apex_kmh / c.v_theo_kmh) * 100)
                        : 0;
                      return (
                        <View key={c.corner_index} style={{ marginVertical: 7 }}>
                          <View style={s.ggTop}>
                            <Text style={{ color: C.soft, fontSize: 11 }}>
                              Virage {c.corner_index}
                            </Text>
                            <Text style={s.ggNum}>
                              <Text style={{ color: C.cream }}>{Math.round(c.apex_kmh)}</Text> /{' '}
                              {Math.round(c.v_theo_kmh || 0)} km/h
                            </Text>
                          </View>
                          <View style={{ position: 'relative' }}>
                            <AnimatedBar pct={pct} color={C.cream} h={8} />
                            <View style={[s.theoMark, { left: '100%' }]} />
                          </View>
                          {typeof c.delta_kmh === 'number' && (
                            <Text style={s.ggDelta}>
                              {c.delta_kmh > 0
                                ? `+${c.delta_kmh} km/h sous la limite`
                                : 'à la limite'}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  <View style={s.ggGrid}>
                    <GgStat
                      lab="G latéral max"
                      v={`${(gg as GgEnvelope).g_lat_max.toFixed(2)} g`}
                    />
                    <GgStat
                      lab="G combiné max"
                      v={`${(gg as GgEnvelope).g_comb_max.toFixed(2)} g`}
                    />
                  </View>
                </>
              );
            })()}
        </ModuleCard>

        {/* Agilité — bascule (load_transfer) */}
        <ModuleCard
          title="Agilité — bascule"
          badge={ltOK ? 'RaceBox · gyro · live' : 'RaceBox · gyro'}
          field="session_insights.load_transfer"
          filled={ltOK}
          live
        >
          {ltOK &&
            (() => {
              const l = lt as LoadTransfer;
              return (
                <>
                  <BasculeDial />
                  <Fact first k="Vitesse de lacet maxi" v={`${l.yaw_rate_max_degs} °/s`} />
                  {(l.transitions || []).slice(0, 3).map((tr, i) => (
                    <Fact
                      key={i}
                      k={
                        `Bascule ${tr.corner_from ? `V${tr.corner_from}` : ''}${tr.corner_to ? `→V${tr.corner_to}` : ''}`.trim() ||
                        'Bascule'
                      }
                      v={`${tr.switch_time_s.toFixed(2)} s`}
                    />
                  ))}
                  <HowTo>
                    Le temps que met la voiture à basculer d'un appui à l'autre dans un
                    enchaînement.
                  </HowTo>
                </>
              );
            })()}
        </ModuleCard>
      </Section>

      {/* ACTE 3 */}
      <Section delay={D()}>
        <Eyebrow>ACTE 3 · LA PROCHAINE FOIS</Eyebrow>
        <Text style={s.actH}>Où ça se joue</Text>
        <Text style={s.prose}>
          {acts.act3 || focusPhrase || 'Le cap pour la prochaine séance apparaîtra ici.'}
        </Text>
        <Source field="app_session_analyses.next_focus_phrase + debrief_text" />
      </Section>

      {/* Signature doctrine */}
      <Section delay={D()} style={s.signoff}>
        <Text style={s.signQ}>« {acts.sign} »</Text>
        <Text style={s.signS}>LA VOIX DU DÉBRIEF OXV</Text>
      </Section>

      {/* COACH */}
      <Section delay={D()} style={s.coach}>
        <View style={s.coachTop}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>
              {(coach?.name || 'OXV')
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </Text>
          </View>
          <View>
            <Text style={s.coachName}>{coach?.name || 'Coach partenaire'}</Text>
            <Text style={s.coachRole}>
              {(coach?.role || 'Coach · sous-traitance').toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={s.coachUtil}>
          Le miroir vous <Text style={{ color: C.cream }}>montre</Text>. Le coach{' '}
          <Text style={{ color: C.cream }}>transforme le constat en plan</Text> — et sa calibration
          fait monter la précision de la lecture.
        </Text>
        {focusPhrase ? (
          <View style={s.pri}>
            <Text style={s.priTag}>{focusCorner ? `FOCUS · V${focusCorner}` : 'FOCUS'}</Text>
            <Text style={s.priTx}>{focusPhrase}</Text>
          </View>
        ) : null}
        {(coach?.notes || []).map((nt, i) => (
          <View key={i} style={s.pri}>
            <Text style={s.priTag}>{nt.tag.toUpperCase()}</Text>
            <Text style={s.priTx}>{nt.text}</Text>
          </View>
        ))}
        {coach?.voiceNoteSeconds ? (
          <View style={s.audio}>
            <View style={s.tri} />
            <Text style={s.audioTxt}>
              NOTE VOCALE · {Math.floor(coach.voiceNoteSeconds / 60)}:
              {String(coach.voiceNoteSeconds % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : null}
        {coach?.precisionBefore != null && coach?.precisionAfter != null ? (
          <View style={s.lift}>
            <Text style={s.liftH}>
              Son utilité, mesurée : la précision monte quand le coach pose ses repères.
            </Text>
            <View style={s.twin}>
              <View style={s.twinCol}>
                <Text style={[s.twinPc, { color: C.copper }]}>{coach.precisionBefore}%</Text>
                <Text style={s.twinLab}>AVANT</Text>
              </View>
              <Text style={s.arrow}>→</Text>
              <View style={s.twinCol}>
                <Text style={[s.twinPc, { color: C.cream }]}>{coach.precisionAfter}%</Text>
                <Text style={s.twinLab}>APRÈS</Text>
              </View>
            </View>
          </View>
        ) : null}
        <Source field="coach_annotations · coach_corner_reference · next_focus" live={false} />
      </Section>

      {/* Pied */}
      <View style={s.foot}>
        <Text style={s.footTxt}>Les faits sont à vous. L'interprétation appartient au coach.</Text>
        {modState && modState !== 'ok' && (
          <Text style={[s.footTxt, { color: C.copper, marginTop: 6 }]}>
            Modules RaceBox :{' '}
            {modState === 'no_frames' ? 'en attente de la première télémétrie' : modState}.
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

/* ============================ MICRO-COMPOSANTS ============================ */
const Legend: React.FC<{ c: string; t: string }> = ({ c, t }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c, marginRight: 6 }} />
    <Text style={{ color: C.mute, fontSize: 10 }}>{t}</Text>
  </View>
);
const GgStat: React.FC<{ lab: string; v: string }> = ({ lab, v }) => (
  <View
    style={{
      flex: 1,
      backgroundColor: C.card2,
      borderColor: C.line,
      borderWidth: 1,
      borderRadius: 12,
      padding: 11,
    }}
  >
    <Text style={{ color: C.mute, fontSize: 9, fontFamily: F.mono, letterSpacing: 1 }}>
      {lab.toUpperCase()}
    </Text>
    <Text style={{ color: C.cream, fontFamily: F.mono, fontSize: 15, marginTop: 6 }}>{v}</Text>
  </View>
);
// Cadran de bascule : horizon qui oscille (RN transform, sans SVG).
const BasculeDial: React.FC = () => {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rot, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rot, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  const deg = rot.interpolate({ inputRange: [0, 1], outputRange: ['-11deg', '11deg'] });
  return (
    <View style={s.dial}>
      <Animated.View style={[s.dialLine, { transform: [{ rotate: deg }] }]} />
      <View style={s.dialHub} />
    </View>
  );
};

/* ============================ STYLES ============================ */
const s = StyleSheet.create({
  screen: { backgroundColor: C.card, flex: 1 },
  head: { padding: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  eyebrow: { fontFamily: F.mono, fontSize: 9, letterSpacing: 2, color: C.copper },
  title: { fontFamily: F.display, fontSize: 22, color: C.cream, marginTop: 8, letterSpacing: 0.5 },
  meta: { fontFamily: F.mono, fontSize: 11, color: C.mute, marginTop: 4 },
  precis: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: C.card2,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
  },
  precisLab: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: C.soft },
  precisSub: { fontSize: 11, color: C.mute, marginTop: 3 },
  precisPc: { fontFamily: F.mono, fontSize: 18, color: C.cream },

  sec: { padding: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  actH: {
    fontFamily: F.display,
    fontSize: 14,
    color: C.cream,
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 0.4,
  },
  prose: { fontSize: 13.5, lineHeight: 22, color: C.soft },
  kicker: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.6, color: C.mute, marginTop: 4 },

  panel: {
    backgroundColor: C.night,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    marginTop: 10,
    overflow: 'hidden',
  },
  howto: {
    flexDirection: 'row',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 11,
    padding: 10,
    marginTop: 11,
    alignItems: 'flex-start',
  },
  howtoL: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 1, color: C.copper, paddingTop: 1 },
  howtoS: { flex: 1, fontSize: 11.5, color: C.soft, lineHeight: 17 },

  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  factK: { fontSize: 12, color: C.mute },
  factV: { fontFamily: F.mono, fontSize: 14, color: C.cream },
  chip: {
    alignSelf: 'flex-start',
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: C.soft,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 10,
    overflow: 'hidden',
  },

  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sourceTxt: { fontFamily: F.mono, fontSize: 8.5, color: C.mute },

  subcard: { marginTop: 16 },
  subTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  subTitle: { fontSize: 13.5, fontWeight: '600', color: C.soft },
  badge: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.6,
    color: C.copper,
    borderColor: 'rgba(184,115,51,0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  waiting: {
    backgroundColor: C.card2,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    borderStyle: 'dashed',
  },
  waitingTxt: { color: C.mute, fontSize: 12, fontStyle: 'italic' },

  pillars: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: C.card2,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
  },
  pillLab: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: C.mute },
  pillVal: { fontSize: 13, color: C.cream, marginTop: 7 },

  splitLab: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  splitTrack: {
    height: 15,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    borderColor: C.line,
    borderWidth: 1,
  },

  phaseStrip: {
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    borderColor: C.line,
    borderWidth: 1,
  },
  legendRow: { flexDirection: 'row', marginTop: 9 },

  ggTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  ggNum: { fontFamily: F.mono, fontSize: 11, color: C.mute },
  theoMark: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 14,
    backgroundColor: C.red,
    marginLeft: -2,
  },
  ggDelta: { fontSize: 10.5, color: C.mute, marginTop: 6 },
  ggGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },

  dial: { height: 84, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  dialLine: { width: 96, height: 2.5, backgroundColor: C.red, borderRadius: 2 },
  dialHub: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: C.cream },

  signoff: { alignItems: 'center', paddingVertical: 22 },
  signQ: {
    fontFamily: F.display,
    fontSize: 14,
    color: C.cream,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.4,
  },
  signS: { fontFamily: F.mono, fontSize: 9, color: C.mute, letterSpacing: 1.5, marginTop: 9 },

  coach: {
    backgroundColor: 'rgba(184,115,51,0.08)',
    borderColor: 'rgba(184,115,51,0.45)',
    borderWidth: 1,
    borderRadius: 18,
    margin: 18,
    padding: 16,
  },
  coachTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.copper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#1a1206', fontFamily: F.display, fontSize: 13 },
  coachName: { color: C.cream, fontSize: 13.5, fontWeight: '600' },
  coachRole: { color: C.mute, fontFamily: F.mono, fontSize: 9, letterSpacing: 0.6, marginTop: 2 },
  coachUtil: { fontSize: 12.5, color: C.soft, lineHeight: 20, marginTop: 12 },
  pri: {
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(184,115,51,0.25)',
    marginTop: 6,
    flexDirection: 'row',
    gap: 9,
  },
  priTag: { fontFamily: F.mono, fontSize: 9, color: C.copper, letterSpacing: 0.6 },
  priTx: { flex: 1, fontSize: 12.5, color: C.soft, lineHeight: 18 },
  audio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderColor: 'rgba(184,115,51,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
  },
  tri: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderLeftColor: C.copper,
    borderTopWidth: 5,
    borderTopColor: 'transparent',
    borderBottomWidth: 5,
    borderBottomColor: 'transparent',
  },
  audioTxt: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, color: C.copper },
  lift: {
    marginTop: 15,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderColor: 'rgba(184,115,51,0.25)',
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
  },
  liftH: { fontSize: 11.5, color: C.soft, marginBottom: 11 },
  twin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  twinCol: { alignItems: 'center' },
  twinPc: { fontFamily: F.mono, fontSize: 22 },
  twinLab: { fontFamily: F.mono, fontSize: 9, color: C.mute, marginTop: 6, letterSpacing: 0.6 },
  arrow: { color: C.copper, fontSize: 18 },

  foot: { padding: 18, alignItems: 'center' },
  footTxt: { fontSize: 10.5, color: C.mute, textAlign: 'center', lineHeight: 16 },
});

export default DebriefMirror;
