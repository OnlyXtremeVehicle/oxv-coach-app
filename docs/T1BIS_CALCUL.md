# T1bis — Socle de calcul

**Branche `migration/sdk-55`** · 27 juillet 2026 · six modules purs, aucun écran touché

> Ce document dit ce qui est **mesuré**, ce qui est **dérivé**, et ce qui n'a pas
> pu être vérifié. Une grandeur dont l'origine n'est pas nommée n'a pas sa place
> dans un miroir.

---

## Le critère d'acceptation, et son résultat

Le plan de montage fixe un critère unique et vérifiable :

> _« Le delta cumulé **se referme à zéro** sur un tour comparé à lui-même. S'il
> ne le fait pas, le ré-échantillonnage ou l'intégration sont faux. »_

**Tenu, à 10⁻⁹ près**, et sur trois familles de profils :

| Épreuve                                                   | Résultat                          |
| --------------------------------------------------------- | --------------------------------- |
| Profil sinusoïdal, 60 s à 25 Hz                           | \|Δt\| < 10⁻⁹ s                   |
| Profil accidenté — trois freinages francs, trois relances | \|Δt\| < 10⁻⁹ s                   |
| Pas de grille 1, 2, 5, 10 et 25 m                         | \|Δt\| < 10⁻⁹ s dans les cinq cas |

Le dernier point est le plus parlant : si l'intégration était fausse, l'erreur
dépendrait du pas. Elle n'en dépend pas.

---

## Les six modules

| Module                 | Fichier                            | Ce qu'il rend                                                    |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| **Cinématique**        | `src/telemetry/kinematics.ts`      | distance curviligne, `a_long`, `a_lat`, courbure, Savitzky-Golay |
| **Ré-échantillonnage** | `src/telemetry/resample.ts`        | grille de distance commune, alignement de deux traces            |
| **Delta**              | `src/telemetry/delta.ts`           | delta-temps cumulé et instantané, tour idéal                     |
| **Segmentation**       | `src/telemetry/segment.ts`         | découpage droite/virage, sens, point de corde                    |
| **Freinage**           | `src/telemetry/braking.ts`         | zones, décélérations, dispersion                                 |
| **Sortie & adhérence** | `src/telemetry/accel.ts` · `gg.ts` | apex, relance, régularité, enveloppe atteinte                    |

**69 tests.** Suite complète : 2 020 tests, 151 suites.

---

## Sept décisions, et leurs motifs

### 1 · `a_lat = v × ω`, jamais `GForceY`

L'accéléromètre mesure la gravité **en plus** de l'accélération propre. Sur un
circuit à dévers, il lit une composante de `g` qui n'a rien à voir avec la tenue
de route. La voie gyroscopique ne voit que la rotation réelle.

**Conséquence assumée** : sans vitesse de lacet, `a_lat` vaut `null`. Le module
**ne se rabat pas** sur l'accéléromètre. Une absence honnête vaut mieux qu'une
valeur biaisée qui se lira comme une mesure.

### 2 · Courbure `1/R`, jamais le rayon

`R = v/ω` diverge en ligne droite. Un graphique de `R` est illisible, et sa
moyenne n'a aucun sens. La courbure vaut zéro en ligne droite : bornée, sommable,
seuillable.

### 3 · Le delta n'emploie pas sa forme intégrale naturelle

`∫[1/v_c − 1/v_r]dd` est juste et numériquement mauvaise : chaque terme diverge
quand sa vitesse tend vers zéro, et l'erreur explose là où les vitesses diffèrent
le plus — **c'est-à-dire exactement là où le coach regarde**. La forme retenue met
les deux vitesses au dénominateur commun.

Les points sous 1 m/s sont **écartés et comptés** (`skipped`), jamais bornés en
silence : un delta amputé qui s'annonce vaut mieux qu'un delta complet qui ment.

### 4 · L'hystérésis n'est pas un raffinement

Un seuil simple sur `|1/R|` découpe un long virage en confettis dès que la
courbure oscille autour de la coupure — et le bruit à 25 Hz l'y fait osciller.
Un test le vérifie explicitement : une courbure alternant entre 1/190 et 1/260
autour d'un seuil à 1/200 rend **un seul** virage.

### 5 · Le seuil de freinage à −0,3 g exclut le frein moteur

Une voiture qui lève le pied décélère. Sans ce seuil, des « zones de freinage »
apparaîtraient sur des lignes droites où le pilote n'a rien touché. Un test
vérifie qu'une décélération à −0,2 g **n'est pas** comptée.

### 6 · L'enveloppe est une coque convexe, pas une ellipse

Une ellipse aux moindres carrés **lisse** le nuage, donc invente un contour là où
le pilote n'est jamais allé. La coque ne passe que par des points réellement
atteints — un test le vérifie point par point.

### 7 · Médiane et MAD à côté de moyenne et écart-type

Un seul tour bloqué dans le trafic décale la moyenne et gonfle l'écart-type,
alors qu'il laisse la médiane presque intacte. Un test le montre : sur une série
portant un aberrant, la médiane reste à moins de 2 m de la vraie valeur quand la
moyenne s'en écarte de plus de 50.

---

## Le vocabulaire, qui est doctrinal

Le mot **limite** n'apparaît nulle part. La littérature dit « cercle
d'adhérence », « limite du pneu » — l'affirmer exigerait un modèle de pneu, une
masse, une charge aérodynamique et un état de piste que l'application n'a pas.

Ce qui se mesure est l'**enveloppe atteinte** : le plus loin que le pilote est
allé, ce jour-là, avec cette voiture. Une limite invite à s'en approcher ; une
enveloppe atteinte constate.

Le **trail braking** est rendu comme une **fraction de recouvrement**, jamais
comme une note. Le boîtier n'a pas de capteur de pression : on n'observe pas le
geste, seulement sa trace. _« L'attribution causale reste au coach. »_

---

## Ce qui n'a PAS été vérifié

**Aucune donnée réelle n'existe.** La production porte 53 trames et un tour de
0,022 s. Les 69 tests s'appuient donc sur des **données synthétiques** —
profils analytiques dont on connaît la réponse exacte.

C'est une force pour la justesse mathématique : sur `v = 2t`, la distance vaut
`t²`, et le test l'exige au millionième. C'est une faiblesse pour tout le reste :

- les **seuils** — 1/200 pour l'entrée en virage, −0,3 g pour le freinage, 15 m
  de longueur minimale — sont ceux du dossier, **pas des valeurs calibrées sur
  Haute Saintonge ou Valence** ;
- le **comportement sur bruit réel** de Savitzky-Golay n'est éprouvé que sur un
  bruit d'alternance artificiel ;
- la **fiabilité du taux d'exploitation** est déclarée « moyenne » sur la foi du
  dossier, non mesurée.

Ces trois points demandent une séance de télémétrie réelle. Ils sont à reprendre
au premier jeu de données exploitable, et les seuils sont tous **paramétrables**
précisément pour cela.

---

## Réserve de licence, rappelée

Les 73 points de `hauteSaintonge.ts` viennent d'**OpenStreetMap**, way 54412766,
**sous ODbL**. Toute remontée en base transporte l'obligation d'attribution.
Aucun module de T1bis ne les consomme, mais le socle de rendu les projette.
