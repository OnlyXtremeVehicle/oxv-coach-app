# Bloc 90 — Fonctionnalites neuves (4 ecrans)

Reference : `01_doctrine_et_composants.md`. Des fonctions que la concurrence n'assume pas,
toutes dans la doctrine.

---

## 90.1 — Journal de bord pilote

- **But** : laisser le pilote consigner **ses** notes post-session — avec **ses** mots.
- **Layout** :
  - Entree par session : champ libre, horodate.
  - Liste chronologique des notes, rattachees aux sessions.
  - Possibilite de relire une note a cote de la restitution de la session (renvoi 40.2).
- **Donnees** : notes perso liees aux sessions (Supabase, privees par defaut).
- **Doctrine** : **point cle** — ce sont les mots du **pilote**, jamais ceux de l'app.
  L'app **ne suggere pas** de contenu de note, ne « pre-remplit » pas avec un conseil. Elle
  fournit l'espace, le pilote ecrit.
- **Etat vide** : « Aucune note pour cette session. Cet espace est a vous. »

---

## 90.2 — Conditions & ressenti

- **But** : croiser les conditions **factuelles** (meteo/asphalte/heure) avec le **ressenti
  declare** par le pilote.
- **Layout** :
  - Rappel des conditions factuelles (renvoi 30.4).
  - Saisie du ressenti par le pilote (echelle ou texte libre — **declaratif**, c'est sa
    parole).
  - Mise en regard : conditions vs ressenti, cote a cote, sans conclusion automatique.
- **Donnees** : `weather_snapshots` (factuel) + ressenti saisi (declaratif), Supabase.
- **Doctrine** : on **juxtapose** des faits et une parole. L'app **ne correle pas** a la
  place du pilote (« par temps froid vous etes moins regulier » = interdit). Le pilote relie
  s'il le souhaite.
- **Etat vide** : « Ajoutez votre ressenti pour cette session. »

---

## 90.3 — Carnet de circuits (passeport)

- **But** : la collection des circuits roules — un « passeport » du pilote.
- **Layout** :
  - Grille des circuits roules (vignettes `[Composant: TrackCanvas]`), facon collection.
  - `[Composant: FactRow]` : nb de circuits, regions, premiere/derniere visite.
  - Tap → detail circuit (50.2).
- **Donnees** : circuits distincts roules par le pilote (Supabase).
- **Doctrine** : **collection, pas classement.** On ne note pas les circuits, on ne range pas
  le pilote par rapport aux autres. C'est un carnet de voyage factuel.
- **Etat vide** : « Votre carnet se remplira au fil de vos circuits. »

---

## 90.4 — Export & souverainete data

- **But** : permettre au pilote de **recuperer SA donnee brute**. Argument anti-lock-in fort,
  que la concurrence n'assume pas franchement.
- **Layout** :
  - Choix du perimetre (une session, une periode, tout).
  - Format(s) d'export factuels (ex. CSV des frames / laps).
  - `[Composant: FactRow]` : ce que contient l'export. Action « Exporter ».
  - Lien vers la suppression de compte (A0.2) — meme philosophie de controle.
- **Donnees** : frames / laps / sessions du pilote (Supabase), dans le respect des RLS.
- **Doctrine** : aligne avec « vos donnees vous appartiennent » du Pacte. Renforce la
  posture (factualite + souverainete) face aux apps qui enferment la donnee.
- **Etat vide** : « Pas encore de donnee a exporter. »
