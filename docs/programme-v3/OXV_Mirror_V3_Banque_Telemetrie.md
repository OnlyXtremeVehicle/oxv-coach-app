# OXV Mirror V3 — Banque de calculs et de visualisations télémétriques

**27 juillet 2026** · Cinquième audit, consolidé
Complément au dossier de conception. Source : documentation constructeur RaceBox, protocole UBX, littérature d'ingénierie de course et de coaching.

**Convention d'étiquetage, appliquée partout dans le produit :**

| Marque | Nature | Traitement à l'écran |
|---|---|---|
| **[M]** | **fait mesuré** — canal brut | affiché tel quel |
| **[D]** | **dérivation** — calculé | affiché avec sa nature dite |
| **[I]** | **interprétation** | **jamais par le produit** — réservé au coach humain, attribué |

---

# I. LE MATÉRIEL — CE QU'IL DONNE VRAIMENT

## I.1 Les dix-huit champs bruts

Source primaire : *RaceBox BLE Protocol Documentation, Revision 8*, 16 avril 2024. Message `0xFF 0x01`, **80 octets de charge utile**, explicitement dérivé du message u-blox `NAV-PVT`. Applicable aux Mini, Mini S et Micro, firmware 2.x et 3.x.

| Champ | Offset | Type | Unité brute → convertie |
|---|---|---|---|
| iTOW | 0 | UInt32 | ms depuis début de semaine GPS |
| Date et heure | 4–10 | — | UTC |
| Nanoseconds | 16 | Int32 | ns, **peut être négatif** |
| Fix Status | 20 | Enum | 0 / 2 / 3 — sans fix, 2D, 3D |
| Number of SVs | 23 | Byte | satellites |
| Longitude | 24 | Int32 | ×10⁷ deg |
| Latitude | 28 | Int32 | ×10⁷ deg |
| WGS Altitude | 32 | Int32 | mm, ellipsoïde |
| MSL Altitude | 36 | Int32 | mm, au-dessus du niveau de la mer |
| Horizontal Accuracy | 40 | UInt32 | mm |
| Vertical Accuracy | 44 | UInt32 | mm |
| **Speed** | 48 | Int32 | mm/s → km/h |
| **Heading** | 52 | Int32 | ×10⁵ deg, 0 = Nord |
| Speed Accuracy | 56 | UInt32 | mm/s |
| Heading Accuracy | 60 | UInt32 | ×10⁵ deg |
| PDOP | 64 | UInt16 | ×100 |
| Battery / Voltage | 67 | Byte | % (Mini, Mini S) ou V×10 (Micro) — bit de poids fort = charge en cours |
| **GForce X, Y, Z** | 68–72 | Int16 | milli-g → g (÷1000) — X avant-arrière, Y droite-gauche, Z haut-bas |
| **Rotation X, Y, Z** | 74–78 | Int16 | centi-°/s → °/s (÷100) — X roulis, Y tangage, Z lacet |

**Fréquence** : jusqu'à 25 Hz en direct ; en enregistrement autonome, configurable à 25, 20, 10, 5 ou 1 Hz.

## I.2 Les capteurs

| | Spécification |
|---|---|
| **GNSS** | 25 Hz · GPS, GLONASS, Galileo, BeiDou, SBAS — QZSS en plus sur Micro et Mini S · sensibilité −167 dBm · antenne à gain 20 dB |
| **Accéléromètre** | échantillonnage interne **1 kHz**, échelle ±8 g, sensibilité 0,001 g |
| **Gyroscope** | 1 kHz, échelle ±320 °/s, sensibilité 0,02 °/s |

**Fait important : l'IMU tourne à 1 kHz en interne et est moyennée pour sortir à 25 Hz.** La résolution temporelle réelle des accélérations est donc meilleure que 25 Hz ne le laisse croire, mais elle n'est pas accessible.

Précisions constructeur u-blox (fiche SAM-M10Q) : **vitesse 0,05 m/s** · **CEP horizontal 1,5 m** · **cap dynamique 0,3°** — chaque valeur spécifiée à 50 % à 30 m/s en régime dynamique.

*Non confirmé en source primaire RaceBox* : le mapping exact des modules u-blox aux modèles (M9N sur Mini, SAM-M10Q sur Micro et Mini S) provient de recoupements tiers.

## I.3 Les limites dures

**Le RaceBox n'a ni position de papillon, ni pression de frein, ni angle volant, ni régime moteur, ni rapport engagé, ni températures.**

| Ce qui devient impossible | Conséquence |
|---|---|
| Distinguer un lever de pied d'un freinage léger | seulement par inférence sur la trace de vitesse |
| Mesurer le trail braking | inféré par la **forme** de la décélération, jamais mesuré |
| Séparer sous-virage et survirage | l'angle volant manque, la dérive vraie n'est pas mesurable |
| Analyser passage de rapport, zone de régime, patinage | hors de portée |

**Voie d'extension.** Les Mini et Micro n'ont pas d'entrée OBD native ; l'usage courant fusionne le flux GNSS 25 Hz avec un dongle OBD ou CAN via une application tierce. La lecture CAN dépasse souvent le rafraîchissement de l'OBD standard.

## I.4 La qualité du signal, et le filtrage obligatoire

**Annoncé par le constructeur** : « précision jusqu'à 10 cm », « plus de 99,5 % de précision au centième de seconde face à un équipement officiel ». **Marketing, non validé indépendamment.** Un test terrain rapporte 46 cm avec 16 satellites et un accord au chrono de ±0,01 s contre transpondeur.

**Faiblesses réelles.**

*Multipath* — bâtiments, ponts, tribunes, tunnels. *Le cap devient inexploitable à basse vitesse* : u-blox gèle la valeur sous 0,1 m/s, et la précision de 0,3° vaut à 30 m/s, pas à l'arrêt. *La précision verticale est deux à trois fois pire que l'horizontale* — la pente et le travail sur dénivelé sont peu fiables.

*Angle d'inclinaison moto sous-estimé d'environ 15 %* — l'IMU ne distingue pas la force centrifuge de la composante de gravité. Constaté sur **un seul test formel**.

**Le filtrage précède tout calcul.**

| Traitement | Paramètre |
|---|---|
| Lissage avant dérivation | moyenne glissante ou **Savitzky-Golay**, fenêtre 5 à 9 points à 25 Hz — soit 200 à 360 ms |
| Fusion GNSS-IMU | **filtre de Kalman étendu**, ou error-state Kalman avec lisseur RTS en post-traitement. Couplage lâche suffisant |
| Calibration | zéro-offset IMU à l'arrêt, **et alignement d'orientation** — le boîtier n'est jamais parfaitement aligné au repère véhicule |

---

# II. LA BANQUE DE CALCULS

## II.1 Cinématique

| Grandeur | Formule | Fiabilité 25 Hz | Piège |
|---|---|---|---|
| **Vitesse** [M] | canal direct | **robuste** | bruit à l'arrêt, cap gelé sous 0,1 m/s |
| **Accélération longitudinale** [D] | `a = dv/dt` (différences centrées) **et** canal GForceX, fusionnés | robuste | la dérivée brute amplifie le bruit ; GForceX inclut la gravité en pente |
| **Accélération latérale** [D] | `a_lat = v²/R` **ou** `a_lat = v × ω_lacet` | robuste | **la voie `v × ω` est la plus propre** — indépendante de la gravité, contrairement à GForceY biaisée par dévers et roulis |
| **Jerk** [D] | `j = da/dt` | **fragile** | double lissage requis ; à traiter comme tendance qualitative |
| **Distance** [D] | `∫ v dt` | **robuste** | la vitesse est le canal le plus fiable |
| **Distance curviligne** [D] | intégration le long de la trajectoire | robuste | **clé d'appariement des tours** |
| **Pente** [D] | `d(altitude)/d(distance)` | **fragile** | précision verticale dégradée — lisser sur plus de 20 m |

## II.2 Trajectoire

**Rayon de courbure** [D] — `R = v / ω_lacet` (v en m/s, ω en rad/s) est la forme la plus propre, car elle exploite le gyroscope directement. Forme pratique : `R(m) = 0,020 × v(mph)² / a_lat(g)`.

*Piège* : diverge en ligne droite quand `a_lat → 0`. **Tracer la courbure `1/R`**, jamais R.

**Angle de braquage estimé** [D] — modèle bicyclette `δ ≈ L/R`, empattement connu. **Estimation, jamais présentée comme mesure.**

**Écart latéral à une référence** [D] — distance signée projetée. Le bruit GNSS de 0,5 m se répercute directement.

**Point de corde** [D] — rayon minimal ou vitesse minimale locale. Robuste comme repère relatif.

**Angle de dérive** — **impossible.** Le RaceBox mesure le cap du vecteur vitesse, jamais l'orientation du châssis. Il faudrait une double antenne ou un capteur optique.

## II.3 Freinage — sans capteur de pression

| Grandeur | Méthode | Fiabilité |
|---|---|---|
| **Point de freinage** [D] | `a_long` passe sous **−0,3 g** — seuil conventionnel excluant le frein moteur | robuste |
| **Décélération max et moyenne** [D] | min et moyenne sur la zone. Plage −0,8 à −1,5 g | robuste |
| **Durée et distance** [D] | du point de freinage à la vitesse minimale | robuste |
| **Vitesse d'entrée et de sortie** [M/D] | aux deux bornes | robuste |
| **Dispersion des points de freinage** [D] | écart-type de l'abscisse curviligne entre tours | robuste |
| **Trail braking** [D] | **inféré par la forme** : décélération résiduelle maintenue pendant que la courbure augmente — chevauchement `a_long` / `a_lat` au diagramme g-g | **dérivation** |

**La signature du trail braking.** Bentley décrit la trace de vitesse « en crosse de hockey » quand il est présent, contre le « brake wall » — bloc carré puis relâché net — quand il est absent.

**L'attribution causale reste au coach.**

## II.4 Accélération et sortie

**Point de remise des gaz** [D] — `a_long` redevient positive après l'apex. Estimation, faute de canal papillon.

**Vitesse minimale en virage** [M] — **l'indicateur le plus discriminant du niveau.** Très robuste, et c'est un fait mesuré.

**Vitesse de sortie** [M] et **accélération de relance** [D] — robustes.

## II.5 Enveloppe d'adhérence

**Diagramme g-g** [D] — nuage `(a_lat, a_long)`. **La forme est la signature.**

**Enveloppe de référence** [D] — ellipse aux moindres carrés, ou coque convexe des extrêmes.

**Taux d'exploitation** [D] — fraction du temps où le vecteur dépasse 90 % de l'enveloppe. *Moyennement robuste* : dépend de la qualité de l'enveloppe et du filtrage, et le bruit gonfle les extrêmes.

## II.6 Régularité

**Écart-type et coefficient de variation** `CV = σ/moyenne` des temps au tour, par secteur, par virage — robuste, méthode standard.

**Dispersion des trajectoires** [D] — σ de l'écart latéral par abscisse. Moyennement robuste.

**Répétabilité des points de freinage** [D] — robuste.

**Préférer médiane et MAD** — écart absolu médian — à moyenne et écart-type quand l'échantillon est petit ou contient des tours aberrants dus au trafic.

## II.7 Segmentation

Détection de ligne d'arrivée · découpage en tours et en secteurs · **détection automatique des virages par seuillage de `1/R`** · **appariement tour-à-tour par ré-échantillonnage sur une grille de distance commune**.

**Toute comparaison se fait en base distance, jamais en base temps.** C'est la règle la plus structurante de la banque.

## II.8 Tour idéal et delta

**Tour idéal** [D] — somme des meilleurs secteurs.

*Piège documenté* : un tour idéal à trois secteurs **masque les erreurs à l'intérieur d'un secteur**. Préférer 50 à 200 micro-secteurs. Il reste **une cible théorique, jamais un tour réel**.

**Delta-temps** [D] — en base distance :

```
Δt(d) = ∫ [1/v_courant − 1/v_référence] dd
```

Forme MoTeC : `Δt = (dist_courant − dist_réf) / ((v_courant + v_réf)/2)`.

*Piège* : l'erreur croît là où les vitesses diffèrent fortement — **d'où la moyenne des deux vitesses au dénominateur**.

**La pente de la courbe est le gain ou la perte instantané.** C'est l'objet central du coaching.

## II.9 Énergie — pour le carnet d'entretien

`ΔE = ½m(v_entrée² − v_sortie²)` · `P = ΔE/Δt` · travail total par tour.

**La masse est saisie, jamais mesurée.** Robuste si elle est connue — et c'est le pont direct vers le carnet d'entretien (IV.22 du dossier de travail).

## II.10 Physiologie — ceinture cardio BLE

Service **`0x180D`**, caractéristique **`0x2A37`** : premier octet = format UINT8 ou UINT16, puis BPM, petit-boutiste.

**Mesurable** : fréquence cardiaque [M], zones [D], dérive cardiaque [D], corrélation avec les g cumulés [D].

**Non mesurable** : charge mentale, stress, **et surtout la cause d'une hausse** — effort physique ou tension nerveuse. La FC seule ne les distingue pas. Interprétation réservée au coach.

## II.11 Synthèse de fiabilité

| Robustes | Fragiles | Impossibles sans capteur |
|---|---|---|
| vitesse · distance · vitesse mini virage · points et décélérations de freinage · delta par distance · temps au tour et dispersion · segmentation · **forme du g-g** | jerk · pente · écart latéral fin · braquage estimé · taux d'exploitation · trail braking inféré | angle de dérive vrai · papillon · pression de frein · angle volant · régime et rapport · températures · sous et survirage certifiés |

---

# III. LA BANQUE DE VISUALISATIONS

**Deux règles transverses** : base distance pour toute comparaison ; « — » pour toute donnée absente.

| # | Visualisation | Ce qu'elle montre | Mobile 390 pt | Référence |
|---|---|---|---|---|
| 1 | **Tracé coloré par une grandeur** | *où* une grandeur prend ses valeurs. Pas l'évolution temporelle fine | **excellent**, pleine largeur | MoTeC Track Report · VBOX · ATLAS |
| 2 | **Carte de chaleur gain-perte** | le temps gagné ou perdu, localisé | bon | MoTeC Lap Gain/Loss · ATLAS |
| 3 | **Traces vitesse et g vs distance** | **la vue reine** — la forme révèle le trail braking | un canal à la fois | toutes les suites pro |
| 4 | **Delta-temps cumulé** | où le temps se gagne. Pas *pourquoi* | **très bon**, une seule courbe | VBOX Delta-T · MoTeC Variance |
| 5 | **Diagramme g-g** | l'exploitation de l'enveloppe et le style | **bon en carré 1:1** | VRS · MoTeC · ATLAS |
| 6 | Histogrammes et distributions | répartition du temps par tranche | bon | MoTeC i2 |
| 7 | **Box plots par virage** | dispersion — médiane, quartiles, MAD | bon, peu de virages par écran | — |
| 8 | Nuages de dispersion | corrélations — vitesse mini contre temps au tour | correct | études télémétriques |
| 9 | **Superposition de trajectoires** | répétabilité de ligne | bon | — |
| 10 | Vue en couloir | usage de la largeur de piste | moyen, largeur écrasée | VBOX overhead |
| 11 | **Profils de vitesse par virage** | un virage par carte | **excellent** | — |
| 12 | Petits multiples par tour | évolution intra-session | bon, grille 2×N | Tufte |
| 13 | Matrice virage × tour | repère un virage problématique récurrent | moyen, défilement horizontal | — |
| 14 | **Courbes de progression saisonnière** | la tendance long terme | bon | — |
| 15 | Radar multi-critères | **séduisant mais trompeur** — aires non additives, dépend de l'ordre des axes | — | **préférer barres parallèles** |
| 16 | Table de secteurs et tour idéal | les splits | bon | VBOX · Circuit Tools |

**Cinq idiomes professionnels supplémentaires**, repérés dans MoTeC i2 Pro, ATLAS, VBOX et WinTAX :

**Le curseur double** — min, max, moyenne et écart entre deux curseurs, pour quantifier une zone précise.
**Le track report côte à côte** — deux tours comparés en dégradé.
**L'animation de position synchronisée** — point mobile sur la carte lié au curseur des traces. **Essentiel pour relier la trace au lieu.**
**La superposition vidéo synchronisée** — standard professionnel, non produit par le RaceBox seul.
**Le corner report** — statistiques par section.

---

# III bis. LA RESTITUTION AU PILOTE — LECTURE PAR NIVEAUX

**Un pilote n'est pas un ingénieur de piste.** MoTeC s'adresse à des ingénieurs, Garmin ne montre rien et parle à la place du pilote. Entre les deux, il y a une place que personne n'occupe.

## La distinction qui rend l'enseignement possible

**Expliquer une mesure n'est pas prescrire un geste.**

« Cette courbe montre votre vitesse le long du tour » est un enseignement. « Freinez plus tard » est une prescription. Le premier est permis, le second appartient au coach.

C'est le vrai rôle de la nouveauté **méthode publiée**.

## Les cinq niveaux

| # | Niveau | Contenu | Apprentissage |
|---|---|---|---|
| **1** | **Ce qui s'est passé** | tracé peint par la vitesse, chrono, tours en barres | aucun — tout le monde comprend |
| **2** | **Vous contre vous** | delta cumulé entre deux de ses tours, **virages nommés sur la courbe** | **une seule notion** : la pente dit où le temps se gagne |
| **3** | **La forme** | deux traces de vitesse superposées — blanche pour le meilleur, grise pour l'autre | lire un aplatissement, un creux, une remontée |
| **4** | **L'enveloppe** | diagramme g-g, points colorés par la rampe de vitesse | rond contre diamant |
| **5** | **Le virage** | vitesse minimale et sa position, point de freinage et sa dispersion, vitesse de sortie, boîte à moustaches | territoire d'ingénieur |

**Le niveau 2 est le saut le plus rentable du produit** — c'est ce que le coach regarde en premier.

## L'ouverture

**Par la donnée, jamais par un réglage ni un abonnement.** Le delta n'a aucun sens avec un seul tour ; le g-g est vide sous une dizaine ; la dispersion par virage demande huit passages.

**Un niveau fermé reste visible, éteint, avec son compteur** : « cette lecture demande huit tours sur le même virage. Vous en avez trois. » Le pilote sait qu'il existe, pourquoi il est fermé, et ce qui l'ouvrira. C'est « pourquoi ce chiffre est absent » appliqué à une capacité entière.

**Chaque niveau porte un lien vers la méthode publiée** — « comment ça se lit », souligné, une fois. Une porte, pas un tutoriel.

## Cinq compléments retenus

**La vidéo synchronisée** — **le standard professionnel absolu, et le seul absent du produit.** Un pilote qui voit sa trajectoire et la courbe au même instant comprend en trois secondes ce qu'un graphique met dix minutes à lui apprendre. **Rendu serveur obligatoire** : `expo-video` ne garantit aucune synchronisation image-exacte.

**La lecture par virage** — le niveau 5 rempli. C'est là que vit le vrai travail, et c'est ce que le coach regarde en dernier.

**Le tour idéal** — somme des meilleurs micro-secteurs, **50 à 200 segments et non trois**. « Vous avez roulé 1:41,203 ; vos meilleurs bouts font 1:39,8 » est un fait sur soi. **Il doit dire qu'il est théorique.**

**Les conditions** — température, état de piste, heure. **Non pour corréler — ce serait causal — mais pour empêcher une comparaison de mentir.** Deux séances à quinze degrés d'écart ne se comparent pas.

**Les canaux à curseur partagé** — vitesse, accélérations, courbure, un curseur pour les trois. La vue reine des ingénieurs, au-delà du niveau 5. **Trois canaux maximum sur téléphone.**

## Deux choses écartées

**Le taux d'exploitation de l'enveloppe.** Séduisant — « vous exploitez 78 % du grip » — mais **il dépend entièrement de la qualité de l'enveloppe de référence, et le bruit gonfle les extrêmes**. Un chiffre faux fait plus de mal qu'un chiffre absent.

**Le jerk.** Fragile à 25 Hz, et sans signification pour un pilote.

---

# III ter. LES FORMES IMPORTÉES — SIXIÈME AUDIT

**Le répertoire télémétrique classique est acquis** — tracé coloré, g-g, canaux à curseur, delta, comparaison de tours. Cette section apporte des formes **nées ailleurs** et jamais appliquées au pilotage.

## Le problème central, nommé

**La même trajectoire, répétée des milliers de fois, avec des variations infimes.** Huit à douze tours par run, quatre à six runs par journée, six à vingt journées par an.

Deux familles statistiques matures traitent exactement cela.

## III ter.1 Le functional boxplot — la boîte de Tukey pour des courbes

Sun & Genton, *Journal of Computational and Graphical Statistics* 20(2):316-334, 2011.

Il ordonne les courbes du centre vers l'extérieur par **profondeur de bande**, puis affiche :

**la courbe médiane** · **l'enveloppe de la région centrale à 50 %** · **l'enveloppe maximale non atypique** · **les courbes aberrantes**, détectées par la règle de 1,5 fois la région centrale — l'analogue exact du 1,5 IQR de Tukey.

Appliqué en clinique aux **cycles de marche** — chaque courbe étant un cycle d'un enfant. C'est le même objet que huit tours de piste.

**Application** : les canaux vitesse, accélérations et courbure en base distance. **Il remplace la superposition de huit à douze courbes** par une médiane, une bande et une enveloppe, les tours atypiques signalés en valeur distincte.

## III ter.2 Le curve boxplot — pour les trajectoires elles-mêmes

Mirzargar, Whitaker & Kirby, **IEEE TVCG 20(12):2654-2663, 2014**, SCI Institute, University of Utah.

Généralisation aux courbes paramétrées dans le plan — **donc aux trajectoires**.

**Ce qu'il affiche** :

*La trajectoire la plus représentative* — « the member with the highest depth value ». **Une trajectoire réellement roulée, jamais une moyenne synthétique.** C'est la différence décisive.
*La bande à 50 %*, union des enveloppes convexes des cinquante pour cent de courbes les plus profondes.
*L'enveloppe à 100 %.*
*Les trajectoires atypiques*, en distinguant **l'écart de position** — « spatial location is far from the other members » — de **l'écart de forme** — « bearing pattern is very different ».

**Validation** : 50 trajectoires de cyclones simulées et 27 trajectoires historiques du Golfe du Mexique de 1920 à 2012, évaluées auprès d'experts du National Hurricane Center ; lignes de courant en mécanique des fluides ; tractographie cérébrale.

**Et les auteurs disent exactement notre problème** :

> « The cognitive load of direct ensemble visualization (e.g. noodle or spaghetti plots) currently prevents its deployment to the public. »

**Application** : c'est l'outil exact de la **mémoire du circuit** (IV.20 du dossier de travail) — trajectoire médiane du club, couloir à 50 %, enveloppe de tous les pilotes, **sans classer aucun pilote**.

## III ter.3 Les seuils de lisibilité, chiffrés

| Forme | Seuil |
|---|---|
| **Superposition brute (spaghetti)** | dégradation **au-delà de 20 à 30 courbes**, illisible **au-delà de 200** — Wicklin, SAS. Data-to-Viz situe la gêne dès 5 groupes |
| **Ridgeline (joyplot)** | efficace **au-delà de 5 ou 6 groupes**, là où les violons deviennent un mur |
| **Horizon graph** | 2 à 3 bandes maximum — Heer, Kong & Agrawala, CHI 2009 |

**Conséquence produit.** Les huit à douze tours d'un run passent en superposition à opacité réduite. **Au-delà — un run entier, une journée à quarante ou soixante tours — on bascule sur la bande.**

## III ter.4 Les cinq formes retenues

**1 · Functional boxplot en base distance.** Médiane, bande 50 %, enveloppe, tours atypiques. Rendu Skia : une aire plus une polyligne — trivial avec le ruban `Vertices` déjà acquis, **une seule passe**. Se lit d'emblée.

**2 · Curve boxplot pour la dispersion des trajectoires.** Le calcul de profondeur est **hors ligne, pré-calculé côté serveur** ; le rendu embarqué est une aire et une polyligne. *Réserve de coût : environ une minute pour 50 trajectoires en C++ hors ligne, jusqu'à vingt minutes en 3D. Ce n'est pas un calcul temps réel.*

**3 · Strip map — le développement linéaire du tour.** Emprunté à la cartographie technique et à l'ingénierie ferroviaire : « dérouler » le tracé fermé en un axe distance droit, en préservant la position curviligne, pour **empiler les bandes de grandeurs**. C'est la base distance déjà acquise, mais **avec le tracé lui-même comme règle graduée**. Se lit d'emblée.

**4 · Petits multiples de sparklines.** Tufte — « data-intense, design-simple, word-sized graphics », bande grise de plage habituelle, point final marqué. Une vignette par tour ou par journée. **Idéal sur 350 pt, et re-lisible sur 280 pt.** *Nommer la bande « plage observée », jamais « cible ».*

**5 · Bandes de saison — warming stripes doctrinal.** Ed Hawkins, University of Reading, 2018 : une bande par période, **aucun axe, aucune étiquette** — « all other superfluous information is removed so that the changes are seen simply and undeniably ».

**Vertu décisive pour nous : sans axe temporel continu, la forme ne ment pas sur la continuité entre journées espacées.**

**Réserve impérative** : la palette originale est **divergente bleu-rouge, donc une couleur de jugement**. La remplacer par la rampe Oklab séquentielle.

**Optionnels** : *cycle plot* pour l'évolution d'une grandeur de virage sur la saison ; *ridgeline* au-delà de cinq ou six runs ; *spiral plot* si une vue « toute la séance en un objet » est souhaitée — mais elle exige un apprentissage réel.

## III ter.5 Ce qui est écarté, et pourquoi

**Le horizon graph.** Il encode le signe positif ou négatif **par bichromie** — exactement le delta coloré et le signe que la doctrine interdit. **Aucune transformation ne le sauve.**

**Le connected scatterplot** pour l'usage courant. Haroz, Kosara & Franconeri, IEEE TVCG 22(9):2174-2186, 2016, confirment qu'il attire l'œil — mais documentent une faille décisive : sans indication du sens du temps, il « can be drastically misinterpreted […] two potential interpretations (A-E or E-A) », et les lecteurs y rapportent **moins souvent la corrélation** qu'avec une courbe simple.

**Pour un usage six fois par an, sans mémoire, ce risque est rédhibitoire.**

**La carte de contrôle et le gauge R&R.** Trouvés en qualité industrielle, mais **intrinsèquement liés à un verdict d'acceptabilité** — un %GRR supérieur à 30 % déclare un système « inacceptable ». Vidée de ses limites, la carte de contrôle se ramène au functional boxplot, déjà retenu et plus lisible.

## III ter.6 Le ressenti à côté de la mesure

La revue systématique d'Albers et al., *Journal of Patient-Reported Outcomes*, 2022 — 25 études, 789 participants — établit que les scores déclarés se comparent **d'abord aux scores antérieurs du sujet lui-même**, puis à une norme, **sans hiérarchie imposée** entre déclaré et mesuré.

Reading Turchioe et al., JAMIA, montrent que **la ligne graduée et l'analogie visuelle sont mieux comprises que les graphiques** pour restituer un ressenti : 83 % de compréhension correcte de l'analogie, et 41 % préfèrent la ligne graduée.

**Application** : le questionnaire de ressenti se place dans une **piste visuelle distincte**, registre typographique différent, **jamais sur le même axe que la mesure, jamais fusionné en un score unique**. C'est ce que fait déjà la section carnet de la page Saison, avec son fond propre.

## III ter.7 Ce qui se lit d'emblée, et ce qui s'apprend

**Décisif pour six ouvertures par an.**

| Se lit d'emblée | Exige un apprentissage |
|---|---|
| bande d'enveloppe · strip map · sparklines · bandes de saison | spirale · hodographe · connected scatterplot |

**Règle** : toute forme exigeant plus d'une phrase d'explication est reléguée en vue secondaire.

---

# IV. LA MÉTHODE DU COACH

**La partie la plus importante.** Les sources convergent — Bentley, Krause, Skip Barber, Driver61, Winfield, et les manuels MoTeC.

## IV.1 La séquence, dans l'ordre

**1 · Le delta d'abord.** Le coach ouvre le delta cumulé ou les temps de secteur pour localiser *où* le temps se perd. **Pas partout — à un ou deux endroits.** Règle documentée : *delta → vitesse → inputs*.

**2 · La trace de vitesse ensuite.** Il lit **la forme** : aplatissement en fin de ligne droite (lever prématuré), bas de courbe carré (pas de trail braking) contre crosse de hockey (trail braking présent), vitesse minimale trop basse. **Bentley obtient l'essentiel avec la seule trace de vitesse.**

**3 · Les dérivés en confirmation** — g longitudinale et latérale, rayon, diagramme g-g.

**4 · La segmentation par virage.** Il compare le tour rapide à **trois ou quatre autres tours rapides du pilote**, pas seulement au meilleur — pour éliminer le coup de chance.

## IV.2 Ce qui renseigne, ce qui est du bruit

**Signal fort** : vitesse minimale en virage — un pilote intermédiaire est typiquement **dix milles à l'heure trop lent à l'entrée**, déficit non rattrapable · pourcentage de temps à pleine charge · forme de la relance · delta par secteur.

**Bruit ou secondaire** : le régime moteur est « rarement utile comme aide au pilote » · la valeur absolue du g maximal compte moins que **la continuité des transitions** · les micro-variations dues au trafic.

## IV.3 Ce qu'il dit, et ce qu'il tait

**Priorité au gain le plus grand.** Il cible le virage qui pèse le plus au delta. Et parfois **il faut céder de la vitesse sur un petit bout pour être plus rapide sur un bout plus important** — ce qu'un affichage naïf ne dira jamais.

**Une ou deux choses par débrief. Jamais plus.**

*Exemple documenté — Bentley à Watkins Glen.* Deux consignes seulement : passer **3 % de tour de plus à pleine charge**, et **expérimenter le moment et la vitesse de relâché du frein, virages 6 à 9**. Résultat : **trois secondes de gain en une séance, sur un pilote qui tournait au même temps depuis des années.**

Et cette précision, qui est la doctrine même : *« je ne lui ai pas dit exactement quoi faire »*. Il a rendu le pilote **conscient de deux paramètres**.

**Ce qu'il tait** : les défauts secondaires, pour ne pas saturer. Il séquence sur plusieurs séances.

## IV.4 L'ordre d'acquisition — on travaille le virage à l'envers

| Étape | Compétence | Statut |
|---|---|---|
| 1 | **Vision et lecture du virage**, apex | **prérequis bloquant** |
| 2 | **Sortie** — patience au réaccélérateur, viser une sortie propre plutôt qu'une entrée rapide | — |
| 3 | **Vitesse mi-virage** consistante | — |
| 4 | **Entrée et freinage** — arriver à la bonne vitesse à la corde. D'abord freiner plus tôt, puis explorer le relâché | — |
| 5 | **Trail braking** — chevaucher freinage dégressif et rotation | **l'étape la plus avancée, en dernier** |

**On ne débloque l'entrée que si vision, apex et patience à la sortie sont acquis.**

## IV.5 Plateau contre progression — c'est mesurable

**Le pilote qui plafonne** répète les mêmes vitesses minimales et la même forme de trace. *Plus de tours ne corrige pas un plateau.*

**Le pilote qui progresse** déplace son nuage g-g vers le pourtour et réduit sa dispersion.

**C'est mesurable dans la donnée. La cause reste au coach.**

---

# V. LES SIGNATURES DU NIVEAU PROFESSIONNEL

## V.1 L'étude de référence

Hojaji, Toth, Joyce & Campbell, *AI-enabled prediction of sim racing performance using telemetry data*, **Computers in Human Behavior Reports 14 (2024) 100414**.

174 participants, **1 327 tours** à Brands Hatch, données MoTeC i2 Pro, découpage en neuf virages et dix secteurs, classification rapide contre lent. Meilleur modèle XGBoost, **97,19 % de précision**.

| Constat mesuré | Détail |
|---|---|
| **Forme du g-g** | les tours rapides **roulent autour du pourtour** du cercle de traction ; les lents vont directement du freinage maximal au virage maximal — **rond contre diamant** |
| Vitesse et g | vitesse moyenne et accélération latérale plus hautes chez les rapides |
| **Déviation de ligne** | **plus grande** chez les rapides — trajectoire plus optimisée |
| Localisation | les écarts se concentrent **en début de tour** — virages 1 à 3, notamment l'épingle exigeant un freinage seuil en ligne droite |
| Tours lents | moins de déviation de ligne, et **plus de variation de braquage** en virage — des corrections |

**Corroboration** — arXiv 2005.10044, pilote humain contre logiciel de conduite autonome : le pilote humain atteint un **g-g convexe**, avec un freinage plus agressif, un relâché plus rapide, et **1,6 seconde de roue libre en moins par zone**. Le logiciel conservateur montre un creux au coin supérieur gauche.

## V.2 Les six signatures objectives

**Diagramme g-g rond et rempli au pourtour**, transitions continues freinage → virage → relance, sans trou de roue libre.

**Transition freinage-virage** — décélération résiduelle maintenue pendant la montée en courbure ; montée en pression rapide, relâché progressif.

**Régularité** — coefficient de variation et dispersion des vitesses minimales très faibles. Les professionnels tournent **au dixième, voire au centième, tour après tour**.

**Exploitation de l'enveloppe** — temps passé près de la limite nettement supérieur.

**Vitesse minimale plus haute, et atteinte au bon endroit** — à la corde, pas avant. Réaccélération plus précoce.

**Adaptation** — moins de corrections de braquage, ligne plus stable.

## V.3 Comment un professionnel se sert de la donnée

Il regarde **où** il perd, compare à trois ou quatre de ses propres tours et à une référence, isole **une ou deux corrections**.

Il **ignore le régime moteur** comme aide directe, et **se méfie du seul meilleur tour** — biais de sélection.

Il enregistre la vidéo et **la revoit à froid**, pas dans le paddock sous adrénaline.

---

# VI. LE MODÈLE DE PROGRESSION SAISONNIÈRE

## VI.1 Ce qui progresse, ce qui trompe

| Progresse et s'exploite | Stagne ou trompe |
|---|---|
| vitesse minimale par virage, normalisée | **temps au tour brut** — dépend trop du matériel, des pneus, de la météo, du trafic |
| pourcentage de temps à pleine charge estimé | **g maximal absolu** — dépend du grip du jour |
| coefficient de variation des temps | |
| dispersion des points de freinage | |
| **remplissage du diagramme g-g** | |

## VI.2 Normaliser

**Entre circuits** — ne jamais comparer des temps bruts. Comparer des grandeurs sans dimension : coefficient de variation, taux d'exploitation, pourcentage de pleine charge.

**Entre véhicules** — normaliser par le g maximal du couple véhicule-pneu. **Comparer des formes, jamais des valeurs absolues.**

**Entre conditions** — segmenter par état de piste et température. Ne comparer qu'à conditions comparables.

## VI.3 Distinguer une vraie progression

**Suivre des médianes de séance, jamais le meilleur tour.** Une progression réelle déplace la médiane **et** réduit la dispersion — pas seulement le pic.

## VI.4 Les quatre pièges statistiques

**Échantillon insuffisant** — un seul tour ne prouve rien. Plusieurs tours propres par séance, plusieurs séances par condition.

**Régression vers la moyenne** — un record isolé tend à être suivi de tours plus lents. **Ne pas le lire comme un palier acquis.**

**Biais de sélection du meilleur tour** — le meilleur tour est en partie du bruit favorable. Suivre **médiane et MAD**.

**Effet matériel** — pneus neufs, évolution de réglage, densité d'air. Un gain peut venir du matériel. **Consigner le contexte.**

---

# VII. CE QUI EXIGE DES CAPTEURS SUPPLÉMENTAIRES

| Analyse impossible | Capteur | Apport | Coût |
|---|---|---|---|
| Papillon, régime | dongle OBD2 BLE + application tierce | lever et hésitation, timing de passage | modéré — rafraîchissement OBD limité |
| **Pression de frein, angle volant, vitesses roues, patinage** | **lecture CAN**, adaptateur et PID propres | **trail braking mesuré**, sous et survirage, blocage de roue | **élevé** — PID propres au véhicule, calibration |
| Rapport engagé | OBD ou CAN | analyse de boîte | modéré |
| Températures | OBD, CAN ou capteurs dédiés | fenêtre thermique, fiabilité | modéré à élevé |
| Angle de dérive vrai | double antenne GNSS ou capteur optique | survirage certifié | élevé |
| Charge physiologique | **ceinture cardio BLE `0x180D`** | fréquence, zones, dérive | **faible** |

**Le flux RaceBox 25 Hz reste la colonne vertébrale** — position, vitesse, g, lacet. L'OBD et le CAN ajoutent **les entrées du pilote** que le GNSS ne peut pas voir.

---

# VIII. CE QUI RESTE AU COACH — LA DOCTRINE APPLIQUÉE

**Le produit restitue des faits et ne prescrit jamais.**

Il affiche des canaux bruts **[M]** et des dérivations **[D]** clairement étiquetées, avec **« — » pour toute donnée absente, jamais un zéro**. Sans flèche, sans delta coloré, sans signe de comparaison, sans classement.

**Une estimation ne se présente jamais comme une mesure.** Sont marqués comme dérivations : angle de braquage, angle de dérive, trail braking inféré, taux d'exploitation, point de remise des gaz.

**Réservé au coach humain, et attribué [I] :**

la lecture causale — « tu perds parce que tu freines trop tôt » · la prescription — « freine dix mètres plus tard » · le jugement de niveau · la priorisation des consignes · **la décision de ce qu'on tait**.

**Le produit peut montrer que la vitesse minimale est plus basse au virage 3. Seul le coach dit pourquoi, et quoi faire.**

---

# IX. LES SEPT RECOMMANDATIONS

**1 · Construire d'abord le socle robuste.** Delta cumulé par distance · trace de vitesse · vitesse minimale par virage · points et décélérations de freinage · segmentation automatique par courbure · diagramme g-g. **Ces six éléments couvrent l'essentiel de la valeur de coaching.**

*Seuil de bascule* : ne rien ajouter tant que **l'appariement des tours par distance curviligne** n'est pas fiable.

**2 · Imposer le pipeline de filtrage** avant tout calcul. Sans lui, jerk, rayon et taux d'exploitation sont ininterprétables.

**3 · Base distance partout, étiquetage [M] / [D] / [I] partout.**

*Test de validation* : rejouer une séance connue et vérifier que **le delta cumulé se referme à zéro** sur un tour comparé à lui-même.

**4 · Structurer le débrief comme le coach.** Vue unique — delta, vitesse, carte à point mobile. **Un à deux points prioritaires par séance, jamais plus.**

**5 · Suivi saisonnier sur grandeurs normalisées seulement**, médiane et MAD, contexte consigné.

*Seuil d'alerte* : échantillon insuffisant ou conditions non comparables → **afficher « — », pas une tendance.**

**6 · Proposer l'extension OBD-CAN en option claire** pour qui veut le trail braking mesuré, le papillon et les températures. Garder le GNSS comme référence de vitesse et de position.

**7 · Ne jamais laisser le produit prescrire.** Toute lecture causale passe par un espace « note du coach », attribuée.

---

# X. ANGLES MORTS

**Non vérifié.** Le mapping des modules u-blox aux modèles RaceBox n'est pas confirmé en source primaire. Le chiffre « 10 cm / 99,5 % » est du marketing constructeur. **Aucun test indépendant chiffré RaceBox contre VBOX contre transpondeur n'a été trouvé** — les revues terrain sont qualitatives.

**Angle d'inclinaison moto** — sous-estimation d'environ 15 %, constatée sur **un seul test formel**.

**Cap à basse vitesse** — gelé sous 0,1 m/s. Tout calcul fondé sur le cap est invalide à l'arrêt et en très basse vitesse.

**Précision verticale** — deux à trois fois pire que l'horizontale. Pente et dénivelé peu fiables.

**Origine des comparaisons de niveau.** La littérature la plus quantifiée provient du **sim racing** et de la **moto**. La transposabilité aux données réelles voiture est forte sur les principes — forme du g-g, vitesse minimale, consistance — mais **les valeurs absolues diffèrent**.

**Les écoles françaises** — Winfield, Beltoise — sont documentées comme institutions, mais **leurs méthodes internes de coaching par la donnée ne sont pas publiées**. Les principes retenus viennent de Bentley, Krause, Driver61 et des manuels professionnels.
