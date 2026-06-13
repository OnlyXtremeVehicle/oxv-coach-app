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
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useLocalSearchParams } from 'expo-router';

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
import { type ComputeMarginOutput, computeMargin } from '@/services/marginCalculator';
import { type RegularityBand, computeRegularity } from '@/services/regularityService';
import { fetchPreviousSessions, fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import type { TelemetrySession } from '@/types/telemetry';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort, formatLapTime } from '@/utils/format';

interface NavTarget {
  label: string;
  href: string;
}

const NAV_TARGETS: NavTarget[] = [
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

        // Persiste en arrière-plan, l'échec ne bloque pas l'affichage.
        upsertAnalysis({
          telemetrySessionId: targetSession.id,
          userId: profile.id,
          result,
        }).catch(() => undefined);
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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return <BilanError message={error} />;
  }

  if (!session || !margin) {
    return <BilanEmpty />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>BILAN DE SESSION</Text>

        {/* Héros « Le Sillage » — le fait saillant de la séance, situé dans le
            fil du pilote (soi contre soi). Valeur en couleur DONNÉE (crème),
            jamais un rouge de verdict (doctrine 01:69). */}
        <FadeInSection
          style={{ alignItems: 'center', marginTop: spacing.xxxl, marginBottom: spacing.giant }}
        >
          <Text
            style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.lg }]}
          >
            VOTRE MEILLEUR TOUR
          </Text>
          <Text
            style={[
              typography.heroNumber,
              { color: colors.text.primary, marginBottom: spacing.lg },
            ]}
          >
            {salient?.bestSeconds != null ? formatLapTime(salient.bestSeconds) : '—'}
          </Text>

          {salient ? (
            salient.prevBestSeconds != null ? (
              <>
                <Text
                  style={[
                    typography.screenTitle,
                    {
                      color: colors.text.secondary,
                      textAlign: 'center',
                      fontWeight: fontWeight.light,
                    },
                  ]}
                >
                  Votre {salient.sessionsHere}ᵉ séance ici.
                </Text>
                <Text
                  style={{
                    color: colors.text.tertiary,
                    fontSize: fontSize.body,
                    textAlign: 'center',
                    marginTop: spacing.sm,
                  }}
                >
                  Précédente : {formatLapTime(salient.prevBestSeconds)}
                  {salient.prevDate ? ` · ${formatDateShort(salient.prevDate)}` : ''}
                </Text>
                {salient.bestSeconds != null ? (
                  <Text
                    style={{
                      color: colors.text.secondary,
                      fontSize: fontSize.body,
                      fontFamily: 'Menlo',
                      marginTop: spacing.md,
                    }}
                  >
                    {formatDeltaSeconds(salient.bestSeconds - salient.prevBestSeconds)} par rapport
                    à votre dernière venue.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text
                style={[
                  typography.screenTitle,
                  {
                    color: colors.text.secondary,
                    textAlign: 'center',
                    fontWeight: fontWeight.light,
                  },
                ]}
              >
                Première séance sur ce circuit. Le fil commence ici.
              </Text>
            )
          ) : null}

          {salient && salient.band && salient.spreadSeconds != null && salient.lapCount >= 2 ? (
            <Text
              style={{
                color: colors.text.tertiary,
                fontSize: fontSize.caption,
                textAlign: 'center',
                marginTop: spacing.lg,
              }}
            >
              Vos {salient.lapCount} tours tiennent dans{' '}
              {salient.spreadSeconds.toFixed(1).replace('.', ',')} s.
            </Text>
          ) : null}
        </FadeInSection>

        {/* Contexte du coach (§10.3) — ce que le capteur ne capte pas. */}
        {contextRows.length > 0 ? (
          <FadeInSection
            style={{
              marginBottom: spacing.huge,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.accent.coach,
              backgroundColor: colors.background.secondary,
            }}
          >
            <Text
              style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}
            >
              LE CONTEXTE DE VOTRE COACH
            </Text>
            <View style={{ gap: spacing.md }}>
              {contextRows.map((row) => (
                <View key={row.label}>
                  <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                    {row.label}
                  </Text>
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: fontSize.body,
                      marginTop: 2,
                      lineHeight: fontSize.body * 1.4,
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </FadeInSection>
        ) : null}

        {/* Priorisation du coach (§10.3c-B) — ordre de lecture proposé. */}
        {highlights.map((h) => (
          <FadeInSection
            key={h.id}
            style={{
              marginBottom: spacing.huge,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.accent.coach,
              backgroundColor: colors.background.secondary,
            }}
          >
            <Text
              style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}
            >
              MIS EN AVANT PAR VOTRE COACH
            </Text>
            {h.note ? (
              <Text
                style={{
                  color: colors.text.secondary,
                  fontSize: fontSize.body,
                  fontStyle: 'italic',
                  lineHeight: fontSize.body * 1.5,
                  marginBottom: h.highlightCornerIndexes.length > 0 ? spacing.md : 0,
                }}
              >
                « {h.note} »
              </Text>
            ) : null}
            <View style={{ gap: spacing.sm }}>
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
                    gap: spacing.md,
                    paddingVertical: spacing.sm,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.accent.coach,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.medium,
                      fontFamily: 'Menlo',
                    }}
                  >
                    {i + 1}.
                  </Text>
                  <Text style={{ color: colors.text.primary, fontSize: fontSize.body, flex: 1 }}>
                    {getCorner(idx)?.name ?? `Virage ${idx}`}
                  </Text>
                  <Text style={{ color: colors.text.tertiary, fontSize: fontSize.body }}>›</Text>
                </Pressable>
              ))}
            </View>
          </FadeInSection>
        ))}

        {/* La lecture de votre coach (§10.3c-D) — dérivée des sous-composantes,
            présentée SÉPARÉMENT et attribuée. Jamais à la place de la marge OXV. */}
        {readingWeights.map((w) => {
          const reading = computeCoachReading(margin.breakdown, w);
          if (reading === null) return null;
          return (
            <FadeInSection
              key={w.coachId}
              style={{
                marginBottom: spacing.huge,
                padding: spacing.xl,
                borderRadius: borderRadius.lg,
                borderWidth: 0.5,
                borderColor: colors.accent.coach,
                backgroundColor: colors.background.secondary,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>
                LA LECTURE DE VOTRE COACH
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: 40,
                  fontWeight: fontWeight.light,
                  fontFamily: 'Menlo',
                  marginTop: spacing.sm,
                }}
              >
                {reading}%
              </Text>
              {w.note ? (
                <Text
                  style={{
                    color: colors.text.secondary,
                    fontSize: fontSize.caption,
                    fontStyle: 'italic',
                    textAlign: 'center',
                    marginTop: spacing.sm,
                    lineHeight: fontSize.caption * 1.5,
                  }}
                >
                  « {w.note} »
                </Text>
              ) : null}
              <Text
                style={{
                  color: colors.text.tertiary,
                  fontSize: fontSize.caption,
                  textAlign: 'center',
                  marginTop: spacing.sm,
                }}
              >
                La grille de lecture de votre coach, à côté de la marge OXV — pas à sa place.
              </Text>
            </FadeInSection>
          );
        })}

        <View style={{ gap: spacing.md }}>
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
            style={({ pressed }) => ({
              marginTop: spacing.xl,
              padding: spacing.lg,
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.border.medium,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
              opacity: pressed || exporting ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.medium,
              }}
            >
              {exporting ? 'Préparation du PDF…' : 'Partager mon bilan en PDF'}
            </Text>
          </Pressable>
        ) : null}

        {/* CTA Côte à côte — comparer avec un copain (entre amis, pas du coaching) */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/amis' as never)}
          style={({ pressed }) => ({
            marginTop: spacing.md,
            padding: spacing.lg,
            borderRadius: borderRadius.md,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            Comparer avec un copain
          </Text>
        </Pressable>

        {/* CTA Souvenirs — médias OXV de la session */}
        {session?.id ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/session-media/${session.id}` as never)}
            style={({ pressed }) => ({
              marginTop: spacing.sm,
              padding: spacing.lg,
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              alignItems: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.regular,
              }}
            >
              Voir mes souvenirs de session
            </Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
        style={({ pressed }) => ({
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xl,
          borderRadius: borderRadius.lg,
          borderWidth: 0.5,
          borderColor: colors.border.subtle,
          backgroundColor: colors.background.secondary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.regular,
          }}
        >
          {label}
        </Text>
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.body }}>›</Text>
      </Pressable>
    </Link>
  );
}

function BilanEmpty() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View
        style={{
          flex: 1,
          padding: spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>BILAN</Text>
        <Text style={[typography.screenTitle, { textAlign: 'center', marginBottom: spacing.xl }]}>
          Aucune session encore.
        </Text>
        <Text style={[typography.manifest, { textAlign: 'center', paddingHorizontal: spacing.md }]}>
          Votre première session écrira la première ligne.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ marginTop: spacing.xxxl }}
        >
          <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
            Retour à l'accueil
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function BilanError({ message }: { message: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
        <Text
          style={[typography.eyebrow, { color: colors.system.error, marginBottom: spacing.md }]}
        >
          ERREUR
        </Text>
        <Text style={[typography.screenTitle, { marginBottom: spacing.lg }]}>
          Le bilan n'a pas pu être chargé.
        </Text>
        <Text
          style={[typography.body, { color: colors.text.secondary, marginBottom: spacing.xxl }]}
        >
          {message}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
