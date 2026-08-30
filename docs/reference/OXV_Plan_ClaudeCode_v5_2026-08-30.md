# Plan v5 pour Claude Code — après lecture du moteur et de la base

*30/08/2026 · remplace le plan v4 du même jour. Les paquets P1–P6 de v4 sont
conservés ou requalifiés ; ce qui change est dit en toutes lettres.*

---

## 0 · Ce que la lecture du 30/08 a changé

Quatre choses que j'affirmais sont fausses. Elles sont corrigées ici, et le détail
des preuves est dans `OXV_P0bis_Lecture_Moteur_2026-08-30.md`.

| J'ai écrit | La réalité |
|---|---|
| `telemetry_frames` contient 53 trames de test ; rien n'a tourné sur du réel | **26 999 trames réelles** à 25,0 Hz, Bouteville, 12/08/2026, trois tours détectés |
| Il faut créer le mécanisme de lien révocable `/share/{token}` | `app_progression_shares` + trois fonctions `SECURITY DEFINER` **sont en production** |
| Il faut écrire une garde `assistantSansConseil` | `aiSafetyFilter` fait ce travail, 52 termes, testé — on l'étend |
| Il faut refuser les lignes d'insights `-demo` | `MOTEURS_INSIGHTS_REELS` + `insightsMesures` + filtre en requête + test dédié : **trois barrières, déjà là** |
| La migration du lot 10c n'est pas appliquée | Appliquée le 29/08 (`20260829163749`). Les deux tables existent |

Cinq manques signalés dans ce dossier, cinq déjà couverts. Ma règle change :
je ne nomme plus un défaut sans avoir cherché sa garde, et je cite la garde ou je
me tais.

Et un constat structurel : **quarante modules sont écrits, testés et
dormants**, listés avec leur raison dans `modulesOrphelins.guard.test.ts`. Le
travail du Mans est donc très majoritairement du **branchement**.

---

## 1 · L'état réel, mesuré le 30/08

**Base de production.**

- 26 999 trames sur une séance, 100 % de fixes valides, 15,4 satellites,
  0,23 m de précision, gyroscope et trois G sur chaque trame.
- Trois tours : 360,485 · **327,542** · 339,483 s, pour 5 875,49 · 5 873,68 ·
  5 874,72 m — un écart de **1,81 m** sur 5,87 km.
- `heading` : **nul sur 100 % des trames**.
- `session_insights` : une seule ligne, `mirror-insights-demo`, sur une séance à
  zéro trame, avec un tour idéal fabriqué.
- QDI de la vraie séance : trajectoire 97 · régularité 34 · freinage 7 ·
  **fluidité 0 · accélération 0**.
- `cycle_steps` et `coach_annotations` : **zéro ligne**.
- 34 fonctions edge actives, dont `compute-session-insights-v3`, jamais exécutée
  sur la vraie séance.

**Dépôt.**

- 65 fiches de présentation typées + moteur de composition + service de sources :
  écrits, testés, **dormants**.
- Moteur d'insights côté app, console coach, data lab, `telemetry/gg`,
  `telemetry/segment`, `telemetry/accel`, `telemetry/calibration`, quatre modules
  de rendu, quatre composants : **dormants**.
- Deux commentaires du dépôt décrivent un état qu'il a quitté (migration lot 10c).

---

## 2 · Les deux points à traiter, et un ménage

**A · Les branches inertielles du QDI — diagnostic fait, décision à vous.**

Sur Bouteville, `fluidité 0` et `accélération 0` ne sont pas des `null` : les
branches ont calculé et trouvé le pire. Mesuré sur les 26 999 trames, le jerk
latéral a une **médiane de 0,286 g/s** mais une **moyenne de 2,240** et un
**p95 de 14,0** — soit 0,56 g de variation entre deux trames, quand l'amplitude
totale du signal est de 1,14 g. La variation moyenne d'une trame à la suivante
vaut 59 % de l'écart-type de toute la séance. C'est de la vibration, pas de la
conduite.

Un simple lissage sur 13 trames ramène la moyenne à **0,629 g/s**, soit une
fluidité de **78** au lieu de 0. Les seuils ne sont pas faux ; la chaîne leur
envoie un signal brut là où ils attendent un signal conditionné.

*La plomberie, elle, est juste :* `computeRegularite` sur les trois vrais tours
redonne exactement le 34 qui est en base.

**Ce que ça coûte :** un filtre (`savitzkyGolay` existe déjà dans
`kinematics.ts`), un incrément de `QDI_ALGO_VERSION`, un recalcul de
l'historique — quatorze analyses. **C'est une décision fondateur**, au sens
exact où `telemetry/calibration.ts` l'écrit : déplacer des chiffres sans le dire
est ce que ce dépôt refuse.

**B · Le cap absent — vérifié jusqu'au protocole.** `heading` est nul sur 100 %
des trames, et **le parseur n'y est pour rien** : ses vingt offsets ont été
confrontés au protocole RaceBox rev 8, ils sont justes, et la garde `& 0x20` est
mot pour mot le « valid heading » du constructeur. Le boîtier a laissé ce bit à
zéro pendant dix-huit minutes de roulage.

Le seul instrument qui dirait pourquoi n'est pas lu : `heading_accuracy`,
`speed_accuracy` et `pdop` sont trois colonnes créées par migration et **jamais
écrites** — zéro valeur sur 26 999 trames. Les écrire est gratuit. D'ici là,
aucune orientation à l'écran. La répétition du 19/09 tranchera en une requête.
Chaînes exactes dans `OXV_P0_Paquet_Execution_2026-08-30.md`.

**C · Ménage — la ligne de démonstration en base.** L'application ne la voit
pas : trois barrières la filtrent. Mais elle est le **seul** contenu de
`session_insights`, donc tout ce qui lit la table sans passer par le service voit
des chiffres inventés comme contenu total. À sortir de la production. **15 min.**

## 3 · Les paquets — révisés

Ordre strict. Un paquet, une session. Ne pas ouvrir un paquet dont le précédent
n'est pas vert.

### P0 · Les points ci-dessus — **le cap et le ménage aujourd'hui ; le QDI sur votre décision**

### P1 · Vérifier la chaîne sur la séance de Bouteville — **requalifié**

**Ce qui change :** ce n'était pas exécutable en v4 (« il faut d'abord une vraie
séance »). La séance existe depuis le 12/08. **Le paquet devient exécutable ce
soir.**

**But.** Faire basculer les écrans dépendants de `telemetry_frames` de « à
vérifier » à « finie », ou révéler les défauts.
**Protocole, pas code.** Ouvrir chaque écran sur `ff384ace…` et écrire ce qu'il
affiche.
**Preuve.** Une liste écrite, un écran par ligne, avec ce qui est apparu.
**Invite.** *« Liste les écrans dont le rendu dépend de `telemetry_frames`. Pour
chacun, ouvre-le sur la séance `ff384ace…` et écris ce qu'il affiche réellement.
Aucun code, aucune correction : uniquement le constat. »*

### P2 · Les deux circuits en base — inchangé

`le-mans-bugatti.geojson`, `albi.geojson`, ligne d'arrivée officielle en
`CaptureFinishLineInput`. Suivre exactement le chemin de `ricardo-tormo`.
**Preuve.** Une fixture rejouée sur chaque tracé produit des tours détectés.

### P3 · Le lot des écrans — **nouveau, et c'est le plus gros**

Monter les modules dormants. Ce n'est pas de l'écriture : c'est du branchement,
et chaque module sort de `CONNUS` dans le commit qui le branche.

Ordre proposé, du plus utile au Mans au moins urgent :

1. `DataConfidenceBanner` — porte la mesure d'écart, prérequis de la preuve P-1
2. `LapScrubber` — rend la Séance lisible tour par tour, debout au camion
3. `DebriefMirror` — alimente le Débrief J+1
4. `sessionInsightsEngine` — et l'exécution de `compute-session-insights-v3` sur
   la séance de Bouteville, qui n'a jamais tourné
5. `RadarEmpreinte` — avec son compteur `SIGNATURE · n / 3 SÉANCES`
6. `registrePresentations` + `compositionLogic` + `sourcesCompositionService` —
   la surface décrite en C-6

**Preuve.** `modulesOrphelins` : aucune entrée périmée, aucun orphelin neuf, et
la liste `CONNUS` a raccourci d'autant.

### P4 · La règle des mots-clés — **nouveau**

Le champ `court` sur les 40 chaînes de G-9, la seconde passe de
`check-doctrine.ts`, bloquante d'abord sur les écrans du Mans.
**Preuve.** La garde passe en rouge si l'on remet une phrase, et le prouve par un
test qui en remet une.

### P5 · Le bandeau de santé de la chaîne — inchangé

Quatre voyants sur `onCaptureLinkStatus` / `getCaptureLinkStatus`, qui existent.
**Preuve.** Boîtier débranché : premier voyant rouge sous 20 s, les autres justes.

### P6 · Secteurs officiels — inchangé

`secteursOfficiels.ts` au-dessus de `projectionCurviligne`, recalage hors ligne
sur trois tours. **Les trois tours existent** — Bouteville sert de banc d'essai
avant que le Mans ne serve de banc réel.

### P7 · Fusion GPS et centrale inertielle — **déclassé**

Ex-P3. Ce n'est plus un correctif de tremblement : c'est la seule voie vers un
cap, et le cap n'est pas nécessaire au Mans. Filtre complémentaire, pas de
Kalman, versionné. **Après Le Mans**, sauf si P1 montre qu'un écran en dépend.

### P8 · Le vocabulaire du potentiel — **presque fait**

Le catalogue des lectures a déjà tranché le 26/08 : la lecture s'appelle
**« Potentiel démontré »**, et sa méthode dit *« Aucune continuité vérifiée aux
jonctions entre morceaux : jamais un tour garanti. »* Reste à propager ce nom à
la maquette de console et aux specs. **0,5 j**, et la garde `idealLapNonBranche`
reste verte.

**Hors paquets et hors code :** la passerelle, les papiers, les courriers,
l'envoi du dossier « Le Stratège ».

---

## 4 · Ce qu'il faut savoir avant de montrer l'application à l'écurie

`cycle_steps` et `coach_annotations` sont vides. `lireAcquisValide` et
`lireVoixCoach` rendront `false` pour tout le monde. Les fiches P36 et P46 à P51
— passeport de compétences, carte de preuve d'une compétence, rétention au
prochain événement — resteront **écartées**, avec leur motif.

C'est correct, et c'est même la doctrine qui fonctionne. Mais ce n'est pas ce
qu'on ouvre devant un chef d'écurie en disant « voici ce que ça fait ». Ce qu'on
lui montre, c'est ce que la séance de Bouteville remplit réellement.

---

## 5 · Les décisions qui vous attendent

1. **G-9 — les quarante chaînes.** Champ `court` (1 j) ou exception datée (1 h).
   Je recommande `court`.
2. **Le débrief rédigé reste une feuille de récit** (G-8). Mon choix, isolé pour
   que vous puissiez le défaire.
3. **Le débrief IA : opt-out ou opt-in** avant le 25/09. C'est la dernière
   décision IA ouverte.
4. **Le compte écurie** — trois contraintes non négociables : jamais de biométrie,
   jamais deux pilotes côte à côte, le pilote voit ce que l'écurie voit. Pas
   avant Le Mans.
5. **Les deux commentaires périmés du dépôt** (migration lot 10c) — les corriger
   ou les laisser. Les laisser coûte la crédibilité du reste des commentaires,
   qui est l'un des vrais actifs de ce dépôt.

---

## 6 · Ce que je n'ai toujours pas lu

Les six visualisations de `components/insights/`. Les 36 routes coach. La partie
sécurité du bilan. `app/(app2)/data/session/[id].tsx` — **165 Ko sur un seul
écran**, ce qui est en soi un fait à regarder.
