/**
 * Écran Signature de pilotage — pilier §3.1 du cahier OXV Mirror.
 *
 * Un portrait factuel et neutre du style du pilote sur une session :
 * nature du freinage, engagement latéral, réaccélération, régularité,
 * virages de prédilection. Aucune note, aucun classement.
 *
 * « Une empreinte personnelle, unique à chaque pilote — le miroir
 * descriptif par excellence. »
 *
 * Sécurité : RLS owner (la session appartient au pilote courant). Lit
 * app_segment_analyses + laps via les services existants.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { FadeInSection } from '@/components/motion';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { type PilotSignature, computeSignature } from '@/services/pilotSignatureService';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function SignatureScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [signature, setSignature] = useState<PilotSignature | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      // Résout la session cible (param ou dernière complétée)
      let sessionId = params.sessionId;
      if (!sessionId) {
        const { data: row } = await supabase
          .from('telemetry_sessions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        sessionId = (row as { id?: string } | null)?.id;
      }
      if (!sessionId || cancelled) {
        setLoading(false);
        return;
      }

      const [segments, laps] = await Promise.all([
        listSegmentAnalysesForSession(sessionId),
        fetchSessionLaps(sessionId),
      ]);
      if (cancelled) return;

      // Temps de tour valides uniquement (pas outlap/inlap)
      const lapTimesSeconds = laps
        .filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0)
        .map((l) => l.duration_seconds);

      const sig = computeSignature({
        segments: segments.map((s) => ({
          segmentIndex: s.segmentIndex,
          segmentName: s.segmentName,
          kind: s.kind,
          entrySpeedKmh: s.entrySpeedKmh,
          apexSpeedKmh: s.apexSpeedKmh,
          exitSpeedKmh: s.exitSpeedKmh,
          maxGLateral: s.maxGLateral,
          maxGBraking: s.maxGBraking,
          marginPercent: s.marginPercent,
        })),
        lapTimesSeconds,
      });
      setSignature(sig);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

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

  const hasContent = signature && signature.traits.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>
          SIGNATURE DE PILOTAGE
        </Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Votre empreinte.
        </Text>

        {!hasContent ? (
          <View
            style={{
              padding: spacing.xxl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
            }}
          >
            <Text
              style={[
                typography.manifest,
                { color: colors.text.tertiary, textAlign: 'center', fontStyle: 'italic' },
              ]}
            >
              Pas encore assez de données pour dessiner votre signature.
            </Text>
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.text.tertiary,
                fontSize: fontSize.caption,
                textAlign: 'center',
              }}
            >
              Elle se précise après quelques tours analysés.
            </Text>
          </View>
        ) : (
          <>
            {/* Manifeste */}
            {signature.manifest ? (
              <FadeInSection>
                <Text
                  style={[
                    typography.manifest,
                    {
                      textAlign: 'center',
                      marginBottom: spacing.huge,
                      paddingHorizontal: spacing.md,
                      color: colors.text.secondary,
                    },
                  ]}
                >
                  {signature.manifest}
                </Text>
              </FadeInSection>
            ) : null}

            {/* Traits */}
            <View style={{ gap: spacing.md }}>
              {signature.traits.map((trait, i) => (
                <FadeInSection key={trait.key} delay={120 + i * 90}>
                  <View
                    style={{
                      padding: spacing.lg,
                      borderRadius: borderRadius.lg,
                      borderWidth: 0.5,
                      borderColor: colors.border.subtle,
                      backgroundColor: colors.background.secondary,
                    }}
                  >
                    <Text
                      style={[
                        typography.eyebrow,
                        { color: colors.text.tertiary, marginBottom: spacing.xs },
                      ]}
                    >
                      {trait.label.toUpperCase()}
                    </Text>
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: fontSize.titleLarge,
                        fontWeight: fontWeight.light,
                      }}
                    >
                      {trait.value}
                    </Text>
                    {trait.detail ? (
                      <Text
                        style={{
                          color: colors.text.tertiary,
                          fontSize: fontSize.caption,
                          marginTop: spacing.xs,
                          fontFamily: 'Menlo',
                        }}
                      >
                        {trait.detail}
                      </Text>
                    ) : null}
                  </View>
                </FadeInSection>
              ))}
            </View>

            {/* Virages de prédilection */}
            {signature.comfortCorners.length > 0 ? (
              <FadeInSection delay={120 + signature.traits.length * 90}>
                <View
                  style={{
                    marginTop: spacing.xl,
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    borderWidth: 0.5,
                    borderColor: colors.border.subtle,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <Text
                    style={[
                      typography.eyebrow,
                      { color: colors.text.tertiary, marginBottom: spacing.sm },
                    ]}
                  >
                    VOS VIRAGES LES PLUS CONFORTABLES
                  </Text>
                  {signature.comfortCorners.map((c) => (
                    <View
                      key={c.segmentIndex}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
                        {c.segmentName ?? `Virage ${c.segmentIndex}`}
                      </Text>
                      <Text
                        style={{
                          color: colors.margin.green,
                          fontSize: fontSize.body,
                          fontWeight: fontWeight.medium,
                          fontFamily: 'Menlo',
                        }}
                      >
                        {Math.round(c.marginPercent)} %
                      </Text>
                    </View>
                  ))}
                </View>
              </FadeInSection>
            ) : null}

            {/* Rappel doctrinal sobre */}
            <Text
              style={[
                typography.caption,
                {
                  marginTop: spacing.xxl,
                  textAlign: 'center',
                  color: colors.text.tertiary,
                  fontStyle: 'italic',
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              Un portrait, pas un verdict. À vous d&apos;en faire ce que vous voulez.
            </Text>
          </>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
