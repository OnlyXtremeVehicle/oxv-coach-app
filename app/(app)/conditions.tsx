/**
 * Conditions & ressenti (PR-62) — zone Bilan.
 *
 * Juxtapose, pour une séance, les FAITS météo captés (température, conditions,
 * vent) et le RESSENTI libre du pilote (sa note). Volontairement côte à côte,
 * sans tracer le lien à sa place : « Les faits d'un côté, votre ressenti de
 * l'autre. Le lien, c'est vous. » Réutilise weatherService + pilotNotesService.
 * Zéro schéma. Doctrine : miroir pas coach, sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { type PilotNote, listMyNotes } from '@/services/pilotNotesService';
import {
  type WeatherData,
  fetchSessionWeather,
  trackConditions,
  windDirectionCardinal,
} from '@/services/weatherService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function ConditionsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const sid = sessionId ?? '';
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [notes, setNotes] = useState<PilotNote[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!sid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchSessionWeather(sid), listMyNotes()])
      .then(([w, allNotes]) => {
        if (cancelled) return;
        setWeather(w.length > 0 ? w[0] : null);
        setNotes(allNotes.filter((n) => n.sessionId === sid));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sid]);

  useFocusEffect(reload);

  const conditions = weather ? trackConditions(weather) : null;

  return (
    <Screen>
      <AppBar title="CONDITIONS & RESSENTI" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>CETTE SÉANCE</Text>
        <Text style={s.title} accessibilityRole="header">
          Les faits, et vous.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : (
          <>
            {/* Les FAITS : météo captée. */}
            <View style={s.section}>
              <SectionLabel>Conditions captées</SectionLabel>
              <Card style={{ marginTop: theme.spacing.sm }}>
                {weather && conditions ? (
                  <>
                    <View style={s.rowBetween}>
                      <Text style={s.condLabel}>{conditions.label}</Text>
                      <Text style={s.temp}>{Math.round(weather.temperatureC)}°</Text>
                    </View>
                    <Text style={s.condMeta}>
                      Ressenti {Math.round(weather.feelsLikeC)}° · vent{' '}
                      {Math.round(weather.windSpeedKmh)} km/h{' '}
                      {windDirectionCardinal(weather.windDirectionDeg)} · pluie{' '}
                      {Math.round(weather.precipitationProbabilityPct)} %
                    </Text>
                  </>
                ) : (
                  <Text style={s.muted}>Aucune météo n’a été captée pour cette séance.</Text>
                )}
              </Card>
            </View>

            {/* Le RESSENTI : note libre du pilote. */}
            <View style={s.section}>
              <SectionLabel>Votre ressenti</SectionLabel>
              {notes.length > 0 ? (
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  {notes.map((n) => (
                    <Card key={n.id}>
                      <Text style={s.noteBody}>{n.body}</Text>
                    </Card>
                  ))}
                </View>
              ) : (
                <Card style={{ marginTop: theme.spacing.sm }}>
                  <Text style={s.muted}>
                    Vous n’avez pas encore noté votre ressenti pour cette séance.
                  </Text>
                </Card>
              )}
              <View style={{ marginTop: theme.spacing.md }}>
                <Button
                  label="Ouvrir mon carnet"
                  variant="ghost"
                  onPress={() => router.push('/(app)/carnet' as never)}
                />
              </View>
            </View>

            <Text style={s.doctrine}>
              Les faits d’un côté, votre ressenti de l’autre. Le lien, c’est vous qui le faites.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
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
  section: { marginTop: theme.spacing.xl },
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
  condMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  noteBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
  doctrine: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
