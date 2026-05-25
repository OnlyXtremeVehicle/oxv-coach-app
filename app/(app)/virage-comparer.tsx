/**
 * Écran "Comparer ce virage" — superpose les données d'un même virage
 * entre 2 sessions du pilote courant.
 *
 * Flow :
 *   - Arrive avec params {index, sessionA}
 *   - Charge la liste des autres sessions du pilote
 *   - Picker pour choisir sessionB
 *   - Affiche : 2 cartes zoomées + delta vitesses + GForceBars compare
 *
 * Doctrine : pas de winner, les deltas sont neutres. Le pilote
 * interprète seul si « + 6 km/h à l'apex » est une bonne ou mauvaise
 * nouvelle. L'app décrit, ne juge pas.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
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
import { supabase } from '@/lib/supabase';
import { getCorner } from '@/lib/circuitTopology';
import { type CornerDeepDive, loadCornerDeepDive } from '@/services/cornerDeepDiveService';
import { useAuthStore } from '@/store/useAuthStore';
import { type MarginZone, marginZoneOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort } from '@/utils/format';

interface SessionOption {
  id: string;
  startedAt: string;
  marginGlobal: number | null;
}

export default function VirageComparerScreen() {
  const params = useLocalSearchParams<{ index?: string; sessionA?: string }>();
  const profile = useAuthStore((s) => s.profile);
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);
  const { width } = useWindowDimensions();
  const sideBySide = width >= 760;

  const [options, setOptions] = useState<SessionOption[]>([]);
  const [sessionBId, setSessionBId] = useState<string | null>(null);
  const [deepA, setDeepA] = useState<CornerDeepDive | null>(null);
  const [deepB, setDeepB] = useState<CornerDeepDive | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Charge la liste des autres sessions du pilote (filtre A)
  useEffect(() => {
    if (!profile || !params.sessionA) return;
    const sessionA = params.sessionA; // narrow avant async closure
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('id, started_at, app_session_analyses(margin_global)')
        .eq('user_id', profile.id)
        .eq('status', 'completed')
        .neq('id', sessionA)
        .order('started_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      const list: SessionOption[] = (data ?? []).map((row: Record<string, unknown>) => {
        const analysisJoined = row.app_session_analyses as
          | { margin_global?: number | null }[]
          | { margin_global?: number | null }
          | null;
        const first = Array.isArray(analysisJoined) ? analysisJoined[0] : analysisJoined;
        return {
          id: row.id as string,
          startedAt: row.started_at as string,
          marginGlobal:
            first?.margin_global !== null && first?.margin_global !== undefined
              ? Number(first.margin_global)
              : null,
        };
      });
      setOptions(list);
      setLoadingOptions(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionA]);

  // Charge le deep-dive A
  useEffect(() => {
    if (!params.sessionA || !corner) return;
    let cancelled = false;
    loadCornerDeepDive(params.sessionA, corner.index).then((d) => {
      if (!cancelled) setDeepA(d);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionA, corner]);

  // Charge le deep-dive B quand sélectionné
  useEffect(() => {
    if (!sessionBId || !corner) return;
    let cancelled = false;
    setDeepB(null);
    loadCornerDeepDive(sessionBId, corner.index).then((d) => {
      if (!cancelled) setDeepB(d);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionBId, corner]);

  const viewBox = useMemo(() => {
    if (!corner) return undefined;
    return getCornerViewBox({ lat: corner.apexLat, lon: corner.apexLon }, 100);
  }, [corner]);

  if (!corner) {
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
        <Text style={typography.screenTitle}>Ce virage n'existe pas.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>
          COMPARER VIRAGE {String(corner.index).padStart(2, '0')}
        </Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          {corner.name}
        </Text>

        {/* Picker session B */}
        {!sessionBId ? (
          <View style={{ marginBottom: spacing.xxl }}>
            <Text
              style={[
                typography.eyebrow,
                { marginBottom: spacing.md, color: colors.text.tertiary },
              ]}
            >
              CHOISIR LA SESSION B
            </Text>
            {loadingOptions ? (
              <Text style={typography.caption}>Chargement…</Text>
            ) : options.length === 0 ? (
              <Text style={typography.caption}>Aucune autre session disponible.</Text>
            ) : (
              <View style={{ gap: spacing.xs }}>
                {options.map((o) => (
                  <Pressable
                    accessibilityRole="button"
                    key={o.id}
                    onPress={() => setSessionBId(o.id)}
                    style={({ pressed }) => ({
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      borderWidth: 0.5,
                      borderColor: colors.border.subtle,
                      backgroundColor: colors.background.secondary,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: fontSize.body,
                      }}
                    >
                      {formatDateShort(o.startedAt)}
                    </Text>
                    <Text
                      style={{
                        color: colors.text.tertiary,
                        fontSize: fontSize.caption,
                        fontFamily: 'Menlo',
                      }}
                    >
                      {o.marginGlobal !== null ? `${Math.round(o.marginGlobal)} %` : '—'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Comparaison */}
        {sessionBId && deepA && deepB ? (
          <>
            <View
              style={{
                flexDirection: sideBySide ? 'row' : 'column',
                gap: spacing.lg,
                marginBottom: spacing.xxl,
              }}
            >
              <MiniCard
                label="Session A"
                deep={deepA}
                viewBox={viewBox}
                cornerIndex={corner.index}
              />
              <MiniCard
                label="Session B"
                deep={deepB}
                viewBox={viewBox}
                cornerIndex={corner.index}
              />
            </View>

            <Section eyebrow="DELTA VITESSES B − A">
              <View style={{ gap: spacing.xs }}>
                <DeltaRow
                  label="À l'entrée"
                  a={deepA.stats?.entrySpeedKmh ?? null}
                  b={deepB.stats?.entrySpeedKmh ?? null}
                  unit="km/h"
                />
                <DeltaRow
                  label="Au point bas"
                  a={deepA.stats?.minSpeedKmh ?? null}
                  b={deepB.stats?.minSpeedKmh ?? null}
                  unit="km/h"
                />
                <DeltaRow
                  label="À l'apex"
                  a={deepA.stats?.apexSpeedKmh ?? null}
                  b={deepB.stats?.apexSpeedKmh ?? null}
                  unit="km/h"
                />
                <DeltaRow
                  label="À la sortie"
                  a={deepA.stats?.exitSpeedKmh ?? null}
                  b={deepB.stats?.exitSpeedKmh ?? null}
                  unit="km/h"
                />
              </View>
            </Section>

            <Section eyebrow="FORCES — A en couleur, B en gris">
              <GForceBars
                lateralG={deepA.stats?.maxGLateral ?? null}
                brakingG={deepA.stats?.maxGBraking ?? null}
                accelG={deepA.stats?.maxGAccel ?? null}
                compare={{
                  lateralG: deepB.stats?.maxGLateral ?? null,
                  brakingG: deepB.stats?.maxGBraking ?? null,
                  accelG: deepB.stats?.maxGAccel ?? null,
                  label: 'Session B',
                }}
              />
            </Section>

            <Section eyebrow="DELTA TRAJECTOIRE">
              <DeltaRow
                label="Écart latéral moyen"
                a={deepA.stats?.avgLateralErrorM ?? null}
                b={deepB.stats?.avgLateralErrorM ?? null}
                unit="m"
                decimals={1}
              />
              <DeltaRow
                label="Écart latéral max"
                a={deepA.stats?.maxLateralErrorM ?? null}
                b={deepB.stats?.maxLateralErrorM ?? null}
                unit="m"
                decimals={1}
              />
            </Section>

            <Pressable
              accessibilityRole="button"
              onPress={() => setSessionBId(null)}
              style={({ pressed }) => ({
                padding: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.border.subtle,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
                marginTop: spacing.xl,
              })}
            >
              <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
                Choisir une autre session B
              </Text>
            </Pressable>
          </>
        ) : null}

        {sessionBId && (!deepA || !deepB) ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
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

function MiniCard({
  label,
  deep,
  viewBox,
  cornerIndex,
}: {
  label: string;
  deep: CornerDeepDive;
  viewBox: string | undefined;
  cornerIndex: number;
}) {
  const zone: MarginZone =
    deep.stats?.marginZone ??
    (deep.stats?.marginPercent != null ? marginZoneOf(deep.stats.marginPercent) : 'yellow');
  const trajectoryPoints =
    deep.trajectory.length > 1
      ? deep.trajectory.map((p) => ({ lat: p.lat, lon: p.lon, speed: p.speedKmh }))
      : null;

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      <Text style={[typography.eyebrow, { marginBottom: spacing.sm }]}>{label}</Text>
      <CircuitMap viewBox={viewBox} height={180} background={colors.background.elevated}>
        <TrackLayer animate={false} opacity={0.3} strokeWidth={6} />
        {trajectoryPoints ? (
          <TrajectoryLayer points={trajectoryPoints} colorMode="speed-heatmap" />
        ) : null}
        <CornersLayer
          colorMode="zone"
          zoneByIndex={{ [cornerIndex]: zone }}
          selectedIndex={cornerIndex}
          showLabels
          radius={16}
        />
      </CircuitMap>
      <Text
        style={{
          marginTop: spacing.sm,
          color: colors.text.primary,
          fontSize: fontSize.title,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
          textAlign: 'center',
        }}
      >
        {deep.stats?.marginPercent != null ? `${Math.round(deep.stats.marginPercent)} %` : '—'}
      </Text>
    </View>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>{eyebrow}</Text>
      {children}
    </View>
  );
}

function DeltaRow({
  label,
  a,
  b,
  unit,
  decimals = 0,
}: {
  label: string;
  a: number | null;
  b: number | null;
  unit: string;
  decimals?: number;
}) {
  const delta = a !== null && b !== null ? b - a : null;
  const text =
    delta === null
      ? '—'
      : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta).toFixed(decimals)} ${unit}`;
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
          fontWeight: fontWeight.medium,
          fontFamily: 'Menlo',
        }}
      >
        {text}
      </Text>
    </View>
  );
}
