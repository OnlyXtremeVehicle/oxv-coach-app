/**
 * Écran Télémétrie — visualisations pro d'une session.
 *
 * Deux outils classiques des apps coach pro :
 *
 *   1. Diagramme G-G — nuage de points (gLat, gLong) sur fond de cercle
 *      d'adhérence. Le pilote ou son coach lit la signature : enveloppe
 *      pleine = engagement total, zones creuses = potentiel inexploité.
 *
 *   2. Trace vitesse — courbe vitesse vs progression du tour. Permet de
 *      voir les zones de freinage et de relance. Comparaison facultative
 *      avec une 2e session.
 *
 * Doctrine : pas d'« il faut freiner plus tard », pas de score. L'app
 * montre, le pilote interprète.
 *
 * Reskin V2 : Screen + AppBar + Card/SectionLabel/Button, typo/couleurs
 * @/theme/v2. Les composants de visualisation (GGDiagram, SpeedTrace,
 * ThrottleBrakeTrace, SVG) sont conservés tels quels.
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { GGDiagram, type GGPoint } from '@/components/GGDiagram';
import { SpeedTrace, type SpeedTracePoint } from '@/components/SpeedTrace';
import { ThrottleBrakeTrace, type ThrottleBrakePoint } from '@/components/ThrottleBrakeTrace';
import { supabase } from '@/lib/supabase';
import {
  loadGGPoints,
  loadSpeedTracePoints,
  loadThrottleBrakePoints,
} from '@/services/sessionTelemetryService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

interface SessionPickerRow {
  id: string;
  startedAt: string;
}

export default function TelemetryScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [ggPoints, setGGPoints] = useState<GGPoint[]>([]);
  const [trace, setTrace] = useState<SpeedTracePoint[]>([]);
  const [throttleBrake, setThrottleBrake] = useState<ThrottleBrakePoint[]>([]);
  const [compareTrace, setCompareTrace] = useState<SpeedTracePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareOptions, setCompareOptions] = useState<SessionPickerRow[]>([]);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  // Charge G-G + trace de la session courante
  useEffect(() => {
    if (!params.sessionId) {
      setLoading(false);
      return;
    }
    const sessionId = params.sessionId;
    let cancelled = false;

    Promise.all([
      loadGGPoints(sessionId),
      loadSpeedTracePoints(sessionId),
      loadThrottleBrakePoints(sessionId),
    ]).then(([gg, st, tb]) => {
      if (cancelled) return;
      setGGPoints(gg);
      setTrace(st);
      setThrottleBrake(tb);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  // Charge la liste des autres sessions du pilote pour le picker compare
  useEffect(() => {
    if (!profile || !params.sessionId) return;
    const sessionA = params.sessionId;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('id, started_at')
        .eq('user_id', profile.id)
        .eq('status', 'completed')
        .neq('id', sessionA)
        .order('started_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      const rows = (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        startedAt: r.started_at as string,
      }));
      setCompareOptions(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  // Charge la trace comparée quand sélectionnée
  useEffect(() => {
    if (!compareId) {
      setCompareTrace(null);
      return;
    }
    let cancelled = false;
    loadSpeedTracePoints(compareId).then((points) => {
      if (!cancelled) setCompareTrace(points);
    });
    return () => {
      cancelled = true;
    };
  }, [compareId]);

  return (
    <Screen>
      <AppBar title="TÉLÉMÉTRIE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <SectionLabel>Télémétrie</SectionLabel>
        <Text style={s.title}>La signature de votre conduite.</Text>
        <Text style={s.manifest}>Deux lectures pour sentir comment vous avez piloté.</Text>

        {loading ? (
          <Text style={s.loading}>Chargement…</Text>
        ) : (
          <>
            {/* Diagramme G-G */}
            <Section eyebrow="Enveloppe d'engagement" sublabel="Diagramme g-g">
              {ggPoints.length === 0 ? (
                <EmptyText>
                  Pas de données d'accélération sur cette session. Les diagrammes apparaissent dès
                  qu'une session contient des frames télémétriques complètes.
                </EmptyText>
              ) : (
                <GGDiagram points={ggPoints} />
              )}
            </Section>

            {/* Trace vitesse */}
            <Section eyebrow="Trace vitesse" sublabel="Vitesse au long du tour">
              {trace.length < 2 ? (
                <EmptyText>Pas de données de vitesse exploitables pour cette session.</EmptyText>
              ) : (
                <>
                  <SpeedTrace
                    points={trace}
                    comparePoints={compareTrace}
                    label="Cette session"
                    compareLabel="Session comparée"
                  />

                  {/* CTA Comparer une session */}
                  {!comparePickerOpen && !compareId ? (
                    <View style={{ marginTop: theme.spacing.lg }}>
                      <Button
                        label="Superposer une autre session"
                        variant="ghost"
                        onPress={() => setComparePickerOpen(true)}
                      />
                    </View>
                  ) : null}

                  {compareId ? (
                    <View style={{ marginTop: theme.spacing.lg }}>
                      <Button
                        label="Retirer la superposition"
                        variant="ghost"
                        onPress={() => {
                          setCompareId(null);
                          setComparePickerOpen(false);
                        }}
                      />
                    </View>
                  ) : null}

                  {/* Picker session */}
                  {comparePickerOpen && !compareId ? (
                    <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.xs }}>
                      <View style={{ marginBottom: theme.spacing.sm }}>
                        <SectionLabel>Choisir la session à superposer</SectionLabel>
                      </View>
                      {compareOptions.length === 0 ? (
                        <Text style={s.caption}>Aucune autre session disponible.</Text>
                      ) : (
                        compareOptions.map((o) => (
                          <Pressable
                            accessibilityRole="button"
                            key={o.id}
                            onPress={() => {
                              setCompareId(o.id);
                              setComparePickerOpen(false);
                            }}
                            style={({ pressed }) => ({
                              padding: theme.spacing.md,
                              borderRadius: theme.radius.md,
                              borderWidth: 1,
                              borderColor: theme.palette.line,
                              backgroundColor: theme.palette.card2,
                              opacity: pressed ? 0.85 : 1,
                            })}
                          >
                            <Text style={s.pickerRow}>{formatDateShort(o.startedAt)}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </>
              )}
            </Section>

            {/* Throttle/Brake derived view */}
            <Section eyebrow="Accélération / freinage" sublabel="Dérivé du g longitudinal">
              {throttleBrake.length < 2 ? (
                <EmptyText>
                  Pas de données d'accélération longitudinale exploitables pour cette session.
                </EmptyText>
              ) : (
                <ThrottleBrakeTrace points={throttleBrake} />
              )}
            </Section>
          </>
        )}

        {/* Note pédagogique sobre */}
        <Card style={{ marginTop: theme.spacing.xxl }}>
          <Text style={s.note}>
            Le diagramme g-g représente toutes les accélérations vécues. Un cercle plein indique que
            la voiture a exploité l'enveloppe d'adhérence à 360°. Un cercle creux indique des zones
            inexploitées. La lecture appartient au pilote ou à son coach.
          </Text>
        </Card>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function Section({
  eyebrow,
  sublabel,
  children,
}: {
  eyebrow: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: theme.spacing.xxl }}>
      <View style={s.sectionHead}>
        <View style={s.headDot} />
        <SectionLabel>{eyebrow}</SectionLabel>
      </View>
      {sublabel ? <Text style={s.sublabel}>{sublabel}</Text> : null}
      <View style={{ marginTop: theme.spacing.lg }}>{children}</View>
    </View>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.xxl,
  },
  loading: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
  },
  sublabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  sectionHead: {
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
  caption: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pickerRow: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamSoft,
  },
  empty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    padding: theme.spacing.lg,
    textAlign: 'center' as const,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
