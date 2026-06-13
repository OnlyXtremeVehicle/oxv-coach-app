# Bloc 50 — Circuits & traces (3 ecrans)

Reference : `01_doctrine_et_composants.md`. Extension au-dela de Haute Saintonge, vers la
Nouvelle-Aquitaine, plus creation de traces perso.

**Gouvernance des traces (regle ferme)** : chaque pilote peut creer son trace **pour son
usage personnel, prive par defaut**. La publication d'un trace dans le **referentiel partage
est reservee a OXV** : les pilotes proposent, OXV seul valide et publie. Cela garantit la
qualite du catalogue.

---

## 50.1 — Liste des circuits (Nouvelle-Aquitaine)

- **But** : parcourir les circuits disponibles, a commencer par la Nouvelle-Aquitaine.
- **Layout** :
  - `[Composant: AppBar]` titre « Circuits », recherche.
  - Liste de cartes circuit (nom, localisation, longueur, miniature de `[Composant: TrackCanvas]`).
  - Premier socle : Haute Saintonge (tracé Beltoise) + Circuit de Bordeaux (compte rendu de
    visite existant). Etendre ensuite.
  - Section « Mes traces » (traces perso crees par le pilote, prives).
- **Donnees** : table `circuits` (existante). Calibration GPS reelle de la ligne d'arrivee
  et du tracé pour chaque circuit ajoute.
- **Doctrine** : neutre.
- **Etat vide** : « Aucun circuit pour cette zone. »

---

## 50.2 — Detail d'un circuit

- **But** : presenter un circuit et l'historique perso du pilote dessus.
- **Layout** :
  - `[Composant: TrackCanvas]` du circuit + faits (longueur, nb de virages, secteurs).
  - `[Composant: TimelineEvolution]` : les sessions du pilote sur ce circuit (renvoi 20.4).
  - `[Composant: MetricHero]` : meilleur tour perso ici.
- **Donnees** : `circuits` + sessions filtrees (Supabase).
- **Doctrine** : pas de comparaison de classement entre pilotes sur le circuit. Soi contre soi.
- **Etat vide** : « Vous n'avez pas encore roule ici. »

---

## 50.3 — Creation d'un trace (points sur carte)

- **But** : permettre au pilote de definir son propre trace en placant des points sur une
  carte (ligne de depart + geometrie), pour les pistes non referencees ou boucles privees.
- **Layout** :
  - Carte interactive plein ecran. Outils : poser la **ligne de depart/arrivee**, ajouter des
    points de trace, fermer la boucle.
  - `[Composant: FactRow]` : longueur estimee, nb de points.
  - Action : « Enregistrer (prive) ». **Pas** de bouton « Publier » cote pilote : a la place,
    « Proposer a OXV » (envoie une demande ; la publication reste cote OXV).
- **Donnees** : ecrit un trace prive lie au pilote (Supabase). Une proposition cree une
  entree en attente de validation OXV.
- **Doctrine** : respecter strictement la gouvernance — **prive par defaut, publication OXV
  uniquement**. Ne jamais exposer un trace perso d'un pilote a d'autres sans validation.
- **Etat vide** : carte vierge avec aide au placement du premier point.
