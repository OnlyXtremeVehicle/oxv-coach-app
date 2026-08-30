# Bloc G — La règle des mots-clés

*Règle d'application générale, décidée le 30/08. Elle remplace la portée limitée de F-7, qui ne visait que les surfaces console.*

---

## G-0 · L'énoncé

> **Toute feuille de restitution de données n'affiche que des mots-clés. Aucune phrase.**

Un libellé fait un ou deux mots. Le reste est un nombre, une unité, une barre, une courbe, une position, un horodatage ou un nom propre. Un écran qui a besoin d'une phrase pour se faire comprendre est un écran mal conçu.

C'est l'application littérale de vos instructions de projet : *« on affiche juste la data et on simplifie la présentation de celle-ci ».*

---

## G-1 · Deux natures de feuille, jamais confondues

La règle ne peut pas s'appliquer partout sans détruire quelque chose qui fonctionne. Il faut donc **deux natures déclarées**, et un écran ne peut pas être des deux.

| Nature | Ce que c'est | La règle |
|---|---|---|
| **Feuille de données** | Tout écran dont le contenu dérive de la télémétrie : Bilan, Séance, Signature, Comparer, Saison, Mode Stand, écran de paddock, tablette, mosaïque du rapport | **Mots-clés seuls.** Contrôlée par la garde |
| **Feuille de récit** | Le Débrief. Un texte, assumé comme tel, écrit sous les 52 termes proscrits, la garde au rendu et le repli local qui existent déjà | Hors périmètre de cette garde. Reste sous les gardes doctrinales existantes |

**Le manifeste est explicite, jamais deviné.** Un fichier `src/lib/surfacesRestitution.ts` déclare la nature de chaque écran. Un écran de données absent du manifeste est lui-même une violation — garde croisée avec le registre des présentations.

**Pourquoi le Débrief reste un récit.** Le réduire à des mots-clés reviendrait à retirer `generate-debrief-ai`, son repli local `debriefGenerator`, un filtre à 52 termes, un test de parité qui lit physiquement le fichier de la fonction serveur, une garde au rendu et un déclencheur SQL. C'est un dispositif plus solide que la règle qu'on lui appliquerait. **Il n'est pas une feuille de données : il est le seul endroit où OXV raconte, et il le fait sous surveillance.**

---

## G-2 · La définition opératoire d'une phrase

Une garde doit pouvoir trancher sans jugement. Définition retenue, testable :

> **Une chaîne affichée est une phrase si elle compte plus de trois mots ET contient au moins un marqueur de phrase.**

Marqueurs : `le la les un une des du de` · `vous votre vos` · `est sont a ont était sera` · `dans avec pour que qui sur sans` · `plus moins ce cette`.

**Trois mots ou moins passent toujours.** `MEILLEUR TOUR`, `ZONE À OBSERVER`, `ÉCART OFFICIEL` : conformes. `Vos huit passages s'étalent sur 0,42 s` : refusée.

Cette définition est grossière et c'est voulu — elle produit peu de faux positifs sur des libellés courts, et elle attrape toutes les vraies phrases. Le doute se règle en raccourcissant, jamais en ajoutant une exception.

---

## G-3 · Ce qui est toujours autorisé

| Autorisé | Exemple |
|---|---|
| Nombres, unités, symboles | `2:12.480` · `KM/H` · `± 0,04` · `7 / 22` |
| Horodatages et dates | `14:49` · `DEPUIS 15:01` · `26/09` |
| Noms propres | `BUGATTI` · `CHEMIN AUX BŒUFS` · `SCANIA` |
| Libellés de la liste blanche | `LIBELLES_RESTITUTION`, un fichier, relu comme du contenu |
| Texte non littéral venu de la base | Nom de zone, nom de circuit, numéro de camion |
| **Verbatim humain** | Notes du pilote, notes d'observation, intention — saisies, jamais écrites dans le code |

---

## G-4 · Les trois exceptions, nommées et datées

Même mécanique que `deuxEntrees` : un fichier `restitutionSansPhrase.exceptions.ts`, chaque entrée portant sa route, sa raison **écrite en français**, et une date limite. Une exception sans date n'est pas une exception, c'est un abandon.

| # | Exception | Pourquoi elle survit |
|---|---|---|
| 1 | **Verbatim** | Un verbatim réduit à des mots-clés n'est plus un verbatim. La preuve P-4 repose sur ce que le pilote dit, tel qu'il le dit |
| 2 | **État `erreur`** | Un état d'erreur doit dire quoi faire. Une phrase de reprise, **une seule**, écrite à l'avance et non générée |
| 3 | **Provenance et confiance** | « Écart mesuré avec le chronométrage officiel » nomme une source. Le réduire rendrait le chiffre invérifiable |

---

## G-5 · Ce qu'il faut réécrire

Les états vides sont le gros du travail, et c'est là que la règle rend le produit meilleur.

| Avant | Après |
|---|---|
| « Signature disponible à partir de trois séances — 1 sur 3 » | `SIGNATURE · 1 / 3 SÉANCES` |
| « Aucune donnée pour cette séance » | `AUCUNE DONNÉE` |
| « Plateau — indisponible sur cette séance. La lecture du chronométrage officiel s'est arrêtée à 15:01 » | `PLATEAU` · `INDISPONIBLE` · `DEPUIS 15:01` |
| « Vos huit passages s'étalent sur 0,42 s » | `0.42 S` · `DISPERSION · RANG 1/8` |
| « Vous avez roulé chaque zone à ce niveau, dans des tours différents » | `MEILLEURS PASSAGES · TOURS DIFFÉRENTS` |

**La dernière est la plus douloureuse et la plus instructive.** Cette phrase portait tout le sens du chiffre. En mots-clés elle perd sa nuance — et c'est le prix de la règle. Si un fait a besoin d'une phrase pour être compris, c'est peut-être qu'il n'a pas sa place sur une feuille de données ; il a sa place sur la feuille de récit.

---

## G-6 · La garde

`scripts/check-doctrine.ts` **existe déjà** : il parcourt `app/**/*.tsx`, applique `FORBIDDEN_PATTERNS` depuis `scripts/doctrineRegles.ts`, distingue déjà une portée `ligne` d'une portée `prose`, et sort en code 1 pour l'intégration continue. Le dépôt annonce 0 verbe interdit sur 178 écrans scannés.

**La nouvelle règle est une deuxième passe du même scanner, pas un outil de plus.**

| # | Ce que la passe fait |
|---|---|
| 1 | Lit `surfacesRestitution.ts` et ne contrôle que les écrans de nature `donnees` |
| 2 | Extrait les chaînes littérales rendues (hors commentaires, hors tests, hors imports) |
| 3 | Applique la définition G-2 |
| 4 | Échoue si une chaîne est une phrase et n'est ni dans la liste blanche, ni couverte par une exception valide |
| 5 | Échoue si une exception n'a pas de raison écrite, ou si sa date est passée |
| 6 | Échoue si un écran du registre des présentations manque au manifeste |

**Portée : les deux dépôts.** `doctrineRegles.ts` est déjà destiné à être partagé avec `oxv-site` ; la page du pavillon et le mur du bar tombent sous la même règle.

**Mise en service progressive.** Bloquante d'abord sur les écrans du week-end du Mans, en avertissement ailleurs — comme `cinqEtats`. Le passage en bloquant partout se date dans le fichier d'exceptions.

---

## G-7 · Ce que cette règle coûte, dit franchement

Elle retire à OXV la possibilité d'expliquer sur l'écran. Tout ce qui n'est pas immédiatement lisible devra donc être **rendu lisible par la forme** — position, taille, couleur, graphique — ou disparaître.

C'est exigeant, et c'est le meilleur filtre de conception que vous puissiez vous imposer : **une donnée qui a besoin d'une phrase est une donnée mal présentée.** La règle ne simplifie pas l'écran, elle oblige à mieux le dessiner.

---

## G-8 · Le manifeste, établi sur le dépôt réel (30/08/2026)

G-1 exigeait un manifeste. Le voici, tiré des routes existantes et non d'une
liste souhaitée. `src/lib/surfacesRestitution.ts` porte ces deux tableaux ; une
surface de restitution absente des deux est elle-même une violation.

### Feuilles de données — mots-clés seuls

| Surface | Chemin | État |
|---|---|---|
| Séance en détail (pilote) | `app/(app2)/data/session/[id].tsx` | existe · 165 Ko |
| Bilan de séance | `app/(app2)/bilan/[sessionId].tsx` | existe |
| Hub Data | `app/(app2)/data/index.tsx` | existe |
| Comparer deux lectures | `app/(app2)/data/comparer.tsx` | existe |
| Carnet | `app/(app2)/data/carnet.tsx` | existe |
| Saison — cinq lectures | `src/features/data/saison/SaisonSections.tsx` | existe |
| Petits multiples | `src/features/data/saison/PetitsMultiples.tsx` | existe |
| Signature | `app/(app2)/signature.tsx` | existe |
| Carte-souvenir | `app/(app2)/bilan/carte-souvenir.tsx` | existe |
| Six lectures approfondies | `src/components/insights/*Viz.tsx` | existe |
| Niveaux de restitution | `src/components/telemetry/NiveauxRestitution.tsx` | existe |
| Comparer deux séances (coach) | `app/(coach)/comparer.tsx` | existe |
| Priorités du bilan (coach) | `app/(coach)/priorites.tsx` | existe |
| Rapport de séance (coach) | `app/(coach)/rapport.tsx` | existe |
| Analyse d'une séance (admin) | `app/(admin)/analyse-session/[id].tsx` | existe |
| Mode Stand | `app/(app2)/rec/stand.tsx` | à créer |
| Notes libres au camion | `app/(app2)/bilan/notes.tsx` | à créer |
| Débrief J+1 | `app/(app2)/bilan/debrief/[sessionId].tsx` | à créer |
| Mur du bar / régie | `oxv-site : /pavillon/*` | à créer |

### Feuilles de récit — la prose reste, sous le filtre existant

| Surface | Pourquoi |
|---|---|
| Le débrief écrit | `generate-debrief-ai` + repli local déterministe + filtre 52 termes + garde de rendu + déclencheur SQL. Le réduire à des mots-clés jetterait cinq mécanismes de sûreté pour gagner une ligne de style. |
| La phrase du coach | Verbatim humain — G-3 l'autorise déjà. |
| Les notes du pilote | Idem. |

**Décision que vous pouvez renverser :** le débrief reste une feuille de récit.
C'est mon choix, pas le vôtre ; il est isolé ici pour que vous puissiez le
défaire d'une phrase.

---

## G-9 · Les quarante chaînes qui ne passent pas la règle

La lecture du 30/08 a trouvé le conflit. Trois modules produisent des chaînes
d'écran qui sont des phrases au sens de G-2, et aucun n'est négligeable.

**`registrePresentations.LIBELLES_DONNEES` — 27 chaînes.** Elles disent au pilote
pourquoi une lecture n'est pas là. Écrites en clair par la charte anti-jargon.

**`disponibilite.RAISONS` — 6 chaînes.** Les raisons d'absence des six lectures.

**`compositionLogic` — 7 chaînes.** Motifs de présence et motifs d'écart.

### La règle retenue : deux registres, pas une réécriture

Chaque libellé gagne un champ `court`. La feuille de données affiche `court` ;
la phrase existante reste, inchangée, sur le second geste — au même endroit
doctrinal que le champ `source` du catalogue des lectures, que la garde
`vocabulairePilote` ne lit volontairement pas.

Exemples, forme figée `SUJET · PRÉCISION` :

| Phrase existante | `court` |
|---|---|
| deux tours qui couvrent la même distance | `DEUX TOURS COMPARABLES` |
| le début de décélération observée | `DÉBUT DE DÉCÉLÉRATION` |
| le moment où la voiture tourne | `ROTATION` |
| ce que vous aviez posé avant de rouler | `INTENTION` |
| la fiabilité de la mesure sur ce tour | `CONFIANCE DE MESURE` |
| Aucune mesure sur cette séance | `AUCUNE MESURE` |
| Pas assez de tours pour comparer | `TOURS INSUFFISANTS` |
| Chronos de secteur non calculés | `CHRONOS SECTEUR ABSENTS` |
| Signal inertiel absent | `SIGNAL INERTIEL ABSENT` |
| Gyroscope absent | `GYROSCOPE ABSENT` |
| donnée absente : X | `DONNÉE ABSENTE · X` |
| confiance de mesure faible sur ce tour : X | `CONFIANCE FAIBLE · X` |
| une seule zone à explorer à la fois | `UNE SEULE ZONE À LA FOIS` |
| un travail est en cours ; les autres zones restent fermées | `TRAVAIL EN COURS` |
| lecture preuve — elle s'ouvre d'un geste | `NIVEAU PREUVE` |
| au-delà des cartes du débrief — elle s'ouvre d'un geste | `HORS BUDGET` |
| déjà ouverte lors d'une séance précédente | `DÉJÀ OUVERTE` |
| moteur de preuve du coach et du Lab | `SURFACE COACH` |

Le champ `court` est **obligatoire** : un libellé sans `court` ne compile pas.
C'est la même discipline que le `Pick` de `sourcesCompositionService` — une
absence doit casser à la compilation, pas s'afficher.

### Décision du fondateur, 30/08/2026 — champ `court` obligatoire

**Tranché.** Chaque libellé d'écran des trois modules gagne un champ `court`
obligatoire ; la phrase existante reste, inchangée, au second geste. L'exception
datée est écartée : une règle qui plie la première fois qu'elle coûte cher ne
tient pas la seconde.

Un jour de travail, quarante chaînes, aucune logique touchée.

**Portée exacte, à ne pas déborder.**

| Module | Chaînes | Ce qui change |
|---|---|---|
| `registrePresentations.LIBELLES_DONNEES` | 27 | `Record<CleDonnee, string>` devient `Record<CleDonnee, { court: string; long: string }>` |
| `disponibilite.RAISONS` | 6 | idem, `as const` conservé |
| `compositionLogic` (motifs et écarts) | 7 | les gabarits rendent `court`, la phrase passe dans un champ voisin |

**Quatre règles d'écriture du `court`.**

1. Majuscules, forme `SUJET` ou `SUJET · PRÉCISION`, jamais de verbe conjugué.
2. Trois mots au maximum avant le point médian, trois après.
3. Le `court` ne paraphrase pas la phrase : il la **résume à son sujet**. Si le
   mot-clé ne se comprend qu'en ayant lu la phrase, il est mauvais.
4. **Aucun mot outil, jamais** — pas même dans un mot-clé de trois mots que G-2
   laisserait passer. Les mots-clés se composent (`DONNÉE ABSENTE · <libellé>`),
   et deux fragments licites peuvent produire une chaîne qui ne l'est plus.
   Cette règle rend la composition sûre par construction.

Elle n'est pas théorique : la première rédaction des quarante mots-clés en
contenait sept avec un mot outil, et `PASSAGE SUR LE TRACÉ` était lui-même une
phrase au sens de G-2. Les quarante-quatre chaînes retenues n'en contiennent
aucun, et les cinquante-quatre compositions qu'elles engendrent ont été
vérifiées une à une.

**Ce qui n'est pas touché.** Le champ `source` du catalogue des lectures (le
jargon y est le mot juste, arbitrage du 26/08) ; les verbatim humains ; le débrief
rédigé, qui reste une feuille de récit (décision confirmée le 30/08).
