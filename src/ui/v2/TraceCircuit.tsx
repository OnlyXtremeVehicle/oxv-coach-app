/**
 * TraceCircuit — rendu Skia du tracé circuit (lot L0, livrable 7).
 *
 * Trait de fond `border.card` 5 px + `GlowStroke` (lumière DU trait) dont la
 * progression se dessine au premier viewport (motion.pulse, 1,2 s) — ou est
 * pilotée de l'extérieur via `progress`. Puces d'événements (`markers`) qui
 * « claquent » en spring séquencé (DOT_STAGGER_MS) après le tracé.
 *
 * `annotationBand` : bande sous le tracé au bord OR Heritage 2 px — réservée
 * à l'annotation coach (l'or ne sert jamais de chrome générique).
 *
 * Centerline lat/lon (base `circuits.centerline_latlon`) ou déjà métrique —
 * projection via vizMath (réutilise projectToMeters du circuitGenerator).
 * Centerline inexploitable → rien n'est tracé (données réelles, pas de
 * silhouette inventée). Module natif Skia : pas d'Expo Go.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { LatLon } from '@/circuit/circuitGenerator';
import { construireIndex, portion } from '@/telemetry/projectionCurviligne';

import { GlowStroke } from './motion/GlowStroke';
import { useReduceMotion } from './motion/useReduceMotion';
import { SpringDot } from './SpringDot';
import { colors, motion, radius, space, type } from './tokens';
import { useFirstViewport } from './useFirstViewport';
import {
  DOT_STAGGER_MS,
  centerlineToTrace,
  fitTransform,
  pointAtRatio,
  pointsToSvgPath,
  type XY,
} from './vizMath';

export interface TraceMarker {
  /** Position le long du tracé, 0..1 (abscisse curviligne). */
  t: number;
  /** Couleur de la puce (donnée). Défaut text.hi ; or Heritage si annotation coach. */
  color?: string;
}

export interface TraceCircuitProps {
  /** Centerline du circuit : lat/lon (base) ou points métriques {x, y}. */
  centerline: readonly LatLon[] | readonly XY[];
  /** Hauteur du tracé (px). Défaut 180. La largeur suit le conteneur. */
  height?: number;
  /** Tracé bouclé (circuit fermé). Défaut vrai. */
  closed?: boolean;
  /** Progression 0..1 pilotée de l'extérieur ; sinon auto au premier viewport. */
  progress?: number | SharedValue<number>;
  /** Puces d'événements le long du tracé. */
  markers?: readonly TraceMarker[];
  /**
   * Portions du tracé en CONFIANCE DE MESURE RÉDUITE — bornes en mètres le
   * long de la polyligne (abscisses curvilignes, module de projection).
   * Rendues en trait atténué : un voile du fond de carte, jamais une couleur
   * QDI, jamais de rouge — la fragilité de la mesure n'est pas une alerte.
   * Une borne qui ne se projette pas sur ce tracé → AUCUNE portion n'est
   * marquée (l'écran Résumé porte déjà l'information en clair).
   */
  attenues?: readonly { debutM: number; finM: number }[];
  /**
   * Portions du tracé PEINTES PAR UNE DONNÉE — bornes en mètres le long de la
   * polyligne (mêmes abscisses curvilignes que `attenues`), et la couleur que
   * la donnée leur donne.
   *
   * L'appelant choisit la couleur, mais pas n'importe laquelle : elle doit
   * venir d'un rôle de `grammaireViz` (POLARITÉ pour un écart signé, MAGNITUDE
   * pour une grandeur continue). Ni rouge de marque, ni or, ni couleur QDI —
   * ce composant ne le vérifie pas, la grammaire le garantit à la source.
   *
   * Une borne qui ne se projette pas sur ce tracé → AUCUNE portion n'est
   * peinte. Même règle que `attenues` : un marquage partiel silencieux
   * laisserait croire que le reste du tour n'a rien à dire.
   */
  portions?: readonly { debutM: number; finM: number; couleur: string }[];
  /**
   * Couleur du trait de progression. Défaut accent.
   *
   * IGNORÉE quand `portions` est renseigné — voir `TRAIT_EFFACE`.
   */
  color?: string;
  /** Lumière du trait. Défaut accentGlow. */
  glowColor?: string;
  /** Attendre le premier viewport avant d'animer. Défaut vrai. */
  animateOnViewport?: boolean;
  /** Bande annotation coach sous le tracé (bord or Heritage 2 px). */
  annotationBand?: ReactNode;
  /**
   * Masque l'attribution OpenStreetMap. **À n'employer que si l'écran la porte
   * déjà par ailleurs** — jamais pour alléger un rendu.
   *
   * Le défaut est `false`, et c'est délibéré : les tracés de `circuits.
   * centerline_latlon` sont dérivés d'OpenStreetMap, donc sous ODbL, qui
   * impose l'attribution partout où la donnée est montrée. Poser l'obligation
   * ICI la fait suivre la donnée, au lieu de la confier à la mémoire de chaque
   * écran. Relevé le 03/08/2026 : cinq écrans affichaient ce tracé sans
   * attribution.
   */
  attributionMasquee?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TRACE_PADDING = 14;
const BASE_STROKE = 5;
const GLOW_STROKE = 3;
const MARKER_R = 5;
/**
 * Voile des portions en confiance réduite : le fond de carte, semi-opaque,
 * posé SUR le trait — il l'atténue (base et lumière ensemble) sans introduire
 * de couleur. Un peu plus large que le trait de fond pour couvrir ses bords.
 */
const ATTENUE_STROKE = BASE_STROKE + 4;
const ATTENUE_OPACITY = 0.6;
/**
 * Trait des portions peintes : un peu plus large que le trait de fond, pour le
 * couvrir entièrement — bords et lumière compris. Une portion peinte remplace
 * le trait, elle ne le teinte pas.
 */
const PORTION_STROKE = BASE_STROKE + 1;
/**
 * LE TRAIT DU TRACÉ S'EFFACE DÈS QU'UNE DONNÉE LE PEINT.
 *
 * Le trait de progression est ROUGE DE MARQUE par défaut. C'est un accent, pas
 * une donnée — et cela tient tant qu'il est seul. Dès que des portions
 * colorées le recouvrent par endroits, le rouge qui subsiste ENTRE elles se
 * lit comme un troisième pôle : le pilote y verrait une valeur là où il n'y a
 * que du chrome.
 *
 * Le trait passe donc au gris de texte secondaire, et sa lumière avec lui.
 * `colors.accent` reste l'accent unique de la zone — porté par autre chose que
 * la donnée.
 */
const TRAIT_EFFACE = colors.text.dim;
const LUEUR_EFFACEE = 'rgba(120,124,138,0.30)';

export function TraceCircuit({
  centerline,
  height = 180,
  closed = true,
  attributionMasquee = false,
  progress,
  markers = [],
  attenues = [],
  portions = [],
  color = colors.accent,
  glowColor = colors.accentGlow,
  animateOnViewport = true,
  annotationBand,
  style,
}: TraceCircuitProps) {
  const reduce = useReduceMotion();
  const { ref, visible } = useFirstViewport(animateOnViewport && !reduce);
  const [width, setWidth] = useState(0);

  const trace = useMemo(
    () =>
      width > 0
        ? centerlineToTrace(centerline, width, height, TRACE_PADDING, closed)
        : { path: '', points: [] as XY[] },
    [centerline, width, height, closed]
  );

  /**
   * L'index curviligne et le cadrage écran, calculés UNE fois pour tous les
   * marquages posés sur le tracé. Le cadrage est celui du tracé complet —
   * mêmes points sources, même padding —, sans quoi les portions glisseraient
   * de quelques pixels par rapport au trait qu'elles recouvrent.
   */
  const geometrie = useMemo(() => {
    if (width <= 0) return null;
    const index = construireIndex(centerline, closed);
    if (index === null) return null;
    const transform = fitTransform(index.points, width, height, TRACE_PADDING);
    if (transform === null) return null;
    return { index, transform };
  }, [centerline, closed, width, height]);

  // Portions atténuées : abscisses métriques → sous-polylignes (projection
  // curviligne) → écran. Si une borne ne se projette pas (`portion` → null :
  // ces distances et ce tracé ne parlent pas du même tour), on ne marque RIEN
  // — jamais un marquage partiel silencieux.
  const attenuePaths = useMemo(() => {
    if (geometrie === null || attenues.length === 0) return [];
    const chemins: string[] = [];
    for (const zone of attenues) {
      const points = portion(geometrie.index, zone.debutM, zone.finM);
      if (points === null) return [];
      const chemin = pointsToSvgPath(points.map(geometrie.transform), false);
      if (chemin !== '') chemins.push(chemin);
    }
    return chemins;
  }, [attenues, geometrie]);

  // Portions peintes par une donnée. Même règle du tout-ou-rien que
  // ci-dessus : une portion qui ne se projette pas laisserait un trou muet au
  // milieu d'une carte de couleurs, indiscernable d'un « rien à signaler ».
  const portionPaths = useMemo(() => {
    if (geometrie === null || portions.length === 0) return [];
    const peintes: { chemin: string; couleur: string }[] = [];
    for (const p of portions) {
      const points = portion(geometrie.index, p.debutM, p.finM);
      if (points === null) return [];
      const chemin = pointsToSvgPath(points.map(geometrie.transform), false);
      if (chemin !== '') peintes.push({ chemin, couleur: p.couleur });
    }
    return peintes;
  }, [portions, geometrie]);

  // Le trait du tracé s'efface dès qu'une donnée le peint — cf. TRAIT_EFFACE.
  const traitCouleur = portionPaths.length > 0 ? TRAIT_EFFACE : color;
  const traitLueur = portionPaths.length > 0 ? LUEUR_EFFACEE : glowColor;

  const controlled = progress !== undefined;
  const internal = useSharedValue(0);
  const played = useRef(false);

  useEffect(() => {
    if (controlled || played.current || trace.path === '') return;
    if (reduce) {
      played.current = true;
      internal.value = 1;
      return;
    }
    if (!visible) return;
    played.current = true;
    internal.value = withTiming(1, { duration: motion.pulse, easing: Easing.out(Easing.cubic) });
  }, [controlled, reduce, visible, trace.path, internal]);

  // Les puces claquent après le tracé auto ; tout de suite si piloté dehors.
  const markerBaseDelay = controlled || reduce ? 0 : motion.pulse;

  // Le canvas Skia est muet pour les lecteurs d'écran : on le décrit ici.
  // Le label vit sur le Canvas (pas le conteneur) pour ne pas aplatir
  // l'annotationBand ; les puces restent purement visuelles.
  const a11yLabel = `Tracé du circuit${
    markers.length > 0 ? `, ${markers.length} ${markers.length > 1 ? 'repères' : 'repère'}` : ''
  }${
    attenuePaths.length > 0
      ? `, ${attenuePaths.length} ${
          attenuePaths.length > 1 ? 'portions atténuées' : 'portion atténuée'
        } (confiance de mesure réduite)`
      : ''
  }${
    portionPaths.length > 0
      ? `, ${portionPaths.length} ${
          portionPaths.length > 1 ? 'portions colorées' : 'portion colorée'
        } par l’écart avec le tour comparé`
      : ''
  }`;

  return (
    <Animated.View
      ref={ref}
      style={style}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && trace.path !== '' ? (
        <Canvas style={{ width, height }} accessible accessibilityLabel={a11yLabel}>
          <Path
            path={trace.path}
            style="stroke"
            strokeWidth={BASE_STROKE}
            strokeCap="round"
            strokeJoin="round"
            color={colors.border.card}
          />
          <GlowStroke
            path={trace.path}
            color={traitCouleur}
            glowColor={traitLueur}
            strokeWidth={GLOW_STROKE}
            progress={controlled ? progress : internal}
          />
          {/*
            Les portions peintes passent AVANT le voile d'atténuation : une
            zone en confiance réduite doit rester atténuée même si l'appelant
            lui a, par mégarde, donné une couleur.
          */}
          {portionPaths.map((peinte, index) => (
            <Path
              key={`portion-${index}`}
              path={peinte.chemin}
              style="stroke"
              strokeWidth={PORTION_STROKE}
              strokeCap="round"
              strokeJoin="round"
              color={peinte.couleur}
            />
          ))}
          {attenuePaths.map((chemin, index) => (
            <Path
              key={`attenue-${index}`}
              path={chemin}
              style="stroke"
              strokeWidth={ATTENUE_STROKE}
              strokeCap="round"
              strokeJoin="round"
              color={colors.bg.card}
              opacity={ATTENUE_OPACITY}
            />
          ))}
          {markers.map((marker, index) => {
            const at = pointAtRatio(trace.points, marker.t, closed);
            if (at === null) return null;
            return (
              <SpringDot
                key={`marker-${index}`}
                x={at.x}
                y={at.y}
                r={MARKER_R}
                color={marker.color ?? colors.text.hi}
                delay={markerBaseDelay + index * DOT_STAGGER_MS}
                play={visible}
                still={reduce}
              />
            );
          })}
        </Canvas>
      ) : null}

      {/*
        ODbL — l'attribution accompagne le tracé, pas l'écran. Elle n'apparaît
        que lorsqu'un tracé est EFFECTIVEMENT dessiné : rien d'affiché, rien à
        attribuer.
      */}
      {width > 0 && trace.path !== '' && !attributionMasquee ? (
        <Text style={styles.attribution}>© contributeurs OpenStreetMap</Text>
      ) : null}

      {annotationBand ? <View style={styles.annotation}>{annotationBand}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Mention de licence : lisible, jamais bruyante. `dim` est le seul ton assez
  // discret pour ne pas concurrencer la donnée, tout en restant au-dessus du
  // seuil de contraste que les jetons documentent.
  attribution: {
    marginTop: space.xs,
    fontFamily: type.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.text.dim,
    textAlign: 'right',
  },
  // Bord or Heritage 2 px — RÉSERVÉ à l'annotation coach (jamais décoratif).
  annotation: {
    marginTop: space.md,
    borderWidth: 2,
    borderColor: colors.heritage.gold,
    borderRadius: radius.cell,
    padding: space.md,
  },
});
