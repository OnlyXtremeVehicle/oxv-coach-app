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

## Ce qui reste

| Lot | État | Ce qui bloque |
|---|---|---|
| Brancher la banque de calculs aux écrans | À faire | Rien. C'est le cœur du jalon. |
| Courbe de delta, virages nommés dessus | À faire | Dépend du précédent. |
| Bande — *functional boxplot* en base distance | À faire | Le rendu n'existe pas ; la logique seule serait inerte. |
| Bascule superposition → bande au-delà de 20-30 tours | À faire | Idem : sans les deux formes, la bascule ne bascule rien. |
| Les cinq niveaux ouverts par la donnée | À faire | **Le dossier ne les nomme pas.** Aucun document du dépôt ne les définit. |
| Les trois écrans — Bilan, Séance, Saison | À faire | La Saison absorbe le hub Data ; `data/saison` disparaît. |

### Acceptation du jalon

1. Le delta se referme à zéro — **fait**.
2. Temps de rendu de la Saison au 95ᵉ centile, jamais en moyenne — appareil.
3. Mémorisation de position au retour de feuille — appareil.
4. Six lectures sur six en `absent` — **fait**.
5. Seuil réel de bascule superposition-bande, mesuré — demande les deux formes.

---

## La question ouverte

**Quels sont les cinq niveaux ?** Le plan écrit « cinq niveaux ouverts par la
donnée · un niveau fermé reste visible, éteint, avec son compteur », sans les
nommer. Le catalogue d'insights porte trois tiers — N2, N3, N4 — pas cinq. Rien
dans `docs/` ne les définit.

Je ne les invente pas. La règle d'ouverture est claire et se construira en une
séance ; la liste, elle, vous appartient.
