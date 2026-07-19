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

export function HeroPhoto({
  uri,
  height,
  blurhash,
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
            <Photo uri={uri} blurhash={blurhash} style={styles.photo} />
          </Animated.View>
          <LinearGradient
            colors={SCRIM_COLORS}
            style={[styles.scrim, { height: scrimHeight(height) }]}
            pointerEvents="none"
          />
        </>
      ) : (
        <View style={styles.fallback}>{fallback}</View>
      )}
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
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg },
});
