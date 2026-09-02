# OXV Mirror — brief de dépôt

*À placer à la racine de `oxv-app`. Lu au début de chaque session de Claude Code.*
*Version du 30/08/2026, après lecture du dépôt et de la base de production.*

---

## Ce qu'est ce produit, en trois phrases

OXV Mirror enregistre ce qu'un pilote fait en piste, à 25 Hz, et le lui montre.
Il ne conseille pas, il ne classe pas, il n'explique pas. **Il montre.**

Cette retenue n'est pas une modestie de façade : OXV n'est pas agréé pour
l'enseignement du pilotage, et c'est elle qui autorise l'outil à entrer dans la
cabine d'un professionnel sans entrer dans le champ du coaching sportif.

---

## LA RÈGLE DE TRAVAIL NUMÉRO UN

**Avant d'écrire une fonction, cherchez si elle existe déjà.**

Cinq manques ont été signalés dans ce dossier par une lecture faite sans le
dépôt. **Les cinq existaient** : le rééchantillonnage en distance, la projection
curviligne, le chemin d'ingestion `.ubx`, le lien public révocable, et la garde
contre les moteurs de démonstration. Environ dix-huit jours de plan se sont
évaporés à la lecture.

Trois endroits à consulter avant toute écriture :

1. **`src/__tests__/modulesOrphelins.guard.test.ts`** — quarante modules écrits,
   testés et **dormants**, chacun avec sa raison et sa condition de sortie. Si
   ce que vous alliez écrire y figure, il ne reste qu'à le brancher.
2. **`src/features/presentations/registrePresentations.ts`** — les 65 fiches, et
   `compositionLogic.ts` qui décide de ce qui s'ouvre.
3. **La liste des migrations et des fonctions edge** — 34 fonctions actives.

**Ne nommez jamais un défaut sans citer sa garde.** Si vous ne trouvez pas la
garde, cherchez encore avant d'affirmer qu'elle manque.

---

## Les interdits — ils ne se négocient pas ligne par ligne

**Jamais de conseil.** Aucun texte, aucune étiquette, aucune notification ne dit
au pilote quoi faire. Lexique proscrit : *devrait, il faut, essayez, améliorez,
optimisez, corrigez*. Le filtre existe : `src/services/aiSafetyFilter.ts`,
52 termes. On l'étend, on ne le double pas.

**Jamais de causalité.** On pose les faits côte à côte, on ne les relie pas.
Proscrit : *parce que, donc, grâce à, à cause de, ce qui explique, la raison
est*. Cela vaut pour le visuel : ni trait, ni flèche, ni couleur partagée entre
une note et un tour.

**Jamais de classement entre pilotes.** Un pilote se compare à lui-même et au
plateau officiel de l'épreuve — jamais à un autre pilote nommé, teammate
compris. Les murs publics n'affichent ni chrono, ni classement, ni donnée de
plateau.

**Jamais de nom sur une surface publique.** Numéros de course et pseudonymes.
La table `plateau` ne contient aucun nom de tiers.

**Jamais un chiffre qui ne vient pas de la base.** Un modèle de langage écrit une
requête ; il ne produit pas de valeur.

**Jamais de phrase sur une feuille de données.** Voir la règle des mots-clés
ci-dessous.

**Jamais un écran blanc.** Cinq états obligatoires ; l'état vide nomme le champ
manquant.

**Jamais de biométrie hors du canal coach.** `liveHealthGate.ts` est
fail-closed, liste blanche stricte. Données de santé au sens de l'article 9.

**Jamais dormir sans le dire.** Brancher, ou inscrire dans la liste des
orphelins avec la raison et la condition de sortie. Un drapeau sans déclencheur
nommé ni date est du code mort déguisé.

---

## La règle des mots-clés

**Toute feuille de données ne montre que des mots-clés, jamais de phrase.**

Une chaîne est une phrase si elle compte **plus de trois mots ET** contient un
mot outil : `le la les un une des du de` · `vous votre vos` ·
`est sont a ont était sera` · `dans avec pour que qui sur sans` ·
`plus moins ce cette`.

Quatre règles d'écriture d'un mot-clé : majuscules, forme `SUJET` ou
`SUJET · PRÉCISION`, jamais de verbe conjugué ; trois mots au plus de chaque
côté du point médian ; il résume le sujet, il ne paraphrase pas ;
**aucun mot outil, jamais** — les mots-clés se composent, et deux fragments
licites peuvent produire une chaîne qui ne l'est plus.

**Les feuilles de récit** — le débrief rédigé, la phrase du coach, les notes du
pilote — gardent la prose, sous le filtre existant. Le manifeste des deux
familles vit dans `src/lib/surfacesRestitution.ts` ; une surface absente des
deux est elle-même une violation.

---

## La règle de taille — mesurée, pas choisie

`ISO 9241-303` fixe la hauteur de capitale en minutes d'arc : plancher **16′**,
cible **20 à 22′**. À **600 mm** — bras tendu, debout au camion — sur une tablette
à 264 ppi :

**Rien sous 21 pt. Tout ce qui doit être lu de façon fiable à 29 pt.**

La maquette de console actuelle porte ses mots-clés à 7,3′-12,3′, soit la moitié
du plancher, pendant que ses nombres sont à 28-45′. **Elle rend les nombres
lisibles et le sens illisible** — or la règle des mots-clés fait des mots-clés le
contenu.

Conséquence à ne pas contourner : **on ne peut pas seulement grossir, il faut
couper.** Voir `design/72_lisibilite.html` — la même feuille passe de trente-quatre
valeurs à douze. La contrainte de taille est une contrainte éditoriale déguisée.

**Le fond sombre reste** : en forte lumière ambiante l'effet de polarité disparaît
(Dobres 2017). Il se paie en taille, pas en couleur. Et sur fond sombre, un texte
clair paraît plus gras — la correction est l'axe **`GRAD`** d'une fonte variable,
jamais une baisse de `font-weight`, qui décalerait les chasses.

---

## Le ton, dans tout ce qui s'affiche

Minimalisme sec. Vouvoiement. Aucun emoji, aucune exclamation, aucun
encouragement, aucune félicitation.

Vocabulaire de télémétrie **figé** : Cap, Trajectoire, Anticipation, Visée,
Plongée. Pas de renommage avant données réelles.

**Ne dites jamais « tour idéal ».** Le catalogue a tranché le 26/08 : la lecture
s'appelle **« Potentiel démontré »**, et sa méthode dit *« Aucune continuité
vérifiée aux jonctions entre morceaux : jamais un tour garanti. »* La garde
`idealLapNonBranche` échoue le jour où `idealLapTime` est câblé à un écran.

L'assistant s'appelle « Questionner ses données ». Pas de nom propre, pas de
personnalité, pas de voix. Le faucon est un totem interne : jamais dans un
contenu client, sous aucun nom.

---

## Les sept règles de structure

| # | Règle | Garde | État au 30/08 |
|---|---|---|---|
| R1 | Tout écran a **deux** entrées. Exceptions listées, justifiées, datées | `deuxEntrees` | **à écrire** |
| R2 | Aucun orphelin **neuf**, et aucune entrée périmée dans la liste connue | `modulesOrphelins` | en place |
| R3 | Les deux univers visuels ne se mélangent pas ; seule la couche 2 traverse | `frontiereUnivers` | **à écrire** |
| R4 | L'assistant ne conseille jamais | `aiSafetyFilter`, étendu | en place |
| R5 | Toute requête de trajectoire trie sur `elapsed_ms`, jamais `created_at` | `triElapsedMs` | **à écrire** |
| R6 | Tout écran de donnée monte les cinq états et nomme le champ attendu | `cinqEtats` | **à écrire** |
| R7 | Aucun mur public ne porte de classement ni de donnée de plateau | `murSansClassement`, `plateauNonPublic` | **à écrire** |
| R8 | Aucune phrase sur une feuille de données | `check-doctrine`, 2ᵉ passe | script en place, 2ᵉ passe à écrire |

**La colonne d'état a été ajoutée le 30/08, à l'installation du brief, et c'est
une correction de spécification — la règle du dossier l'exige.** Le tableau
d'origine nommait huit gardes comme si elles existaient ; **six n'existent sous
aucun nom**, vérifié par recherche sur `src/` et `app/`. Deux fichiers cités
ailleurs dans ce brief sont dans le même cas : `src/lib/surfacesRestitution.ts`
(le manifeste des deux familles de surfaces) et `src/services/liveHealthGate.ts`
— ce dernier est *invoqué* par deux modules de `features/biometrie` sans exister.

C'est exactement la « spécification fausse qu'on suit » contre laquelle ce
document met en garde : une règle qui s'appuie sur une garde absente n'arrête
rien, et une session qui la cite croit s'appuyer sur un cliquet. **Écrire ces
gardes est du travail, pas une formalité** — chacune vaut un lot.

**Une garde rouge arrête le travail.** On ne la contourne pas, on ne la
commente pas, on ne l'ajoute pas à une liste d'exclusions. Si elle gêne, c'est
la conception qu'on rediscute.

**R2 a une subtilité** : la garde exige `mesures.length > 0`, pour qu'un
résolveur cassé ne rende pas la liste artificiellement verte. « Zéro orphelin »
n'est donc pas un objectif atteignable ni souhaitable. Le bon geste est : un
module branché **sort de `CONNUS` dans le même commit**.

---

## L'état réel, mesuré le 30/08/2026

**Ce qui tourne.** Une capture réelle existe : séance
`ff384ace-d6ce-414b-8338-cef030218ee0`, Bouteville, 12/08/2026 — **26 999 trames
à 25,0 Hz exactement**, trois tours (360,485 / **327,542** / 339,483 s) de
5 875 / 5 874 / 5 875 m, 100 % de fixes valides, 15,4 satellites, 0,23 m de
précision, gyroscope et trois G sur chaque trame.

**C'est la séance de référence.** Toute vérification d'écran se fait sur elle.
Réserve : c'est une boucle **routière**, roulée de nuit, avec deux arrêts à 7,8
et 12,2 km/h. Elle valide la chaîne ; elle ne calibre pas un seuil de piste.

**Ce qui ne tourne pas.**

- `heading` est **nul sur 100 % des trames**. Le parseur est juste — vérifié
  offset par offset contre le protocole RaceBox rev 8 — c'est le boîtier qui
  laisse le bit 5 des *Fix Status Flags* à zéro. **N'affichez aucune
  orientation.**
- `heading_accuracy`, `speed_accuracy`, `pdop` : trois colonnes créées par
  migration et **jamais écrites**. Ce sont elles qui rendraient la question du
  cap décidable.
- QDI sur la vraie séance : `fluidité 0`, `accélération 0`, `freinage 7`.
  Les branches inertielles dérivent un signal **brut** : jerk latéral de médiane
  0,286 g/s mais de moyenne 2,240 (p95 14,0). Lissé sur 13 trames, la moyenne
  tombe à 0,629 → fluidité 78. **Ne touchez pas aux seuils sans décision
  explicite du fondateur** : c'est un incrément de `QDI_ALGO_VERSION` et un
  recalcul de l'historique.
- `session_insights` est **vide** — remesuré le 02/09/2026. La ligne
  `mirror-insights-demo` que cette section décrivait le 30/08 n'y est plus.
  Les trois filtres de l'application restent en place et restent justes ; ils
  n'ont simplement plus rien à écarter.
- `app_segment_analyses` est **vide elle aussi**, sur toute la table. C'est
  amont de tout le reste : `analyzeSessionService` ne lance les insights que
  `if (segmentsPersisted > 0)`. Tant que cette table est vide, aucune lecture
  approfondie ne peut naître, quel que soit l'état des moteurs.
- `cycle_steps` et `coach_annotations` : **zéro ligne**. Les fiches P36 et
  P46–P51 resteront écartées.
- Deux tracés sur six **ne se referment pas** : Bouteville 85,3 m entre son
  dernier point et son premier, Haute Saintonge 17,1 m ; Albi, le Bugatti,
  Ricardo Tormo et la Charente à 0,0 m. Une trame qui tombe dans ce trou se
  projetait sur un sommet, et son écart latéral — la moitié du trou — retirait
  la moitié de la marge du virage. Corrigé le 01/09 (`horsTrace`,
  `ecartBouclageM`) : l'écart de ces trames ne compte plus. **Le trou de
  Bouteville, lui, est toujours là** : c'est une donnée à reprendre, pas du
  code.

**TROIS LIGNES DE CETTE SECTION ÉTAIENT FAUSSES AU MOMENT OÙ ELLE A ÉTÉ
ÉCRITE — remesuré le 02/09/2026.** Le brief exige qu'on corrige une
spécification qui se trompe, et il faut le faire pour lui-même :

- « Bouteville n'a **aucun virage détecté** (`corners` nul) » — **faux**. Le
  circuit porte **douze** virages, écrits le 30/08 à 23 h 55, soit deux minutes
  avant que ce document ne soit rédigé. Piège au passage : `circuits.corners`
  est un **objet** `{params, corners:[…], n_corners}`, pas un tableau — un
  `jsonb_array_length` dessus échoue, il faut lire `corners->'corners'`.
- « L'intention du 12/08 … son `session_id` est **nul** » — **faux**. Elle
  pointe sur `ff384ace`, depuis le 30/08 à 23 h 53. **P01 n'est pas écartée**,
  et elle porte un verbatim de six lignes du fondateur.
- « `session_insights` ne contient qu'une ligne » — **plus vrai**, voir
  ci-dessus.

Les trois se sont démenties en quarante-huit heures. C'est la démonstration de
la règle du dossier : **toute affirmation de plus de deux semaines se remesure,
et celle-ci n'a pas tenu deux jours.**

---

## Ce qui existe déjà et qu'il ne faut pas réécrire

| Besoin | Ce qui le porte |
|---|---|
| Rééchantillonnage en distance | `src/telemetry/resample.ts` |
| Projection curviligne | `src/telemetry/projectionCurviligne.ts` |
| Lien public révocable | `app_progression_shares` + 3 fonctions `SECURITY DEFINER` |
| Filtre doctrinal de sortie | `src/services/aiSafetyFilter.ts` |
| Débrief déterministe | `src/services/debriefGenerator.ts` |
| Détection de virages | `detect-circuit-corners` + `circuitGenerator.ts` |
| Choix de la lecture à ouvrir | `compositionLogic` + `registrePresentations` |
| Sources du moteur | `sourcesCompositionService` + `pilot_presentation_*` |
| Garde des moteurs de démo | `MOTEURS_INSIGHTS_REELS` + `insightsMesures` |
| Santé de la liaison | `onCaptureLinkStatus`, `getCaptureLinkStatus` |
| Récupération OSM | `fetchOsmWay` dans `circuitGenerator.ts` |

---

## Comment travailler ici

**Branche.** `migration/sdk-55`. `main` protégée, intégration continue verte
avant fusion.

**Les spécifications.** `docs/specs/A_Terrain.md` à `G_MotsCles.md`. Chaque
interface y donne sa route, ses deux appelants, ses données, ses cinq états, ses
interdits, ses critères d'acceptation et sa garde.

**Quand la spécification se trompe.** Les blocs C et F ont été corrigés le 30/08
après lecture. Les autres peuvent porter des erreurs du même genre. Vérifier
dans le code, **corriger la spécification**, et le dire. Une spécification fausse
qu'on suit est pire qu'une spécification absente.

**Mesurer avant de croire.** Toute affirmation de plus de deux semaines se
remesure. Le registre de disposition compte 697 lignes.

**Un écran = un objet.** Pas de composant qui sert deux écrans en changeant de
forme. La couche 2 est la seule exception, et elle est explicite.

---

## Le calendrier

| Date | Ce qui doit être vrai |
|---|---|
| 02/09 | Pièces de la passerelle commandées ; courriers ITS et FFSA partis |
| ~~05/09~~ | ~~Circuit du Bugatti en base, virages détectés~~ — **fait le 30/08** |
| 08/09 | Chemin d'ingestion unique |
| 12/09 | Coach ouvert au multi-circuit ; secteurs officiels ; cinq états |
| 15/09 | Passerelle assemblée, deux heures de route sans perte |
| **19/09** | **Répétition de Bouteville. Point de non-retour du matériel** |
| 20/09 | Pass équipe obtenu par écrit |
| 26-27/09 | Le Mans — 24 Heures Camions, devant une écurie professionnelle |
| 10-11/10 | Albi — finale du championnat — **circuit en base depuis le 30/08** |

**Ce qui n'est pas prouvé le 19 septembre ne part pas au Mans.** Une
fonctionnalité à moitié faite qui s'ouvre devant un pilote professionnel coûte
plus cher que son absence.

**Ordre de sacrifice.** Tiennent en dernier : les circuits en base, le chemin
d'ingestion, la passerelle, la répétition. Tombent en premier : le référentiel
plateau (il se relève à la main sur la feuille officielle), la page J+1, les
secteurs officiels, l'ouverture du coach.

---

## Décisions prises, à ne pas rouvrir

| Sujet | Décision | Date |
|---|---|---|
| Mots-clés | Champ `court` obligatoire ; la phrase reste au second geste | 30/08 |
| Débrief rédigé | Reste une feuille de récit, prose sous filtre | 30/08 |
| Tour idéal | Vocabulaire rétrogradé en « Potentiel démontré » | 26/08 |
| Lecture plateau ITS | Automatisée dès Le Mans, avec ses garde-fous | 30/08 |
| Compte écurie | Voit tout par défaut — **pas avant Le Mans** | 30/08 |
| Taille de texte | Plancher 21 pt, cible 29 pt à 600 mm | 30/08 |
| Fond sombre | Conservé, payé en taille | 30/08 |
| **Signal inertiel** | **Calibration d'abord, filtre ensuite.** On redresse avant de lisser : superposer deux corrections sans mesurer entre les deux rendrait chacune indémontrable | 30/08 |
| **Fonte** | **Une paire assumée** — une grotesque de caractère pour les mots-clés, une fonte à axe `GRAD` pour les nombres. Le nombre est la mesure, le mot-clé l'étiquette ; les distinguer est honnête. Reste à faire coïncider les chasses de chiffres | 30/08 |
| **Débrief IA** | **Opt-out** — il se rédige par défaut, le pilote peut le couper | 30/08 |
| **Albi en base** | **Fait le 30/08.** Way OSM 95802415, anneau fermé de 137 points, 3 563 m mesurés pour 3 565 officiels. Ligne donnée en décimal puis confirmée en DMS — les deux à 40 cm l'une de l'autre, et à **0,6 m du tracé**. Cap 122,1°. `turns_count` laissé NUL : les sources publiques se contredisent (9 en configuration historique, 15 en actuelle), on ne tranche pas un chiffre officiel sur une source incertaine | 30/08 |
| **Le Bugatti en base** | **Fait le 30/08, six jours avant la butée.** Relation OSM 2725877 (18 ways chaînés par leurs nœuds partagés), tracé recalé pour démarrer à la ligne. Ligne d'arrivée donnée par le fondateur : 47.949881 / 0.207545, **vérifiée à 0,31 m du tracé**, cap au franchissement 1,9° — plein nord, la ligne droite des stands. 4 185 m et 14 virages officiels ; la polyligne mesure 4 165 m et le détecteur y lit 9 virages, l'écart venant de la résolution OSM et du seuil de rayon à 100 m | 30/08 |

## Décisions en attente, à ne pas contourner

| Sujet | Ce qu'il bloque | Butée |
|---|---|---|
| *(aucune)* | — | — |
| **Geste de calibration au prévol** | Le redressement du signal, donc le filtre, donc les deux branches à zéro | 19/09 |

### Ce que la calibration a mesuré sur Bouteville — 30/08

La décision « calibration d'abord » a été exécutée, et elle rend un résultat
net : **la calibration ne peut PAS être établie sur cette séance.**

`etablirCalibration` exige un arrêt de trois secondes sous 2 km/h. La séance en
compte 182 trames sous ce seuil, mais **la plus longue plage continue fait
2,01 s**. Le module rend donc `null`, et refuse — comme il doit.

Desserrer le seuil ne sauve rien, et le tableau dit pourquoi :

| Seuil | Plage la plus longue | Plages ≥ 3 s | Tangage lu | Roulis lu |
|---|---|---|---|---|
| 2 km/h | 2,01 s | **0** | −1,32° | +0,87° |
| 5 km/h | 3,42 s | 2 | −9,18° | −3,79° |
| 8 km/h | 9,21 s | 4 | −4,95° | −4,16° |
| 15 km/h | 21,48 s | 7 | −7,09° | −2,04° |

**Les angles se contredisent d'un seuil à l'autre — de −1,3° à −9,2°.** C'est la
démonstration que ces plages ne mesurent pas la gravité seule : elles mesurent
la gravité PLUS l'accélération de la voiture. Un seuil desserré produirait une
correction d'apparence sûre et fausse.

Deux conséquences, à porter au 19/09 :

1. **Le prévol doit porter un geste de calibration** — cinq secondes à l'arrêt,
   moteur tournant, avant l'armement. C'est un poste d'écran, pas un calcul.
2. **La norme au repos vaut 0,972 à 0,982 g**, soit 2 à 3 % sous 1 g de façon
   constante. Le module le signale déjà (« zéro du capteur suspect ») ; c'est la
   seule composante du zéro qu'un arrêt permette de lire.

Ne pas contourner une décision manquante par une hypothèse. La signaler et
attendre.
