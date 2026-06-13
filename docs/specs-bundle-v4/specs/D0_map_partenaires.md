# Bloc D0 — Map & ecosysteme partenaires (4 ecrans)

Reference : `01_doctrine_et_composants.md`.

## Cadre

Ce bloc est **hors du perimetre telemetrie** : il n'y a pas de donnee de pilotage ici, donc
pas de tension avec la doctrine miroir. C'est l'**ecosysteme** OXV : circuits partenaires,
hebergements (Airbnb), restaurants, evenements partenaires autour des circuits.

Une seule precaution : ce sont des **recommandations commerciales / partenaires**. On les
presente comme telles, honnetement. Pas de fausse neutralite : ce qui est partenaire OXV est
identifie comme tel. Vouvoiement, charte OXV, **or reserve Heritage**.

La carte de France interactive (deja prevue dans la vision produit : « pings de localisation
des evenements partenaires et sessions a venir ») est le coeur de ce bloc.

---

## D0.1 — Carte ecosysteme (France interactive)

- **But** : une carte qui agrege tout l'ecosysteme OXV — circuits, partenaires, evenements,
  sessions a venir — pour que le pilote se positionne et explore.
- **Entree / sortie** : onglet dedie → fiche d'un lieu / d'un evenement.
- **Layout** :
  - Carte plein ecran avec pings typés (filtrables) : **Circuits partenaires**, **Sessions
    OXV a venir**, **Hebergements (Airbnb)**, **Restaurants**, **Evenements partenaires**,
    reste de l'ecosysteme.
  - Filtres par categorie en surimpression sobre.
  - Tap sur un ping → carte resumee → fiche detail (D0.2/D0.3).
  - Possibilite de centrer sur un circuit pour voir « autour de ce circuit ».
- **Donnees** : lieux/partenaires/evenements (Supabase). Geocoding des points.
- **Doctrine** : N/A (hors telemetrie). Identifier clairement les partenaires comme partenaires.
- **Etat vide** : « Aucun point dans cette zone pour les filtres choisis. »

---

## D0.2 — Autour d'un circuit

- **But** : depuis un circuit, montrer l'ecosysteme alentour — ou dormir, ou manger, quoi
  faire — pour organiser une venue.
- **Layout** :
  - En-tete circuit (renvoi 50.2 pour la partie sportive).
  - Sections : **Se loger** (Airbnb / hebergements partenaires), **Se restaurer**
    (restaurants), **Evenements** a proximite, **Services**.
  - Chaque entree = `[Composant: SessionCard]`-like (nom, distance du circuit, categorie,
    badge partenaire si applicable). Tap → fiche (D0.3).
- **Donnees** : partenaires lies a un circuit / filtres par proximite (Supabase).
- **Doctrine** : N/A. Distances et categories factuelles ; statut partenaire explicite.
- **Etat vide** : « Pas encore de partenaire reference autour de ce circuit. »

---

## D0.3 — Fiche lieu / partenaire

- **But** : detailler un hebergement, restaurant ou service partenaire.
- **Layout** :
  - Visuel + nom + categorie + badge partenaire OXV si applicable.
  - `[Composant: FactRow]` : localisation, distance circuit(s), infos pratiques.
  - Lien sortant (reservation Airbnb, site du restaurant, etc.) — clairement signale comme
    lien externe.
  - Si avantage membre OXV (ex. tarif partenaire) : mention factuelle.
- **Donnees** : fiche partenaire (Supabase) + lien externe.
- **Doctrine** : N/A. Pas de fausse note/avis fabrique ; si avis, source claire.
- **Etat vide** : fiche minimale si peu d'infos.

---

## D0.4 — Evenements partenaires & sessions a venir

- **But** : l'agenda de l'ecosysteme — sessions OXV a venir et evenements partenaires, depuis
  la carte ou en liste.
- **Layout** :
  - Bascule carte/liste.
  - Liste chronologique : sessions OXV (renvoi vers la reservation cote site si pertinent) et
    evenements partenaires.
  - Filtre par date / zone / type. Chaque evenement → fiche.
- **Donnees** : evenements + sessions a venir (Supabase). Coherence avec le calendrier du
  site (32 sessions/an, plafond 20 pilotes).
- **Doctrine** : N/A (ecosysteme). Distinguer clairement ce qui est OXV de ce qui est
  partenaire.
- **Etat vide** : « Aucun evenement a venir pour ces filtres. »

---

## Note pour Claude Code

Ce bloc peut s'appuyer sur des fonds de carte / SDK cartographiques. Choisir une solution
**respectueuse de la vie privee** (pas de tracking publicitaire), coherente avec la posture
RGPD du reste de l'app (cf. 00_CLAUDE §4). La position du pilote, si utilisee pour centrer la
carte, demande un consentement et ne doit pas etre transmise a des tiers a des fins
publicitaires.
