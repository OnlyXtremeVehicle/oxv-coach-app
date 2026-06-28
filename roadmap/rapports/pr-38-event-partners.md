# Rapport — PR-37 · Présence partenaire à un événement

> Backlog V6, jalon M2. Lien événement↔partenaire — base du B2B Report.
> Schéma STOP validé par « on continue m2 » (DDL montré + appliqué, pattern PR-20).

## Constat
`partner_offers.event_id` **existait déjà** (lien offre↔événement). Ne manquait que
la **présence** partenaire.

## Schéma (migration `0022`, appliquée)
- **`event_partners`** : event_id, partner_id (→ `partner_accounts`), status enum
  (invited/confirmed/declined), unique(event_id, partner_id). RLS : admin gère ;
  **le partenaire voit SA présence** (`owns_partner_account`) — jamais celle des autres.
  Aucune télémétrie.

## App
- **`eventsService`** — admin : `listEventPartners`, `listPartnersForAttach`,
  `addEventPartner`, `removeEventPartner` ; partenaire : `listMyEventPartnerships`.
- **`app/(admin)/evenements/[id].tsx`** — section « Partenaires » : liste + rattacher
  (pills des comptes dispo) + retirer.
- **`app/(partner)/index.tsx`** — section « Mes événements » (lecture).

## Tests RLS
`src/__tests__/rls/eventPartnersRLS.test.ts` : le partenaire voit SA présence ; un autre
partenaire et un pilote ne voient rien. Skippés sans creds. Types régénérés (+41/-0).

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest` vert · scan doctrinal vert (127 .tsx).

## Suite (M2)
B2B Event Report (agrège events + registrations + event_partners ; trancher dérivé vs
table `b2b_event_reports`). QR (dépendance) pour Pass complet + scan.
