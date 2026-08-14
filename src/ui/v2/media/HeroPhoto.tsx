/**
 * HeroPhoto — photo plein cadre du kit V2 (patron Airbnb).
 *
 * - Coins `radius.hero`, fond `bg.card` pendant le chargement et à défaut
 *   de photo.
 * - Scrim dégradé bas (`bg.scrim` → transparent) : SEULE exception autorisée
 *   à la règle anti-dégradé, réservée à la lisibilité du texte sur photo.
 * - Slot `children` superposé en bas du cadre.
 * - Parallaxe légère optionnelle : `scrollY` (SharedValue Reanimated) →
 *   translateY = (scrollY − parallaxOffset) × 0.3, coupée si « Réduire les
 *   animations ». La couche photo déborde alors de ±PARALLAX_BLEED en haut
 *   et en bas, et la translation est bornée à ce débord : la course de
 *   parallaxe ne découvre jamais le fond.
 * - Hero hors tête de scroll → passer `parallaxOffset` (l'offset Y du hero
 *   dans le contenu du scroll) pour que la parallaxe soit neutre quand le
 *   hero arrive à l'écran.
 * - Pas d'URI → rend `fallback` (tracé Skia du circuit, monogramme…) sur
 *   fond `bg.card`. JAMAIS d'image stock générique.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '@/ui/v2/motion';

import { colors, radius, space } from '../tokens';
import { PARALLAX_BLEED, parallaxTranslateY, scrimGradientColors, scrimHeight } from './mediaMath';
import { Photo } from './Photo';

export interface HeroPhotoProps {
  uri?: string;
  height: number;
  blurhash?: string;
  /**
   * Empreinte ThumbHash de l'image, si elle est connue.
   *
   * Elle manquait ici alors que les quatre grilles de VIGNETTES la passent
   * depuis le 04/08 — c'est-à-dire que le repli soigné servait aux petites
   * images et pas aux GRANDES, celles dont le chargement se voit. Le bilan
   * donnait à ce composant un `SessionMediaItem` complet, hash compris, et le
   * hash était jeté sur le seuil.
   */
  thumbhash?: string;
  children?: React.ReactNode;
  scrollY?: SharedValue<number>;
  /**
   * Offset Y du hero dans le contenu du scroll (px). Par défaut 0 (hero en
   * tête de scroll). Hero placé plus bas → passer son offset pour une
   * parallaxe neutre à son arrivée à l'écran.
   */
  parallaxOffset?: number;
  fallback?: React.ReactNode;
}

// Bornes du dégradé dérivées du token scrim — aucune couleur en dur.
const SCRIM_COLORS = scrimGradientColors(colors.bg.scrim);

/**
 * Hauteur réservée en bas du cadre au contenu de `slot`.
 *
 * Le repli décoratif s'arrête là. Sans cette réserve, il est centré sur le
 * cadre ENTIER et vient se caler exactement derrière le titre et le cadran —
 * les deux dessins occupent le même centre optique.
 *
 * Une valeur fixe, et non une mesure : mesurer le slot demanderait un
 * `onLayout` et un rendu de plus, pour un fond décoratif. 96 points couvrent
 * les deux lignes de texte et le cadran des en-têtes actuels.
 */
const SLOT_RESERVE = 96;

export function HeroPhoto({
  uri,
  height,
  blurhash,
  thumbhash,
  children,
  scrollY,
  parallaxOffset = 0,
  fallback,
}: HeroPhotoProps): React.ReactElement {
  const reduceMotion = useReduceMotion();
  const hasParallax = scrollY !== undefined && !reduceMotion;

  const parallaxStyle = useAnimatedStyle(() => {
    if (scrollY === undefined || reduceMotion) return {};
    return { transform: [{ translateY: parallaxTranslateY(scrollY.value, parallaxOffset) }] };
  }, [scrollY, reduceMotion, parallaxOffset]);

  return (
    <View style={[styles.frame, { height }]}>
      {uri !== undefined ? (
        <>
          <Animated.View
            style={[hasParallax ? styles.photoLayerBleed : StyleSheet.absoluteFill, parallaxStyle]}
          >
            <Photo uri={uri} blurhash={blurhash} thumbhash={thumbhash} style={styles.photo} />
          </Animated.View>
        </>
      ) : (
        /**
         * Décoratif : `pointerEvents="none"` pour que rien de ce fond n'attrape
         * un toucher destiné au contenu posé par-dessus.
         */
        <View style={styles.fallback} pointerEvents="none">
          {fallback}
        </View>
      )}

      {/*
        LE VOILE SE POSE DANS LES DEUX CAS — ET IL NE LE FAISAIT QUE SUR PHOTO.

        Il vivait à l'intérieur de la branche `uri !== undefined`. Sans photo —
        c'est-à-dire le cas NOMINAL aujourd'hui, l'écran de préparation ne
        passant aucune image — le cadran de compte à rebours et le nom du
        circuit se posaient directement sur le tracé du repli, sans rien entre
        les deux. C'est un des « affichages qui se montent dessus » signalés au
        retour du terrain : rien ne casse, l'en-tête devient illisible.

        Il n'y a pas de `zIndex` à régler : en React Native, le dernier frère
        peint par-dessus. L'ordre du fichier EST la profondeur, et c'est le voile
        qui manquait au milieu.
      */}
      <LinearGradient
        colors={SCRIM_COLORS}
        style={[styles.scrim, { height: scrimHeight(height) }]}
        pointerEvents="none"
      />

      {children !== undefined ? <View style={styles.slot}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.hero,
    overflow: 'hidden',
    width: '100%',
  },
  // Couche photo surdimensionnée quand la parallaxe est active : le débord
  // haut/bas absorbe toute la course (bornée à ±PARALLAX_BLEED).
  photoLayerBleed: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -PARALLAX_BLEED,
    bottom: -PARALLAX_BLEED,
  },
  photo: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  /**
   * Le repli est centré sur la partie HAUTE du cadre, pas sur le cadre entier :
   * le bas est occupé par le contenu posé dans `slot`. Centré sur tout, le
   * tracé venait se caler exactement derrière le titre et le cadran.
   */
  fallback: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: SLOT_RESERVE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg },
});
