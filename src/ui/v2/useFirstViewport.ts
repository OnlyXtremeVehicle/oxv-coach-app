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

import { tagMesurable, type TagDeVue } from './refMesurable';

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
      /**
       * LE REF PEUT NE JAMAIS AVOIR ÉTÉ ATTACHÉ, ET `measure` NE LE SURVIT PAS.
       *
       * Un appelant qui arme ce hook puis rend `null` — parce qu'une condition
       * de forme n'est pas remplie — laisse `ref.current` à `null` pour
       * toujours. Le garde-fou JS de Reanimated ne l'attrape pas : il ne teste
       * que `viewTag === -1`, et `null !== -1`. L'appel descend donc en natif,
       * où `shadowNodeFromValue` fait `asObject()` sur une valeur nulle et lève
       * une `JSIException`. Émise depuis un frame callback du fil UI, elle n'est
       * rattrapée par personne : **elle tue l'application**.
       *
       * C'est ce qui faisait planter l'écran Data à chaque ouverture le
       * 13/08/2026 — `SectionBande` armait le hook, puis sortait par `return
       * null` tant que la séance portait moins de 25 tours, c'est-à-dire
       * toujours. L'écran se peignait, puis l'app mourait 120 ms plus tard.
       *
       * L'appelant a été corrigé ; cette garde existe pour que le suivant n'ait
       * pas à découvrir le mécanisme au circuit.
       *
       * =====================================================================
       * ET LA PREMIÈRE ÉCRITURE DE CETTE GARDE NE S'EXÉCUTAIT JAMAIS
       * =====================================================================
       *
       * Elle testait `ref.current === null`. Sur le fil JS, c'est juste. Sur le
       * fil UI, `ref` N'EST PAS l'objet JS : `useAnimatedRef` enregistre dans
       * `serializableMappingCache` un handle dont l'`__init` rend la fonction
       * `() => sharedWrapper.value`. Le worklet capture donc une FONCTION
       * FLÉCHÉE, qui n'a pas de propriété `current` — `ref.current` vaut
       * `undefined`, et `undefined === null` est faux. La garde rendait la main
       * à `measure` exactement comme si elle n'existait pas.
       *
       * `measure.js` documente lui-même le piège : « on Native platforms
       * `AnimatedRef` is mapped as a different function ».
       *
       * On lit donc la même chose que `measure` lit — le tag de vue, en
       * appelant le ref — et on refuse ce que `measure` accepte à tort : un tag
       * nul. Reanimated ne teste que `viewTag === -1`.
       *
       * Second piège, si l'on était tenté de revenir au `.current` : au
       * démontage, React appelle le callback avec `null` et `useAnimatedRef` ne
       * réaffecte `fun.current` que dans `if (ref)`. La propriété conserve donc
       * l'ANCIENNE vue, et `ref.current === null` serait faux là aussi.
       */
      const tag = (ref as unknown as () => TagDeVue)();
      if (!tagMesurable(tag)) return;
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
