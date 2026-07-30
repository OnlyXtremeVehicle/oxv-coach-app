# J5 — Le classement de l'arbre V1, écran par écran

> Jalon 5 du Programme V3. Établi le 29 juillet 2026 sur la branche `migration/sdk-55`.
>
> **Ce document ne supprime rien.** Il pose sur la table les 71 écrans de
> `app/(app)`, avec pour chacun sa taille, qui l'atteint et ce qui le remplace,
> pour que la décision se prenne sur pièces et non sur une liste de noms.
>
> **Tout ce qui suit est une lecture de code, jamais une observation.** Rien n'a
> jamais tourné en conditions réelles : 53 trames en production, aucun boîtier en
> flotte, aucun compte coach. Les chemins décrits sont ceux que le code permet,
> pas ceux qu'un pilote a empruntés.

---

## LE COMPTE

`app/(app)` contient **74 fichiers `.tsx`**, dont trois `_layout.tsx`. Soit
**71 écrans de route** et **35 488 lignes** (mesuré, pas estimé).

| Classement | Écrans | Lignes | Part |
|---|---:|---:|---:|
| **MEURT** — un équivalent app2 existe et est atteignable | **63** | 30 312 | 85,4 % |
| **MIGRE** — un contenu ou une écriture n'existe nulle part ailleurs | **7** | 3 972 | 11,2 % |
| **RESTE** — aucune décision technique ne suffit | **1** | 1 204 | 3,4 % |
| **SORT vers le web** | **0** | 0 | — |

Le total des trois lignes fait 35 488 : **chaque fichier de l'arbre est classé**,
aucun n'est resté hors du relevé. Le seul non classé est `app/(app)/_layout.tsx`
lui-même (41 lignes), qui tombe en dernier par construction.

### Ce que la soirée du 29/07 a changé à ce tableau

Les tableaux de ce document décrivent le classement **tel qu'il a été établi**.
Les huit arbitrages ont été tranchés dans la foulée, et trois lignes ont bougé —
elles sont détaillées plus bas, résumées ici :

- **RESTE passe de 1 à 0.** `virage.tsx` n'était « reste » que parce qu'il
  portait l'unique chemin d'annotation du coach. Ce chemin existe en app2.
- **MIGRE passe de 7 à 8**, le temps que le deep-dive virage soit porté — ce
  qui est fait. Les huit sont désormais traités.
- **Le second blocage est levé** : `app/(pro)` est recâblé, ses neuf liens et
  cinq boutons ne visent plus l'arbre V1.

Le premier blocage — l'écriture d'intention — **tient toujours**.

### Rien de `app/(app)` ne part sur le web

La colonne « sort » est vide, et ce n'est pas un oubli. Ce qui quitte
l'application pour le site, ce sont les dossiers `app/(pro)` et `app/(partner)` —
des groupes distincts. Mais `app/(pro)` retient encore l'arbre V1 : voir le
second blocage ci-dessous.

---

## LES DEUX BLOCAGES

Deux constats commandent le calendrier. Ni l'un ni l'autre ne se règle en
supprimant des fichiers.

### 1. L'écriture d'intention disparaîtrait de toute l'application

`savePendingIntention` n'a que **deux appelants** :

```
app/(app)/prochaine-fois.tsx:142
src/components/IntentionCard.tsx:53   ← monté par le seul app/(app)/preparation.tsx
```

Les deux sont en V1. Aucun écran de `app/(app2)` n'écrit d'intention.

Le reste de la chaîne, lui, survit : `src/features/vous/useCarnet.ts` **lit** les
intentions (`getPendingIntention`, `getIntentionForSession`), et
`captureSessionService` les **consomme** (`peekPendingIntentionId`,
`forgetPendingIntention`). Le lecteur et le consommateur restent, le producteur
s'en va.

Or l'Arbre pilote fait de « poser la variable de la prochaine fois » le
**troisième acte obligatoire de `rec/fin`, étape 8**. Supprimer V1 sans
réhéberger cette écriture ne dégrade pas le carnet : cela transforme l'étape 8 en
spécification sans code.

Le piège de nommage a été évité de justesse : `app/(app2)/vous/carnet.tsx:445`
définit un composant **local** nommé `IntentionCard` qui n'est pas
`src/components/IntentionCard.tsx`. Deux objets, un seul nom, un seul qui écrit.

### 2. `app/(pro)` tient l'arbre V1 par neuf liens et cinq boutons

| Origine | Cible V1 |
|---|---|
| `(pro)/index.tsx:30` · `:122` · `(pro)/bibliotheque.tsx:177` | `/(app)/bilan` |
| `(pro)/index.tsx:31` | `/(app)/data-lab` |
| `(pro)/index.tsx:32` | `/(app)/passeport` |
| `(pro)/index.tsx:33` | `/(app)/signature` |
| `(pro)/index.tsx:34` | `/(app)/garage` |
| `(pro)/performance.tsx:34` | `/(app)/comparateur` |
| `(pro)/performance.tsx:39` | `/(app)/progression` |

S'y ajoutent **cinq montages de `AccountButton`** (`equipe`, `index`, `media`,
`partage`, `performance`), dont le `Link` vise en dur `/(app)/compte`
(`src/ui/AccountButton.tsx:17`).

Le Dossier de travail dit que le pilote professionnel part sur le web. Il ne dit
pas **quand**. Tant que `(pro)` vit dans l'application, huit écrans classés
« meurt » restent atteints.

À l'inverse, `app/(coach)` ne tient l'arbre que par **deux** liens réels
(`pilote/[id].tsx:759` vers le bilan, `:797` vers le virage) — et `app/(admin)`
comme `app/(partner)` n'en ont **aucun**. Vérifié ligne à ligne.

---

## LES TROIS ROUTES RÉCLAMÉES DEUX FOIS

Trois chemins sont revendiqués par un fichier V1 **et** un fichier V2 :

| Route | V1 | V2 |
|---|---|---|
| `/` | `app/(app)/index.tsx` | `app/(app2)/index.tsx` |
| `/club` | `app/(app)/club/index.tsx` | `app/(app2)/club/index.tsx` |
| `/signature` | `app/(app)/signature.tsx` | `app/(app2)/signature.tsx` |

L'affirmation du lot 20 — « `app/(app2)` ne pointe plus aucune fois vers
`app/(app)` » — reste **vraie pour les chemins littéraux préfixés** : les onze
occurrences de `(app)/` sous `app/(app2)/` sont toutes des commentaires.

Elle est **fausse au sens de la résolution de route**.
`src/features/data/saison/SaisonSections.tsx:581`, monté par
`app/(app2)/data/index.tsx`, exécute :

```ts
router.push('/signature' as never)
```

Sans groupe. Sur une route réclamée deux fois. Qualifier ce push en
`/(app2)/signature` est une ligne, et c'est le prérequis de toute suppression
sûre.

---

## MIGRE — les sept

Sept écrans portent quelque chose qui n'existe nulle part ailleurs. Deux d'entre
eux sont des **corrections** au relevé initial, vérifiées dans le code avant
d'être retenues.

| Écran | Lignes | Ce qui n'existe nulle part ailleurs |
|---|---|---|
| `partenaire/[id].tsx` | 971 | DOSSIER signalé ; le programme veut la fiche « en écran, contenu riche, lien profond partageable » alors qu'app2 n'a qu'une feuille, sans la vitrine photo des offres publiées. |
| `catalogue.tsx` | 887 | L'annexe C du dossier de travail range « catalogue par catégorie » parmi les cinq capacités V1 non traitées, et l'arbre pilote promet à club/partenaires le catalogue dessiné plus la fiche d'offre en écran : le contenu doit passer, pas disparaître. |
| `debug-capture.tsx` | 656 | Seul consommateur d'UI de flic2Service et de l'export de fixtures de captureMode (shareCapture/getLastSavedUri) : le supprimer coupe l'unique chemin de capture de trames UBX réelles alors que le programme constate « rien n'a jamais tourné » et exige une journée complète avec boîtier réel — à porter en __DEV__ comme dev-galerie, « conservée, elle sert au développement », mais il ne figure pas dans les 37 routes pilote : arbitrage Gabin. |
| `prochaine-fois.tsx` | 431 | savePendingIntention n'a que deux appelants, tous deux en V1 (prochaine-fois.tsx:142 et src/components/IntentionCard.tsx:53, ce dernier monté par le seul preparation.tsx). app2 LIT les intentions (useCarnet) et la capture les CONSOMME (peekPendingIntentionId), mais aucun écran app2 n'en écrit : le producteur meurt, le lecteur et le consommateur survivent. |
| `partage.tsx` | 377 | CORRIGÉ (le relevé concluait « meurt »). app/(app2)/club/galerie.tsx:148 appelle createShare({ scope }) — sans durée, sans métriques. sharesService.ts:99 ne pose expires_at que si expiresInDays est fourni : tout lien créé depuis app2 aujourd'hui n'expire JAMAIS. Supprimer cet écran ne retire pas une redondance, il retire la seule surface qui borne un partage dans le temps — sur un sujet déjà sous réserve article 25. |
| `objectifs.tsx` | 327 | useCarnet n'appelle que listMyGoals ; createGoal et updateGoalStatus n'existent nulle part en app2, or créer un objectif est une écriture du pilote. |
| `belle-route.tsx` | 323 | CORRIGÉ (le relevé concluait « meurt » contre club/territoire). Territoire appelle bien le même listCertifiedRoutes(), mais l'Arbre pilote l'en retire — « les convois et les belles routes le quittent » — et déclare club/routes NOUVEAU. Or club/routes.tsx porte listMyRoutes : VOS routes, pas la découverte des certifiées. Classer belle-route mort contre Territoire fige la découverte dans l'écran que le programme est en train de vider. |

---

## RESTE — le seul

Un écran ne se classe pas, parce qu'aucune décision technique ne suffit à le
faire.

| Écran | Lignes | Pourquoi il ne peut pas tomber |
|---|---|---|
| `virage.tsx` | 1204 | Écran bi-rôle. virage.tsx:235 teste le rôle coach/admin et affiche « Annoter ce virage » qui pousse /(coach)/annoter avec cornerIndex (:724). (coach)/pilote/[id].tsx:797 y entre directement : c'est l'UNIQUE chemin post-séance par lequel un coach désigne un virage à annoter. Il porte en propre coachAnnotationsService et coachReferenceService, et le Sheet virage de data/session/[id] n'écrit aucune annotation. |

---

## MEURT — les soixante-trois

Rangés du plus gros au plus petit. La colonne « atteint par » donne le fichier et
la ligne : elle sert à vérifier, pas à croire.

**Une nuance à lire avant le tableau.** Huit de ces écrans citent
`app/(app)/club/index.tsx` comme porte d'entrée — or `club/index.tsx` est
lui-même orphelin : `TAB_MAIN_ROUTE.decouverte` vaut `/(app)/coachs`
(`src/lib/appMap.ts:31`), et rien ne pousse vers `/club`. Ces huit portes sont
murées. `mes-demandes.tsx` n'a aucun autre appelant : il est doublement
orphelin.

Même effet, plus large : `app/index.tsx:115` redirige tout pilote vers
`/(app2)`. La chaîne REC V1 entière — `preparation` → `equipement` →
`placement` → `roulage` → `pilotage-fini` → `preservation` → `bilan-pret` →
`trace` — ne pend qu'à `app/(app)/index.tsx`, que plus aucun pilote n'atteint.
**Ces huit écrans sont morts depuis la bascule du lot L6**, pas parce qu'app2 les
remplace.

| Écran | Lignes | Atteint par | Équivalent app2 |
|---|---|---|---|
| `bilan.tsx` | 1428 | (app) index.tsx:362, cartes.tsx:199, trace.tsx:159 · (coach) pilote/[id].tsx:759 · (pro) index.tsx:30, index.tsx:122, bibliotheque.tsx:177 | app/(app2)/bilan/[sessionId].tsx |
| `coachs.tsx` | 1281 | (app) uniquement — onglet Découverte de AppTabBar via src/lib/appMap.ts:31, club/index.tsx:30, debrief-presentiel.tsx:282, mon-coach.tsx:575 | app/(app2)/club/coaching.tsx (onglets Trouver · Mon coach · Demandes) et app/(app2)/club/index.tsx |
| `carte-oxv.tsx` | 1129 | (app) uniquement — club/index.tsx:32, coachs.tsx:799 (tuile de hub) | app/(app2)/club/territoire.tsx |
| `data-lab.tsx` | 1097 | (app) app/(app)/bilan.tsx:568 · app/(app)/trace.tsx:175 · barre d'onglets V1 (src/lib/appMap.ts:29 TAB_MAIN_ROUTE.datalab, montée par app/(app)/_layout.tsx:38) ; (pro) app/(pro)/index.tsx:31 | app/(app2)/data/index.tsx (hub Data) + app/(app2)/data/session/[id].tsx pour les couches d'analyse |
| `carnet.tsx` | 1050 | (app) uniquement — onglet Carnet de AppTabBar via src/lib/appMap.ts:30, progression.tsx:69, bilan.tsx:660, conditions.tsx:142 | app/(app2)/vous/carnet.tsx |
| `telemetry.tsx` | 945 | (app) seulement — app/(app)/tours.tsx:220 (pathname '/(app)/telemetry' avec le tour présélectionné) et la liste de tuiles de app/(app)/data-lab.tsx:344 (screen:'telemetry' → openLayer:701 → router.push:703) | app/(app2)/data/session/[id].tsx (section 5 TÉLÉMÉTRIE, onglets G-G / Canaux / Heatmap / Replay, ligne 1175) |
| `mon-coach.tsx` | 852 | (app) seul — app/(app)/club/index.tsx:29, app/(app)/consentements.tsx:148, app/(app)/settings.tsx:217 | app/(app2)/club/coaching.tsx (onglet « Mon coach », que le programme scinde en club/mon-coach) |
| `coach/[id].tsx` | 843 | (app) uniquement — coachs.tsx:350 et coachs.tsx:356 ; (coach)/disponibilites.tsx:6 et (coach)/profil.tsx:9 citent la route dans un COMMENTAIRE d'en-tête, aucun router.push ni href n'existe dans ces deux fichiers | app/(app2)/club/coaching.tsx (Sheet fiche de l'onglet « Trouver » : bio, avis en citations, créneaux, demande de séance) |
| `progression.tsx` | 832 | (pro) app/(pro)/performance.tsx:39 uniquement — aucun lien depuis (app), (app2), (coach), (admin) ni (partner) | sections TOUR DE RÉFÉRENCE et RÉGULARITÉ de SaisonSections, montées dans app/(app2)/data/index.tsx:346 |
| `index.tsx` | 799 | barre d'onglets V1 — src/lib/appMap.ts:28 (TAB_MAIN_ROUTE.miroir = '/(app)') consommée par src/components/AppTabBar.tsx:67, montée par app/(app)/_layout.tsx:38 ; donc atteint seulement en transit, une fois qu'un lien (coach)/(pro) a déposé l'utilisateur dans (app). app/index.tsx:107 redirige tous les pilotes vers /(app2) | app/(app2)/index.tsx — Accueil Miroir, qui importe le même decidePaddockAction et couvre les modes S4/S5/S6 |
| `profil.tsx` | 751 | (app) seul — app/(app)/compte/index.tsx:348 | app/(app2)/vous/profil.tsx (visage CONSULTATION, 829 lignes) |
| `signature.tsx` | 718 | (app) — bilan.tsx:536 (Link href), progression.tsx:65 (tuile PROGRESSION_VIEWS), trace.tsx:170 ; ET (pro) — app/(pro)/index.tsx:33 (tuile TOOLS, href '/(app)/signature') ; ambigu — src/features/data/saison/SaisonSections.tsx:581 pousse '/signature' sans groupe, fichier monté seulement par app/(app2)/data/index.tsx:346 | app/(app2)/signature.tsx (462 lignes) |
| `preparation.tsx` | 709 | (app) seul — app/(app)/index.tsx:438, app/(app)/session/index.tsx:23 et :46 | app/(app2)/rec/preparation.tsx (1 081 lignes) |
| `replay.tsx` | 658 | (app) seul — app/(app)/data-lab.tsx:298 (tuile « Rejouer un tour » du tableau SECTIONS, ouverte par openLayer:703) ; aucun router.push littéral n'existe | onglet 'replay' de app/(app2)/data/session/[id].tsx:1238 |
| `virage-comparer.tsx` | 656 | (app) seulement — app/(app)/virage.tsx:348 (onCompare) et la liste de tuiles de app/(app)/data-lab.tsx:323 (screen:'virage-comparer' → openLayer:701) | app/(app2)/data/session/[id].tsx (superposition des passages d'un virage ligne 1121, et SectionDelta ligne 553) |
| `support/index.tsx` + `support/[id].tsx` | 628 | (app) seulement — app/(app)/compte/index.tsx:346 et app/(app)/settings.tsx:247 vers /(app)/support ; le détail /(app)/support/${id} depuis support/index.tsx:270 (lui-même) | app/(app2)/vous/support.tsx (504 lignes, atteint depuis app/(app2)/vous/index.tsx:70) |
| `tours.tsx` | 626 | (app) seulement — liste de tuiles de app/(app)/data-lab.tsx:316 (screen:'tours' → openLayer:701) ; aucun router.push littéral vers /tours nulle part | app/(app2)/data/session/[id].tsx (ToursSection ligne 535 + SectionBande ligne 547) |
| `settings.tsx` | 576 | (app) seulement — app/(app)/compte/index.tsx:349 (tuile { key:'reglages', href:'/(app)/settings' }) | app/(app2)/vous/reglages.tsx (706 lignes) |
| `amis.tsx` | 570 | (app) uniquement — bilan.tsx:648, club/index.tsx:38, coachs.tsx:782, consentements.tsx:158, settings.tsx:222 ; aucun lien depuis (app2), (coach), (admin), (partner), (pro) ni src/ | app/(app2)/club/roulages.tsx (onglet « Amis ») |
| `compte/index.tsx` | 547 | (app) onglet Compte de AppTabBar via src/lib/appMap.ts:32 · src/ui/AccountButton.tsx:17 monté dans (app) index.tsx:168, club/index.tsx:46, session/index.tsx:50 ET dans (pro) index.tsx:109, equipe.tsx:85, media.tsx:45, partage.tsx:114, performance.tsx:76 | app/(app2)/vous/index.tsx |
| `carte-licence.tsx` | 526 | (app) uniquement — passeport.tsx:306 | app/(app2)/vous/documents.tsx (bloc 1, carte licence FFSA) |
| `cote-a-cote/[friendId].tsx` | 523 | (app) uniquement — amis.tsx:310 | app/(app2)/data/comparer.tsx (mode « ami », paramètre ?friend=) |
| `empreinte-saison.tsx` | 498 | (app) app/(app)/passeport.tsx:296 — unique lien entrant | app/(app2)/signature.tsx — section « l'Empreinte », mini-radars mensuels par listMonthlyQdi (même service que la v1) |
| `debrief-presentiel.tsx` | 491 | personne — la seule occurrence du segment hors du fichier est src/lib/appMap.ts:48, une table de zones (lookup), pas un lien de navigation | aucun |
| `comparateur.tsx` | 488 | (app) cartes.tsx:115, progression.tsx:68 · (pro) performance.tsx:34 | app/(app2)/data/comparer.tsx |
| `carte.tsx` | 482 | (app) uniquement — data-lab.tsx, tuile « Carte du circuit » (SECTIONS ligne 279) poussée en data-lab.tsx:703 par `/(app)/${screen}` ; jamais par un router.push littéral | app/(app2)/data/session/[id].tsx (ancre « Tracé », ANCHORS:128) |
| `roulages.tsx` | 467 | (app) seul — app/(app)/mon-coach.tsx:249, app/(app)/progression.tsx:71 | app/(app2)/club/roulages.tsx (onglet « Roulages ») |
| `profil-edition.tsx` | 462 | (app) seul — app/(app)/profil.tsx:311 | mode ÉDITION inline de app/(app2)/vous/profil.tsx |
| `passeport.tsx` | 461 | (app) app/(app)/progression.tsx:61 ; (pro) app/(pro)/index.tsx:32 | app/(app2)/vous/index.tsx (héros passeport) + section CIRCUITS de SaisonSections dans app/(app2)/data/index.tsx |
| `garage.tsx` | 446 | (app) app/(app)/compte/index.tsx:340 · app/(app)/settings.tsx:237 ; (pro) app/(pro)/index.tsx:34 (« Mon garage ») | app/(app2)/vous/garage.tsx (Arbre_Pilote:469) |
| `circuits.tsx` | 444 | (app) uniquement — carte-oxv.tsx:245 | app/(app2)/data/index.tsx via src/features/data/saison/SaisonSections.tsx (section 4 « Circuits ») |
| `garage/[vehicleId].tsx` | 438 | (app) app/(app)/garage.tsx:122 — router.push(`/(app)/garage/${id}`), unique appelant. DOSSIER : app/(app)/garage/ ne contient que ce fichier, il disparaît entièrement avec lui | app/(app2)/vous/garage.tsx — la fiche véhicule y est une Sheet (getVehicle, listMyVehicleMedia, listSetups, addSetup, lignes ~299-580) |
| `mes-demandes.tsx` | 429 | (app) seul — app/(app)/club/index.tsx:31 (tuile « Mes demandes ») | app/(app2)/club/coaching.tsx (onglet « Demandes ») |
| `stats.tsx` | 405 | (app) seulement — app/(app)/progression.tsx:380 (router.push('/(app)/stats')) ; app/(pro)/index.tsx:20 et app/(pro)/performance.tsx:16 importent statsService mais ne pointent jamais la route | app/(app2)/data/index.tsx (la Saison, via src/features/data/saison/SaisonSections.tsx:247) |
| `debrief.tsx` | 397 | personne — la notification `type === 'debrief'` était son unique porte ; app/_layout.tsx:108 la route désormais vers /(app2)/bilan/[sessionId]. Les occurrences de « debrief » dans notifications.tsx:155 et settings.tsx:267-270 sont des clés de canal de notification, pas des liens | app/(app2)/bilan/[sessionId].tsx — debriefCard:390, data.debrief.acts:402, provenance:398 |
| `decharge.tsx` | 369 | personne — zéro lien entrant dans tout le dépôt ; le seul router.push vers une décharge est app/(app2)/vous/documents.tsx:170 et il vise l'écran app2 | app/(app2)/vous/decharge.tsx (déjà en place et déjà atteint) |
| `galerie.tsx` | 367 | (app) app/(app)/club/index.tsx:39 (tuile « Mes souvenirs ») · app/(app)/coachs.tsx:748 via openHubRoute défini en coachs.tsx:289 (router.push) | app/(app2)/club/galerie.tsx — mosaïque de TOUS vos médias groupés par séance, onglets Galerie/Partages (Arbre_Pilote:397) |
| `heatmap.tsx` | 356 | (app) app/(app)/data-lab.tsx:336 (tuile « Carte de chaleur », famille mesure) ouverte par openLayer app/(app)/data-lab.tsx:703 via `/(app)/${screen}` ; aucune chaîne littérale /(app)/heatmap n'existe dans le dépôt | app/(app2)/data/session/[id].tsx — onglet « Heatmap » (Chip:1237) rendu par HeatmapTrace:1518, trajectoire colorée par vitesse via speedColor |
| `donnees-securite.tsx` | 350 | personne — la tuile « Données & sécurité » de app/(app)/compte/index.tsx:344 pointe en réalité vers /(app)/consentements ; les deux seules occurrences de la chaîne /(app)/donnees-securite (src/services/analyzeSessionService.ts:511 et src/lib/appMap.ts:66) sont des commentaires | app/(app2)/vous/reglages.tsx — groupe 3 « Données & sécurité » (export via Dial, suppression J+30) et groupe 2 « Consentements » |
| `entre-runs.tsx` | 350 | personne — aucun lien entrant dans app/(app) ; le fichier n'a plus qu'un lien sortant (entre-runs.tsx:213 vers /(app)/equipement) | app/(app2)/rec/entre-runs.tsx, cible de REC_ROUTES.entreRuns (src/features/rec/captureStepLogic.ts:69), verrouillée par test (captureStepLogic.test.ts:87) |
| `consentements.tsx` | 346 | (app) uniquement — compte/index.tsx:344, donnees-securite.tsx:127, settings.tsx:319 | app/(app2)/vous/reglages.tsx (groupes 2 « Consentements » et 3 « Données & sécurité ») |
| `trace.tsx` | 338 | (app) seulement — app/(app)/bilan-pret.tsx:28 (router vers '/(app)/trace?sessionId=...') | app/(app2)/index.tsx (l'accueil, via src/features/miroir/useMiroirHome.ts:346) |
| `cartes.tsx` | 325 | (app) uniquement — profil.tsx:396 (l'odomètre pressable) | app/(app2)/data/comparer.tsx (mode « seances ») |
| `notifications.tsx` | 315 | (app) seul — app/(app)/compte/index.tsx:345 | app/(app2)/vous/reglages.tsx (groupe 1 « Notifications ») |
| `circuit/[id].tsx` | 306 | (app) uniquement — carte-oxv.tsx:604, circuits.tsx:179 ; les deux appelants meurent aussi | app/(app2)/data/index.tsx via SaisonCircuitSheet (src/features/data/saison/SaisonSections.tsx:607) |
| `roulage.tsx` | 285 | (app) seul — app/(app)/placement.tsx:84, app/(app)/session/index.tsx:26, :37 et :43 | app/(app2)/rec/roulage.tsx |
| `pass-oxv.tsx` | 268 | (app) seul — app/(app)/carte-licence.tsx:244, app/(app)/preparation.tsx:338 et :358, app/(app)/settings.tsx:232 | app/(app2)/club/pass.tsx |
| `equipement.tsx` | 264 | (app) uniquement — app/(app)/session/index.tsx:24,39,45 · app/(app)/preparation.tsx:455 · app/(app)/paddock.tsx:53 · app/(app)/entre-runs.tsx:213 ; tous ces appelants sont eux-mêmes dans l'arbre V1 | app/(app2)/rec/equipement.tsx (REC_ROUTES.equipement, captureStepLogic.ts:66) |
| `placement.tsx` | 253 | (app) seul — app/(app)/equipement.tsx:79, app/(app)/session/index.tsx:25 | app/(app2)/rec/placement.tsx |
| `partenaires.tsx` | 241 | (app) seul — app/(app)/club/index.tsx:36 | app/(app2)/club/partenaires.tsx (458 lignes) |
| `data-lab-canvas.tsx` | 230 | (app) uniquement — app/(app)/data-lab.tsx:305 (tuile « Vue unifiée » de SECTIONS) ouverte par openLayer app/(app)/data-lab.tsx:703 via le gabarit `/(app)/${screen}` ; jamais en chaîne littérale, d'où l'apparence d'orphelin | app/(app2)/data/session/[id].tsx — HeatmapTrace:1518 / ReplayTrace / ChannelsChart, alimentés par le même loadSessionTrajectory |
| `mon-equipement.tsx` | 224 | (app) seul — app/(app)/compte/index.tsx:377, app/(app)/index.tsx:460, app/(app)/settings.tsx:242 | app/(app2)/vous/equipement.tsx (carte BOÎTIER) |
| `conditions.tsx` | 221 | personne — aucun router.push, href, pathname ni tuile ne vise cette route ; data-lab.tsx ne la liste pas dans SECTIONS, et la seule occurrence du mot ailleurs est la clé d'ancre de app/(app2)/data/session/[id].tsx:132 | app/(app2)/data/session/[id].tsx (ancre « Conditions ») |
| `preservation.tsx` | 188 | (app) seul — app/(app)/pilotage-fini.tsx:35 | phase 'preservation' de app/(app2)/rec/fin.tsx |
| `programme.tsx` | 166 | (app) seul — app/(app)/progression.tsx:70 | app/(app2)/vous/carnet.tsx (onglet Programme) |
| `legal/[doc].tsx` | 154 | (app) app/(app)/settings.tsx:299 (pacte), :304 (cgu), :309 (confidentialite) — seuls liens entrants. DOSSIER : app/(app)/legal/ ne contient que ce fichier, il disparaît entièrement avec lui | app/(app2)/vous/document/[doc].tsx — même LEGAL_DOCUMENTS, même paramètre `doc`, même rendu markdown |
| `session/index.tsx` | 140 | personne — aucun lien vers /session ni /(app)/session dans app/ ni src/ ; les occurrences du mot « session » sont des useState, des libellés (app/(app)/stats.tsx:122) et des kind:'session' (app/(coach)/calendrier.tsx:72), jamais des routes | app/(app2)/rec/index.tsx |
| `session-media/[sessionId].tsx` | 133 | (app) seulement — app/(app)/bilan.tsx:652 (router.push(`/(app)/session-media/${sessionId}`)) ; app/(admin)/sessions-media.tsx est une route admin distincte, pas un lien vers celle-ci | app/(app2)/bilan/[sessionId].tsx (section « Souvenirs », lignes 477-478) |
| `pilotage-fini.tsx` | 121 | (app) seul — app/(app)/roulage.tsx:132, app/(app)/session/index.tsx:27 | app/(app2)/rec/fin.tsx |
| `bilan-pret.tsx` | 120 | (app) uniquement — preservation.tsx:108 | aucun |
| `club/index.tsx` | 106 | personne — aucune navigation ne vise /(app)/club ; appMap.ts:90 lui donne une zone mais TAB_MAIN_ROUTE.decouverte (appMap.ts:31) pointe sur /(app)/coachs | app/(app2)/club/index.tsx |
| `paddock.tsx` | 83 | personne — aucun lien dans app/ ni src/, seulement une entrée de zone dans src/lib/appMap.ts:43 | app/(app2)/rec/arrivee.tsx |

---

## CE QUE L'ARBRE EMPORTE AVEC LUI

Supprimer un écran supprime aussi les modules que lui seul consommait. La
plupart partent sans regret. Sept posent une vraie question — chacun vérifié en
listant ses consommateurs :

| Module | Retenu par | Ce qui disparaît avec lui |
|---|---|---|
| `@/components/ReportButton` | `coach/[id]`, `coachs`, `partenaires` — **tous « meurt »** | Le signalement et la modération quittent **entièrement** l'app pilote |
| `@/components/InsightTransparency` | 6 écrans V1 (`bilan`, `data-lab`, `debrief`, `index`, `progression`, `signature`) | La transparence des insights n'est portée nulle part en app2 |
| `@/hooks/useDetailLevel` | `replay`, `settings`, `stats`, `tours` | Le mode simple/expert n'a pas d'équivalent app2 |
| `@/services/cornerDeepDiveService` + `@/components/GForceBars` | `virage` seul | Tout le deep-dive virage ; `data/session` n'importe que `cornerEvolutionService` |
| `@/ble/flic2Service` | `debug-capture` seul | Le seul consommateur d'interface du bouton Flic |
| `@/components/IntentionCard` | `preparation` — **« meurt »** | **La seule surface d'écriture d'intention du dépôt** — à réhéberger bien que son hôte meure |
| `@/components/LicenseCard` | `carte-licence` seul | `vous/documents.tsx` reprend la donnée, pas le composant |

Dans l'autre sens, deux migrations sont **gratuites** : `catalogue.tsx` et
`partenaire/[id].tsx` n'ont aucun module `@/` exclusif à emporter.

### Une note du dossier V3 est périmée

Le dossier annonce **30 Mo de `three` / `@react-three/fiber`** à récupérer en
supprimant l'arbre. Il n'y a rien à récupérer : `package.json` ne déclare plus
ces paquets, et `src/circuit/CircuitTrace.tsx` n'existe plus. Les
`CircuitTraceFallback` que l'on croise dans `(app2)/index.tsx`,
`rec/index.tsx` et `rec/preparation.tsx` sont **trois fonctions locales
homonymes**, sans rapport avec la 3D.

---

## L'ORDRE D'EXÉCUTION

Une seule règle : **couper les portes avant de porter, porter ce qui n'a pas de
maison avant de supprimer.**

| # | Geste | Pourquoi à cette place |
|---:|---|---|
| 1 | Qualifier `SaisonSections.tsx:581` en `/(app2)/signature` | Une ligne. Tant qu'elle est ambiguë, aucune suppression n'est sûre |
| 2 | Recâbler les deux liens `(coach) → (app)` | Le coach reste dans l'application. **Ce n'est pas un changement de chemin** — voir l'encadré ci-dessous |
| 3 | Trancher et porter **`virage`** | 1 204 lignes, deux services exclusifs, un arbitrage doctrinal : il commande le calendrier |
| 4 | Réhéberger **l'écriture d'intention** vers `rec/fin` acte 3 | Sans elle, l'étape 8 du flux REC est une spécification sans code |
| 5 | Porter **`partage`** — durée d'expiration + `sanitizeIncludedMetrics` | Petit, sans dépendance, et c'est une régression RGPD à la seconde où V1 tombe |
| 6 | Porter **`objectifs`** et **`prochaine-fois`** vers le carnet de la Saison | Deux écritures pilote sans équivalent |
| 7 | Porter **`catalogue`** + **`partenaire/[id]`** | Migrations gratuites, aucun module exclusif |
| 8 | Porter **`belle-route`** vers `club/routes` | Conformément à l'Arbre, **pas** vers Territoire |
| 9 | Couper les 9 liens `(pro) → (app)` et les 5 `AccountButton` | Même geste que retirer `(pro)` ; n'a pas à retarder le reste |
| 10 | **Supprimer**, dans l'ordre inverse des dépendances | Les 63 écrans et leurs modules exclusifs ; `_layout.tsx` et `AppTabBar` en dernier |

### L'étape 2 a été tentée le 29/07, et annulée

Le lien `(coach)/pilote/[id].tsx:759` a été pointé sur
`/(app2)/bilan/[sessionId]`, puis remis en place. **Le bilan V2 est un bilan de
soi.**

Il charge bien la séance d'autrui — repli `fetchSessionById`, RLS arbitre. Mais
il calcule ensuite le record avec `fetchAllSessions(MON id)`
(`useBilan.ts:189` et `:277`) : le coach verrait la séance du pilote comparée à
**ses propres** séances. Pire, `bilanLogic.ts:91` renvoie `true` quand la liste
des autres séances est vide — **un coach sans séance verrait la séance du pilote
marquée RECORD, en or**, sans qu'aucune donnée ne le justifie.

Le bilan V1 ne calcule aucun record. La capacité est née en V2, sous
l'hypothèse silencieuse « le lecteur est le pilote ».

Recâbler demande donc de décider **ce que le coach lit** — sa propre vue de la
séance, ou le bilan du pilote paramétré par l'identité du pilote. C'est
l'arbitrage 1 ci-dessous, et cela bloque la suppression de `bilan.tsx`
(1 428 lignes). Consigné en `D-20` dans [`DETTE.md`](DETTE.md), la raison écrite
en commentaire à l'endroit du lien.

L'étape 1, elle, est **faite** : `SaisonSections.tsx` pousse désormais
`/(app2)/signature`, groupe qualifié.

---

## ÉTAT DES ARBITRAGES — TRANCHÉS LE 29/07/2026

| # | Sujet | Décision | Suite |
|---:|---|---|---|
| 1 | `virage` | **Ancre partagée** dans la séance du pilote, action selon le rôle | **Fait** — `?corner=` + « Annoter ce virage » ; lien coach recâblé |
| 2 | `debug-capture` | **Porter en app2 sous `__DEV__`** | **Fait** — `dev-capture.tsx`, ligne d'arrivée lue en base |
| 3 | Retrait de `(pro)` | **Recâbler maintenant, retirer plus tard** | **Fait** — 9 liens + 5 boutons partis |
| 4 | `partage`, durée | **7 et 30 jours seulement** | **Fait** — « sans limite » retiré, garde lexicale posée |
| 5 | `catalogue`, octet nul | *Résolu sans arbitrage* | La sentinelle est construite au rendu, jamais écrite en base |
| 6 | `virage-comparer` | **Le choix de deux tours rejoint la feuille** | **Fait** — onglet TRACÉ, deux passages superposés, aucun vainqueur |
| 7 | `ReportButton` | **Porter le signalement en app2** | **Fait** — `ReportLink` sous chaque citation et chaque offre |
| 8 | Deep-dive virage | **Porter les deux** | **Fait** — tracé du virage recalculé, trois barres de G |

**Les huit sont tranchés.** Ce qui reste du lot J5 est l'étape 10 : la
suppression elle-même.

### Ce que la décision 1 a changé au classement

`virage.tsx` était le seul écran classé **RESTE**, et pour une seule raison :
il portait l'unique chemin par lequel un coach désigne un virage à annoter.
**Ce chemin existe maintenant en app2.** Sa justification tombe.

Ce qu'il détient encore : `cornerDeepDiveService` et `GForceBars`, que la feuille
virage d'app2 ne reprend pas. Faut-il les porter ou les abandonner ? C'est une
question neuve, et beaucoup plus petite que celle qu'elle remplace.

**Le classement devient donc : 0 reste · 8 migre (sous réserve du sort du
deep-dive) · 63 meurt.**

---

## CE QUI RESTE APRÈS LES ARBITRAGES

Les huit décisions sont prises et appliquées. Les étapes 1 à 9 de l'ordre
d'exécution sont faites ; **plus aucun code hors de `app/(app)` ne navigue
vers `app/(app)`**, hormis `src/lib/appMap.ts`, la table de navigation de
l'arbre V1 lui-même.

Reste l'étape 10 : supprimer, dans l'ordre inverse des dépendances — les 63
écrans et leurs modules exclusifs, `_layout.tsx` et `AppTabBar` en dernier.
Elle n'est PAS engagée, et la règle 0.5 s'y applique : pas de suppression
avant sauvegarde vérifiée.

**Ce que la suppression devra rejouer.** Les 63 justifications de mort n'ont pas
été vérifiées une par une (voir la section méthode). Chaque suppression rejoue
sa vérification au moment où elle est faite.

---

## UN FICHIER ÉTAIT INVISIBLE À TOUTE RECHERCHE

`app/(app)/catalogue.tsx` portait un **véritable octet nul**, dans sa sentinelle
de catégorie. C'était le seul fichier `.ts` ou `.tsx` du dépôt dans ce cas.

Conséquence : `grep` et `ripgrep` classent alors le fichier en binaire. Ils
répondent `Binary file … matches` et **n'impriment aucune ligne**. 887 lignes
hors de portée de tout balayage par motif, sans qu'aucun outil ne le signale.

**J'ai d'abord classé ce constat en faux positif, à tort.** Mon premier balayage
`grep -qP '\x00'` n'avait rien trouvé — parce que grep basculait en mode binaire
et ne cherchait pas. Il fallait `-a`. La base a tranché : PostgreSQL refuse le
caractère nul dans un texte (`null character not permitted`), donc la sentinelle
ne pouvait de toute façon correspondre à aucune ligne.

**Corrigé** au commit `876e42e`. Nouvelle vérification à la rédaction de ce
document : **896 fichiers scannés octet par octet, zéro octet nul.**

---

## MÉTHODE, ET CE QUE CE DOCUMENT NE PROUVE PAS

Le classement a été produit par un relevé multi-agents, puis soumis à un critique
adversarial dont le travail a modifié trois verdicts (`partage` et `belle-route`
passent de « meurt » à « migre », `signature` de « reste » à « meurt »).

**Vérifié moi-même, à la main, avant d'être écrit ici :** le compte des fichiers
et des lignes ; la réconciliation du classement contre le disque (aucun fichier
oublié, aucun fichier fantôme) ; les trois routes en collision et le push non
qualifié ; les liens entrants depuis `(coach)`, `(admin)`, `(partner)` et
`(pro)` ; les montages d'`AccountButton` et leur cible ; le chemin d'écriture des
intentions ; la régression d'expiration des partages ; l'absence de `three` ;
l'absence d'octet nul résiduel ; les consommateurs des sept modules exclusifs du
tableau.

**Non vérifié une par une :** les 63 justifications de mort et les numéros de
ligne qu'elles citent. Elles ont été produites par le relevé et contrôlées par
échantillon — trois orphelins ouverts au hasard (`paddock`, `session/index`,
`conditions`), tous trois confirmés. Une justification fausse dans le lot reste
possible : **chaque suppression doit rejouer sa vérification au moment où elle
est faite**, pas s'appuyer sur ce document.

**Et le rappel qui vaut pour tout le programme :** rien n'a jamais tourné en
conditions réelles. Ce document décrit ce que le code permet.
