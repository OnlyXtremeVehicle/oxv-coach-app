/**
 * Data Lab — lecture détaillée d'une session (reskin refonte-v2 §7.5).
 *
 * Index de navigation PUR : regroupe les écrans d'analyse rangés sous le Bilan
 * (cf. `appMap.dataLabScreens()`), chacun ouvert avec le `sessionId` courant.
 * AUCUNE logique d'analyse propre — chaque écran cible garde ses services.
 *
 * Maquette (05-datalab.png) : titre « Allez voir de plus près. » (vouvoyé) +
 * ligne d'état de confiance (pastille verte si lecture complète) + grille
 * 2 colonnes de 6 tuiles à icône colorée + 2 tuiles larges Comparer/Insights.
 * Parti A : la substance hors-maquette (Vue unifiée, transparence, export CSV)
 * est CONSERVÉE sous la grille. Vouvoiement, pas d'emoji, jamais prescriptif.
 */

import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { BlindspotsBlock, SourceMethodBlock } from '@/components/InsightTransparency';
import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { dataLabScreens } from '@/lib/appMap';
import { OxvEvent } from '@/services/analyticsEvents';
import { type DataConfidence, computeDataConfidence } from '@/services/dataConfidenceLogic';
import { type DataLabSessionView, getDataLabSessionView } from '@/services/dataLabService';
import { exportSessionFramesCsv } from '@/services/dataExportService';
import { fetchSessionInsights } from '@/services/sessionInsightsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const { palette, dataColors, speedHeat, fonts, fontSize, spacing, radius } = theme;

/* ------------------------------------------------------------------ */
/* Icônes des tuiles (maquette §7.5) — décoratives, 22 px, une couleur */
/* par tuile. L'or sur Carte du circuit / Télémétrie / Insights vient  */
/* de la maquette elle-même (icône d'index, pas une donnée QDI).       */
/* ------------------------------------------------------------------ */

const ICON = 22;

/** Carte du circuit — anneau irrégulier or (tracé de piste). */
function IconCircuit() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M12 3.5 C17 3.5 20.5 6.5 20.5 10.5 C20.5 14 17.5 15 14.5 16 C11.5 17 11.5 20.5 8 20.5 C5 20.5 3.5 17.5 3.5 13.5 C3.5 8 7 3.5 12 3.5 Z"
        stroke={palette.gold}
        strokeWidth={1.8}
        fill="none"
      />
    </Svg>
  );
}

/** Zoom virage — courbe bleue (trajectoire) + point d'apex. */
function IconVirage() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M5 19.5 C11 19.5 10.5 12.5 14.5 9.5"
        stroke={dataColors.trajectory}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={17.5} cy={6.5} r={2} fill={dataColors.trajectory} />
    </Svg>
  );
}

/** Tour par tour — lignes neutres (liste des tours). */
function IconTours() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Line x1={4} y1={7} x2={20} y2={7} stroke={palette.creamSoft} strokeWidth={1.8} />
      <Line x1={4} y1={12} x2={15} y2={12} stroke={palette.creamSoft} strokeWidth={1.8} />
      <Line x1={4} y1={17} x2={18} y2={17} stroke={palette.creamSoft} strokeWidth={1.8} />
    </Svg>
  );
}

/** Carte de chaleur — grille multicolore (rampe vitesse `speedHeat`). */
function IconHeat() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Rect x={4} y={4} width={7.5} height={7.5} rx={2} fill={speedHeat[0]} />
      <Rect x={12.5} y={4} width={7.5} height={7.5} rx={2} fill={speedHeat[1]} />
      <Rect x={4} y={12.5} width={7.5} height={7.5} rx={2} fill={speedHeat[2]} />
      <Rect x={12.5} y={12.5} width={7.5} height={7.5} rx={2} fill={speedHeat[3]} />
    </Svg>
  );
}

/** Rejouer un tour — cercle + triangle neutres (lecture). */
function IconReplay() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={palette.creamSoft} strokeWidth={1.8} fill="none" />
      <Path d="M10.4 8.9 L15.2 12 L10.4 15.1 Z" fill={palette.creamSoft} />
    </Svg>
  );
}

/** Télémétrie — courbe or (canal brut). */
function IconTelemetry() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M3 12 C5.5 5.5 8 5.5 10.5 12 C13 18.5 15.5 18.5 18 12"
        stroke={palette.gold}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Comparer — deux barres neutres côte à côte. */
function IconComparer() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Rect x={6.5} y={9} width={3.5} height={9} rx={1} fill={palette.cream} />
      <Rect x={13} y={6} width={3.5} height={12} rx={1} fill={palette.faint} />
    </Svg>
  );
}

/** Insights — ampoule or (maquette). */
function IconInsights() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M12 3.5 a5.2 5.2 0 0 1 5.2 5.2 c0 2.1 -1.2 3.2 -2 4.4 c-.5 .7 -.8 1.2 -.8 2.1 h-4.8 c0 -.9 -.3 -1.4 -.8 -2.1 c-.8 -1.2 -2 -2.3 -2 -4.4 A5.2 5.2 0 0 1 12 3.5 Z"
        stroke={palette.gold}
        strokeWidth={1.6}
        fill="none"
      />
      <Line x1={9.8} y1={18.5} x2={14.2} y2={18.5} stroke={palette.gold} strokeWidth={1.6} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Tuiles — routes ACTUELLES (appMap), libellés de la maquette vouvoyés */
/* ------------------------------------------------------------------ */

type TileDef = { screen: string; title: string; sub: string; Icon: () => React.JSX.Element };

const GRID_TILES: TileDef[] = [
  { screen: 'carte', title: 'Carte du circuit', sub: 'marge par virage', Icon: IconCircuit },
  { screen: 'virage', title: 'Zoom virage', sub: 'entrée · apex · sortie', Icon: IconVirage },
  { screen: 'tours', title: 'Tour par tour', sub: 'chrono & écarts', Icon: IconTours },
  { screen: 'heatmap', title: 'Carte de chaleur', sub: 'vitesse sur la piste', Icon: IconHeat },
  { screen: 'replay', title: 'Rejouer un tour', sub: 'à votre rythme', Icon: IconReplay },
  { screen: 'telemetry', title: 'Télémétrie', sub: 'G, vitesses, freins', Icon: IconTelemetry },
];

const WIDE_TILES: TileDef[] = [
  {
    screen: 'virage-comparer',
    title: 'Comparer',
    sub: 'deux tours côte à côte',
    Icon: IconComparer,
  },
  { screen: 'insights', title: 'Insights', sub: 'les analyses qualitatives', Icon: IconInsights },
];

/**
 * Ligne d'état de confiance (maquette : pastille + texte court). Même donnée
 * que le Bilan (`computeDataConfidence`) — seule la présentation change.
 * Honnête : verte uniquement si la lecture est complète ; sinon pastille
 * neutre + raisons factuelles ; masquée s'il n'y a encore aucune trame.
 */
function ConfidenceLine({ confidence }: { confidence: DataConfidence | null }) {
  if (!confidence) return null;
  const good = confidence.level === 'complete';
  const dotColor = good
    ? palette.green
    : confidence.level === 'partial'
      ? palette.creamMute
      : palette.faint;
  const text = good
    ? 'Données fiables sur cette séance'
    : [confidence.label, ...confidence.reasons].join(' · ');
  return (
    <View style={s.confidenceRow} accessibilityRole="text" accessibilityLabel={text}>
      <View
        style={[s.confidenceDot, { backgroundColor: dotColor }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[s.confidenceText, good && { color: palette.green }]}>{text}</Text>
    </View>
  );
}

export default function DataLabScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sid = params.sessionId ?? '';
  const [view, setView] = useState<DataLabSessionView | null>(null);
  const [confidence, setConfidence] = useState<DataConfidence | null>(null);
  const [exporting, setExporting] = useState(false);

  async function onExportCsv() {
    if (!sid || exporting) return;
    setExporting(true);
    await exportSessionFramesCsv(sid);
    setExporting(false);
  }

  useEffect(() => {
    if (!sid) return;
    let cancelled = false;
    getDataLabSessionView(sid)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch(() => undefined);
    // Confiance de lecture (PR-53) — même source et même calcul que le Bilan,
    // pour une vérité affichée identique aux deux endroits.
    fetchSessionInsights(sid)
      .then((ins) => {
        if (cancelled) return;
        const dq = ins?.data_quality;
        setConfidence(
          computeDataConfidence(
            dq
              ? {
                  pctValid: dq.pct_valid,
                  framesUsed: dq.frames_used,
                  cornersDetected: dq.corners_detected,
                  lapsValid: dq.laps_detected,
                }
              : null
          )
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sid]);

  // Garde appMap : seules les couches connues de la carte de l'app sont rendues.
  const known = new Set(dataLabScreens());

  function openLayer(screen: string) {
    OxvEvent.datalabCoucheOuverte(screen);
    router.push((sid ? `/(app)/${screen}?sessionId=${sid}` : `/(app)/${screen}`) as never);
  }

  return (
    <Screen>
      <AppBar title="Data Lab" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <FadeInSection>
          <Text style={s.title} accessibilityRole="header">
            Allez voir de plus près.
          </Text>

          {/* Confiance de lecture (T-2, PR-53) — la solidité de la donnée AVANT
              d'ouvrir les couches. Honnête, descriptif, jamais un jugement. */}
          <ConfidenceLine confidence={confidence} />
        </FadeInSection>

        {view?.emptyReason ? (
          <FadeInSection delay={60}>
            <View style={s.banner}>
              <Text style={s.bannerText}>{view.emptyReason}</Text>
            </View>
          </FadeInSection>
        ) : null}

        {/* Grille 2 colonnes de 6 tuiles (maquette §7.5) — cascade d'entrée
            (Stagger) + retour tactile du kit (PressableScale). */}
        <Stagger style={s.grid} itemStyle={s.gridItem} interval={70} initialDelay={120}>
          {GRID_TILES.filter((t) => known.has(t.screen)).map(({ screen, title, sub, Icon }) => {
            const available = !view || screenHasData(screen, view);
            return (
              <PressableScale
                key={screen}
                style={[s.tileSurface, s.tile]}
                haptic="tap"
                onPress={() => openLayer(screen)}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${sub}`}
              >
                <Icon />
                <View>
                  <Text style={s.tileTitle}>{title}</Text>
                  <Text style={s.tileSub}>{sub}</Text>
                  {view && !available ? (
                    <Text style={s.noData}>Pas de données pour cette session</Text>
                  ) : null}
                </View>
              </PressableScale>
            );
          })}
        </Stagger>

        {/* Deux tuiles larges Comparer / Insights (maquette §7.5) — la cascade
            continue après les 6 tuiles de la grille. */}
        <Stagger style={s.grid} itemStyle={s.gridItem} interval={70} initialDelay={560}>
          {WIDE_TILES.filter((t) => known.has(t.screen)).map(({ screen, title, sub, Icon }) => {
            const available = !view || screenHasData(screen, view);
            return (
              <PressableScale
                key={screen}
                style={[s.tileSurface, s.wideTile]}
                haptic="tap"
                onPress={() => openLayer(screen)}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${sub}`}
              >
                <Icon />
                <View style={{ flex: 1 }}>
                  <Text style={s.tileTitle}>{title}</Text>
                  {view && !available ? (
                    <Text style={s.noData}>Pas de données pour cette session</Text>
                  ) : null}
                </View>
              </PressableScale>
            );
          })}
        </Stagger>

        {/* Vue unifiée (Skia, aperçu technique) — un seul canvas tracé + trajectoire.
            Distincte des couches standard : à valider sur un build (rendu natif). */}
        <FadeInSection delay={700}>
          <PressableScale
            style={[s.tileSurface, { marginTop: spacing.md }]}
            haptic="tap"
            onPress={() =>
              router.push(
                (sid
                  ? `/(app)/data-lab-canvas?sessionId=${sid}`
                  : '/(app)/data-lab-canvas') as never
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Vue unifiée. Le tracé et votre trajectoire sur une même vue."
          >
            <Text style={s.tileTitle}>Vue unifiée</Text>
            <Text style={s.tileSub}>Le tracé et votre trajectoire, d’un seul tenant</Text>
          </PressableScale>
        </FadeInSection>

        {/* Transparence (charte 11 §T1/T5, obligatoire) : source/méthode + limites,
            pour cadrer toute la lecture détaillée comme descriptive, jamais un verdict. */}
        <FadeInSection delay={760}>
          <View style={{ marginTop: spacing.xxl }}>
            <SourceMethodBlock
              items={[
                'Chaque couche est calculée à partir des trames de votre boîtier — votre séance, rien d’autre.',
                'Les virages et les tours sont des estimations dérivées du tracé, pas une vérité du circuit.',
              ]}
            />
            <BlindspotsBlock
              items={[
                'L’app montre ce qui s’est passé. Elle ne dit jamais ce qu’il fallait faire.',
                'Elle ignore vos intentions, la trajectoire que vous visiez, votre ressenti.',
                'Aucune couche n’est une note ni un classement.',
              ]}
            />
          </View>
        </FadeInSection>

        {/* Souveraineté data (PR-66) : récupérer la donnée la plus brute du boîtier,
            lisible par n'importe quel tableur, sans dépendre d'OXV (anti-lock-in). */}
        {sid ? (
          <FadeInSection delay={800}>
            <View style={{ marginTop: spacing.xl }}>
              <Button
                label="Exporter les données brutes (CSV)"
                variant="ghost"
                loading={exporting}
                onPress={onExportCsv}
              />
              <Text style={s.exportHint}>
                Les trames du boîtier (25 points/seconde) de cette séance. Vos données vous
                appartiennent.
              </Text>
            </View>
          </FadeInSection>
        ) : null}
      </View>
    </Screen>
  );
}

/** Une couche a-t-elle de la matière pour cette session ? (annotation honnête, non bloquante). */
function screenHasData(screen: string, v: DataLabSessionView): boolean {
  switch (screen) {
    case 'carte':
      return v.frameCount > 0 || v.cornerCount > 0;
    case 'virage':
    case 'virage-comparer':
      return v.cornerCount > 0;
    case 'tours':
      return v.validLapCount > 0;
    case 'heatmap':
    case 'replay':
    case 'telemetry':
      return v.frameCount > 0;
    default:
      return true;
  }
}

const s = {
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
    marginTop: spacing.md,
  },
  confidenceRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  confidenceText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.45,
  },
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  // Cellule de grille portée par le wrapper de cascade (Stagger.itemStyle) :
  // la géométrie 2 colonnes reste identique, la tuile remplit sa cellule.
  gridItem: {
    flexBasis: '47%' as const,
    flexGrow: 1,
  },
  // Surface de carte (mêmes tokens que ui/Card) — la tuile est désormais un
  // PressableScale du kit motion, qui porte lui-même le retour tactile.
  tileSurface: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 44,
  },
  tile: {
    minHeight: 132,
    justifyContent: 'space-between' as const,
    gap: spacing.lg,
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  wideTile: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: 56,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tileTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  tileSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.legend,
    marginTop: spacing.xs,
  },
  banner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  bannerText: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  noData: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: palette.faint,
    marginTop: spacing.sm,
  },
  exportHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.sm,
  },
};
