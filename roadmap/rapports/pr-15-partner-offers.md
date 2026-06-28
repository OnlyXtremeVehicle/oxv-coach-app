# Rapport — PR-F2 · Offres côté partenaire (CRUD)

> Suite de PR-F1. Zéro schéma (tables `0017` déjà là). Zéro accord.

## Ce que j'ai fait
- **`partnerService`** : `upsertOffer` (créer/éditer) + `deleteOffer`. RLS `owns_partner_account` (le partenaire n'agit que sur ses offres).
- **`(partner)/offres.tsx`** : liste des offres + formulaire (titre, description, prix **affiché non encaissé**, quota, statut `brouillon/publiée/archivée`). Pattern identique à l'éditeur admin `points-carte` (Field/Button/Toast, liste ↔ formulaire). Validation : titre requis, prix/quota numériques.
- **Dashboard partenaire** : carte « Mes offres » réactivée (lien vers l'écran).

## Doctrine
Sobre, vouvoiement, pas d'emoji, pas d'or décoratif. Le prix est un affichage (la marketplace est sans encaissement in-app à ce stade).

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 812.

## Suite
- **F3** : côté pilote « demander à être contacté » (lead consenti) sur une fiche partenaire/offre publiée.
- **F4** : validation admin (partenaires/offres) + suivi des leads.
