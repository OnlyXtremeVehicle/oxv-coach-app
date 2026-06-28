# Rapport — PR-27 · Pass OXV pilote (sans QR)

> Backlog V6, jalon M2. Décision Gabin : dep-free (QR plus tard). Zéro schéma.

## Ce que j'ai fait
- **`src/services/eventsService.ts`** (pilote) — `listMyRegistrations` (mes inscriptions
  + événement joint, RLS own), `listOpenEvents` (événements `public`), `registerForEvent`
  (insert ; unicité = « déjà inscrit »).
- **`app/(app)/pass-oxv.tsx`** — « Vos passes » : chaque inscription affiche type, nom,
  date complète, lieu/adresse, briefing, description, **statut** (Inscrit/Présent/…).
  Section « Événements ouverts » avec inscription en un tap. EmptyState honnête.
- **`src/lib/appMap.ts`** — `pass-oxv` → zone `paddock` (sinon orpheline, cf. test PR-14).
- **`app/(app)/settings.tsx`** — entrée « Pass OXV » (Compte).

## Limites assumées (sans dépendance)
- **Pas de QR** : le code de présence viendra avec `react-native-qrcode-svg`/`expo-camera`
  (accord dépendance). Le **check-in admin manuel** existe déjà (PR-21).
- **Annulation** : la policy d'update est admin-only → l'auto-annulation pilote passe par
  le **support** pour l'instant (pas de schéma touché). Une policy de self-cancel serait
  une petite migration ultérieure.
- Réconciliation avec les réservations du **site** (privé/slug) : à cadrer (web↔app).

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 895` · scan doctrinal vert (127 .tsx).

## Suite (M2)
QR (dep) → Pass complet + scan check-in · offres/leads liés événement · B2B Report.
