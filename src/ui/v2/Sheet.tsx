/**
 * Sheet — le bottom-sheet V2 (lot L0, Livrable 7).
 *
 * @gorhom/bottom-sheet est absent du repo : implémentation Reanimated +
 * gesture-handler pure. Fond `bg.card`, coins hauts `radius.hero`, poignée,
 * backdrop expo-blur léger avec fade, dismiss par swipe vers le bas ou tap
 * sur le backdrop. Décisions de geste pures dans shellLogic
 * (sheetDragOffset, sheetShouldDismiss, defaultSnapHeight) — testées.
 *
 * Cycle de vie : `visible` pilote tout. Le composant reste monté le temps
 * de l'animation de sortie, puis se démonte (null). Un dismiss gestuel
 * appelle `onClose` — le parent repasse `visible` à false et l'animation
 * de sortie part de la position courante du doigt (aucun saut).
 *
 * Reduce-motion : apparition/disparition immédiates, geste conservé
 * (manipulation directe, pas une animation décorative).
 * GestureDetector requiert GestureHandlerRootView à la racine (Livrable 8).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from './motion';
import { defaultSnapHeight, sheetDragOffset, sheetShouldDismiss } from './shellLogic';
import { colors, motion, radius, space } from './tokens';

/** Hauteur de la jupe sous le sheet — couvre l'overshoot du spring. */
const SKIRT_HEIGHT = 40;
/** Intensité du blur du backdrop (léger, le contenu reste deviné). */
const BACKDROP_BLUR = 20;

export interface SheetProps {
  visible: boolean;
  /** Demande de fermeture (swipe bas, tap backdrop). Le parent bascule `visible`. */
  onClose: () => void;
  children: ReactNode;
  /** Hauteur ouverte (px). Par défaut 60 % de la fenêtre, plancher 240. */
  snapHeight?: number;
}

export function Sheet({ visible, onClose, children, snapHeight }: SheetProps) {
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const height = snapHeight ?? defaultSnapHeight(windowHeight);

  const [mounted, setMounted] = useState(visible);

  // Décalage du sheet depuis sa position ouverte : 0 = ouvert, height = caché.
  const ty = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    // Sortie : glisse vers le bas depuis la position courante, puis démonte.
    if (reduce) {
      ty.value = height;
      backdrop.value = 0;
      setMounted(false);
      return;
    }
    backdrop.value = withTiming(0, { duration: motion.door });
    ty.value = withTiming(
      height,
      { duration: motion.door, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished === true) runOnJS(setMounted)(false);
      }
    );
  }, [visible, mounted, height, reduce, ty, backdrop]);

  useEffect(() => {
    if (!visible || !mounted) return;
    // Entrée : depuis le bas, spring doux ; backdrop en fondu.
    if (reduce) {
      ty.value = 0;
      backdrop.value = 1;
      return;
    }
    backdrop.value = withTiming(1, { duration: motion.door });
    ty.value = withSpring(0, motion.springSoft);
  }, [visible, mounted, reduce, ty, backdrop]);

  // Position du sheet au début du geste : un pan qui démarre pendant le
  // spring d'entrée (ty != 0) suit le doigt depuis la position RÉELLE, sans
  // saut. L'offset réel (startTy + translationY) nourrit aussi la décision
  // de dismiss — translationY brut sous-estimerait le tirage effectif.
  const startTy = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startTy.value = ty.value;
        })
        .onUpdate((event) => {
          ty.value = sheetDragOffset(startTy.value + event.translationY);
        })
        .onEnd((event) => {
          if (sheetShouldDismiss(startTy.value + event.translationY, event.velocityY, height)) {
            runOnJS(onClose)();
          } else {
            ty.value = withSpring(0, motion.spring);
          }
        }),
    [height, onClose, ty, startTy]
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, backdropStyle]}>
        {/* ANDROID : repli déterministe (voile bg.base 0.7), même choix que le
            header condensé et la TabBar — le blur expo-blur y est un no-op par
            défaut et dimezisBlurView est coûteux/instable. iOS : vrai blur. */}
        {Platform.OS === 'android' ? (
          <View style={[StyleSheet.absoluteFillObject, styles.androidDim]} />
        ) : (
          <BlurView intensity={BACKDROP_BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
        )}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.sheet, { height }, sheetStyle]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          {/* Poignée fermante : le backdrop est inatteignable derrière la vue
              modale — VoiceOver doit trouver une sortie DANS le sheet. */}
          <Pressable
            style={styles.handlePressable}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={{ top: 8, bottom: 16 }}
          >
            <View style={styles.handle} />
          </Pressable>
          <View style={[styles.content, { paddingBottom: insets.bottom + space.lg }]}>
            {children}
          </View>
          <View style={styles.skirt} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  androidDim: {
    backgroundColor: colors.bg.base,
    opacity: 0.7,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.border.hairline,
  },
  // Pleine largeur, padding vertical symétrique : même géométrie qu'avant
  // (8 + 4 + 8 + 4 = 24 px jusqu'au contenu), mais une vraie cible tactile.
  handlePressable: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border.strong,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  skirt: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -SKIRT_HEIGHT,
    height: SKIRT_HEIGHT,
    backgroundColor: colors.bg.card,
  },
});
