/**
 * Faux modules natifs du projet « écrans ».
 *
 * ===========================================================================
 * CE QUI EST MOCKÉ, ET CE QUI NE DOIT PAS L'ÊTRE
 * ===========================================================================
 *
 * Un faux de trop est aussi coûteux qu'un faux manquant : il fait passer au vert
 * un écran qui, en vrai, ne rend rien. Chaque entrée ci-dessous a une raison
 * nommée, et trois paquets qu'on croirait nécessaires n'y figurent PAS :
 *
 *   - `react-native-mmkv` livre son propre faux dès que `JEST_WORKER_ID` est
 *     défini (`MMKV.js` : `isTest() ? createMockMMKV() : createMMKV(...)`).
 *     Le mocker à la main remplacerait un stockage en mémoire fonctionnel par
 *     un autre, en moins fidèle ;
 *   - `react-native-svg` se rend comme des composants hôtes nommés
 *     (`RNSVGPath`…), interrogeables par `testID`. C'est le troisième paquet
 *     natif le plus employé du dépôt : le mocker rendrait la moitié des
 *     data-viz invisibles aux tests ;
 *   - `@gorhom/bottom-sheet` n'existe pas ici — `src/ui/v2/Sheet.tsx` est une
 *     implémentation maison Reanimated.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ---------------------------------------------------------------------------
// Reanimated — faux MAISON, et ce n'est pas un choix de confort.
//
// `react-native-reanimated/mock` importe des VALEURS depuis son propre index,
// ce qui charge les initialiseurs, donc `react-native-worklets`, dont le
// constructeur lève « Native part of Worklets doesn't seem to be initialized ».
// Le faux officiel de cette version est inutilisable sans le natif.
//
// Lire l'en-tête de `jest/mocks/reanimated.js` AVANT d'écrire un test qui
// dépend d'une animation ou de `useFirstViewport` : il dit précisément ce qui
// n'est pas simulé.
// ---------------------------------------------------------------------------
jest.mock('react-native-reanimated', () => require('../jest/mocks/reanimated'));

// ---------------------------------------------------------------------------
// Skia — LE VRAI BLOQUANT DE CE DÉPÔT, et il ne se voyait pas.
//
// `src/ui/v2/Dial.tsx` appelle `Skia.Path.Make()` PENDANT LE RENDU, et `Dial`
// part du baril `@/ui/v2` que tire l'écran Data. Le `jestSetup` officiel de
// Skia ne suffit pas ici : il fait `Mock(global.CanvasKit)`, et `CanvasKit`
// n'est fourni que par un `jestEnv` qui exige `canvaskit-wasm` (absent) ET
// remplace l'environnement par un `jest-environment-node` nu — ce qui perdrait
// `customExportConditions: ['require','react-native']` et ferait résoudre
// zustand et @supabase/supabase-js sur leur build ESM.
//
// Faux maison, dimensionné sur la surface RÉELLEMENT utilisée par le dépôt.
// ---------------------------------------------------------------------------
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');

  /** Un chemin Skia : toutes les méthodes rendent `this` (elles s'enchaînent). */
  const fauxChemin = () => {
    const chemin = {};
    for (const m of [
      'addArc',
      'addCircle',
      'addRect',
      'close',
      'lineTo',
      'moveTo',
      'quadTo',
      'cubicTo',
      'transform',
      'offset',
    ]) {
      chemin[m] = () => chemin;
    }
    chemin.toSVGString = () => '';
    chemin.isEmpty = () => true;
    return chemin;
  };

  /** Chaque composant Skia devient une View nommée, repérable par testID. */
  const composant = (nom) => {
    const C = (props) => React.createElement(View, props, props.children);
    C.displayName = nom;
    return C;
  };

  return {
    Skia: {
      Path: { Make: fauxChemin, MakeFromSVGString: fauxChemin },
      XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
      Color: (c) => c,
      Point: (x, y) => ({ x, y }),
    },
    Canvas: composant('Canvas'),
    Group: composant('Group'),
    Path: composant('Path'),
    Circle: composant('Circle'),
    Rect: composant('Rect'),
    RoundedRect: composant('RoundedRect'),
    Line: composant('Line'),
    Text: composant('SkiaText'),
    BlurMask: composant('BlurMask'),
    DashPathEffect: composant('DashPathEffect'),
    LinearGradient: composant('SkLinearGradient'),
    vec: (x, y) => ({ x, y }),
    useFont: () => null,
  };
});

// ---------------------------------------------------------------------------
// Safe area — 54 fichiers .tsx l'importent ; `useSafeAreaInsets()` sans
// fournisseur rend `undefined` et casse tout accès `insets.top`.
// Le paquet livre son propre faux.
// ---------------------------------------------------------------------------
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default
);

// ---------------------------------------------------------------------------
// Gesture handler — `RNGestureHandlerModule` est un module natif ; sans faux il
// n'existe pas. Le paquet livre un setup complet.
// ---------------------------------------------------------------------------
require('react-native-gesture-handler/jestSetup');

// ---------------------------------------------------------------------------
// FlashList — LE FAUX LE PLUS IMPORTANT DE CETTE LISTE, et le plus discret.
//
// Sans son `jestSetup`, la liste se rend SANS ERREUR mais SANS AUCUN ITEM : les
// mesures natives valent zéro. Un test « la liste montre trois séances »
// passerait au vert en n'affichant rien — un test qui confirme une absence,
// c'est-à-dire exactement le défaut que ce harnais existe pour attraper.
// ---------------------------------------------------------------------------
require('@shopify/flash-list/jestSetup');

// ---------------------------------------------------------------------------
// Réseau et permissions — non couverts par les faux d'Expo (ce ne sont pas des
// modules Expo). Les deux paquets livrent le leur.
// ---------------------------------------------------------------------------
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js')
);
jest.mock('react-native-permissions', () => require('react-native-permissions/mock'));
