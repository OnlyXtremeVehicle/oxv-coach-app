/**
 * Écran #14 — Carte du circuit (bilan post-session).
 *
 * Refactor sem 16 : utilise CircuitMap PilotPreset avec animation
 * d'entrée + trajectoire GPS réelle du pilote superposée au tracé
 * officiel + 7 virages coloriés par sa marge.
 *
 * Tap sur un virage → écran #15 Zoom virage.
 *
 * Reskin V2 : Screen + AppBar + Card/SectionLabel, typo/couleurs @/theme/v2.
 * Le composant carte (PilotPreset, SVG) est conservé tel quel.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { CornerPanel, type CornerPanelData } from '@/components/CornerPanel';
import { LayerToggle } from '@/components/LayerToggle';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { buildMapLayers, defaultActiveLayer, type MapLayerKey } from '@/services/mapLayersLogic';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';
import { loadSessionTrajectory } from '@/services/sessionTelemetryService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Screen } from '@/ui/Screen';

export default function CarteScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [liveMargins, setLiveMargins] = useState<Record<number, MarginZone> | null>(null);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [selectedCorner, setSelectedCorner] = useState<number | null>(null);
  const [pickedLayer, setPickedLayer] = useState<MapLayerKey | null>(null);
  const [panelCorner, setPanelCorner] = useState<CornerPanelData | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDefaultCircuit().then((c) => {
      if (!cancelled) setCircuit(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Charge les vraies marges + la trajectoire GPS si on a un sessionId
  useEffect(() => {
    if (!params.sessionId) return;
    const sessionId = params.sessionId; // narrow avant closures async
    let cancelled = false;

    getCornerMarginsZones(sessionId).then((res) => {
      if (!cancelled && res) setLiveMargins(res.zones);
    });

    // Trajectoire GPS (~1000 frames) via la source unique partagée avec la Vue
    // unifiée — plus de requête inline dupliquée.
    loadSessionTrajectory(sessionId)
      .then((points) => {
        if (!cancelled && points.length > 1) setTrajectory(points);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  // Doctrine : jamais de fausse donnée. Sans marges réelles (pas de session
  // analysée), on n'invente rien — les virages restent neutres.
  const margins = liveMargins ?? {};
  const hasMargins = Object.keys(margins).length > 0;

  // Couches du tracé (Data Lab NG) — disponibilité honnête : la Vitesse attend
  // les trames du boîtier, les Marges attendent l'analyse. Couche par défaut =
  // la plus riche disponible, tant que le pilote n'a pas choisi.
  const hasTrajectory = (trajectory?.length ?? 0) > 1;
  const hasSpeed = trajectory?.some((p) => typeof p.speed === 'number') ?? false;
  const layers = useMemo(
    () => buildMapLayers({ hasTrajectory, hasSpeed, hasMargins }),
    [hasTrajectory, hasSpeed, hasMargins]
  );
  const activeLayer = pickedLayer ?? defaultActiveLayer(layers);
  const trajectoryColorMode = activeLayer === 'vitesse' ? 'speed-heatmap' : 'uniform';
  const zoneByIndex = activeLayer === 'marges' ? margins : undefined;

  // Tap virage → aperçu en feuille basse (CornerPanel). Non destructif : le
  // détail plein écran reste accessible depuis le panneau (openCornerDetail).
  const onCornerTap = (index: number) => {
    setSelectedCorner(index);
    const name = BELTOISE_CORNERS.find((c) => c.index === index)?.name ?? `Virage ${index}`;
    const zone = margins[index] ?? null;
    setPanelCorner({ index, name, zoneLabel: zone ? marginLabelOf(zone) : null });
  };

  const openCornerDetail = (index: number) => {
    setPanelCorner(null);
    router.push({
      pathname: '/(app)/virage',
      params: {
        index: String(index),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  return (
    <Screen>
      <AppBar title="CARTE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>Carte du circuit</Text>
        <Text style={s.title}>{circuit?.name ?? 'Votre circuit'}</Text>

        {/* Carte = l'instrument central : encadrée cockpit (équerres HUD). */}
        <CockpitPanel style={{ paddingHorizontal: theme.spacing.sm }}>
          <PilotPreset
            animate
            trajectory={trajectory ?? undefined}
            trajectoryColorMode={trajectoryColorMode}
            zoneByIndex={zoneByIndex}
            selectedIndex={selectedCorner}
            height={360}
          />

          {/* Couches interactives (Data Lab NG) — choisir l'angle de lecture. */}
          <View style={{ marginTop: theme.spacing.lg }}>
            <LayerToggle layers={layers} active={activeLayer} onSelect={setPickedLayer} />
          </View>
        </CockpitPanel>

        <Text style={s.caption}>
          {hasMargins
            ? `${BELTOISE_CORNERS.length} virages — zoom au toucher`
            : `${BELTOISE_CORNERS.length} virages — marges par virage indisponibles pour cette session`}
        </Text>

        {/* Liste tappable des virages */}
        <View style={{ gap: theme.spacing.xs }}>
          {BELTOISE_CORNERS.map((corner) => {
            const zone = margins[corner.index] ?? null;
            const zoneLabel = zone ? marginLabelOf(zone) : null;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  zoneLabel
                    ? `Virage ${corner.index}, ${corner.name}, ${zoneLabel}`
                    : `Virage ${corner.index}, ${corner.name}`
                }
                key={corner.index}
                onPress={() => onCornerTap(corner.index)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  minHeight: 44,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.palette.line,
                  backgroundColor: theme.palette.card2,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colorForZone(zone),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={s.cornerIndex}>{corner.index}</Text>
                </View>
                <Text style={s.cornerName}>{corner.name}</Text>
                <Text style={s.chevron} accessibilityElementsHidden>
                  ›
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour au bilan"
            onPress={() => router.back()}
            hitSlop={theme.hitSlop}
          >
            <Text style={s.backLink}>Retour au bilan</Text>
          </Pressable>
        </View>
      </View>

      {/* Aperçu virage en feuille basse — superposé, n'altère pas le flux. */}
      <CornerPanel
        corner={panelCorner}
        onClose={() => setPanelCorner(null)}
        onOpenDetail={openCornerDetail}
      />
    </Screen>
  );
}

function colorForZone(zone: MarginZone | null | undefined): string {
  // Dégradé de marge (handoff §7.6), identique à marginZoneExportColor et aux
  // pastilles CornersLayer : faible→large = ROUGE de donnée → OR → VERT. L'or
  // est le midpoint assumé du dégradé de marge (exception à « or = chrono ») ;
  // le serré en rouge de DONNÉE (freinage), jamais le rouge de marque.
  switch (zone) {
    case 'green':
      return theme.dataColors.accel; // marge large
    case 'yellow':
      return theme.palette.gold; // marge moyenne (midpoint du dégradé)
    case 'red':
      return theme.dataColors.brake; // marge serrée (rouge de donnée)
    default:
      // Pas de donnée pour ce virage : neutre, jamais une couleur de verdict.
      return theme.palette.creamMute;
  }
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    // creamMute (≈ 6.4:1) plutôt que faint : passe WCAG AA, cohérent NG.
    color: theme.palette.creamMute,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cornerIndex: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.night,
    fontSize: 13,
  },
  cornerName: {
    flex: 1,
    fontFamily: theme.fonts.body,
    color: theme.palette.cream,
    fontSize: theme.fontSize.body,
  },
  chevron: {
    color: theme.palette.creamMute,
    fontSize: 18,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
