# Étude de design — OXV Mirror

*30/08/2026. Programme d'étude, pas encore un parti pris. Ce qu'il faut aller
regarder, pourquoi cela s'applique ici, et ce que coûte le premier pas.*

---

## Le cadre — la contrainte EST l'esthétique

Vous avez interdit les phrases sur les feuilles de données. La conséquence n'est
pas décorative : **la typographie et la disposition portent désormais tout le
sens.** Il n'y a plus de texte pour rattraper une hiérarchie ratée.

C'est une position rare, et c'est elle qui rend le sujet intéressant. Tout ce qui
suit en découle : on n'étudie pas « comment faire joli », on étudie **comment
montrer sans dire**, ce qui est une discipline vieille d'un siècle et qu'on
connaît mal.

---

# I · Les lignées à étudier

## I.1 · Bertin — la grammaire, avant tout le reste

*Sémiologie graphique*, 1967. Les huit variables visuelles, et surtout la
distinction entre celles qui sont **ordonnées** — position, taille, valeur — et
celles qui ne sont que **sélectives** — teinte, forme, orientation, grain.

**Pourquoi ici.** Votre doctrine interdit le classement, mais vous devez montrer
des grandeurs. Bertin donne le vocabulaire exact pour encoder une quantité sans
énoncer un verdict. Une variable ordonnée dit « plus » sans dire « mieux » ;
une variable sélective dit « autre » sans dire « moins ». La moitié des débats
d'écran se règlent avant d'exister avec cette seule distinction.

**Premier pas.** Reprendre les six lectures approfondies et écrire, pour chacune,
quelle variable porte la grandeur et quelle variable porte la catégorie. Une
page. Si une lecture utilise la teinte pour une grandeur, elle est fausse.

---

## I.2 · Isotype — ne jamais déformer le symbole

Otto Neurath et Gerd Arntz, 1925-1940. Leur règle tient en une phrase : **on ne
déforme jamais le symbole, on le répète.**

**Pourquoi ici.** Douze virages rendus par douze glyphes identiques qui ne varient
que par leur remplissage sont plus honnêtes — et plus beaux — que douze barres
qu'il faut lire contre un axe. C'est littéralement « montrer sans dire », inventé
il y a un siècle par des gens qui voulaient rendre des statistiques lisibles à
des ouvriers viennois.

**Premier pas.** Dessiner le tour de Bouteville en douze glyphes répétés,
comparer à la même donnée en barres. La question n'est pas laquelle est plus
jolie, c'est laquelle se lit sans légende.

---

## I.3 · Tufte — les petits multiples

La forme qui sert OXV mieux qu'aucune autre : **même échelle, pas de légende, pas
de phrase, la comparaison se fait dans l'œil.** Douze virages × trois tours =
trente-six vignettes identiques. Rien à lire.

**Pourquoi ici.** C'est la seule forme connue qui autorise une comparaison dense
sans jamais désigner un gagnant. Elle montre la dispersion sans la nommer.

**Ce qui existe déjà.** `src/features/data/saison/PetitsMultiples.tsx`. Il est
atteignable. Le point de départ est donc un audit, pas une création.

---

## I.4 · Le cockpit de verre — le problème déjà résolu

L'affichage primaire de vol a résolu votre problème le plus dur il y a quarante
ans : **de la télémétrie dense, lue d'un coup d'œil, sous stress, où une erreur
de lecture tue.**

Trois motifs transférables :

- **La bande défilante** devant un index fixe, plutôt qu'une aiguille mobile.
  L'œil retrouve la valeur au même endroit, toujours.
- **Le vecteur de tendance** — où l'on sera dans dix secondes, montré comme une
  extrapolation déclarée, jamais comme une prédiction.
- **La grammaire spatiale figée** : l'œil sait où regarder *avant* de regarder.
  Ce point vaut plus que n'importe quelle palette.

**Le contre-exemple, à connaître pour ne pas le suivre.** Les volants de F1 et
les murs des stands sont laids, et leur laideur est fonctionnelle : faits par des
ingénieurs sous règlement, pour être lus par des gens qui les connaissent par
cœur. **On copie leur hiérarchie, jamais leur allure.**

---

## I.5 · La typographie de l'instrument

C'est là que « mots-clés seuls » se gagne ou se perd.

**Non négociable : les chiffres tabulaires.** Un chrono qui tremble d'une trame à
l'autre est la chose la plus laide qu'un écran de télémétrie puisse faire.
`font-variant-numeric: tabular-nums`, partout où un nombre change.

**Le vrai exercice.** Distinguer **cinq registres** — le nombre, l'unité, le
mot-clé, l'horodatage, l'état — par la graisse, la taille, la casse et l'approche
**seules**, sans une phrase pour s'appuyer. C'est un exercice fini, faisable en
une journée, et il détermine l'allure de 178 écrans.

**À aller regarder.** FF DIN, qui est une norme industrielle et non un style ;
l'Astra de Frutiger, dessiné pour la signalétique d'aéroport ; les jeux de
chiffres de Söhne et de Helvetica Now. À confronter à votre Hanken Grotesk +
JetBrains Mono, qui ne sont pas mauvais — la question est de savoir s'ils
tiennent les cinq registres.

---

# II · Les pistes neuves

## II.1 · Les jetons de design — la piste la plus rentable

**Le fait nouveau :** la spécification du *Design Tokens Community Group* du W3C
a atteint sa **première version stable en octobre 2025**. Elle couvre les thèmes
et le multi-marque, les espaces colorimétriques modernes dont **OKLCH** et
Display P3, les alias et l'héritage entre jetons, et la génération vers iOS,
Android et web. Plus de dix outils l'implémentent.

**Pourquoi c'est exactement votre cas.** Vous avez **deux dépôts** — `oxv-app` et
`oxv-site` — et une seule identité. Sans source unique, ils divergeront, et la
divergence *deviendra* votre allure. C'est la même discipline que
`LIBELLES_DONNEES` : un nom, une source, pas de seconde copie.

**Et cela répond à la vraie cause.** 165 Ko dans un seul fichier d'écran : à cette
échelle, la beauté n'est pas un problème de palette, c'est un problème de
système. Sans inventaire, chaque écran dérive un peu, et après 178 écrans la
dérive *est* l'allure.

**Premier pas.** Auditer `src/ui/v2/tokens.ts` et le `theme` : combien de valeurs
nommées, combien de valeurs écrites en dur dans les écrans. Le rapport entre les
deux est la mesure de la dette.

---

## II.2 · Le son — un canal entièrement inexploité

**Le besoin.** Au camion, les yeux du pilote sont sur le véhicule, les mains
occupées, le paddock bruyant. Toute votre restitution est visuelle.

**La question doctrinale, qui est la partie intéressante.** Un bip au point de
freinage est une **consigne** — inacceptable. Un son continu dont la hauteur suit
votre vitesse, joué contre la hauteur de votre meilleur tour, est un **constat** :
vous entendez l'écart, personne ne vous dit quoi faire. C'est de la sonification
au sens propre, et elle épouse votre doctrine mieux qu'aucun graphique.

**Ce que valent les preuves, dit franchement.** Le champ existe et a sa conférence
(ICAD). Il y a des travaux sur les icônes auditives en conduite. Mais l'étude la
plus proche de votre cas — comparaison audio seul contre audio-visuel en aide à
la conduite, 2024 — porte sur **cinq participants**. Son résultat, l'audio seul
obtenant plus d'observance et l'audio-visuel plus de satisfaction, est une
direction, pas une preuve. **La littérature justifie d'explorer, pas de décider.**

**Premier pas, une après-midi.** Sonifier la séance de Bouteville : trois tours,
hauteur = vitesse, écoute à 1× et à 4×. Vous saurez en dix minutes si l'oreille
entend ce que l'œil rate. Prototype jetable, aucune ligne dans le dépôt.

---

## II.3 · La physicalisation des données — ce que le client emporte

**Le besoin que rien ne couvre aujourd'hui.** Une journée de piste produit un
souvenir ; aujourd'hui elle produit un écran.

C'est un champ de recherche établi — Jansen, Dragicevic, Isenberg, *Opportunities
and Challenges for Data Physicalization*, CHI 2015. Un objet fabriqué à partir de
la donnée de **cette** séance : un tracé gravé, usiné, plié, dont la géométrie est
le vrai tour, pas une illustration.

**Pourquoi c'est doctrinalement irréprochable.** Un objet montre ; il ne peut pas
conseiller. Il n'a ni verbe, ni causalité, ni classement. C'est la forme la plus
pure de votre principe.

**Ce qui existe déjà.** `app/(app2)/bilan/carte-souvenir.tsx`, et le pack
Heritage à 2 490 €. Le point de départ est un objet, pas un concept.

---

## II.4 · Le rendu à 25 Hz — une beauté qui tombe des images n'est pas une beauté

Votre pile : Skia 2.4.18, Reanimated 4.2.1.

**L'architecture qui tient**, démontrée par les bibliothèques bâties sur exactement
cette pile : **les données circulent par les SharedValues de Reanimated, et le fil
d'interface anime sans trafic de pont à chaque image.** Tout ce qui traverse le
pont vingt-cinq fois par seconde saccadera.

**La conséquence de conception, qui est la partie intéressante.** Choisissez des
formes dont le **coût est borné**. Une trace à rémanence — décroissance de
phosphore, comme un oscilloscope — est une texture redessinée. Un graphique qui
remet en page 27 000 points à chaque image ne l'est pas. Ici, le choix esthétique
et le choix de performance sont **le même choix**.

Et la rémanence est honnête en plus d'être belle : elle montre l'histoire sans
affirmer de tendance.

**Ce qui existe déjà.** `src/render/decimate.ts`, dormant. C'est la pièce.

---

# III · Deux méthodes propres à OXV

## III.1 · Le catalogue de dégradation — la beauté du partiel

La tentation sera de faire « rapide » : HUD, carbone, vitesse. **C'est la mauvaise
cible.** Ce qui vous distingue n'est pas d'avoir l'air rapide, c'est de **refuser
de conclure**. La plus belle chose que cette interface puisse faire, c'est rendre
le vide intentionnel. `SIGNATURE · 1 / 3 SÉANCES` est la thèse du produit en six
mots.

**La méthode.** Pour chacune des six lectures, dessiner la suite **0 → 1 → 2 → 3
séances**. Les écrans qui s'enrichissent à mesure que la donnée arrive. Les états
vides et partiels **dessinés en premier**, et faits les plus beaux écrans de
l'application.

**Pourquoi c'est décisif, et pas un exercice de style.** Au Mans, treize fiches
sur trente-huit resteront fermées faute de coach ; le radar n'aura qu'une séance ;
il n'y aura ni vidéo, ni acquis, ni consigne. **Si les états partiels sont beaux,
la démonstration tient. S'ils ont l'air cassés, la qualité de l'état complet ne
servira à rien — le pilote ne le verra jamais.**

Personne ne livre ça, parce que c'est invisible dans un portfolio.

---

## III.2 · Les conditions de lecture réelles

Ce que personne n'étudie et qui décidera tout : **plein soleil dans un paddock, à
bout de bras, avec des lunettes, par un œil adapté à 1 500 lux.** Puis de nuit.
Puis avec des gants, à une main, debout.

Un contraste qui passe la norme sur un bureau échoue dehors.

**Premier pas, une heure.** Afficher les écrans réels sur la tablette, sortir, et
photographier. Ce qui ne se lit pas sur la photo ne se lira pas au camion.

---

# IV · Ce que je mets de côté, et pourquoi

**La couleur**, à votre demande. Une réserve consignée une fois, sans y revenir :
votre insigne est rouge, et dans un instrument le rouge veut dire alarme. Si le
rouge est à la fois la marque et l'alerte, **l'un des deux perd — et ce sera
l'alerte**, qui est le mauvais perdant. Ce n'est pas une question de goût, c'est
un conflit fonctionnel. Le jour où vous voudrez le trancher, il tient en une
ligne : le rouge de marque ne sort jamais d'un champ de données.

---

# V · L'ordre proposé

| Rang | Piste | Coût | Avant Le Mans ? |
|---|---|---|---|
| 1 | **Jetons de design** — audit puis source unique | 2 j | oui, rend tout le reste moins cher |
| 2 | **Cinq registres typographiques** | 1 j | oui, détermine 178 écrans |
| 3 | **Catalogue de dégradation** des six lectures | 2 j | **oui, c'est ce qu'on verra au Mans** |
| 4 | **Conditions de lecture réelles** — la photo dehors | 1 h | oui |
| 5 | **Grammaire de Bertin** appliquée aux six lectures | 1 j | oui |
| 6 | **Sonification** — sonde jetable sur Bouteville | 1/2 j | sonde seulement |
| 7 | **Rendu borné** — rémanence, décimation | 2 j | si le temps le permet |
| 8 | **Objet physique** | — | après Albi |

**Une mise en garde.** « Innover » pousse à ajouter des canaux : son, lunettes,
3D, objets. **Chaque canal ajouté multiplie la surface doctrinale** — il lui faut
sa propre version de « montrer sans prescrire », ses propres états vides, sa
propre garde. Vingt-six jours avant Le Mans, quarante modules dormants à
brancher : ouvrez les jetons, faites une sonde, gardez le reste pour après Albi.

**Sur l'affichage en cabine** — la technologie Meta Display de vos instructions
projet : c'est la piste la plus risquée du lot, parce que lire une donnée à
106 km/h dans un camion est une question de **sécurité** avant d'être une question
de design. Pas avant Albi, et pas sans avoir d'abord écrit ce qu'on refuse d'y
afficher.
