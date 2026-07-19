/**
 * PullToRefreshDial — signature OXV : tirer la liste fait suivre le doigt
 * à une aiguille de cadran (rotation ∝ distance, pullAngle) ; relâcher
 * au-delà du seuil déclenche le refresh, un sweep complet de l'aiguille
 * pendant toute sa durée, et un haptic('doorSnap').
 *
 * CHOIX D'IMPLÉMENTATION (documenté, RN 0.74) : gesture Pan à activation
 * manuelle plutôt que RefreshControl ou lecture du bounce iOS.
 *   - RefreshControl ne se stylise pas (spinner natif Android imposé) ;
 *   - le suivi du contentOffset négatif n'existe pas sur Android (pas
 *     d'overscroll) — comportement non déterministe entre plateformes.
 *   - Le Pan manuel s'active UNIQUEMENT quand la liste est en haut
 *     (offset suivi par onScroll) et que le doigt descend ; sinon il
 *     échoue et laisse le scroll natif intact. À l'activation, le geste
 *     natif du scroll est annulé par gesture-handler : le contenu est
 *     alors translaté par Reanimated (dampedPull, résistance).
 *   - On passe bounces=false / overScrollMode='never' au scrollable pour
 *     que le rebond natif ne se superpose pas à la translation.
 *
 * API : `children` est une render prop — étaler `scrollProps` sur la
 * ScrollView ou la FlashList (FlashListProps étend ScrollViewProps).
 * Contrat : `onRefresh` doit faire passer `refreshing` à true puis false.
 *
 * Reduce-motion : le geste reste fonctionnel (manipulation directe),
 * mais pas de boucle de sweep — aiguille fixe pendant le refresh.
 */

import { useCallback, useEffect, useMemo, type ReactElement } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { haptic } from '../haptics';
import { clamp, dampedPull, pullAngle } from './motionMath';
import { colors, motion } from '../tokens';

/** Durée d'un tour complet d'aiguille pendant le refresh. */
const SWEEP_MS = 900;
/** Fraction du seuil où le contenu se stabilise pendant le refresh. */
const HOLD_RATIO = 0.75;

/**
 * Chemins accessibles vers onRefresh : le geste de tirage est invisible
 * pour VoiceOver/TalkBack — magicTap (double-tap deux doigts iOS) et
 * l'action standard refresh le remplacent.
 */
const ACCESSIBILITY_ACTIONS = [
  { name: 'magicTap', label: 'Rafraîchir' },
  { name: 'refresh', label: 'Rafraîchir' },
];

export interface PullScrollProps {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  bounces: boolean;
  overScrollMode: 'never';
}

export interface PullToRefreshDialProps {
  /** Vrai pendant le rafraîchissement (piloté par le parent). */
  refreshing: boolean;
  /** Déclenché au relâchement au-delà du seuil. */
  onRefresh: () => void;
  /** Render prop : étaler `scrollProps` sur la ScrollView/FlashList. */
  children: (scrollProps: PullScrollProps) => ReactElement;
  /** Distance de tirage (px) qui déclenche le refresh. Par défaut 72. */
  threshold?: number;
  /** Diamètre du cadran. Par défaut 40. */
  dialSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function PullToRefreshDial({
  refreshing,
  onRefresh,
  children,
  threshold = 72,
  dialSize = 40,
  style,
}: PullToRefreshDialProps) {
  const reduce = useReduceMotion();

  const scrollTop = useSharedValue(0);
  const pull = useSharedValue(0);
  const sweep = useSharedValue(0);
  const isRefreshing = useSharedValue(false);
  const downY = useSharedValue(0);
  const active = useSharedValue(false);
  const activationOffset = useSharedValue(0);

  // La prop refreshing pilote le sweep et la position de repos.
  useEffect(() => {
    isRefreshing.value = refreshing;
    if (refreshing) {
      pull.value = withSpring(threshold * HOLD_RATIO, motion.springSoft);
      if (reduce) {
        sweep.value = 270;
      } else {
        sweep.value = 0;
        sweep.value = withRepeat(
          withTiming(360, { duration: SWEEP_MS, easing: Easing.linear }),
          -1,
          false
        );
      }
    } else {
      cancelAnimation(sweep);
      sweep.value = 0;
      pull.value = withSpring(0, motion.springSoft);
    }
    return () => {
      cancelAnimation(sweep);
    };
  }, [refreshing, reduce, threshold, isRefreshing, pull, sweep]);

  // Suivi de l'offset — sert uniquement à décider si le Pan peut s'armer.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollTop.value = event.nativeEvent.contentOffset.y;
    },
    [scrollTop]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((event) => {
          downY.value = event.changedTouches[0].absoluteY;
        })
        .onTouchesMove((event, manager) => {
          // Armement uniquement : une fois actif, on ne se juge plus ici.
          if (active.value) return;
          if (isRefreshing.value) {
            manager.fail();
            return;
          }
          const dy = event.changedTouches[0].absoluteY - downY.value;
          if (scrollTop.value <= 1 && dy > 8) {
            manager.activate();
          } else if (dy < -8 || scrollTop.value > 1) {
            manager.fail();
          }
        })
        .onStart((event) => {
          active.value = true;
          // L'activation manuelle arrive après ~8-12 px de course : sans
          // cet offset, le contenu sauterait d'autant à l'armement.
          activationOffset.value = event.translationY;
        })
        .onUpdate((event) => {
          pull.value = Math.max(0, event.translationY - activationOffset.value);
        })
        .onFinalize(() => {
          // Fin OU annulation système : jamais de contenu figé en l'air.
          if (!active.value) return;
          active.value = false;
          if (isRefreshing.value) return;
          if (pull.value >= threshold) {
            runOnJS(haptic)('doorSnap');
            runOnJS(onRefresh)();
            pull.value = withSpring(threshold * HOLD_RATIO, motion.springSoft);
          } else {
            pull.value = withSpring(0, motion.springSoft);
          }
        }),
    [threshold, onRefresh, active, activationOffset, downY, isRefreshing, pull, scrollTop]
  );

  // Chemin accessible : magicTap ou action refresh → onRefresh.
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if ((name === 'magicTap' || name === 'refresh') && !refreshing) {
        onRefresh();
      }
    },
    [refreshing, onRefresh]
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dampedPull(pull.value, threshold) }],
  }));

  const dialStyle = useAnimatedStyle(() => ({
    opacity: clamp(pull.value / 28, 0, 1),
  }));

  const needleStyle = useAnimatedStyle(() => {
    const angle = isRefreshing.value ? sweep.value : pullAngle(pull.value, threshold);
    return { transform: [{ rotate: `${angle}deg` }] };
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.root, style]}
        accessibilityActions={ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={onAccessibilityAction}
      >
        <Animated.View style={[styles.dialZone, { height: threshold }, dialStyle]}>
          <View
            style={[styles.dial, { width: dialSize, height: dialSize, borderRadius: dialSize / 2 }]}
          >
            <Animated.View style={[StyleSheet.absoluteFillObject, styles.needleWrap, needleStyle]}>
              <View style={[styles.needle, { top: dialSize * 0.14, height: dialSize * 0.36 }]} />
            </Animated.View>
            <View style={styles.hub} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.content, contentStyle]}>
          {children({
            onScroll,
            scrollEventThrottle: 16,
            bounces: false,
            overScrollMode: 'never',
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  dialZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dial: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.card,
  },
  needleWrap: {
    alignItems: 'center',
  },
  needle: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.text.hi,
  },
  hub: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.strong,
  },
  content: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
});
