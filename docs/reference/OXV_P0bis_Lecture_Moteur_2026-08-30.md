# P0 bis — Lecture du moteur de restitution et de la base de production

*30/08/2026 · lecture seule · aucun fichier du dépôt modifié, aucune écriture en base*

Ce document ferme la session de lecture que le plan v4 §8 exigeait avant toute
nouvelle spécification. Il porte huit constats. Trois corrigent ce que j'avais
écrit, un signale un défaut de production, et quatre déplacent le plan du Mans.

---

## 1 · Une vraie capture existe déjà, et elle est bonne

**Séance `ff384ace…`, circuit de Bouteville, 12/08/2026.**

| Mesure | Valeur |
|---|---|
| Trames | 26 999 |
| Période | 40,00 ms exactement — 25,0 Hz, sans trou |
| Durée couverte | 1 079 922 ms (17 min 59,9 s) |
| Fixes valides | 26 999 / 26 999 |
| `itow_ms` distincts | 26 999 / 26 999 |
| Satellites (moyenne) | 15,4 |
| Précision GPS (moyenne) | 0,23 m |
| Gyroscope présent | 26 999 trames |
| G latéral présent | 26 999 trames |
| Vitesse | 60,3 km/h en moyenne, 106,3 km/h au maximum |

Trois tours détectés :

| Tour | Temps | Distance | V max | G lat | G frein | G accél |
|---|---|---|---|---|---|---|
| 1 | 360,485 s | 5 875,49 m | 93,84 | 0,52 | 0,29 | 0,48 |
| **2** | **327,542 s** | 5 873,68 m | 106,26 | 0,62 | 0,36 | 0,46 |
| 3 | 339,483 s | 5 874,72 m | 104,50 | 0,56 | 0,30 | 0,45 |

**Ce que cela prouve.** La chaîne trames → tours → distance tourne sur du réel :
cadence tenue à la milliseconde, identité physique unique par trame, découpage
en tours fermés, distances resserrées à 1,81 m près sur 5,87 km. Cette dernière
valeur est trop serrée pour une intégration de trajectoire brute : elle indique
que la distance passe déjà par la projection curviligne sur le tracé de
référence. À confirmer en lisant le calcul, mais c'est la lecture la plus
probable, et c'est la bonne nouvelle : c'est exactement le mécanisme dont Le
Mans a besoin.

**Correction.** J'ai écrit que `telemetry_frames` contenait 53 trames de test et
que rien n'avait jamais tourné sur du réel. C'était vrai de la lecture d'audit
que je citais ; ce n'est plus vrai de la base. La « ligne de fracture » a été
franchie le 12 août. Ce que Le Mans apporte n'est donc plus la première capture,
c'est la **première capture sur un circuit inconnu, avec un chronométrage
officiel en face**.

---

## 2 · `heading` est nul sur 100 % des trames — et le parseur n'y est pour rien

Zéro valeur distincte sur 26 999 trames. Le cap n'est pas une donnée dégradée :
il est **absent**.

J'ai d'abord cru à un défaut de lecture. J'ai donc confronté `src/ubx/parser.ts`
au *RaceBox BLE Protocol Description rev 8* (dans les pièces du projet), champ
par champ, en tenant compte du décalage de six octets d'en-tête. **Les vingt
offsets sont justes**, y compris le cap (charge utile 52, facteur 10⁵), et la
garde `(fixStatusFlags & 0x20)` est mot pour mot ce que la documentation appelle
*« Bit 5 : 1 = valid heading »*.

**Le boîtier a donc laissé ce bit à zéro pendant dix-huit minutes de roulage,
jusqu'à 106 km/h.** Je ne sais pas pourquoi, et je ne peux pas le savoir : le seul
instrument qui le dirait n'est pas lu.

Trois colonnes créées par la migration `telemetry_frames_add_accuracy_fields`
n'ont **jamais été écrites** — `heading_accuracy`, `speed_accuracy`, `pdop` :
zéro valeur sur 26 999 trames. Or dans l'exemple du constructeur lui-même, à
l'arrêt, le cap vaut 0° et sa précision vaut 145,27° : **c'est la précision qui
dit ce que le drapeau tait.**

Deux gestes, détaillés dans `OXV_P0_Paquet_Execution_2026-08-30.md` :
écrire les trois champs de qualité (gratuit, les colonnes existent, les offsets
sont connus), et n'afficher aucune orientation d'ici là. La répétition de
Bouteville du 19/09 tranchera en une requête.

## 3 · Le défaut que je croyais avoir trouvé — le dépôt le garde déjà

`session_insights` ne contient **qu'une seule ligne** dans toute la base :
`engine_version = 'mirror-insights-demo'`, rattachée à une séance à **zéro
trame**, avec un tour idéal fabriqué (gain de 1,50 s, perte répartie sur douze
secteurs inexistants).

J'ai d'abord écrit que `disponibilite.ts` la déclarerait disponible et qu'il
fallait ajouter une condition. **C'est faux, et c'est la cinquième fois que je
signale un manque que le dépôt couvre déjà.** Ce qui existe :

- `MOTEURS_INSIGHTS_REELS = ['mirror-insights-v1', 'mirror-insights-v3']` —
  une liste blanche, égalité stricte, refus par défaut.
- `insightsMesures()` — fail-closed, refuse une version absente, vide, ou
  seulement ressemblante (« mirror-insights-v2 » est refusé : *« on ne devine
  pas »*).
- `sessionInsightsService` filtre **dans la requête** (`.in('engine_version', …)`),
  trie sur `computed_at` pour prendre la plus récente **mesure** et non la plus
  récente ligne — *« une démo postérieure masquerait sinon un vrai calcul »* —,
  puis **revérifie en code** : *« vue modifiée, vue interposée — on refuse quand
  même. Le fail-closed vit ici, pas seulement dans la requête. »*
- `insightsMoteurReel.test.ts` — cinq cas, dont un nommé *« refuse le moteur de
  démonstration tel qu'il est en production »*.

Trois barrières et un test, écrits en connaissance de cette ligne précise.

**Ce qui reste, et qui est plus petit :** la ligne de démonstration est
physiquement en production, et c'est le **seul** contenu de la table. L'application
ne la voit pas. Tout ce qui lit la table sans passer par le service — un export
SQL, un futur rapport, une fonction edge, une requête partenaire — voit des
chiffres inventés comme unique contenu. C'est de l'hygiène de données, pas un
défaut de rendu. Elle vient de `INSIGHTS_JEU_ESSAI`, dont le
`telemetry_session_id` est exactement celui de la ligne en base.

**Ce que cela m'apprend, et c'est le vrai constat.** Sur cinq manques que j'ai
signalés dans ce dossier, cinq existaient déjà. Ma règle change : je ne nomme
plus un défaut sans avoir cherché sa garde, et je cite la garde ou je me tais.

## 4 · QDI — les branches inertielles mesurent de la vibration, et c'est démontrable

L'analyse écrite par le cron le 14/08 sur la séance de Bouteville :

```
trajectoire 97 · régularité 34 · freinage 7 · fluidité 0 · accélération 0
lapCount 3 · frameCount 26 999 · algoVersion qdi-1.1.0
reference { circuit: Bouteville, sessions: 0 }
```

**Zéro n'est pas `null`.** `qdiLogic` rend `null` quand la donnée manque ; il
rend 0 quand il a calculé et trouvé le pire. Ces deux branches ont donc tourné.

### La plomberie est juste — vérifié à la main

`computeRegularite` sur les trois tours réels (360,485 · 327,542 · 339,483) :
moyenne 342,503 ; écart-type 13,617 ; CV 0,03976 ;
`scoreDown(0,03976 ; 0 ; 0,06)` = 33,7 → **34**. C'est exactement la valeur en
base. Le moteur tourne correctement sur des chiffres réels.

### La cause, mesurée sur les 26 999 trames

`computeFluidite` moyenne |ΔG_lat|/Δt et applique
`scoreDown(moyenne ; 0,25 ; 2,0)`. Mesuré :

| Jerk latéral (g/s) | Valeur |
|---|---|
| Médiane | **0,286** |
| Moyenne | **2,240** |
| p95 | **14,0** |

La médiane est dans la bonne plage. **La moyenne est 7,8 fois la médiane** :
la distribution est écrasée par une queue de pics. Un p95 de 14 g/s à 40 ms
signifie une variation de **0,56 g entre deux trames consécutives**, alors que
l'amplitude totale du G latéral sur toute la séance est de −0,621 à +0,522.
**Un écart d'une trame à l'autre plus grand que l'amplitude du signal entier
n'est pas de la conduite.**

Confirmation : l'écart-type du G latéral sur la séance est de 0,151 g, et la
variation moyenne d'une trame à la suivante est de 0,0896 g — soit **59 % de
l'écart-type total**. Un signal physique échantillonné à 25 Hz ne fait pas cela.
C'est de la vibration — route, moteur, fixation — repliée dans la bande.

### Le test qui tranche

J'ai relissé le G latéral par une moyenne glissante sur 13 trames (±240 ms) et
recalculé :

| | Brut | Lissé |
|---|---|---|
| Jerk latéral moyen | **2,240 g/s** | **0,629 g/s** |
| Médiane | 0,286 | 0,079 |

`scoreDown(0,629 ; 0,25 ; 2,0)` = **78**.

**La fluidité passe de 0 à 78 par un seul lissage.** Les seuils 0,25 / 2,0 ne
sont donc pas faux : ils ont été calibrés pour un signal conditionné, et la
chaîne leur envoie un signal brut. Même mécanisme pour freinage et accélération,
qui dérivent le G longitudinal (jerk moyen brut 1,951 g/s, médiane 0,250).

### Ce que je ne décide pas

La moyenne glissante à 13 points est **ma sonde, pas ma recommandation** :
`kinematics.ts` porte déjà `savitzkyGolay`, qui préserve mieux les pics.

Et surtout : toucher aux g qui alimentent le QDI est exactement ce que
l'en-tête de `telemetry/calibration.ts` refuse de faire seul — *« un incrément
de `QDI_ALGO_VERSION` et un recalcul de l'historique, donc une décision du
fondateur, pas un effet de bord de lot. Le brancher en silence ferait exactement
ce que ce dépôt refuse : déplacer des chiffres sans le dire. »*

Le diagnostic est donc à vous, avec ses chiffres. Ce qu'il coûte : un filtre,
une version d'algorithme, un recalcul de l'historique — quatorze analyses.
Ce qu'il évite : montrer deux zéros à un pilote professionnel.

`reference.sessions: 0` dit par ailleurs que la référence de saison n'a rien à
comparer. Bouteville est aujourd'hui la seule séance de référence avant Le Mans.

## 5 · Quarante modules dormants, listés et datés par le dépôt lui-même

`src/__tests__/modulesOrphelins.guard.test.ts` mesure l'atteignabilité depuis
`app/` et tient une liste écrite de **40 modules sans consommateur de
production**, chacun avec sa raison et sa condition de sortie. Deux tests la
tiennent des deux côtés : aucun orphelin neuf, aucune entrée périmée.

Ce que la liste contient, et qui nous concerne directement :

- `features/presentations/registrepresentations.ts` — les 65 fiches
- `features/presentations/compositionlogic.ts` — le moteur de composition
- `features/presentations/sourcescompositionservice.ts` — le service de sources
- `services/sessioninsightsengine.ts` — le moteur d'insights côté app
- `services/coachconsolelogic.ts`, `coachconsoleservice.ts` — la console coach
- `services/datalablogic.ts`, `focuscorner.ts`, `laptimelinelogic.ts`,
  `maplayerslogic.ts`, `seasonstorylogic.ts`, `eventcontextlogic.ts`
- `services/debriefrenderguard.ts` — la ceinture doctrinale de dernier mètre
- `telemetry/gg.ts`, `segment.ts`, `accel.ts`, `calibration.ts`
- `render/gg.ts`, `projection.ts`, `ribbon.ts`, `decimate.ts`
- `components/debriefmirror.tsx`, `lapscrubber.tsx`, `dataconfidencebanner.tsx`,
  `signature/radarempreinte.tsx`
- `ui/chip.tsx`, `ui/kpicard.tsx`, `ui/doctrinefooter.tsx`

Le commentaire du lot 9a est explicite : *« Le catalogue des 65 présentations et
le moteur qui les compose sont écrits et testés avant qu'aucune surface ne les
rende : c'est l'ordre demandé, et l'inscription ici est la contrepartie. Ils
sortiront de cette liste au lot des écrans. »*

**Conséquence sur le plan.** Le travail du Mans est très majoritairement du
**branchement**, pas de l'écriture. C'est la troisième fois que je découvre cela
dans ce dossier, et c'est la dernière : je ne spécifie plus une seule fonction
sans avoir cherché son homonyme dans cette liste.

---

## 6 · La migration que je croyais en attente est appliquée

`sourcesCompositionService.ts` écrit que quatre entrées du moteur attendent la
migration `20260826140000_lot10c_…`, *« non appliquée »*. J'ai repris cette
phrase. Elle est périmée.

La migration existe sous un autre horodatage — le fichier est
`20260829000000_lot10c_presentations_vues_travail_actif_repere_memoire.sql`, et
la base la porte sous la version **`20260829163749`**. Les deux tables sont là :

```
pilot_presentation_views : user_id, presentation_id, first_opened_at, last_opened_at
pilot_presentation_work  : id, user_id, presentation_id, session_id,
                           opened_at, closed_at, closed_by, motif_cloture
```

Elles servent exactement `experience.presentationsVues` et `travailActif`, les
deux entrées du moteur de composition qui n'avaient pas de source. **Le moteur
n'est plus bloqué côté base.** Il ne lui manque que ses écrans.

Deux commentaires du dépôt sont à corriger en conséquence — celui du service et
celui de la garde des orphelins. Ce sont eux qui décrivent aujourd'hui un état que
le code a quitté, et c'est le défaut que ce dépôt corrige partout ailleurs.

Restent sans source : `faits.reperePiste` et `faits.referencePartagee`.
Par ailleurs `cycle_steps` et `coach_annotations` comptent **zéro ligne** en
production : `lireAcquisValide` et `lireVoixCoach` rendront `false` pour tout le
monde tant qu'un coach n'aura rien écrit. Les fiches P36, P46 à P51 resteront
donc écartées au Mans, avec leur motif. C'est correct, et c'est à savoir avant de
promettre un passeport de compétences à une écurie.

---

## 7 · Le moteur de saillance existe pour moitié — mais pas sur le même objet

J'ai spécifié un moteur de saillance à six critères qui désigne **une zone** à
regarder. Le dépôt porte un moteur qui choisit **quelle lecture ouvrir**, et il
est plus abouti que le mien sur ce qu'il fait :

- 65 fiches typées, chacune avec ses `donneesRequises`, sa surface, son niveau,
  son rôle (`reussite` / `opportunite` / `autre`) et son moment ;
- un plafond de niveau qui monte avec l'expérience **et avec l'usage** — une
  lecture de niveau preuve déjà ouverte vaut le compteur de séances ;
- un budget de cartes (3 / 5 / 8 pilote, 5 dossiers coach, illimité au Lab) ;
- **une seule opportunité à la fois**, et tant qu'un travail est ouvert, c'est
  lui — aucune autre ne prend sa place en silence ;
- le souhait du pilote (intention avant, thème après) **départage sans filtrer** ;
- confiance de mesure faible → les grandeurs mesurées sont retirées, pas niées ;
- et `ecartees`, qui porte pour chaque fiche laissée de côté **le fait qui
  l'écarte**. Un choix opaque serait un score déguisé.

Aucun agrégat, aucun rang, aucun pourcentage — un test le vérifie en parcourant
la sortie.

**Ce qui reste de ma spécification, et c'est tout :** la saillance **par zone**.
Choisir la lecture et choisir l'endroit sont deux questions différentes, et le
dépôt n'a que la première. Le reste de mon bloc F est à jeter au profit de ce qui
existe.

---

## 8 · La règle des mots-clés entre en conflit avec ces deux moteurs

C'est le point qui demande votre arbitrage.

Le moteur de composition et la liste blanche des lectures produisent des chaînes
**destinées à l'écran**, et ce sont des phrases :

`compositionLogic` — motifs et écarts :
> « la séance porte ce que cette lecture demande »
> « une seule zone à explorer à la fois »
> « un travail est en cours ; les autres zones restent fermées »
> « donnée absente : deux tours qui couvrent la même distance »
> « confiance de mesure faible sur ce tour : … »
> « lecture preuve — elle s'ouvre d'un geste »

`registrePresentations` — les 27 libellés de données, tous rédigés en clair par
la charte anti-jargon :
> « ce que vous aviez posé avant de rouler » · « deux tours qui couvrent la même
> distance » · « le début de décélération observée » · « le moment où la voiture
> tourne »

`disponibilite` — les six raisons d'absence :
> « Aucune mesure sur cette séance » · « Pas assez de tours pour comparer » ·
> « Chronos de secteur non calculés »

La définition G-2 (plus de trois mots **et** un mot outil) les refuse toutes.

**Le conflit est réel et il est bien posé.** Ces phrases ne sont pas de la
paresse : elles viennent d'une charte anti-jargon explicite, et elles répondent à
« pourquoi je ne vois pas cette lecture ? », qui est une bonne question.

**Ma proposition, à trancher.** Deux registres pour la même information :

- **Premier regard, sur la feuille : le mot-clé.**
  `DONNÉE ABSENTE · DEUX TOURS COMPARABLES` — `CONFIANCE FAIBLE · TOUR 3` —
  `UNE SEULE ZONE À LA FOIS` — `AUCUNE MESURE` — `TOURS INSUFFISANTS` —
  `CHRONOS SECTEUR ABSENTS` — `SIGNAL INERTIEL ABSENT` — `GYROSCOPE ABSENT`.
- **Second geste : la phrase existante, inchangée.** Elle est déjà écrite, elle
  est bonne, et elle vit dans un champ que la garde ne lit pas — le même
  arbitrage que celui du 26/08 pour `source` dans le catalogue des lectures.

Cela demande un champ de plus par libellé (`court` à côté de l'existant), pas une
réécriture. Environ 40 chaînes concernées : 27 libellés de données, 6 raisons
d'absence, 7 motifs de composition.

**Si vous préférez l'autre voie** — garder les phrases telles quelles sur ces
surfaces et les inscrire en exception datée dans `restitutionSansPhrase.exceptions.ts` —
elle est défendable, et elle coûte une heure au lieu d'un jour. Elle a un prix :
la règle « aucune phrase » devient « aucune phrase sauf là où il y en avait
déjà », et une règle qui plie la première fois qu'elle coûte cher ne tient pas la
seconde.

---

## Ce que cette lecture change au plan

1. **Bouteville du 12/08 devient la séance de référence.** Elle est réelle,
   propre, et elle porte trois tours. Toute vérification d'écran se fait sur elle
   avant Le Mans — plus besoin d'attendre le 26/09 pour voir un écran rempli.
2. **Le lot des écrans remplace le lot d'écriture.** Registre, composition,
   sources, moteur d'insights, console coach : écrits, testés, dormants. Le
   travail est de les monter.
3. **Deux choses à regarder avant tout le reste** : les branches inertielles du
   QDI, et le cap absent. La ligne de démonstration en base est de l'hygiène,
   pas un défaut.
4. **Le bloc F est à réécrire** autour de la saillance par zone seulement.
5. **Le bloc C est à réécrire** : je l'avais écrit sans savoir que `debriefGenerator`
   et `aiSafetyFilter` faisaient déjà ce que j'y inventais.
