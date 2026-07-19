/**
 * useFirstViewport — « premier viewport » : vrai une seule fois, quand la vue
 * référencée entre dans la fenêtre. Déclencheur des animations d'apparition
 * des data-viz (RadarQdi, PillarBar, TraceCircuit) sans dépendre du scroll
 * de l'écran hôte.
 *
 * Mécanique : `useFrameCallback` (UI thread) + `measure` sur un
 * `useAnimatedRef`, échantillonné toutes les ~120 ms — pas une animation,
 * juste un test de visibilité, désactivé dès la première détection.
 *
 * `waitForViewport = false` → `visible` vaut vrai immédiatement (l'appelant
 * anime au mount, ou est en reduce-motion et rend l'état final).
 */

import { useCallback, useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import Animated, {
  measure,
  runOnJS,
  useAnimatedRef,
  useFrameCallback,
  useSharedValue,
  type AnimatedRef,
  type FrameInfo,
} from 'react-native-reanimated';

export interface FirstViewport {
  /** À poser sur le Animated.View racine du composant. */
  ref: AnimatedRef<Animated.View>;
  /** Passe à vrai UNE fois (entrée dans la fenêtre, ou immédiatement). */
  visible: boolean;
}

const CHECK_INTERVAL_MS = 120;

export function useFirstViewport(waitForViewport: boolean): FirstViewport {
  const ref = useAnimatedRef<Animated.View>();
  const [visible, setVisible] = useState(!waitForViewport);
  const seen = useSharedValue(!waitForViewport);
  const lastCheck = useSharedValue(0);
  const windowHeight = Dimensions.get('window').height;

  const markVisible = useCallback(() => setVisible(true), []);

  // Worklet STABLE (useCallback sur des références stables : shared values,
  // animated ref, markVisible) : useFrameCallback ré-enregistre le callback
  // côté UI à chaque changement d'identité — un worklet inline neuf à chaque
  // rendu forçait cette réinscription à chaque re-render du composant hôte.
  // La directive 'worklet' est explicite : hors appel direct, le plugin
  // Babel ne workletise plus automatiquement.
  // Coût si la vue n'entre JAMAIS dans la fenêtre : un measure toutes les
  // ~120 ms jusqu'au démontage — un test de visibilité, pas une animation.
  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      if (seen.value) return;
      if (info.timestamp - lastCheck.value < CHECK_INTERVAL_MS) return;
      lastCheck.value = info.timestamp;
      const m = measure(ref);
      if (m === null || m.height <= 0) return;
      if (m.pageY < windowHeight && m.pageY + m.height > 0) {
        seen.value = true;
        runOnJS(markVisible)();
      }
    },
    [seen, lastCheck, ref, windowHeight, markVisible]
  );

  const frame = useFrameCallback(onFrame, waitForViewport);

  // L'appelant cesse d'attendre (ex. reduce-motion arrivé après le mount).
  useEffect(() => {
    if (!waitForViewport && !visible) {
      seen.value = true;
      setVisible(true);
    }
  }, [waitForViewport, visible, seen]);

  // Une fois vu : plus aucun travail par frame.
  useEffect(() => {
    if (visible) frame.setActive(false);
  }, [visible, frame]);

  return { ref, visible };
}
