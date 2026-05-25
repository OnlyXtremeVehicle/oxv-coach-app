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
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { GGDiagram, type GGPoint } from '@/components/GGDiagram';
import { SpeedTrace, type SpeedTracePoint } from '@/components/SpeedTrace';
import { supabase } from '@/lib/supabase';
import { loadGGPoints, loadSpeedTracePoints } from '@/services/sessionTelemetryService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

interface SessionPickerRow {
  id: string;
  startedAt: string;
}

export default function TelemetryScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [ggPoints, setGGPoints] = useState<GGPoint[]>([]);
  const [trace, setTrace] = useState<SpeedTracePoint[]>([]);
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

    Promise.all([loadGGPoints(sessionId), loadSpeedTracePoints(sessionId)]).then(([gg, st]) => {
      if (cancelled) return;
      setGGPoints(gg);
      setTrace(st);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>TÉLÉMÉTRIE</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          La signature de votre conduite.
        </Text>
        <Text
          style={[typography.manifest, { color: colors.text.secondary, marginBottom: spacing.xxl }]}
        >
          Deux lectures pour sentir comment vous avez piloté.
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : (
          <>
            {/* Diagramme G-G */}
            <Section eyebrow="ENVELOPPE D'ENGAGEMENT" sublabel="Diagramme g-g">
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
            <Section eyebrow="TRACE VITESSE" sublabel="Vitesse au long du tour">
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
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setComparePickerOpen(true)}
                      style={({ pressed }) => ({
                        marginTop: spacing.lg,
                        padding: spacing.md,
                        borderRadius: borderRadius.md,
                        borderWidth: 0.5,
                        borderColor: colors.border.subtle,
                        alignItems: 'center',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: colors.text.primary,
                          fontSize: fontSize.body,
                          fontWeight: fontWeight.medium,
                        }}
                      >
                        Superposer une autre session
                      </Text>
                    </Pressable>
                  ) : null}

                  {compareId ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setCompareId(null);
                        setComparePickerOpen(false);
                      }}
                      style={({ pressed }) => ({
                        marginTop: spacing.lg,
                        padding: spacing.md,
                        borderRadius: borderRadius.md,
                        borderWidth: 0.5,
                        borderColor: colors.border.subtle,
                        alignItems: 'center',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                        Retirer la superposition
                      </Text>
                    </Pressable>
                  ) : null}

                  {/* Picker session */}
                  {comparePickerOpen && !compareId ? (
                    <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                      <Text
                        style={[
                          typography.eyebrow,
                          { color: colors.text.tertiary, marginBottom: spacing.sm },
                        ]}
                      >
                        CHOISIR LA SESSION À SUPERPOSER
                      </Text>
                      {compareOptions.length === 0 ? (
                        <Text style={typography.caption}>Aucune autre session disponible.</Text>
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
                              padding: spacing.md,
                              borderRadius: borderRadius.md,
                              borderWidth: 0.5,
                              borderColor: colors.border.subtle,
                              backgroundColor: colors.background.secondary,
                              opacity: pressed ? 0.85 : 1,
                            })}
                          >
                            <Text
                              style={{
                                color: colors.text.primary,
                                fontSize: fontSize.body,
                              }}
                            >
                              {dateShort(o.startedAt)}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </>
              )}
            </Section>
          </>
        )}

        {/* Note pédagogique sobre */}
        <View
          style={{
            marginTop: spacing.xxl,
            padding: spacing.lg,
            borderRadius: borderRadius.md,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
          }}
        >
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            Le diagramme g-g représente toutes les accélérations vécues. Un cercle plein indique que
            la voiture a exploité l'enveloppe d'adhérence à 360°. Un cercle creux indique des zones
            inexploitées. La lecture appartient au pilote ou à son coach.
          </Text>
        </View>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <View style={{ marginBottom: spacing.xxxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.xs }]}>{eyebrow}</Text>
      {sublabel ? (
        <Text
          style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.lg }]}
        >
          {sublabel}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={[
        typography.caption,
        {
          color: colors.text.tertiary,
          padding: spacing.lg,
          textAlign: 'center',
        },
      ]}
    >
      {children}
    </Text>
  );
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
