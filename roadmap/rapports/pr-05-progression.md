# Rapport — PR 5 · Progression (hub de zone)

## Ce que j'ai fait
- **`app/(app)/progression.tsx`** : ajout d'une section **« Vos lectures »** qui ouvre les sous-vues de la zone Progression — **Signature**, **Constance** (régularité), **Comparateur** (vous contre vous), **Historique** (toutes vos séances). Additif : le graphe d'évolution, les stats, le delta « depuis la dernière séance » et le lien « statistiques agrégées » sont **conservés**.

## Pourquoi (non-orphelin)
- **`comparateur` et `roulages` n'étaient atteignables depuis aucun hub** (ni Paddock, ni Bilan, ni Data Lab). La zone Progression les rend désormais accessibles. `signature` et `regularite` restaient joignables par les 4 piliers du Bilan ; ils sont aussi ici, à leur place.

## Doctrine
- Le chiffre dominant reste la **trajectoire du meilleur tour** (soi vs soi, axe temps). **Aucun classement, aucun leaderboard, aucune comparaison non consentie** (déjà le cas). Or = donnée. La section « Vos lectures » est neutre (texte crème/muted, pas d'or décoratif).

## Hors périmètre (V1.5, schéma à soumettre)
- La couche **Développement** (Passeport pilote, Cycles, Carnet, Objectifs structurés) reste **V1.5** : elle nécessite des tables nouvelles **soumises à accord** (cf. `05`/`11`). Pas dans cette PR.

## Testé (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797.

## Suite
- PR 6 (Compte / Club) · PR 7 (polish canon : Instrument Serif, `v2.ts` réaligné, flou de la barre).
