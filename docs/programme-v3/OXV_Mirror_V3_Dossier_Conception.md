# OXV Mirror V3 — Dossier de conception

**26 juillet 2026** · Document de référence pour la conception et le développement
Consolide quatre audits et cinquante arbitrages.

**Ce document remplace** `OXV_Mirror_Dossier_Refonte_Design.md`, `OXV_Mirror_V3_Dossier_Maitre.md` et `_v2`.
**Il complète** `OXV_Mirror_V3_Dossier_Travail_v3.md` (doctrine, connexions, lots) et `OXV_Mirror_V3_Arbre_Pilote.md` (spécification écran par écran).

---

# SOMMAIRE

I. Ce qui a été audité · II. Identité visuelle · III. Typographie · IV. Système dimensionnel · V. Couleur · VI. Mouvement · VII. Présentation de la donnée · VIII. Les trois signatures · IX. Pile de rendu · X. Ce qu'il faut abandonner · XI. Vérifications sur appareil · XII. Angles morts

---

# I. CE QUI A ÉTÉ AUDITÉ

Quatre audits successifs, tous acquis, aucun à refaire.

| # | Audit | Ce qu'il a produit |
|---|---|---|
| 1 | **Système de design** | échelle Dynamic Type, cibles, WCAG, mode sombre, anti-décalage |
| 2 | **Pile de rendu** | Skia, Reanimated, Expo, technique du ruban `Vertices`, décimation |
| 3 | **Présentation de la donnée** | idiomes de visualisation télémétrique, chiffre roi, pages à ancres, états vides, restitution non jugeante |
| 4 | **Typographie, dimensions, innovation** | choix de fontes, grille réelle, partis pris de signature |
| 5 | **Banque télémétrique** | canaux RaceBox réels, formules, visualisations, méthode du coach, signatures du niveau professionnel — **`OXV_Mirror_V3_Banque_Telemetrie.md`** |
| 6 | **Formes importées** | représentations nées hors du pilotage — functional boxplot, curve boxplot, strip map, bandes de saison. Même document, section III ter |

**Principe de lecture** : quand deux audits divergent, le plus récent prime. Quand un audit contredit une décision d'arbitrage, l'arbitrage prime — sauf sur un fait technique vérifiable.

---

# II. IDENTITÉ VISUELLE

## II.1 Le registre

**Un instrument de mesure, pas une application de sport.** La référence n'est pas la course automobile mais **le cadran, la chronométrie, la graduation**.

Cette distinction commande tout : une display large lit comme une inscription d'instrument, une display étroite lit comme un logo de compétition. Les fontes « gaming » — Rajdhani, Chakra Petch, Orbitron — sont proscrites : elles trahissent un produit bon marché.

**Le précédent le plus proche est la Bugatti Tourbillon** : cadran analogique de facture horlogère, écran numérique caché jusqu'au besoin. Frank Heyl le formule ainsi — « the art of watchmaking meets digital detox ». Retenue, précision, donnée révélée seulement quand elle sert.

## II.2 Ce qui se transpose des constructeurs

| Marque | Ce qui se transpose | Ce qui ne se transpose pas |
|---|---|---|
| **Rimac Nevera** | G-mètre, flux de puissance, app compagnon reflétant la voiture — **le précédent le plus proche** | — |
| **McLaren** | le langage de la donnée : delta au tour, splits par secteur | le papaya orange, trop vif |
| **Bugatti Tourbillon** | la retenue horlogère, la donnée cachée jusqu'au besoin | la littéralité analogique |
| **Aston Martin** | teintes sourdes, tachymètre linéaire | — |
| **Lamborghini** | — | widgets 3D animés, registre « show » |
| **Ferrari** | le wordmark sur mesure comme principe | les fontes « Ferrari » gratuites, qui sont des imitations |

Tous ont investi dans une fonte propriétaire ou renommée, jamais décorative : Porsche Next, FF Zwo chez Bugatti, Aston Martin Sans par Dalton Maag, Lambotype par Character Type, un sans sur mesure chez Newlyn pour McLaren.

## II.3 Le « dark mode » n'est plus différenciant

Il est banalisé en 2026. **Ce qui distingue n'est pas la couleur de fond mais la matière et la retenue.**

---

# III. TYPOGRAPHIE

## III.1 Le trio retenu

| Rôle | Fonte | Portée |
|---|---|---|
| **Display de marque** | **Söhne Breit** (Klim, commercial) | ≥ 24 pt uniquement — titres, sur-titres, libellés de section |
| **Texte fonctionnel** | **SF Pro** (système Apple) | corps, légendes, listes, formulaires, boutons |
| **Chiffres mesurés** | **JetBrains Mono** | chronos, vitesses, forces G, distances, compteurs |

**Trois familles, et s'y tenir.** Une quatrième ne se justifierait que si display d'écran et logotype divergeaient — cela ajouterait du poids et un risque de dissonance.

## III.2 Pourquoi Syncopate a été écartée

Quatre motifs, dont un décisif.

**Le Latin Extended.** Les redistributions de Syncopate ne couvrent que le latin de base. Vos capitales accentuées françaises — É, È, À, Ç, Œ — sont fragiles, et elles sont partout dans l'interface.

S'y ajoutent : l'unicase, qui brouille la hiérarchie ; deux graisses seulement (400/700), sans axe variable ; aucun axe optique ; une chasse très large qui consomme l'espace horizontal sur 390 pt ; et un dessin de 2010 qui lit « rétro spatial » plutôt qu'« instrument de précision ».

## III.3 Alternatives, si le budget de licence n'est pas voté

| Fonte | Licence | Registre | Verdict |
|---|---|---|---|
| **Söhne Breit** | Klim, commercial (devis app distinct du web) | néo-grotesque large, « matérialité analogique » wayfinding | **retenue** |
| TWK Everett | Weltkern, commercial | grotesque géométrique net, excellent sur noir en grand | premier remplaçant |
| **Space Grotesk** | libre, OFL | technique, dérivé de Space Mono, chiffres tabulaires, zéro barré | **repli libre** |
| Archivo (largeur 118–125) | libre, OFL, variable | graduation d'instrument | repli libre, plus large |
| Monument Extended | Pangram Pangram, ~52,65 $/style | brutaliste ultra-large | **logotype seul**, trop typé pour l'interface |
| ABC Diatype | Dinamo, commercial | grotesque suisse neutre | correct, moins identitaire |

**Vérification impérative avant achat** : couverture Latin Extended complète, et devis de licence **application** — distinct des licences bureau et web.

## III.4 Les chiffres

**JetBrains Mono conservée en v1**, avec deux réglages obligatoires : **ligatures désactivées** (`calt` off — ce sont des ligatures de programmation) et **zéro non pointé** (le zéro pointé est un trait « terminal »).

Elle distingue nettement 0/O et 1/l/I, est libre (OFL), et ses chiffres sont tabulaires par construction — le chronomètre ne sautera pas.

**À tester sur appareil contre deux alternatives** à 56–72 pt sur `#0A0A0A` : **Berkeley Mono** (~75 $, technique et raffinée) et **Söhne Mono** (cohérente si le display est Söhne Breit). Les monospaces de code peuvent paraître grêles en très grand.

## III.5 Fontes variables

Un fichier variable pèse 100 à 200 Ko contre 400 à 800 Ko pour quatre statiques.

**Axes utiles** : `wght` pour régler finement la graisse — par exemple 680 au lieu de 700 pour un titre qui bave sur noir ; `opsz` si disponible, qui adapte fûts et espacement à la taille ; `wdth` pour condenser un chronomètre de huit caractères sur iPhone SE.

**N'embarquer que les axes réellement exploités.** Skia gère les fontes variables ; le rendu de texte n'est pas le goulet, le supersampling des shaders l'est.

## III.6 Détail typographique

| Point | Règle |
|---|---|
| **Crénage des grands chiffres** | −0,01 à −0,02 em au-delà de 40 pt ; **−0,02 em** sur un chiffre roi de 56–72 pt ; **0** en deçà de 24 pt |
| **Type de chiffres** | bâton à hauteur de capitale, **jamais elzéviriens** |
| **Séparateur décimal** | **virgule** — `1:41,203`, jamais `1:41.203` |
| **Séparateur de milliers** | **espace fine insécable** U+202F — `12 500 tr/min` |
| **Unités** | SF Pro, rapport ~0,33 du chiffre roi, espace fine insécable |
| **Signe négatif** | vrai moins U+2212, jamais le trait d'union. Jamais coloré. Alternative plus sûre : libeller l'axe — « décélération 0,8 G » |
| **Ligatures** | standard sur SF Pro, désactivées sur JetBrains Mono |

## III.7 Le français

**Espaces.** Fine insécable (U+202F) avant `;` `!` `?` `%` et comme séparateur de milliers. Insécable (U+00A0) avant `:` et dans les guillemets « ». Le degré est collé (45°), l'unité est précédée d'une insécable (25 km/h).

**À gérer en dur** — ne pas compter sur le moteur de rendu.

**Les capitales s'accentuent**, sans exception.

**Longueur des chaînes.** Le français est 15 à 20 % plus long que l'anglais, et **l'expansion est d'autant plus forte que la chaîne est courte** : le W3C, citant IBM, note que les chaînes de moins d'une dizaine de caractères peuvent croître de 100 à 200 %. Tester « Réglages », « Séances » sur 320–375 pt.

**Césure** désactivée sur les titres et le chiffre roi ; tolérée sur les légendes longues.

---

# IV. SYSTÈME DIMENSIONNEL

## IV.1 La grille

**Aucune colonne.** Cohérent avec « aucune carte, contenu sur le fond ».

| Largeur d'écran | Marge latérale |
|---|---|
| 320 à 414 pt | **20 pt** |
| au-delà de 414 pt | **24 pt** |

Par palier, jamais par calcul proportionnel continu — qui gonflerait le vide sur Pro Max sans bénéfice.

**Largeur utile** : 280 pt sur iPhone SE, 350 pt sur iPhone 14/15/16, 400 pt sur Pro Max.

Largeurs logiques à couvrir : 320 (SE 1re), 375 (SE 3e, 13 mini), 390 (14/15/16), 393 (16 Pro), 428–430 (Plus, Pro Max), 440 (16 Pro Max).

## IV.2 Le rythme vertical

**Base 8 pt, demi-pas 4 pt.** Règle « interne ≤ externe » : le remplissage ne dépasse jamais la marge.

| Espacement | Valeur |
|---|---|
| Chiffre → sa légende | 4 à 8 pt |
| Entre éléments frères | 16 pt |
| Entre sous-sections | 24 à 32 pt |
| **Entre grandes sections à ancre** | **48 à 56 pt** |
| Filet 0,5 px | 24 pt au-dessus, 16 pt en dessous |

**Interlignes** : corps 1,4 à 1,5 · titres 1,1 à 1,25. **Mesure** : 60 à 75 caractères.

Le texte étant « légende, jamais contenu », la fatigue de défilement vient de la densité de chiffres : espacer généreusement les blocs numériques.

## IV.3 Le chiffre roi

**Un seul par écran**, sans exception — sauf la Signature, où le radar est l'objet dominant et où aucun chiffre ne le concurrence.

**Chasse** : en monospace, un caractère occupe environ **0,6 × la taille**. À mesurer sur la fonte réelle avant de figer les gabarits.

| Contenu | Taille |
|---|---|
| 7 à 8 caractères — `1:41,203` | **56 pt** maximum |
| 3 à 5 caractères — `287`, `1,2 G` | 64 à 72 pt |

Calcul de contrôle : `1:41,203` = 8 glyphes → 8 × 0,6 × 64 ≈ 307 pt, tient dans 350 pt ; à 72 pt ≈ 346 pt, limite sur 390 pt et **déborde sur SE**.

**Réserve 10 %.** Repli automatique vers l'axe de largeur condensée, puis vers la taille inférieure.

**Rapports** : chiffre roi 56–64 pt · unité 18–22 pt (~0,33) · légende 12–14 pt en SF Pro `#8C8C92`.

## IV.4 Les cibles tactiles

**44 pt est un plancher Apple, pas une cible.**

| Étude | Valeur |
|---|---|
| Parhi, Karlson & Bederson (MobileHCI 2006) | 9,2 mm pour les tâches discrètes, 9,6 mm en série au pouce |
| Cockpit aéronautique (PLOS One 2024) | 21 mm minimise le temps et la charge, 18 mm minimise l'erreur |
| Kim et al., systèmes véhicule | dégradation en deçà de 22,5 mm, plateau au-delà |
| Schachner & Doyon-Poulin (IJHCI 2024) | **10,3 % d'erreur en statique contre 16,6 % sous vibration** |

**Recommandation** :

| Contexte | Cible | Espacement |
|---|---|---|
| **Flux REC** — debout, ganté, au soleil | **56 à 64 pt** | ≥ 12 pt |
| Écrans assis — Séance, Saison | 44 à 48 pt | ≥ 8 pt |

Les quatre portes de navigation en bas, atteignables au pouce sur 430–440 pt. **Aucune action critique dans le tiers supérieur.**

## IV.5 Safe areas

| Appareil | Haut | Bas | Paysage |
|---|---|---|---|
| iPhone 14 / 14 Plus | **47 pt** | 34 pt | bas 21, latéral 47 |
| Dynamic Island (14 Pro et suivants) | **59 pt** | 34 pt | bas 21, latéral 59 |

**Toujours lire les insets à l'exécution**, jamais coder en dur : 47 et 59 diffèrent, et les générations futures varieront.

**Dynamic Island** : hauteur compacte 36 px, vue étendue jusqu'à 144 pt, icônes 24 px, texte 15 pt sur interligne 22.

**Pour un écran plein porteur du tracé** : le tracé peut aller bord à bord, mais **aucun trait signifiant ni chiffre** dans les 59 pt supérieurs ni les 34 pt inférieurs.

## IV.6 L'objet identitaire — le tracé du circuit

| Propriété | Valeur |
|---|---|
| Épaisseur du tracé principal | 2 à 3 px, constante |
| Repères de secteur | 0,5 à 1 px — rapport ~3:1 |
| Largeur occupée | **70 à 80 % de la largeur utile**, centré optiquement |
| Vide autour | ≥ 24 à 32 pt |
| En filigrane derrière un chiffre | opacité 15 à 25 % |
| Proportion interne | **l'aspect réel du circuit, jamais déformé** |

**Un seul tracé par écran.**

---

# V. COULEUR

## V.1 Fond et surfaces

| Rôle | Valeur |
|---|---|
| Fond de page | `#0A0A0A` |
| Surface | `#141416` |
| Tuile | `#1E1E22` |
| Filet | `#1E1E22` |
| Bordure | `#2E2E34` |
| Texte primaire | `#FFFFFF` / `#E8E9ED` |
| Texte secondaire | `#8C8C92` |
| Texte tertiaire | `#6A6A70` |

`app.json` : splash et icône adaptative alignés sur `#0A0A0A`.

## V.2 Couleurs de marque

| Jeton | Valeur | Loi |
|---|---|---|
| Rouge de marque | `#C8102E` | insigne, bande coach, point REC, bouton central, action principale coach, liseré de section porteuse. **Jamais une donnée.** |
| Or Heritage | `#C4A459` | palier Heritage exclusivement |
| Or de performance | `#D9AE00` | tour de référence, ligne de record, repère de meilleur tour |
| Violet du record | `#8B5CF6` | célébration, remplissage bref — 4,34:1, **jamais sur du texte** |

**Règle de compensation.** Trois jetons ambre coexistent — Heritage, performance, Fluidité — et deux peuvent apparaître sur un même écran. **L'or de performance ne se distingue jamais par sa seule teinte** : trait tireté pour la courbe de référence, forme propre pour le repère de meilleur tour.

## V.3 Couleurs de données

| Branche | Valeur | Contraste |
|---|---|---|
| Trajectoire | `#60A5FA` | 6,62 |
| Fluidité | `#FFB703` | 9,64 |
| Freinage | `#E63946` | **4,04** |
| Accélération | `#4ADE80` | 9,66 |
| Régularité | `#C084FC` | 6,37 |
| Aplomb (pilier physiologique, hors radar) | `#F472B6` | 6,95 |

**Deux règles absolues.** `#E63946` est **interdit sur tout texte** — remplissages et traits seulement. Chaque branche porte **toujours** un libellé, pour la deutéranopie qui touche environ un homme sur seize.

## V.4 La rampe de vitesse

`#4F9DF7` → `#3FD0D8` → `#4FC98A` → `#F2CE3B`

**Sans or ni rouge, délibérément** : la vitesse n'est ni un record ni une alarme.

**Interpolation en Oklab**, pas en sRGB. C'est un avantage sur MoTeC et VBOX, qui emploient des rampes arc-en-ciel perceptuellement non uniformes — donc trompeuses sur les valeurs intermédiaires.

## V.5 Le contraste renforcé du flux REC

Ce n'est **pas une seconde palette** mais une restriction de la palette existante :

- le texte secondaire prend la valeur du primaire,
- le tertiaire est **interdit**,
- les filets montent d'un cran.

Mêmes couleurs, échelon supérieur.

**Motif** : en plein soleil, la luminance affichée doit dépasser la lumière réfléchie d'un facteur 2,5 minimum. Le contraste AAA (7:1) devient un plancher sur ces huit écrans.

## V.6 Ce que la couleur ne fait jamais

**Aucun delta coloré, aucune flèche, aucun signe + ou −.** Deux valeurs côte à côte, le lecteur compare lui-même.

Fondement mesuré : Cleveland & McGill (1984, *JASA*) classent la position sur échelle commune comme la première tâche perceptuelle ; leur suivi de 1986 mesure les jugements de position **1,4 à 2,5 fois plus précis que la longueur** et **1,96 fois plus précis que l'angle**. Deux colonnes alignées sur la même échelle se comparent d'elles-mêmes.

**Ajouter une couleur serait précisément le jugement interdit.**

---

# VI. MOUVEMENT

## VI.1 La table

| Transition | Durée | Courbe |
|---|---|---|
| Micro-interaction, tap | 100 à 150 ms | ease-out |
| Transition d'écran | **250 à 350 ms** | ~cubic-bezier(0.2, 0, 0, 1) |
| Morphing, transition partagée | 300 ms | ease-out appuyé |
| Compte animé du chiffre roi | 400 à 600 ms | décélération, **sans dépassement** |
| Révélation du radar | 400 ms *(abaissé de 600)* | — |
| Balayage d'aiguille | 800 ms *(maintenu)* | ressort |

**Jamais de ressort ludique.** Ce qui « se sent cher » : peu de mouvements, lents, précis.

## VI.2 Ce qui fatigue

Parallaxe permanente, animations en boucle, effet à chaque interaction. **Réserver le mouvement aux transitions d'état.**

## VI.3 Le mouvement ne ment pas

Aucune animation ne laisse croire à une mesure qui n'existe pas. Un compteur ne monte pas de zéro si la mesure n'est pas continue. Aucune célébration sur une donnée absente.

`RecordFlash` ne joue qu'une fois, sur front montant, et ne peut pas boucler.

## VI.4 Accessibilité

**Hook synchrone de réduction des animations partout.** L'ancien hook résout `AccessibilityInfo` de façon asynchrone : l'animation joue puis claque à l'état final — le pire des deux mondes. Dix composants l'ignorent aujourd'hui.

Sous « Réduire les animations » : fondu seul.

---

# VII. PRÉSENTATION DE LA DONNÉE

**Le détail exhaustif est dans `OXV_Mirror_V3_Banque_Telemetrie.md`** — les 18 canaux bruts du RaceBox, la banque de calculs avec formules et fiabilité réelle à 25 Hz, seize visualisations appariées, la méthode du coach dans son ordre, les signatures mesurables du niveau professionnel, et le modèle de progression saisonnière.

**Trois règles en sortent, qui s'appliquent partout :**

**Base distance, jamais base temps.** Toute comparaison passe par un ré-échantillonnage sur une grille de distance curviligne commune. C'est la règle la plus structurante.

**Étiquetage [M] / [D] / [I].** Fait mesuré, dérivation, interprétation. Le produit n'affiche jamais d'interprétation — elle est réservée au coach humain et lui est attribuée.

**Au-delà de 20 à 30 courbes superposées, basculer sur une bande.** Le seuil est documenté : la superposition brute se dégrade à 20-30 courbes et devient illisible à 200. Le *functional boxplot* et le *curve boxplot* la remplacent — médiane réellement observée, bande à 50 %, enveloppe, membres atypiques. Aucun jugement, aucun classement.

**Six éléments couvrent l'essentiel de la valeur de coaching** : delta cumulé par distance · trace de vitesse · vitesse minimale par virage · points et décélérations de freinage · segmentation par courbure · diagramme g-g.

## VII.1 Les idiomes du métier

| Idiome | État de l'art | Transposable ? |
|---|---|---|
| **Tracé coloré par une grandeur** | MoTeC « Track Report » à gradient · VBOX map par secteur · AiM carte GPS vitesse | **Oui — c'est l'idiome universel** |
| **Diagramme g-g** | ellipse d'adhérence, plus de G latéral que longitudinal | Oui, **décimé** |
| **Canaux à curseur partagé** | MoTeC : curseur et zoom liés entre composants · RaceChrono : graphe, carte, vidéo synchronisés | Oui, **3 canaux maximum** |
| **Comparaison de deux tours** | VBOX : vert/rouge, delta-T, tour idéal par secteurs | Oui, **sans la couleur** |
| **Évolution d'un virage** | AiM « split details » : traces superposées, nuages temps vs numéro de tour | Oui |
| **Dispersion de freinage** | **aucun outil n'a d'idiome nommé** — box plots AiM, écart-type MoTeC | **À concevoir** |

**Piège de lexique à ne pas reproduire** : la « Variance » de MoTeC i2 (touche F3) n'est **pas** une variance statistique mais un delta-temps cumulé entre deux tours.

**Seuil praticien** : ~5 m d'écart de point de freinage marque le seuil d'analyse ; 10 m et plus signale une inconsistance qui domine les données. *Heuristique de communauté, pas donnée constructeur.*

## VII.2 Ce que font tous vos concurrents, et qu'il faut éviter

**La couleur de jugement est universelle chez eux.** VBOX borde le tour rapide en vert et le lent en rouge. Apex Pro repose entièrement sur des LED vert/rouge. Garmin Catalyst interprète et livre « les trois plus grandes opportunités d'amélioration » — du coaching.

**C'est votre signature de ne pas le faire.**

## VII.3 Le chiffre roi

Fondement : Few et Tufte — maximiser le ratio donnée/encre, éliminer jauges et cadrans circulaires qui « consomment trop d'espace pour trop peu d'information ».

**Rapport de taille ≥ 3:1** entre le chiffre et sa légende. L'unité en indice discret. **La légende dit toujours ce que le chiffre montre.**

## VII.4 Le compte à rebours

**C'est le point sensible du produit.** La recherche est convergente — NN/g, le poster « anxiety » du Home Office britannique, WCAG 2.2.1 « Timing Adjustable » : un compte à rebours visible crée une pression. Netflix et BBC iPlayer offrent de désactiver le leur.

**Or vous interdisez l'urgence fabriquée.** Un compte à rebours vivant contredirait votre propre doctrine.

**Règle** : granularité **au jour** — « dans 17 jours », jamais « 16 j 23 h 14 min 02 s ». Aucune seconde qui tourne. Préférer l'orientation à la course : « votre prochaine journée : mardi 14 avril ».

## VII.5 Les pages longues à ancres

NN/g : un en-tête persistant bien fait donne l'accès rapide ; mal fait, il dégrade la satisfaction. **Le maintenir sous 10 % de la hauteur du viewport**, et sur mobile le réduire au minimum.

**Pour la page Saison, environ 2 900 lignes** :

- ancres collantes avec indication de la section courante,
- retour en haut,
- **rendu différé obligatoire** des sections non visibles,
- **mémorisation de la position au retour** de modale.

**Décision de forme** : ce qui est vu à chaque ouverture reste en flux à ancres ; ce qui est occasionnel — liste exhaustive des séances — passe en **feuille modale**.

## VII.6 Les écrans à visages multiples

L'imprévisibilité désoriente. **La structure doit rester constante, seul le contenu change.**

Pour les cinq visages de l'accueil : même ossature — sur-titre, chiffre roi, précision, action unique, second plan identique. Seuls le chiffre roi et l'action changent.

**Contexte d'usage : six ouvertures par an.** L'enjeu n'est pas l'apprentissage — impossible à cette fréquence — mais la **re-reconnaissance**. À chaque retour, l'application doit être lisible sans mémoire.

**Conséquence de test** : valider avec des utilisateurs revenus après plusieurs semaines, jamais avec des testeurs qui viennent d'apprendre l'application.

## VII.7 Les états vides

**La moitié des blocs seront vides longtemps** : 53 trames en production, aucune séance complète.

NN/g : un message d'état inexact — « aucune donnée » pendant un chargement — détruit la confiance.

**Trois moments à distinguer** :

| Moment | Traitement |
|---|---|
| Chargement | squelette à la forme exacte du contenu attendu |
| **Vide réel** | **« — » plus la raison** |
| Erreur | cause et action |

**Un squelette permanent sur une donnée jamais venue est un mensonge.**

**Concevoir une application à moitié vide sans qu'elle paraisse cassée** : garder la grille et les filets — l'ossature visible rassure ; afficher les légendes même sans valeur ; ne jamais laisser un bloc totalement nu.

**« Pourquoi ce chiffre est absent » est une fonctionnalité** : pas de fix GPS, moins de trois tours, virage non détecté sur ce circuit, véhicule différent.

## VII.8 Estimation contre mesure

**Une estimation ne se présente jamais comme une mesure.**

Forme retenue : « interruption de 2 min 14 s, **soit environ deux tours** ». La durée est mesurée, le nombre est dérivé, et le mot « environ » n'est pas une précaution de style — c'est ce qui sépare les deux registres.

## VII.9 L'interaction sur données denses

**Le curseur.** Le brevet Apple US 11 669 194 décrit un défilement à vitesse variable : la précision est liée à la vitesse et à l'amplitude du geste, non à la durée d'appui. Microsoft recommande points d'accroche et rails directionnels.

| Contrainte | Valeur |
|---|---|
| Canaux simultanés à curseur | **3 maximum** sur téléphone |
| Séparation minimale entre points sélectionnables | **~7 mm** |
| Retour visuel | **< 100 ms** — au-delà, l'utilisateur re-tape |

**À une main** : curseur avec décalage — le doigt ne masque pas la valeur —, valeur affichée en tête de section et non sous le doigt, pas de zoom pincé.
**À deux mains** : zoom pincé, sélection de plage.

---

# VIII. LES TROIS SIGNATURES

Ce qui doit rendre l'application immédiatement reconnaissable. Toutes trois faisables en Skia à 60 images par seconde.

## VIII.1 Le tracé comme objet-lumière

Vectoriel, halo doux, 2 à 3 px, décliné en widget, en icône d'application et en filigrane.

**Coût : modéré.**

## VIII.2 La donnée comme ornement

C'est le parti pris central. **L'application possède une matière que personne n'a dans ce secteur** : tracés GPS, nuages g-g, courbes de vitesse à 25 Hz.

*Le diagramme g-g traité comme une œuvre* — points fins sur noir, la densité révélant le style de pilotage, sans jugement. Un débutant produit une croix : il freine, puis il tourne. Un pilote qui progresse remplit les diagonales. **C'est visible sans qu'aucun mot ne le dise** — exactement la doctrine.

*La courbe de vitesse* en ligne unique de 2 px, colorée par la rampe Oklab. **La couleur est la donnée.**

*Le tracé du circuit* comme signature récurrente. Référence : les pochettes de disques, la cartographie, le design d'instruments.

**Coût : faible à modéré.** Skia gère les milliers de points.

## VIII.3 Grain et vignettage de profondeur

Bruit fin statique sur le fond, dégradé radial sombre. **De la profondeur sans ombre** — l'ombre ne se voit pas sur du noir.

**Coût : faible.**

## VIII.4 Optionnelles si le budget le permet

Trace télémétrique révélée au défilement, 300 ms. Live Activity du chrono du jour.

## VIII.5 Les surfaces iOS comme présence de marque

Pour un usage à six ouvertures par an, la présence **hors** de l'application compte autant que dedans.

| Surface | Contenu |
|---|---|
| **Live Activity / Dynamic Island** | pendant une journée : meilleur temps du jour, chrono en cours. Compacte 36 px, texte 15 pt, icône 24 px |
| **Widget** | tracé du circuit et chiffre roi de la dernière séance |
| **Icône d'application** | tracé ou monogramme sur `#0A0A0A` — jamais d'icône dynamique ludique |

---

# IX. PILE DE RENDU

## IX.1 Cible

| | Actuel | Cible |
|---|---|---|
| Expo SDK | 51.0.28 | **55** |
| React Native | 0.74.5 | 0.83 |
| React | 18.2.0 | 19.2 |
| Skia | 1.2.3 | 2.8.x |
| Reanimated | 3.10.1 | 4.x |
| Architecture | **ancienne** | nouvelle |

**Aucune bibliothèque de graphiques.** `d3-scale`, `d3-shape`, `d3-array` en couche mathématique sans rendu ; tout le dessin en Skia.

Motif : aucune bibliothèque ne sait dessiner un ruban de circuit peint par la vitesse ni un nuage g-g décimé. Ces rendus sont en Skia quoi qu'il arrive ; écrire les canaux dans le même idiome coûte moins que d'importer Victory Native et de désactiver ses axes, graduations et marges.

## IX.2 Le ruban coloré — technique de référence

**Skia ne possède aucun dégradé natif suivant un chemin arbitraire.** Découper le tracé en sous-chemins est à proscrire.

**Technique : API `Vertices` en mode `triangleStrip`, une couleur par sommet.**

1. **Projection** — géographique vers plan métrique local. `circuits.centerline_latlon` fournit l'origine.
2. **Décimation** — conserver un point si la distance depuis le dernier retenu dépasse **1,5 m** *ou* si le cap a varié de plus de **2°**. 30 000 trames tombent à **1 000–1 500 points par tour**.
3. **Tangente** par différence centrée sur les deux voisins ; **normale** perpendiculaire.
4. **Sommets** — deux par point, décalés d'une demi-largeur de ruban (7 à 9 points d'écran).
5. **Couleur** — rampe à quatre arrêts sur la vitesse normalisée, **interpolée en Oklab**. Les deux sommets d'un point partagent la couleur.
6. **Assemblage** — alternance A₀, B₀, A₁, B₁… en `triangleStrip`. Circuit fermé : réémettre A₀ et B₀.

**Piège.** Quand `colors` est fourni, react-native-skia mélange avec la peinture selon un mode par défaut `dstOver`. **Le poser explicitement**, ne pas fournir de shader concurrent — sinon le ruban sort gris.

**Coût** : 1 600 à 3 000 sommets, **une seule primitive de dessin par tour**.

## IX.3 Le nuage g-g

**Décimation ou agrégation en densité obligatoire.** `drawPoints` avec une peinture unique, ou `Vertices` coloré par sommet.

**Attention** : `Atlas` peut être **plus lent** que l'API `Picture` selon les cas. À mesurer, jamais à supposer.

**Cible** : 1 000 à 1 500 points après décimation.

## IX.4 Les shaders

RuntimeShader (SkSL) est pleinement exposé. **Limite documentée par Shopify : il ne tient pas compte de la densité de pixels** — supersampling requis, rendre en 3× puis réduire. Coût mémoire et images par seconde.

**Conséquence** : grain en **texture statique**, jamais en shader animé plein écran continu. Un shader animé est acceptable en transition brève.

`SkMesh` n'est **pas** exposé dans react-native-skia.

## IX.5 Le motif hybride

**90 % de vues React Native standard**, canvas Skia en composant feuille. Chaque `<Canvas>` a un coût — minimiser leur nombre, combiner les graphiques dans un même canvas.

## IX.6 Les images

**ThumbHash**, retenu contre BlurHash — bords plus nets, transparence gérée.

**Défaut prioritaire** : le chemin BlurHash existe dans le code mais **aucune colonne ne porte la valeur par photo**. Toutes les images partagent le même aplat titane. Ajouter une colonne par média, générée à l'upload — `sharp` est déjà en devDependencies.

Transformations Supabase réservées au plan Pro : cent images gratuites, puis 5 $ par millier, bornes 1–2500 px, 25 Mo, 50 Mpx.

## IX.7 Sorties déportées côté serveur

**Vidéo synchronisée.** `expo-video` ne garantit pas de décodage image-exact et n'offre aucune incrustation native fiable. **Rendu serveur par ffmpeg.**

**PDF et carte-souvenir de qualité d'impression.** `expo-print` est limité — pas d'URL d'asset local sur iOS, tout en base64 — et **l'export Skia hors écran reste en sRGB**. Génération serveur.

## IX.8 Le budget d'image

**16,66 ms par image.** Le marqueur de réglage posé au lot L3 n'a jamais été levé : **aucun budget n'est prouvé aujourd'hui**.

| Écran | Cible |
|---|---|
| Tracé coloré, en interaction | < 8 ms de rendu Skia |
| Nuage g-g, après décimation | < 10 ms — alerte au-delà de ~5 000 points dessinés |
| Canaux à curseur | **zéro nouveau rendu React par image** |

**Méthode** : Flashlight en intégration continue sur appareil réel. **Profiler la distribution des temps d'image, jamais la moyenne** — les effets de shader provoquent un throttling thermique sur les appareils anciens.

## IX.9 Écarté : le Display P3

La palette est en sRGB et close ; l'activer saturerait toutes les couleurs. De plus, **l'export d'image hors écran de Skia reste en sRGB** — une carte-souvenir en P3 est aujourd'hui impossible.

---

# X. CE QU'IL FAUT ABANDONNER

| Objet | Motif |
|---|---|
| **Syncopate** | Latin Extended incomplet, unicase, deux graisses |
| Le zéro pointé et les ligatures de JetBrains Mono | traits « terminal » |
| Le point décimal `1:41.203` | anglicisme, sur un produit qui vend la précision |
| **Glassmorphism, flou continu, néons, dégradés arc-en-ciel** | signatures 2026 déjà datées et coûteuses |
| **Cartes et ombres portées** | l'ombre ne se voit pas sur du noir |
| Les fontes « gaming » — Rajdhani, Chakra Petch, Orbitron | trahissent un produit bon marché |
| Les fontes « Ferrari » gratuites | ce sont des imitations |
| **Deltas colorés, flèches, +/−, médailles, classements** | doctrine, et gamification bon marché |
| Le compte à rebours à la seconde | pression fabriquée |
| Les jauges skeuomorphes, l'aiguille 3D | fait cheap |
| Les multi-canaux simultanés au-delà de 3 | illisible au doigt |
| Le g-g brut non décimé | tue le budget d'image |
| Le zéro à la place d'une donnée absente | valeur inventée |
| Les bibliothèques de graphiques | conventions visuelles contraires à la direction |
| Le Display P3 | dérive colorimétrique, export sRGB de toute façon |
| La couleur qui hiérarchise sans mesure | le libellé et la position suffisent |

---

# XI. VÉRIFICATIONS SUR APPAREIL

**Rien de ce qui suit ne se décide sur le papier.**

| # | À mesurer | Seuil de décision |
|---|---|---|
| 0 | **Rien du rendu identitaire n'existe** — dans les 23 fichiers Skia, `Vertices`, `Atlas`, `RuntimeEffect`, `Picture` et `useFont` totalisent **zéro occurrence** | tout est à écrire, aucun repli sur du code existant |
| 1 | **Chasse réelle de la fonte de chiffres** | si `1:41,203` dépasse 350 pt à 56 pt, condenser via `wdth` avant de réduire |
| 2 | Lisibilité du chiffre roi à 56–72 pt **au soleil** | si le secondaire est illisible, monter tout le texte informatif à ≥ 15:1 |
| 3 | JetBrains Mono contre **Berkeley Mono** et **Söhne Mono** à 56–72 pt sur `#0A0A0A` | finesse des fûts et contraste apparent |
| 4 | **Cibles gantées** avec de vrais gants | si l'erreur dépasse le statique de plus de 50 %, monter au-delà de 64 pt |
| 5 | **Budget d'image du ruban** à 1 500 points, en défilement et sous curseur | > 16,66 ms au 95ᵉ centile → optimisation avant toute nouvelle fonctionnalité |
| 6 | Supersampling des shaders sur **iPhone SE, 14 et 16 Pro Max** | chute sous 60 images/s → grain en texture statique |
| 7 | **Profondeur de défilement et mémorisation de position** sur la page Saison réelle | tout jank perceptible ou perte de position → basculer une partie en onglets |
| 8 | **Décimation du g-g** — seuil où la forme se dégrade | — |
| 9 | Précision du **curseur variable** au doigt ganté | échec à une main → curseur à précision variable, modèle brevet Apple |
| 10 | **Compréhension de la comparaison deux colonnes** sans indice de « meilleur » | si le lecteur ne comprend pas par la position, augmenter le contraste d'alignement — **jamais la couleur** |
| 11 | Rendu des **capitales accentuées françaises** dans la display retenue | — |
| 12 | Chaînes françaises sur **320 à 375 pt** — « Réglages », « Séances » | débordement → condenser via `wdth` avant de réduire |
| 13 | **Chasse tabulaire effective** après intégration de la police au build | issue expo/expo #20048 |

---

# XII. ANGLES MORTS

**Ce qui n'a pas pu être vérifié.**

La chasse « 0,6 × taille » des monospaces est une approximation d'ingénierie — **à mesurer sur la fonte réelle** avant de figer les gabarits.

Les durées d'animation (250 à 600 ms) sont des fourchettes de bonnes pratiques, à valider en test.

**Les licences** : coûts précis de Söhne Breit (Klim), TWK Everett (Weltkern) et Berkeley Mono selon le type — application, bureau, web — et le nombre d'installations. **Obtenir un devis application avant décision.**

Les seuils tactiles chiffrés (3 canaux, 7 mm, 100 ms) sont des synthèses de littérature générale.

Les signatures Rimac, McLaren et Aston Martin proviennent de pages constructeurs et de fonderies, pas de systèmes de design publiés — internes ou sous accord de confidentialité. Le nom de la fonte d'interface de Rimac n'est pas public.

**Trois faits établis le 26 juillet.** `three` (29 Mo) et `@react-three/fiber` (996 Ko) ne sont importés que par `src/circuit/CircuitTrace.tsx`, monté uniquement depuis l'arbre gelé — **trente mégaoctets supprimables sans toucher à `(app2)`**. `expo-av` n'est utilisé que pour `Audio`, dans deux fichiers, sans aucun usage vidéo — **la migration vers `expo-audio` est triviale**. Et `react-native-svg` compte **79 fichiers importateurs** : c'est la plus grande surface de migration du dépôt, loin devant Skia (23).

**Ce qui n'est pas mesuré du tout** : consommation batterie et échauffement sur vingt minutes de rendu soutenu à 60 images par seconde ; empreinte mémoire d'une saison entière en cache local ; coûts Supabase à l'échelle d'une saison.

**Et le fait qui domine tous les autres** : rien n'a jamais tourné. 53 trames, un tour de 0,022 seconde, zéro boîtier en flotte, zéro donnée cardiaque, zéro annotation de coach, zéro compte coach. **Toute affirmation de ce dossier sur le comportement réel est une lecture de code, jamais une observation.**
