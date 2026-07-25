# A-FLOW-1 — Définition du `flowService`

> Statut : **DÉFINITION VALIDÉE (fondateur, 19/07/2026).** Le **service reste à
> écrire APRÈS la gate piste** (smoke test) qui confirme qu'on capture des trames
> IMU exploitables et qui donne le bruit réel du boîtier — **pas maintenant**
> (calibrer sur du synthétique = à re-régler sur le réel). **FlowViz reste une
> démonstration** (bandeau scoped) jusqu'à cette implémentation post-piste. On ne
> débloque jamais le bandeau par un calcul approximatif.
>
> Décisions fondateur (19/07) intégrées ci-dessous : (1) grandeur = jerk IMU **mais
> normalisé par la sévérité de trajectoire** (§2.1) ; (2) anti-bruit **causal,
> déterministe, fenêtre = paramètre exposé** (§2.2) ; (3) sortie sans score, nombre
> unique = mesure en g/s (§3) ; (4) **seuil « fluide » reporté au post-piste** — il
> émerge des percentiles réels, il n'est pas décrété (§3).

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

- Le jerk **absolu**, seul, N'EST PAS la mesure de fluidité (voir §2.1). On
  **mesure** une distribution, on ne récompense rien.

### 2.1 — Normaliser par la sévérité : mesurer le jerk INATTENDU (décision fondateur, verrou)

**Réserve de conception non négociable.** Le jerk seul confond deux choses
distinctes :

- le pilote **brusque** — à-coups de commande, mauvaise fluidité ;
- le pilote **rapide sur circuit exigeant** — jerk élevé parce que les vraies
  transitions physiques sont violentes (gros freinage, mise en appui, changement
  d'appui). Un ralentisseur / un enchaînement pris fort génère du jerk **sans** que
  ce soit un défaut de fluidité.

Mesurer le jerk **absolu** punirait les pilotes rapides et récompenserait les lents :
c'est **faux** et **anti-doctrine** (un jugement déguisé en mesure). La fluidité n'est
donc PAS le jerk absolu mais le **jerk INATTENDU** — la discontinuité d'accélération
**qui n'est pas expliquée par la géométrie de la trajectoire à cet instant**.

**Contrainte de conception :** le jerk doit être **rapporté à la sévérité de la
trajectoire** au même instant (vitesse, rayon, niveau d'accélération soutenue `|g|`).
Un pic de jerk cohérent avec une vraie transition physique n'est pas un défaut ; un
pic **sans** justification géométrique en est un. La sortie décrit le jerk *résiduel*
(inexpliqué), pas le jerk brut.

C'est **posé maintenant** comme contrainte ; le **calage fin** (fonction de sévérité,
pondération) se fait sur le **réel** (smoke test / distribution Beltoise), jamais sur
du synthétique. Les tests synthétiques vérifient l'INVARIANT, pas le seuil : une
transition franche mais géométriquement justifiée → jerk résiduel ≈ 0 ; un à-coup
injustifié → jerk résiduel élevé.

### 2.2 — Anti-bruit : causal, déterministe, fenêtre = paramètre EXPOSÉ (décision fondateur)

Le jerk est une dérivée : il **amplifie le bruit** de l'IMU à 25 Hz. Une différence
brute de deux trames mesurerait autant le bruit capteur que le geste du pilote. La
définition impose donc un **traitement anti-bruit** avant de parler de « fluidité » :

- lissage passe-bas court de `gLat`/`gLong` **avant** dérivation (fenêtre courte,
  ordre de grandeur 3-5 trames ≈ 120-200 ms), OU jerk calculé sur un Δt fixe.
- **Exigences de méthode (verrou fondateur) :**
  1. **Causal** — le filtre ne regarde QUE le passé (pas de fenêtre centrée /
     lecture de l'avenir), sinon une séance passée n'est pas recalculable à
     l'identique et ça bloquerait un futur temps réel.
  2. **Déterministe / rejouable** — même entrée → même sortie, bit pour bit.
  3. **Fenêtre = PARAMÈTRE EXPOSÉ**, pas une constante magique enfouie : on la
     re-règlera après le smoke test **sans rouvrir le cœur du service** (ex.
     `smoothingWindowMs` en argument de la fonction pure, valeur par défaut
     documentée mais surchargeable).

La valeur de la fenêtre se **tranche sur le réel** (le smoke test dira le bruit
effectif du boîtier).

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

### Seuil « fluide » — REPORTÉ AU POST-PISTE (décision fondateur)

Le seuil de ce qui compte comme « fluide » **n'est PAS posé maintenant.** Deux
raisons :

1. Poser un seuil sur du **synthétique**, c'est inventer une frontière que le smoke
   test invalidera.
2. Un seuil est **déjà à demi un jugement** : dès qu'on décrète « en dessous de X g/s
   c'est fluide », on note.

**Position retenue :** le service sort la **mesure brute, sans aucun seuil** — la
matière descriptive (distribution / trace / intensité par segment) existe, le
jugement attend. Le « seuil » **émergera d'une lecture de la distribution RÉELLE**
(les percentiles observés sur plusieurs pilotes, p. ex. sur Beltoise), **pas d'une
valeur décrétée**. Le fondateur posera l'arbitrage produit **devant les vraies
données, à froid** — c'est là que sa connaissance du pilote de club vaut le plus.
Tant que ce n'est pas fait, aucune échelle « resserré / dispersé » n'est colorée par
un seuil inventé.

---

## 4. Forme du code (patron du reste du programme)

- **Logique pure séparée** : `src/services/flowLogic.ts` (aucun React/RN/Supabase),
  fonctions déterministes prenant des `SessionFrame[]` (± bornes de segments) **+ un
  paramètre de lissage EXPOSÉ** (`smoothingWindowMs`, §2.2) et rendant la distribution
  / trace / intensités du **jerk RÉSIDUEL** (normalisé par la sévérité, §2.1).
  `src/services/flowService.ts` = fin loader SELECT-only (loadLapFrames) + ré-exports.
- **Testable sans matériel** : `flowLogic.test.ts` avec des **jeux de trames
  synthétiques** → sortie attendue (on teste des **invariants**, jamais un seuil) :
  - trace parfaitement lisse (g constant, ou rampe linéaire) → |jerk| ≈ 0 ;
  - créneau franc (saut de g) → un pic de jerk localisé, valeur = Δg/dt attendue ;
  - **transition franche mais géométriquement JUSTIFIÉE → jerk RÉSIDUEL ≈ 0 ;
    à-coup INJUSTIFIÉ (même amplitude, sans justification) → résiduel élevé** (§2.1) ;
  - bruit ajouté → le lissage **causal** le rejette ; **MÊME entrée → MÊME sortie**
    (déterministe, rejouable) ; `smoothingWindowMs` variable → sortie qui suit ;
  - trames insuffisantes / dt aberrant → vide honnête (jamais 0 fabriqué).
- Mêmes gardes que L3 : `strict`/vide honnête, `Number.isFinite` partout, pas de
  `any`, pas de valeur par défaut qui invente, **aucun seuil de jugement en dur**.

---

## 5. Séquencement

`flowService` **dérive des trames de capture**. Il n'a de sens qu'**après la journée
smoke test** qui valide qu'on capture des trames IMU exploitables et qui donne le
**niveau de bruit réel** du boîtier (indispensable pour régler le lissage §2). Le
construire avant, c'est calibrer sur du synthétique à re-régler sur le réel.

→ **Placement : juste après la gate piste, avec la reprise de L3** (le moment où
les 5 autres lectures s'alimentent aussi en réel). Pas avant.

---

## 6. Décisions tranchées (fondateur, 19/07/2026)

1. **Grandeur** : jerk IMU en g/s — **validé**, avec la contrainte **§2.1** :
   normaliser par la sévérité de trajectoire, mesurer le **jerk inattendu**, jamais
   le jerk absolu (sinon on punit les pilotes rapides — jugement déguisé).
2. **Anti-bruit** : **validé** — lissage **causal, déterministe, rejouable**, fenêtre
   `smoothingWindowMs` **paramètre exposé** (pas une constante en dur), réglée sur le
   réel (§2.2).
3. **Sortie** : **validé sans réserve** — distribution + trace + intensité par
   segment ; **aucun score** ; nombre unique éventuel = mesure nommée en g/s (§3).
4. **Seuil « fluide »** : **reporté au post-piste** — il émerge des percentiles
   RÉELS (Beltoise), jamais décrété ; d'ici là le service sort la mesure brute sans
   seuil (§3).

**La définition est arrêtée.**

---

## 7. État d'implémentation (25/07/2026)

`src/services/flowLogic.ts` (pur, 44 tests) et `src/services/flowService.ts`
(loader SELECT-only) existent. Ce qui est écrit, c'est la **forme et les
invariants** — pas le calage, qui reste séquencé après la gate piste (§5).

**Ce qui tient.** Dérivation sur `dt` réel, lissage **causal** et **déterministe**
(invariant testé : modifier une trame future ne déplace aucun point antérieur),
`smoothingWindowMs` exposé comme exigé, sortie sans score ni seuil, vide honnête
partout où la donnée manque, garde lexicale contre tout vocabulaire de notation.
Le test central du verrou 2 compare deux séries au **jerk brut identique** : le
jerk absolu est structurellement incapable de les distinguer, le résiduel le fait.

**Ce que la vérification adversariale a corrigé.** Le budget de sévérité croissait
linéairement avec la vitesse **sans plafond** : au-delà d'environ 80 km/h il
dépassait tout jerk atteignable et le résiduel devenait **identiquement nul**.
Ce zéro n'était pas un constat de fluidité mais une valeur fabriquée — et il
**exonérait automatiquement les pilotes rapides**, soit le symétrique exact de
l'injustice que le §2.1 corrige. Un plafond (`maxExplainedGPerS`) borne désormais
le budget. Corrigés aussi : absence de borne INFÉRIEURE sur `dt` (la chaîne
d'écriture du dépôt produit des trames à 1 ms, ce qui multipliait le jerk par
vingt à quarante), lissage causal qui enjambait un trou de capture, garde-fou de
la distribution qui était un no-op, bornes de segment recopiées même invalides.

**LIMITE CONNUE, à trancher sur données réelles.** `gSustained` est lu sur le |g|
**mesuré** — le signal dont on mesure précisément la discontinuité. La boucle est
donc partiellement fermée : une brutalité fait monter le |g|, donc le budget censé
l'expliquer, et comme on prend un **maximum** sur la fenêtre, cette indulgence est
mémorisée pendant toute sa durée — soit exactement l'intervalle où un pilote
brusque enchaîne ses corrections. Le maximum reste préféré à la moyenne (une
moyenne gonflerait le résiduel du pilote rapide, ce que le verrou 2 interdit
d'abord) : on a choisi le défaut le moins grave, pas un modèle satisfaisant.

La sortie non circulaire est la **géométrie au sens propre** : la courbure déduite
de `lat`/`lon` et de la vitesse (accélération latérale attendue = v²/R),
indépendante de l'IMU. Elle n'est pas implémentée : la courbure est une dérivée
seconde de la position GPS, très bruitée à 25 Hz, et son lissage ne se règle pas
sur du synthétique — exactement ce que le §2.1 prévoit.

**Conséquence pratique, inchangée : FlowViz reste démo.** Le résiduel décrit
aujourd'hui une tendance ; il ne tranche pas un cas individuel. Le brancher sur un
écran pilote avant le calage reviendrait à présenter comme une mesure ce qui est
encore une hypothèse.
