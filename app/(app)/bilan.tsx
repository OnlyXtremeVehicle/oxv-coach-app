/**
 * Bilan de séance — zone Miroir. Reskin FIDÈLE aux maquettes Claude Design
 * refonte-v2 §7.2 (screens/02-bilan.png), décision fondateur 2026-07-12.
 *
 * Héros conforme à la maquette (haut → bas) :
 *   header « Bilan de séance » + partage · eyebrow contexte · RÉGULARITÉ AU TOUR
 *   → chiffre roi ±X,XX s VIOLET plat (à gauche) · mini-graphe de dispersion ·
 *   carte meilleur tour (OR) · « Quatre piliers » (4 lignes pastille QDI + barre +
 *   chip factuel coloré) · 3 chips « moments » · bouton « Ouvrir le Data Lab ».
 *
 * La DOCTRINE et les fonctions (transparence charte 11, voix coach attribuée,
 * export PDF, souvenirs) sont PRÉSERVÉES, rangées SOUS le héros — la maquette est
 * la vitrine, la substance reste. Logique/données/nav/RLS inchangées. Vouvoiement.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, type DimensionValue, Pressable, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import Svg, { Line as SvgLine, Rect as SvgRect } from 'react-native-svg';

import type { SessionInsights } from '@/circuit/sessionInsights';
import {
  BlindspotsBlock,
  DataQualityBanner,
  ProvenanceLine,
  SourceMethodBlock,
} from '@/components/InsightTransparency';
import { FadeInSection } from '@/components/motion';
import { CoachBand } from '@/components/instruments';
import * as haptics from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession, upsertAnalysis } from '@/services/analysesService';
import { OxvEvent } from '@/services/analyticsEvents';
import { type DemoBanner, demoBannerForEventType } from '@/services/eventContextLogic';
import { getEventLite } from '@/services/eventsService';
import { type KeyMoment, computeKeyMoments } from '@/services/keyMomentsLogic';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { exportAndShareBilanPdf } from '@/services/bilanPdfExportService';
import { getCorner } from '@/lib/circuitTopology';
import { buildContextRows } from '@/services/coachContextLogic';
import { type CoachPilotHighlight } from '@/services/coachCurationLogic';
import { listHighlightsForMe } from '@/services/coachCurationService';
import { type CoachReadingWeights, computeCoachReading } from '@/services/coachReadingLogic';
import { listReadingWeightsForMe } from '@/services/coachReadingService';
import { getSessionContext } from '@/services/coachSessionContextService';
import { fetchSessionInsights } from '@/services/sessionInsightsService';
import { type ComputeMarginOutput, computeMargin } from '@/services/marginCalculator';
import { getQdiForSession, type QdiRecord } from '@/services/qdiService';
import { computeRegularity } from '@/services/regularityService';
import { fetchPreviousSessions, fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import type { TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateShort, formatLapTime } from '@/utils/format';

const { palette, dataColors, spacing, radius, fonts } = theme;

/** Les 4 piliers de la maquette (la régularité est le héros, pas un pilier). */
const PILLARS = [
  { key: 'trajectoire', label: 'Trajectoire', color: dataColors.trajectory },
  { key: 'freinage', label: 'Freinage', color: dataColors.brake },
  { key: 'acceleration', label: 'Accélération', color: dataColors.accel },
  { key: 'fluidite', label: 'Fluidité', color: dataColors.flow },
] as const;

/** Chrono en secondes → « ±0,42 s » (mono, virgule française). */
function formatSpread(s: number): string {
  return `±${s.toFixed(2).replace('.', ',')}`;
}

export default function BilanScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [session, setSession] = useState<TelemetrySession | null>(null);
  const [margin, setMargin] = useState<ComputeMarginOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [contextRows, setContextRows] = useState<{ label: string; value: string }[]>([]);
  const [highlights, setHighlights] = useState<CoachPilotHighlight[]>([]);
  const [readingWeights, setReadingWeights] = useState<CoachReadingWeights[]>([]);
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [demoBanner, setDemoBanner] = useState<DemoBanner | null>(null);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
  const [qdi, setQdi] = useState<QdiRecord | null>(null);

  // Régularité (héros) : durées de tours valides + agrégats (soi contre soi).
  const [lapDurations, setLapDurations] = useState<number[]>([]);
  const [spreadSeconds, setSpreadSeconds] = useState<number | null>(null);
  const [bestSeconds, setBestSeconds] = useState<number | null>(null);
  const [avgSeconds, setAvgSeconds] = useState<number | null>(null);
  const [prevBest, setPrevBest] = useState<{ seconds: number; date: string | null } | null>(null);
  const [sessionsHere, setSessionsHere] = useState(1);

  useEffect(() => {
    OxvEvent.bilanOuvert(); // KPI bilan_open_rate (§27)
  }, []);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const targetSession = await loadSession(profile.id, params.sessionId);
        if (cancelled) return;
        if (!targetSession) {
          setLoading(false);
          return;
        }
        setSession(targetSession);

        const existing = await getAnalysisForSession(targetSession.id);
        if (cancelled) return;

        if (existing && existing.marginZone) {
          setMargin({
            marginGlobal: existing.marginGlobal,
            marginZone: existing.marginZone,
            marginVehicle: existing.marginVehicle ?? 100,
            marginPilot: existing.marginPilot ?? 100,
            breakdown: {
              vehicle: existing.marginVehicle ?? 100,
              pilot: existing.marginPilot ?? 100,
              regularity: existing.breakdown?.regularity ?? 100,
              smoothness: existing.breakdown?.smoothness ?? 100,
            },
            validLapCount: 0,
          });
          setLoading(false);
          return;
        }

        const laps = await fetchSessionLaps(targetSession.id);
        const result = computeMargin({ session: targetSession, laps });
        if (cancelled) return;
        setMargin(result);
        setLoading(false);

        if (targetSession.user_id === profile.id) {
          upsertAnalysis({
            telemetrySessionId: targetSession.id,
            userId: profile.id,
            result,
          }).catch(() => undefined);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  // Insights de session (transparence, charte 11) — fiabilité + provenance.
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    fetchSessionInsights(session.id).then((row) => {
      if (!cancelled) setInsights(row);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  // Radar QDI (lecture seule) — nourrit les « Quatre piliers ».
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    getQdiForSession(session.id).then((q) => {
      if (!cancelled) setQdi(q);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  // OXV Key Moments (T-3) — moments factuels saillants (→ chips « moments »).
  useEffect(() => {
    if (!session?.id) return;
    const sessionId = session.id;
    let cancelled = false;
    (async () => {
      const [laps, segments] = await Promise.all([
        fetchSessionLaps(sessionId),
        listSegmentAnalysesForSession(sessionId),
      ]);
      if (cancelled) return;
      setKeyMoments(
        computeKeyMoments({
          laps: laps.map((l) => ({
            lapNumber: l.lap_number,
            durationSeconds: l.duration_seconds,
            isOutlap: l.is_outlap,
            isInlap: l.is_inlap,
          })),
          segments: segments.map((sg) => ({
            segmentIndex: sg.segmentIndex,
            segmentName: sg.segmentName,
            maxGLateral: sg.maxGLateral,
          })),
        })
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  // Bandeau « mode démo » (PR-20b) : honnêteté hors circuit.
  useEffect(() => {
    const eventId = session?.event_id;
    if (!eventId) {
      setDemoBanner(null);
      return;
    }
    let cancelled = false;
    getEventLite(eventId).then((evt) => {
      if (!cancelled) setDemoBanner(demoBannerForEventType(evt?.eventType ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, [session?.event_id]);

  // Contexte coach (§10.3).
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    getSessionContext(session.id).then((ctx) => {
      if (cancelled || !ctx) return;
      setContextRows(buildContextRows(ctx).map((r) => ({ label: r.label, value: r.value })));
    });
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  // Priorisation coach (§10.3c-B).
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    listHighlightsForMe().then((rows) => {
      if (!cancelled)
        setHighlights(rows.filter((h) => h.highlightCornerIndexes.length > 0 || h.note));
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Lecture du coach (§10.3c-D).
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    listReadingWeightsForMe().then((rows) => {
      if (!cancelled) setReadingWeights(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Régularité au tour (héros) + situation soi contre soi. Sort de `laps`,
  // indépendant des `telemetry_frames`.
  useEffect(() => {
    if (!session?.id || !profile?.id) return;
    const sessionId = session.id;
    const circuitId = session.circuit_id;
    const ownBest = session.best_lap_seconds;
    let cancelled = false;
    (async () => {
      const laps = await fetchSessionLaps(sessionId);
      const valid = laps
        .filter((l) => !l.is_outlap && !l.is_inlap)
        .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }));
      const reg = computeRegularity(valid);
      const durations = valid.map((l) => l.durationSeconds).filter((d) => d > 0);
      const previous = await fetchPreviousSessions(profile.id, circuitId, 8, sessionId);
      if (cancelled) return;
      const prevWithBest = previous.find((s) => s.best_lap_seconds != null) ?? null;
      setLapDurations(durations);
      setSpreadSeconds(reg.spreadSeconds);
      setBestSeconds(reg.bestSeconds ?? ownBest ?? null);
      setAvgSeconds(
        durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null
      );
      setSessionsHere(previous.length + 1);
      setPrevBest(
        prevWithBest?.best_lap_seconds != null
          ? { seconds: prevWithBest.best_lap_seconds, date: prevWithBest.started_at ?? null }
          : null
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.circuit_id, session?.best_lap_seconds, profile?.id]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.creamMute} />
        </View>
      </Screen>
    );
  }
  if (error) return <BilanError message={error} />;
  if (!session || !margin) return <BilanEmpty />;

  const sessionId = session.id;
  const contextLine = [
    session.circuit_name ?? 'Séance',
    session.started_at ? formatDateShort(session.started_at) : null,
    lapDurations.length ? `${lapDurations.length} tours` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const belowMean =
    bestSeconds != null && avgSeconds != null ? Math.max(0, avgSeconds - bestSeconds) : null;

  return (
    <Screen>
      <AppBar
        title="Bilan de séance"
        onBack={() => router.back()}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Partager mon bilan"
            hitSlop={theme.hitSlop}
            onPress={async () => {
              setExporting(true);
              await exportAndShareBilanPdf({ sessionId });
              setExporting(false);
            }}
          >
            {exporting ? (
              <ActivityIndicator color={palette.creamMute} size="small" />
            ) : (
              <ShareIcon />
            )}
          </Pressable>
        }
      />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Contexte de séance — eyebrow mono centré. */}
        <Text style={s.contextEyebrow}>{contextLine.toUpperCase()}</Text>

        {demoBanner ? (
          <View style={s.demoBanner}>
            <Text style={s.demoTitle}>{demoBanner.title}</Text>
            <Text style={s.demoBody}>{demoBanner.body}</Text>
          </View>
        ) : null}

        {/* HÉROS — régularité au tour, chiffre roi VIOLET plat à gauche. */}
        <FadeInSection>
          <Text style={s.regEyebrow}>RÉGULARITÉ AU TOUR</Text>
          {spreadSeconds != null ? (
            <Text style={s.regNumber}>
              {formatSpread(spreadSeconds)}
              <Text style={s.regUnit}> s</Text>
            </Text>
          ) : (
            <Text style={s.regNumber}>
              —<Text style={s.regUnit}> s</Text>
            </Text>
          )}
          <LapDispersion durations={lapDurations} bestSeconds={bestSeconds} />
        </FadeInSection>

        {/* Meilleur tour — l'unique porteur de l'OR (chrono/record). */}
        <FadeInSection delay={60}>
          <View style={s.bestCard}>
            <View style={s.bestLeft}>
              <View style={s.goldDot} />
              <Text style={s.bestChrono}>
                {bestSeconds != null ? formatLapTime(bestSeconds) : '—'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.bestLabel}>Votre meilleur</Text>
              {belowMean != null && belowMean > 0.05 ? (
                <Text style={s.bestSub}>
                  {belowMean.toFixed(1).replace('.', ',')} s sous votre moyenne
                </Text>
              ) : prevBest ? (
                <Text style={s.bestSub}>{sessionsHere}ᵉ séance ici</Text>
              ) : (
                <Text style={s.bestSub}>Première séance ici</Text>
              )}
            </View>
          </View>
        </FadeInSection>

        {/* QUATRE PILIERS — pastille QDI + nom + barre + chip factuel coloré. */}
        <FadeInSection delay={120}>
          <Text style={s.sectionEyebrow}>QUATRE PILIERS</Text>
          <View style={{ gap: spacing.md }}>
            {PILLARS.map((p) => {
              const value = qdi ? (qdi[p.key as keyof QdiRecord] as number | null) : null;
              return (
                <PillarRow
                  key={p.key}
                  label={p.label}
                  color={p.color}
                  value={typeof value === 'number' ? value : null}
                  href={`/(app)/signature?sessionId=${sessionId}`}
                />
              );
            })}
          </View>
        </FadeInSection>

        {/* Chips « moments » — faits saillants, jamais des consignes. */}
        {keyMoments.length > 0 ? (
          <FadeInSection delay={180}>
            <View style={s.momentWrap}>
              {keyMoments.slice(0, 3).map((m, i) => (
                <View
                  key={m.key}
                  style={[
                    s.momentChip,
                    { borderLeftColor: i === 0 ? palette.gold : dataColors.regularity },
                  ]}
                >
                  <Text style={s.momentTitle}>{m.title}</Text>
                  <Text style={s.momentFact}>{m.fact}</Text>
                </View>
              ))}
            </View>
          </FadeInSection>
        ) : null}

        {/* Ouvrir le Data Lab — CTA de fin de héros (maquette). */}
        <FadeInSection delay={240}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/data-lab?sessionId=${sessionId}` as never)}
            style={({ pressed }) => [s.dataLabBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.dataLabTxt}>Ouvrir le Data Lab →</Text>
          </Pressable>
        </FadeInSection>

        {/* ─────────────────────────────────────────────────────────────
            Sous le héros : la substance OXV (doctrine + fonctions), qui
            n'apparaît pas dans la maquette-vitrine mais reste obligatoire.
            ───────────────────────────────────────────────────────────── */}

        {/* Fiabilité de la donnée (charte 11, T2). */}
        {insights?.data_quality ? (
          <View style={{ marginTop: spacing.xxl }}>
            <DataQualityBanner dataQuality={insights.data_quality} />
          </View>
        ) : null}

        {/* Contexte du coach (§10.3) — ce que le capteur ne capte pas. */}
        {contextRows.length > 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <Card style={s.coachCard}>
              <Text style={[s.coachEyebrow]}>LE CONTEXTE DE VOTRE COACH</Text>
              <View style={{ gap: spacing.md }}>
                {contextRows.map((row) => (
                  <View key={row.label}>
                    <Text style={s.coachRowLabel}>{row.label}</Text>
                    <Text style={s.coachRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {/* Priorisation du coach (§10.3c-B) — voix attribuée, bande rouge. */}
        {highlights.map((h) => (
          <View key={h.id} style={{ marginTop: spacing.xl }}>
            <CoachBand
              title="Mis en avant par votre coach"
              items={[
                ...(h.note ? [{ text: `« ${h.note} »` }] : []),
                ...h.highlightCornerIndexes.map((idx) => ({
                  text: getCorner(idx)?.name ?? `Virage ${idx}`,
                  onPress: () =>
                    router.push({
                      pathname: '/(app)/virage',
                      params: { index: String(idx), sessionId },
                    } as never),
                })),
              ]}
            />
          </View>
        ))}

        {/* La lecture du coach (§10.3c-D) — attribuée, à côté de la marge OXV. */}
        {readingWeights.map((w) => {
          const reading = computeCoachReading(margin.breakdown, w);
          if (reading === null) return null;
          return (
            <View key={w.coachId} style={{ marginTop: spacing.xl }}>
              <Card style={s.coachCardCentered}>
                <Text style={s.coachEyebrow}>LA LECTURE DE VOTRE COACH</Text>
                <Text style={s.coachReading}>{reading}%</Text>
                {w.note ? <Text style={s.coachNote}>« {w.note} »</Text> : null}
                <Text style={s.coachReadingHint}>
                  La grille de lecture de votre coach, à côté de la marge OXV — pas à sa place.
                </Text>
              </Card>
            </View>
          );
        })}

        {/* Actions complémentaires — souvenirs, carte à partager, ressenti. */}
        <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
          <GhostCta
            label="Comparer avec un copain"
            onPress={() => router.push('/(app)/amis' as never)}
          />
          <GhostCta
            label="Voir mes souvenirs de séance"
            onPress={() => router.push(`/(app)/session-media/${sessionId}` as never)}
          />
          <GhostCta
            label="Carte à partager"
            onPress={() => router.push(`/(app)/carte-trophee?sessionId=${sessionId}` as never)}
          />
          <GhostCta
            label="Noter mon ressenti"
            onPress={() => router.push(`/(app)/carnet?sessionId=${sessionId}` as never)}
          />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            variant="ghost"
            label="Partager mon bilan en PDF"
            loading={exporting}
            onPress={async () => {
              setExporting(true);
              await exportAndShareBilanPdf({ sessionId });
              setExporting(false);
            }}
          />
        </View>

        {/* Transparence (charte 11) — source/méthode, angles morts, provenance. */}
        <View style={{ marginTop: spacing.xxl * 1.5 }}>
          <SourceMethodBlock
            items={[
              'Calculé à partir des trames du boîtier (GPS et capteurs inertiels, 25 points par seconde).',
              'Les tours sont détectés au passage de la ligne ; les virages, par la courbure du tracé.',
              'Aucune donnée extérieure : seulement votre séance, telle qu’elle a été enregistrée.',
            ]}
          />
          <BlindspotsBlock
            items={[
              'L’app ne connaît pas la trajectoire que vous visiez, ni vos intentions.',
              'Elle décrit ce qui s’est passé. Elle ne dit pas ce qu’il fallait faire.',
              'La segmentation des virages est une estimation, pas une vérité du circuit.',
            ]}
          />
          <ProvenanceLine
            engineVersion={insights?.engine_version}
            computedAt={insights?.computed_at}
          />
        </View>
      </View>
    </Screen>
  );
}

/** Mini-graphe de dispersion des tours (maquette) : ticks + bande médiane
 *  violette + marqueur OR du meilleur tour. Aucune donnée inventée : vide < 2 tours. */
function LapDispersion({
  durations,
  bestSeconds,
}: {
  durations: number[];
  bestSeconds: number | null;
}) {
  if (durations.length < 2) return <View style={{ height: spacing.lg }} />;
  const W = 300;
  const H = 34;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const span = Math.max(0.001, max - min);
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const x = (d: number) => 6 + ((d - min) / span) * (W - 12);
  const bandHalf = (span / 4 / span) * (W - 12); // ±quartile autour de la médiane
  const mx = x(median);
  return (
    <View style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* axe */}
        <SvgLine x1={6} y1={H / 2} x2={W - 6} y2={H / 2} stroke={palette.line} strokeWidth={1} />
        {/* bande médiane (régularité = violet, translucide) */}
        <SvgRect
          x={Math.max(6, mx - bandHalf)}
          y={H / 2 - 8}
          width={Math.min(W - 12, bandHalf * 2)}
          height={16}
          rx={3}
          fill={dataColors.regularity}
          opacity={0.18}
        />
        {/* ticks par tour */}
        {durations.map((d, i) => (
          <SvgLine
            key={i}
            x1={x(d)}
            y1={H / 2 - 7}
            x2={x(d)}
            y2={H / 2 + 7}
            stroke={palette.creamMute}
            strokeWidth={1.4}
          />
        ))}
        {/* marqueur OR du meilleur tour (record) */}
        {bestSeconds != null ? (
          <SvgLine
            x1={x(bestSeconds)}
            y1={H / 2 - 11}
            x2={x(bestSeconds)}
            y2={H / 2 + 11}
            stroke={palette.gold}
            strokeWidth={2}
          />
        ) : null}
      </Svg>
    </View>
  );
}

/** Une ligne de pilier : pastille QDI + nom + barre (repère médian + point coloré)
 *  + chip valeur coloré. Cliquable vers la Signature/QDI. */
function PillarRow({
  label,
  color,
  value,
  href,
}: {
  label: string;
  color: string;
  value: number | null;
  href: string;
}) {
  const pct = value != null ? Math.max(0, Math.min(100, value)) : null;
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${value != null ? `, ${Math.round(value)} sur 100` : ''}`}
        onPressIn={() => haptics.tap()}
        style={({ pressed }) => [s.pillarRow, { opacity: pressed ? 0.9 : 1 }]}
      >
        <View style={[s.pillarDot, { backgroundColor: color }]} />
        <Text style={s.pillarLabel}>{label}</Text>
        <View style={s.pillarTrack}>
          <View style={s.pillarMedian} />
          {pct != null ? (
            <View
              style={[s.pillarPoint, { left: `${pct}%` as DimensionValue, backgroundColor: color }]}
            />
          ) : null}
        </View>
        <View style={[s.pillarChip, { borderColor: color }]}>
          <Text style={[s.pillarChipTxt, { color }]}>{pct != null ? Math.round(pct) : '—'}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function GhostCta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.ctaGhost, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={s.ctaGhostTxt}>{label}</Text>
    </Pressable>
  );
}

function ShareIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <SvgLine
        x1={12}
        y1={3.5}
        x2={12}
        y2={15}
        stroke={palette.creamSoft}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <SvgLine
        x1={12}
        y1={3.5}
        x2={8.5}
        y2={7}
        stroke={palette.creamSoft}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <SvgLine
        x1={12}
        y1={3.5}
        x2={15.5}
        y2={7}
        stroke={palette.creamSoft}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <SvgRect
        x={5}
        y={10}
        width={14}
        height={10.5}
        rx={2.5}
        stroke={palette.creamSoft}
        strokeWidth={1.6}
        fill="none"
      />
    </Svg>
  );
}

async function loadSession(
  userId: string,
  sessionId: string | undefined
): Promise<TelemetrySession | null> {
  if (sessionId) {
    const { data } = await supabase
      .from('telemetry_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    return (data as TelemetrySession | null) ?? null;
  }
  const { data } = await supabase
    .from('telemetry_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TelemetrySession | null) ?? null;
}

function BilanEmpty() {
  return (
    <Screen scroll={false}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[s.contextEyebrow, { marginBottom: spacing.lg }]}>BILAN</Text>
        <Text style={[s.emptyTitle, { marginBottom: spacing.xl }]}>Aucune séance encore.</Text>
        <Text style={s.manifest}>Votre première séance écrira la première ligne.</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.hitSlop}
          onPress={() => router.back()}
          style={[s.backHit, { marginTop: spacing.xxl * 1.5 }]}
        >
          <Text style={s.back}>Retour à l&apos;accueil</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function BilanError({ message }: { message: string }) {
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }}>
        <Text style={[s.contextEyebrow, { marginBottom: spacing.md }]}>ERREUR</Text>
        <Text style={[s.emptyTitle, { marginBottom: spacing.lg }]}>
          Le bilan n&apos;a pas pu être chargé.
        </Text>
        <Text style={s.errorBody}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.hitSlop}
          onPress={() => router.back()}
          style={s.backHit}
        >
          <Text style={s.back}>Retour</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  contextEyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  regEyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: dataColors.regularity,
    marginBottom: spacing.sm,
  },
  regNumber: {
    fontFamily: fonts.king,
    fontSize: 46,
    letterSpacing: -1.5,
    color: dataColors.regularity,
  },
  regUnit: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.h3,
    color: dataColors.regularity,
    letterSpacing: 0,
  },
  // Carte meilleur tour — l'unique OR de l'écran.
  bestCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  bestLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  goldDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold },
  bestChrono: {
    fontFamily: fonts.monoSemi,
    fontSize: theme.fontSize.value,
    letterSpacing: -0.5,
    color: palette.gold,
  },
  bestLabel: { fontFamily: fonts.bodyMedium, fontSize: theme.fontSize.small, color: palette.cream },
  bestSub: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    color: palette.creamMute,
    marginTop: 2,
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  // Pilier : pastille + nom + barre + chip
  pillarRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  pillarDot: { width: 8, height: 8, borderRadius: 4 },
  pillarLabel: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.creamSoft,
    width: 96,
  },
  pillarTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.line,
    justifyContent: 'center' as const,
  },
  pillarMedian: {
    position: 'absolute' as const,
    left: '50%' as DimensionValue,
    width: 1,
    height: 9,
    marginTop: -3,
    backgroundColor: palette.faint,
  },
  pillarPoint: {
    position: 'absolute' as const,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  pillarChip: {
    minWidth: 40,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  pillarChipTxt: { fontFamily: fonts.mono, fontSize: theme.fontSize.small, letterSpacing: 0.4 },
  // Chips « moments »
  momentWrap: { gap: spacing.sm, marginTop: spacing.xl },
  momentChip: {
    borderLeftWidth: 2,
    borderRadius: radius.sm,
    backgroundColor: palette.card2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  momentTitle: {
    fontFamily: fonts.monoMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.cream,
  },
  momentFact: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  dataLabBtn: {
    marginTop: spacing.xxl,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.edge,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dataLabTxt: {
    fontFamily: fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  demoBanner: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  demoTitle: { fontFamily: fonts.bodyMedium, fontSize: theme.fontSize.body, color: palette.cream },
  demoBody: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: spacing.xs,
  },
  coachCard: {
    borderColor: '#2C1418',
    borderLeftColor: palette.red,
    borderLeftWidth: 2,
    backgroundColor: '#140809',
  },
  coachCardCentered: {
    borderColor: '#2C1418',
    borderLeftColor: palette.red,
    borderLeftWidth: 2,
    backgroundColor: '#140809',
    alignItems: 'center' as const,
  },
  coachEyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: palette.red,
    marginBottom: spacing.md,
  },
  coachRowLabel: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  coachRowValue: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.cream,
    marginTop: 2,
    lineHeight: theme.fontSize.body * 1.4,
  },
  coachNote: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.body,
    fontStyle: 'italic' as const,
    color: palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
    textAlign: 'center' as const,
  },
  coachReading: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.display,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  coachReadingHint: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.sm,
  },
  ctaGhost: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center' as const,
  },
  ctaGhostTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    textAlign: 'center' as const,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    textAlign: 'center' as const,
    paddingHorizontal: spacing.md,
  },
  errorBody: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.creamSoft,
    marginBottom: spacing.xxl,
    lineHeight: theme.fontSize.body * 1.4,
  },
  back: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: palette.creamMute },
  backHit: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const },
};
