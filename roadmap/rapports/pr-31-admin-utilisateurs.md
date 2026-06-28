# Rapport — PR-12 · Admin Utilisateurs (rôle audité)

> Backlog V6, jalon M1. Comble le manque relevé par l'audit : « les changements
> de rôle doivent être audités ». Zéro schéma (colonnes + trigger déjà en place).

## Ce que j'ai fait
- **`src/services/adminUsersService.ts`** — `listUsers(role?)`, `getUserDetail`,
  `setUserRole` (change `role` + synchronise `is_admin` pour ne jamais diverger),
  `setSuspended`, `setAdminNotes`. Catalogue `USER_ROLES` (pilote/pro/coach/partenaire/admin).
- **`app/(admin)/utilisateurs.tsx`** — annuaire : recherche (email/nom, côté client),
  filtre par rôle, marqueur « suspendu ». Tap → fiche.
- **`app/(admin)/utilisateurs/[id].tsx`** — fiche : **changement de rôle avec confirmation**
  (tracé dans `admin_audit`), suspension/réactivation (motif), consentements (pacte/CGU/
  confidentialité) en lecture, note interne admin, alerte si suppression programmée.
- **`app/(admin)/index.tsx`** — entrée « Utilisateurs » au hub.

## Audit
Le changement de `users.role` déclenche **automatiquement** le trigger
`trg_audit_user_role_change` (migration 0015) → écriture dans `admin_audit`. Rien à
ajouter côté app ; la traçabilité est garantie en base.

## Doctrine
Admin-only (RLS `is_admin`). Bronze = rôle admin ; rouge réservé à l'action de suspension
(surface admin), jamais une donnée pilote. Notes admin jamais visibles du pilote.

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 883` · scan doctrinal vert (123 .tsx).

## Suite (M1)
PR-13 (matrice de tests RLS rôle-par-rôle), PR-14 (tests appMap), PR-15 (alignement
consentement), PR-16 (vérif export/suppression), PR-17 (Plausible). PR-18/19 attendent
le build (reset quota EAS, 1er juillet).
