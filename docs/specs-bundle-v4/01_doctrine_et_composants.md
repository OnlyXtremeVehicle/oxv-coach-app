# 01 — Doctrine appliquee & bibliotheque de composants

Ce fichier est reference par **toutes** les specs d'ecran. Il evite de repeter les memes
regles et les memes composants partout.

---

## A. Doctrine appliquee aux ecrans data

Trois patterns reviennent. Memorise-les : ils tranchent 90 % des decisions de design.

### Pattern 1 — Le fait, pas le verdict
On affiche **ce qui s'est passe**, jamais **ce qu'il aurait fallu faire**.
- OUI : « Votre vitesse mini en S2 : 84 km/h. »
- NON : « Vous freinez trop tot en S2. »

### Pattern 2 — Soi contre soi par defaut
La reference, c'est le pilote face a lui-meme (autre tour, autre session, autre version
de l'app). La comparaison entre pilotes existe mais est **opt-in, sans rang** (bloc 6).
- OUI : « Ce tour vs votre meilleur tour : +0,4 s. »
- NON : « Vous etes 3e sur 12 pilotes. »

### Pattern 3 — La mise en forme remplace le conseil
On differencie par la **clarte premium**, pas par la prescription. La ou RaceChrono donne un
graphe brut a interpreter seul, Mirror **raconte le fait proprement** — sans le commenter.
C'est le role de la chaine `generate-debrief-ai` : mettre en page, jamais conseiller.

### La ligne rouge absolue
Aucun ecran ne produit : score global, note de niveau, classement hierarchise, conseil
d'action, trajectoire « ideale » imposee. Si une spec semble s'en approcher, la doctrine prime.

---

## B. Bibliotheque de composants partages

Composants reutilisables, references par `[Composant: Nom]` dans les specs d'ecran.

### `AppBar`
Barre haute sobre. Titre court a gauche, action contextuelle a droite (optionnelle).
Fond `noir`. Pas de breadcrumb. Insigne OXV discret possible.

### `MetricHero`
Le composant signature du produit. **Une seule donnee centrale**, enorme, lisible a bout de
bras. Libelle humain au-dessus, valeur au centre, unite/contexte en dessous. Couleur de la
valeur selon le sens (data = `bleu_data`, jamais de rouge « alerte » qui jugerait).

### `FactRow`
Ligne « libelle → valeur ». Empilable. Pour les listes de faits secondaires sous un
`MetricHero`. Jamais d'icone de jugement (pas de feu vert/rouge).

### `ComparisonPair`
**Deux faits cote a cote, strictement symetriques.** Aucun des deux n'est marque « meilleur ».
Pas de fleche de hierarchie, pas de surbrillance « gagnant ». Usage : tour vs tour, version vs
version, vehicule vs vehicule, pilote vs pilote (opt-in).

### `TrackCanvas`
Rendu du trace (carte / forme du circuit). Sait afficher : la trajectoire **empruntee**
(jamais une « ideale »), une carte de chaleur, des marqueurs de secteur. Interactif au tap
sur un point pour reveler un fait local.

### `TimelineEvolution`
Frise temporelle « soi contre soi ». Points = sessions (ou versions d'app). Montre une
tendance factuelle sans verdict (« en hausse » est factuel ; « bon progres » ne l'est pas).

### `DataChart`
Courbe propre et epuree (vitesse, G, allure). Lisible, peu dense, une lecture a la fois.
Pas le graphe-usine de la concurrence. Axes minimaux, contexte en clair.

### `SessionCard`
Carte resumant une session pour les listes : date, circuit, meteo, 1 fait saillant. Tap →
detail. Sobre.

### `ConsentGate`
Encart de consentement explicite, reutilise partout ou de la donnee personnelle circule
(partage, comparaison, feed). Etat clair, revocable, **opt-in par defaut sur OFF**.

### `EmptyState`
Etat « pas de donnee ». Honnete, sans excuse dramatique. Explique factuellement pourquoi
(« Aucune session enregistree pour l'instant. ») et l'action possible. Voir bloc 11.

### `PactBanner`
Rappel discret de la doctrine, present aux moments cles (onboarding, premier partage).
Texte fige : « L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. »

---

## C. Conventions de spec

Chaque ecran suit ce gabarit :

- **But** — ce que le pilote vient y chercher (en une phrase).
- **Entree / sortie** — d'ou on arrive, ou on va.
- **Layout** — structure verticale, de haut en bas, en composants `[Composant: Nom]`.
- **Donnees** — ce qui est affiche et d'ou ca vient (table/calcul Supabase).
- **Doctrine** — le piege a eviter sur cet ecran precis.
- **Etat vide** — comportement si la donnee manque.

Les specs ne fixent pas les couleurs exactes ni les espacements : elles fixent la
**structure, les donnees et les regles**. Le rendu fin est a l'execution, charte respectee.
