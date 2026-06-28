# Rapport — PR-F4 · Validation admin + supervision des leads

> Dernière tranche de PR-F. Zéro schéma. §7.

## Ce que j'ai fait
- **`partnerService`** (admin) : `listAllPartnerAccounts()` (tout statut), `setPartnerStatus(id, status)` (valider/désactiver — le trigger n'autorise le changement de statut qu'à l'admin), `countLeadsByStatus()` (supervision).
- **`(admin)/partenaires.tsx`** : liste des comptes avec statut + actions **Valider** / **Désactiver** ; en-tête « N leads nouveaux à traiter ». Accent bronze (rôle admin).
- **Hub Admin** : entrée « Partenaires » ajoutée.

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 812.

## PR-F complète (F1 → F4)
1. **F1** : schéma `partner_accounts/offers/leads` + RLS stricte + espace `(partner)/` + guard + dashboard + tests RLS.
2. **F2** : offres CRUD côté partenaire.
3. **F3** : pilote « demander à être contacté » (lead consenti, double garde UI+RLS).
4. **F4** : validation admin + supervision leads.

Boucle marketplace de bout en bout : un partenaire crée son compte → l'admin valide → le partenaire publie une offre → le pilote demande contact (consenti) → l'admin/partenaire suit le lead. **Sans encaissement in-app** (paiement hors-app).

## En suspens — build requis
- Tout le parcours partenaire/pilote/admin est invérifiable sans device. Stripe (encaissement) = phase séparée si la contrainte micro-entreprise est levée.
- Onboarding partenaire dédié + auto-inscription : refinement (aujourd'hui un admin crée/valide le compte).
