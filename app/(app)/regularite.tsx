/**
 * Écran Régularité — pilier §3.2 du cahier OXV Mirror. Design V2.
 *
 * Mesure mathématique de la constance : l'écart entre les tours. Fait
 * statistique, pas jugement. « Êtes-vous régulier ? » et non « bon ? ».
 *
 * Affiche : un chiffre central (l'écart-type, dispersion), une bande
 * descriptive, et une barre par tour montrant l'écart à la médiane.
 *
 * Sécurité : RLS owner. Lit les laps de la session via fetchSessionLaps.
 *
 * Reskin gaming : l'écart-type est porté par l'arc cockpit (GaugeInstrument),
 * les repères par Fact, l'état vide par EmptyState, les barres d'écart en or à
 * halo. Logique de calcul (computeRegularity) inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, Fact, GaugeInstrument } from '@/components/instruments';
import { supabase } from '@/lib/supabase';
import { type RegularityProfile, computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatLapTime } from '@/utils/format';

export default function RegulariteScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [reg, setReg] = useState<RegularityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
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

      const laps = await fetchSessionLaps(sessionId);
      if (cancelled) return;

      const profileReg = computeRegularity(
        laps
          .filter((l) => !l.is_outlap && !l.is_inlap)
          .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
      );
      setReg(profileReg);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="RÉGULARITÉ" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const hasContent = reg && reg.band !== null && reg.stdDevSeconds !== null;

  return (
    <Screen>
      <AppBar title="RÉGULARITÉ" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>La constance, en chiffres.</Text>

        {!hasContent ? (
          <EmptyState
            message="Au moins deux tours sont nécessaires pour mesurer la régularité."
            source="laps"
          />
        ) : (
          <>
            {/* Instrument central : l'écart-type sur l'arc cockpit (factuel).
                Le GaugeInstrument porte déjà sa propre entrée animée : pas de
                FadeInSection par-dessus (anti double-animation). */}
            <View style={{ alignItems: 'center', marginVertical: theme.spacing.xxl }}>
              <GaugeInstrument
                label="ÉCART-TYPE"
                value={reg.stdDevSeconds!}
                min={0}
                max={Math.max(1, reg.stdDevSeconds! * 1.4)}
                unit="s"
                formatValue={(v) => v.toFixed(2).replace('.', ',')}
                caption={reg.band ?? undefined}
                size={264}
              />
              <Text style={s.heroNote}>écart-type sur {reg.lapCount} tours</Text>
            </View>

            {/* Manifeste */}
            {reg.manifest ? <Text style={s.manifest}>{reg.manifest}</Text> : null}

            {/* Repères chiffrés */}
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.xl,
              }}
            >
              <Fact
                label="Meilleur tour"
                value={reg.bestSeconds !== null ? formatLapTime(reg.bestSeconds) : '—'}
              />
              <Fact
                label="Médiane"
                value={reg.medianSeconds !== null ? formatLapTime(reg.medianSeconds) : '—'}
              />
              <Fact
                label="Amplitude"
                value={
                  reg.spreadSeconds !== null
                    ? `${reg.spreadSeconds.toFixed(1).replace('.', ',')} s`
                    : '—'
                }
              />
            </View>

            {/* Écart par tour */}
            <View style={{ gap: theme.spacing.sm }}>
              <SectionLabel>Écart à la médiane, tour par tour</SectionLabel>
              <Card>
                <View style={{ gap: theme.spacing.sm }}>
                  {reg.laps.map((lap) => (
                    <LapBar
                      key={lap.lapNumber}
                      lapNumber={lap.lapNumber}
                      delta={lap.deltaToMedianSeconds}
                      maxAbsDelta={Math.max(
                        0.1,
                        ...reg.laps.map((l) => Math.abs(l.deltaToMedianSeconds))
                      )}
                    />
                  ))}
                </View>
              </Card>
            </View>

            <Text style={s.doctrine}>
              Un fait statistique, pas une note. La constance vous appartient.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

/**
 * Barre horizontale centrée : à gauche = sous la médiane (plus rapide),
 * à droite = au-dessus. Couleur neutre — on ne juge pas, on situe.
 */
function LapBar({
  lapNumber,
  delta,
  maxAbsDelta,
}: {
  lapNumber: number;
  delta: number;
  maxAbsDelta: number;
}) {
  const ratio = Math.min(1, Math.abs(delta) / maxAbsDelta);
  const isBelow = delta < 0;
  const magnitude = `${Math.abs(delta).toFixed(2).replace('.', ',')} s`;
  const deltaLabel = `${delta >= 0 ? '+' : '−'}${magnitude}`;
  // Constat factuel pour lecteur d'écran : la position situe, elle ne juge pas.
  const side =
    Math.abs(delta) < 0.005
      ? 'sur la médiane'
      : isBelow
        ? 'sous la médiane'
        : 'au-dessus de la médiane';
  const a11yLabel = `Tour ${lapNumber} : ${deltaLabel}, ${side}.`;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
      accessible
      accessibilityLabel={a11yLabel}
    >
      <Text style={s.lapTag}>T{lapNumber}</Text>
      {/* Piste centrée — l'écart se lit par la position (gauche = plus rapide,
          droite = plus lent), jamais par la couleur. L'or est une donnée, neutre. */}
      <View
        style={{ flex: 1, height: 18, flexDirection: 'row', alignItems: 'center' }}
        importantForAccessibility="no-hide-descendants"
      >
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          {isBelow ? <View style={[s.lapFill, { width: `${ratio * 100}%` }]} /> : null}
        </View>
        <View style={{ width: 1, height: 18, backgroundColor: theme.palette.line }} />
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          {!isBelow ? <View style={[s.lapFill, { width: `${ratio * 100}%` }]} /> : null}
        </View>
      </View>
      <Text style={s.lapDelta}>{deltaLabel}</Text>
    </View>
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
  heroNote: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
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
  lapTag: {
    width: 28,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  lapDelta: {
    width: 76,
    textAlign: 'right' as const,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  lapFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
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
};
