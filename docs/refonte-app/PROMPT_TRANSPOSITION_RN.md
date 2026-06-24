# Prompt de transposition — Refonte gaming des écrans OXV Mirror en React Native

> À coller dans Claude Code, à la racine du dépôt OXV Mirror (Expo / React Native).
> Pré-requis : `docs/refonte-app/` (14 maquettes gaming + index) est présent, et les
> primitifs maîtres sont déjà posés (voir §Primitifs). Suivi du build :
> `docs/refonte-app/00_BUILD_GAMING.md`.

---

## Contexte

Refonte **strictement visuelle** des 80 écrans dans le langage **« cockpit d'hypercar »**
(école sim premium : Gran Turismo 7 / F1 — jamais arcade). 14 maquettes gaming = 14
archétypes ; chaque écran réel se range sous l'une d'elles (mapping au §3 de l'index).
L'étalon est `maquette_debrief_gaming.html`.

## Règle d'or

Tu ne touches **jamais** à la logique de données : services, hooks, requêtes Supabase,
navigation, état, types. Tu réécris **uniquement le rendu** (JSX et styles). Si une
modification visuelle exige de changer un appel de données, **arrête-toi et signale-le**
au lieu d'agir.

## Décision doctrinale — cockpit FACTUEL (non négociable)

On adopte le **langage** cockpit, jamais son **jugement**.

- **or `#FFB703`** = couleur de **donnée**, neutre : chiffre dominant, jauges, traces.
- **heritageGold `#C4A459`** = tier Heritage + virage signature + **repère** (record, étalon). Jamais ailleurs.
- **red `#C8102E`** = **marque + bande coach (prescriptif) UNIQUEMENT**. **Aucun redline rouge** sur les instruments, **aucune zone vert/jaune/rouge** de performance.
- **green `#4ADE80`** = tendance positive.
- **Un seul chiffre domine** chaque écran. La **bande coach** est le seul espace prescriptif.
- Tokens **exclusifs** : `src/theme/v2.ts` (+ `src/theme/tokens.ts`). Jamais de couleur ni de police en dur.

## Primitifs à utiliser (NE PAS réécrire)

Trois composants maîtres portent déjà le langage gaming. **Compose-les**, ne les réinvente pas :

- **`TrackStage`** — `src/components/CircuitMap/`. Tracé/instrument central, 4 modes :
  `beam` (faisceau de tours), `replay` (curseur animé), `ab` (comparaison A/B),
  `heatmap` (carte de chaleur, **sans rouge**). Réutilise la projection et la géométrie
  du circuit (`CircuitMap`).
- **`GaugeInstrument`** — `src/components/instruments/`. Instrument gradué cockpit
  factuel : arc or, ticks, repère heritageGold, chiffre géant à halo. **Source de vérité
  de l'instrument central** : si une maquette montre un redline rouge, c'est une scorie —
  le composant fait foi (pas de rouge).
- **`CoachBand`** — `src/components/instruments/`. Bande coach rouge bordée, seul lieu
  prescriptif. *(à poser — voir le suivi du build.)*

## Procédure, pour chaque écran

1. Ouvre `docs/refonte-app/00_REFONTE_APP_INDEX.md`, §3 (mapping intégral) → trouve l'archétype.
2. Ouvre la **maquette gaming** correspondante — son en-tête liste les écrans qu'elle couvre.
3. Ouvre les tokens `src/theme/v2.ts` (+ `tokens.ts`). Couleurs/polices **exclusivement** via tokens.
4. Ouvre l'écran RN actuel.
5. Réécris le **rendu** dans la grammaire gaming : fond cockpit (halo or + grille HUD),
   status bar HUD (eyebrow mono UPPERCASE `letter-spacing:.24em` + pastille pulsante),
   **un seul chiffre dominant**, instrument central via `GaugeInstrument` / `TrackStage`,
   séquence de mise sous tension (arc qui se remplit, ticks en balayage, trace qui se
   dessine, barres qui montent, chiffre qui surgit).
6. **Conserve** tous les hooks, appels de services, props de navigation, état. Seul le rendu change.
7. Réutilise les composants conformes (`TrackStage`, `GaugeInstrument`, `CoachBand`,
   `CircuitTraceHero`, `GForceBars` une fois harmonisé) plutôt que de les réécrire.
8. **Bande coach** : rouge, marquée « De votre coach » / « Espace coach ». Tout prescriptif
   y est cantonné ; le reste de l'écran est factuel.

## Ordre conseillé (parcours pilote central d'abord)

`accueil` → `débrief` (étalon) → `insight` → `progression` → `live`, puis le reste
(coach, admin, social, réglages, onboarding).

## Animation

Reanimated + `react-native-svg` (le dépôt utilise `Animated` natif là où il suffit). La
mise sous tension se fait par couches échelonnées (cf. maquettes). Pas de surcharge : le
geste cockpit naît de l'arc et du glow, pas du clinquant.

## Honnêteté des données

Un module sans données réelles (champ vide, télémétrie absente) s'affiche en état
« en attente de la télémétrie RaceBox », avec le nom du champ source — **jamais** un
chiffre inventé.
