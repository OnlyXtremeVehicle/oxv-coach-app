# Bloc F — Console de paddock et moteur de saillance

*Ajouté le 30/08 après la maquette. Deux surfaces console — l'écran OXV et la tablette — et le moteur qui décide de ce qu'elles montrent. Maquette de référence : artefact « Console de paddock OXV ».*

---

## F-0 · La question de l'IA, tranchée

Trois métiers se cachaient sous un seul mot.

| | Ce que c'est | Décision |
|---|---|---|
| **Calculer** | Temps par zone, dispersion, tour idéal, secteurs | Ce n'est pas de l'IA. Déterministe, hors ligne, déjà en partie fait |
| **Choisir** | Quel fait mérite l'écran | **Moteur de saillance déterministe.** Aucun modèle |
| **Rédiger** | La phrase autour du fait | **Gabarits fixes.** Aucun modèle |

**Un modèle de langage n'intervient nulle part sur le chemin de la restitution.** Il reste cantonné à « Questionner ses données » (bloc C), où il écrit une requête et ne produit aucun chiffre.

**Les cinq raisons, dont une seule est technique.** Un pilote professionnel qui rouvre le même bilan et voit une autre lecture perd confiance en dix secondes. Au camion, la 4G est mauvaise et il reste trois minutes. Un fait sélectionné par un critère peut porter son critère à l'écran, ce qui est vrai et vérifiable ; un modèle qui décide de ce qui compte commence à juger. Le classement doit être testable dans l'intégration continue, sur des fixtures. Et le moteur **est** déjà le principe n° 1 d'OXV : une zone à explorer, une zone à conserver.

**Où un modèle gagnera sa place.** Retrouver des motifs récurrents à travers cinquante séances, détecter l'anomalie qu'aucun critère n'avait prévue. À réévaluer quand le volume existera — pas avant, et la comparaison se fera contre le moteur, sur les mêmes séances.

---

## F-1 · Le moteur de saillance

`src/services/saillance.ts` — **à créer**

> **Correction du 30/08/2026, après lecture du dépôt.** Ce moteur ne choisit
> **pas** quelle lecture ouvrir : `compositionLogic` le fait déjà, sur 65 fiches
> typées, avec plafond de niveau, budget de cartes, une seule opportunité à la
> fois et un revers (`ecartees`) qui dit pourquoi chaque fiche est écartée. Ce
> moteur-ci répond à l'autre question, que le dépôt ne traite pas : **quel
> endroit du tracé regarder**.
>
> Les deux se branchent l'un sur l'autre sans se recouvrir : la saillance
> alimente `souhait` et `disponibilite`, la composition décide de la fiche. Le
> jour où les deux prétendraient trancher la même chose, c'est celui-ci qui
> cède — il est le plus jeune et le moins testé.

**Entrée.** Une séance importée : tours valides, découpage en zones, secteurs officiels, plateau si disponible, séance précédente si elle existe.

**Sortie.** Une liste ordonnée de `Fait`, chacun portant : son type, sa valeur, **le critère qui l'a fait sortir**, son rang, et son poids de confiance.

**Les six critères.**

| Critère | Mesure | Produit |
|---|---|---|
| Dispersion | Écart entre les passages du pilote dans une même zone | `zone_a_observer` |
| Stabilité | L'inverse — la zone la plus resserrée | `zone_a_conserver` |
| Écart au meilleur propre | Temps perdu par zone face à son propre meilleur passage | `potentiel_demontre` — **jamais « tour idéal »** : la garde `idealLapNonBranche` interdit l'affichage, et le catalogue des lectures a déjà tranché le nom le 26/08 |
| Écart au plateau | Position par secteur officiel, quand la source répond | `rang_secteur` |
| Nouveauté | Ce qui a changé depuis la séance précédente | `delta_seance` |
| Confiance | Qualité GPS, tours valides, fraîcheur des sources | `poids_confiance`, qui pondère tout le reste |

**Les règles du moteur.**

1. **Chaque fait porte son critère.** Un fait sans critère affichable n'est pas produit. C'est ce qui autorise le pilote à contester le classement plutôt qu'à soupçonner un avis.
2. **Les poids sont dans le code, versionnés.** Deux exécutions sur la même séance donnent le même classement, au centième près. Test de rejeu obligatoire.
3. **Les seuils ne sont pas fixés à l'avance.** À partir de quel écart une zone mérite-t-elle d'être nommée ? Cela se règle sur des données réelles, à Bouteville le 19 septembre. Jusque-là, le moteur classe sans seuil et montre le rang.
4. **La confiance déclasse.** Un fait fondé sur trois tours ne passe pas devant un fait fondé sur huit. Une source périmée sort du classement au lieu d'être affichée vieille.
5. **Toujours une zone à conserver.** Sans elle, la zone à observer devient une liste de reproches. La doctrine demande les deux ; le moteur en produit toujours deux.
6. **Le cap n'entre pas.** `heading` est nul sur 100 % des trames de production
   (26 999 sur 26 999, Bouteville, 12/08). Aucun critère ne peut s'y appuyer, et
   aucune sortie ne peut l'afficher, tant qu'il n'est pas dérivé et mesuré.
7. **Aucun connecteur.** Le moteur produit des faits, jamais des liens entre faits. Pas de *donc*, pas de *parce que* — ni dans les gabarits, ni dans l'ordre choisi.

**Acceptation.**
1. Rejeu deux fois sur la même séance : classement identique.
2. Chaque `Fait` produit a un critère non vide et un rang.
3. Une séance à un seul tour valide ne produit ni zone à observer ni zone à conserver — elle produit l'état vide qui le dit.
4. Aucun appel réseau dans le moteur.
5. **Recette sur données réelles :** le moteur tourne sur la séance de Bouteville
   `ff384ace…` (26 999 trames, trois tours) et produit une zone à observer et une
   zone à conserver. Cette séance existe depuis le 12/08 — la recette n'attend
   plus le 19 septembre.

---

## F-2 · Écran OXV — mode direct

`oxv-site : /pavillon/coach?mode=direct` — **à adapter**

**Grille.** Bandeau d'épreuve en haut · tracé sur les deux tiers gauche · colonne de droite à quatre panneaux · frise des tours et secteurs en bas.

| Zone | Contenu |
|---|---|
| Bandeau | Épreuve, circuit, séance, heure, témoin « en direct » avec le retard mesuré |
| Tracé | Pastille sur le circuit, portion parcourue du tour en cours, zone en cours nommée |
| Panneau 1 | Tour en cours, très grand, plus l'écart au meilleur |
| Panneau 2 | Meilleur tour de la séance |
| Panneau 3 | Numéro, camion, tours valides et tours écartés |
| Panneau 4 | Plateau : rang par secteur, **avec l'heure du relevé** |
| Bas gauche | Frise des tours terminés, le meilleur en évidence, l'écarté en gris |
| Bas droite | Trois secteurs officiels du dernier tour, avec leur écart |

**Règles de lisibilité.** Tout est dimensionné en unités de conteneur : la grille se lit à trois mètres quel que soit l'écran. Aucune légende. Aucun élément qui demande une explication.

**Interdits.** Rien de cet écran ne va au pilote pendant qu'il roule. Aucun tour écarté n'est masqué — une séance plus jolie et un compte faux.

---

## F-3 · Écran OXV — mode restitution

`oxv-site : /pavillon/coach?mode=restitution` — **à adapter** · bascule automatique à la fermeture de séance

| Colonne | Contenu |
|---|---|
| Gauche | Zone à observer · zone à conserver · tour idéal et son écart · frise des huit tours |
| Droite | Écart entre les tours zone par zone, classé · état du plateau · ce qui a été dit pendant la séance |

**Le tour idéal se présente comme un constat, jamais comme une cible.** La phrase est fixe : « Vous avez roulé chaque zone à ce niveau, dans des tours différents. »

**L'absence s'affiche.** Quand le plateau est indisponible, le bloc le dit et donne l'heure du décrochage. Il ne disparaît pas et n'affiche pas un rang périmé.

---

## F-4 · Tablette — régie et observation

`app/(app2)/en-direct/[sessionId].tsx` — **à réveiller, étendu**

| Colonne gauche | Colonne droite |
|---|---|
| Santé de la chaîne (4 voyants, A-4) | Quatre chiffres de focus : tour, écart, vitesse, zone |
| Mode de l'écran : automatique ou figé | Fil de la séance, saisie en bas, bascule pilote / observateur |
| **Les deux interrupteurs** : lecture du chronométrage, assistant | |
| **Affectation du boîtier** : quel camion, bascule entre les séances | |

**L'affectation du boîtier est une interface, pas une opération d'administration.** Le boîtier change de camion huit fois dans le week-end. Sans ce bouton, chaque bascule passe par la base de données.

**Les interrupteurs sont le seul endroit du produit où une action a un effet ailleurs que sur l'affichage.** C'est voulu : un dimanche, au camion, sans ordinateur, en trois secondes.

---

## F-5 · Rapport de séance — mosaïque

`app/(app2)/bilan/[sessionId].tsx` — **conservé, remplacé par la mosaïque**

**Le principe.** Toute la séance sur une page. Chaque tuile porte un fait et le critère qui l'a fait sortir. Une tuile s'agrandit sur pression et déplie son détail ; une seule ouverte à la fois.

**Les onze tuiles.** Zone à observer (double largeur) · zone à conserver (double largeur) · meilleur tour · tour idéal · secteurs officiels · plateau · intention · depuis la séance précédente · vitesse de pointe · confiance de la donnée. Les deux premières sont **classées par le moteur** ; les autres sont fixes.

**Ce qui change par rapport à la spécification A-5.** Le bloc A décrivait une première vue à trois chiffres suivie d'un défilement. La mosaïque la remplace : plus dense, et c'est ce qui a été retenu à la maquette. La règle « un seul chiffre par écran » reste vraie de l'**univers pilote** sur téléphone ; la console est un autre univers, avec ses propres jetons.

**Interaction.** Pression ou entrée au clavier ouvre la tuile ; la précédente se referme. `aria-expanded` suit l'état. La grille se réordonne en flux dense pour ne pas laisser de trou.

**Interdits.** Aucun trait, aucune flèche, aucune couleur partagée entre l'intention et la zone qu'elle désigne. Les deux tuiles se touchent ; elles ne se relient pas.

---

## F-6 · Ce qui reste ouvert

| # | Question | Qui tranche |
|---|---|---|
| 1 | Le plateau sur l'écran du paddock, qui est semi-public. La garde n'interdit que les pages publiques du site. Est-ce la bonne frontière ? | Vous |
| 2 | La vitesse de pointe : utile sur un camion bridé à 160, ou bruit ? | Le pilote, au Mans |
| 3 | Les noms des zones. L'écurie a les siens ; ce sont ceux-là qu'il faut afficher | L'écurie, le vendredi |
| 4 | Les seuils du moteur | Mesurés à Bouteville, le 19/09 |

---

## F-7 · La règle d'écriture des surfaces console

**Aucune phrase. Des mots-clés et des graphiques vivants.**

Une étiquette fait un ou deux mots — TOUR, ÉCART, VITESSE, G, DELTA, SECTEURS, ZONE, PLATEAU, OBSERVER, CONSERVER, IDÉAL, CHAÎNE, FIGER, COUPER. Tout le reste est un nombre, une barre, une courbe ou une position. Un bouton qui a besoin d'une phrase pour se faire comprendre est un mauvais bouton.

**Les graphiques vivants de l'écran, en direct.**

| Graphique | Ce qu'il montre | Source |
|---|---|---|
| Tracé et pastille | Position, portion du tour parcourue | GPS 25 Hz |
| Vitesse | Tour en cours contre le meilleur tour, superposés | GPS |
| Delta | Écart cumulé le long du tour, aire au-dessus et au-dessous de zéro | Calculé |
| Nuage G | Accélérations latérales et longitudinales, trois cents derniers points | IMU |
| Tours | Barres des tours terminés, meilleur en évidence, écarté en gris | Calculé |
| Secteurs | Trois barres et leur écart | Secteurs officiels |

**Rien d'inventé.** Le boîtier donne la position, la vitesse et les accélérations. Pas de gaz, pas de frein, pas de régime : aucune de ces courbes n'existe, donc aucune ne s'affiche. Un développeur tenté de compléter le tableau doit s'arrêter ici.

**Les trois exceptions, nommées plutôt que contournées.**

1. **Les mots du pilote.** Un verbatim réduit à des mots-clés n'est plus un verbatim, et la preuve P-4 repose sur ce qu'il dit tel qu'il le dit. Le fil de notes garde ses phrases : c'est une zone de saisie, pas d'affichage.
2. **Le critère du moteur.** « RANG 1/8 » suffit sur l'écran. Dans le rapport, à quarante centimètres, le critère complet reste lisible — il vit dans le détail de la tuile, ouvert à la demande. C'est lui qui distingue un fait sélectionné d'un avis.
3. **Les horodatages.** « 14:49 », « DEPUIS 15:01 ». Ce ne sont pas des phrases, et sans eux un chiffre périmé passe pour un chiffre courant.

**Garde `ecranSansPhrase`.** Sur les surfaces console, aucune chaîne affichée ne dépasse trois mots, hors verbatim et horodatage. Le test lit les chaînes du paquet livré, pas les intentions. Les exceptions sont listées, justifiées et datées, comme celles de `deuxEntrees`.

**Conséquence sur le rapport.** La face d'une tuile porte un mot-clé, un nombre et un micro-graphique. Les phrases n'existent que dans le détail déplié — la seule place où une explication ne bloque pas la lecture.
