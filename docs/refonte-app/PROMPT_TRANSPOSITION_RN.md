# Prompt de transposition — Refonte des écrans OXV Mirror en React Native

> À coller dans Claude Code, à la racine du dépôt OXV Mirror (Expo / React Native).
> Pré-requis : le dossier `docs/refonte-app/` (14 maquettes + index) est présent dans le dépôt.

---

## Contexte

Le dossier `docs/refonte-app/` contient **14 maquettes HTML de référence** et un index (`00_REFONTE_APP_INDEX.md`). Ces maquettes figent la nouvelle grammaire visuelle de l'application. Ta mission : **transposer les écrans React Native** pour qu'ils appliquent cette grammaire, écran par écran.

## Règle d'or

La refonte est **strictement visuelle**. Tu ne touches **jamais** à la logique de données : services, hooks, requêtes Supabase, navigation, état, types. Tu réécris **uniquement le rendu** (JSX et styles). Si une modification visuelle exige de changer un appel de données, **arrête-toi et signale-le** au lieu d'agir.

## Procédure, pour chaque écran

1. Ouvre `docs/refonte-app/00_REFONTE_APP_INDEX.md` et trouve l'archétype de l'écran au §3 (mapping intégral).
2. Ouvre la **maquette de référence** correspondante — son en-tête liste précisément les écrans qu'elle couvre.
3. Ouvre les tokens : `src/theme/v2.ts` et `src/theme/tokens.ts`. Utilise **exclusivement** ces tokens — jamais de couleur ni de police en dur.
4. Ouvre l'écran RN actuel.
5. Réécris le rendu pour appliquer la grammaire de la maquette : eyebrow mono en tête de bloc, **un seul chiffre dominant**, cartes noires bordées, hiérarchie, lecture factuelle à filet gold, primitives de ligne pour les formulaires.
6. **Conserve** tous les hooks, appels de services, props de navigation, état. Seul le rendu change.
7. Réutilise les composants existants déjà conformes (`CircuitTraceHero`, etc.) plutôt que de les réécrire.

## Ordre d'exécution

Procède **archétype par archétype**. Pour chacun :
1. Commence par **un seul** écran, le plus simple.
2. Montre le diff, attends la validation sur device.
3. Décline ensuite les autres écrans du même archétype en série.

Ordre conseillé des archétypes :
**Hub → Liste → Analyse (débrief) → Insight → Formulaire/réglages → Comparaison A/B → Carte de chaleur → Fiche circuit → Écran live → Onboarding → Carte de partage → Mon coach → Espace coach → Admin.**

## Garde-fous doctrinaux — non négociables

1. **Côté pilote : factuel exclusivement.** Aucun impératif, aucune prescription. Jamais « vous perdez 0,3 s parce que… » ; toujours « dispersion de trajectoire au virage 3 : ±1,2 m ».
2. **Le prescriptif est cantonné à la bande coach.** Les verbes d'ordre (« retardez », « gardez ») n'existent que là. Côté pilote (`mon-coach`), la bande coach apparaît marquée « de votre coach », en **lecture seule**.
3. **Silence en piste.** L'écran live (`roulage`, `entre-runs`, `pilotage-fini`) n'affiche **rien d'exploitable** — un indicateur de capture, un manifeste, une sortie. Rien d'autre.
4. **Tag « un constat, pas une consigne »** sur toute lecture factuelle.

## Couleurs codées — depuis `v2.ts`

| Token | Hex | Emploi |
|-------|-----|--------|
| night | `#050505` | fond |
| card | `#0B0B0D` | carte |
| line | `#1E1E22` | filet |
| cream | `#F8F9FA` | texte |
| mute | `#9A9AA3` | texte secondaire |
| faint | `#5A5A62` | texte tertiaire |
| red | `#C8102E` | **marque uniquement** |
| gold | `#FFB703` | données quotidiennes |
| heritageGold | `#C4A459` | **virage signature ET offre Heritage uniquement** — jamais décoratif |
| green | `#4ADE80` | tendance positive |

## Vocabulaire figé — ne jamais renommer

QDI · marges · Cap · Trajectoire · Anticipation · Visée · Plongée · combiné · adhérence · latéral · longitudinal · régularité · signature.

## Format de travail

- **Éditions ciblées**, écran par écran. Aucune refonte spéculative.
- **Un commit par archétype** — ex. `refonte(hub): accueil + paddock + lieux + carte + circuits`.
- Après chaque écran, indique ce qui a changé et ce qui reste à faire.
- Si un écran ne correspond à aucune maquette, ou présente une ambiguïté, **demande avant d'agir**.

## Polices

Geist + Geist Mono. Vérifie qu'elles sont bien chargées (`@expo-google-fonts/geist`, `@expo-google-fonts/geist-mono`) avant de styler.
