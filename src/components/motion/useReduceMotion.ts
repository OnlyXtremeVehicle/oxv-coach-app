/**
 * useReduceMotion — vrai si l'utilisateur a activé « Réduire les animations »
 * au niveau du système (iOS : Accessibilité ▸ Mouvement ; Android : idem).
 *
 * Les composants de motion OXV s'y conforment : quand c'est actif, ils rendent
 * l'état final immédiatement, sans mouvement. Doctrine : le mouvement sert le
 * sens, jamais l'esbroufe — s'il gêne, il s'efface. (WCAG 2.3.3.)
 *
 * ---
 *
 * CE HOOK ÉTAIT ASYNCHRONE, ET C'EST PRÉCISÉMENT CE QUI LE RENDAIT INUTILE
 *
 * L'implémentation précédente appelait `AccessibilityInfo.isReduceMotionEnabled()`,
 * qui rend une promesse. Le hook répondait donc `false` pendant les premières
 * images, puis se corrigeait.
 *
 * Conséquence : **toute l'entrée d'un écran JOUAIT** — fondu, cascade, tracé,
 * compteur — avant de claquer à l'état final. Un utilisateur qui a demandé
 * l'absence de mouvement recevait le mouvement complet, PUIS un saut. C'est pire
 * que de l'ignorer : le saut est lui-même un mouvement brusque, et non annoncé.
 *
 * WCAG 2.3.3 n'était donc pas tenu au premier rendu — c'est-à-dire au seul
 * moment qui compte pour une animation d'entrée.
 *
 * ---
 *
 * LA CORRECTION EST DANS LE HOOK, PAS DANS SES APPELANTS
 *
 * Sept composants du kit v1 le consomment. Les modifier un par un aurait laissé
 * le défaut vivant dans le huitième — celui qu'on écrira demain.
 *
 * `useReducedMotion` de Reanimated lit la valeur côté natif de façon SYNCHRONE :
 * la bonne réponse dès la première image. Le kit V2 (`src/ui/v2/motion/`) l'avait
 * déjà adopté au lot L0 ; les deux kits cessent ici de diverger sur une règle
 * d'accessibilité — ce qui était en soi un défaut, deux réponses possibles à la
 * même question système.
 *
 * **Limite conservée, et connue** : la valeur est lue au montage. Un changement
 * de réglage système en cours de session n'est pas répercuté avant le prochain
 * montage. L'implémentation précédente écoutait bien cet événement, mais au prix
 * du défaut ci-dessus — et le réglage ne bouge pas pendant qu'on roule.
 */

import { useReducedMotion } from 'react-native-reanimated';

export function useReduceMotion(): boolean {
  return useReducedMotion();
}
