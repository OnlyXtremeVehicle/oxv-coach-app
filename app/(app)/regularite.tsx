/**
 * Écran Régularité — pilier §3.2 du cahier OXV Mirror.
 *
 * Mesure mathématique de la constance : l'écart entre les tours. Fait
 * statistique, pas jugement. « Êtes-vous régulier ? » et non « bon ? ».
 *
 * Affiche : un chiffre central (l'écart-type, dispersion), une bande
 * descriptive, et une barre par tour montrant l'écart à la médiane.
 *
 * Sécurité : RLS owner. Lit les laps de la session via fetchSessionLaps.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { CountUpNumber, FadeInSection } from '@/components/motion';
import { supabase } from '@/lib/supabase';
import { type RegularityProfile, computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
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

  const hasContent = reg && reg.band !== null && reg.stdDevSeconds !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>RÉGULARITÉ</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          La constance, en chiffres.
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
              Au moins deux tours sont nécessaires pour mesurer la régularité.
            </Text>
          </View>
        ) : (
          <>
            {/* Chiffre central : écart-type */}
            <FadeInSection style={{ alignItems: 'center', marginBottom: spacing.giant }}>
              <CountUpNumber
                value={reg.stdDevSeconds!}
                duration={1000}
                decimals={2}
                suffix=" s"
                style={[typography.heroNumber, { color: colors.text.primary }]}
              />
              <Text
                style={[
                  typography.screenTitle,
                  {
                    color: colors.text.secondary,
                    textAlign: 'center',
                    fontWeight: fontWeight.light,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                {reg.band}
              </Text>
              <Text
                style={{
                  color: colors.text.tertiary,
                  fontSize: fontSize.caption,
                  marginTop: spacing.xs,
                }}
              >
                écart-type sur {reg.lapCount} tours
              </Text>
            </FadeInSection>

            {/* Manifeste */}
            {reg.manifest ? (
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
                {reg.manifest}
              </Text>
            ) : null}

            {/* Repères chiffrés */}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl }}>
              <StatBox
                label="Meilleur tour"
                value={reg.bestSeconds !== null ? formatLapTime(reg.bestSeconds) : '—'}
              />
              <StatBox
                label="Médiane"
                value={reg.medianSeconds !== null ? formatLapTime(reg.medianSeconds) : '—'}
              />
              <StatBox
                label="Amplitude"
                value={
                  reg.spreadSeconds !== null
                    ? `${reg.spreadSeconds.toFixed(1).replace('.', ',')} s`
                    : '—'
                }
              />
            </View>

            {/* Écart par tour */}
            <Text
              style={[
                typography.eyebrow,
                { color: colors.text.tertiary, marginBottom: spacing.md },
              ]}
            >
              ÉCART À LA MÉDIANE, TOUR PAR TOUR
            </Text>
            <View style={{ gap: spacing.sm }}>
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
              Un fait statistique, pas une note. La constance vous appartient.
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{ color: colors.text.tertiary, fontSize: fontSize.eyebrow, letterSpacing: 1 }}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
          fontFamily: 'Menlo',
          marginTop: spacing.xs,
        }}
      >
        {value}
      </Text>
    </View>
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
  const deltaLabel = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2).replace('.', ',')} s`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text style={{ width: 28, color: colors.text.tertiary, fontSize: fontSize.caption }}>
        T{lapNumber}
      </Text>
      {/* Piste centrée */}
      <View style={{ flex: 1, height: 18, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          {isBelow ? (
            <View
              style={{
                width: `${ratio * 100}%`,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.text.secondary,
              }}
            />
          ) : null}
        </View>
        <View style={{ width: 1, height: 18, backgroundColor: colors.border.medium }} />
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          {!isBelow ? (
            <View
              style={{
                width: `${ratio * 100}%`,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.text.secondary,
              }}
            />
          ) : null}
        </View>
      </View>
      <Text
        style={{
          width: 76,
          textAlign: 'right',
          color: colors.text.tertiary,
          fontSize: fontSize.caption,
          fontFamily: 'Menlo',
        }}
      >
        {deltaLabel}
      </Text>
    </View>
  );
}
