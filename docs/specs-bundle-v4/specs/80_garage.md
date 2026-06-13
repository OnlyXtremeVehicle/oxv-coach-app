# Bloc 80 — Garage (3 ecrans)

Reference : `01_doctrine_et_composants.md`. Relier la telemetrie au **vehicule** : un meme
pilote ne se comporte pas pareil selon l'auto. C'est un axe data que la concurrence ne
formalise pas pour le grand public premium.

---

## 80.1 — Mes vehicules

- **But** : gerer le parc du pilote (CRUD).
- **Layout** :
  - `[Composant: AppBar]` titre « Garage », action « Ajouter un vehicule ».
  - Liste de fiches vehicule (modele, photo, miniature). Tap → 80.2.
  - CRUD complet (creer / editer / supprimer), plusieurs photos par vehicule.
- **Donnees** : table vehicules liee au pilote (Supabase). (Aligner avec l'espace pilote du
  site si une table existe deja.)
- **Doctrine** : neutre.
- **Etat vide** : `[Composant: EmptyState]` — « Aucun vehicule enregistre. »

---

## 80.2 — Fiche vehicule x donnees

- **But** : voir la telemetrie **rattachee a ce vehicule precis** — son comportement propre.
- **Layout** :
  - En-tete fiche (modele, photo).
  - `[Composant: MetricHero]` : un fait propre au vehicule (ex. « G lateral max observe avec
    cette auto »).
  - `[Composant: FactRow]` : sessions roulees avec ce vehicule, circuits, faits agreges.
  - Lien vers les sessions filtrees sur ce vehicule.
- **Donnees** : sessions filtrees par `vehicle_id` + agregats (Supabase).
- **Doctrine** : on decrit le comportement mesure du vehicule. Pas de « cette auto serait
  meilleure si… ».
- **Etat vide** : « Aucune session enregistree avec ce vehicule. »

---

## 80.3 — Comparaison entre mes vehicules

- **But** : comparer **ses propres** autos sur les memes faits — soi contre soi, version
  materiel.
- **Layout** :
  - Selecteur de deux vehicules du garage.
  - `[Composant: ComparisonPair]` : memes faits, deux autos (vitesses, G, signature sur un
    circuit commun). Strictement symetrique.
- **Donnees** : agregats par vehicule (Supabase).
- **Doctrine** : comparaison **factuelle** entre deux objets du pilote. Aucun « gagnant »
  designe ; le pilote interprete.
- **Etat vide** : « La comparaison demande au moins deux vehicules avec des sessions. »
