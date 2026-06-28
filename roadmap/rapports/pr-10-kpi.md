# Rapport — PR-C · Instrumentation des KPI produit (§27)

> Audit CDC V2, P1 : « aucun des 10 KPI §27 n'est instrumenté ; `trackEvent`
> appelé une seule fois (`app_ouverte`) → objectifs alpha non mesurables ».
> Zéro schéma, zéro accord. Suite de [pr-09](pr-09-coach-graded-access.md).

## Ce que j'ai fait
- **`src/services/analyticsEvents.ts`** (net-neuf) : catalogue `OxvEvent` — noms d'événements centralisés (une seule source de vérité), tous via `analyticsService.trackEvent` (RGPD par construction : no-op sans domaine Plausible, opt-out respecté, **jamais de PII** — uniquement des propriétés catégorielles).
- **6 moments clés instrumentés** :

| Événement | KPI §27 | Point d'instrumentation |
|---|---|---|
| `onboarding_termine` | activation_pilote | `onboardingService.completeOnboarding()` (succès) |
| `capture_reussie` / `capture_echouee` | session_capture_success | `analyzeSessionService.analyzeAndPersistSession()` (retour `ok`) — props `source`/`segments` |
| `bilan_ouvert` | bilan_open_rate | `bilan.tsx` (montage) |
| `datalab_couche_ouverte` | data_lab_depth | `data-lab.tsx` (ouverture d'une couche) — prop `couche` |
| `coach_consentement_donne` | coach_share_rate | `pilotConsentService.giveConsent()` — prop `niveau` |
| `coach_note_envoyee` | coach_note_delivery | `coachAnnotationsService.createAnnotation()` (succès) |

- **Test** `analyticsEvents.test.ts` : vérifie chaque nom d'événement + l'absence de PII dans les propriétés (8 cas).

## Hors scope (assumé)
- `data_anomaly_rate` et `partner_lead_rate` : attendent leurs tables (`data_quality_reports`, `partner_leads`) — PR-D / PR-F.
- `retention_event_to_event` : KPI dérivé (calcul côté analytics, pas un event).

## Doctrine / RGPD
- Aucune donnée personnelle transmise (pas d'email, d'id, de coordonnées) — uniquement des libellés catégoriels. Opt-out (#24 Réglages) et garde-fou « domaine non configuré » inchangés.

## Action requise (vous)
- **Configurer `EXPO_PUBLIC_PLAUSIBLE_DOMAIN`** (ex. `oxvehicle.fr`) dans l'env de build : tant qu'il est vide, **rien n'est collecté** (les events sont des no-op). L'instrumentation est posée ; la collecte s'active à la config.

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 807 (+8).

## En suspens — build requis
- Vérifier sur device que les events partent bien aux 6 moments (avec un domaine de test configuré).
