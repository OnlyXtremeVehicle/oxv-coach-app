# Rapport — PR-11 · Support côté admin (traiter la file)

> Backlog V6, jalon M1. Ferme la boucle pilote ⇄ admin (PR-09 schéma, PR-10 pilote).

## Ce que j'ai fait
- **`src/services/supportAdminService.ts`** — `listAllTickets` (**P0 en tête** : tri par
  priorité croissante puis date décroissante ; filtre `hideClosed`), `setTicketStatus`,
  `setTicketPriority` (admin-only, garanti RLS), `replyAsAdmin` (is_admin=true).
- **`app/(admin)/support.tsx`** — file de tickets priorisée, filtre « En cours / Toutes »,
  P0 en rouge (priorité critique = surface admin). Tap → fil.
- **`app/(admin)/support/[id].tsx`** — fil + contrôles **statut** et **priorité** (pills) +
  réponse admin. Réutilise `getTicketThread`.
- **`app/(admin)/index.tsx`** — entrée « Support » ajoutée au hub admin.

## Doctrine
Bronze = couleur de rôle admin ; **rouge réservé à la priorité P0** (sévérité, surface
admin), jamais une donnée pilote. Sobre, vouvoiement, pas d'emoji.

## Boucle complète
Pilote crée/suit/répond (PR-10) → admin priorise/traite/répond (PR-11), le pilote voit le
statut évoluer et les réponses « Équipe OXV ». RLS : le pilote ne voit que ses tickets ;
l'admin voit tout et seul change statut/priorité ; pas d'usurpation `is_admin`.

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 883` · scan doctrinal vert (121 .tsx).

## Suite (V6)
Feature Support **terminée** (PR-09/10/11). Prochain gate = M2 (socle `events`, STOP) ou
toute autre tranche que vous choisissez.
