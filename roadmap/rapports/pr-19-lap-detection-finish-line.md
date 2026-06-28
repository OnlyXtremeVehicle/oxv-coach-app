# Rapport — PR-H · Détection de tours : ligne d'arrivée du circuit choisi

> Objectif Gabin : « être sûr que les tours soient calculés » sur Haute Saintonge et Charente.

## Diagnostic (vérité terrain)
- En base, **Haute Saintonge ET Charente ont déjà une ligne d'arrivée correcte** (sur la `centerline`, distance 0, rayon 35-40 m). **Rien à ajouter côté données.**
- **Le vrai bug était dans le code** : `placement.tsx` (le lanceur de capture réel) appelait `startCaptureSession({ circuitId, circuitName })` **sans `finishLine`**. `captureSessionService` retombait alors sur un **défaut codé en dur `BELTOISE_FINISH (45.6004, -0.141)`** — qui ne correspond ni à Haute Saintonge (~42 km) ni à Charente (~10 km). Le GPS n'entrait jamais dans le rayon → **aucun tour détecté**, quel que soit le circuit.

## Correctif
- **`captureFinishLineLogic.ts`** (net-neuf, pur, testé) : `captureFinishLineFor(circuit)` → la ligne d'arrivée du circuit, ou `undefined` si non renseignée (0/0 ou non finie) — **jamais une fausse ligne**.
- **`placement.tsx`** : passe désormais `finishLine: captureFinishLineFor(circuit)` (le circuit CHOISI par le pilote). → tours détectés au bon endroit sur HS, Charente, et tout circuit correctement configuré.
- **`captureSessionService`** : avertit (console.warn) si on retombe sur le défaut + commentaire corrigé (le défaut « Beltoise/Valence » ne correspond à aucun circuit réel).
- **Test** : la ligne du circuit est renvoyée (HS, Charente) ; `undefined` pour circuit absent / 0,0 / NaN ; rayon par défaut 40 m si invalide.

## Note utile
- La **détection de tours est par point + rayon** (le `heading` n'est pas utilisé en V1) ; un rayon de 35-40 m sur la trajectoire suffit.
- **Aucun circuit « Valence »** n'existe en base. Si le test alpha se déroule à Valence, il faudra **créer ce circuit + sa ligne d'arrivée** (sinon, même corrigé, pas de tours là-bas).

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 823 (+6).

## En suspens — build requis
- Validation terrain : capturer une session sur HS/Charente et vérifier que les tours s'incrémentent (invérifiable sans device + vrai roulage).
