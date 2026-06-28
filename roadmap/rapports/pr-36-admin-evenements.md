# Rapport — PR-21 · Admin Événements (dans l'app)

> Backlog V6, jalon M2. Gestion des événements **dans l'app** (décision Gabin).
> Zéro schéma (s'appuie sur `events`/`event_registrations` de PR-20).

## Ce que j'ai fait
- **`src/services/eventSlug.ts`** (pur) + test — `slugify` isolé (eventsService tire
  supabase, incompatible jest).
- **`src/services/eventsService.ts`** — CRUD admin : `listEvents`, `getEvent`,
  `createEvent` (slug auto + `created_by`), `updateEvent`, `listEventRegistrations`
  (jointure pilote), `setRegistrationStatus` (check-in = `checked_in_at`/`by`).
  Catalogues `EVENT_TYPES`/`EVENT_STATUSES` + libellés.
- **`app/(admin)/evenements.tsx`** — liste (type · statut · date · lieu · pilotes) + Créer.
- **`app/(admin)/evenements/nouveau.tsx`** — formulaire en sections (infos, lieu, dates/
  capacité, description + notes internes). Dates ISO court (outil admin).
- **`app/(admin)/evenements/[id].tsx`** — détail : infos, **notes internes** (admin),
  **changement de statut** (pills), **inscriptions + check-in** (« Pointer l'arrivée »).
- **`app/(admin)/index.tsx`** — entrée « Événements » au hub.

## Doctrine
Admin-only (RLS). Bronze = rôle admin (pas de rouge). Notes internes jamais côté pilote.
Tarification gérée côté site (pas exposée ici).

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 895` (+3 slugify) · scan doctrinal vert (126 .tsx).

## Suite (M2)
PR-27 Pass OXV pilote (s'inscrire + QR check-in) · offres/leads liés événement · B2B Report.
