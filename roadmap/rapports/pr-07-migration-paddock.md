# Rapport — PR de migration · Retrait de « Tout le paddock »

## Ce que j'ai fait
- **`app/(app)/index.tsx`** : suppression complète du **« Tout le paddock »** (liste `SECONDARY` de 13 liens, le composant `NavRow`, l'état `showAll`, le bloc de rendu et les styles `more`/`row`/…). C'est l'étape **« cacher les anciens liens »** du `10_PLAN_MIGRATION`.

## Vérification non-orphelin (avant retrait)
Chaque destination de l'ancienne liste a un foyer :
| Ancien lien | Foyer |
|---|---|
| Mon profil · Mes objectifs · Notifications · Réglages · Données | **Hub Compte** (icône, PR 6) |
| Mon coach · Trouver un coach · Mes demandes · La carte OXV · Belle route | **Hub Club** (PR 6) |
| Mon bilan · Débrief présentiel | **Bilan** (onglet + sous-vues) |
| Mon équipement | **Session** (hub, PR 4) |
| Lieux & partenaires | superséd. par **La carte OXV** (Club) |
| Mes belles routes | atteignable via **Belles routes** (Club) |

## Ce que je n'ai PAS fait (volontairement)
- **Les fusions de doublons** (`social`→`amis`, `social-carte`/`lieux`→`carte-oxv`) : elles demandent un **merge de contenu**, pas un `<Redirect>` aveugle (risque de perdre une vue liste). À faire dans une passe dédiée, **validée au build**. `paddock.tsx` n'est PAS un doublon d'`index` (c'est l'écran d'arrivée circuit, `10 §0`) — laissé intact.
- Le lien dev `debug-circuit` (qui vivait dans la liste) est retiré ; `debug-capture` reste dans le pied (DEV).

## Testé (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797.

## En suspens — **build requis**
- Vérifier sur device qu'aucun parcours ne dépendait de la liste retirée. C'est précisément ce que cette PR rend invérifiable sans build : le filet de sécurité est tombé.

## Reste de la refonte
- Fusions de doublons (passe dédiée) · **PR 7** polish canon (Instrument Serif, `v2.ts` réaligné, flou de la barre).
