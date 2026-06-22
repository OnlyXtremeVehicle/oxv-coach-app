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
 *
 * Reskin V2 : Screen + AppBar, Card du kit, styles via @/theme/v2. Les
 * cartes SVG (CircuitMap + couches) et les barres G comparées (GForceBars)
 * restent inchangées, comme toute la logique (picker, chargement A/B).
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
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
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
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
      <Screen scroll={false}>
        <AppBar title="COMPARER" onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text style={[s.title, { textAlign: 'center' }]}>Ce virage n'existe pas.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="COMPARER" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>COMPARER VIRAGE {String(corner.index).padStart(2, '0')}</Text>
        <Text style={[s.title, { marginTop: theme.spacing.md, marginBottom: theme.spacing.xl }]}>
          {corner.name}
        </Text>

        {/* Picker session B */}
        {!sessionBId ? (
          <View style={{ marginBottom: theme.spacing.xxl }}>
            <Text style={[s.eyebrow, { marginBottom: theme.spacing.md }]}>
              CHOISIR LA SESSION B
            </Text>
            {loadingOptions ? (
              <Text style={s.meta}>Chargement…</Text>
            ) : options.length === 0 ? (
              <Text style={s.meta}>Aucune autre session disponible.</Text>
            ) : (
              <View style={{ gap: theme.spacing.xs }}>
                {options.map((o) => (
                  <Pressable
                    accessibilityRole="button"
                    key={o.id}
                    onPress={() => setSessionBId(o.id)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  >
                    <Card
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={s.optionDate}>{formatDateShort(o.startedAt)}</Text>
                      <Text style={s.optionMargin}>
                        {o.marginGlobal !== null ? `${Math.round(o.marginGlobal)} %` : '—'}
                      </Text>
                    </Card>
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
                gap: theme.spacing.lg,
                marginBottom: theme.spacing.xxl,
              }}
            >
              <MiniCard
                label="Session A"
                accent={theme.palette.gold}
                deep={deepA}
                viewBox={viewBox}
                cornerIndex={corner.index}
              />
              <MiniCard
                label="Session B"
                accent={theme.palette.cream}
                deep={deepB}
                viewBox={viewBox}
                cornerIndex={corner.index}
              />
            </View>

            <Section eyebrow="DELTA VITESSES B − A">
              <Card>
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
                  last
                />
              </Card>
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
              <Card>
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
                  last
                />
              </Card>
            </Section>

            <Pressable
              accessibilityRole="button"
              onPress={() => setSessionBId(null)}
              style={({ pressed }) => [s.secondaryCta, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={s.secondaryCtaTxt}>Choisir une autre session B</Text>
            </Pressable>
          </>
        ) : null}

        {sessionBId && (!deepA || !deepB) ? (
          <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
        ) : null}

        <View style={{ marginTop: theme.spacing.xxl * 1.5, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.back}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function MiniCard({
  label,
  accent,
  deep,
  viewBox,
  cornerIndex,
}: {
  label: string;
  accent: string;
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
    <Card style={{ flex: 1 }}>
      <Text style={[s.eyebrow, { marginBottom: theme.spacing.sm, color: accent }]}>{label}</Text>
      <CircuitMap viewBox={viewBox} height={180} background={theme.palette.card2}>
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
      <Text style={s.miniValue}>
        {deep.stats?.marginPercent != null ? `${Math.round(deep.stats.marginPercent)} %` : '—'}
      </Text>
    </Card>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: theme.spacing.xxl }}>
      <Text style={[s.eyebrow, { marginBottom: theme.spacing.md }]}>{eyebrow}</Text>
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
  last = false,
}: {
  label: string;
  a: number | null;
  b: number | null;
  unit: string;
  decimals?: number;
  last?: boolean;
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
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.palette.line,
      }}
    >
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{text}</Text>
    </View>
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
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  optionDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  optionMargin: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
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
    color: theme.palette.cream,
  },
  miniValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  secondaryCta: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    marginTop: theme.spacing.xl,
  },
  secondaryCtaTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
