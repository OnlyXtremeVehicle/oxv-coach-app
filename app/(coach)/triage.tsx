/**
 * Coach — Triage (smart flagging). Reskin refonte-v2 §12, RESPONSIVE deux formats.
 *
 * Les virages où le pilote a le moins de marge sur CETTE séance, classés — « où
 * regarder en premier ». Câble coachTriageService (déjà testé). Carte SVG
 * (PilotPreset) des virages flagués + liste FACTUELLE. Doctrine C3 : le triage
 * désigne, il ne dit pas la CAUSE ni quoi faire — au coach (ou à une suggestion
 * IA qu'il valide) de conclure.
 *
 * Deux formats (décision fondateur 2026-07-13) :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette
 *     coach/04-triage) : deux colonnes — carte des virages à gauche, priorité de
 *     lecture (liste classée + légende de marge) à droite, action « Ouvrir dans
 *     le Studio ».
 *   - COMPAGNON téléphone : une colonne, carte puis liste, même contenu.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Couleur de marge = dégradé §7.6 (rouge de DONNÉE → or midpoint → vert), via
 * marginZoneExportColor — jamais le rouge de marque, jamais l'or décoratif.
 * SVG, pas Skia : tourne en Expo Go et au build.
 *
 * Motion (passe transversale, kit src/components/motion) : en-tête en fondu,
 * liste des virages en cascade (Stagger), sélection en PressableScale — pendant
 * que la carte se dessine (PilotPreset animate, déjà en place). Durées et
 * courbes = celles du kit ; reduce-motion respecté par construction.
 */

import { useEffect, useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { type TriageCorner } from '@/services/coachTriageLogic';
import { getSessionTriage } from '@/services/coachTriageService';
import { marginZoneExportColor } from '@/services/marginZoneColorLogic';
import { loadSessionTrajectory } from '@/services/sessionTelemetryService';
import type { MarginZone } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { useSessionCircuitName } from '@/hooks/useSessionCircuitName';

const { palette, spacing, fonts, fontSize, dataColors } = theme;

export default function CoachTriageScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  // Circuit DÉCLARÉ à la carte : sans lui, elle dessinerait Beltoise sous le
  // nom d'une séance courue ailleurs. `resolving` est replié dans l'état de
  // l'écran pour qu'aucun message d'absence ne clignote pendant la requête.
  const { circuitName, resolving: circuitResolving } = useSessionCircuitName(params.sessionId);
  const sessionId = params.sessionId;

  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [corners, setCorners] = useState<TriageCorner[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getSessionTriage(sessionId)
      .then((rows) => {
        if (!cancelled) {
          setCorners(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    // Trajectoire pour la carte (best-effort : vide avant les trames boîtier).
    loadSessionTrajectory(sessionId)
      .then((pts) => {
        if (!cancelled && pts.length > 1) setTrajectory(pts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  // Couleur des virages flagués sur la carte (zone de marge, dégradé §7.6 canon).
  const zoneByIndex = useMemo(() => {
    const out: Record<number, MarginZone> = {};
    for (const c of corners) {
      if (c.marginZone) out[c.segmentIndex] = c.marginZone as MarginZone;
    }
    return out;
  }, [corners]);

  // Légende de marge seulement si au moins un virage est qualifié (honnêteté).
  const hasMargins = useMemo(() => corners.some((c) => c.marginZone != null), [corners]);

  const state: ScreenState =
    loading || circuitResolving
      ? 'loading'
      : error
        ? 'error'
        : !sessionId || corners.length === 0
          ? 'empty'
          : 'nominal';

  return (
    <Screen>
      <AppBar title="TRIAGE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>
        <FadeInSection>
          <Text style={s.eyebrow}>Où regarder en premier</Text>
          <Text style={s.title} accessibilityRole="header">
            Les virages les plus serrés.
          </Text>
          <Text style={s.subtitle}>Classés par marge — un fait, pas une consigne.</Text>
        </FadeInSection>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Triage en attente"
          emptyMessage={
            sessionId
              ? "Le classement suit l'analyse des marges de la séance."
              : 'Ouvrez le triage depuis une séance de votre file de lecture.'
          }
          emptySource="app_segment_analyses"
          errorCause="Le triage n'a pas pu être chargé."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {/* CONSOLE : carte à gauche, priorité de lecture à droite. COMPAGNON :
              les deux blocs s'empilent (une colonne). Même contenu, un seul arbre. */}
          <View
            style={{
              flexDirection: isConsole ? 'row' : 'column',
              gap: spacing.lg,
              marginTop: spacing.lg,
            }}
          >
            {/* Carte des virages flagués (SVG). Sans trames, la forme du circuit
                suffit à situer ; les couleurs de zone marquent où c'est serré. */}
            <View style={isConsole ? { flex: 1.05 } : undefined}>
              <PilotPreset
                circuitName={circuitName}
                animate
                trajectory={trajectory ?? undefined}
                zoneByIndex={zoneByIndex}
                selectedIndex={selected}
                height={isConsole ? 400 : 300}
              />
            </View>

            {/* Priorité de lecture : en-tête + légende, liste classée, action. */}
            <View style={isConsole ? { flex: 1 } : undefined}>
              <View style={s.priorityHead}>
                <Text style={s.priorityLabel}>Priorité de lecture</Text>
                {hasMargins ? <MarginLegend /> : null}
              </View>

              {/* Priorité de lecture cascadée — chaque virage entre à son tour,
                  pendant que la carte se dessine à gauche. */}
              <Stagger style={{ gap: spacing.sm }}>
                {corners.map((c) => {
                  const active = selected === c.segmentIndex;
                  const zoneColor = c.marginZone ? marginZoneExportColor(c.marginZone) : null;
                  const pct = Math.round(c.marginPercent);
                  return (
                    <PressableScale
                      key={c.segmentIndex}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={c.fact}
                      onPress={() =>
                        setSelected((cur) => (cur === c.segmentIndex ? null : c.segmentIndex))
                      }
                    >
                      <Card style={{ borderColor: active ? palette.edge : palette.line }}>
                        <View style={s.row}>
                          {/* Pastille numérotée = n° du virage, coloré par zone —
                              même repère que les points de la carte. */}
                          <View
                            style={[
                              s.pill,
                              zoneColor ? { backgroundColor: zoneColor } : s.pillNeutral,
                            ]}
                          >
                            <Text
                              style={[
                                s.pillNum,
                                { color: zoneColor ? palette.night : palette.creamMute },
                              ]}
                            >
                              {c.segmentIndex}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.name}>{c.label}</Text>
                            <Text style={s.fact}>{c.fact}</Text>
                          </View>
                          {/* Valeur de marge sur le dégradé §7.6 (neutre si zone
                              non qualifiée) — jamais l'or par défaut. */}
                          <Text style={[s.margin, { color: zoneColor ?? palette.cream }]}>
                            {pct} %
                          </Text>
                        </View>
                      </Card>
                    </PressableScale>
                  );
                })}
              </Stagger>

              {/* Ouvrir la même séance dans le Studio (lecture dense). Route réelle. */}
              {sessionId ? (
                <View style={{ marginTop: spacing.lg }}>
                  <Button
                    variant="ghost"
                    label="Ouvrir dans le Studio"
                    onPress={() =>
                      router.push({
                        pathname: '/(coach)/studio',
                        params: { sessionId },
                      } as never)
                    }
                  />
                </View>
              ) : null}
            </View>
          </View>

          <FadeInSection delay={240}>
            <Text style={s.doctrine}>
              Le triage désigne où regarder. La cause, et la suite, restent à vous.
            </Text>
          </FadeInSection>
        </StateWrapper>
      </View>
    </Screen>
  );
}

/**
 * Légende de marge (handoff §7.6) : faible→large = rouge de DONNÉE → or midpoint
 * → vert, le même dégradé que les pastilles de virage (source cohérente).
 */
function MarginLegend() {
  return (
    <View
      accessible
      accessibilityLabel="Légende des marges : du rouge, marge faible, à l'or puis au vert, marge large."
      style={s.legend}
    >
      <Text style={s.legendLabel}>Marge</Text>
      <Svg width={80} height={6}>
        <Defs>
          <LinearGradient id="triageMarginGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={dataColors.brake} />
            <Stop offset="50%" stopColor={palette.gold} />
            <Stop offset="100%" stopColor={dataColors.accel} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={80} height={6} rx={3} fill="url(#triageMarginGradient)" />
      </Svg>
    </View>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  priorityHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  priorityLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  legend: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  legendLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  pill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pillNeutral: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  pillNum: {
    fontFamily: fonts.monoSemi,
    fontSize: 13,
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  fact: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
    lineHeight: fontSize.small * 1.4,
  },
  margin: {
    fontFamily: fonts.mono,
    fontSize: fontSize.h3,
  },
  doctrine: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
};
