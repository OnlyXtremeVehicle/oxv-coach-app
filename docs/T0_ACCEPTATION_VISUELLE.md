# T0 — La vérification visuelle, réduite à cinq écrans

> Le plan de montage exige, pour clore T0 : *« l'application compile, se lance
> sur appareil, et **une animation par famille d'usage Reanimated est vérifiée
> visuellement** »* (`OXV_Mirror_V3_Plan_Montage.md:126`).
>
> Les deux premières conditions sont tenues. La troisième ne demandait pas un
> appareil pour être *préparée* : elle demandait qu'on sache **quelles sont les
> familles** et **où chacune se voit**. C'est l'objet de ce document.
>
> Établi le 04/08/2026. Chaque mouvement décrit ci-dessous a été **lu dans le
> code**, pas déduit du nom de la famille. Là où le déclencheur est
> conditionnel, la condition est écrite.

---

## AVANT TOUT — coupez « Réduire les animations » sur l'iPhone

**Cinquante fichiers** du dépôt appellent `useReduceMotion` et éteignent leur
animation quand le réglage d'accessibilité iOS est actif. C'est voulu, c'est
conforme, et **c'est indistinguable d'une migration cassée**.

Si ce réglage est activé, tout ce qui suit sera figé, correctement, et vous
conclurez à tort que Reanimated 4 ne fonctionne pas.

`Réglages → Accessibilité → Mouvement → Réduire les animations` — **désactivé**.

---

## Pourquoi cette vérification ne peut pas être automatisée

Reanimated 4 a deux modes de défaillance, et un seul est couvert par les tests.

**Le mode bruyant** — un worklet lit une valeur qui n'existe pas sur le fil UI.
Il lève une `ReferenceError` qui remonte en exception C++ et **abrège le
processus**. C'est ce qui a tué le build 36 : `pullAngle` avait une valeur par
défaut de paramètre qui lisait une constante de module. Ce mode est désormais
gardé statiquement par `src/ui/v2/__tests__/gardeWorklets.test.ts`, qui compile
chaque fichier candidat avec le vrai greffon babel du projet.

**Le mode silencieux** — l'animation ne part pas. Aucune erreur, aucun journal :
la valeur reste à son point de départ, l'écran s'affiche figé et paraît
simplement sobre. **Aucun test ne peut voir ça.** Il faut un œil.

C'est ce second mode que la liste ci-dessous traque.

---

## 1 · Paddock — l'accueil

C'est ici que se trouvent les deux témoins, parce qu'ils ne dépendent d'aucun
état métier : ils marchent un mardi soir sans séance à venir.

| Famille | Ce qui doit bouger | Comment le déclencher |
|---|---|---|
| `useAnimatedScrollHandler` | L'en-tête **se condense** | Faire défiler vers le bas |
| gestes + `withSpring` | Le cadran de rafraîchissement **se remplit puis revient** | Tirer la page vers le bas |
| `withRepeat` | Un **reflet balaie** les cartes en attente | Visible pendant le chargement, à l'ouverture |
| `measure` (fil UI) | Les sections apparaissent **à leur entrée dans la fenêtre** | Faire défiler |

**Si le cadran de rafraîchissement ne bouge pas, arrêtez-vous là.** C'est le
seul point de la liste qui combine geste, worklet et animation à ressort. Son
échec rend les quatre écrans suivants sans objet.

### Le bouton central de la barre d'onglets n'est PAS un témoin

Il ne pulse **qu'en mode `rec`** — `shellLogic.ts:116`, seul cas où
`pulse: true`. En mode `reserve` ou `countdown`, il est figé, et c'est correct.
Ne le prenez pas pour une panne.

---

## 2 · Data → une séance

L'écran le plus dense du dépôt : il porte les **seules occurrences** de `runOnUI`
et de `scrollTo` de toute l'application.

| Famille | Ce qui doit bouger | Comment le déclencher |
|---|---|---|
| `runOnUI` + `scrollTo` | La page **défile jusqu'à la section**, en douceur | Toucher une entrée du rail de sections |
| `useDerivedValue` | Le repère suit le doigt sur le graphe **sans retard** | Balayer sur la courbe |
| `useAnimatedScrollHandler` | En-tête condensé | Faire défiler |

**Le retard perceptible est le signal.** Si le repère suit *mais avec un temps
de latence*, le geste est repassé par le fil JavaScript : le worklet ne s'exécute
pas sur le fil UI. C'est une défaillance, pas une lenteur d'appareil.

*Source : `app/(app2)/data/session/[id].tsx:567` — `goToAnchor` enveloppe
`scrollTo` dans un `runOnUI`.*

---

## 3 · REC → préparation

| Famille | Ce qui doit bouger | Comment le déclencher |
|---|---|---|
| `useAnimatedProps` | La coche **se dessine**, d'un bout à l'autre du trait | Cocher un élément d'équipement |
| `withRepeat` + `withSequence` | L'indicateur d'attente **boucle** | Visible pendant la préparation |

`useAnimatedProps` mérite une attention particulière : il n'écrit pas dans un
style, il écrit dans un **attribut SVG** — ici le `strokeDashoffset` d'un tracé,
ce qui donne l'effet d'une coche tracée à la main. C'est le chemin le plus
fragile de la migration, et le seul qu'un test ne verra jamais.

Une coche qui **apparaît d'un coup** au lieu de se tracer : `useAnimatedProps`
est cassé.

*Source : `app/(app2)/rec/preparation.tsx:664`.*

---

## 4 · REC → fin

| Famille | Ce qui doit bouger | Comment le déclencher |
|---|---|---|
| `FadeIn` (animations de disposition) | Les blocs **apparaissent en fondu**, l'un après l'autre | Atteindre l'écran de fin |

Famille distincte des précédentes : ce n'est pas un style animé, c'est le
**moteur de disposition** de Reanimated. Il peut être cassé alors que tout le
reste fonctionne.

---

## 5 · Signature

| Famille | Ce qui doit bouger | Comment le déclencher |
|---|---|---|
| `useAnimatedReaction` | Le radar QDI **se déforme progressivement** d'une forme à l'autre | Changer la période comparée |
| `measure` | Les barres de piliers **se déploient depuis zéro** | À l'affichage |

**Occurrence unique de `useAnimatedReaction` dans tout le dépôt.** Le morphing
passe par un pont UI → JS échantillonné à ~30 Hz : la forme doit glisser, pas
sauter. Un radar qui **change d'un coup** signifie que la réaction ne se déclenche
pas et que seule la valeur finale traverse.

Note : une partie de cet écran — la section physiologique — est gatée et
éteinte aujourd'hui. Son absence est normale et n'a rien à voir avec T0.

---

## Ce qui n'est pas vérifiable à la demande

**`interpolateColor` — occurrence unique, dans `RecordFlash`.** C'est la
célébration d'un record : le chronomètre pulse deux fois du blanc vers l'or,
900 ms, une seule fois, sur front montant. Il faut **battre un record réel** pour
la voir.

Elle ne peut donc pas figurer dans une liste de contrôle exécutable au bureau.
Elle se vérifiera au premier roulage — notez-la pour Valence.

---

## `dev-galerie` ne sert pas ici, et c'est un piège à éviter

`app/(app2)/dev-galerie.tsx` monte presque tout le kit sur un seul écran. C'est
tentant, et **ça ne fonctionnera pas** : la ligne 579 redirige vers la racine dès
que `__DEV__` est faux. Un build EAS de preview est un build de production du
point de vue du bundle JavaScript. L'écran n'existe pas là où vous testez.

Il reste utile en développement local (`expo start`), et l'entrée est dans
Réglages (`app/(app2)/vous/reglages.tsx:422`).

---

## Cinq familles à zéro occurrence, et c'est une bonne nouvelle

`useAnimatedGestureHandler` — **zéro occurrence**. C'est l'ancienne API de
gestes, retirée en Reanimated 4. Zéro signifie que la migration des gestes est
complète ; une seule occurrence restante aurait été une bombe à retardement.

`withDecay`, `SlideIn`, `LinearTransition`, `useAnimatedKeyboard` — zéro
également. Rien à vérifier, rien à migrer.

---

## Après la vérification

Si les cinq écrans passent, **T0 est clos** : compilation, lancement, et une
animation par famille. Le seul point restant sera `interpolateColor`, à voir au
circuit.

Si l'un échoue, le fichier est nommé sous chaque tableau. La correction commence
par lire son worklet et vérifier qu'aucune valeur par défaut de paramètre ne lit
une constante de module. C'est la faute qui a coûté le build 36, et elle est
discrète.
