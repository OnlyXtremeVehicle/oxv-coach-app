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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, type DimensionValue, Easing, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle as SvgCircle, Line as SvgLine, Rect as SvgRect } from 'react-native-svg';

import type { SessionInsights } from '@/circuit/sessionInsights';
import {
  BlindspotsBlock,
  DataQualityBanner,
  ProvenanceLine,
  SourceMethodBlock,
} from '@/components/InsightTransparency';
import {
  AnimatedPresence,
  BreathingGlow,
  FadeInSection,
  PressableScale,
  Stagger,
  useReduceMotion,
} from '@/components/motion';
import { CoachBand } from '@/components/instruments';
import { supabase } from '@/lib/supabase';
import {
  type SessionAnalysis,
  getAnalysisForSession,
  upsertAnalysis,
} from '@/services/analysesService';
import { isAnalyzableSession } from '@/services/analyzeSessionService';
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
import {
  type ComputeMarginOutput,
  type ResolvedMarginBreakdown,
  computeMargin,
  isMarginResolved,
} from '@/services/marginCalculator';
import {
  getQdiAccessLevel,
  getQdiForSession,
  type QdiAccessLevel,
  type QdiRecord,
} from '@/services/qdiService';
import { computeRegularity } from '@/services/regularityService';
import { fetchPreviousSessions, fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import type { TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateShort, formatLapTimeMs } from '@/utils/format';

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
  const [exportError, setExportError] = useState(false);
  const [contextRows, setContextRows] = useState<{ label: string; value: string }[]>([]);
  const [highlights, setHighlights] = useState<CoachPilotHighlight[]>([]);
  const [readingWeights, setReadingWeights] = useState<CoachReadingWeights[]>([]);
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [demoBanner, setDemoBanner] = useState<DemoBanner | null>(null);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
  const [qdi, setQdi] = useState<QdiRecord | null>(null);
  const [qdiAccess, setQdiAccess] = useState<QdiAccessLevel>('full');
  // La lecture pondérée du coach n'a de sens que sur un breakdown COMPLET —
  // jamais sur des composantes absentes remplacées par 100 (valeur inventée).
  // L'état ne porte QUE des composantes réelles : le masquage est structurel,
  // plus un booléen qu'on pouvait forcer à `true`.
  const [coachBreakdown, setCoachBreakdown] = useState<ResolvedMarginBreakdown | null>(null);

  // Régularité (héros) : durées de tours valides + agrégats (soi contre soi).
  const [lapDurations, setLapDurations] = useState<number[]>([]);
  const [medianSeconds, setMedianSeconds] = useState<number | null>(null);
  const [spreadSeconds, setSpreadSeconds] = useState<number | null>(null);
  const [bestSeconds, setBestSeconds] = useState<number | null>(null);
  const [avgSeconds, setAvgSeconds] = useState<number | null>(null);
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
          // Une composante absente reste absente : la combler par 100 fabriquait
          // un chiffre. Le breakdown ne nourrit la lecture coach que s'il est
          // intégralement réel (cf. `realBreakdownOf`).
          setCoachBreakdown(realBreakdownOf(existing, targetSession));
          setMargin({
            marginGlobal: existing.marginGlobal,
            marginZone: existing.marginZone,
            marginVehicle: existing.marginVehicle,
            marginPilot: existing.marginPilot,
            breakdown: {
              vehicle: existing.marginVehicle,
              pilot: existing.marginPilot,
              regularity: existing.breakdown?.regularity ?? null,
              smoothness: existing.breakdown?.smoothness ?? null,
            },
            validLapCount: 0,
          });
          setLoading(false);
          return;
        }

        const laps = await fetchSessionLaps(targetSession.id);
        const result = computeMargin({ session: targetSession, laps });
        if (cancelled) return;
        setCoachBreakdown(isMarginResolved(result) ? result.breakdown : null);
        setMargin(result);
        setLoading(false);

        // On ne fige en base qu'une marge ENTIÈREMENT calculée, et seulement sur
        // une séance close : un bilan ouvert pendant que la file de synchro
        // draine encore lit des agrégats partiels (`max_g_lateral` NULL, tours
        // pas tous remontés). L'upsert est définitif (`onConflict`, aucun
        // recalcul ensuite) — dans le doute on n'écrit pas, la prochaine
        // ouverture recalculera sur des données complètes.
        if (
          targetSession.user_id === profile.id &&
          isAnalyzableSession(targetSession) &&
          isMarginResolved(result)
        ) {
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

  // Radar QDI (lecture seule) — nourrit les « Quatre piliers ». Le niveau
  // d'offre gate le DÉTAIL chiffré (Access = forme seule, comme la Signature).
  useEffect(() => {
    if (!session?.id || !profile?.id) return;
    let cancelled = false;
    Promise.all([getQdiForSession(session.id), getQdiAccessLevel(profile.id)]).then(
      ([q, access]) => {
        if (cancelled) return;
        setQdi(q);
        setQdiAccess(access);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [session?.id, profile?.id]);

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
      // Compte EXACT des séances sur ce circuit (le « Nᵉ séance ici » ne doit
      // pas saturer à la limite de fetchPreviousSessions).
      let hereCountQuery = supabase
        .from('telemetry_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('status', 'completed');
      if (circuitId) hereCountQuery = hereCountQuery.eq('circuit_id', circuitId);
      const { count: hereCount } = await hereCountQuery;
      if (cancelled) return;
      setLapDurations(durations);
      setMedianSeconds(reg.medianSeconds);
      // Régularité au tour = ÉCART-TYPE (handoff §9) — même métrique que le
      // Paddock et Progression : le même ±X,XX s dit la même chose partout.
      setSpreadSeconds(reg.stdDevSeconds);
      setBestSeconds(reg.bestSeconds ?? ownBest ?? null);
      setAvgSeconds(
        durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null
      );
      setSessionsHere(hereCount ?? previous.length + 1);
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
    // « lancés » : tours valides (hors outlap/inlap) — le total enregistré diffère.
    lapDurations.length ? `${lapDurations.length} tours lancés` : null,
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
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Partager mon bilan"
            hitSlop={theme.hitSlop}
            onPress={async () => {
              setExporting(true);
              setExportError(false);
              const res = await exportAndShareBilanPdf({ sessionId });
              setExporting(false);
              if (!res.ok) setExportError(true);
            }}
          >
            {exporting ? (
              <ActivityIndicator color={palette.creamMute} size="small" />
            ) : (
              <ShareIcon />
            )}
          </PressableScale>
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

        {/* Séance pas encore close : la file de synchro draine toujours. On le
            DIT, au lieu de laisser croire que le bilan partiel est le bilan. */}
        {!isAnalyzableSession(session) ? (
          <View style={s.demoBanner}>
            <Text style={s.demoTitle}>Séance en cours de synchronisation.</Text>
            <Text style={s.demoBody}>
              Les données de cette séance n&apos;ont pas fini de remonter. Ce bilan reste partiel
              tant que la synchronisation n&apos;est pas terminée.
            </Text>
          </View>
        ) : null}

        {/* HÉROS — régularité au tour, chiffre roi VIOLET plat à gauche. */}
        <FadeInSection>
          <Text style={s.regEyebrow}>RÉGULARITÉ AU TOUR</Text>
          {spreadSeconds != null ? (
            <SpreadKingNumber spreadSeconds={spreadSeconds} />
          ) : (
            <Text style={s.regNumber}>
              —<Text style={s.regUnit}> s</Text>
            </Text>
          )}
          {/* Lecture (retour build 23) — ce qu'on regarde, en une phrase simple.
              Descriptif, jamais prescriptif. */}
          <Text style={s.lectureLine}>
            Votre régularité : l&apos;écart entre vos tours. Plus il est petit, plus vous êtes
            constant.
          </Text>
          <LapDispersion
            durations={lapDurations}
            bestSeconds={bestSeconds}
            medianSeconds={medianSeconds}
          />
          {lapDurations.length >= 2 ? (
            // Libellé vulgarisé SANS perdre le terme technique (build 23).
            <Text style={s.dispersionCaption}>Dispersion (régularité) — un trait par tour</Text>
          ) : null}

          {/* Pédagogie (build 23) : comment lire — repliable, état local, pas un modal. */}
          <HowToRead>
            <HowRow color={dataColors.regularity}>
              Le chiffre violet est l&apos;écart-type de vos tours : leur dispersion autour de la
              moyenne. Sur le graphe, un trait = un tour ; la bande violette couvre la moitié
              centrale de vos tours ; le pointillé est le tour médian.
            </HowRow>
            <HowRow color={palette.gold}>
              L&apos;or ne marque que le chrono : votre meilleur tour, sur le graphe comme sur la
              carte.
            </HowRow>
            <HowRow>
              Les quatre piliers sont des branches de votre QDI, notées de 0 à 100 — chaque donnée
              garde sa couleur. Le repère au centre des barres marque le milieu de l&apos;échelle
              (50).
            </HowRow>
            <HowLegend items={PILLARS} />
            {keyMoments.length > 0 ? (
              <HowRow>
                Les encadrés « moments » sont des faits saillants de la séance : or = référence
                chrono, rouge = passage engagé, violet = variation d&apos;un tour à l&apos;autre.
              </HowRow>
            ) : null}
            <HowRow>
              La méthode et ses limites sont détaillées en bas de page, sous « Source / Méthode ».
            </HowRow>
          </HowToRead>
        </FadeInSection>

        {/* Meilleur tour — l'unique porteur de l'OR (chrono/record). */}
        <FadeInSection delay={60}>
          <View style={s.bestCard}>
            <View style={s.bestLeft}>
              <View style={s.goldDot} />
              <Text style={s.bestChrono}>
                {bestSeconds != null ? formatLapTimeMs(bestSeconds) : '—'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.bestLabel}>Votre meilleur</Text>
              {belowMean != null && belowMean > 0.05 ? (
                <Text style={s.bestSub}>
                  {belowMean.toFixed(1).replace('.', ',')} s sous votre moyenne
                </Text>
              ) : session.circuit_id == null ? null : sessionsHere > 1 ? (
                // Branché sur le COMPTE réel de séances ; « ici » seulement si
                // le circuit est identifié.
                <Text style={s.bestSub}>{sessionsHere}ᵉ séance ici</Text>
              ) : (
                <Text style={s.bestSub}>Première séance ici</Text>
              )}
            </View>
          </View>
        </FadeInSection>

        {/* QUATRE PILIERS — pastille QDI + nom + barre + chip factuel coloré.
            Les rangées tombent en cascade (Stagger), après l'eyebrow. */}
        <FadeInSection delay={120}>
          <Text style={s.sectionEyebrow}>QUATRE PILIERS</Text>
        </FadeInSection>
        <Stagger initialDelay={160} style={{ gap: spacing.md }}>
          {PILLARS.map((p) => {
            const value = qdi ? (qdi[p.key as keyof QdiRecord] as number | null) : null;
            return (
              <PillarRow
                key={p.key}
                label={p.label}
                color={p.color}
                value={typeof value === 'number' ? value : null}
                showValue={qdiAccess === 'full'}
                href={`/(app)/signature?sessionId=${sessionId}`}
              />
            );
          })}
        </Stagger>

        {/* Chips « moments » — faits saillants, jamais des consignes. Couleur par
            NATURE du moment : référence = or (chrono/record), passage engagé =
            rouge de donnée, variation = violet régularité. */}
        {keyMoments.length > 0 ? (
          <Stagger initialDelay={220} style={s.momentWrap}>
            {keyMoments.slice(0, 3).map((m) => {
              const color =
                m.key === 'reference'
                  ? palette.gold
                  : m.key === 'engaged'
                    ? dataColors.brake
                    : dataColors.regularity;
              return (
                <View key={m.key} style={[s.momentChip, { borderColor: color }]}>
                  <Text style={[s.momentTitle, { color }]}>{m.title}</Text>
                  <Text style={s.momentFact}>{m.fact}</Text>
                </View>
              );
            })}
          </Stagger>
        ) : null}

        {/* Ouvrir le Data Lab — CTA de fin de héros (maquette). */}
        <FadeInSection delay={280}>
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/data-lab?sessionId=${sessionId}` as never)}
            style={s.dataLabBtn}
          >
            <Text style={s.dataLabTxt}>Ouvrir le Data Lab →</Text>
          </PressableScale>
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

        {/* La lecture du coach (§10.3c-D) — attribuée, à côté de la marge OXV.
            UNIQUEMENT sur un breakdown complet (jamais sur des 100 inventés). */}
        {coachBreakdown !== null &&
          readingWeights.map((w) => {
            const reading = computeCoachReading(coachBreakdown, w);
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
              setExportError(false);
              const res = await exportAndShareBilanPdf({ sessionId });
              setExporting(false);
              if (!res.ok) setExportError(true);
            }}
          />
          {exportError ? (
            <Text style={s.exportError}>
              Le PDF n&apos;a pas pu être généré. Réessayez dans un instant.
            </Text>
          ) : null}
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
  medianSeconds,
}: {
  durations: number[];
  bestSeconds: number | null;
  /** Médiane du SERVICE (computeRegularity) — une seule définition par écran. */
  medianSeconds: number | null;
}) {
  if (durations.length < 2) return <View style={{ height: spacing.lg }} />;
  const W = 300;
  const H = 34;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const span = Math.max(0.001, max - min);
  const sorted = [...durations].sort((a, b) => a - b);
  const median = medianSeconds ?? sorted[Math.floor(sorted.length / 2)];
  // Quartiles RÉELS (interquartile p25→p75) — jamais une bande décorative.
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  const x = (d: number) => 6 + ((d - min) / span) * (W - 12);
  return (
    <View style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* axe */}
        <SvgLine x1={6} y1={H / 2} x2={W - 6} y2={H / 2} stroke={palette.line} strokeWidth={1} />
        {/* bande interquartile réelle (régularité = violet, translucide) */}
        <SvgRect
          x={x(p25)}
          y={H / 2 - 8}
          width={Math.max(2, x(p75) - x(p25))}
          height={16}
          rx={3}
          fill={dataColors.regularity}
          opacity={0.18}
        />
        {/* médiane — trait pointillé violet */}
        <SvgLine
          x1={x(median)}
          y1={H / 2 - 10}
          x2={x(median)}
          y2={H / 2 + 10}
          stroke={dataColors.regularity}
          strokeWidth={1.2}
          strokeDasharray="2 3"
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
        {/* marqueur OR « lollipop » du meilleur tour (record) */}
        {bestSeconds != null ? (
          <>
            <SvgLine
              x1={x(bestSeconds)}
              y1={H / 2 - 11}
              x2={x(bestSeconds)}
              y2={H / 2 + 11}
              stroke={palette.gold}
              strokeWidth={2}
            />
            <SvgCircle cx={x(bestSeconds)} cy={H / 2 - 11} r={3} fill={palette.gold} />
          </>
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
  showValue,
  href,
}: {
  label: string;
  color: string;
  value: number | null;
  /** Offre Access = forme seule (pas de chiffre), comme le radar Signature. */
  showValue: boolean;
  href: string;
}) {
  const pct = value != null ? Math.max(0, Math.min(100, value)) : null;
  // Le point GLISSE jusqu'à sa valeur à l'apparition (retour build 23 :
  // lisibilité par le mouvement). La position finale est la donnée réelle —
  // l'animation n'est qu'un chemin. `left` en % → useNativeDriver: false.
  const reduceMotion = useReduceMotion();
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pct == null) return;
    if (reduceMotion) {
      slide.setValue(1);
      return;
    }
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, slide, reduceMotion]);
  return (
    <Link href={href as never} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}${value != null ? `, ${Math.round(value)} sur 100` : ''}`}
        haptic="tap"
      >
        {/* Niveau 1 (maquette) : pastille + nom à gauche, chip à droite. */}
        <View style={s.pillarHead}>
          <View style={[s.pillarDot, { backgroundColor: color }]} />
          <Text style={s.pillarLabel}>{label}</Text>
          <View style={{ flex: 1 }} />
          {showValue ? (
            <View style={[s.pillarChip, { borderColor: color, backgroundColor: `${color}14` }]}>
              <Text style={[s.pillarChipTxt, { color }]}>
                {pct != null ? Math.round(pct) : '—'}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Niveau 2 : barre PLEINE LARGEUR, repère médian + point coloré. */}
        <View style={s.pillarTrack}>
          <View style={s.pillarMedian} />
          {pct != null ? (
            <Animated.View
              style={[
                s.pillarPoint,
                {
                  left: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', `${pct}%`],
                  }),
                  backgroundColor: color,
                },
              ]}
            />
          ) : null}
        </View>
      </PressableScale>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pédagogie (retour fondateur build 23 : « élevé mais pas très compréhensible »).
   Composants LOCAUX à l'écran — le périmètre du chantier ne touche pas aux
   composants partagés. Descriptif uniquement : ce que ça montre, jamais quoi
   faire. Aucune donnée ni logique modifiée — lisibilité et motion seulement.
   ───────────────────────────────────────────────────────────────────────────── */

/** « 0,42 » — format français (virgule), N décimales. */
function fmtFr(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',');
}

/**
 * Chiffre roi qui COMPTE : de 0 vers la valeur réelle (ease-out cubic, ~900 ms).
 * La destination est la donnée ; l'animation n'est qu'un chemin vers elle.
 * Respecte « Réduire les animations » (rendu direct, WCAG 2.3.3).
 */
function useCountUpFr(value: number, decimals: number, duration = 900): string {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(() => fmtFr(0, decimals));
  useEffect(() => {
    if (reduceMotion) {
      setDisplay(fmtFr(value, decimals));
      return;
    }
    const listener = progress.addListener(({ value: p }) => setDisplay(fmtFr(p * value, decimals)));
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(listener);
  }, [value, decimals, duration, reduceMotion, progress]);
  return display;
}

/** Le chiffre roi violet (écart-type) — se construit à l'apparition, puis
 *  respire discrètement (BreathingGlow : l'unique respiration de l'écran). */
function SpreadKingNumber({ spreadSeconds }: { spreadSeconds: number }) {
  const display = useCountUpFr(spreadSeconds, 2);
  return (
    <BreathingGlow>
      <Text
        style={s.regNumber}
        accessibilityLabel={`Régularité au tour : ${formatSpread(spreadSeconds)} secondes d'écart-type`}
      >
        ±{display}
        <Text style={s.regUnit}> s</Text>
      </Text>
    </BreathingGlow>
  );
}

/** Affordance fine « Comment lire cet écran » → panneau repliable (AnimatedPresence). */
function HowToRead({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: spacing.lg }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={theme.hitSlop}
        onPress={() => setOpen((o) => !o)}
        style={s.howBtn}
      >
        <Text style={s.howLabel}>Comment lire cet écran</Text>
        <Text style={[s.howChevron, open ? s.howChevronOpen : null]}>›</Text>
      </PressableScale>
      <AnimatedPresence visible={open}>
        <View style={s.howPanel}>{children}</View>
      </AnimatedPresence>
    </View>
  );
}

/** Une ligne du panneau : pastille de couleur (optionnelle) + phrase factuelle. */
function HowRow({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <View style={s.howRow}>
      {color ? <View style={[s.howDot, { backgroundColor: color }]} /> : null}
      <Text style={s.howText}>{children}</Text>
    </View>
  );
}

/** Légende compacte : une pastille + un libellé par donnée, dans SA couleur. */
function HowLegend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <View style={s.howLegendWrap}>
      {items.map((it) => (
        <View key={it.label} style={s.howLegendItem}>
          <View style={[s.howLegendDot, { backgroundColor: it.color }]} />
          <Text style={[s.howLegendTxt, { color: it.color }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function GhostCta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={s.ctaGhost}>
      <Text style={s.ctaGhostTxt}>{label}</Text>
    </PressableScale>
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

/**
 * Breakdown d'une analyse DÉJÀ persistée, uniquement s'il est intégralement
 * réel — sinon `null`, et la lecture du coach se masque.
 *
 * Une composante nulle en base ne se comble pas. Et un breakdown complet ne
 * suffit pas : les analyses écrites avant le durcissement Valencia ont pu
 * figer un 100/100/100/100 fabriqué sur une séance non close (`max_g_lateral`
 * absent) ou sans tours — le G latéral de séance et le nombre de tours sont
 * donc vérifiés à la source, sur la session elle-même.
 */
function realBreakdownOf(
  analysis: SessionAnalysis,
  session: TelemetrySession
): ResolvedMarginBreakdown | null {
  if (session.max_g_lateral == null) return null;
  if (session.lap_count < 2) return null;
  const { marginVehicle, marginPilot } = analysis;
  const regularity = analysis.breakdown?.regularity;
  const smoothness = analysis.breakdown?.smoothness;
  if (marginVehicle == null || marginPilot == null) return null;
  if (typeof regularity !== 'number' || typeof smoothness !== 'number') return null;
  return { vehicle: marginVehicle, pilot: marginPilot, regularity, smoothness };
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
        <PressableScale
          accessibilityRole="button"
          hitSlop={theme.hitSlop}
          onPress={() => router.back()}
          style={[s.backHit, { marginTop: spacing.xxl * 1.5 }]}
        >
          <Text style={s.back}>Retour à l&apos;accueil</Text>
        </PressableScale>
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
        <PressableScale
          accessibilityRole="button"
          hitSlop={theme.hitSlop}
          onPress={() => router.back()}
          style={s.backHit}
        >
          <Text style={s.back}>Retour</Text>
        </PressableScale>
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
  // Ligne de lecture (build 23) : dit ce qu'on regarde, en une phrase simple.
  lectureLine: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.55,
    marginTop: spacing.sm,
  },
  // Libellé vulgarisé du mini-graphe — le terme technique reste entre parenthèses.
  dispersionCaption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.eyebrow,
    marginBottom: spacing.xs,
  },
  // « Comment lire cet écran » — affordance fine + panneau sobre.
  howBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 44,
  },
  howLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  howChevron: { fontFamily: fonts.body, fontSize: 16, color: palette.creamMute },
  howChevronOpen: { transform: [{ rotate: '90deg' }] },
  howPanel: { gap: spacing.sm, paddingBottom: spacing.xs },
  howRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: spacing.sm },
  howDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  howText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.55,
  },
  howLegendWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  howLegendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  howLegendDot: { width: 7, height: 7, borderRadius: 4 },
  howLegendTxt: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6 },
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
  // Pilier (2 niveaux, maquette) : rangée pastille+nom+chip, puis barre dessous.
  pillarHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pillarDot: { width: 8, height: 8, borderRadius: 4 },
  pillarLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },
  pillarTrack: {
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
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: palette.card2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  momentTitle: {
    fontFamily: fonts.monoMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
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
  exportError: {
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
