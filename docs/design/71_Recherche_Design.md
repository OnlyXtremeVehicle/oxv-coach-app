# Recherche de design — résultats

*30/08/2026. Quatre axes ouverts par vos réponses : registre instrument +
horlogerie + cockpit · tablette au camion · sonification de l'écart et de la
chaîne · typographie rouverte. Ce qui suit est mesuré ou sourcé ; ce qui ne l'est
pas est signalé comme tel.*

---

# 1 · La tablette au camion — trois nombres qui changent tout

## 1.1 · La taille minimale se calcule, elle ne se choisit pas

`ISO 9241-303` fixe la hauteur de capitale en **minutes d'arc** : plancher à
**16′**, cible **20 à 22′** pour un affichage à usage soutenu. La conversion est
géométrique :

> hauteur de capitale (mm) = distance (mm) × arcmin ÷ 3437,75

À **600 mm** — bras tendu, debout, au camion — sur une tablette à 264 ppi :

| Cible | Capitale | Corps équivalent |
|---|---|---|
| 16′ — plancher | 2,79 mm | **~21 pt** |
| 20′ | 3,49 mm | **~26 pt** |
| **22′ — cible ISO** | **3,84 mm** | **~29 pt** |
| 25′ — conditions dégradées | 4,36 mm | ~32 pt |
| 30′ — soleil, gants, hâte | 5,24 mm | ~39 pt |

**Conséquence, brutale : rien sur cette tablette ne descend sous 21 pt, et tout
ce qui doit être lu de façon fiable est à 29 pt.** Un pilote qui recule d'une
main, à 700 mm, monte la cible à 33 pt.

Je parie que la maquette de console actuelle est très en dessous. C'est
vérifiable en une minute et c'est le premier chiffre à corriger.

## 1.2 · En plein soleil, aucune tablette grand public n'est lisible

Ordres de grandeur : bureau 300-500 lux · ciel couvert 1 000-5 000 lux ·
**soleil direct 30 000 à 100 000 lux**.

Luminance nécessaire : intérieur 200-400 nits · mi-ombre 400-1 000 nits ·
**soleil direct 1 500 à 5 000 nits**. Une tablette grand public plafonne autour
de 500-600 nits en usage courant.

**Ce n'est donc pas un problème de design.** Aucune mise en page ne rattrape un
facteur trois. Trois issues, à décider avant Le Mans :

1. **Travailler à l'ombre** — dans l'ombre du camion, sous l'auvent. Gratuit, et
   c'est ce qui se passera de toute façon.
2. **Une casquette pare-soleil** sur la tablette. Quelques dizaines d'euros.
3. **Une tablette durcie lisible au soleil** (1 000+ nits). Plusieurs centaines.

Et un fait utile : *diviser la réflexion par deux vaut autant que doubler les
nits*. Donc **verre mat, traitement antireflet, et surtout pas de film de
protection brillant** — celui-ci coûte plus qu'il ne protège.

## 1.3 · Le fond sombre n'est pas disqualifié — mais il se paie en taille

Je m'attendais à devoir vous demander d'abandonner le fond sombre. **La
littérature dit autre chose, et plus finement.**

- **Piepenbrock et al., 2013 (*Ergonomics*)** : la polarité positive — noir sur
  blanc — est meilleure pour l'acuité visuelle et la relecture, à tout âge. Et
  **l'avantage grandit à mesure que le texte rapetisse.**
- **Dobres et al., 2017 (MIT, *Applied Ergonomics*)** : **de jour, en forte
  lumière ambiante, aucun effet significatif de la polarité.** De nuit, la
  polarité positive redevient meilleure.
- **Legge, 1985** : les personnes à milieux oculaires troubles — cataracte —
  lisent mieux sur fond sombre.

**Lecture pour OXV.** Le fond sombre tient : c'est votre identité, il est juste
dans la cabine et de nuit, et de jour la polarité ne décide rien. Mais les deux
résultats convergent vers la même consigne, énoncée deux fois : **l'avantage du
clair croît quand le texte rapetisse, et le plancher angulaire monte en
conditions dégradées.** Le problème n'est pas la polarité, **c'est la taille.**

Vous gardez le noir. Vous le payez en corps.

---

# 2 · La typographie — cinq critères qui éliminent presque tout

Vous avez rouvert la question. Voici les critères, et deux d'entre eux ne sont
pas négociables.

## 2.1 · L'illusion d'irradiation, et sa correction sans décalage

Un texte clair sur fond sombre **paraît plus gras** qu'un texte sombre sur fond
clair, à graisse identique. C'est l'illusion d'irradiation, et sur un fond
`#14151A` elle est permanente.

La correction naïve — baisser `font-weight` en thème sombre — **change les
chasses et décale la mise en page**. Sur un écran de télémétrie où un chrono doit
rester à la même place d'une trame à l'autre, c'est disqualifiant.

La correction juste : **l'axe `GRAD`** d'une fonte variable. Il modifie la
graisse *apparente* sans toucher aux chasses. Aucun décalage.

**Premier critère, éliminatoire : la fonte doit être variable et porter un axe
`GRAD`.**

## 2.2 · Les cinq critères

1. **Axe `GRAD`** — corrige l'irradiation sans décalage. *Éliminatoire.*
2. **Chiffres tabulaires** — un chrono qui tremble est la pire laideur possible
   sur cet écran. *Éliminatoire.*
3. **Axe `opsz` (taille optique)** — vos cinq registres vont de ~14 pt à ~72 pt.
   Une fonte sans taille optique sera trop maigre en grand ou trop serrée en
   petit. *Fortement souhaitable.*
4. **Désambiguïsation** — `0`/`O`, `1`/`l`/`I`, `5`/`S`, `6`/`8` distincts à
   petit corps sur fond sombre. C'est une exigence d'instrument, pas de goût.
5. **Unité des registres** — si le mot-clé et le nombre viennent de deux familles
   différentes, il faut que leurs chiffres aient la même chasse, sinon les
   colonnes ne s'alignent pas.

## 2.3 · Les candidats, et pourquoi

| Fonte | `GRAD` | `opsz` | Notes |
|---|---|---|---|
| **Roboto Flex** | **oui** | **oui** | Gratuite, treize axes, le seul candidat gratuit qui coche 1 et 3. Le défaut : c'est du Roboto — reconnaissable, donc sans caractère propre |
| **Recursive** | non | non | Mais un axe `MONO` continu : **une seule famille couvre le sans et le monospace**. Répond au critère 5 mieux qu'aucune autre |
| **Helvetica Now Variable** | non | oui | Trois tailles optiques dessinées, jeu de chiffres exemplaire. Payante |
| **Söhne** | non | non | Très juste de ton — la grotesque suisse sèche que votre registre appelle. Mais pas variable |
| **FF DIN** | non | non | Une norme industrielle, pas un style. Le bon signifié, le mauvais outil technique |
| **Hanken Grotesk** (actuelle) | non | non | À vérifier sur les critères 2, 4 et 5 avant de la garder |

**Le vrai arbitrage se dessine.** Aucune fonte ne coche tout. Deux voies :

- **Roboto Flex partout** — technique irréprochable, caractère faible. On
  compense le caractère par la mise en page et l'insigne.
- **Une paire assumée** — une grotesque de caractère pour les mots-clés, et une
  fonte à `GRAD` réservée aux nombres. On perd l'unité, on gagne le ton, et il
  faut faire coïncider les chasses de chiffres.

Je penche pour la seconde, parce que dans votre registre **le nombre et le
mot-clé ne jouent pas le même rôle** — l'un est la mesure, l'autre est
l'étiquette. Les distinguer par la fonte est honnête. Mais c'est un arbitrage,
pas un fait.

---

# 3 · La sonification — la résolution audible se calcule aussi

## 3.1 · L'écart à soi-même : le timbre décide de ce qu'on entend

Deux voix simultanées ne s'entendent comme **deux** que si elles se séparent
assez. Une étude de 2021 donne les seuils, autour d'un son de référence à 250 Hz :

- **À timbre identique**, la frontière fusion/fission s'étend de **2,4 demi-tons
  en dessous à 1,4 au-dessus**. En deçà, les deux voix fusionnent en une seule.
- **Avec une différence de timbre** (pente spectrale de ±1 dB/octave), la
  frontière tombe à **0,9 et 0,5 demi-ton** — les plages de fusion sont
  **divisées par deux**.

Hauteur et timbre agissent **ensemble** : chacun rend l'autre plus efficace.

**Traduit en km/h**, pour un mappage vitesse → hauteur :

| Timbres | Plage mappée | Écart audible |
|---|---|---|
| identiques | 110 km/h sur 1 octave | **17,4 km/h** |
| identiques | 110 km/h sur 2 octaves | 8,7 km/h |
| **distincts** | 110 km/h sur 1 octave | **6,4 km/h** |
| **distincts** | 110 km/h sur 2 octaves | **3,2 km/h** |
| distincts | 40 km/h sur 1 octave | 2,3 km/h |

**La règle de conception qui en sort, et elle est décisive :** si vous sonifiez
votre tour et votre meilleur tour **avec le même timbre**, vous n'entendrez que
les écarts de 17 km/h — c'est-à-dire ceux que l'œil voyait déjà. **Le son
n'apportera rien.** Donnez aux deux voix des timbres différents et vous entendez
un écart trois fois plus fin.

Et c'est doctrinalement juste : la différence de timbre est ce qui rend la
référence *identifiable comme référence*. C'est l'équivalent auditif du fantôme
dessiné autrement.

## 3.2 · La santé de la chaîne : le silence doit vouloir dire panne

Autre problème, autre règle. Ce son doit être **ignorable quand tout va bien** et
**remarquable quand ça change** — c'est une texture continue, pas un événement.

La faute à ne pas commettre : faire du silence l'état normal. Un état normal
silencieux et une panne silencieuse sont indiscernables, et vous serez seul au
Mans, la tablette dans une main.

**Le silence doit signifier la panne.** Un grain continu dont la densité suit la
cadence des trames : plein = 25 Hz, clairsemé = trames perdues, **muet =
boîtier mort**. On l'oublie en trente secondes et on remarque son absence
immédiatement.

## 3.3 · La sonde, une après-midi

Séance de Bouteville, trois tours, hors du dépôt, jetable :
tour 2 (meilleur) en voix de référence, tour 1 en voix courante, timbres
distincts, mappage 110 km/h sur deux octaves. Écoute à 1× puis à 4×. Vous saurez
en dix minutes si l'oreille entend ce que l'œil rate.

---

# 4 · Le registre — ce que les trois ont en commun, et où ils divergent

Vous avez retenu **l'instrument scientifique, l'horlogerie et le cockpit**, et
écarté l'édition cartographique. C'est cohérent : les trois retenus sont des
objets **lus d'un coup d'œil**, le quatrième est un objet qu'on lit assis.

## 4.1 · Les quatre principes communs

1. **La valeur est séparée de l'échelle.** Le cadran est fixe, l'aiguille bouge.
   La bande défile, l'index reste. **Jamais les deux en mouvement.**
2. **La grammaire spatiale est figée et apprise une fois.** L'œil sait où
   regarder avant de regarder. Ce point vaut plus que n'importe quelle palette —
   et il interdit les mises en page qui se réorganisent selon le contenu.
3. **La hiérarchie est physique, pas chromatique.** Taille, graisse, position.
   Un instrument reste lisible en photocopie noir et blanc ; c'est un bon test.
4. **On regarde, on ne lit pas.** Ce qui valide votre règle des mots-clés par un
   autre chemin que la doctrine.

## 4.2 · Le point où ils divergent, et il est déjà tranché

Le **cockpit** veut tout visible en même temps. L'**horlogerie** veut l'essentiel
visible et le reste révélé.

Votre §00 a déjà choisi : *« un toucher ouvre l'animation ; un second ouvre les
traces et la méthode »*. C'est la réponse horlogère. **Le cockpit ne vous apporte
donc que sa grammaire spatiale, pas sa densité.** Ne l'importez pas entière : un
écran de paddock qui ressemble à un affichage primaire de vol serait une citation,
pas une conception.

## 4.3 · Ce que l'instrument scientifique apporte en propre

La **rémanence**. Un oscilloscope ne montre pas un point, il montre une trace qui
s'efface. C'est beau, et c'est honnête : cela montre l'histoire **sans affirmer
de tendance** — exactement ce que votre interdit de causalité demande.

Et le coût de rendu est borné : une texture redessinée, pas 27 000 points remis
en page. **Ici le choix esthétique et le choix de performance sont le même
choix.** `src/render/decimate.ts` existe, dormant.

---

# 5 · Ce que je ferais dans l'ordre

| # | Geste | Coût | Pourquoi maintenant |
|---|---|---|---|
| 1 | **Mesurer les corps de la maquette** contre les 21 / 29 pt | 1 h | Si l'écart est celui que je crois, tout le reste attend |
| 2 | **Décider de la protection solaire** — ombre, casquette ou tablette durcie | 1 h | C'est du matériel, avec un délai de livraison |
| 3 | **Trancher la fonte** sur les cinq critères | 1 j | Fige 178 écrans, ne se refait pas |
| 4 | **La sonde de sonification** sur Bouteville | 1/2 j | Jetable, et la réponse est binaire |
| 5 | **La rémanence** sur la trace en direct | 2 j | Esthétique et performance d'un seul geste |

---

## Sources

Polarité et lisibilité : Piepenbrock et al. 2013 (*Ergonomics*), Dobres et al.
2017 (*Applied Ergonomics*), Legge 1985 — via la synthèse du Nielsen Norman
Group. Taille angulaire : `ISO 9241-303:2011`, plancher 16′, cible 20-22′.
Irradiation et axe `GRAD` : technique documentée pour fonte variable.
Séparation auditive : *The Impact of Pitch and Timbre Cues on Auditory Grouping
and Stream Segregation*, Frontiers in Neuroscience, 2021.
Luminance : ordres de grandeur d'affichage industriel lisible au soleil.
