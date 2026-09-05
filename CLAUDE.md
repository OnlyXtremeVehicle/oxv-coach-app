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
3. **La liste des migrations et des fonctions edge** — **36 fonctions actives**, remesuré le 05/09 (le dossier en annonçait 34).

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

| # | Règle | Garde | État |
|---|---|---|---|
| R1 | Tout écran a **deux** entrées. Exceptions listées, justifiées, datées | `deuxEntrees` | **en place** (05/09) — 0 orphelin, 97 exceptions en six familles, dont **dix tiroirs pilotes datés au 19/09** |
| R2 | Aucun orphelin **neuf**, et aucune entrée périmée dans la liste connue | `modulesOrphelins` | en place |
| R3 | Les deux univers visuels ne se mélangent pas ; seule la couche 2 traverse | `frontiereUnivers` | **en place** (05/09) — cinq franchissements levés |
| R4 | L'assistant ne conseille jamais | `aiSafetyFilter`, étendu | en place |
| R5 | Toute requête de trajectoire trie sur `elapsed_ms`, jamais `created_at` | `triElapsedMs` | **en place** (03/09) |
| R6 | Tout écran de donnée monte les cinq états et nomme le champ attendu | `cinqEtats` | **en place** (03/09) |
| R7 | Aucun mur public ne porte de classement ni de donnée de plateau | mesuré le 03/09, voir ci-dessous | **partiellement tenu** |
| R8 | Aucune phrase sur une feuille de données | `check-doctrine`, 2ᵉ et **3ᵉ** passes | **en place** — la 2ᵉ passe existait depuis P4 (la ligne « à écrire » était périmée) ; la **3ᵉ**, les quatre règles d'ÉCRITURE, est posée le 05/09 en cliquet |

**La colonne d'état a été ajoutée le 30/08, à l'installation du brief, et c'est
une correction de spécification — la règle du dossier l'exige.** Le tableau
d'origine nommait huit gardes comme si elles existaient ; **six n'existent sous
aucun nom**, vérifié par recherche sur `src/` et `app/`.

**Ce paragraphe nommait AUSSI deux fichiers comme inexistants. Les deux
existent — remesuré le 03/09/2026 :**

- `src/lib/surfacesRestitution.ts`, **5 588 octets, écrit le 01/09**. Il porte
  le manifeste des deux familles de surfaces, et `cinqEtats.guard` l'importe.
- `src/services/liveHealthGate.ts` — le chemin était faux, pas le fichier. Il
  vit sous **`src/services/v2/liveHealthGate.ts`**, 6 929 octets, daté du
  17/08, donc antérieur au brief. « Invoqué sans exister » décrivait une
  recherche au mauvais endroit.

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
  **La chaîne n'est pas cassée, elle n'a jamais tourné** : `pisteDepuisBase` a
  été branchée le 01/09, et la dernière séance date du 12/08. Le chemin le moins
  cher pour l'exécuter existe déjà — le bouton « Segments » de
  `app/(admin)/analyse-session/[id].tsx`, sans run à rouler ni bilan à ouvrir.
  **L'aller-retour de la marge est réparé depuis le 03/09.** `upsertAnalysis`
  estampait `algo_version = 'v1.0'`, un littéral qui ne désignait aucun moteur
  et différait donc TOUJOURS de celui du cron : la séance revenait dans la file
  dans l'heure, et le cron réécrivait `margin_global` avec son calcul dégradé —
  il n'a pas les segments trackviz, son en-tête le dit. La version dit
  maintenant qui a calculé (`app-v1.0`), le cron l'exclut, et
  `cron-analyze-pending-sessions` est déployée en version 24.

  **Les deux crons ont été MESURÉS le 03/09, en rejouant leur propre requête :**

  | Job | Cible | Réponse |
  |---|---|---|
  | 4 · `analyze-pending-sessions` | `cron-analyze-pending-sessions` | **200**, `processed: 0` |
  | 5 · `compute-insights-hourly` | `compute-session-insights` | **401** `UNAUTHORIZED_NO_AUTH_HEADER` |

  Le job 4 fonctionne : il s'authentifie par `X-Cron-Token` sur une fonction en
  `verify_jwt = false`. Le job 5 ne peut pas : sa cible est en
  `verify_jwt = true` et il n'envoie aucun en-tête `Authorization`. **Il est
  inerte depuis toujours, et pas pour une raison passagère.** Le réparer suppose
  d'ouvrir une porte à jeton sur la fonction visée — un changement du modèle
  d'authentification, à décider, pas à glisser.

  **REMESURÉ LE 05/09, ET TROIS CHOSES S'AJOUTENT.**

  **1. La surface de contrôle MENT, et c'est le plus important.**
  `cron.job_run_details` donne `succeeded` pour le job 5 — six fois en six
  heures, la dernière à 15 h 30. pg_cron dit vrai à sa façon : il a bien mis la
  requête en file. **L'échec ne se lit que dans `net._http_response`**, où les
  six mêmes appels rendent `401 UNAUTHORIZED_NO_AUTH_HEADER`. Qui vérifierait
  l'état des crons par la table des exécutions conclurait que tout va bien.
  Aucun écran de la console ne lit ces tables — vérifié — donc personne n'est
  trompé aujourd'hui ; mais la prochaine personne à regarder le sera.

  **2. Le job 5 envoie DÉJÀ le jeton.** Sa commande porte le même
  `X-Cron-Token` que le job 4, tiré du même secret de coffre. L'intention était
  donc identique ; seul manque `verify_jwt = false` sur la cible. La décision
  n'est pas « faut-il un modèle à jeton », elle est « ouvre-t-on cette porte-là ».

  **3. Et la cible est le moteur RETIRÉ.** Le job 5 vise
  `compute-session-insights` — v1 — dont plus aucun code n'est appelant depuis
  le 03/09, et que v3 domine sur toutes les colonnes ET sur la forme lue. **Le
  réparer tel quel ferait écrire douze colonnes là où v3 en écrit vingt-deux**,
  sur des séances déjà calculées : ce ne serait pas une remise en service, ce
  serait une dégradation horaire. Le repointer vers v3 ne suffit pas non plus —
  `compute-session-insights-v3` est **aussi** en `verify_jwt = true`.

  La question à trancher n'est donc pas celle qui était écrite. Elle est :
  **ce travail horaire doit-il exister ?** Le job 4 traite déjà la file des
  séances en attente, et il rend 200.

  **TRANCHÉ ET FAIT LE 05/09 — et le mécanisme retenu n'ouvre aucune porte.**

  La décision était « repointer vers v3 et ouvrir la porte à jeton ». En
  l'implémentant, un troisième fait s'est ajouté : **l'application appelle v3
  avec un JWT d'utilisateur**. Passer v3 en `verify_jwt = false` aurait donc
  cassé `analyzeSessionService` et le bouton admin, sauf à écrire une DOUBLE
  authentification à la main sur la fonction qui écrit les lectures. Et le
  coffre ne porte pas de clé de service, donc la voie « le cron envoie un JWT de
  service » supposait d'en stocker une — une posture, pas une plomberie.

  **Le balayage vit donc dans `cron-analyze-pending-sessions`**, qui EST déjà la
  porte du cron : `verify_jwt = false`, contrôle de jeton, clé de service dans
  son environnement. Son mode `insights` balaye les séances SEGMENTÉES sans
  lecture v3 et appelle v3 par `functions.invoke`, donc en appelant autorisé.
  **v3 garde `verify_jwt = true` et son code n'est pas touché.**

  Vérifié de bout en bout, par pg_cron lui-même sur la commande réelle :

  | Appel | Réponse |
  |---|---|
  | sans jeton | **401** `unauthorized` |
  | mauvais jeton | **401** `unauthorized` |
  | jeton, `{"mode":"insights"}` | **200** `segmentees: 0, processed: 0` |

  Zéro séance traitée est le BON résultat : `app_segment_analyses` est vide, et
  le balayage reprend le critère de l'application — sans segment, pas de lecture.

  **UN DÉFAUT ARMÉ, TROUVÉ EN CHEMIN.** Le contrôle de jeton de cette fonction
  était **fail-open** : `if (expectedToken)`, donc sans secret configuré elle
  s'ouvrait au public — sur une fonction qui écrit avec la clé de service, et
  dont l'en-tête affirmait sans condition « on vérifie un secret pour bloquer le
  public ». Mesuré avant de corriger : elle rendait bien 401, le secret est
  posé. Le défaut n'était pas ouvert, il était **armé**. Fail-closed depuis la
  version 25.

  **Et le numéro du travail a changé** : `unschedule` puis `schedule` crée une
  nouvelle ligne. « compute-insights-hourly » porte désormais le `jobid` **14**,
  plus le 5. Tout document qui le nomme par son numéro est périmé.
- `cycle_steps` et `coach_annotations` : **zéro ligne**. Les fiches P36 et
  P46–P51 resteront écartées.
- **Haute Saintonge** ne se referme pas : 17,1 m entre son dernier point et
  son premier. Albi, le Bugatti, Ricardo Tormo, la Charente et — depuis le
  02/09 — Bouteville sont à 0,0 m. Une trame qui tombe dans un tel trou se
  projette sur un sommet, et son écart latéral vaut la moitié du trou : comme
  `computeSegmentMargin` lit le MAXIMUM d'écart du virage, **une seule trame
  retirait la moitié de la marge** (86,04 → 37,5, mesuré). Le garde de recalage
  mesure la MÉDIANE et ne pouvait pas le voir. `horsTrace` neutralise l'effet
  depuis le 01/09 ; Haute Saintonge est le tracé de démonstration, sa cause
  n'est pas reprise.

### Le tracé de Bouteville a été repris le 02/09/2026

Il portait deux défauts, au même endroit, dont aucun n'était dans la recette.
Les deux sont réparés, et le circuit rejoint Albi et le Bugatti.

**1. L'anneau n'était pas refermé — et la longueur déclarée le prouvait.**

| Circuit | Déclarée | Polyligne | Manque | Bouclage |
|---|---|---|---|---|
| **Bouteville, avant** | 5 910 m | 5 820,8 m | **89,2 m** | **85,3 m** |
| **Haute Saintonge** | 2 210 m | 2 189,9 m | **20,1 m** | **17,1 m** |
| Albi · Bugatti · Tormo · Charente | — | — | ≤ 26 m | 0,0 m |

Sur les deux tracés ouverts, et sur eux seuls, le manque égalait le bouclage à
quatre mètres près. `length_km` comptait donc un segment que
`centerline_latlon` ne portait pas. **Le fichier source l'avait**, lui :
`src/circuit/data/bouteville.geojson` porte 140 points, fermé à 0,00 m, long de
5 906,1 m. Un seul point — celui de fermeture — avait été perdu à l'import du
12/08. La description en base disait d'ailleurs elle-même « boucle fermée à
0,00 m » : elle décrivait le fichier, pas ce qui avait été stocké.

**2. Le tracé ne commençait pas à la ligne — 1 735 m.** Albi (0,5 m) et le
Bugatti (1,1 m) avaient été recalés le 30/08 ; Bouteville est antérieur et ne
l'avait jamais été.

**Ce qui a été fait**, méthode d'Albi : départ au **pied de la perpendiculaire**
sur le segment 44 (t = 0,218), à **4,37 m** de la ligne — le sommet le plus
proche était à 23,31 m. Résultat en base : **141 points, bouclage 0,00 m,
5 906,1 m, premier point à 4,37 m de la ligne.** Cap au franchissement
**336,7°** contre 336,6° annoncés : le sens du tour est inchangé.

**Les virages ont été recalculés, et il y en a treize, plus douze.** Ce n'est
pas une dérive de réglage — les paramètres sont identiques : c'est la couture de
85 m qui coupait une courbe en deux morceaux dont aucun ne franchissait le seuil
de rayon. Le calcul a été fait par `generateCircuit`, le module que la fonction
edge **importe** — pas par une réimplémentation.

**La provenance était fausse, et c'est une obligation, pas une nuance.**
« Relevée par le fondateur » : faux. Les sommets sont des nœuds OpenStreetMap —
way 675583973 (D152), way 806776936 (Rue du Prévôt), way 80842946 (D699). Et
l'objection sérieuse — un relevé versé *dans* OSM — se ferme par l'historique
des nœuds : 1615886624 version 1 de **2012**, 6326714723 version 1 de **2019**,
jamais rééditées. Le circuit a été créé en base **3 h 26 avant** la première
trame du 12/08. **Les six tracés sur six sont OSM**, donc sous ODbL, donc
l'attribution est due partout où ils sont montrés — ce que `CircuitMap` ne
faisait pas, corrigé le 02/09.

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

### Les fonctions edge sont indéployables depuis le 03/09 — mesuré

Deux déploiements de `compute-session-insights-v3`, sur un code dont un seul
bloc avait changé :

    02/09  21 h 14 UTC   version 12   ACTIVE
    03/09  16 h 18 UTC   JSR publie @supabase/supabase-js 2.115.0
    03/09  ~16 h 20 UTC  REFUSÉ — « Could not find npm package
                           '@supabase/storage-js' matching '2.115.0' »
    03/09  16 h 24 UTC   version 13   ACTIVE, une fois épinglée

**L'échec est tombé six minutes après la publication en amont**, et rien de
notre côté n'avait bougé. **JSR a publié `@supabase/supabase-js`
2.115.0 le 03/09 à 16 h 18 UTC**, et cette version déclare une dépendance npm
sur `@supabase/storage-js@2.115.0` — jamais publiée : npm s'arrête à 2.114.0 en
stable, 2.115.0 n'existe qu'en `canary.0`.

Les fonctions importaient `jsr:@supabase/supabase-js@2`, qui n'est pas une
version mais une **plage**. Elle s'est mise à résoudre vers la version cassée
d'elle-même, un dimanche après-midi. **22 fonctions sur 22 étaient dans ce cas ;
aucune n'était épinglée.** Aucun correctif urgent n'aurait pu partir.

**Le compte n'était pas vingt-deux mais VINGT-HUIT**, et c'est ma première garde
qui l'a manqué : elle ne cherchait que la forme `jsr:` et ne lisait que les
`index.ts` à la racine. Sept fonctions importent la même librairie par
`https://esm.sh/`, et npm publie AUSSI 2.115.0 avec la même dépendance
manquante — elles étaient exposées à l'identique. Et
`ritual_dispatcher/lib/supabase.ts` est imbriqué, donc invisible à un balayage
de surface. *Une garde qui ne cherche qu'une forme d'un défaut mesure la forme,
pas le défaut.*

**Les vingt-huit sont épinglées sur 2.114.0 dans le dépôt.**
`importsEdgeEpingles.guard` exige désormais **zéro** plage, quelle que soit sa
forme, fichiers imbriqués compris, avec son contre-test.

**Épingler la source SUFFIT.** Les artefacts déployés sont bundlés : ils
tournent, la publication en amont ne les touche pas. Le pin agit au PROCHAIN
déploiement — c'est là qu'il fallait qu'il soit. Seule `compute-session-insights-v3`
a été redéployée, parce qu'elle portait aussi un correctif. **Remesuré le
05/09 : la production est en version 14**, pas 13 — le compte de cette
section datait d'un déploiement de plus.

---

### R1 — mesurée le 05/09/2026 : zéro orphelin, quatre-vingt-dix-sept écrans à une seule entrée

**La moitié de cette règle est DÉJÀ GARDÉE, et le tableau ne le disait pas.**
`src/lib/__tests__/orphelinsApp2.guard.test.ts` existe et exige qu'aucun écran
de l'arbre pilote n'ait zéro entrée. Ce qui manque à R1 est la SECONDE entrée,
pas la première.

**Le compte, littéraux normalisés, commentaires retirés** — chemins avec et sans
groupe, `${id}` et `[id]` ramenés au même motif :

| | Écrans | 0 entrée | 1 entrée | 2 et plus |
|---|---|---|---|---|
| **Tout l'arbre** | **144** | **0** | **97** | **47** |
| `(app2)` pilote | 48 | 0 | 30 | 18 |
| `(admin)` console | 34 | 0 | 26 | 8 |
| `(coach)` | 35 | 0 | 21 | 14 |
| `(partner)` · `(pro)` · `(onboarding)` · `(auth)` | 27 | 0 | 20 | 7 |

**Zéro orphelin sur cent quarante-quatre.** C'est un résultat, pas une évidence :
le jalon 5 en comptait trois pour le seul Club.

**ET LA PRÉMISSE DE LA SPÉCIFICATION EST FAUSSE.** `D_Navigation.md:63` écrit :
« L'inventaire a mesuré 35 orphelins et 16 liens directs ». Les **35 orphelins
sont des MODULES sans consommateur** — la liste de `modulesOrphelins`,
`coachBusinessService`, `dataLabLogic`… — **pas des écrans sans entrée**. Les
deux comptes ont été confondus, et la règle s'appuie donc sur un chiffre qui ne
la concerne pas.

**Les quatre-vingt-dix-sept ne sont pas une seule dette, mais quatre familles**,
et trois d'entre elles sont des formes JUSTES :

1. **Le moyeu de console.** Vingt-deux écrans `(admin)` pendent de
   `(admin)/index.tsx`, et de lui seul. Leur donner une seconde entrée voudrait
   dire inter-lier la console — personne ne l'a demandé, et ce serait du bruit.
2. **Les entonnoirs.** `(onboarding)`, `(coach-onboarding)`, les six écrans
   `rec/*` pilotés par `captureStepLogic`, les trois de `reserver/*`. **Une
   étape a un prédécesseur, c'est sa définition.** Deux entrées y seraient un
   défaut, pas une qualité.
3. **Le détail depuis sa liste.** `coachs/[id]` ← `coachs`, `support/[id]` ←
   `support`, `utilisateurs/[id]`, `evenements/nouveau`. Structurel.
4. **Les tiroirs du pilote — la seule vraie dette.** `club/galerie`,
   `club/routes`, `club/territoire`, `club/partenaires`, `club/ecurie`,
   `data/carnet`, `vous/profil`, `vous/documents`, `vous/equipement`,
   `vous/support`. **Une douzaine d'écrans**, et c'est exactement ce que D-3
   vise : « Les tiroirs sous chaque porte. Chacun a deux entrées. »

**Le périmètre a été tranché le 05/09 : tout l'arbre, familles justifiées.**
`src/lib/deuxEntrees.exceptions.ts` porte les quatre-vingt-dix-sept, rangés en
six familles — moyeu de console (41), entonnoir (16), depuis sa liste (12),
depuis son écran (16), outil interne (2), **tiroir pilote (10)**. Chaque route
en ressort au format exact de D-3, `{ route, raison, jusquau }` : la raison et
la date viennent de la famille, ce qui est plus honnête que de recopier
quatre-vingt-dix-sept variantes d'une même phrase — et D-3 pose sa condition,
« une liste d'exceptions datées se relit en trente secondes », que quatre-vingt-
dix-sept phrases ne tiendraient pas.

**Les cinq familles structurelles sont datées au 31/12 ; les dix tiroirs pilotes
au 19/09.** Passée cette date, la garde est ROUGE. Ce n'est pas un accident,
c'est le mécanisme : « une exception sans date n'est pas une exception, c'est un
abandon ».

**Et la garde attrape aussi l'inverse** : une route qui gagne sa seconde entrée
sans quitter la liste fait échouer le test des entrées périmées. Elle l'a
d'ailleurs prouvé sur elle-même — au premier passage, le fichier d'exceptions
citait les quatre-vingt-dix-sept routes dans des littéraux et **se comptait donc
comme une entrée pour chacune**. Tout le monde avait deux entrées, toutes les
exceptions étaient périmées d'un coup. Un fichier qui LISTE des routes n'est pas
un fichier qui y MÈNE.

### La seconde entrée des quatre tiroirs du Club — ce que la base a répondu

Décision du 05/09 : les quatre du Club en reçoivent une. En cherchant où
l'accrocher, la production a répondu autre chose :

| Table | Lignes |
|---|---|
| `session_media` | **0** |
| `scenic_routes` | **0** |
| `social_pings` | **0** |
| `partner_offers` | 1 |

La galerie n'a rien à montrer, les belles routes non plus, et le territoire ne
porte que les six circuits. **Une seconde entrée conditionnée à ces données ne
s'afficherait donc jamais** — et ce défaut-là est déjà documenté : l'en-tête
d'`orphelinsApp2.guard` dit qu'« un lien enfermé sous une condition de donnée
jamais vraie » satisfait la garde sans rien ouvrir, « c'est précisément ce qui
s'était produit », sur ces écrans-là, au Club.

La seconde entrée devra donc être **inconditionnelle**, et mener à un état vide
honnête — ce que R6 exige déjà. Le geste n'est pas bloqué, il est simplement
plus étroit qu'il n'en avait l'air : ce n'est pas « où accrocher un lien
contextuel », c'est « quel lien permanent ». La butée du 19/09 le rappellera.

---

### R8 — la 2ᵉ passe EXISTE. Ce qui manque est ailleurs, et c'est plus grand

**« Script en place, 2ᵉ passe à écrire » était faux au 05/09.** La seconde passe
vit dans `scripts/check-doctrine.ts:272`, `passeMotsCles()`, écrite au lot P4
(commit `bff63bc`, « la règle des mots clés devient une garde »). Son fichier
d'exceptions existe aussi — `scripts/restitutionSansPhrase.exceptions.ts`,
la forme que `G_MotsCles.md:61` demande. **Chercher avant d'écrire vaut aussi
pour ce tableau-ci.**

Ce qu'elle fait, mesuré le 05/09 : **14 feuilles contrôlées, 81 phrases
trouvées, dont 40 sur les deux écrans du Mans.** Elle est BLOQUANTE sur ces deux
écrans et avertissante sur les douze autres, avec un plafond par écran — 33 pour
`data/session/[id]`, 7 pour `bilan/[sessionId]`. **Les plafonds valent
exactement le compte : aucune marge dormante**, le cliquet est serré.

**LE VRAI MANQUE.** La règle des mots-clés a deux moitiés. La passe ci-dessus
tient la première — *aucune PHRASE* (plus de trois mots ET un mot outil). La
seconde — **les quatre règles d'ÉCRITURE d'un mot-clé** : majuscules, forme
`SUJET · PRÉCISION`, jamais de verbe conjugué, aucun mot outil jamais — n'est
appliquée à **aucune feuille de données**.

Elle est pourtant IMPLÉMENTÉE : `src/lib/regleMotsCles.ts` porte
`motifRefusMotCle`, et deux gardes l'emploient — sur le champ `court` du
registre des présentations, et sur les libellés de service. **Jamais sur les
étiquettes que les quatorze feuilles affichent réellement.** C'est le motif
dominant du dépôt : écrit, testé, branché à côté de l'endroit qui en a besoin.

**L'ÉCART EST MESURÉ : CENT VINGT-QUATRE ÉTIQUETTES.**

Un relevé naïf ne vaut rien ici — il rend 505 refus sur 556 chaînes, dont
l'essentiel est du bruit : fragments SQL, chemins SVG, morceaux de code coupés
par une apostrophe, et surtout les libellés d'accessibilité, qui doivent
**rester de la prose** puisqu'un lecteur d'écran les dit à voix haute.

La mesure retenue a donc été faite feuille par feuille puis **réfutée** — chaque
trouvaille éprouvée par un second lecteur chargé de la démolir — puis
**remesurée par le dépôt lui-même** (`scripts/verifier-releve-mots-cles.ts`) :

| | |
|---|---|
| Trouvailles remontées | 162 |
| Survivantes à la réfutation | 161 |
| Motif confirmé en rejouant `motifRefusMotCle` | **161 sur 161** |
| Retrouvées à la ligne annoncée (± 3) | 157 |
| Déjà comptées par la 2ᵉ passe (`estPhrase`) | 34 |
| **NOUVELLES, ancrées, propres aux règles d'écriture** | **124** |

Le taux de réfutation est faible — une seule — et il fallait le vérifier plutôt
que s'en réjouir : **zéro désaccord entre les lecteurs et l'implémentation du
dépôt** sur l'application des règles. Ce qui restait de jugement, « est-ce
affiché en position de mot-clé », est exactement ce que les quatre non-ancrées
révèlent : des textes reformulés par le lecteur, écartés du compte.

L'unique réfutation mérite d'être citée : « J'AI COMPRIS », que le lecteur a
refusé de signaler parce que `motifRefusMotCle` la juge conforme — l'apostrophe
découpe `j / ai / compris`, et `ai` n'est pas dans la liste fermée des mots
outils. **Signaler ce que la garde de référence ne voit pas apprendrait à douter
d'une garde verte.**

**Où elles sont**, et les quatorze feuilles totalisent bien 124 :

| Feuille | | Feuille | |
|---|---|---|---|
| `data/session/[id]` | **52** | `data/index` | 6 |
| `(admin)/analyse-session/[id]` | 15 | `(coach)/comparer` | 6 |
| `data/comparer` | 10 | `(coach)/priorites` | 5 |
| `bilan/[sessionId]` | 9 | `SaisonSections` | 5 |
| `(coach)/rapport` | 8 | `data/carnet` | 3 |
| `signature` | 2 | `carte-souvenir` · `PetitsMultiples` · `NiveauxRestitution` | 1 chacune |

**Ce qu'elles sont** — variantes repliées sur leur famille : 35 étiquettes de
valeur (« Vitesse d'entrée », « Confiance de mesure »), 17 libellés de bouton,
14 sur-titres (« LES MESURES », « TOUR DE RÉFÉRENCE »), 12 chips, 10 titres de
section, 10 titres, 9 onglets (« Détail », « Tracé », « Rejouer »), 7 légendes,
7 badges, 3 libellés d'axe.

**CORRECTION DU 05/09, ET ELLE PORTE SUR CE PARAGRAPHE.** La première écriture
de ces deux ventilations donnait « coach 24, console et saison 25, hub Data 16,
bilan 14 » : c'étaient les comptes des trouvailles **confirmées**, mêlés au
total des **retenues**. Deux mesures dans une même phrase font une somme qui ne
veut rien dire. `verifier-releve-mots-cles.ts` ne ventile plus que le seul
ensemble publié.

**Une garde ne peut donc pas naître verte ici**, et la corriger n'est pas un
renommage mécanique : la règle de taille dit déjà qu'« on ne peut pas seulement
grossir, il faut couper ». Cent vingt-quatre étiquettes à réécrire en mots-clés
est un travail ÉDITORIAL, pas une correction de défaut.

### La 3ᵉ passe existe depuis le 05/09 — un CLIQUET, décision du fondateur

`passeEcritureMotsCles()` applique `motifRefusMotCle` aux étiquettes des
quatorze feuilles. Elle refuse toute étiquette NOUVELLE hors règle, et invite à
baisser le plafond dès qu'il maigrit — même mécanique que `PLAFOND_PHRASES` et
`echelleTypo`. Un interdit serait rouge le premier jour et désarmé le second.

**DEUX CHIFFRES, ET IL NE FAUT PAS LES CONFONDRE.**

| | Mesure | Compte |
|---|---|---|
| **124** | adjugée : chaque chaîne jugée « affichée en position de mot-clé », puis réfutée, puis remesurée par le dépôt | ce que la dette VAUT |
| **160 sur 209** | lexicale : props de libellé, clés d'objet de libellé, nœuds de texte JSX — aucun jugement | ce que le cliquet FIGE |

La seconde est plus large parce qu'elle ne juge rien : c'est la condition pour
qu'un cliquet soit reproductible. La première dit la vérité éditoriale.

**L'EXTRACTEUR A ÉTÉ CORRIGÉ PAR SA PROPRE FALSIFICATION.** Sa première écriture
ne lisait que la syntaxe JSX `label="…"` — l'injection d'une étiquette fautive
n'a pas mordu. Les tables d'onglets se déclarent en objets
(`{ key: 'trace', label: 'Tracé' }`), et toute cette famille échappait au
cliquet pendant qu'un relevé adverse la comptait. Corrigé, le compte passe de
141 à 160.

**ET LA RÈGLE DU DÉPÔT PORTAIT UN FAUX POSITIF.** `VERBES_CONJUGUES` matchait
`-ions` et `-ons`, donc **CONDITIONS**, SESSIONS, OPTIONS, POSITIONS — des noms,
pas des verbes. `data/session/[id].tsx:976` porte
`<SectionHeader eyebrow="CONDITIONS" />`, un mot-clé conforme, refusé pour
« verbe conjugué ». Seul `-ez` reste : c'est l'impératif que la doctrine
proscrit, et une interface qui vouvoie n'écrit jamais « comparons ».

---

### R3 — mesurée le 03/09/2026, et la moitié de ce que j'en disais était faux

*Les cinq franchissements de ce tableau ont été levés le 05/09 et la garde est
écrite — voir la section suivante. Ce diagnostic est conservé parce qu'il dit
CE QUI ÉTAIT VRAI et ce que j'en avais dit de faux.*

La règle a **deux volets**, écrits dans `docs/specs/E_Systeme.md:25` : « aucun
import de `src/ui/v2` hors `(app2)` sauf la couche 2, aucun kit v1 dans
`(app2)` ». Mesurés séparément, ils ne rendent pas le même verdict.

**VOLET 1 — VIOLÉ AU 03/09. Cinq franchissements, exactement.** Balayage complet
des 33 lignes d'import de `src/ui/v2` hors `(app2)`, consommateurs remontés :

| Fichier | Ce qu'il prend | Atteint par |
|---|---|---|
| `app/(admin)/incidents.tsx:58` | `colors, SectionHeader, space, StateView, typo` | direct |
| `app/(admin)/securite.tsx:47` | `colors, PressScale, radius, space, typo` | direct |
| `app/(admin)/sessions-media.tsx:26` | `Photo` | direct |
| `src/components/SecondFacteurRequis.tsx:27` | `colors, PressScale, radius, space, typo` | `(admin)/_layout:86` |
| `src/components/MediaGrid.tsx:16` | `Photo` | `(pro)/media.tsx:15` |

**Aucun écran `(coach)` n'en fait partie.** Et le volet 2 est tenu, direct et
transitif : les deux seuls modules de `src/` qui importent un kit v1 —
`ProfilIndisponible` et `StateWrapper` — ne sont montés par aucun écran `(app2)`.

**VOLET 2, ET LA CORRECTION QUE JE ME DOIS.** J'ai écrit que « huit écrans
pilotes importent `fontSize` du thème coach ». **C'est faux, et la mesure le
retourne :**

- `src/theme/v2.ts` porte **zéro import** — c'est une fondation, pas un
  univers. 180 fichiers en dépendent.
- **Le kit pilote lui-même en dépend, à sa racine** : `src/ui/v2/tokens.ts:20`
  importe `dataColors` de `../../theme/v2`, et `ProvenanceTag.tsx:38` importe
  `theme`. Sous ma lecture, R3 serait violée à la racine du kit pilote, et les
  huit écrans seraient le plus petit des trous.
- `src/ui/v2/tokens.ts` ne porte **aucune échelle de taille** : `typo` y
  désigne des noms de fontes, pas des nombres.
- Et une garde VERTE prescrit exactement cet import : `echelleTypo.guard`
  balaie `app/` comme `src/`, et son message d'échec dit « Employez `fontSize`
  de src/theme/v2.ts ».

Les huit imports sont donc **conformes**. Deux univers reposent sur une
fondation commune ; ce n'est pas un mélange.

**LA COUCHE 2 N'EXISTE PAS SOUS SON NOM.** `E_Systeme.md:25` désigne
`src/ui/data/` — le dossier n'existe pas. Et il faut corriger ici une phrase que
j'ai écrite juste après, elle aussi fausse : « les composants qu'il énumère
vivent à plat dans `src/ui/` ». **Mesuré :** `grep -rn "from '@/ui/[A-Z]"
"app/(app2)/"` ne rend RIEN. Aucun écran pilote ne prend un composant de
`src/ui/` à plat — ce n'est donc pas la couche 2 rangée ailleurs, c'est le kit
CONSOLE. Il existe même deux `Fact.tsx` divergents, 46 et 84 lignes.

Conséquence à ne pas contourner : créer `src/ui/data/` n'est **pas un
déménagement**, c'est l'unification de deux kits divergents, un arbitrage visuel
par composant. La spécification est périmée sur le CHEMIN ; le principe tient ;
le lot est plus gros qu'il n'en a l'air.

---

### R3 — LES CINQ FRANCHISSEMENTS SONT LEVÉS, ET LA GARDE EST ÉCRITE (05/09)

**`frontiereUnivers.guard` existe, et elle naît verte.** Elle ne pouvait pas
s'écrire tant qu'elle aurait été rouge — le dossier l'interdit. Les cinq
franchissements ont donc été levés d'abord, en trois gestes :

| Franchissement | Ce qui a été fait |
|---|---|
| `(admin)/securite.tsx` · `SecondFacteurRequis` | Jetons vers `theme/v2`, `PressScale` → `PressableScale` |
| `(admin)/incidents.tsx` | `StateView` → `StateWrapper`, `SectionHeader` → `SectionLabel` + compteur |
| `(admin)/sessions-media.tsx` · `MediaGrid` | `Photo` sorti du kit pilote |

**Le troisième geste a créé la première pièce réelle de la couche 2.** Écrire un
second `Photo` côté console aurait aggravé la maladie des deux `Fact`. La mesure
a tranché : `Photo` **ne porte aucun jeton visuel** — soixante lignes autour
d'`expo-image`. Il n'appartenait à aucun univers, il était rangé dans l'un des
deux. `Photo`, `blurhash` et `mediaMath` vivent maintenant dans
**`src/components/media/`** ; `HeroPhoto` reste au kit pilote, lui qui importe
`colors, radius, space`. **La couche 2 se construit d'un besoin mesuré, pas
d'une déclaration** — et une pièce correctement placée est invisible à la garde,
puisqu'elle ne prend rien à aucun kit.

**LA GARDE NE PEUT PAS ÊTRE LEXICALE, et c'est tout son intérêt.** Vingt-deux
lignes de `src/` importent encore le kit pilote — `StripMap`, `BandeTours`,
`SaisonSections`… Un balayage de surface les déclarerait fautives ; elles ne le
sont pas, puisque seules des routes `(app2)` les atteignent. La garde construit
donc le graphe d'imports de `app/` et `src/` et remonte, depuis chaque route,
tout ce qu'elle touche transitivement. **Ce qui décide n'est pas où le fichier
vit, c'est quel écran l'atteint** — c'est ainsi que `SecondFacteurRequis`, que
nul écran n'importe, avait été pris par `(admin)/_layout.tsx:86`.

**Falsifiée avant d'être crue :** réintroduire l'import pilote dans
`SecondFacteurRequis` fait tomber le volet 1 en nommant le layout coupable, et
un `StateWrapper` dans un écran `(app2)` fait tomber le volet 2.

Un résidu, nommé plutôt que tu : `TITANE_BLURHASH` reste encodé depuis les fonds
du kit pilote. Deux fonds sombres et froids, quelques valeurs de luminance
d'écart, vus 220 ms. Si cela devait compter un jour, la correction est une prop
de repli — pas un second blurhash.

---

### R6 — le cinquième état n'est pas où on le cherche, mesuré le 03/09/2026

**Les onze écrans de données portent leurs trois états** — chargement, vide,
erreur — et le quatrième est le contenu. Mesuré un par un, aucun manque.

**Le cinquième, `offline`, est GLOBAL.** `app/_layout.tsx` monte `OfflineBanner`
au-dessus de tout et appelle `initNetInfo`, qui pose
`setOfflineBannerVisible(!online)` à chaque changement de réseau.

J'ai d'abord mesuré « aucune des quatorze feuilles ne monte l'état offline », et
c'était **vrai à la lettre et trompeur** : `StateView state="offline"` ne figure
que dans `dev-galerie.tsx`, la galerie de composants. La couverture est ailleurs,
et elle vaut mieux ainsi — un seul bandeau partout plutôt que quatorze variantes
à tenir d'accord.

**Ce que la garde tient, et qui est le vrai risque :** l'état hors-ligne repose
sur TROIS maillons dans trois fichiers — le bandeau monté, l'écoute
initialisée, le drapeau posé. En retirer un l'éteint sans que rien ne le dise.
Falsifié : démonter le bandeau et renommer le drapeau fait tomber deux
assertions.

**Pourquoi les écrans coach et admin n'emploient pas `StateView` :** il vit dans
`src/ui/v2`, l'univers pilote, et R3 interdit de mélanger les deux. Ils portent
leurs états avec leurs propres jetons — c'est conforme, pas négligent. La garde
vérifie donc que les états sont TRAITÉS, pas qu'un composant précis est monté.

**Hors périmètre, et dit :** `SaisonSections`, `PetitsMultiples` et
`NiveauxRestitution` sont des sections montées dans un écran qui porte déjà les
états — la dernière reçoit `seance={data.etatSeance}`, déjà chargée par son
parent. Leur demander leurs propres états dupliquerait ceux du parent.

---

### R7 — les murs publics, mesurés le 03/09/2026

**Ils respectent la doctrine. Ce n'est pas une supposition.** Six surfaces sont
lisibles par `anon` ; voici ce qu'elles exposent et ce qu'elles contiennent :

| Surface | Colonnes | Lignes |
|---|---|---|
| `qdi_public` | `display_name, nominative, margin_global, margin_zone, computed_at, sessions_count` | 1 |
| `plateau_members_public` | `first_name, last_initial, city` | **0** |
| `sessions_public` | 22 colonnes de calendrier, aucune personnelle | 0 |
| `testimonials_public` | `display_name, rating, comment, session_date` | 0 |
| `crews_public` | `name, validated_members, created_at` | 0 |
| `app_progression_shares` | table, **RLS active, 5 politiques** | — |

**Aucun chrono nulle part.** `qdi_public` porte une marge, pas un temps au tour.

**Le nom est conditionné au consentement, et la fonction le prouve.**
`qdi_public_rows` masque en `'Pilote OXV'` sauf `community_visibility =
'nominative'`, écarte les comptes `private` et les suspendus.
`plateau_members_public_rows` ne rend un prénom que sous la même condition.
L'unique ligne de `qdi_public` est **non nominative**.

**Ce qui n'est PAS garanti par un test, et il faut le dire :** tout ce qui
précède est une mesure du 03/09, pas un cliquet. Une garde qui l'éprouverait
devrait interroger la base — donc dépendre des secrets `TEST_SUPABASE_*` qui
manquent, comme les 85 tests RLS. **R7 est tenue, elle n'est pas gardée.**

**Ce qui EST gardé, côté application :** le lien de partage révocable, par
quatre jeux d'assertions — liste blanche des métriques, provenance du jeton,
expiration obligatoire, et depuis le 03/09 le fait que `createShare` filtre
LUI-MÊME plutôt que de faire confiance à son appelant. Ce dernier point
manquait : les deux écrans qui créent un lien ne se comportent pas pareil —
`club/galerie.tsx` assainit, `(pro)/partage.tsx` passe sa valeur brute — et les
trois gardes seraient restées vertes si la frontière avait cessé de filtrer.

**Une question ouverte, que je ne tranche pas :** `SHAREABLE_METRICS` propose
`best_lap`, « Meilleur tour » — un CHRONO, sur un lien public. L'interdit du
brief dit « les murs publics n'affichent ni chrono », mais son paragraphe parle
de classement ENTRE PILOTES. Un lien révocable où un pilote montre son propre
chrono à qui il choisit n'est peut-être pas un mur public au sens visé. **La
lecture appartient au fondateur, pas à une garde.**

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
| Image partagée par les deux univers | `src/components/media/` (`Photo`, ThumbHash, blurhash titane) |

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

| **Bouteville en base** | **Repris le 02/09.** Tracé refermé (141 points, 0,00 m, 5 906,1 m) et recalé au pied de la perpendiculaire sur le segment 44, à 4,37 m de la ligne — méthode d'Albi. Cap 336,7° contre 336,6° annoncés : sens du tour inchangé. Treize virages recalculés par `generateCircuit`, le module que la fonction edge importe. Provenance corrigée : **OpenStreetMap**, pas un relevé fondateur — trois nœuds, versions 1 de 2012 et 2019, jamais rééditées | 02/09 |
| **Potentiel démontré** | **v3 écrit la forme À PLAT en plus de l'imbriquée**, alimentée par le potentiel du JOUR. Les cinq lectures s'ouvrent ensemble. `theoretical_record` reste écrit : on a levé une exclusion, pas tranché la préférence jour-vs-record | 03/09 |
| **Météo du 19/07** | **Les 14 relevés restaurés.** Le vidage venait des travaux de sécurité du 19/07, côté site, pas d'un jugement sur la donnée. Et la sauvegarde **entre dans la purge** par une clé étrangère en cascade : chaque ligne porte une position et un `session_id`, donc une donnée personnelle — contrairement à ce que la migration du 01/08 affirmait | 03/09 |
| **Affiliation coach** | **Un déclencheur en base**, pas du code client : `pending → active` dès que les deux consentements sont posés. Le modèle à deux côtés était déjà dans le schéma ; seule la transition manquait | 02/09 |
| **Imports edge** | **Épinglés sur 2.114.0, les vingt-huit.** Épingler la SOURCE suffit — les artefacts déployés sont bundlés, le pin agit au prochain déploiement. On ne redéploie pas vingt-huit fonctions pour un changement sans effet à l'exécution | 03/09 |
| **Marge et cron** | **L'application nomme sa version** (`app-v1.0`) et le cron l'exclut de sa file. Une séance analysée par l'application ne sera plus reprise par un moteur qui en sait moins — même quand la version du cron sera incrémentée | 03/09 |
| **Balayage horaire des lectures** | **Le job horaire vise `cron-analyze-pending-sessions` en mode `insights`**, qui appelle v3 avec la clé de service. Aucune porte publique nouvelle : v3 garde `verify_jwt = true`. La décision « ouvrir une porte à jeton sur v3 » supposait une double authentification écrite à la main — l'application appelle v3 avec un JWT d'utilisateur | 05/09 |
| **Frontière R3** | **Les cinq franchissements levés, `frontiereUnivers` écrite et falsifiée.** Elle remonte le graphe d'imports depuis chaque route : ce qui décide n'est pas où le fichier vit, c'est quel écran l'atteint | 05/09 |
| **Périmètre R1** | **Tout l'arbre, familles justifiées.** 97 exceptions en six familles ; cinq sont des formes justes, la sixième — dix tiroirs pilotes — est la seule dette, datée au **19/09** | 05/09 |
| **Tiroirs du Club** | **Une seconde entrée pour les quatre.** Mesure faite en cherchant où l'accrocher : `session_media`, `scenic_routes` et `social_pings` sont VIDES, donc le lien devra être **inconditionnel** — un lien sous condition de donnée jamais vraie est le défaut déjà nommé par `orphelinsApp2.guard` | 05/09 |
| **Couche 2** | **Elle se construit, elle ne se déclare pas.** `src/components/media/` (`Photo`, `blurhash`, `mediaMath`) en est la première pièce : aucun jeton visuel, deux univers demandeurs. `src/ui/data/` reste ouvert — c'est une unification de kits divergents, pas un `git mv` | 05/09 |

## Décisions en attente, à ne pas contourner

| Sujet | Ce qu'il bloque | Butée |
|---|---|---|
| **Geste de calibration au prévol** | Le redressement du signal, donc le filtre, donc les deux branches à zéro | 19/09 |
| **Secrets `TEST_SUPABASE_*`** | 85 tests RLS jamais exécutés, et la fusion vers `main` : la CI échoue en dur sans eux | avant fusion |
| **Chrono sur un lien public** | `SHAREABLE_METRICS` propose `best_lap`. L'interdit vise le classement ENTRE PILOTES ; un lien révocable sur ses propres données n'est peut-être pas un mur public au sens visé | — |

### Les deux moteurs d'insights s'excluent — mesuré le 02/09/2026

`session_insights` porte `UNIQUE (telemetry_session_id)` : **une ligne par
séance**. Les deux fonctions edge font `delete` sur cette clé puis `insert`,
sans filtrer sur `engine_version` — vérifié dans le code **déployé** de v1
(version 11, ACTIVE), pas seulement dans le dépôt.

v3 écrit vingt-deux colonnes, v1 en écrit douze, toutes présentes chez v3. On
croirait v3 strictement supérieure. **Elle ne l'est pas, à cause d'une forme :**

| | `ideal_lap` écrit | Lu par l'écran ? |
|---|---|---|
| **v1** | `{ ideal_time_s, real_best_s, … }` — **à plat** | **oui** |
| **v3** | `{ theoretical_day, theoretical_record }` — imbriqué | **non** |

`chronosLisibles` exige la forme à plat et refuse l'imbriquée **délibérément** :
son commentaire réserve au fondateur le choix entre le potentiel du jour et
celui du record.

Donc, aujourd'hui : **v3 ouvre les quatre lectures de modules et ferme
« Potentiel démontré » ; v1 fait l'inverse.** Aucun ordre d'appel ne donne les
deux. Ce n'est pas un défaut de câblage, c'est une exclusion structurelle.

**TRANCHÉ LE 02/09/2026, et l'exclusion est levée.** v3 — version 12, déployée
par le MCP — écrit désormais la forme **à plat en plus** de l'imbriquée,
alimentée par le potentiel du **jour**. Les cinq lectures s'ouvrent ensemble.
`theoretical_record` reste écrit : on a levé une exclusion, pas tranché une
préférence, et le choix jour-vs-record reste entier.

Deux choses restent, et elles sont nommées par `ecritureInsightsUnique.guard` :
l'appel à v1 a été retiré du chemin nominal — son résultat y était effacé
quatorze lignes plus loin, au prix de deux `COUNT` exacts sur 27 000 trames — et
le bouton « Recalculer les lectures » de la console admin appelait **encore v1
seule**, donc dégradait une séance calculée par v3.

**Ce dernier point s'est réglé tout seul le 03/09, et c'est instructif.** Il
n'était pas corrigé parce que v1 était le dernier producteur d'un `ideal_lap` à
plat — repointer le bouton aurait fermé « Potentiel démontré ». La version 13
de v3 a retiré cette raison : v3 domine désormais v1 sur toutes les colonnes ET
sur la forme lue. Le bouton appelle v3. **Une décision peut cesser d'en être
une** parce qu'un autre geste a supprimé son enjeu — encore faut-il relire, sans
quoi on garde un arbitrage dont la question a disparu.

Conséquence à ne pas laisser dormir : plus aucun code n'invoque
`compute-session-insights`. La fonction reste déployée (version 11) et reste le
producteur historique des lignes `mirror-insights-v1`, mais rien ne la
déclenche depuis l'application, et le cron horaire qui la vise ne rend que des
401.

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
