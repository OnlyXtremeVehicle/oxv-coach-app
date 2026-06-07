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

import { CountUpNumber, FadeInSection } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession, upsertAnalysis } from '@/services/analysesService';
import { exportAndShareBilanPdf } from '@/services/bilanPdfExportService';
import { getCorner } from '@/lib/circuitTopology';
import { buildContextRows } from '@/services/coachContextLogic';
import { type CoachPilotHighlight } from '@/services/coachCurationLogic';
import { listHighlightsForMe } from '@/services/coachCurationService';
import { getSessionContext } from '@/services/coachSessionContextService';
import { type ComputeMarginOutput, computeMargin } from '@/services/marginCalculator';
import { fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import type { TelemetrySession } from '@/types/telemetry';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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

        <FadeInSection
          style={{ alignItems: 'center', marginTop: spacing.xxxl, marginBottom: spacing.giant }}
        >
          <CountUpNumber
            value={margin.marginGlobal}
            duration={1100}
            suffix="%"
            style={[
              typography.heroNumber,
              { color: colorForZone(margin.marginZone), marginBottom: spacing.lg },
            ]}
          />
          <Text
            style={[
              typography.screenTitle,
              {
                color: colorForZone(margin.marginZone),
                textAlign: 'center',
                fontWeight: fontWeight.light,
              },
            ]}
          >
            {marginLabelOf(margin.marginZone)}
          </Text>
        </FadeInSection>

        <Text
          style={[
            typography.manifest,
            { textAlign: 'center', marginBottom: spacing.huge, paddingHorizontal: spacing.md },
          ]}
        >
          {manifestForMargin(margin)}
        </Text>

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

function colorForZone(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return colors.margin.green;
    case 'yellow':
      return colors.margin.yellow;
    case 'red':
      return colors.margin.red;
  }
}

function manifestForMargin(margin: ComputeMarginOutput): string {
  switch (margin.marginZone) {
    case 'green':
      return 'Belle séance. Vous avez du terrain à explorer en sécurité.';
    case 'yellow':
      return 'Belle séance. Une zone à creuser la prochaine fois.';
    case 'red':
      return "Vous avez touché vos limites. C'est noté.";
  }
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
