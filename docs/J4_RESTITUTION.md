# Jalon 4 — La restitution

**28 juillet 2026.** Branche `migration/sdk-55`. En cours.

Source : `OXV_Mirror_V3_Plan_Montage.md`, « JALON 4 — LA RESTITUTION ».
*Ce document n'est pas dans le dépôt — décision à prendre, le dépôt est public.*

---

## Le constat qui commande tout le jalon

**La banque de calculs n'a aucun consommateur.**

Sept modules — `kinematics`, `delta`, `braking`, `accel`, `gg`, `resample`,
`segment` — construits au lot T1bis, soixante-neuf tests, et **rien dans
l'application n'en importe un seul**.

Vérifié par trois angles indépendants : aucun chemin d'import ne les cite, il
n'existe pas de baril `src/telemetry/index.ts`, et aucun nom de fonction —
`computeDelta`, `detectBrakingZones`, `reachedHull`, `segmentLap`,
`resampleOnGrid` — n'apparaît hors de `src/telemetry/` et de ses tests.

Le delta cumulé, dont le test d'acceptation du jalon exige qu'il se referme à
zéro, **n'est affiché nulle part**. La courbe de delta sur laquelle le plan veut
« nommer les virages » n'existe pas.

C'est exactement ce que le nom du jalon annonce : le calcul est fait, **la
restitution ne l'est pas**. Le travail restant n'est pas de calculer mieux, il
est de montrer.

---

## Livré

### L'étiquetage [M] / [D] / [I] — phase 4sexies

`src/telemetry/provenance.ts`. Dix-huit grandeurs : quatre mesurées, onze
déduites, trois inférées.

**La frontière n'est pas la complexité du calcul, c'est ce qu'il faut
supposer.** `∫ v dt` donne une distance parce que c'est la définition d'une
distance — [D]. Le tour idéal suppose que les meilleurs secteurs sont
combinables, ce qu'aucun tour n'a réalisé — [I].

Une convention de seuil ne fait pas une inférence. Détecter un freinage sous
−0,3 g reste de l'arithmétique sur des mesures ; le seuil est un choix, et il
doit être **nommé**.

`kinematics.ts` portait déjà `Origine = 'mesure' | 'derivation'`, remplissait un
champ `origines`, **et ce champ n'était lu nulle part**. Deux niveaux sur trois,
un module sur sept, aucun consommateur.

### Le registre est armé

`ProvenanceTag` le consomme, et `TourIdealViz` le monte.

Le tour idéal s'affichait en **chiffre héros** — « TOUR IDÉAL · X SOUS VOTRE
MEILLEUR RÉEL » — et le mot « théorique » ne vivait que dans l'en-tête du
fichier. Un temps que personne n'a jamais réalisé, présenté comme la mesure
principale de la séance. Le dossier demandait pourtant « annoncé théorique ».

**Seule l'inférence s'annonce.** Étiqueter le mesuré userait l'attention et
rendrait le signal invisible quand il compte.

Une règle en découle : `peutEtreChiffreRoi` refuse toute inférence. Le tour
idéal reste affichable — il ne règne pas.

---

## Déjà conforme, vérifié plutôt que supposé

**Le delta se referme à zéro.** Le test existe depuis T1bis et cite le critère
d'acceptation, mot pour mot. Trois cas : vitesse variable, tous les pas de
grille, profil accidenté avec freinages francs.

**Les conditions sont des faits, pas des corrélations.**
`weatherCorrelationLogic` ne fait que ranger des tours mesurés dans des tranches
fixes de température et d'humidité — aucune prédiction, aucune tendance, aucun
« optimal », et `null` jamais zéro. Conforme malgré son nom.

**Six lectures sur six rendent `absent`.** Livré au lot 13 : la section entière
s'efface tant que rien n'est mesuré.

---

### Les cinq niveaux de restitution — phase 4septies

**Vous avez tranché l'axe : du moins technique au plus technique.** Le dossier
de conception a fourni la matière — sa séquence du coach, *delta → vitesse →
dérivés → segmentation par virage*, est elle-même un gradient de technicité.

| | Niveau | Ce qu'on y lit | Ce qui l'ouvre |
|---|---|---|---|
| 1 | Le chrono | Temps au tour, nombre de tours, vitesse la plus haute | Un tour chronométré |
| 2 | La régularité | Le milieu et l'étalement de vos tours | Trois tours chronométrés |
| 3 | Le delta et la trace | Où le temps se fait, et la forme de la trace — freinages compris | Deux tours de même longueur |
| 4 | Les phases du virage | Découpage droites/virages, point le plus lent, relance | La vitesse de lacet |
| 5 | L'enveloppe | Le nuage des accélérations et sa forme | Les deux accélérations |

**Ce ne sont pas des paliers, et c'est la propriété centrale.** Chaque niveau
s'ouvre sur SA condition, sans aucun égard aux autres : avec deux tours et un
gyroscope, `phases` est ouvert pendant que `regularite` est fermé. On ne peut
pas les gravir. Le test `niveaux.test.ts` en fait la démonstration et tombera
si quelqu'un les enchaîne un jour.

Le rang n'ordonne que l'affichage. Le mot « niveau » n'atteint jamais l'écran :
les titres nomment le sujet.

### Le tuyau coupé, et sa réparation

`telemetry_frames` porte `rotation_x/y/z` depuis toujours, la capture les écrit
(`captureFrameMapping`), et **les 53 trames de production les portent toutes**.
Mais aucune requête de lecture ne sélectionnait `rotation_z`.

Conséquence : `aLat`, `curvature` et tout le découpage en virages étaient nuls
par construction. `segmentLap`, recevant une courbure entièrement nulle,
rendait **un segment « droite » couvrant le tour entier**. Le niveau 4 n'aurait
jamais pu s'ouvrir — non par manque de mesure, mais par une liste de colonnes.

La conversion qui manquait porte un facteur 57,3 : la base stocke des **degrés**
par seconde, la banque attend des **radians**. Câblé tel quel, le segmenteur
aurait lu le tour entier comme un seul virage — en restant « cohérent avec
lui-même ». Le champ s'appelle donc `yawRateRadS`, et le test part d'une ligne
en degrés pour vérifier qu'un virage de 100 m rend bien 100 m.

### Ce qu'un tour n'est pas

L'unique ligne `laps` de production est un `is_outlap` de **22 millisecondes à
1,39 km/h sur zéro mètre**. Comptée, elle ouvrait le chrono et lui faisait
afficher 22 ms en chiffre roi. `estTourChronometre` écarte sorties et rentrées
de stand — voir `DETTE.md` D-14, le drapeau est ce qui sauve.

---

## Ce qui reste

| Lot | État | Ce qui bloque |
|---|---|---|
| Courbe de delta, virages nommés dessus | À faire | Le service existe ; aucun écran ne l'appelle. |
| Section des cinq niveaux à l'écran | À faire | La logique est faite et testée, le rendu non. |
| Bande — *functional boxplot* en base distance | À faire | Le rendu n'existe pas ; la logique seule serait inerte. |
| Bascule superposition → bande au-delà de 20-30 tours | À faire | Idem : sans les deux formes, la bascule ne bascule rien. |
| Les trois écrans — Bilan, Séance, Saison | À faire | La Saison absorbe le hub Data ; `data/saison` disparaît. |

### Acceptation du jalon

1. Le delta se referme à zéro — **fait**, et depuis les trames réelles.
2. Temps de rendu de la Saison au 95ᵉ centile, jamais en moyenne — appareil.
3. Mémorisation de position au retour de feuille — appareil.
4. Six lectures sur six en `absent` — **fait**.
5. Seuil réel de bascule superposition-bande, mesuré — demande les deux formes.

### Ce qu'il faut savoir avant Valence

Les 53 trames de production portent une vitesse de lacet comprise entre 0,84 et
0,90 °/s, soit ~0,015 rad/s : à 30 m/s, une courbure d'environ 0,0005 /m, très
loin du seuil d'entrée en virage. **Le niveau 4 s'affichera donc encore fermé
sur ce jeu** — cette fois légitimement, comme condition de donnée et non comme
tuyau coupé. C'est une séance à l'arrêt, pas un roulage.

Ne pas lire cet écran éteint comme le retour du défaut.
