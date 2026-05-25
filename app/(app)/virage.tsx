/**
 * Écran #15 — Zoom virage (deep-dive).
 *
 * Vue détaillée d'un virage avec, dans l'ordre :
 *   1. Carte zoomée sur l'apex + trajectoire GPS du pilote
 *   2. Vitesses (entrée, min, apex, sortie) + delta entrée → sortie
 *   3. Forces vécues — G latéral, freinage, accélération (barres)
 *   4. Trajectoire — écart latéral moyen + max au tracé de référence
 *   5. Question ouverte (manifeste doctrine)
 *
 * Le pilote pro y lit les chiffres bruts, le particulier voit les
 * formes (longueur des barres, couleur de la marge). Lecture seule —
 * l'app décrit, ne juge pas.
 *
 * Bouton « Comparer ce virage » → ouvre virage-comparer.tsx avec un
 * picker pour choisir une 2e session.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import {
  CircuitMap,
  CornersLayer,
  TrackLayer,
  TrajectoryLayer,
  getCornerViewBox,
} from '@/components/CircuitMap';
import { GForceBars } from '@/components/GForceBars';
import { getCorner, nextCornerIndex, previousCornerIndex } from '@/lib/circuitTopology';
import { supabase } from '@/lib/supabase';
import {
  type CoachAnnotation,
  listVisibleAnnotationsForCorner,
} from '@/services/coachAnnotationsService';
import { type CornerDeepDive, loadCornerDeepDive } from '@/services/cornerDeepDiveService';
import { useAuthStore } from '@/store/useAuthStore';
import { type MarginZone, marginLabelOf, marginZoneOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function VirageScreen() {
  const params = useLocalSearchParams<{ index?: string; sessionId?: string }>();
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);

  const [deepDive, setDeepDive] = useState<CornerDeepDive | null>(null);
  const [annotations, setAnnotations] = useState<CoachAnnotation[]>([]);
  const [sessionPilotId, setSessionPilotId] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const isCoach = profile?.role === 'coach' || profile?.role === 'admin';

  useEffect(() => {
    if (!params.sessionId || !corner) return;
    let cancelled = false;
    loadCornerDeepDive(params.sessionId, corner.index).then((d) => {
      if (!cancelled) setDeepDive(d);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, corner]);

  // Charge les annotations partagées par les coachs de ce pilote
  useEffect(() => {
    if (!profile?.id || !corner) return;
    let cancelled = false;
    listVisibleAnnotationsForCorner(profile.id, corner.index, params.sessionId ?? null).then(
      (rows) => {
        if (!cancelled) setAnnotations(rows);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [profile?.id, corner, params.sessionId]);

  // Côté coach : récupère l'id du pilote propriétaire de la session
  // pour pouvoir l'annoter. RLS protège (un coach ne lit que les sessions
  // d'un pilote qu'il suit).
  useEffect(() => {
    if (!isCoach || !params.sessionId) return;
    const sessionId = params.sessionId; // narrow avant async closure
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (!cancelled && data) setSessionPilotId(data.user_id as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCoach, params.sessionId]);

  if (!corner) {
    return <VirageNotFound />;
  }

  const stats = deepDive?.stats ?? null;
  const trajectory = deepDive?.trajectory ?? [];

  const onPrev = () => {
    router.replace({
      pathname: '/(app)/virage',
      params: {
        index: String(previousCornerIndex(cornerIndex)),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  const onNext = () => {
    router.replace({
      pathname: '/(app)/virage',
      params: {
        index: String(nextCornerIndex(cornerIndex)),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  const onCompare = () => {
    router.push({
      pathname: '/(app)/virage-comparer',
      params: {
        index: String(cornerIndex),
        sessionA: params.sessionId ?? '',
      },
    } as never);
  };

  const zone: MarginZone =
    stats?.marginZone ??
    (stats?.marginPercent !== null && stats?.marginPercent !== undefined
      ? marginZoneOf(stats.marginPercent)
      : 'yellow');

  const trajectoryPoints =
    trajectory.length > 1
      ? trajectory.map((p) => ({ lat: p.lat, lon: p.lon, speed: p.speedKmh }))
      : null;

  const viewBox = getCornerViewBox(
    { lat: corner.apexLat, lon: corner.apexLon },
    100 // 100m de rayon = ~200m de fenêtre, large
  );

  const deltaEntryExit =
    stats?.entrySpeedKmh != null && stats?.exitSpeedKmh != null
      ? stats.exitSpeedKmh - stats.entrySpeedKmh
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>
          ZOOM VIRAGE {String(corner.index).padStart(2, '0')}
        </Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>{corner.name}</Text>
        <Text
          style={[
            typography.caption,
            {
              color: colorForZone(zone),
              marginTop: spacing.sm,
              marginBottom: spacing.xl,
            },
          ]}
        >
          {marginLabelOf(zone)}
          {stats?.marginPercent !== null && stats?.marginPercent !== undefined
            ? ` · ${Math.round(stats.marginPercent)}%`
            : ''}
        </Text>

        {/* Carte zoomée sur le virage */}
        <CircuitMap viewBox={viewBox} height={260}>
          <TrackLayer animate={false} opacity={0.3} strokeWidth={6} />
          {trajectoryPoints ? (
            <TrajectoryLayer points={trajectoryPoints} colorMode="speed-heatmap" />
          ) : null}
          <CornersLayer
            colorMode="zone"
            zoneByIndex={{ [corner.index]: zone }}
            selectedIndex={corner.index}
            showLabels
            radius={18}
          />
        </CircuitMap>

        {/* Vitesses */}
        <Section eyebrow="VITESSES">
          <View style={{ gap: spacing.xs }}>
            <StatRow
              label="À l'entrée"
              value={stats?.entrySpeedKmh != null ? `${Math.round(stats.entrySpeedKmh)} km/h` : '—'}
            />
            <StatRow
              label="Au point bas"
              value={stats?.minSpeedKmh != null ? `${Math.round(stats.minSpeedKmh)} km/h` : '—'}
            />
            <StatRow
              label="À l'apex"
              value={stats?.apexSpeedKmh != null ? `${Math.round(stats.apexSpeedKmh)} km/h` : '—'}
            />
            <StatRow
              label="À la sortie"
              value={stats?.exitSpeedKmh != null ? `${Math.round(stats.exitSpeedKmh)} km/h` : '—'}
            />
            {deltaEntryExit !== null ? (
              <StatRow
                label="Écart entrée → sortie"
                value={`${deltaEntryExit > 0 ? '+' : ''}${Math.round(deltaEntryExit)} km/h`}
                emphasis
              />
            ) : null}
          </View>
        </Section>

        {/* Forces vécues */}
        <Section eyebrow="FORCES VÉCUES">
          <GForceBars
            lateralG={stats?.maxGLateral ?? null}
            brakingG={stats?.maxGBraking ?? null}
            accelG={stats?.maxGAccel ?? null}
          />
        </Section>

        {/* Trajectoire */}
        <Section eyebrow="TRAJECTOIRE">
          {stats?.avgLateralErrorM !== null && stats?.avgLateralErrorM !== undefined ? (
            <View style={{ gap: spacing.xs }}>
              <StatRow
                label="Écart latéral moyen"
                value={`${stats.avgLateralErrorM.toFixed(1)} m`}
              />
              <StatRow
                label="Écart latéral max"
                value={
                  stats?.maxLateralErrorM != null ? `${stats.maxLateralErrorM.toFixed(1)} m` : '—'
                }
              />
            </View>
          ) : (
            <Text style={typography.body}>
              La trajectoire détaillée apparaîtra après votre première session enregistrée.
            </Text>
          )}
        </Section>

        {/* Annotations coach (si partagées) */}
        {annotations.length > 0 ? (
          <Section eyebrow={annotations.length > 1 ? 'NOTES DE VOS COACHS' : 'NOTE DE VOTRE COACH'}>
            <View style={{ gap: spacing.sm }}>
              {annotations.map((a) => (
                <View
                  key={a.id}
                  style={{
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    borderWidth: 0.5,
                    borderColor: colors.accent.coach,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.light,
                      fontStyle: 'italic',
                      lineHeight: fontSize.body * 1.6,
                    }}
                  >
                    « {a.body} »
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.text.tertiary, marginTop: spacing.sm },
                    ]}
                  >
                    {dateShort(a.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Question ouverte — doctrine */}
        <View style={{ marginBottom: spacing.xxxl }}>
          <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>QUESTION</Text>
          <Text style={[typography.manifest, { textAlign: 'center', marginVertical: spacing.lg }]}>
            Était-ce volontaire&nbsp;?
          </Text>
        </View>

        {/* CTA Comparaison */}
        {params.sessionId ? (
          <Pressable
            accessibilityRole="button"
            onPress={onCompare}
            style={({ pressed }) => ({
              padding: spacing.lg,
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.border.medium,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              marginBottom: spacing.md,
            })}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.medium,
              }}
            >
              Comparer ce virage à une autre session
            </Text>
          </Pressable>
        ) : null}

        {/* CTA Annoter (coach uniquement, et si pilotId résolu) */}
        {isCoach && sessionPilotId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/(coach)/annoter',
                params: {
                  pilotId: sessionPilotId,
                  cornerIndex: String(cornerIndex),
                  sessionId: params.sessionId ?? '',
                },
              } as never)
            }
            style={({ pressed }) => ({
              padding: spacing.lg,
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.accent.coach,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              marginBottom: spacing.xl,
            })}
          >
            <Text
              style={{
                color: colors.accent.coach,
                fontSize: fontSize.body,
                fontWeight: fontWeight.medium,
              }}
            >
              Annoter ce virage
            </Text>
          </Pressable>
        ) : null}

        {/* Navigation entre virages */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.lg,
            gap: spacing.md,
          }}
        >
          <NavBtn label="‹ Précédent" onPress={onPrev} />
          <NavBtn label="Suivant ›" onPress={onNext} />
        </View>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour à la carte
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxxl, marginTop: spacing.xxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>{eyebrow}</Text>
      {children}
    </View>
  );
}

function StatRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.body }}>{label}</Text>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: emphasis ? fontWeight.semibold : fontWeight.regular,
          fontFamily: 'Menlo',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function NavBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.medium,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: colors.text.primary, fontSize: fontSize.caption }}>{label}</Text>
    </Pressable>
  );
}

function VirageNotFound() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>VIRAGE</Text>
      <Text style={[typography.screenTitle, { textAlign: 'center' }]}>Ce virage n'existe pas.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={{ marginTop: spacing.xxxl }}
      >
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
      </Pressable>
    </SafeAreaView>
  );
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

function dateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
