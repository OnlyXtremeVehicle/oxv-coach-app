/**
 * Écran #13 — Bilan de session.
 *
 * Premier vrai écran d'analyse OXV. Lit la session cible (param sessionId
 * ou la dernière du user), récupère l'analyse en base ou la calcule à la
 * volée via marginCalculator V1, et l'affiche selon la grammaire
 * doctrinale : eyebrow, chiffre central géant, étiquette humaine,
 * phrase manifeste, 4 cards de navigation.
 *
 * Si la session existe mais n'a pas encore d'analyse, on calcule puis
 * on persiste en arrière-plan (best-effort) pour les prochaines ouvertures.
 *
 * Les routes #14/#15/#16/#17 référencées par les cards n'existent pas
 * encore (sem 6-7) — tap → écran +not-found pour l'instant.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Fact du kit, styles via
 * @/theme/v2. Logique, données, navigation, transparence (charte 11),
 * couches coach, tracé (CircuitTraceHero) et export PDF inchangés.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';

import { CircuitTraceHero } from '@/circuit/CircuitTraceHero';
import type { SessionInsights } from '@/circuit/sessionInsights';
import {
  BlindspotsBlock,
  DataQualityBanner,
  ProvenanceLine,
  SourceMethodBlock,
} from '@/components/InsightTransparency';
import { FadeInSection } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession, upsertAnalysis } from '@/services/analysesService';
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
import { type RegularityBand, computeRegularity } from '@/services/regularityService';
import { fetchPreviousSessions, fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import type { TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort, formatLapTime } from '@/utils/format';

interface NavTarget {
  label: string;
  href: string;
}

const NAV_TARGETS: NavTarget[] = [
  { label: 'Débrief présentiel', href: '/(app)/debrief-presentiel' },
  { label: 'Signature de pilotage', href: '/(app)/signature' },
  { label: 'Régularité', href: '/(app)/regularite' },
  { label: 'Carte du circuit', href: '/(app)/carte' },
  { label: 'Carte de chaleur', href: '/(app)/heatmap' },
  { label: 'Détails par virage', href: '/(app)/virage' },
  { label: 'Tour par tour', href: '/(app)/tours' },
  { label: 'Rejouer un tour', href: '/(app)/replay' },
  { label: 'Télémétrie', href: '/(app)/telemetry' },
  { label: 'La prochaine fois', href: '/(app)/prochaine-fois' },
  { label: 'Progression', href: '/(app)/progression' },
];

/**
 * Fait saillant central du bilan (héros « Le Sillage »). Un fait descriptif —
 * le tour de référence — situé dans le fil des séances du pilote sur ce circuit
 * (soi contre soi). Remplace l'ancien score « marge globale % » : un fait, pas
 * un verdict. Couleur de la valeur = donnée, jamais un rouge qui jugerait.
 */
interface SalientFact {
  bestSeconds: number | null;
  lapCount: number;
  spreadSeconds: number | null;
  band: RegularityBand | null;
  /** Rang de cette séance dans le fil du circuit (1 = première). */
  sessionsHere: number;
  /** Meilleur tour de la séance précédente sur ce circuit, pour le delta. */
  prevBestSeconds: number | null;
  prevDate: string | null;
}

/** Delta de temps factuel, signe non-mathématique (« − » U+2212), jamais coloré. */
function formatDeltaSeconds(d: number): string {
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  return `${sign}${Math.abs(d).toFixed(1).replace('.', ',')} s`;
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
  const [salient, setSalient] = useState<SalientFact | null>(null);
  const [insights, setInsights] = useState<SessionInsights | null>(null);

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

        // Persiste en arrière-plan — UNIQUEMENT si le lecteur est le pilote
        // propriétaire. Un coach est en lecture seule (doctrine) et la RLS
        // rejetterait une écriture avec l'id du coach sur la session d'un autre.
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

  // Insights de session (transparence, charte 11) — fiabilité + provenance du
  // calcul. Absents tant que telemetry_frames est vide (avant Valence) : les
  // blocs se masquent alors d'eux-mêmes plutôt que d'inventer une donnée.
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

  // Contexte coach (§10.3) sur cette session — affiché si le coach en a posé.
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

  // Priorisation coach (§10.3c-B) — virages mis en avant pour ce pilote.
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

  // Lecture du coach (§10.3c-D) — pondérations des coachs du pilote.
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

  // Fait saillant (héros « Le Sillage ») : tour de référence + situation soi
  // contre soi dans le fil des séances de ce circuit. Sort de la table `laps`,
  // indépendant des `telemetry_frames` (vides jusqu'à la 1re vraie capture).
  // Phase M : delta calculé côté Supabase ; ici on n'assemble que des chronos
  // déjà en base. Phase L : la frise + le tracé ancré viendront ici.
  useEffect(() => {
    if (!session?.id || !profile?.id) return;
    const sessionId = session.id;
    const circuitId = session.circuit_id;
    const ownBest = session.best_lap_seconds;
    let cancelled = false;
    (async () => {
      const laps = await fetchSessionLaps(sessionId);
      const reg = computeRegularity(
        laps
          .filter((l) => !l.is_outlap && !l.is_inlap)
          .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
      );
      const previous = await fetchPreviousSessions(profile.id, circuitId, 8, sessionId);
      if (cancelled) return;
      const prevWithBest = previous.find((s) => s.best_lap_seconds != null) ?? null;
      setSalient({
        bestSeconds: reg.bestSeconds ?? ownBest ?? null,
        lapCount: reg.lapCount,
        spreadSeconds: reg.spreadSeconds,
        band: reg.band,
        sessionsHere: previous.length + 1,
        prevBestSeconds: prevWithBest?.best_lap_seconds ?? null,
        prevDate: prevWithBest?.started_at ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.circuit_id, session?.best_lap_seconds, profile?.id]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return <BilanError message={error} />;
  }

  if (!session || !margin) {
    return <BilanEmpty />;
  }

  return (
    <Screen>
      <AppBar title="BILAN" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <SectionLabel>BILAN DE SESSION</SectionLabel>

        {/* Fiabilité de la donnée (charte 11, T2) — affichée tôt : si la capture
            est fragile, le pilote le sait avant de lire quoi que ce soit. */}
        {insights?.data_quality ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <DataQualityBanner dataQuality={insights.data_quality} />
          </View>
        ) : null}

        {/* Tracé 3D en héros (specs v4 §05 §4.1) : « je me revois ». Couche par
            défaut Régularité ; géométrie = circuit officiel, couches data si la
            session porte des insights (sinon forme du circuit seule, honnête). */}
        <FadeInSection style={{ marginTop: theme.spacing.xl }}>
          {/* Role-aware : un coach qui consulte la session d'un de ses pilotes voit
              les couches coach + l'attribution (badge or). Le pilote sur sa propre
              session voit les couches pilote. Accès déjà consenti (RLS coach). */}
          <CircuitTraceHero
            sessionId={session.id}
            role={session.user_id === profile?.id ? 'pilot' : 'coach'}
          />
        </FadeInSection>

        {/* Héros « Le Sillage » — le fait saillant de la séance, situé dans le
            fil du pilote (soi contre soi). Valeur en couleur DONNÉE (crème),
            jamais un rouge de verdict (doctrine 01:69). */}
        <FadeInSection
          style={{
            alignItems: 'center',
            marginTop: theme.spacing.xxl * 1.5,
            marginBottom: theme.spacing.xxl * 1.5,
          }}
        >
          <Text style={[s.eyebrow, { marginBottom: theme.spacing.lg }]}>VOTRE MEILLEUR TOUR</Text>
          <Text style={[s.heroNumber, { marginBottom: theme.spacing.lg }]}>
            {salient?.bestSeconds != null ? formatLapTime(salient.bestSeconds) : '—'}
          </Text>

          {salient ? (
            salient.prevBestSeconds != null ? (
              <>
                <Text style={s.heroTitle}>Votre {salient.sessionsHere}ᵉ séance ici.</Text>
                <Text style={s.heroMeta}>
                  Précédente : {formatLapTime(salient.prevBestSeconds)}
                  {salient.prevDate ? ` · ${formatDateShort(salient.prevDate)}` : ''}
                </Text>
                {salient.bestSeconds != null ? (
                  <Text style={s.heroDelta}>
                    {formatDeltaSeconds(salient.bestSeconds - salient.prevBestSeconds)} par rapport
                    à votre dernière venue.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={s.heroTitle}>Première séance sur ce circuit. Le fil commence ici.</Text>
            )
          ) : null}

          {/* Régularité au même rang que le chrono (charte 10, E2) : le temps au
              tour ne doit jamais être le seul chiffre dominant. Même style
              heroNumber → prominence égale. La doctrine « un seul chiffre »
              (CLAUDE.md §5) cède ici devant l'exigence éthique d'équilibre
              vitesse / régularité, plus spécifique et plus récente. */}
          {salient && salient.spreadSeconds != null && salient.lapCount >= 2 ? (
            <View style={{ alignItems: 'center', marginTop: theme.spacing.xxl * 1.5 }}>
              <Text style={[s.eyebrow, { marginBottom: theme.spacing.lg }]}>RÉGULARITÉ</Text>
              <Text style={[s.heroNumber, { marginBottom: theme.spacing.lg }]}>
                {salient.spreadSeconds.toFixed(1).replace('.', ',')} s
              </Text>
              <Text style={s.heroTitle}>L’amplitude de vos {salient.lapCount} tours.</Text>
            </View>
          ) : null}
        </FadeInSection>

        {/* Contexte du coach (§10.3) — ce que le capteur ne capte pas. */}
        {contextRows.length > 0 ? (
          <FadeInSection style={{ marginBottom: theme.spacing.xl }}>
            <Card style={s.coachCard}>
              <Text style={[s.eyebrow, s.coachEyebrow]}>LE CONTEXTE DE VOTRE COACH</Text>
              <View style={{ gap: theme.spacing.md }}>
                {contextRows.map((row) => (
                  <View key={row.label}>
                    <Text style={s.coachRowLabel}>{row.label}</Text>
                    <Text style={s.coachRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </FadeInSection>
        ) : null}

        {/* Priorisation du coach (§10.3c-B) — ordre de lecture proposé. */}
        {highlights.map((h) => (
          <FadeInSection key={h.id} style={{ marginBottom: theme.spacing.xl }}>
            <Card style={s.coachCard}>
              <Text style={[s.eyebrow, s.coachEyebrow]}>MIS EN AVANT PAR VOTRE COACH</Text>
              {h.note ? (
                <Text
                  style={[
                    s.coachNote,
                    { marginBottom: h.highlightCornerIndexes.length > 0 ? theme.spacing.md : 0 },
                  ]}
                >
                  « {h.note} »
                </Text>
              ) : null}
              <View style={{ gap: theme.spacing.sm }}>
                {h.highlightCornerIndexes.map((idx, i) => (
                  <Pressable
                    key={`${h.id}-${idx}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Ouvrir ${getCorner(idx)?.name ?? `virage ${idx}`}`}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/virage',
                        params: { index: String(idx), sessionId: session?.id ?? '' },
                      } as never)
                    }
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={s.coachCornerIndex}>{i + 1}.</Text>
                    <Text style={s.coachCornerName}>{getCorner(idx)?.name ?? `Virage ${idx}`}</Text>
                    <Text style={s.chevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          </FadeInSection>
        ))}

        {/* La lecture de votre coach (§10.3c-D) — dérivée des sous-composantes,
            présentée SÉPARÉMENT et attribuée. Jamais à la place de la marge OXV. */}
        {readingWeights.map((w) => {
          const reading = computeCoachReading(margin.breakdown, w);
          if (reading === null) return null;
          return (
            <FadeInSection key={w.coachId} style={{ marginBottom: theme.spacing.xl }}>
              <Card style={s.coachCardCentered}>
                <Text style={[s.eyebrow, s.coachEyebrow]}>LA LECTURE DE VOTRE COACH</Text>
                <Text style={s.coachReading}>{reading}%</Text>
                {w.note ? (
                  <Text style={[s.coachNote, { textAlign: 'center' }]}>« {w.note} »</Text>
                ) : null}
                <Text style={s.coachReadingHint}>
                  La grille de lecture de votre coach, à côté de la marge OXV — pas à sa place.
                </Text>
              </Card>
            </FadeInSection>
          );
        })}

        <View style={{ gap: theme.spacing.sm }}>
          {NAV_TARGETS.map((target, i) => (
            <FadeInSection key={target.href} delay={150 + i * 80}>
              <NavCard
                label={target.label}
                href={session?.id ? `${target.href}?sessionId=${session.id}` : target.href}
              />
            </FadeInSection>
          ))}
        </View>

        {/* CTA Export PDF */}
        {session?.id ? (
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            onPress={async () => {
              setExporting(true);
              await exportAndShareBilanPdf({ sessionId: session.id });
              setExporting(false);
            }}
            style={({ pressed }) => [
              s.ctaPrimary,
              { marginTop: theme.spacing.lg, opacity: pressed || exporting ? 0.6 : 1 },
            ]}
          >
            <Text style={s.ctaPrimaryTxt}>
              {exporting ? 'Préparation du PDF…' : 'Partager mon bilan en PDF'}
            </Text>
          </Pressable>
        ) : null}

        {/* CTA Côte à côte — comparer avec un copain (entre amis, pas du coaching) */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/amis' as never)}
          style={({ pressed }) => [
            s.ctaGhost,
            { marginTop: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={s.ctaGhostTxt}>Comparer avec un copain</Text>
        </Pressable>

        {/* CTA Souvenirs — médias OXV de la session */}
        {session?.id ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/session-media/${session.id}` as never)}
            style={({ pressed }) => [
              s.ctaGhost,
              { marginTop: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={s.ctaGhostTxt}>Voir mes souvenirs de session</Text>
          </Pressable>
        ) : null}

        {/* CTA Carte trophée — la séance en une image partageable (vers l'extérieur) */}
        {session?.id ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/carte-trophee?sessionId=${session.id}` as never)}
            style={({ pressed }) => [
              s.ctaGhost,
              { marginTop: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={s.ctaGhostTxt}>Carte à partager</Text>
          </Pressable>
        ) : null}

        {/* Transparence (charte 11) — source/méthode (T1), angles morts (T5),
            provenance du calcul (T3). Toujours visibles : la méthode et les
            limites ne sont pas une option. La provenance ne s'affiche que si la
            session porte des insights calculés. */}
        <FadeInSection style={{ marginTop: theme.spacing.xxl * 1.5 }}>
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
        </FadeInSection>

        <View style={{ marginTop: theme.spacing.xxl * 1.5, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.back}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
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

function NavCard({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        onPressIn={() => haptics.tap()}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Card style={s.navCard}>
          <Text style={s.navLabel}>{label}</Text>
          <Text style={s.chevron}>›</Text>
        </Card>
      </Pressable>
    </Link>
  );
}

function BilanEmpty() {
  return (
    <Screen scroll={false}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[s.eyebrow, { marginBottom: theme.spacing.lg }]}>BILAN</Text>
        <Text style={[s.emptyTitle, { marginBottom: theme.spacing.xl }]}>
          Aucune session encore.
        </Text>
        <Text style={s.manifest}>Votre première session écrira la première ligne.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ marginTop: theme.spacing.xxl * 1.5 }}
        >
          <Text style={s.back}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function BilanError({ message }: { message: string }) {
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, justifyContent: 'center' }}>
        <Text style={[s.eyebrow, s.errorEyebrow]}>ERREUR</Text>
        <Text style={[s.emptyTitle, { marginBottom: theme.spacing.lg }]}>
          Le bilan n'a pas pu être chargé.
        </Text>
        <Text style={s.errorBody}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={s.back}>Retour</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  heroNumber: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.hud,
    letterSpacing: -1,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  heroTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.h3 * 1.3,
  },
  heroMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  heroDelta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
  },
  coachCard: {
    borderColor: theme.palette.coach,
  },
  coachCardCentered: {
    borderColor: theme.palette.coach,
    alignItems: 'center' as const,
  },
  coachEyebrow: {
    color: theme.palette.coach,
    marginBottom: theme.spacing.md,
  },
  coachRowLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  coachRowValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    marginTop: 2,
    lineHeight: theme.fontSize.body * 1.4,
  },
  coachNote: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.body,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
  },
  coachCornerIndex: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.coach,
  },
  coachCornerName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    flex: 1,
  },
  coachReading: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  coachReadingHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  navCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  navLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  chevron: {
    color: theme.palette.creamMute,
    fontSize: 18,
  },
  ctaPrimary: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
    alignItems: 'center' as const,
  },
  ctaPrimaryTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  ctaGhost: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
  },
  ctaGhostTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  emptyTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.md,
  },
  errorEyebrow: {
    color: theme.palette.red,
    marginBottom: theme.spacing.md,
  },
  errorBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.xxl,
    lineHeight: theme.fontSize.body * 1.4,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
