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

### Pattern 4 — Le trace porte le fait ; la cause appartient au coach
Deux regles jumelles, nees des maquettes validees :

**(a) Le fait s'inscrit sur le trace.** La plupart des insights se posent dans un `TrackStage`,
la ou ils se produisent — faisceau de trajectoires, replay colorie, superposition a soi. On ne
lit plus un chiffre a plat pour imaginer le virage : on voit le virage, le chiffre vit dessus.
C'est ce qui rend l'app **intuitive et pratique** sans rien diriger. Montrer a un pilote ses
propres trajectoires sur le trace, c'est la fonction miroir a son sommet : comprendre sa
conduite, decider seul.

**(b) La causalite orientee vit uniquement cote coach.** Frontiere fine mais determinante :
- **Fait revele** (espace pilote, OK) : un constat descriptif, meme profond — « votre corde au
  V4 varie de 1,8 m », « vos tours les plus rapides ne sont pas vos plus agressifs ». L'app
  pose le lien observe ; le pilote en tire sa conclusion.
- **Cause a corriger** (espace coach uniquement) : designer la cause et quoi en faire — « fixe
  un repere de corde », « l'objectif est de reproduire ce S2 ». Reservee au `CoachBand`,
  attribuee a un tiers agree.

La regle de tri : si une phrase **oriente le comportement de pilotage** (designe une cause
corrigible, donne un objectif, dit « cherche / vise / adoucis »), elle n'a pas sa place cote
pilote — meme reformulee au present de l'indicatif. Reformuler un conseil en constat ne le rend
pas conforme si le contenu reste actionnable. Dans le doute : le fait reste, la cause passe au
coach ou disparait.


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

### `TrackStage` *(composant maitre — le langage commun de l'app)*
**Le trace schematique du circuit est le support central de la plupart des ecrans data.**
Un pilote pense en virages, pas en ecarts-types : le fait s'inscrit **la ou il se produit**,
sur le trace, et non a plat dans un tableau qu'il faut ensuite traduire mentalement.

`TrackStage` est un conteneur (carte `--night-card`, eyebrow mono + tag de mode) qui enveloppe
un `TrackCanvas` et impose une grammaire de modes. Modes attendus :
- **`faisceau`** — superpose N trajectoires reelles du pilote en transparence. Le faisceau qui
  s'evase (dispersion haute) ou se confond (dispersion basse) **se voit**. Usage : regularite
  spatiale par virage.
- **`replay`** — un point parcourt la trajectoire **empruntee**, coloriee par vitesse (vert
  plein gaz → bleu freinage). Synchronise a un `live-readout` (vitesse / G / temps au point
  courant) et a un controle play/scrub. Le pilote **revit** son tour.
- **`a_vs_b`** — superpose **deux tours du pilote a lui-meme** (meilleur vs dernier, version vs
  version). La zone de divergence est surlignee ; l'ecart devient **geographique**. Soi contre
  soi spatial — jamais un autre pilote ici (la comparaison inter-pilotes vit au bloc 6).
- **`heatmap`** — carte de chaleur d'agregation spatiale (ou se concentre la donnee / le temps).

Regles fermes de `TrackStage` :
- La geometrie du trace est **derivee des frames GNSS reelles**, jamais dessinee « a la main »
  comme un fait. Tant que `telemetry_frames` est vide, afficher un trace neutre + `EmptyState`.
- On affiche **la trajectoire empruntee**, jamais une trajectoire « ideale » a suivre.
- Le tap sur un point ou un virage revele un **fait local** (vitesse mini, temps passe), jamais
  une consigne.
- Couleurs le long du trait = couleurs QDI figees (voir `00_CLAUDE.md` §3), signifiantes.

### `TrackCanvas`
Le rendu bas niveau du trace, utilise **par** `TrackStage`. Dessine la forme du circuit, une ou
plusieurs polylignes (trajectoires empruntees), une heatmap, des marqueurs de secteur/virage.
Interactif au tap. Ne porte pas de chrome (titre, tag) : c'est `TrackStage` qui l'habille.

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

### `CoachBand` *(la parole du coach, separee et attribuee)*
Bandeau de lecture du coach, **toujours separe sous le `TrackStage`** (jamais fondu dans le
miroir du pilote). C'est le seul endroit du parcours pilote ou une lecture **causale orientee**
(« la cause a corriger », « l'objectif est… ») peut apparaitre — parce qu'elle est emise par un
**tiers agree que le pilote a invite**, sous sa responsabilite, pas celle d'OXV.

Structure imposee :
- Cadre distinct : fond `rgba(196,164,89,0.06)`, bordure `--oxv-gold`. Visuellement **autre**
  que les surfaces du pilote.
- En-tete : avatar du coach, nom, role (« Coach · invite par vous »), badge mono **PAROLE COACH**.
- Texte du coach. La partie prescriptive est mise en valeur en `--oxv-gold`.
- **Ancrage** : une ligne « Annotation ancree au [V4 / freinage S2 / zone S2] » qui rattache la
  parole du coach a un **point precis** du trace au-dessus. Le coach pointe le lieu exact.

Regles fermes :
- N'apparait que si un coach est lie au pilote (opt-in via `ConsentGate`). Absent sinon.
- Le contenu coach est **toujours attribue** (« Debrief de [nom] ») — jamais presente comme une
  sortie de l'app. C'est ce qui preserve le non-agrement d'OXV (voir `specs/C0_coach.md`).
- Cote pilote sans coach, l'ecran s'arrete au fait : aucune causalite orientee, aucun substitut.
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
