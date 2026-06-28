# Rapport — PR-F3 · Pilote « demander à être contacté » (lead consenti)

> Suite de PR-F2. Zéro schéma. Zéro accord. §8.1.

## Ce que j'ai fait
- **`partnerService`** : `listMarketplace()` (partenaires `validated` + offres `published`, groupées), `listMyPilotLeads()` (pour savoir ce que le pilote a déjà demandé), `requestPartnerContact()` — **lead CONSENTI** (`consent_contact = true`, `consent_at` horodaté, `channel = app_oxv`).
- **`(app)/partenaires.tsx`** : le pilote voit les partenaires validés + leurs offres et tape « Demander à être contacté » → **confirmation explicite** (Alert : « vous autorisez X à vous contacter ») avant la création du lead. Déjà demandé → « Demande envoyée » (désactivé).
- **Club** : entrée « Partenaires » ajoutée ; `appMap` : `partenaires` → zone `club`.

## Doctrine / RGPD
Consentement **explicite** avant tout lead (double garde : confirmation UI + RLS `consent_contact = true`). Le partenaire ne reçoit qu'un contact consenti, **jamais** la donnée pilote. Ton sobre, pas de promo agressive.

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 812 (appMap : route `partenaires` couverte).

## Suite
- **F4** : validation admin (partenaires/offres) + suivi des leads (statuts contacted/booked/…).
