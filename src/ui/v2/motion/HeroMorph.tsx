/**
 * HeroMorph — transition carte → écran (l'effet « ça voyage » d'Airbnb).
 *
 * Côté source (la carte tapée) : useHeroMorphSource(id) donne un ref à poser
 * sur la vue et un `capture()` à appeler AVANT la navigation — il fige la
 * géométrie (measureInWindow) dans le registre du HeroMorphProvider.
 *
 * Côté cible (l'écran qui entre) : useHeroMorphTarget(id) donne un ref, un
 * onLayout et un style animé. Au premier layout, la cible mesure sa propre
 * géométrie, se place sur celle de la source (morphFromRects, transform-origin
 * centre) puis rejoint l'identité en spring `motion.spring` (~320 ms).
 *
 * Robustesse (jamais de crash) : géométrie absente, périmée (> 2 s), hors
 * provider ou reduce-motion → fallback door (fondu + translateY 12 → 0).
 * La géométrie est consommée à la prise (take) : un retour arrière puis une
 * nouvelle entrée sans capture retombe proprement sur la porte.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { morphFromRects, type Rect } from './motionMath';
import { motion } from '../tokens';

/** Au-delà de cet âge, une géométrie capturée est considérée périmée. */
const HERO_GEOMETRY_MAX_AGE_MS = 2000;

const DOOR_TRANSLATE_PX = 12;

interface HeroGeometry extends Rect {
  takenAt: number;
}

interface HeroMorphRegistry {
  register: (id: string, geometry: Rect) => void;
  take: (id: string) => HeroGeometry | null;
}

const HeroMorphContext = createContext<HeroMorphRegistry | null>(null);

export function HeroMorphProvider({ children }: { children: ReactNode }) {
  const store = useRef(new Map<string, HeroGeometry>());

  const value = useMemo<HeroMorphRegistry>(
    () => ({
      register: (id, geometry) => {
        store.current.set(id, { ...geometry, takenAt: Date.now() });
      },
      take: (id) => {
        const geometry = store.current.get(id) ?? null;
        store.current.delete(id);
        return geometry;
      },
    }),
    []
  );

  return <HeroMorphContext.Provider value={value}>{children}</HeroMorphContext.Provider>;
}

/**
 * Côté carte : poser `ref` sur la vue source et appeler `capture()`
 * juste avant de naviguer (dans le onPress).
 */
export function useHeroMorphSource(id: string): {
  // React 19 : `useRef<View>(null)` rend `RefObject<View | null>` et non plus
  // `RefObject<View>`. Le type suit le réel — la ref EST nulle avant montage.
  ref: RefObject<View | null>;
  capture: () => void;
} {
  const registry = useContext(HeroMorphContext);
  const ref = useRef<View>(null);

  const capture = useCallback(() => {
    const node = ref.current;
    if (!node || !registry) return;
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) registry.register(id, { x, y, width, height });
    });
  }, [id, registry]);

  return { ref, capture };
}

/**
 * Côté écran : poser `ref` et `onLayout` sur le bloc qui voyage
 * (chrono + tracé du Bilan), et `style` sur ce même bloc.
 */
export function useHeroMorphTarget(id: string) {
  const registry = useContext(HeroMorphContext);
  const reduce = useReduceMotion();
  const ref = useRef<View>(null);
  const started = useRef(false);

  const opacity = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  const runDoorFallback = useCallback(() => {
    if (reduce) {
      ty.value = 0;
      opacity.value = 1;
      return;
    }
    ty.value = DOOR_TRANSLATE_PX;
    opacity.value = withTiming(1, { duration: motion.door, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: motion.door, easing: Easing.out(Easing.cubic) });
  }, [reduce, opacity, ty]);

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (started.current) return;
      const node = ref.current;
      const source = registry ? registry.take(id) : null;
      const fresh = source !== null && Date.now() - source.takenAt <= HERO_GEOMETRY_MAX_AGE_MS;

      if (!node || !fresh || reduce) {
        started.current = true;
        runDoorFallback();
        return;
      }

      node.measureInWindow((x, y, width, height) => {
        if (started.current) return;
        started.current = true;
        const { dx, dy, sx: scaleX, sy: scaleY } = morphFromRects(source, { x, y, width, height });
        if (dx === 0 && dy === 0 && scaleX === 1 && scaleY === 1) {
          // Géométrie dégénérée : la porte fait le travail.
          runDoorFallback();
          return;
        }
        tx.value = dx;
        ty.value = dy;
        sx.value = scaleX;
        sy.value = scaleY;
        opacity.value = 1;
        tx.value = withSpring(0, motion.spring);
        ty.value = withSpring(0, motion.spring);
        sx.value = withSpring(1, motion.spring);
        sy.value = withSpring(1, motion.spring);
      });
    },
    [id, registry, reduce, runDoorFallback, opacity, tx, ty, sx, sy]
  );

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scaleX: sx.value },
      { scaleY: sy.value },
    ],
  }));

  return { ref, onLayout, style };
}
