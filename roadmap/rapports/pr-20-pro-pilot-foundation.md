# Rapport — PR-I · Fondation du rôle « Pilote professionnel »

> Décision Gabin : pilote pro = **nouveau rôle distinct** (vs palier ou coach). Première tranche : le rôle + l'espace + le routing. Les écrans pro-spécifiques suivent.

## Schéma (migrations `0018` + `0019`, appliquées en prod)
- `user_role` enum + valeur **`pro_pilot`** (ajout seul ; Postgres interdit d'utiliser une valeur d'enum dans la transaction de son ajout → helper séparé en `0019`).
- Helper **`is_pro_pilot()`** (SECURITY DEFINER, miroir `is_partner`/`is_admin`).
- **Aucune nouvelle policy RLS** : le pilote pro accède à **ses propres** données via les policies own-row existantes (`auth.uid() = user_id`) — comme un pilote.

## App
- `UserRole` (+ `onboardingService`, `detailLevelLogic`) étendus à `pro_pilot` ; types Supabase patchés (enum + Constants).
- `app/index.tsx` : un pilote pro est routé vers **`/(pro)`** après onboarding.
- **`(pro)/_layout.tsx`** : guard strict `role === 'pro_pilot'`.
- **`(pro)/index.tsx`** : hub distinct — identité « ESPACE PROFESSIONNEL » + accès aux outils data **partagés** avec l'espace pilote (Bilan, Data Lab, Signature, Progression — `(app)` n'a pas de garde de rôle, donc atteignables sans duplication). Note honnête : garage enrichi / jumeau / exports à venir.

## Doctrine
Sobre, vouvoiement, pas d'emoji, or = donnée. Pas de duplication du moteur pilote : le pro réutilise les écrans data existants.

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 823.

## Suite
Voir [PLAN_ECRANS_PAR_ROLE.md](../../docs/refonte-app/PLAN_ECRANS_PAR_ROLE.md) — roadmap priorisée des écrans par rôle (pilote pro, coach, partenaire B2B, admin), dérivée de V3/V4.
