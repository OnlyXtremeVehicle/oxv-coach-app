# A-FLOW-1 — Définition du `flowService` (à valider AVANT toute ligne de code)

> Statut : **PROPOSITION, EN ATTENTE DE VALIDATION FONDATEUR.**
> Tant que ce document n'est pas validé, **FlowViz reste une démonstration**
> (bandeau scoped). On ne débloque pas le bandeau par un calcul approximatif.
> Séquencement : implémentation **après** la gate piste (smoke test) qui confirme
> qu'on capture des trames IMU exploitables — pas avant (calibrer un seuil sur des
> trames synthétiques qu'il faudrait re-régler sur le réel n'a pas de sens).

---

## 1. Cadre doctrinal (le pourquoi avant le comment)

Un « score de fluidité » (78/100) sorti d'un calcul opaque est **exactement ce que
le principe Miroir interdit** : une évaluation présentée comme un fait. La fluidité
ne devient légitime que si elle est une **mesure physique nommée**, pas un jugement.

Deux exigences non négociables en découlent :

1. **Mesure, pas note.** La sortie décrit une grandeur réelle, mesurée, avec une
   unité. Jamais un nombre-verdict sans unité, jamais une échelle 0-100, jamais un
   classement.
2. **Traçabilité.** Chaque valeur affichée trace vers une grandeur IMU mesurée et
   une formule déterministe. Un pilote (ou un juge) doit pouvoir reconstruire le
   chiffre depuis les trames.

---

## 2. Définition physique — le jerk IMU

La fluidité de conduite se lit dans le **taux de variation des accélérations** : un
pilote fluide enchaîne des transitions douces (volant/gaz/frein) et **minimise les
discontinuités d'accélération**. La grandeur physique correspondante est le **jerk**
= dérivée de l'accélération (troisième dérivée de la position) :

- Source : `telemetry_frames`, IMU RaceBox à ~25 Hz, via le mapper `SessionFrame`
  (`gLat`, `gLong` en g ; `elapsedMs` réel par trame — pas un pas supposé).
- Convention d'axes déjà verrouillée (`sessionTelemetryMapping`) : `gLat` (+ = droite),
  `gLong` (+ = accélération, − = freinage). Le service **consomme `SessionFrame`**,
  jamais les colonnes brutes.
- Jerk par axe, entre deux trames consécutives valides `i-1 → i` :

  ```
  dt        = (elapsedMs[i] − elapsedMs[i-1]) / 1000        (secondes, RÉEL)
  jerkLat   = (gLat[i]  − gLat[i-1])  / dt                   (g/s)
  jerkLong  = (gLong[i] − gLong[i-1]) / dt                   (g/s)
  |jerk|    = sqrt(jerkLat² + jerkLong²)                     (g/s, magnitude)
  ```

- **Fluide = |jerk| faible et resserré.** On ne récompense rien : on **mesure** la
  distribution de |jerk|. Un tracé rapide et propre a une distribution basse et
  étroite ; un tracé haché a des pics.

### Caveat technique honnête — bruit capteur
Le jerk est une dérivée : il **amplifie le bruit** de l'IMU à 25 Hz. Une différence
brute de deux trames mesurerait autant le bruit capteur que le geste du pilote. La
définition DOIT donc préciser un **traitement anti-bruit déterministe** avant de
parler de « fluidité du pilote » :

- soit un léger lissage passe-bas de `gLat`/`gLong` (fenêtre courte, p. ex. 3-5
  trames = 120-200 ms) **avant** dérivation ;
- soit un jerk calculé sur un intervalle fixe (p. ex. Δt = 120 ms) plutôt que trame
  à trame.

Le choix (et sa fenêtre) fait partie de la définition à valider — il détermine ce
qui compte comme « geste réel » vs « tremblement du capteur ». **À trancher avec le
réel** (le smoke test dira le niveau de bruit effectif du boîtier).

Trames à exclure du calcul, sans les fabriquer : `dt ≤ 0` ou aberrant (trou GPS/IMU),
`gLat`/`gLong` null, out-lap / in-lap. Une séance sans assez de trames valides →
**état vide honnête**, jamais une valeur inventée.

---

## 3. Sortie — descriptive, jamais un score

Le service produit de la **matière** pour la Constellation (calque LIÉ) et pour la
Séance. Trois formes, toutes factuelles :

1. **Distribution** — histogramme de |jerk| (bins en g/s) sur le tour : « où se
   concentre la variation d'accélération ». C'est une forme, pas une note.
2. **Trace temporelle** — |jerk| le long du tour (par trame / par abscisse
   curviligne) : *où* ça a bougé, pas *combien vous valez*.
3. **Intensité par segment** — |jerk| moyen (ou médian) par segment de tour
   (virage / ligne droite) : la matière du calque Constellation lié.

**Si un jour un nombre unique est exposé**, il doit être une **mesure nommée avec
unité** — p. ex. « variation moyenne d'accélération : **1,8 g/s** » (moyenne ou
médiane de |jerk|), jamais « fluidité : 78 ». Le mot « score » ne doit apparaître
nulle part dans l'API ni l'UI. Garde-fou possible : étendre le test lexical
`coachDomainNoScore`-style au domaine flow (bannir `score`, `note`, `rating` sur la
sortie du service).

**Le seuil de ce qui compte comme « fluide » pour un pilote de club est un CHOIX
PRODUIT — il vous revient.** Le service ne pose PAS de seuil de jugement : il rend
la mesure. Si une UI veut colorer « resserré / dispersé », le seuil de cette échelle
descriptive est un arbitrage à valider sur données réelles (pas un défaut inventé).

---

## 4. Forme du code (patron du reste du programme)

- **Logique pure séparée** : `src/services/flowLogic.ts` (aucun React/RN/Supabase),
  fonctions déterministes prenant des `SessionFrame[]` (± bornes de segments) et
  rendant la distribution / trace / intensités. `src/services/flowService.ts` = fin
  loader SELECT-only (loadLapFrames) + ré-exports.
- **Testable sans matériel** : `flowLogic.test.ts` avec des **jeux de trames
  synthétiques** → sortie attendue :
  - trace parfaitement lisse (g constant, ou rampe linéaire) → |jerk| ≈ 0 ;
  - créneau franc (saut de g) → un pic de jerk localisé, valeur = Δg/dt attendue ;
  - bruit ajouté → vérifie que le lissage choisi le rejette sous un seuil ;
  - trames insuffisantes / dt aberrant → vide honnête (jamais 0 fabriqué).
- Mêmes gardes que L3 : `strict`/vide honnête, `Number.isFinite` partout, pas de
  `any`, pas de valeur par défaut qui invente.

---

## 5. Séquencement

`flowService` **dérive des trames de capture**. Il n'a de sens qu'**après la journée
smoke test** qui valide qu'on capture des trames IMU exploitables et qui donne le
**niveau de bruit réel** du boîtier (indispensable pour régler le lissage §2). Le
construire avant, c'est calibrer sur du synthétique à re-régler sur le réel.

→ **Placement : juste après la gate piste, avec la reprise de L3** (le moment où
les 5 autres lectures s'alimentent aussi en réel). Pas avant.

---

## 6. Ce que j'attends de vous (validation)

Avant que j'écrive une ligne de `flowService` :

1. **La grandeur** : jerk IMU |jerk| en g/s — OK, ou vous préférez une autre lecture
   physique de la douceur (p. ex. dérivée de l'angle volant si un canal volant
   existait — il n'existe PAS ici, donc IMU) ?
2. **L'anti-bruit** : lissage passe-bas court avant dérivation, OU jerk sur Δt fixe —
   fenêtre à fixer au smoke test. D'accord sur le principe ?
3. **La sortie** : distribution + trace + intensité par segment, **sans score** ;
   nombre unique éventuel = mesure nommée en g/s. D'accord ?
4. **Le seuil « fluide »** (échelle descriptive) : c'est votre arbitrage produit —
   le posez-vous maintenant (sur quelle base ?) ou après avoir vu des données
   réelles ?

Tant que ces quatre points ne sont pas validés, FlowViz reste démo.
