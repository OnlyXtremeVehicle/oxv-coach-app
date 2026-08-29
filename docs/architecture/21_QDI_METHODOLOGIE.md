# QDI — méthodologie de référence

> **Ce document remplace `docs/site/QDI_METHODOLOGIE.md` (dépôt site), supprimé
> le 29/08/2026.** Son point 5 demandait « publier la correspondance exacte
> branche → formule dans le repo app, en pointant ce document comme cadre ».
> Une méthodologie qui vit loin de son calcul dérive : elle décrivait des
> mesures que le boîtier ne fait pas. Elle vit désormais **à côté du code**,
> dans le dépôt qui porte les formules.
>
> Décision fondateur 2026-07-01 (Q3) : « on crée un QDI complet sur 5 branches
> mais il faut être capable de l'assumer. Il sera visionnable par tout le monde
> au choix du pilote. Utilise de vraies références. »
>
> **Source de vérité du calcul** : `src/services/qdiLogic.ts`. En cas d'écart
> entre ce document et le code, **le code fait foi** et le document est le
> défaut à corriger.

---

## 1. Principe

Le **Quality Driving Index** mesure la **maîtrise**, pas la vitesse. Cinq
branches, valeurs 0–100, calculées **après la session** à partir de la
télémétrie 25 Hz. La référence de comparaison est l'**historique du pilote**,
jamais un autre pilote (`medianBranches` sur ses sessions passées).

**Il n'existe aucun score global.** `computeQdi` rend cinq branches
indépendantes et rien d'autre : pas de moyenne, pas de pondération. Une note
unique se présenterait comme un jugement, et cinq lectures valent mieux qu'un
verdict.

---

## 2. Ce que le boîtier mesure — et ce qu'il ne mesure pas

Le RaceBox Mini fournit **GPS + centrale inertielle à 25 Hz**. Il n'y a **ni
capteur de volant, ni capteur de pédales, ni capteur de pression de frein**.

Les branches Fluidité, Freinage et Accélération sont donc calculées à partir des
**conséquences mesurées** — les accélérations subies par la voiture — et non des
gestes du pilote. Toute formulation qui promet une « régularité des entrées
volant », une « montée en pression » ou un « trail braking » décrit un capteur
qui n'existe pas. C'était le cas de l'ancien document du site, et du texte
public jusqu'au 29/08/2026.

Une branche sans données suffisantes vaut **`null`** — jamais une valeur de
remplissage.

---

## 3. Les cinq branches — correspondance exacte branche → formule

Version en vigueur : **`qdi-1.1.0`** (`QDI_ALGO_VERSION`, `src/services/qdiLogic.ts`).

Règle commune : un trou d'acquisition de plus de **200 ms** entre deux trames
exclut la paire (perte BLE ≠ à-coup de conduite).

| Branche | Grandeur calculée | 100 | 0 | `null` si |
|---|---|---|---|---|
| **Trajectoire** | Chaque tour est rééchantillonné en 40 points à fractions égales de sa distance ; dispersion moyenne (Haversine) de chaque tour au barycentre des tours, au même point | ≤ 0,5 m | ≥ 5 m | moins de 2 tours exploitables, tour de moins de 100 m, ou moins de 40 points GPS |
| **Fluidité** | Jerk latéral moyen : moyenne des \|ΔG_lat\| / Δt, en g/s | ≤ 0,25 g/s | ≥ 2,0 g/s | moins de 50 paires de trames |
| **Freinage** | Phases de décélération (G_long ≤ −0,25 g, au moins 4 trames) ; écart-type des ΔG_long (g/s) à l'intérieur de chaque phase, moyenné sur les phases | ≤ 0,5 g/s | ≥ 3,0 g/s | moins de 3 phases |
| **Accélération** | Même calcul, phases de reprise (G_long ≥ +0,15 g) | ≤ 0,5 g/s | ≥ 3,0 g/s | moins de 3 phases |
| **Régularité** | Coefficient de variation des temps au tour (σ / moyenne) | 0 % | ≥ 6 % | moins de 3 tours |

Freinage et Accélération mesurent donc une **progressivité** : un écart-type
faible des variations de G signifie une phase modulée, un écart-type élevé
signifie des à-coups. C'est la lecture du cercle de friction que le boîtier
permet réellement.

---

## 4. Fondements documentés

- W. F. Milliken & D. L. Milliken, *Race Car Vehicle Dynamics*, SAE
  International, 1995 — dynamique du véhicule, cercle de friction : fondement
  des branches Freinage et Accélération.
- J. Segers, *Analysis Techniques for Racecar Data Acquisition*, 2ᵉ éd., SAE
  International, 2014 — l'analyse télémétrique du pilote : G-G diagram,
  consistance (σ des temps au tour), comparaison de tours.
- R. Bentley, *Speed Secrets: Professional Race Driving Techniques*, 1998 —
  fluidité, technique de freinage, régularité.
- P. Taruffi, *The Technique of Motor Racing*, 1958 — le classique des
  trajectoires.

Ces références fondent **l'approche**. Elles ne valident pas des seuils : les
bornes du point 3 sont des choix d'échelle OXV, révisables, et toute révision
incrémente `QDI_ALGO_VERSION`.

---

## 5. Garde-fous (non négociables)

1. **Pas de classement.** Aucune vue ne trie par score. L'affichage public est
   ordonné par récence, et ne porte aucune colonne de rang.
2. **Opt-in pilote** (`users.community_visibility`) : `private` ·
   `anonymous_only` · `nominative`. Défaut vérifié en production le
   29/08/2026 : `anonymous_only`.
3. **Anonymat réel** : aucune vue publique n'expose `user_id` ni email.
4. **Versionné et réfutable** : `algo_version` sur chaque analyse, données
   brutes exportables, aucune réécriture de l'historique.
5. **Restitution factuelle** : le QDI décrit, il ne prescrit pas. Aucune
   consigne de pilotage n'en est dérivée.

---

## 6. État mesuré en production — 29/08/2026

- `app_session_analyses.qdi` (jsonb) : présente. **1 analyse** porte un QDI.
- `users.community_visibility` : 14 pilotes, tous `anonymous_only` (le défaut ;
  personne n'a encore choisi).
- Vue `public.qdi_public` : ses colonnes sont `display_name`, `nominative`,
  `margin_global`, `margin_zone`, `computed_at`, `sessions_count`. **Elle ne
  porte aucune branche de QDI** — elle publie la MARGE. Son nom est
  historique ; le bloc public du site s'appelle depuis le 29/08/2026 « La marge
  du plateau », qui est ce qu'il montre.

## 7. Ce qui reste ouvert (décision fondateur)

La page Progression du site affiche cinq piliers pondérés — Trajectoire 30 %,
Fluidité 25 %, Freinage 20 %… — sur des valeurs d'exemple. **Cette pondération
n'existe nulle part dans le code** : `computeQdi` ne compose aucun score global
(point 1). Deux issues, et c'est un arbitrage produit :

- soit le QDI reste cinq lectures séparées, et la maquette du site retire les
  pourcentages ;
- soit un score composite est décidé, et il s'implémente dans `qdiLogic` avec un
  incrément de version.
