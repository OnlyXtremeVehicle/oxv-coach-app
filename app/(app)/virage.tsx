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
 *
 * Reskin V2 : Screen + AppBar, Card/Button du kit, styles via @/theme/v2.
 * La carte SVG (CircuitMap + couches) et les barres G (GForceBars) restent
 * inchangées, comme toute la logique (chargement, couches coach, navigation).
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
import { type CoachCornerReference, compareSpeedToReference } from '@/services/coachReferenceLogic';
import { listCoachReferencesForCorner } from '@/services/coachReferenceService';
import { type CornerDeepDive, loadCornerDeepDive } from '@/services/cornerDeepDiveService';
import { useAuthStore } from '@/store/useAuthStore';
import { type MarginZone, marginLabelOf, marginZoneOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateShort } from '@/utils/format';

export default function VirageScreen() {
  const params = useLocalSearchParams<{ index?: string; sessionId?: string }>();
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);

  const [deepDive, setDeepDive] = useState<CornerDeepDive | null>(null);
  const [annotations, setAnnotations] = useState<CoachAnnotation[]>([]);
  const [coachReferences, setCoachReferences] = useState<CoachCornerReference[]>([]);
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

  // Repères du coach pour ce virage (§10.3c-A). RLS : le pilote voit ceux
  // de ses coachs consentis ; le coach voit les siens.
  useEffect(() => {
    if (!corner) return;
    let cancelled = false;
    listCoachReferencesForCorner(corner.index).then((rows) => {
      if (!cancelled) setCoachReferences(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [corner]);

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
    <Screen>
      <AppBar title="VIRAGE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={s.headRow}>
          <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={s.eyebrow}>ZOOM VIRAGE {String(corner.index).padStart(2, '0')}</Text>
        </View>
        <Text style={[s.title, { marginTop: theme.spacing.md }]} accessibilityRole="header">
          {corner.name}
        </Text>
        <Text
          style={[
            s.zoneLabel,
            {
              color: colorForZone(zone),
              marginTop: theme.spacing.sm,
              marginBottom: theme.spacing.xl,
            },
          ]}
          accessibilityLabel={
            stats?.marginPercent !== null && stats?.marginPercent !== undefined
              ? `Marge : ${marginLabelOf(zone)}, ${Math.round(stats.marginPercent)} pour cent`
              : `Marge : ${marginLabelOf(zone)}`
          }
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
          <Card style={s.dataPanel}>
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
              last={deltaEntryExit === null}
            />
            {deltaEntryExit !== null ? (
              <StatRow
                label="Écart entrée → sortie"
                value={`${deltaEntryExit > 0 ? '+' : ''}${Math.round(deltaEntryExit)} km/h`}
                emphasis
                last
              />
            ) : null}
          </Card>
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
            <Card style={s.dataPanel}>
              <StatRow
                label="Écart latéral moyen"
                value={`${stats.avgLateralErrorM.toFixed(1)} m`}
              />
              <StatRow
                label="Écart latéral max"
                value={
                  stats?.maxLateralErrorM != null ? `${stats.maxLateralErrorM.toFixed(1)} m` : '—'
                }
                last
              />
            </Card>
          ) : (
            <Text style={s.body}>
              La trajectoire détaillée apparaîtra après votre première session enregistrée.
            </Text>
          )}
        </Section>

        {/* Annotations coach (si partagées) */}
        {annotations.length > 0 ? (
          <Section eyebrow={annotations.length > 1 ? 'NOTES DE VOS COACHS' : 'NOTE DE VOTRE COACH'}>
            <View style={{ gap: theme.spacing.sm }}>
              {annotations.map((a) => (
                <Card key={a.id} style={{ borderColor: theme.palette.coach }}>
                  <Text style={s.coachNote}>« {a.body} »</Text>
                  <Text style={[s.meta, { marginTop: theme.spacing.sm }]}>
                    {formatDateShort(a.createdAt)}
                    {a.aiAssisted ? ' · Assistée par IA, validée par votre coach' : ''}
                  </Text>
                </Card>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Repères du coach (§10.3c-A) — superposés, étiquetés, factuels. */}
        {coachReferences.length > 0 ? (
          <Section
            eyebrow={coachReferences.length > 1 ? 'REPÈRES DE VOS COACHS' : 'REPÈRE DE VOTRE COACH'}
          >
            <View style={{ gap: theme.spacing.sm }}>
              {coachReferences.map((ref) => (
                <CoachReferenceCard
                  key={ref.id}
                  reference={ref}
                  apexKmh={stats?.apexSpeedKmh ?? null}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Question ouverte — doctrine */}
        <View style={{ marginBottom: theme.spacing.xxl * 1.5, marginTop: theme.spacing.xxl }}>
          <Text style={[s.eyebrow, { marginBottom: theme.spacing.md }]} accessibilityRole="header">
            QUESTION
          </Text>
          <Text style={[s.manifest, { textAlign: 'center', marginVertical: theme.spacing.lg }]}>
            Était-ce volontaire&nbsp;?
          </Text>
        </View>

        {/* CTA Comparaison */}
        {params.sessionId ? (
          <View style={{ marginBottom: theme.spacing.md }}>
            <Button
              label="Comparer ce virage à une autre session"
              variant="ghost"
              onPress={onCompare}
            />
          </View>
        ) : null}

        {/* CTA Annoter (coach uniquement, et si pilotId résolu) */}
        {isCoach && sessionPilotId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annoter ce virage"
            hitSlop={theme.hitSlop}
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
            style={({ pressed }) => [s.coachCta, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.coachCtaTxt}>Annoter ce virage</Text>
          </Pressable>
        ) : null}

        {/* Navigation entre virages */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button label="‹ Précédent" variant="ghost" onPress={onPrev} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Suivant ›" variant="ghost" onPress={onNext} />
          </View>
        </View>

        <View style={{ marginTop: theme.spacing.xxl * 1.5, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={s.backHit}
          >
            <Text style={s.back}>Retour à la carte</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: theme.spacing.xxl }}>
      <View style={[s.headRow, { marginBottom: theme.spacing.lg }]}>
        <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={s.eyebrow} accessibilityRole="header">
          {eyebrow}
        </Text>
      </View>
      {children}
    </View>
  );
}

function StatRow({
  label,
  value,
  emphasis = false,
  last = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.palette.line,
      }}
    >
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, emphasis && { color: theme.palette.gold }]}>{value}</Text>
    </View>
  );
}

function CoachReferenceCard({
  reference,
  apexKmh,
}: {
  reference: CoachCornerReference;
  apexKmh: number | null;
}) {
  const speedCmp =
    reference.targetSpeedKmh != null
      ? compareSpeedToReference(apexKmh, reference.targetSpeedKmh)
      : null;

  return (
    <Card style={{ borderColor: theme.palette.coach, gap: theme.spacing.xs }}>
      {reference.brakingPointM != null ? (
        <Text style={s.coachRefLine}>
          Point de freinage repère : {Math.round(reference.brakingPointM)} m
        </Text>
      ) : null}
      {reference.targetSpeedKmh != null ? (
        <Text style={s.coachRefLine}>
          Vitesse repère : {Math.round(reference.targetSpeedKmh)} km/h
          {speedCmp
            ? ` · votre apex : ${Math.round(apexKmh as number)} km/h (${
                speedCmp.deltaKmh > 0 ? '+' : ''
              }${speedCmp.deltaKmh})`
            : ''}
        </Text>
      ) : null}
      {reference.trajectoryNote ? (
        <Text style={s.coachRefNote}>{reference.trajectoryNote}</Text>
      ) : null}
    </Card>
  );
}

function VirageNotFound() {
  return (
    <Screen scroll={false}>
      <AppBar title="VIRAGE" onBack={() => router.back()} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <Text style={[s.eyebrow, { marginBottom: theme.spacing.md }]}>VIRAGE</Text>
        <Text style={[s.title, { textAlign: 'center' }]} accessibilityRole="header">
          Ce virage n'existe pas.
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.hitSlop}
          onPress={() => router.back()}
          style={[s.backHit, { marginTop: theme.spacing.xxl * 1.5 }]}
        >
          <Text style={s.back}>Retour</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// Couleur de l'étiquette de marge : tons DONNÉE, jamais un rouge de verdict
// (doctrine — le chiffre central n'est pas un jugement). Le « terrain serré »
// reste neutre crème pour décrire sans condamner.
function colorForZone(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return theme.dataColors.accel;
    case 'yellow':
      return theme.palette.gold;
    case 'red':
      return theme.palette.creamMute;
  }
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  dataPanel: {
    backgroundColor: theme.palette.card2,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
  },
  zoneLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  statValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  coachNote: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.body,
    fontStyle: 'italic' as const,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.body * 1.6,
  },
  coachRefLine: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  coachRefNote: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.5,
  },
  coachCta: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.coach,
    backgroundColor: theme.palette.card2,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.xl,
  },
  coachCtaTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  // Cible tactile confortable pour les liens « Retour » (texte seul).
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
