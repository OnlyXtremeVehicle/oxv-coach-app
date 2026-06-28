# Rapport — PR-10 · Support côté pilote (créer / suivre / répondre)

> Backlog V6, jalon M1. S'appuie sur le schéma PR-09. Le pilote signale un
> problème ou dépose une demande RGPD sans quitter l'app.

## Ce que j'ai fait
- **`src/services/supportService.ts`** — fonctions pilote : `listMyTickets`,
  `createTicket` (catégorie + objet + message + références session/device optionnelles),
  `getTicketThread`, `replyToTicket` (is_admin=false). Mapping typé, `auth.getUser()`
  pour l'auteur, gestion d'erreur sobre. Catalogue `SUPPORT_CATEGORIES`.
- **`app/(app)/support/index.tsx`** — liste de mes demandes (catégorie · statut · objet)
  + formulaire de création (pills de catégorie, objet, message). `EmptyState` honnête si
  aucune demande.
- **`app/(app)/support/[id].tsx`** — fil d'une demande + réponse. Messages « Vous » /
  « Équipe OXV ». Statut en lecture seule (l'admin le gère). Demande close = pas de réponse.
- **`app/(app)/settings.tsx`** — point d'entrée « Aide & support » (section Compte).

## Doctrine
Sobre, vouvoiement, pas d'emoji, **or réservé à la donnée** (statuts en crème/mute, jamais
or ni rouge). Aucune promesse de délai. La demande RGPD ouvre la bonne catégorie.

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 883` · scan doctrinal vert (119 .tsx).

## Suite
- **PR-11** : écran admin Support — file priorisée (P0 en tête), changement de statut/
  priorité, réponse (is_admin=true). Termine la boucle pilote ⇄ admin.
