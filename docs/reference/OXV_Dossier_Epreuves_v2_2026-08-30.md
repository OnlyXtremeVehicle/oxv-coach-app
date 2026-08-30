# Deux épreuves — dossier opérationnel

**Le Mans, 26-27 septembre 2026** — 24 Heures Camions, circuit Bugatti (4,185 km).
**Albi, 10-11 octobre 2026** — finale du Championnat de France Camions FFSA (3,565 km).

*Version 2 du 30/08/2026. Remplace le dossier du 29/08, écrit avant que le contexte réel ne soit connu : il n'y a ni voiture, ni salle de télémétrie, ni ingénieur, et il y a deux épreuves au lieu d'une. Chaque point porte un identifiant. Un point se conteste seul.*

---

## 0 · Les deux week-ends en une page

L'écurie court en Championnat de France Camions. Elle aligne deux camions — un Renault, un Scania — et deux pilotes, un à la fois. Elle n'a **aucune télémétrie**, aucun ingénieur dédié, aucune donnée : le chronométrage officiel et le ressenti. C'est la donnée de départ la plus importante de tout ce dossier, et elle retourne la proposition.

Nous n'arrivons pas pour compléter une salle de données existante. **Le boîtier devient leur première télémétrie.** Cela change ce qu'il faut prouver : non pas « nous sommes meilleurs que ce que vous avez », mais « il existe quelque chose entre le chronomètre et le ressenti, et voilà à quoi ça ressemble ».

| | Le Mans, 26-27/09 | Albi, 10-11/10 |
|---|---|---|
| Statut | Première épreuve. Direct + enregistrement | Finale. Direct + enregistrement, avec images |
| Lien | Passerelle v1 en cabine (repli : relais téléphone) | Passerelle v1 sur un camion, boîtier sur l'autre |
| Surfaces | Tablette + écran OXV | Tablette + écran OXV |
| Équipe OXV | Vous, seul | Vous + NADIR |
| Preuves visées | Les cinq | Les cinq |
| Après | Décision de citation ; décision d'offre | Film ; proposition |

Ce qui n'existe pas et qu'il ne faut pas espérer : leur donnée (ils n'en ont pas et ne la partageraient pas), un ingénieur pour arbitrer nos chiffres, une salle où s'installer, une deuxième paire de mains au Mans.

---

## 1 · Les personnes et leurs rôles

| # | Personne | Rôle sur place | Dans l'application |
|---|---|---|---|
| R-1 | Le pilote suivi | Roule. Lit son bilan entre les séances | Compte pilote ordinaire, affecté au camion qu'il pilote |
| R-2 | Le second pilote | Roule l'autre camion | Second compte pilote ordinaire. **Jamais mis face au premier** (§6, P-2) |
| R-3 | Le chef d'écurie | Décide de tout : l'accès, la cabine, la feuille de réglages, la suite | Aucun compte au Mans. L'objet écurie se spécifie après (I-4) |
| R-4 | Le mécanicien | Décide où le boîtier se pose, et si | Aucun compte |
| R-5 | Vous | Pose, récupère, importe, montre, note. Seul au Mans | Compte admin |
| R-6 | NADIR | Images, à Albi uniquement | Aucun compte |

**R-7 — Ce que vous n'êtes pas ce week-end.** Vous n'êtes pas leur ingénieur, vous ne donnez pas de consigne de pilotage, vous ne dites pas où freiner. Vous montrez une mesure et vous vous taisez. C'est la doctrine, et c'est aussi la seule posture tenable pour quelqu'un qui découvre leur discipline le même jour qu'eux découvrent votre outil.

---

## 2 · Le matériel

| # | Élément | Détail | Statut |
|---|---|---|---|
| M-1 | Passerelle OXV v1 | Pi Zero 2 W, module LTE, alimentation 24 V → 5 V, batterie tampon, coffret. Alimentée par le camion | `décidé` — chemin critique |
| M-2 | RaceBox Mini S | Enregistrement autonome en parallèle du direct. 196 608 enregistrements ≈ 2 h 11 à 25 Hz | `décidé` |
| M-3 | Support et fixation | Dual Lock 3M, sangle de retenue, gabarit « vue ciel dégagée ». Le kit voyage même si l'emplacement se décide sur place | `décidé` (Q-26) |
| M-4 | Téléphone de relais | Repli du direct. Le `liveRelayRunner` est écrit, gelé, pas absent | `décidé` comme repli |
| M-5 | Tablette | Régie : `/pavillon/controle` + application en direct | `décidé` |
| M-6 | Écran OXV | 24 à 27 pouces, HDMI, pied. Affiche `/pavillon/coach` | `décidé` |
| M-7 | Énergie | Batterie nomade pour l'écran et la tablette ; rallonge et multiprise ; on demande une prise au stand sans compter dessus | `proposé` |
| M-8 | Réseau | 4G OXV, mesurée sur place avant la première séance. Partage de connexion en secours | `décidé` |
| M-9 | Papiers | Accord d'une page (§9), feuille de preuve (§10), dossier « Le Stratège » déjà envoyé | `décidé` |
| M-10 | Redondance | Deuxième câble HDMI, deuxième câble d'alimentation, deuxième carte SIM, batterie de rechange | `proposé` |

**M-11 — La règle du sac.** Tout ce qui casse un week-end de course est petit et coûte quinze euros : un câble, une carte SIM, un adaptateur. Tout ce qui est petit part en double.

---

## 3 · La cabine du camion

| # | Point | Décision |
|---|---|---|
| V-1 | Qui décide de l'emplacement | Le mécanicien, sur place, le vendredi. Nous n'apposons rien nous-mêmes sur leur camion (Q-26) |
| V-2 | Ce qu'il faut à l'emplacement | Vue du ciel dégagée par le pare-brise ; à l'abri d'un pied ou d'un coude ; hors de tout ce qui est démonté entre les séances |
| V-3 | Ce qu'on emmène quand même | Le kit complet (M-3), chargé, prêt, pour que « on décide vendredi » ne devienne pas « on pose ce qu'on trouve » |
| V-4 | Alimentation de la passerelle | 24 V du camion → 5 V. À faire valider par le mécanicien avant tout branchement. Batterie tampon si le refus est net |
| V-5 | Le changement de camion | Le boîtier passe d'un camion à l'autre entre les séances. Deux comptes pilotes, deux affectations dans `devices`, une manipulation notée à chaque fois |
| V-6 | Ligne d'arrivée | La ligne officielle du circuit. Pas de ligne maison |
| V-7 | Ce qu'on ne fait jamais | Percer, coller sur une surface peinte, passer un câble dans un faisceau, toucher à quoi que ce soit sans le mécanicien |

---

## 4 · La chaîne du direct

Quatre maillons. Chacun peut tomber ; chacun a un repli.

| # | Maillon | Ce qui le tient | Ce qui le remplace |
|---|---|---|---|
| L-1 | Capture | RaceBox Mini S à 25 Hz, Bluetooth vers la passerelle | Enregistrement interne du boîtier (M-2) — la reconnaissance est garantie même sans direct |
| L-2 | Remontée | Passerelle v1, tampon local, 4G | Relais téléphone (M-4) |
| L-3 | Serveur | `ingest-frames` avec authentification appareil, cycle de séance, tours écrits en direct | Import après séance par le même chemin (I-2) |
| L-4 | Affichage | Canal 1 `pavillon:{circuit_id}:live` → `/pavillon/coach` sur l'écran ; application en direct sur la tablette | Tablette seule |

**L-5 — Le contrat d'émission est partagé.** La passerelle et le téléphone émettent le même message, à la même cadence, sur le même canal : `{v, user_id, car_number, lat, lon, speed_kmh, ts}`, 1 Hz, jamais de nom. Écrire ce contrat une fois rend le repli presque gratuit. C'est la conséquence d'ingénierie de la décision S-4, et elle n'est pas négociable : sans elle, avancer la passerelle au 26/09 revient à partir sans filet.

**L-6 — Le retard se mesure, il ne s'affirme pas.** On dit « en direct, avec n secondes de retard mesurées ». Jamais « temps réel ».

**L-7 — Ce qui est écrit avant le départ.** Cadence, tampon, comportement en perte de réseau, reprise après coupure d'alimentation. Une passerelle qui perd la 4G doit garder ses trames et les rejouer, pas les jeter.

---

## 5 · Le multi-circuit

| # | Point | Décision |
|---|---|---|
| C-1 | Bugatti en base | Tracé, virages, ligne officielle, sens. Import OSM, `detect-circuit-corners`, `captureFinishLineFor` |
| C-2 | Albi en base | Même chaîne, avant le 09/10 |
| C-3 | Ouverture complète du coach | Virages sortis du code vers la base, détection automatique, `gardeFouMultiCircuit` retirée, `CircuitMap` générique. Priorités et Repères lisent la liste, ils ne la contiennent plus (S-5b) |
| C-4 | Les six points câblés | `circuitTopology`, `BELTOISE_CORNERS` dans Priorités et Repères, `gardeFouMultiCircuit`, `CircuitMap` |
| C-5 | Le point à vérifier | Une note du 29/08 indique que l'espace pilote (import 25 Hz, zones, vitesse, carte de chaleur, comparaison de tours) fonctionne déjà sur circuit inconnu. Les deux peuvent être vrais : pilote passant, coach bloquant. **À trancher sur la branche avant le 05/09** — c'est ce qui dimensionne C-3 |
| C-6 | Butée | Tout doit tenir à la répétition de Bouteville, avant le 19/09 |

---

## 6 · Les cinq preuves

Les cinq aux deux épreuves (S-6). Une preuve qui échoue se dit ; elle ne se maquille pas.

### P-1 · La concordance

| | |
|---|---|
| Ce qu'on montre | Nos temps au tour et nos temps par secteur, à côté du chronométrage officiel de la séance |
| Où | La Séance, le Bilan, l'écran en restitution |
| Critère | Écart par tour mesuré et affiché. Nous ne promettons pas un chiffre avant de l'avoir mesuré : le premier week-end **établit** l'écart, il ne le valide pas |
| Ce qu'il faut avant | Ligne officielle (V-6), découpage en secteurs officiels (I-1), `triElapsedMs`, tours de sortie et de rentrée exclus |
| Comment on mesure | Le pilote lit la feuille officielle, vous lisez l'écran, l'écart s'écrit sur la feuille de preuve |
| Si ça échoue | Écart constant = ligne décalée, corrigible en séance. Écart variable = tour mal détecté : on le dit et on montre la zone de confiance |
| À ne pas dire | « C'est aussi précis que le chronométrage officiel ». C'est un GPS à 25 Hz |

### P-2 · Le pilote seul devant ses tours

| | |
|---|---|
| Ce qu'on montre | Le Bilan dans sa main en descendant : chrono, marges, virage à creuser, delta. Puis la Séance le soir |
| Critère | Il nomme lui-même, sans explication préalable, ce qu'il regarde en premier |
| Ce qu'il faut avant | C-3 ; aucun écran vide (`DataConfidenceBanner` ou `raisonAbsence` sur chaque chiffre absent) ; contraste plein soleil |
| Si ça échoue | Un Bilan vide tue la preuve. C'est pour cela que les cinq états sont un prérequis, pas une finition |
| Interdit | Le comparer au second pilote. Il se compare à lui-même et au plateau (P-3), jamais à son coéquipier |

### P-3 · Sa place dans le plateau

| | |
|---|---|
| Ce qu'on montre | Ses temps replacés dans ceux du plateau de l'épreuve, secteur par secteur |
| Pourquoi c'est juste | Le classement existe déjà, il est officiel et public. OXV n'en fabrique aucun : il lit celui qui est là et le rend lisible autrement |
| Ce qu'il faut avant | Référentiel plateau (I-7b), découpage en secteurs officiels (I-1) |
| Limite à dire | Le plateau ne donne que des temps. Pas de trace, pas de vitesse, pas de comparaison de trajectoire |
| Interdit | Que ce référentiel sorte sur une surface publique — ni le mur du bar, ni le site. Garde `plateauNonPublic` |

### P-4 · Sa parole à côté de la mesure

| | |
|---|---|
| Ce qu'on montre | L'intention écrite avant la séance (I-11) et son retour au Bilan ; les notes prises au camion (I-3) posées à côté des chiffres |
| Critère | Il retrouve dans la donnée quelque chose qu'il avait senti — ou l'inverse, et il le dit |
| Ce qu'il faut avant | Champ de notes utilisable debout, à une main, hors réseau ; l'intention posée **avant** de rouler |
| À ne pas dire | Que le ressenti « explique » la donnée. On les pose côte à côte. On ne relie pas |

### P-5 · La mémoire d'une séance à l'autre

| | |
|---|---|
| Ce qu'on montre | Sa signature et sa régularité d'une séance à la suivante, sur le week-end |
| Critère | Une lecture longitudinale que ni le chronomètre ni le ressenti ne tiennent |
| Ce qu'il faut avant | Rien d'externe. C'est la preuve la moins dépendante des autres : elle ne demande que plusieurs séances importées proprement |
| Si ça échoue | Une seule séance exploitable = signature « donnée à venir », et elle le dit |
| À ne pas dire | Un jugement sur les axes. L'empreinte n'est pas une note |

---

## 7 · Le déroulé du Mans

Vous êtes seul. Le déroulé est écrit pour une personne, pas pour une équipe. Chaque séance est un cycle identique : **poser, laisser rouler, récupérer, importer, montrer, déplacer.**

| # | Moment | Ce que vous faites |
|---|---|---|
| J-1 | Vendredi, arrivée | Pass récupéré (Q-25). Présentations. Le dossier « Le Stratège » est déjà lu : on en parle avant de parler technique |
| J-2 | Vendredi | Emplacement du boîtier décidé avec le mécanicien (V-1). Alimentation validée (V-4). Rien n'est branché sans accord |
| J-3 | Vendredi | Accord d'une page signé, ou le leur signé (§9). 4G mesurée depuis le stand (M-8). Écran monté, `/pavillon/coach` affiché à vide |
| J-4 | Vendredi | Essai statique : passerelle allumée, position visible sur la tablette et sur l'écran, camion à l'arrêt |
| J-5 | Avant chaque séance | L'intention du pilote, une ligne (I-11). Boîtier vérifié, passerelle vérifiée, écran en mode direct |
| J-6 | Pendant | Vous regardez, vous ne parlez pas. Vous notez ce qui se passe pour l'écran, pas pour le pilote |
| J-7 | Retour au stand | Vous laissez le mécanicien travailler d'abord. Le camion prime |
| J-8 | Entre les séances | Récupération, téléchargement si nécessaire (≈ 4 min 40 pour 2 h 11), import, ouverture du Bilan avec le pilote, écran en mode restitution |
| J-9 | Entre les séances | Notes prises dans l'application (I-3). Photo de la feuille de réglages si elle est proposée (I-10) |
| J-10 | Entre les séances | Boîtier déplacé sur l'autre camion (V-5), compte changé |
| J-11 | Samedi soir | Feuille de preuve remplie avec le pilote et le chef d'écurie |
| J-12 | Dimanche soir | Rien de commercial. On remercie, on annonce la page du lendemain |
| J-13 | Lundi | Page envoyée sous 24 h (I-9) |

**J-14 — La règle de priorité si tout se bouscule.** Dans l'ordre : que la donnée soit capturée ; qu'elle soit importée ; qu'elle soit montrée. Le direct passe après les trois. Une séance capturée et montrée le soir vaut mieux qu'un direct raté et rien à lire.

**J-15 — Ce qu'on ne fait pas au Mans.** On ne demande rien pendant que le camion est en réparation. On n'entre pas dans une discussion de réglages. On ne s'installe pas dans leur espace de travail.

---

## 8 · Au camion — le script

Il n'y a pas de salle. La restitution se fait debout, à côté du camion, dans le bruit, en trois minutes.

| # | Moment | Ce que vous dites |
|---|---|---|
| S-1 | Avant la séance | « Qu'est-ce que vous voulez essayer sur celle-là ? » — une phrase, notée |
| S-2 | À la descente | Rien. On laisse passer la première minute |
| S-3 | Première ouverture | L'écran tourné vers lui, et le silence. La preuve P-2 se joue ici : c'est lui qui parle en premier |
| S-4 | Sa question | On répond par un fait et sa provenance. Jamais par une consigne |
| S-5 | Le plateau | « Voilà où ça vous place sur ce secteur-là, d'après le chronométrage officiel » |
| S-6 | La sortie | « Je vous laisse, vous avez à faire » — toujours partir avant qu'on vous le demande |
| S-7 | Si on vous demande le prix | « On en reparle après le week-end, quand vous saurez ce que ça vaut pour vous. » Et rien d'autre (S-13) |
| S-8 | Si on vous demande une consigne | « Ce n'est pas ce que fait l'outil. Il montre, il ne prescrit pas. » C'est une force, pas une excuse |

---

## 9 · Données, droits, papiers

| # | Point | Décision |
|---|---|---|
| D-1 | Décharge circuit | Aucune. Vous êtes invité de l'écurie sur une épreuve officielle (Q-15) |
| D-2 | Accès | Pass équipe fourni par l'écurie, **obtenu par écrit avant le 20/09** (Q-25). Sans pass, il n'y a pas de week-end |
| D-3 | Accord d'une page | Rédigé par nous : trames brutes, fixture anonymisée, feuille de réglages, images, citation. Avocat hors chemin critique |
| D-4 | Leur NDA | S'ils en ont un, on le signe (Q-15) |
| D-5 | Enregistrement audio | Aucun (Q-17) |
| D-6 | Fixture de test | Conservée, anonymisée : trames GPS sans nom ni numéro (Q-17) |
| D-7 | Feuille de réglages | Demandée, jamais exigée. Clause dédiée. C'est leur secret de course (I-10) |
| D-8 | Citation du nom | Décidée après Le Mans (Q-21). **Fenêtre : 28/09 → 09/10.** Au-delà, le film d'Albi repart sur un jeu anonymisé |
| D-9 | Images | Albi uniquement, avec NADIR. Donnée réelle et nom à l'image (I-12) — donc accord signé avant le 10/10 |
| D-10 | Chronométrage officiel | Lecture automatisée du live timing ITS, décidée le 30/08. Courrier à ITS et à la FFSA envoyé en parallèle |
| D-11 | Garde-fous de D-10 | Cadence basse (une requête toutes les 5 à 10 s, jamais en rafale) ; aucune redistribution publique ; usage interne au camion ; contact OXV identifiable ; arrêt immédiat sur demande ; repli sur la feuille officielle demandée à l'écurie |
| D-12 | Réserve consignée | Les conditions d'utilisation d'ITS ne sont pas connues et une base de chronométrage relève du droit du producteur de base de données. Ce n'est pas un avis juridique. Le risque principal n'est pas une amende : c'est la relation avec le chronométreur officiel de la fédération, le week-end où vous vous présentez à une de ses écuries |

---

## 10 · La feuille de preuve — texte à imprimer

*Une page. Remplie par le pilote et le chef d'écurie, pas par nous. Elle ne demande aucun avis sur l'outil : elle demande des faits.*

> **Épreuve** ________________  **Date** ________  **Camion** ________  **Séance** ________
>
> **1 — Concordance.** Notre temps au tour : ________ · Le chronométrage officiel : ________ · Écart : ________
> Secteur 1 : ______ / ______ · Secteur 2 : ______ / ______ · Secteur 3 : ______ / ______
>
> **2 — Ce que le pilote a regardé en premier, sans qu'on le lui indique :** ______________________
>
> **3 — Sa place dans le plateau, sur le secteur regardé :** ______________________
>
> **4 — Une chose qu'il avait sentie et qu'il a retrouvée dans la mesure :** ______________________
> **Une chose que la mesure montre et qu'il n'avait pas sentie :** ______________________
>
> **5 — D'une séance à l'autre, ce qui a changé :** ______________________
>
> **Ce qui n'a pas marché ce week-end :** ______________________
>
> **Ce qui manquerait pour que ce soit utile toute une saison :** ______________________
>
> Nom et fonction ________________  Signature ________

---

## 11 · Ce qu'on observe du pilote

Sans audio, l'observation est la seule matière. Elle se note après, jamais devant lui.

| # | Ce qu'on note |
|---|---|
| O-1 | Combien de secondes avant qu'il dise le premier mot devant l'écran |
| O-2 | Le premier élément qu'il touche ou désigne |
| O-3 | La première question qu'il pose, mot pour mot |
| O-4 | Ce qu'il montre à quelqu'un d'autre — c'est le meilleur signal de valeur du week-end |
| O-5 | Ce qu'il ignore complètement, deux séances de suite |
| O-6 | Le moment où il reprend son téléphone : la lecture est finie |
| O-7 | Ce que le chef d'écurie regarde par-dessus son épaule, et ce qu'il en dit |

---

## 12 · Les tâches, datées

Vingt-sept jours. Une personne. La liste est longue parce que les décisions prises le 30/08 sont ambitieuses : passerelle avancée au 26/09, coach ouvert au multi-circuit, cinq preuves aux deux épreuves. Elle est datée pour que le décrochage se voie tôt.

| # | Tâche | Butée | Preuve d'achèvement |
|---|---|---|---|
| T-1 | **Commande des pièces de la passerelle** (Pi, LTE, alimentation, coffret) | 02/09 | Confirmation d'expédition. C'est le chemin critique : rien d'autre ne rattrape un retard d'approvisionnement |
| T-2 | Trancher C-5 sur la branche : ce qui passe déjà sur circuit inconnu, ce qui bloque | 05/09 | Liste écrite des six points, chacun ouvert ou fermé |
| T-3 | Courrier ITS et FFSA | 02/09 | Envoyé |
| T-4 | Bugatti en base : tracé, virages, ligne officielle | 05/09 | Une fixture rejouée sur le tracé, marges non nulles |
| T-5 | Sentry et source maps sur le profil TestFlight | 05/09 | Un plantage provoqué remonte avec sa pile |
| T-6 | Contrat d'émission partagé (canal 1) ; relais téléphone réveillé | 08/09 | Sur route ouverte : la pastille bouge sur `/pavillon/coach` |
| T-7 | Chemin d'ingestion unique (CSV boîtier et trames passerelle) | 08/09 | Un CSV et un flux de trames produisent la même séance |
| T-8 | `ingest-frames` avec authentification appareil, cycle de séance, tours écrits en direct | 10/09 | Un tour apparaît à l'écran dans les secondes qui suivent la ligne |
| T-9 | Ouverture complète du coach au multi-circuit (C-3) | 12/09 | Tests verts sur deux circuits ; aucun virage codé en dur |
| T-10 | Découpage en secteurs officiels | 12/09 | Trois secteurs recalés sur des temps officiels connus |
| T-11 | Cinq états sur les écrans de donnée ; contraste plein soleil | 12/09 | Aucun écran vide sans raison nommée |
| T-12 | Passerelle assemblée ; portage Node du parseur UBX ; tampon et reprise | 15/09 | Deux heures de roulage sur route, zéro trame perdue |
| T-13 | Référentiel plateau + garde `plateauNonPublic` | 16/09 | Une séance passée du championnat lue et affichée ; la garde interdit la sortie publique |
| T-14 | Notes libres au camion : hors réseau, une main, plein soleil | 16/09 | Écrit sans réseau, retrouvé après redémarrage de l'application |
| T-15 | Intention avant séance, rappelée au Bilan | 16/09 | Une phrase posée avant, relue après |
| T-16 | Page envoyée sous 24 h (Débrief J+1) | 17/09 | Une page produite depuis une séance réelle |
| T-17 | Comptes pilotes, numéros de camion, `devices` affectés | 17/09 | Les deux comptes apparaissent dans la file de l'écran |
| T-18 | **Répétition à blanc, Bouteville, séance complète** | 19/09 | Compte rendu chiffré : retard médian, décrochages, autonomie, temps du cycle J-8 |
| T-19 | Envoi du dossier « Le Stratège » | 19/09 | Envoyé, avec une phrase courte et aucune demande |
| T-20 | Pass équipe confirmé **par écrit** | 20/09 | Le message |
| T-21 | Accord d'une page et feuille de preuve imprimés, relus par quelqu'un d'autre | 22/09 | Relecture faite |
| T-22 | Décision de citation avec l'écurie | 28/09 → 09/10 | Écrit, ou plan B anonymisé assumé |
| T-23 | Validation de la passerelle sur route ouverte pour Albi | 03/10 | Deux heures propres, sinon S-14 s'applique |
| T-24 | Albi en base | 06/10 | Même preuve que T-4 |

**T-25 — Ordre de sacrifice si le temps manque.** Ce qui tombe en dernier : T-1, T-4, T-2, T-7, T-6, T-12, T-18. Ce qui tombe en premier : T-13 (le plateau se relève à la main sur la feuille officielle), T-15, T-16 (la page peut partir à J+3), T-10 (la preuve P-1 se réduit au temps au tour), T-9 (repli sur l'espace pilote seul, qui fonctionne déjà).

**T-26 — Le point de non-retour.** Si, le 19/09 au soir, la répétition de Bouteville n'a pas montré une chaîne complète qui tient une séance entière, la passerelle ne part pas au Mans : le relais téléphone prend le direct et le boîtier garantit l'enregistrement. Cette décision se prend le 19, pas le 25.

---

## 13 · Les plans B

| # | Panne | Ce qu'on fait | Ce qui reste prouvable |
|---|---|---|---|
| B-1 | Passerelle non prête au 19/09 | Relais téléphone en cabine, boîtier en parallèle | Les cinq preuves. Seul le matériel change |
| B-2 | Passerelle tombe pendant le week-end | Boîtier récupéré entre les séances, import, restitution | Tout sauf le direct (P-3 reste, il ne dépend pas du direct) |
| B-3 | Pas de 4G exploitable au stand | Capture et enregistrement continuent ; direct abandonné, on le dit | Tout sauf le direct |
| B-4 | Refus de poser quoi que ce soit dans la cabine | Boîtier tenu par le pilote dans un support magnétique posé au tableau de bord, ou week-end en observation seule | À renégocier sur place. Ce refus tue le week-end technique, pas la relation |
| B-5 | Le flux ITS change de format ou tombe | Feuille officielle demandée à l'écurie, séance par séance | P-3, en différé |
| B-6 | L'écran ne s'allume pas | Tablette seule ; l'écran redevient un objet de décor | Tout, en plus petit |
| B-7 | Le pilote n'a pas trois minutes | Bilan laissé ouvert sur la tablette, il le lit quand il peut | P-2 affaibli ; on le note honnêtement |
| B-8 | Le boîtier perd le fix GPS en cabine | Repositionnement immédiat avec le mécanicien ; séance suivante | On perd une séance, pas le week-end |
| B-9 | Le pass n'arrive pas | On ne part pas. Décision prise le 20/09, pas le 25 | Rien — et c'est pour cela que T-20 est daté |

---

## 14 · Albi, ce qui change

| # | Point | Décision |
|---|---|---|
| A-1 | Dispositif | Une passerelle sur un camion, le boîtier sur l'autre (I-6). Les deux modes démontrés le même week-end |
| A-2 | Écran | Direct pendant la séance, bilan entre les séances (I-5). Ce sont les deux modes de `/pavillon/coach`, pilotés depuis `/pavillon/controle` |
| A-3 | NADIR | Présent. Images du dispositif et de son usage |
| A-4 | Film | Donnée réelle et nom à l'image (I-12) — conditionné à D-8. Plan B anonymisé préparé **au tournage**, pas après |
| A-5 | Si la passerelle n'est pas validée au 03/10 | Albi bascule entièrement sur le boîtier, comme Le Mans. Pas de prototype non testé devant un client (S-14) |
| A-6 | Après Albi | Plus rien avant avril 2027. Ce week-end ferme la saison : ce qui n'est pas obtenu là attend six mois |

---

## 15 · L'offre

| # | Point | Décision |
|---|---|---|
| F-1 | Quand | Après Le Mans. Pas avant d'avoir vu leur usage réel |
| F-2 | Au camion | Aucun chiffre. Une phrase tenue (S-7) |
| F-3 | Ce qui la construit | La feuille de preuve, les notes d'observation (§11), et ce que le pilote aura montré à quelqu'un d'autre |
| F-4 | Ce qu'on ne vend pas | Du conseil de pilotage. Nous ne sommes pas agréés, et ce n'est pas la promesse |
| F-5 | L'unité économique | À déterminer avec le réel : par pilote, par camion, ou par week-end d'épreuve. La question se tranche avec eux, pas avant eux |

---

## 16 · Après

| # | Quand | Quoi |
|---|---|---|
| H-1 | Lundi 28/09 | Page envoyée au pilote (I-9). Rien d'autre |
| H-2 | 28/09 → 02/10 | Notes d'observation mises au propre ; feuille de preuve numérisée ; fixture anonymisée constituée |
| H-3 | Avant le 03/10 | Ce que le week-end a cassé, corrigé — priorité absolue sur toute nouvelle fonctionnalité |
| H-4 | 28/09 → 09/10 | Décision de citation (D-8) et accord image signé si le film d'Albi doit montrer un nom |
| H-5 | Après Albi | Proposition à l'écurie, construite sur les deux week-ends |
| H-6 | Novembre | Ce qui a servi devient produit ; ce qui n'a pas servi est retiré du registre, pas mis en sommeil |

---

## 17 · Les points encore ouverts

| # | Point | Qui tranche | Quand |
|---|---|---|---|
| X-1 | C-5 : ce qui passe déjà sur circuit inconnu | Vous, sur la branche | 05/09 |
| X-2 | Le Mini S : firmware, mémoire, code de sécurité mémoire vérifiés | Vous | 05/09 |
| X-3 | Format exact des documents publiés par ITS (temps au tour ? intermédiaires ?) | À constater | 05/09 |
| X-4 | Horaires précis du week-end du Mans (essais, qualifications, courses) | Publié par l'organisateur | Dès parution |
| X-5 | Où loger et où travailler le samedi soir | Vous | 15/09 |
| X-6 | Ce que l'écurie attend de ce week-end, dit par eux | Le chef d'écurie | Vendredi 25/09 |

---

*Fin du dossier. Les identifiants sont stables : R, M, V, L, C, P, J, S, D, O, T, B, A, F, H, X.*
