/**
 * Préparation de séance (PR-26, zone Session) — un dernier regard avant la piste.
 *
 * Quatre blocs sobres : conditions (météo du circuit), check-list (un rituel de
 * pré-vol, items au repos — aucun impératif de pilotage), briefing (délivré sur
 * place par OXV, autorité humaine), intention (question ouverte — la réponse
 * appartient au pilote). Aucun conseil de conduite : l'app montre, ne dirige pas.
 *
 * Zéro schéma : la check-list est éphémère (rituel, pas une donnée), l'intention
 * n'est pas saisie ici (le pilote la garde). Doctrine : sobre, vouvoiement,
 * pas d'emoji, sécurité avant performance.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import {
  type WeatherData,
  fetchCurrentWeather,
  trackConditions,
  windDirectionCardinal,
} from '@/services/weatherService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const INTRO =
  'Le temps de rassembler vos affaires et votre attention. Rien d’autre. La piste vous attend.';

/** Items de pré-vol au repos (noms, pas d'ordres). Rituel éphémère, non persisté. */
const CHECKLIST = [
  'Boîtier OXV chargé',
  'Casque et gants',
  'Licence et papiers du véhicule',
  'Niveaux et pression des pneus',
] as const;

export default function PreparationScreen() {
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getDefaultCircuit();
      if (cancelled) return;
      setCircuit(c);
      if (c && Number.isFinite(c.finishLineLat) && Number.isFinite(c.finishLineLon)) {
        const w = await fetchCurrentWeather(c.finishLineLat, c.finishLineLon);
        if (!cancelled) setWeather(w);
      }
      if (!cancelled) setLoadingWeather(false);
    })().catch(() => {
      if (!cancelled) setLoadingWeather(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((i: number) => {
    setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)));
  }, []);

  const conditions = weather ? trackConditions(weather) : null;
  const doneCount = checked.filter(Boolean).length;

  return (
    <Screen>
      <AppBar title="PRÉPARATION" onBack={() => router.back()} />
      <View style={s.body}>
        <Text style={s.eyebrow}>AVANT DE ROULER</Text>
        <Text style={s.title} accessibilityRole="header">
          Un dernier regard.
        </Text>
        <Text style={s.intro}>{INTRO}</Text>

        {/* Conditions — météo du circuit, factuelle. Aucune consigne de conduite. */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CONDITIONS</Text>
          <Card style={{ marginTop: theme.spacing.sm }}>
            {loadingWeather ? (
              <View style={{ paddingVertical: theme.spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator
                  color={theme.palette.creamMute}
                  accessibilityLabel="Chargement des conditions"
                />
              </View>
            ) : weather && conditions ? (
              <>
                <View style={s.rowBetween}>
                  <Text style={s.condLabel}>{conditions.label}</Text>
                  <Text style={s.temp}>{Math.round(weather.temperatureC)}°</Text>
                </View>
                <Text style={s.circuitName}>
                  {circuit?.name ?? 'Circuit'} · ressenti {Math.round(weather.feelsLikeC)}°
                </Text>
                <View style={s.factsRow}>
                  <Fact label="Vent" value={`${Math.round(weather.windSpeedKmh)} km/h`} />
                  <Fact label="Direction" value={windDirectionCardinal(weather.windDirectionDeg)} />
                  <Fact
                    label="Pluie"
                    value={`${Math.round(weather.precipitationProbabilityPct)} %`}
                  />
                </View>
              </>
            ) : (
              <Text style={s.muted}>
                Conditions indisponibles pour le moment. Fiez-vous à ce que vous voyez sur place.
              </Text>
            )}
          </Card>
        </View>

        {/* Check-list — rituel de pré-vol, éphémère. Items au repos. */}
        <View style={s.section}>
          <View style={s.rowBetween}>
            <Text style={s.sectionLabel}>VOTRE CHECK-LIST</Text>
            <Text style={s.count}>
              {doneCount}/{CHECKLIST.length}
            </Text>
          </View>
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            {CHECKLIST.map((item, i) => {
              const on = checked[i];
              return (
                <Pressable
                  key={item}
                  onPress={() => toggle(i)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={item}
                  hitSlop={6}
                  style={({ pressed }) => [s.checkRow, pressed && { opacity: 0.8 }]}
                >
                  <View style={[s.box, on ? s.boxOn : null]}>
                    {on ? <Text style={s.tick}>✓</Text> : null}
                  </View>
                  <Text style={[s.checkText, on ? s.checkTextOn : null]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Briefing — autorité humaine sur place. Non navigable : c'est un rappel. */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>BRIEFING</Text>
          <Card style={{ marginTop: theme.spacing.sm }}>
            <Text style={s.muted}>
              Le briefing de sécurité est délivré sur place par l’équipe OXV avant chaque session.
              Il prime sur tout ce que vous lirez ici.
            </Text>
          </Card>
          <Card
            onPress={() => router.push('/(app)/pass-oxv' as never)}
            accessibilityLabel="Votre journée d'événement. Pass OXV et documents."
            style={{ marginTop: theme.spacing.sm }}
          >
            <Text style={s.cardTitle}>Votre journée d’événement</Text>
            <Text style={s.cardHint}>Pass OXV, check-in et documents du jour.</Text>
          </Card>
        </View>

        {/* Intention — question ouverte. La réponse appartient au pilote. */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>INTENTION</Text>
          <Card style={{ marginTop: theme.spacing.sm }}>
            <Text style={s.question}>Qu’aimeriez-vous explorer aujourd’hui ?</Text>
            <Text style={s.muted}>
              Gardez-la pour vous. La piste est à vous, les décisions aussi.
            </Text>
          </Card>
          <Card
            onPress={() => router.push('/(app)/objectifs' as never)}
            accessibilityLabel="Vos objectifs. Ce que vous avez choisi de suivre."
            style={{ marginTop: theme.spacing.sm }}
          >
            <Text style={s.cardTitle}>Vos objectifs</Text>
            <Text style={s.cardHint}>Ce que vous avez choisi de suivre, à votre rythme.</Text>
          </Card>
        </View>

        {/* Suite du flux — connecter l'équipement. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Connecter l'équipement"
          onPress={() => router.push('/(app)/equipement' as never)}
          style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={s.primaryBtnText}>Connecter l’équipement</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.factValue}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  );
}

const s = {
  body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  section: { marginTop: theme.spacing.xl },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  condLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  temp: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    color: theme.palette.cream,
    letterSpacing: -0.5,
  },
  circuitName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  factsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  factValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  factLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: 2,
  },
  count: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    minHeight: 44,
    paddingVertical: theme.spacing.xs,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.palette.card2,
  },
  boxOn: { borderColor: theme.palette.edge, backgroundColor: theme.palette.card },
  tick: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.palette.cream,
  },
  checkText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    flex: 1,
  },
  checkTextOn: { color: theme.palette.creamMute },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
  question: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.bodyLg * 1.4,
    marginBottom: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  primaryBtn: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    height: 54,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: theme.spacing.xxl,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: '#050505',
  },
};
