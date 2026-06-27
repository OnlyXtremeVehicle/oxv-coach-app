/**
 * useReduceMotion — vrai si l'utilisateur a activé « Réduire les animations »
 * au niveau du système (iOS : Accessibilité ▸ Mouvement ; Android : idem).
 *
 * Les composants de motion OXV s'y conforment : quand c'est actif, ils rendent
 * l'état final immédiatement, sans mouvement. Doctrine : le mouvement sert le
 * sens, jamais l'esbroufe — s'il gêne, il s'efface. (WCAG 2.3.3.)
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduce(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
