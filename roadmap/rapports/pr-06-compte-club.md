# Rapport — PR 6 · Compte (icône) + Club enrichi

## Ce que j'ai fait
- **F1 — `app/(app)/club/index.tsx`** : hub Club enrichi. « Mon coach » reste en tête (affiliation mise en avant) ; ajout de **Mes demandes** et **Belles routes**. Liste : Mon coach · Découvrir un coach · Mes demandes · La carte OXV · Communauté · Belles routes.
- **G1 — `app/(app)/compte/index.tsx`** _(net-neuf)_ : hub Compte — Mon profil · Mes objectifs · Notifications · Réglages · Données & confidentialité (RGPD + légal). **Accessible par l'icône haut-droite uniquement** : le gear du Paddock ouvre désormais `/(app)/compte` (hub) au lieu d'aller droit aux réglages. **Compte n'est pas un onglet** (`00 §4`).

## Non-orphelin — bilan
Avec les hubs Club + Compte, les destinations de l'ancienne liste « Tout le paddock » ont **toutes un foyer** :
- Compte : profil, objectifs, notifications, réglages, données/RGPD/légal.
- Club : mon-coach, coachs, mes-demandes, carte-oxv, amis, belle-route.
- Zones : bilan, équipement (Session), progression + ses sous-vues.

→ Cela **débloque le retrait** de « Tout le paddock » et les fusions de doublons (social→amis, social-carte/lieux→carte-oxv), à faire dans la **PR de migration** (`10_PLAN_MIGRATION`), pas ici.

## Doctrine
- Le social/club ne passe jamais devant le Bilan ; le Compte reste discret (icône). Vouvoiement, pas d'emoji, aucun or décoratif.

## Testé (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797. *(Cast `as never` sur le `Link` vers `/(app)/compte` — route net-neuve, types Expo régénérés au build.)*

## Suite
- **PR de migration** : retirer « Tout le paddock », fusionner les doublons, dédupliquer.
- **PR 7** : polish canon (Instrument Serif, `v2.ts` réaligné au token, flou de la barre).
