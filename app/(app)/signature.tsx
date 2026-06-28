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
 *
 * Refonte gaming « cockpit factuel » : panneaux + filets, libellés mono,
 * primitif EmptyState honnête. Les « virages confortables » sont listés
 * par leur nom (or Heritage = registre virage) avec leur marge chiffrée
 * — un repère factuel, pas un classement imposé. Le tracé (CircuitTraceHero)
 * reste inchangé.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CircuitTraceHero } from '@/circuit/CircuitTraceHero';
import { FadeInSection } from '@/components/motion';
import { RadarEmpreinte } from '@/components/signature/RadarEmpreinte';
import { EmptyState } from '@/components/instruments';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { type PilotSignature, computeSignature } from '@/services/pilotSignatureService';
import {
  type SignatureSnapshot,
  listMySnapshots,
  setSnapshotShared,
  upsertSnapshotForSession,
} from '@/services/pilotSignatureSnapshotService';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

export default function SignatureScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [signature, setSignature] = useState<PilotSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Empreinte consolidée : la mémoire descriptive du miroir, séance après séance.
  const [snapshots, setSnapshots] = useState<SignatureSnapshot[]>([]);

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

      // Fige l'empreinte de cette séance (mémoire du miroir) puis charge la
      // tendance descriptive des dernières séances. Best effort : n'affecte pas
      // l'affichage de la signature courante.
      if (sig.traits.length > 0) {
        await upsertSnapshotForSession(resolvedId);
        if (cancelled) return;
        const snaps = await listMySnapshots(8);
        if (!cancelled) setSnapshots(snaps);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  async function onToggleShare(snap: SignatureSnapshot, next: boolean) {
    setSnapshots((prev) =>
      prev.map((s) => (s.id === snap.id ? { ...s, sharedWithCoach: next } : s))
    );
    const res = await setSnapshotShared(snap.id, next);
    if (!res.ok) setSnapshots(await listMySnapshots(8));
  }

  function snapDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function traitValue(snap: SignatureSnapshot, key: string): string | null {
    return snap.traits.find((t) => t.key === key)?.value ?? null;
  }

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
          <EmptyState
            message="Votre signature se dessine à partir de la trace de vos tours. Elle apparaîtra après votre premier roulage analysé."
            source="telemetry_frames · segment_analyses"
          />
        ) : (
          <>
            {/* Manifeste */}
            {signature.manifest ? (
              <FadeInSection>
                <Text style={s.manifest}>{signature.manifest}</Text>
              </FadeInSection>
            ) : null}

            {/* Empreinte radar — le visuel dominant (silhouette factuelle 5 axes) */}
            <FadeInSection delay={80}>
              <View style={{ marginBottom: theme.spacing.xl }}>
                <RadarEmpreinte axes={signature.axes} />
              </View>
            </FadeInSection>

            {/* Traits — le détail mesuré sous la silhouette */}
            <View style={{ gap: theme.spacing.md }}>
              {signature.traits.map((trait, i) => (
                <FadeInSection key={trait.key} delay={120 + i * 90}>
                  <View
                    style={s.traitPanel}
                    accessible
                    accessibilityLabel={`${trait.label} : ${trait.value}${trait.detail ? `. ${trait.detail}` : ''}`}
                  >
                    <Text style={s.eyebrow}>{trait.label}</Text>
                    <Text style={s.traitValue}>{trait.value}</Text>
                    {trait.detail ? <Text style={s.traitDetail}>{trait.detail}</Text> : null}
                  </View>
                </FadeInSection>
              ))}
            </View>

            {/* Virages de prédilection */}
            {signature.comfortCorners.length > 0 ? (
              <FadeInSection delay={120 + signature.traits.length * 90}>
                <View style={{ marginTop: theme.spacing.xl }}>
                  <View style={s.cornerPanel}>
                    <Text style={s.eyebrow}>Vos virages les plus confortables</Text>
                    <View style={{ marginTop: theme.spacing.sm }}>
                      {signature.comfortCorners.map((c) => (
                        <View
                          key={c.segmentIndex}
                          style={s.cornerRow}
                          accessible
                          accessibilityLabel={`${c.segmentName ?? `Virage ${c.segmentIndex}`} : ${Math.round(c.marginPercent)} % de marge`}
                        >
                          <Text style={s.cornerName}>
                            {c.segmentName ?? `Virage ${c.segmentIndex}`}
                          </Text>
                          <Text style={s.cornerValue}>{Math.round(c.marginPercent)} %</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </FadeInSection>
            ) : null}

            {/* Empreinte dans le temps — la mémoire descriptive du miroir. Des
                constats juxtaposés, JAMAIS une flèche ni une courbe de progression
                (la seule courbe temporelle reste le best-lap de Progression). */}
            {snapshots.length >= 2 ? (
              <FadeInSection delay={140 + signature.traits.length * 90}>
                <View style={{ marginTop: theme.spacing.xxl }}>
                  <Text style={s.eyebrow}>Votre empreinte dans le temps</Text>
                  <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
                    {snapshots.map((snap) => {
                      const braking = traitValue(snap, 'braking');
                      const lateral = traitValue(snap, 'lateral');
                      return (
                        <View key={snap.id} style={s.snapPanel}>
                          <Text style={s.snapDate}>{snapDate(snap.computedAt)}</Text>
                          <Text style={s.snapLine}>
                            Tours {snap.regularityBand ?? '—'}
                            {braking ? ` · freinage ${braking}` : ''}
                            {lateral ? ` · engagement ${lateral}` : ''}
                          </Text>
                          <View style={s.snapShareRow}>
                            <Text style={s.snapShareLabel}>Partagée avec mon coach</Text>
                            <Switch
                              value={snap.sharedWithCoach}
                              onValueChange={(v) => onToggleShare(snap, v)}
                              accessibilityRole="switch"
                              accessibilityLabel="Partager cette empreinte avec mon coach"
                              accessibilityState={{ checked: snap.sharedWithCoach }}
                              trackColor={{ false: '#26262B', true: theme.palette.gold }}
                              thumbColor={theme.palette.cream}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={s.snapFootnote}>
                    Des constats, séance après séance — pas une note d&apos;évolution.
                  </Text>
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
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    letterSpacing: 0.5,
    color: theme.palette.heritageGold,
  },
  cornerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.xs,
  },
  cornerValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
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
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  traitPanel: {
    backgroundColor: theme.palette.card2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.line,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  cornerPanel: {
    backgroundColor: theme.palette.card2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.line,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  snapPanel: {
    backgroundColor: theme.palette.card2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.line,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  snapDate: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  snapLine: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  snapShareRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  snapShareLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  snapFootnote: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
};
