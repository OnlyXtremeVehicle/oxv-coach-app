/**
 * Carte de chaleur — zone Data Lab. Reskin FIDÈLE aux maquettes Claude Design
 * refonte-v2 §7bis (`screens/20-carte-chaleur.png`), décision fondateur 2026-07-12.
 *
 * Héros conforme à la maquette (haut → bas) :
 *   header « Carte de chaleur » · eyebrow centré « VITESSE LE LONG DU TOUR » ·
 *   tracé coloré par vitesse froid→chaud (theme.speedHeat — JAMAIS de rouge,
 *   pas d'alarme) · légende PLEINE LARGEUR « LENT — RAPIDE » · carte narrative
 *   unique (puce or, constat factuel dérivé de la vitesse max réelle).
 *
 * La substance existante hors-maquette (deux faits min/max, manifeste, retour)
 * est CONSERVÉE sous le héros — rien ne se perd (parti A).
 *
 * Source : telemetry_frames de la session (RLS owner). Tant que les frames
 * sont absentes, `EmptyState` honnête : aucune fausse donnée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  TrackStage,
  type TrackStageHeatPoint,
  type TrajectoryPoint,
} from '@/components/CircuitMap';
import { EmptyState, Fact } from '@/components/instruments';
import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const { palette, speedHeat, fonts, fontSize, spacing, radius, hitSlop } = theme;

/** Rappel doctrinal de la maquette — le chaud n'est pas une alarme. */
const NO_RED_REMINDER = 'Le rouge n’existe pas ici — juste du plus lent au plus rapide.';

export default function HeatmapScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [stats, setStats] = useState<{ min: number; max: number } | null>(null);
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

      const { data } = await supabase
        .from('telemetry_frames')
        .select('latitude, longitude, speed_kmh')
        .eq('session_id', sessionId)
        .order('elapsed_ms', { ascending: true })
        .limit(1000);
      if (cancelled || !data) {
        setLoading(false);
        return;
      }

      const points: TrajectoryPoint[] = (
        data as { latitude: number | null; longitude: number | null; speed_kmh: number | null }[]
      )
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          speed: p.speed_kmh !== null ? Number(p.speed_kmh) : null,
        }));

      if (points.length > 1) {
        setTrajectory(points);
        const speeds = points
          .map((p) => p.speed)
          .filter((sp): sp is number => typeof sp === 'number' && Number.isFinite(sp));
        if (speeds.length > 0) {
          setStats({ min: Math.min(...speeds), max: Math.max(...speeds) });
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Carte de chaleur" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const hasContent = trajectory && trajectory.length > 1;

  // Vitesse → intensité de chaleur (TrackStage normalise en interne).
  const heatPoints: TrackStageHeatPoint[] = (trajectory ?? []).map((p) => ({
    lat: p.lat,
    lon: p.lon,
    intensity: p.speed,
  }));

  // Constat FACTUEL de la carte narrative : dérivé de la vitesse max réelle
  // (telemetry_frames.speed_kmh). Sans vitesse enregistrée : phrase honnête,
  // aucun chiffre inventé.
  const narrative = stats
    ? `Votre vitesse la plus haute est à ${Math.round(stats.max)} km/h. ${NO_RED_REMINDER}`
    : `La vitesse de ce roulage n’a pas été enregistrée. ${NO_RED_REMINDER}`;

  return (
    <Screen>
      <AppBar title="Carte de chaleur" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Eyebrow centré sous le header (maquette). */}
        <Text style={s.eyebrow}>Vitesse le long du tour</Text>

        {!hasContent ? (
          <EmptyState
            message="La carte de chaleur se dessine à partir de la trace GPS de vos tours. Elle apparaîtra après votre premier roulage."
            source="telemetry_frames"
          />
        ) : (
          <>
            {/* HÉROS — tracé coloré par vitesse froid → chaud (speedHeat). */}
            <FadeInSection>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={
                  stats
                    ? `Carte de chaleur de votre vitesse sur le tracé, du froid pour le lent au chaud pour le rapide. Vitesse la plus haute : ${Math.round(stats.max)} kilomètres heure.`
                    : 'Carte de chaleur de votre vitesse sur le tracé, du froid pour le lent au chaud pour le rapide.'
                }
              >
                <TrackStage mode="heatmap" heatPoints={heatPoints} height={400} />
              </View>
            </FadeInSection>

            {/* Légende PLEINE LARGEUR — LENT → RAPIDE (froid → chaud, jamais de rouge) */}
            <FadeInSection delay={120}>
              <View
                style={s.legendRow}
                accessible
                accessibilityRole="text"
                accessibilityLabel="Légende : du lent au rapide"
              >
                <Text style={s.gradLabel}>Lent</Text>
                {/* Rampe froid → chaud partagée (theme.speedHeat) : bleu → cyan →
                    vert → jaune. Même source que le rendu (TrackStage) : la légende
                    ne peut plus mentir. Jamais de rouge (alarme) ni d'or (chrono).
                    Les segments FONDENT en séquence (Stagger, fondu pur). */}
                <View
                  style={s.gradientBar}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Stagger
                    style={s.gradientTrack}
                    itemStyle={s.gradSegItem}
                    interval={90}
                    initialDelay={160}
                    translateY={0}
                  >
                    {speedHeat.map((c, i) => (
                      <View key={i} style={[s.gradSeg, { backgroundColor: c }]} />
                    ))}
                  </Stagger>
                </View>
                {/* « RAPIDE » porte le bout chaud de la rampe (jaune, maquette). */}
                <Text style={[s.gradLabel, { color: speedHeat[speedHeat.length - 1] }]}>
                  Rapide
                </Text>
              </View>
            </FadeInSection>

            {/* CARTE NARRATIVE unique (maquette) : puce or + constat factuel. */}
            <FadeInSection delay={200}>
              <View style={s.narrativeCard} accessible accessibilityRole="text">
                <View style={s.narrativeDot} />
                <Text style={s.narrativeText}>{narrative}</Text>
              </View>
            </FadeInSection>

            {/* Substance conservée sous le héros (parti A) — deux faits réels. */}
            {stats ? (
              <FadeInSection delay={280}>
                <View style={s.factsRow}>
                  <Fact
                    label="Virage le plus lent"
                    value={String(Math.round(stats.min))}
                    unit="km/h"
                  />
                  <Fact
                    label="Ligne la plus rapide"
                    value={String(Math.round(stats.max))}
                    unit="km/h"
                  />
                </View>
              </FadeInSection>
            ) : null}

            <FadeInSection delay={360}>
              <Text style={s.manifest}>La donnée, sans un mot. À vous de la lire.</Text>
            </FadeInSection>
          </>
        )}

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={hitSlop}
            onPress={() => router.back()}
            style={s.backLinkPress}
          >
            <Text style={s.backLink}>Retour</Text>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    color: palette.creamMute,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  legendRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  gradientBar: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden' as const,
  },
  // Rangée des segments (conteneur Stagger) — géométrie inchangée.
  gradientTrack: {
    flexDirection: 'row' as const,
    height: 6,
  },
  // Cellule portée par le wrapper de cascade (Stagger.itemStyle).
  gradSegItem: {
    flex: 1,
  },
  gradSeg: {
    height: 6,
  },
  gradLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  narrativeCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  narrativeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.gold, // puce OR de la maquette (constat, pas alarme)
    marginTop: 5, // aligne la puce sur la première ligne de texte
  },
  narrativeText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
    color: palette.creamSoft,
  },
  factsRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    color: palette.creamMute,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  backLinkPress: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.lg,
  },
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
};
