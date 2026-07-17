/**
 * Écran #14 — Carte du circuit (Data Lab). Reskin FIDÈLE aux maquettes Claude
 * Design refonte-v2 §7.6 (screens/06-carte-circuit.png), décision fondateur.
 *
 * Héros conforme à la maquette (haut → bas) :
 *   header « Carte du circuit » · eyebrow une ligne « {CIRCUIT} · TRAJECTOIRE
 *   RÉELLE » · tracé plein cadre avec pastilles de virage colorées par marge
 *   (rouge=serré → or → vert=large, dégradé validé fondateur) · barre de
 *   légende dégradée « MARGE : faible → large » · carte accent rouge « Le
 *   virage à surveiller » (virage à plus faible marge RÉELLE — masquée sans
 *   donnée) · bouton « Ouvrir le virage N → ».
 *
 * Parti A : les fonctions existantes hors-maquette (couches LayerToggle,
 * aperçu CornerPanel, accès par virage) sont CONSERVÉES sous le héros.
 * Logique/services/nav/RLS inchangés. Doctrine : jamais de fausse donnée —
 * sans marges réelles, les virages restent neutres et la carte focus disparaît.
 */

import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { CornerPanel, type CornerPanelData } from '@/components/CornerPanel';
import { LayerToggle } from '@/components/LayerToggle';
import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { selectFocusCorner } from '@/services/focusCorner';
import { buildMapLayers, defaultActiveLayer, type MapLayerKey } from '@/services/mapLayersLogic';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';
import { loadSessionTrajectory } from '@/services/sessionTelemetryService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const { palette, dataColors, fonts, spacing, radius } = theme;

/** Marges réelles d'une session : zones qualitatives + pourcentages numériques. */
interface MarginData {
  zones: Record<number, MarginZone>;
  numeric: Record<number, number>;
}

export default function CarteScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [marginData, setMarginData] = useState<MarginData | null>(null);
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
      if (!cancelled && res) setMarginData(res);
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
  // analysée), on n'invente rien — les virages restent neutres. (Mémoïsé :
  // référence stable pour le résumé a11y du tracé.)
  const margins = useMemo(() => marginData?.zones ?? {}, [marginData]);
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

  // Le virage à surveiller (maquette §7.6) : celui à plus faible marge RÉELLE,
  // via l'heuristique doctrinale existante (rouge le plus faible, sinon jaune
  // le plus faible, sinon rien). Jamais depuis un mock — carte masquée sans
  // marges de session analysée.
  const focus = useMemo(
    () => (marginData ? selectFocusCorner(marginData.zones, marginData.numeric) : null),
    [marginData]
  );
  // Pourcentage affiché seulement s'il est réellement mesuré (jamais l'estimation par zone).
  const focusPct =
    focus && marginData && marginData.numeric[focus.corner.index] !== undefined
      ? Math.round(marginData.numeric[focus.corner.index])
      : null;

  // Résumé factuel du tracé pour les lecteurs d'écran.
  const mapA11yLabel = useMemo(() => {
    const parts: string[] = [
      `Tracé du circuit${circuit?.name ? ` ${circuit.name}` : ''}, ${BELTOISE_CORNERS.length} virages.`,
    ];
    if (hasTrajectory) parts.push('Votre trajectoire réelle est superposée au tracé.');
    if (zoneByIndex && hasMargins) {
      const zones = Object.values(margins);
      const red = zones.filter((z) => z === 'red').length;
      const yellow = zones.filter((z) => z === 'yellow').length;
      const green = zones.filter((z) => z === 'green').length;
      const counts: string[] = [];
      if (red > 0) counts.push(`${red} en terrain serré`);
      if (yellow > 0) counts.push(`${yellow} à explorer`);
      if (green > 0) counts.push(`${green} confortable${green > 1 ? 's' : ''}`);
      if (counts.length > 0) parts.push(`Marges par virage : ${counts.join(', ')}.`);
    }
    return parts.join(' ');
  }, [circuit?.name, hasTrajectory, zoneByIndex, hasMargins, margins]);

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
      <AppBar title="Carte du circuit" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Eyebrow une seule ligne (maquette) — circuit + nature de la lecture.
            Le TRACÉ se dessine déjà à l'entrée : PilotPreset `animate` porte le
            dessin progressif (même technique dash que DrawInPath du kit). */}
        <FadeInSection>
          <Text style={s.eyebrow} numberOfLines={1}>
            {circuit?.name ? `${circuit.name} · Trajectoire réelle` : 'Trajectoire réelle'}
          </Text>

          {/* Tracé plein cadre (maquette) : pastilles colorées par marge. */}
          <View accessible accessibilityLabel={mapA11yLabel}>
            <PilotPreset
              animate
              trajectory={trajectory ?? undefined}
              trajectoryColorMode={trajectoryColorMode}
              zoneByIndex={zoneByIndex}
              selectedIndex={selectedCorner}
              height={340}
              background={palette.night}
            />
          </View>
        </FadeInSection>

        {/* Barre de légende dégradée — seulement quand les marges colorent
            réellement les pastilles (honnêteté : pas de légende sans donnée). */}
        {zoneByIndex && hasMargins ? (
          <FadeInSection delay={80}>
            <MarginLegendBar />
          </FadeInSection>
        ) : null}

        {/* Carte accent rouge « Le virage à surveiller » — marge réelle la plus
            faible. Masquée sans marge disponible : rien d'inventé. */}
        {focus ? (
          <FadeInSection delay={140}>
            <View style={s.focusCard}>
              <View style={s.focusHead}>
                <View style={s.focusDot}>
                  <Text style={s.focusDotLabel}>{focus.corner.index}</Text>
                </View>
                <Text style={s.focusTitle}>Le virage à surveiller</Text>
              </View>
              <Text style={s.focusBody}>
                {`Votre marge la plus faible est au virage ${focus.corner.index} — ${focus.corner.name}.`}
                {focusPct !== null ? ` Marge estimée ${focusPct} %.` : ''}
              </Text>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir le virage ${focus.corner.index}`}
              haptic="tap"
              onPress={() => openCornerDetail(focus.corner.index)}
              style={s.openBtn}
            >
              <Text style={s.openBtnTxt}>Ouvrir le virage {focus.corner.index} →</Text>
            </PressableScale>
          </FadeInSection>
        ) : null}

        {/* ─────────────────────────────────────────────────────────────
            Sous le héros (parti A) : les fonctions existantes hors-maquette,
            conservées — couches de lecture et accès par virage.
            ───────────────────────────────────────────────────────────── */}

        {/* Couches interactives (Data Lab NG) — choisir l'angle de lecture. */}
        <FadeInSection delay={200}>
          <Text style={s.sectionEyebrow}>Couches de lecture</Text>
          <LayerToggle layers={layers} active={activeLayer} onSelect={setPickedLayer} />
        </FadeInSection>

        {/* Accès par virage → aperçu CornerPanel (remplace l'ancienne liste
            verticale redondante par une rangée compacte de pastilles). */}
        <FadeInSection delay={240}>
          <Text style={s.sectionEyebrow}>Virages</Text>
          <Text style={s.caption}>
            {hasMargins
              ? 'Aperçu au toucher, colorés par votre marge.'
              : 'Aperçu au toucher — marges par virage indisponibles pour cette session.'}
          </Text>
        </FadeInSection>
        {/* Pastilles en cascade courte (Stagger) — la rangée garde sa géométrie,
            chaque pastille est un PressableScale du kit. */}
        <Stagger style={s.cornerRow} interval={40} initialDelay={260}>
          {BELTOISE_CORNERS.map((corner) => {
            const zone = margins[corner.index] ?? null;
            const zoneLabel = zone ? marginLabelOf(zone) : null;
            const isSelected = selectedCorner === corner.index;
            return (
              <PressableScale
                key={corner.index}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={
                  zoneLabel
                    ? `Virage ${corner.index}, ${corner.name}, ${zoneLabel}`
                    : `Virage ${corner.index}, ${corner.name}`
                }
                haptic="tap"
                onPress={() => onCornerTap(corner.index)}
                // 40 px visibles + hitSlop 2 = cible tactile 44 px, sans chevauchement.
                hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                style={[
                  s.cornerChip,
                  { backgroundColor: colorForZone(zone) },
                  isSelected ? s.cornerChipSelected : null,
                ]}
              >
                <Text style={s.cornerIndex}>{corner.index}</Text>
              </PressableScale>
            );
          })}
        </Stagger>

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Retour au bilan"
            onPress={() => router.back()}
            hitSlop={theme.hitSlop}
          >
            <Text style={s.backLink}>Retour au bilan</Text>
          </PressableScale>
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

/**
 * Barre de légende dégradée (maquette §7.6) : faible→large = rouge de donnée
 * → or → vert, le même dégradé de marge que les pastilles (source cohérente).
 */
function MarginLegendBar() {
  return (
    <View
      accessible
      accessibilityLabel="Légende des marges : du rouge, marge faible, à l'or puis au vert, marge large."
      style={s.legendRow}
    >
      <Text style={s.legendLabel}>Marge</Text>
      <View style={{ flex: 1 }}>
        <Svg width="100%" height={6}>
          <Defs>
            <LinearGradient id="marginGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={dataColors.brake} />
              <Stop offset="50%" stopColor={palette.gold} />
              <Stop offset="100%" stopColor={dataColors.accel} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={6} rx={3} fill="url(#marginGradient)" />
        </Svg>
      </View>
      <Text style={[s.legendEnd, { color: dataColors.brake }]}>faible</Text>
      <Text style={[s.legendEnd, { color: dataColors.accel }]}>large</Text>
    </View>
  );
}

function colorForZone(zone: MarginZone | null | undefined): string {
  // Dégradé de marge (handoff §7.6), identique à marginZoneExportColor et aux
  // pastilles CornersLayer : faible→large = ROUGE de donnée → OR → VERT. L'or
  // est le midpoint assumé du dégradé de marge (exception à « or = chrono ») ;
  // le serré en rouge de DONNÉE (freinage), jamais le rouge de marque.
  switch (zone) {
    case 'green':
      return dataColors.accel; // marge large
    case 'yellow':
      return palette.gold; // marge moyenne (midpoint du dégradé)
    case 'red':
      return dataColors.brake; // marge serrée (rouge de donnée)
    default:
      // Pas de donnée pour ce virage : neutre, jamais une couleur de verdict.
      return palette.creamMute;
  }
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    // creamMute (≈ 6.4:1) plutôt que faint : passe WCAG AA, cohérent NG.
    color: palette.creamMute,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  legendRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  legendLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  legendEnd: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  focusCard: {
    marginTop: spacing.xl,
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    // Bordure teintée du rouge de donnée (accent maquette), 30 % d'alpha.
    borderColor: `${dataColors.brake}4D`,
    padding: spacing.lg,
  },
  focusHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  focusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: dataColors.brake,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  focusDotLabel: {
    fontFamily: fonts.monoSemi,
    fontSize: theme.fontSize.small,
    color: palette.night,
  },
  focusTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  focusBody: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    lineHeight: theme.fontSize.body * 1.55,
    color: palette.creamMute,
  },
  openBtn: {
    marginTop: spacing.lg,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.edge,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  openBtnTxt: {
    fontFamily: fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  cornerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  cornerChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cornerChipSelected: {
    // Sélection : liseré crème neutre (cohérent CornersLayer — jamais l'or).
    borderWidth: 2,
    borderColor: palette.cream,
  },
  cornerIndex: {
    fontFamily: fonts.monoSemi,
    fontSize: theme.fontSize.small,
    color: palette.night,
  },
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
};
