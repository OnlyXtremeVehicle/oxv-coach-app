/**
 * useCondensingHeader — patron Airbnb : au-delà de 64 px de scroll, le
 * grand header s'efface et une barre condensée (blur sombre + hairline)
 * prend le relais, le titre migre en 12 px.
 *
 * Le hook renvoie :
 *   - scrollHandler   : à poser sur l'onScroll d'un composant Animated
 *                       (Animated.ScrollView, ou FlashList passée dans
 *                       Animated.createAnimatedComponent) ;
 *   - headerStyle     : style du grand header (fondu sortant + léger lift) ;
 *   - condensedStyle  : style de la barre condensée (fondu entrant) ;
 *   - titleStyle      : style du titre (fontSize interpolée vers 12 px) ;
 *   - scrollY         : la valeur partagée brute, si un écran veut aussi
 *                       un parallax (HeroPhoto).
 *
 * <CondensingHeaderBar> est la barre condensée prête à l'emploi :
 * expo-blur tint dark intensité 40 + hairline basse sur iOS. Toute
 * l'interpolation tourne sur l'UI thread (condensedProgress est un worklet).
 *
 * ANDROID (choix documenté, expo-blur ~13) : le BlurView y est inexistant
 * par défaut (experimentalBlurMethod 'none' → vue transparente, le contenu
 * défile en clair sous la barre). L'alternative 'dimezisBlurView' est
 * coûteuse et instable sous contenu défilant (re-blur par frame, artefacts
 * connus) — on lui préfère un repli OPAQUE déterministe : aplat `bg.base`
 * à 0.92 d'opacité, même lisibilité, zéro surprise de rendu.
 */

import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { condensedProgress, lerp } from './motionMath';
import { colors } from '../tokens';

export interface CondensingHeaderOptions {
  /** Scroll (px) à partir duquel le header est totalement condensé. Par défaut 64. */
  threshold?: number;
  /** Largeur (px) de la zone de transition avant le seuil. Par défaut 24. */
  band?: number;
  /** Taille du titre déployé. Par défaut 22. */
  titleFrom?: number;
  /** Taille du titre condensé. Par défaut 12. */
  titleTo?: number;
}

export function useCondensingHeader(options: CondensingHeaderOptions = {}) {
  const { threshold = 64, band = 24, titleFrom = 22, titleTo = 12 } = options;
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    const p = condensedProgress(scrollY.value, threshold, band);
    return { opacity: 1 - p, transform: [{ translateY: -8 * p }] };
  });

  const condensedStyle = useAnimatedStyle(() => ({
    opacity: condensedProgress(scrollY.value, threshold, band),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    fontSize: lerp(titleFrom, titleTo, condensedProgress(scrollY.value, threshold, band)),
  }));

  return { scrollY, scrollHandler, headerStyle, condensedStyle, titleStyle };
}

export interface CondensingHeaderBarProps {
  /** Le `condensedStyle` renvoyé par useCondensingHeader. */
  condensedStyle: StyleProp<ViewStyle>;
  /** Contenu de la barre (titre condensé 12 px, actions). */
  children?: ReactNode;
  /** Hauteur de la barre. Par défaut 52. */
  height?: number;
  /** Intensité du blur. Par défaut 40. */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

export function CondensingHeaderBar({
  condensedStyle,
  children,
  height = 52,
  intensity = 40,
  style,
}: CondensingHeaderBarProps) {
  return (
    <Animated.View pointerEvents="box-none" style={[styles.bar, { height }, condensedStyle, style]}>
      {Platform.OS === 'android' ? (
        // Pas de blur fiable sur Android (voir en-tête) : aplat bg.base.
        <View style={[StyleSheet.absoluteFill, styles.androidBackdrop]} />
      ) : (
        <BlurView tint="dark" intensity={intensity} style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
    zIndex: 10,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Repli Android : opacité sur la vue (pas de rgba en dur), token bg.base.
  androidBackdrop: {
    backgroundColor: colors.bg.base,
    opacity: 0.92,
  },
});
