# Bloc 20 — Coeur : restitution post-session (8 ecrans)

Reference : `01_doctrine_et_composants.md`. **C'est le coeur du produit.** Chaque ecran porte
un fait central, lisible a bout de bras, avec des gants. Aucun verdict, aucun conseil.

L'entree apres une session est **20.1 Synthese**. Les autres ecrans se deroulent depuis elle.

---

## 20.1 — Synthese de session

- **But** : la premiere chose vue apres un roulage. Donner le sentiment « je me revois »,
  proprement, sans jugement. Vitrine de la mise en forme nouvelle generation.
- **Entree / sortie** : fin de session (ou tap sur une session passee) → vers tout le bloc.
- **Layout** :
  - `[Composant: AppBar]` : date + circuit.
  - `[Composant: MetricHero]` : le fait saillant de la session (ex. « Votre tour le plus
    regulier : 1:42.8 »). **Un seul.**
  - Bandeau des 4 piliers en `[Composant: FactRow]` cliquables → 20.2 a 20.5.
  - Acces rapides : tour de reference (20.6), secteurs (20.7), trace (20.8).
  - Contexte de session (meteo/heure) en pied, discret → detail dans 30.4.
- **Donnees** : indicateurs calcules **cote Supabase** a partir de `telemetry_frames`.
- **Doctrine** : le fait saillant est descriptif, jamais une note. Pas de « bonne/mauvaise
  session ». La mise en forme generee passe le test de conformite (00_CLAUDE §1).
- **Etat vide** : `[Composant: EmptyState]` — « Cette session n'a pas encore de donnees
  exploitables. » (cas `telemetry_frames` vide).

---

## 20.2 — Signature de pilotage *(inedit marche)*

- **But** : montrer l'**empreinte personnelle** du pilote — sa maniere, ses appuis, son
  style. Ce qu'aucun concurrent ne formalise.
- **Layout** :
  - `[Composant: MetricHero]` : une lecture synthetique de la signature (representation
    visuelle de l'empreinte, pas un score).
  - `[Composant: TrackCanvas]` : ou la signature s'exprime sur le trace.
  - `[Composant: FactRow]` : traits factuels (regularite des appuis, constance des zones de
    freinage) — **decrits, jamais notes**.
- **Donnees** : profil de conduite derive des frames (cote Supabase).
- **Doctrine** : ne juge jamais si le style est « bon ». La signature est une identite, pas
  une performance a corriger.
- **Etat vide** : signature indisponible tant que pas assez de tours captes.

---

## 20.3 — Regularite / consistance

- **But** : montrer l'ecart entre les tours d'une meme session — la capacite a reproduire.
- **Layout** :
  - `[Composant: MetricHero]` : indicateur de regularite (ex. ecart-type des temps au tour,
    exprime en clair : « Vos tours tiennent dans une fourchette de 0,9 s »).
  - `[Composant: DataChart]` : temps tour par tour.
  - `[Composant: FactRow]` : tour le plus regulier, amplitude max/min.
- **Donnees** : laps (table existante) + calcul Supabase.
- **Doctrine** : pas d'objectif impose (« visez moins de 0,5 s »). On montre la fourchette,
  le pilote en tire sa conclusion.
- **Etat vide** : « Un seul tour enregistre — la regularite se mesure des deux tours. »

---

## 20.4 — Evolution personnelle (soi contre soi)

- **But** : situer cette session dans la trajectoire du pilote, dans le temps.
- **Layout** :
  - `[Composant: TimelineEvolution]` : sessions sur le meme circuit.
  - `[Composant: MetricHero]` : delta factuel vs reference perso (« +0,4 s vs votre
    meilleure session ici »).
  - `[Composant: ComparisonPair]` : cette session vs session de reference.
- **Donnees** : historique perso (Supabase). Survit aux montees de version (V2→V3→V4).
- **Doctrine** : **soi contre soi uniquement** ici. Aucun autre pilote.
- **Etat vide** : « Premiere session sur ce circuit — l'evolution apparaitra des la suivante. »

---

## 20.5 — Carte de chaleur du trace *(inedit marche)*

- **But** : montrer ou le pilote passe son temps / ou la donnee se concentre sur le circuit.
- **Layout** :
  - `[Composant: TrackCanvas]` en mode heatmap plein ecran.
  - Legende factuelle (ce que l'intensite represente).
  - Tap sur une zone → fait local (vitesse mini, temps passe).
- **Donnees** : agregation spatiale des frames (cote Supabase).
- **Doctrine** : la heatmap decrit la realite du run. Elle ne dessine **jamais** une
  trajectoire « ideale » a suivre.
- **Etat vide** : carte du trace sans donnees + message factuel.

---

## 20.6 — Le tour de reference

- **But** : exposer le meilleur tour du pilote, **decompose en faits** (pas en consignes).
- **Layout** :
  - `[Composant: MetricHero]` : temps du tour de reference.
  - `[Composant: TrackCanvas]` : la trajectoire **empruntee** sur ce tour.
  - `[Composant: FactRow]` : faits par portion (vitesses, points de passage).
- **Donnees** : meilleur tour identifie (Supabase).
- **Doctrine** : « tour de reference » = **votre** meilleur tour reel, pas un tour theorique
  optimal que l'app vous dit de viser.
- **Etat vide** : « Pas encore de tour complet enregistre. »

---

## 20.7 — Lecture par secteur (S1 / S2 / S3)

- **But** : decouper le tour en secteurs et montrer ce qui s'y est passe.
- **Layout** :
  - Selecteur de secteur (S1 / S2 / S3). Couleurs de secteur reprises de la charte du site
    (les couleurs QDI/secteurs sont figees ; ne pas en inventer — voir `00_CLAUDE.md` §3).
  - `[Composant: MetricHero]` : fait central du secteur selectionne.
  - `[Composant: FactRow]` : faits du secteur. `[Composant: ComparisonPair]` : ce secteur
    vs le meme secteur sur le tour de reference.
- **Donnees** : decoupage secteurs (cote Supabase).
- **Doctrine** : on montre ce qui s'est passe dans le secteur, **pas** ce qu'il faut y
  changer.
- **Etat vide** : secteur sans donnee → message factuel.

---

## 20.8 — Trace dynamique du tour

- **But** : rejouer la trajectoire **empruntee** (relecture), pas un ghost « ideal ».
- **Layout** :
  - `[Composant: TrackCanvas]` anime + controle de lecture (play/pause/scrub).
  - `[Composant: DataChart]` synchronise (vitesse au point courant).
- **Donnees** : frames du tour (Supabase / cache local).
- **Doctrine** : c'est une **relecture de la realite**. Pas de ligne fantome « parfaite » a
  rattraper, pas de coaching de trajectoire.
- **Etat vide** : « Pas de trace exploitable pour ce tour. »
