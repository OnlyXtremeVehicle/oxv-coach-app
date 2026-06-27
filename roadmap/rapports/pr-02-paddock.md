# Rapport — PR 2 · Paddock contextuel

## Ce que j'ai fait
- `app/(app)/index.tsx` (`ModePassive`) : la grille « Explorer » (4 tuiles) + la liste « Tout le paddock » en avant sont remplacées par **1 action principale contextuelle** + **2 raccourcis ghost**, sous le chiffre héros.
- **Action principale dérivée du contexte** : pas de session → « Préparer ma session » (→ Session) ; session récente → « Découvrir mon bilan » (→ Bilan).
- **Raccourcis** (2, doctrine « 2-3 max ») : Ma progression · Mon coach.
- **Chiffre dominant** : régularité au tour — **inchangé** (déjà en code). Doc 08 corrigé : il disait à tort « marge globale » (réservée au Bilan).
- Modes `S5_approche` (silence en piste) / `S4_anticipation` (compte à rebours) conservés.

## Décision d'architecture (transitionnel assumé)
La liste « Tout le paddock » est **conservée, repliée et marquée transitionnelle**. La retirer maintenant **orphelinerait** ~8 destinations (profil, notifications, objectifs, mes-demandes, belle-route, mes-routes, lieux, données) que les hubs de zone (PR 6) ne couvrent pas encore. Retrait prévu dans la **PR de migration** (`10_PLAN_MIGRATION`) une fois les hubs complets — pas avant (règle no-orphan).

## Testé (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797.

## En suspens (build requis pour valider)
- Rendu de l'action crème + ghosts, transitions, inset au-dessus de la barre d'onglets.
- Les **6 états contextuels fins** (arrivée circuit / après roulage) dépendent de `determineState` + du flux Session (PR 4). PR 2 couvre `passive` (session / pas de session) + `S4`/`S5`.

## Questions pour Gabin
1. Les 2 raccourcis (Progression, Mon coach) conviennent, ou un autre couple (ex. La carte OXV) ?
2. OK pour garder « Tout le paddock » **transitionnel** jusqu'à la PR de migration (no-orphan) ?
