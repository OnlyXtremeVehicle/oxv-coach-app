# Rapport — PR-F1 · Fondation marketplace partenaire

> Audit CDC V2, P1/P2 (§8, §8.1, §22, §23). Décision Gabin : **marketplace complète + dashboard RN**.
> Première tranche : schéma + espace `(partner)/` + dashboard skeleton + RLS testée. **Sans encaissement in-app.**

## Réconciliation des deux « partner »
Tables **propres** créées ; l'ancienne table `partners` (modèle `places` déprécié) **reste en place, non utilisée, non supprimée** (aucune dépendance nouvelle).

## Schéma (migration `0017`, appliquée en prod)
- **`partner_accounts`** : compte business lié 1:1 à un `users(id)` (role='partner'), `status` **pending/validated/disabled**, type, contact, etc.
- **`partner_offers`** : `partner_id` → account, `status` **draft/published/archived**, `price_eur` (affiché, **pas d'encaissement**), quota.
- **`partner_leads`** (§8.1) : `partner_id`, `pilot_id`, `offer_id`, **`consent_contact` + `consent_at`** (lead **consenti uniquement**), `channel`, `status` **new/contacted/booked/lost/archived**.
- Helper `owns_partner_account()` + trigger `guard_partner_account_status` (**seul l'admin valide** ; un partenaire ne s'auto-valide pas) + `updated_at` auto.

## RLS — séparation stricte pilote / partenaire / admin
- **Partenaire** : lit/édite **son** compte, CRUD **ses** offres, lit **ses** leads.
- **Pilote** : voit les comptes `validated` + offres `published` ; **crée un lead** seulement avec `consent_contact = true` (et offre publiée si fournie) ; voit ses propres leads.
- **Admin** : tout.
- **Coach** : **aucune** policy → aucun accès aux leads.
- **Partenaire ne voit JAMAIS la télémétrie** : aucune policy partenaire sur `telemetry_*` (deny-by-default).

## App
- **`UserRole`** étendu à `'partner'` (l'enum DB l'avait déjà) ; `app/index.tsx` route un partenaire vers `/(partner)` (et le sort de l'onboarding pilote).
- **`(partner)/_layout.tsx`** : guard **strict** `role === 'partner'` → sinon redirection.
- **`partnerService.ts`** : `loadMyPartnerAccount`, `listMyOffers`, `listMyLeads`.
- **`(partner)/index.tsx`** : dashboard skeleton — statut du compte, compteurs offres/leads, note « en attente de validation ». Sobre, neutre. Offres (F2) et leads (F4) à venir.

## Tests RLS (positifs **et** négatifs)
`partnerRLS.test.ts` : le partenaire voit son compte/offres/leads ; le pilote voit les offres publiées + crée un lead **consenti** ; un lead **sans consentement est refusé** ; un **coach** et un **autre pilote** ne voient **aucun** lead. *(Skippés hors `TEST_SUPABASE_*`.)*

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 812 (+4 partner RLS skippés).

## Suite (tranches séparées)
- **F2** : CRUD offres côté partenaire. **F3** : côté pilote « demander à être contacté » (lead consenti) sur une fiche partenaire. **F4** : validation admin (partenaires/offres) + suivi des leads.
- Onboarding partenaire dédié + portail web : refinements ultérieurs. Encaissement (Stripe) : phase séparée si la contrainte micro-entreprise est levée.
