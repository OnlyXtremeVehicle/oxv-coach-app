# Jalon 3 — Le jour J, phase 4bis

**28 juillet 2026.** Branche `migration/sdk-55`.

Source : `OXV_Mirror_V3_Plan_Montage.md`, « JALON 3 — LE JOUR J ».

L'acceptation de ce jalon est **entièrement sur appareil réel** : parcours
complet avec boîtier, plein soleil, test ganté, autonomie sur vingt minutes à
deux liaisons BLE, comportement au verrouillage. Le build est repoussé. Ce
document sépare donc ce qui est livré de ce qui attend la piste.

> **Rectifié le 28/07 par l'audit.** Ce document annonçait « six vérifications »
> plus bas alors que le préambule en énumère cinq groupes, et le cardinal
> n'était établi nulle part. Les contrôles sont désormais posés en cases, pas en
> prose : `docs/SMOKE_TEST_DEVICE.md` § Phase I. Un contrôle qui ne vit qu'en
> paragraphe est un contrôle qu'on oublie le jour du build.

---

## Ce que le jalon a révélé

### Le flux de capture ne pouvait pas être entré

`preparation` — seule porte, depuis le héros Paddock — n'importait **aucune
primitive de navigation**. Ni `router`, ni `Link`, ni `Redirect`. Tous ses
gestes étaient locaux.

La suite existait en circuit fermé : `equipement` → `placement` → `roulage`, et
`equipement` n'était atteignable que depuis `placement`, lui-même atteignable
que depuis `equipement`. `arrivee`, `entre-runs` et `fin` n'avaient aucun lien
entrant.

L'aiguilleur ne comblait rien. `hasAccount` vaut `false` en dur et n'est posé
que par `setUser`, **qui n'avait aucun appelant** — les occurrences apparentes
étaient des `useState` homonymes dans un écran admin, ce qu'un grep ne
distingue pas.

### Le silence en piste ne s'était jamais armé

Même cause. `setSilenceMode` ne recevait jamais autre chose que `false`.

Le Principe 3 était écrit, testé dans sa logique pure, et **inerte à
l'exécution**. Quatre gardes l'attendaient correctement —
`pushNotificationsService`, `BleErrorModal`, `OfflineBanner`,
`shouldShowTabBar` — et lisaient toutes le bon état. Le son, lui, était coupé
sans condition : c'est ce qui a masqué le reste.

### On pouvait armer sans boîtier

`disabled={starting}` est un garde de ré-entrance. L'état Bluetooth n'était
consulté nulle part. Boîtier éteint, hors de portée ou Bluetooth coupé, le
pilote armait, roulait sa séance entière, et n'enregistrait rien.

Personne ne l'avait rencontré — parce que personne ne pouvait atteindre
`placement`.

---

## Livré

| Lot | Fichier | Ce qui a changé |
|---|---|---|
| Chaîne REC | `rec/preparation.tsx` | Le maillon manquant : préparation → appairage. `push`, pas `replace` — revenir reste possible. Cible 72 pt, en bas. |
| Principe 3 | `lib/initEtatPilote.ts` | Pont d'état monté dans `_layout`. Aucun fichier protégé modifié : les setters existaient. |
| 21b · armement | `rec/placement.tsx` | Refusé sans boîtier, raison dite **avant** le geste, porte vers le diagnostic. Seconde barrière côté action, pour le chemin d'accessibilité. |
| 21a · contraste | `rec/roulage.tsx` | « REC » 3,10 → 15,03 · sous-titre 6,11 → 8,15 · abandon 4,38 → 8,15. Et le voyant qui figeait à **1,55** sous « réduire les animations ». |
| 21c · diagnostic | `features/rec/diagnosticBle.ts` | Huit causes en français. La localisation refusée est nommée — la plus fréquente, la moins comprise. |
| 21f · entre-runs | `rec/entre-runs.tsx` | `tabBarSpace` au lieu d'`insets.bottom`, contenu défilant, en-tête corrigé. |
| Consentement | `vous/reglages.tsx` | Le bloc biométrie passe derrière le drapeau, fail-closed. Révocation toujours ouverte. |

### Le seuil de 60 km/h — votre arbitrage

Le silence s'arme quand le pilote **roule**, pas quand il arme. La fenêtre entre
les deux subsiste, et la moyenne glissante de cinq secondes y ajoute environ
trois secondes pour une entrée à 100 km/h.

Unité vérifiée avant d'écrire la comparaison : le parseur UBX rend
`(gSpeed_mm_s × 3,6) / 1000`, donc des km/h, comme le seuil.

---

## Déjà conforme, vérifié

**21e · le chrono.** `roulage` n'affiche aucun chrono, aucun chiffre, aucune
biométrie — plus strict que ce que le dossier demande.

**Revenir ne rembobine pas.** `placement` ne démarre rien au montage ; le départ
est dans `onArm`, derrière le geste, et `router.replace` retire l'écran de la
pile.

**`appairage`.** L'écran existe sous le nom `equipement`, à la même place dans
la chaîne. Rien à construire.

---

## Bloqué, et sur quoi

| Point | Bloqué par |
|---|---|
| Étape `consentement`, « première fois seulement » | **Schéma.** Un refus et une question jamais posée valent tous deux NULL. `PROPOSITION_L21_consentement_premiere_fois.sql` |
| Place de `preparation` dans la chaîne | **Décision produit.** Le plan la met entre consentement et placement ; c'est aujourd'hui un écran d'avant-journée. |
| Seuil d'interruption sur le tour de référence | **Règle cardinale.** Aucun consommateur sans toucher `captureSessionService`. |
| `declared_at`, extension de `pilot_notes`, colonne `source` | **Schéma.** |
| Les vérifications d'acceptation | **Appareil.** Posées en cases dans `docs/SMOKE_TEST_DEVICE.md` § Phase I. |

---

## Sur la reconnaissance

Trente constats, **vingt-quatre réfutés** par les sceptiques. Deux des six
survivants proposaient des correctifs que la lecture a écartés :

- rebrancher trois gardes sur `isSilenced()` — inutile, elles lisaient déjà le
  bon état ; alimenter la machine les ranime toutes ;
- `AnatomieViz` et `TourIdealViz` sans garde de vide — faux, elles gardent
  autrement. **Compter des motifs n'est pas lire**, et cette fois l'erreur
  venait de mon propre grep.

## Portes

`tsc` 0 · `jest` **2 248** (167 suites) · `eslint` 0 erreur · doctrine 0 sur
342 fichiers · accessibilité 0 sur 342 · prettier propre.

Aucun build. Tout ce qui précède est vérifié au banc ou en lecture, jamais à
l'écran.
