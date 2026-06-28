# Rapport — T-1 · Filtre de sécurité doctrinale

> Première tranche du V5 (choix Gabin). Prérequis de **toute** fonctionnalité IA :
> aucune sortie générée ne doit franchir la doctrine « miroir, pas coach ».
> Zéro schéma, zéro dépendance, aucun build requis.

## Ce que j'ai fait
- **`src/services/aiSafetyFilter.ts`** (pur) — source **unique** du lexique proscrit :
  - 4 catégories : `imperatif_pilotage`, `obligation`, `interdiction`, `conseil_deguise`.
  - Matching robuste : normalisation (minuscule, accents retirés, apostrophes
    unifiées), mots entiers via `\b` (sans lookbehind → compatible Hermes).
  - API : `findProscribedTerms(text)`, `isDoctrineSafe(text)`,
    `assertDoctrineSafe(text, context?)` (lève `DoctrineViolationError` avec la
    liste des violations), catalogue `DOCTRINE_PROSCRIBED_TERMS` exporté.
- **`src/services/__tests__/aiSafetyFilter.test.ts`** (30 tests) :
  - **snapshot** qui verrouille le lexique (toute évolution = changement explicite) ;
  - blocage des 6 interdits explicites de `CLAUDE.md` + un représentant par catégorie ;
  - **zéro faux positif** sur le contenu autorisé et les pièges lexicaux
    (« accélération », « appui », « poussait », « gardiez », « serré », « vous pourrez ») ;
  - la **vraie sortie de `generateDebrief`** (3 zones) passe le filtre.

## Calibration (honnête)
Le périmètre est **volontairement restreint aux prescriptions**. Il ne juge ni le
style, ni la préférence « marge » vs « limite » (relecture éditoriale ≠ violation
prescriptive). Doctrine du doute : on bloque plutôt que de laisser passer un ordre.

## Ce qui est testé et fonctionnel
- `tsc` 0 · `eslint` 0 · `jest` 853 (baseline 823 + 30).

## Ce qui reste en suspens
- **Dé-duplication** : `debriefGenerator.test.ts` et `focusCorner.test.ts` portent
  encore chacun une copie locale de la liste (commentaire « à appliquer des deux
  côtés »). À migrer vers ce filtre dans un petit PR de suivi — non fait ici pour
  garder la tranche minimale et sans régression (la source de `focusCorner` n'a
  pas été relue).
- **Branchement** : le filtre n'est encore appelé nulle part en production. Il
  sera la garde de `generateDebrief` (à brancher) puis de `C-1 Coach AI`.

## Suite (séquence V5)
- Brancher `assertDoctrineSafe` sur `generateDebrief` (petit, sûr).
- Migrer les 2 tests dupliqués vers le filtre.
- Tranches P1 suivantes : `P-C Garage` (schéma `vehicle_setups` — STOP) ou
  `A-4 Utilisateurs` (zéro schéma).
