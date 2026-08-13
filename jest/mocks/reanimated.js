/**
 * FAUX REANIMATED — écrit à la main, et il faut savoir pourquoi.
 *
 * ===========================================================================
 * POURQUOI PAS LE FAUX OFFICIEL
 * ===========================================================================
 *
 * `react-native-reanimated/mock` est inutilisable dans cette version : son
 * `src/mock.ts` importe des VALEURS depuis `./index` (`advanceAnimationByFrame`,
 * `getAnimatedStyle`…), ce qui charge l'index complet, donc les initialiseurs,
 * donc `react-native-worklets`, dont le constructeur lève :
 *
 *     WorkletsError: Native part of Worklets doesn't seem to be initialized.
 *
 * Le contourner demanderait de fabriquer `global.__workletsModuleProxy`, un
 * proxy natif entier. Un faux JS honnête coûte moins cher et ment moins.
 *
 * ===========================================================================
 * CE QUE CE FAUX NE SIMULE PAS — À LIRE AVANT D'ÉCRIRE UN TEST
 * ===========================================================================
 *
 * **Il n'y a pas de fil UI.** Aucun harnais de test n'en a. Par conséquent :
 *
 *   1. `useFrameCallback` N'APPELLE JAMAIS son callback. C'est délibéré :
 *      l'exécuter sur le fil JS donnerait un faux sentiment de couverture d'un
 *      code qui, en production, tourne ailleurs et peut y mourir autrement.
 *      Conséquence directe : tout composant dont l'affichage dépend de
 *      `useFirstViewport` reste INVISIBLE sous test. Un test qui affirme « la
 *      bande s'affiche » échouera — non parce que le code est faux, mais parce
 *      que ce faux ne peut pas le montrer. Ne le contournez pas en assouplissant
 *      l'assertion : testez le composant interne directement.
 *
 *   2. `measure()` rend `null`. C'est ce que rend le vrai `measure` sur une vue
 *      non montée, et c'est la seule valeur honnête ici.
 *
 *   3. Les animations sont INSTANTANÉES : `withTiming(v)` rend `v`. Aucune
 *      durée, aucune interpolation dans le temps. Un test ne peut donc rien
 *      affirmer sur une transition.
 *
 * `useAnimatedStyle` et `useDerivedValue`, EUX, exécutent bien leur fonction :
 * c'est là que vit le code de style, et une erreur dedans doit se voir.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const React = require('react');
const RN = require('react-native');

/** Une valeur partagée : un objet mutable, comme en vrai côté JS. */
function useSharedValue(initial) {
  const ref = React.useRef(null);
  if (ref.current === null) ref.current = { value: initial };
  return ref.current;
}

/**
 * Les animations rendent leur VALEUR CIBLE, immédiatement.
 * Le rappel de fin est appelé avec `true` (terminée) : un composant qui
 * enchaîne sur `finished` ne reste pas bloqué.
 */
const versLaCible = (cible, _config, rappel) => {
  if (typeof _config === 'function') _config(true);
  else if (typeof rappel === 'function') rappel(true);
  return cible;
};

/** Un descripteur d'animation d'entrée/sortie : tout s'enchaîne, rien n'agit. */
function descripteurAnimation() {
  const d = {};
  for (const m of [
    'duration',
    'delay',
    'springify',
    'damping',
    'stiffness',
    'mass',
    'withInitialValues',
    'easing',
    'randomDelay',
    'build',
  ]) {
    d[m] = () => d;
  }
  return d;
}

const ENTREES = [
  'FadeIn',
  'FadeInDown',
  'FadeInUp',
  'FadeInLeft',
  'FadeInRight',
  'FadeOut',
  'FadeOutDown',
  'FadeOutUp',
  'SlideInDown',
  'SlideInUp',
  'SlideOutDown',
  'SlideOutUp',
  'ZoomIn',
  'ZoomOut',
  'Layout',
  'LinearTransition',
  'CurvedTransition',
];

const animations = {};
for (const nom of ENTREES) animations[nom] = descripteurAnimation();

/**
 * Composant animé : le composant React Native équivalent, débarrassé des props
 * qui n'ont aucun sens hors animation (`entering`, `exiting`, `layout`, `sharedTransitionTag`).
 * Les laisser passer ferait avertir React sur des props inconnues à chaque rendu.
 */
function animer(Base, nom) {
  const C = React.forwardRef((props, ref) => {
    // Préfixe `_` : écartées volontairement, la règle de lint le reconnaît.
    const { entering: _e, exiting: _s, layout: _l, sharedTransitionTag: _t, ...reste } = props;
    return React.createElement(Base, { ...reste, ref });
  });
  C.displayName = nom;
  return C;
}

const Animated = {
  View: animer(RN.View, 'Animated.View'),
  Text: animer(RN.Text, 'Animated.Text'),
  Image: animer(RN.Image, 'Animated.Image'),
  ScrollView: animer(RN.ScrollView, 'Animated.ScrollView'),
  FlatList: animer(RN.FlatList, 'Animated.FlatList'),
  createAnimatedComponent: (C) => animer(C, 'Animated.Custom'),
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...animations,

  // --- valeurs et dérivées ---------------------------------------------------
  useSharedValue,
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedStyle: (fn) => fn(),
  useAnimatedProps: (fn) => fn(),
  useAnimatedReaction: () => undefined,
  useAnimatedScrollHandler: () => () => undefined,
  useReducedMotion: () => false,

  /**
   * `useAnimatedRef` — un ref React ordinaire, APPELABLE.
   *
   * En production, le worklet reçoit une fonction `() => sharedWrapper.value`
   * et non l'objet ; on reproduit les deux faces pour que le code qui appelle
   * `ref()` (lecture du tag de vue) ne lève pas sous test.
   */
  useAnimatedRef: () => {
    const ref = React.useRef(null);
    if (typeof ref.current !== 'function') {
      const f = () => null;
      f.current = null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ref.current = f;
    }
    return ref.current;
  },

  // --- animations ------------------------------------------------------------
  withTiming: versLaCible,
  withSpring: versLaCible,
  withDecay: versLaCible,
  withDelay: (_ms, animation) => animation,
  withSequence: (...a) => a[a.length - 1],
  withRepeat: (animation) => animation,
  cancelAnimation: () => undefined,

  // --- fil UI : rien ne s'exécute, et c'est assumé ----------------------------
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  measure: () => null,
  scrollTo: () => undefined,
  useFrameCallback: () => ({ setActive: () => undefined, isActive: false }),

  // --- interpolation ---------------------------------------------------------
  interpolate: (x, entree, sortie) => {
    if (!Array.isArray(entree) || !Array.isArray(sortie) || sortie.length === 0) return x;
    return sortie[0];
  },
  interpolateColor: (_x, _entree, sortie) => (Array.isArray(sortie) ? sortie[0] : sortie),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: new Proxy(
    {},
    {
      get: () => {
        const e = (t) => t;
        return new Proxy(e, { get: () => e, apply: () => e });
      },
    }
  ),
};
