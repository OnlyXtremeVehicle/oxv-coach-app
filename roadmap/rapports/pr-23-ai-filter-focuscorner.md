# Rapport — PR-02 · Filtre IA sur focusCorner + insights générés

> Backlog V6, jalon M1. Étend le garde-fou doctrinal au second producteur de prose
> dynamique. Zéro schéma.

## Ce que j'ai fait
- **`focusCorner.ts`** — la phrase manifeste de l'écran #16 injecte le **nom du virage**.
  Nouvelle fonction exportée `safeFocusPhrase(name, zone)` : si le nom porte une tournure
  proscrite, repli sur une variante **neutre qui ne nomme pas le virage** plutôt qu'une
  formulation non conforme. `buildSelection` l'utilise.
- 3 tests `safeFocusPhrase` (nom conforme conservé / nom piégé → neutre / zone jaune).

## Constat (honnête)
- **`sessionInsightsEngine.ts` est purement NUMÉRIQUE** (anatomy, data_quality, ideal_lap) :
  aucune prose générée → rien à filtrer côté moteur. Les insights *prose* sont des copies
  statiques côté `.tsx` (déjà rédigées conformes) — elles relèvent du **garde-langage
  lintable de PR-04**, pas d'un filtre runtime.
- Vecteur dynamique couvert aujourd'hui : débrief (PR-01) + focusCorner (PR-02).

## Tests
- `tsc 0 · eslint 0 · jest 859` (+3).

## Suite (M1)
- **PR-03** : faire de `aiSafetyFilter` la **source unique** — migrer les 2 listes encore
  dupliquées (`debriefGenerator.test`, `focusCorner.test`) vers le filtre + **snapshot
  anti-divergence avec la liste de l'edge `generate-debrief-ai`** (Deno).
- PR-04 garde-langage lintable, PR-05 garde au rendu Bilan, PR-05b RGPD transfert hors-UE.
