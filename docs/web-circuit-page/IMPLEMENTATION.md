# Implémentation page /circuit — site web oxvehicle.fr

> Brief technique complet pour le développeur web qui intègre la **Surface 1** dans le repo Next.js du site.

## Contexte

La page `/circuit` est la **vitrine publique** du Circuit Beltoise de Haute Saintonge. Elle sert de point de repère visuel partagé avec l'app mobile OXV Coach.

**Une seule carte, trois surfaces** :

| # | Surface | Repo | Composant |
| - | --- | --- | --- |
| 1 | Page web `/circuit` | site Next.js | **PR2** : `web-snippets/components/CircuitMap` (web SVG) |
| 2 | Vue coach (compare A/B) | app mobile RN | **PR3** : `CoachPreset` (à venir) |
| 3 | Bilan pilote post-session | app mobile RN | **PR1 livré** : `PilotPreset` |

## Livrables

Le pack drop-in se trouve à la racine du repo app : `web-snippets/`.

```
web-snippets/
├── README.md                              ← guide d'intégration
├── app/circuit/page.tsx                   ← route Next.js
├── components/CircuitMap/
│   ├── CircuitMap.tsx                     ← conteneur SVG racine
│   ├── projection.ts                      ← lat/lon → 2D
│   ├── index.ts
│   ├── layers/
│   │   ├── TrackLayer.tsx                 ← polyline animée
│   │   ├── CornersLayer.tsx               ← 7 disques numérotés
│   │   └── StartArrowLayer.tsx
│   └── presets/
│       └── PublicPreset.tsx               ← composition vitrine
├── data/
│   ├── hauteSaintonge.ts                  ← 76 points GPS (OSM)
│   ├── circuitTopology.ts                 ← 7 virages
│   └── tokens.ts                          ← couleurs OXV
└── styles/
    └── circuit.module.css                 ← styles minimaux
```

## Étapes d'intégration (côté repo web Next.js)

### 1. Pré-requis

- Next.js 14+ avec App Router activé
- React 18+
- TypeScript 5+
- Alias `@/*` configuré dans `tsconfig.json` (sinon adapter les imports)

### 2. Copie des fichiers

```bash
# Depuis la racine du repo site oxvehicle.fr (Next.js)

# Source = clone du repo app OXV Coach
SRC=../oxv-coach-app/web-snippets

cp -r $SRC/app/circuit             ./app/circuit
cp -r $SRC/components/CircuitMap   ./components/CircuitMap
cp -r $SRC/data                    ./data
cp    $SRC/styles/circuit.module.css ./styles/circuit.module.css
```

### 3. Vérifier `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 4. Test local

```bash
npm run dev
# Ouvrir http://localhost:3000/circuit
```

### 5. Vérification doctrine OXV avant déploiement

- [ ] Aucun emoji dans la page
- [ ] Vouvoiement systématique (« vous », pas « tu »)
- [ ] Pas de verbe d'instruction (« cliquez », « découvrez », « explorez »)
- [ ] Pas de superlatif marketing (« le meilleur », « unique au monde »)
- [ ] Crédit OpenStreetMap présent en footer
- [ ] Animation du tracé fluide (~1.5s ease-out)
- [ ] Carte responsive (test < 480px, 768px, 1200px)
- [ ] Lighthouse accessibilité ≥ 95

## Architecture technique

### Pourquoi un pack et pas un import direct depuis l'app RN ?

L'app mobile utilise `react-native-svg` qui rend en natif iOS/Android via les vues SVG d'UIKit/Android. Le web utilise les éléments SVG natifs du navigateur. Les **layers** ont la même logique métier mais des composants différents.

**Garanties de cohérence** :

| Couche | App RN | Web | Cohérence |
| --- | --- | --- | --- |
| Données GPS (76 pts) | `src/trackviz/hauteSaintonge.ts` | `data/hauteSaintonge.ts` | **Copie exacte** |
| Données virages (7) | `src/lib/circuitTopology.ts` | `data/circuitTopology.ts` | **Copie exacte** |
| Projection lat/lon | `projection.ts` | `projection.ts` | **Copie exacte** |
| ViewBox SVG | `getCircuitViewBox()` | `getCircuitViewBox()` | **Identique** |
| Layers (rendu) | `react-native-svg` | `<svg>` natif | API symétrique |
| Animations | `Animated` API | CSS `@keyframes` | Timing identique (1500ms) |

Tant que les fichiers `data/*.ts` restent synchronisés, les trois surfaces affichent la **même carte au pixel près**.

### Workflow de synchronisation

Quand l'app RN évolue (par exemple, ajustement d'apex après mesure terrain) :

1. Modifier `src/trackviz/hauteSaintonge.ts` ou `src/lib/circuitTopology.ts` côté app
2. Reporter manuellement dans `web-snippets/data/*` (PR commune)
3. Copier vers le repo web

**Étape future possible (post-alpha)** : extraire `data/*.ts` dans un package npm partagé `@oxv/circuit-data` consommé par les deux repos.

## Évolutions prévues

### V1 alpha juillet 2026

- Page statique `/circuit` (livré ici)
- Pas d'interaction sur les virages (juste vitrine)
- Pas de comparaison avec données pilote (privé par défaut)

### V2 (post-alpha, si demande utilisateurs)

- Hover sur virage → tooltip nom + pace
- Lien profond `/circuit?virage=3` qui ouvre le virage 3
- Galerie photos par virage (asset CDN)

### V3 (vision long terme)

- Mode « visite virtuelle » : drag-to-rotate, zoom interactif
- Données météo live affichées (vent, température piste)
- Lien vers réservation track day directement depuis un virage

## Personnalisation rapide

| Quoi changer | Où |
| --- | --- |
| Texte de la page | `app/circuit/page.tsx` (sections `<section>`) |
| Mode de coloration des virages | `<CornersLayer colorMode="pace\|zone\|neutral" />` |
| Hauteur de la carte | `<CircuitMap height={460} />` |
| Animation on/off | `<TrackLayer animate={false} />` |
| Couleur du tracé | `<TrackLayer color="#FFFFFF" />` |
| Padding du viewBox | `web-snippets/components/CircuitMap/projection.ts` const `VIEWBOX_PADDING_PCT` |

## Référence

- Pack drop-in : `web-snippets/`
- Pacte de pilotage : `docs/juridique/01_PACTE_DE_PILOTAGE.md`
- Design tokens : `docs/screens/01_DESIGN_TOKENS.md`
- Architecture CircuitMap : commit `e18c3bc` (PR `feature/circuit-map-pilot-enriched`)
