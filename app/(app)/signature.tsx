/**
 * Écran Signature de pilotage — pilier §3.1 du cahier OXV Mirror. Design V2.
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
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel du kit. Le tracé
 * (CircuitTraceHero) et ses couches restent inchangés.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CircuitTraceHero } from '@/circuit/CircuitTraceHero';
import { FadeInSection } from '@/components/motion';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { type PilotSignature, computeSignature } from '@/services/pilotSignatureService';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function SignatureScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [signature, setSignature] = useState<PilotSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      // Résout la session cible (param ou dernière complétée)
      let resolvedId = params.sessionId;
      if (!resolvedId) {
        const { data: row } = await supabase
          .from('telemetry_sessions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedId = (row as { id?: string } | null)?.id;
      }
      if (!resolvedId || cancelled) {
        setLoading(false);
        return;
      }
      setSessionId(resolvedId);

      const [segments, laps] = await Promise.all([
        listSegmentAnalysesForSession(resolvedId),
        fetchSessionLaps(resolvedId),
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
      <Screen scroll={false}>
        <AppBar title="SIGNATURE" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const hasContent = signature && signature.traits.length > 0;

  return (
    <Screen>
      <AppBar title="SIGNATURE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Votre empreinte.</Text>

        {/* Tracé : où la signature s'exprime sur la piste (specs v4 §05 §4.2).
            Couche d'entrée Vitesse d'apex ; le pilote bascule vers Anatomie freinage. */}
        <FadeInSection style={{ marginBottom: theme.spacing.xl }}>
          <CircuitTraceHero sessionId={sessionId ?? undefined} defaultLayer="apexSpeed" />
        </FadeInSection>

        {!hasContent ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyTitle}>
              Pas encore assez de données pour dessiner votre signature.
            </Text>
            <Text style={s.emptyHint}>Elle se précise après quelques tours analysés.</Text>
          </Card>
        ) : (
          <>
            {/* Manifeste */}
            {signature.manifest ? (
              <FadeInSection>
                <Text style={s.manifest}>{signature.manifest}</Text>
              </FadeInSection>
            ) : null}

            {/* Traits */}
            <View style={{ gap: theme.spacing.md }}>
              {signature.traits.map((trait, i) => (
                <FadeInSection key={trait.key} delay={120 + i * 90}>
                  <Card>
                    <SectionLabel>{trait.label}</SectionLabel>
                    <Text style={s.traitValue}>{trait.value}</Text>
                    {trait.detail ? <Text style={s.traitDetail}>{trait.detail}</Text> : null}
                  </Card>
                </FadeInSection>
              ))}
            </View>

            {/* Virages de prédilection */}
            {signature.comfortCorners.length > 0 ? (
              <FadeInSection delay={120 + signature.traits.length * 90}>
                <View style={{ marginTop: theme.spacing.xl }}>
                  <Card>
                    <SectionLabel>Vos virages les plus confortables</SectionLabel>
                    <View style={{ marginTop: theme.spacing.sm }}>
                      {signature.comfortCorners.map((c) => (
                        <View
                          key={c.segmentIndex}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            paddingVertical: theme.spacing.xs,
                          }}
                        >
                          <Text style={s.cornerName}>
                            {c.segmentName ?? `Virage ${c.segmentIndex}`}
                          </Text>
                          <Text style={s.cornerValue}>{Math.round(c.marginPercent)} %</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                </View>
              </FadeInSection>
            ) : null}

            {/* Rappel doctrinal sobre */}
            <Text style={s.doctrine}>
              Un portrait, pas un verdict. À vous d&apos;en faire ce que vous voulez.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  traitValue: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.3,
    color: theme.palette.cream,
    marginTop: theme.spacing.xs,
  },
  traitDetail: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  cornerName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  cornerValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.dataColors.accel,
  },
  doctrine: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xxl,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
};
