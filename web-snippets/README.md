# web-snippets/ — Surface 1 : page Circuit pour le site oxvehicle.fr

> Pack drop-in **Next.js 14 App Router** + **React 18** + **TypeScript**, prêt à intégrer au repo web OXV pour servir la page publique `/circuit`.

## Ce que c'est

La **carte du circuit Beltoise de Haute Saintonge** est le point de repère visuel partagé entre 3 surfaces OXV :

| Surface                           | Repo         | Composant     |
| --------------------------------- | ------------ | ------------- |
| 1. Page web publique `/circuit`   | site Next.js | **ce pack**   |
| 2. Vue coach (compare 2 sessions) | app RN       | `CoachPreset` |
| 3. Bilan pilote post-session      | app RN       | `PilotPreset` |

Les **trois surfaces partagent les mêmes données** : 76 points GPS OSM (way 54412766) + 7 virages identifiés. Toute évolution topologique (ajout d'un virage, recalibration d'apex) se propage simultanément aux trois.

## Structure

```
web-snippets/
  README.md                         <- vous êtes ici
  app/
    circuit/
      page.tsx                      <- route Next.js /circuit (SSR + client-side anim)
  components/
    CircuitMap/
      CircuitMap.tsx                <- conteneur SVG racine + viewBox
      projection.ts                 <- lat/lon -> coordonnées 2D scène
      index.ts                      <- exports centralisés
      layers/
        TrackLayer.tsx              <- tracé animé (draw-on stroke-dasharray ~1.5s)
        CornersLayer.tsx            <- 7 cercles numérotés (modes : pace/zone/neutral)
        StartArrowLayer.tsx         <- indicateur de départ
      presets/
        PublicPreset.tsx            <- composition pour la vitrine
  data/
    hauteSaintonge.ts               <- 76 points GPS Beltoise (source OSM)
    circuitTopology.ts              <- 7 virages identifiés (apex GPS + pace)
    tokens.ts                       <- couleurs OXV (sous-ensemble web)
  styles/
    circuit.module.css              <- styles minimaux page /circuit
```

## Intégration (5 minutes)

### 1. Copier les dossiers dans votre repo Next.js

```bash
# Depuis la racine du repo site oxvehicle.fr
cp -r path/to/web-snippets/app/circuit          app/circuit
cp -r path/to/web-snippets/components/CircuitMap components/CircuitMap
cp -r path/to/web-snippets/data                  data
cp    path/to/web-snippets/styles/circuit.module.css styles/circuit.module.css
```

### 2. Vérifier les imports `@/`

Si votre `tsconfig.json` utilise un alias différent de `@/*`, soit :

- ajouter `@/*` à `compilerOptions.paths` (recommandé pour rester aligné app/web)
- soit remplacer les imports `@/components/...` par votre alias

### 3. Tester

```bash
npm run dev
# Naviguer vers http://localhost:3000/circuit
```

Vous devez voir :

- Page noire fond OXV (#050505)
- Carte du circuit qui se dessine progressivement (~1.5s)
- 7 cercles gris numérotés (modes neutre pour le public)
- Flèche rouge indiquant la direction de départ
- Données sobres en dessous : longueur, nombre de virages, source OSM

### 4. Personnalisation

| Quoi changer                   | Où                                            |
| ------------------------------ | --------------------------------------------- |
| Texte de la page               | `app/circuit/page.tsx` (sections `<section>`) |
| Mode de coloration des virages | `<CornersLayer colorMode="..." />`            |
| Hauteur de la carte            | `<CircuitMap height={...} />` (default `420`) |
| Animation on/off               | `<TrackLayer animate={false} />`              |
| Couleur du tracé               | `<TrackLayer color="..." />`                  |

## Pourquoi un pack et pas un import depuis l'app RN ?

L'app mobile utilise `react-native-svg` (qui rend en natif iOS/Android). Le web utilise les éléments SVG natifs du navigateur. Les **layers** (`TrackLayer`, `CornersLayer`, etc.) ont la même logique mais des composants différents. Le pack web réimplémente uniquement la couche de rendu — **la projection lat/lon et les données topologiques sont 100% identiques** (mêmes fichiers, copiés-collés).

Avantages :

- Pas de dépendance Expo / React Native dans le repo web
- Pas de runtime cross-platform
- Liberté d'optimiser le bundle web (Next.js Image, SSR, ISR, etc.)

Garantie de cohérence visuelle : tant que `data/hauteSaintonge.ts` et `data/circuitTopology.ts` restent synchronisés entre les deux repos, les trois surfaces affichent la **même carte au pixel près**.

## Synchronisation des données

Quand vous ajustez :

- les **points GPS** du tracé → modifier `src/trackviz/hauteSaintonge.ts` dans le repo app **et** `data/hauteSaintonge.ts` dans le repo web
- les **virages** (noms, apex, pace) → modifier `src/lib/circuitTopology.ts` dans le repo app **et** `data/circuitTopology.ts` dans le repo web

Une étape future possible : extraire ces deux fichiers dans un package npm partagé (`@oxv/circuit-data`) consommé par les deux repos. Pour V1 alpha juillet 2026, le copier-coller manuel est suffisant et plus simple à reviewer.

## Doctrine — vérifications avant déploiement

- [ ] Aucun emoji dans le texte de la page
- [ ] Vouvoiement systématique
- [ ] Pas de verbe d'instruction (« cliquez », « découvrez »)
- [ ] Pas de superlatif marketing (« le meilleur », « unique »)
- [ ] Crédit OSM visible (mention obligatoire `© contributeurs OpenStreetMap`)
- [ ] Source de données mentionnée avec lien (way 54412766)

## Référence

- Brief détaillé : `docs/web-circuit-page/IMPLEMENTATION.md`
- Pacte de pilotage : `docs/juridique/01_PACTE_DE_PILOTAGE.md`
- Design tokens : `docs/screens/01_DESIGN_TOKENS.md`
