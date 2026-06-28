# Rapport — PR 8 · Fusion territoire (« La carte OXV » écran unique)

> Décision Gabin 2026-06 : **déprécier le modèle `places` au profit de `social_pings`**
> et **fusionner le contenu liste de `social` + `social-carte` dans `carte-oxv`**.
> Conçu + vérifié par workflow (recon → design → 3 revues adversariales : orphelins,
> affordances, doctrine), appliqué depuis findings vérifiés.

## Vérité terrain (base de prod, vérifiée)
- `places` **n'existe pas** ; `placesService` lit `partners`+`lodgings`+`restaurants` directement.
- Ces 3 tables **et** `social_pings` sont **vides (0 ligne)** → **aucune migration, aucun changement de schéma, aucun `DROP`**. La dépréciation est un refactor **code pur**.
- `social_pings.kind` ∈ `{event_oxv, event_partner, soiree, partner_location, filming_location, host_experience}` — l'axe de regroupement de la vue Liste.

## Ce que j'ai fait
- **`app/(app)/carte-oxv.tsx`** — écran UNIQUE du territoire :
  - **Bascule sobre Carte | Liste** (`card2`/`cream`/`creamMute`/`edge`, **aucun or ni heritageGold**).
  - **Vue Liste** = ancien `social` reproduit (groupement par `kind` via `groupPingsByKind`/`SectionLabel`, `PingCard` champ par champ, actions **Direct=liveUrl / Détails=eventUrl / Contacter=mailto**, **sans gate `isEvent`**), dans son propre `ScrollView`.
  - **Double état vide** piloté par un nouvel état `failed` (échec réseau → « Indisponible » ; vide → « À l'horizon ») — sinon une coupure réseau serait confondue avec un territoire vide.
  - **Vue Carte** inchangée (MapView, marqueurs, légende, `DetailPanel`). En Expo Go, la Liste est rendue d'office.
  - **Doctrine — or assaini** : la puce de groupe, l'ombre de carte et les CTA « Direct » passent en gris ; **le bouton primaire `panelBtnPrimary` du panneau carte, jusque-là en or pur (`#FFB703`), est neutralisé** (`card2` + bordure `edge`, texte `cream`). L'or reste réservé aux marqueurs circuits (donnée).
- **`social.tsx`, `social-carte.tsx`, `lieux.tsx`** → coquilles `<Redirect href="/(app)/carte-oxv">` (atomique, même commit que la vue liste — pas de fenêtre où la liste disparaît).
- **`placesService.ts`** → `@deprecated` (JSDoc citant la décision Gabin 2026-06). Conservé avec son test (traçabilité) ; suppression définitive planifiée dans `10_PLAN_MIGRATION`.
- **`appMap.ts`** : entrées `social`/`social-carte`/`lieux` conservées en zone `club` (surlignage correct sur deep-link/legacy) + commentaire. Vérifié : aucune n'est dans `DATA_LAB_SCREENS` ni `CAPTURE_FLOW`.
- **Docs réconciliés** (blocker levé) : `10_PLAN_MIGRATION` (D2+D3, `ROUTE_ALIASES`, exemple coquille — `social → carte-oxv`, plus `→ amis`), `02_AUDIT_ROUTES` (3 routes = REDIRECT FAIT), `pr-07-fusions` (bannière RÉSOLU), commentaire `club/index.tsx` (consigne → constat).

## Revue adversariale — mustFix tous traités
- **Boucle de redirection** : impossible — les 3 coquilles pointent **directement** vers `carte-oxv`, jamais l'une vers l'autre ; les `router.replace('/(app)/social')` de `social-carte` deviennent inertes (corps non rendu).
- **Affordances** : actions Direct/Détails **non gatées** par `isEvent` (sémantique `social`, sinon des liens disparaîtraient pour les pings non-événements) ; liste scrollable ; double EmptyState reproduit.
- **Doctrine** : or = donnée (marqueurs circuits) uniquement ; bascule/filtres/CTA en gris ; vouvoiement ; aucun emoji ; aucun classement.

## Perte assumée (acceptable)
- Les **pills de filtre par genre** de `lieux` (Partenaires/Hébergements/Restaurants) ne sont pas reprises : ces genres ne sont pas représentables dans `social_pings.kind`, et les tables sont **vides** → aucune donnée perdue, seulement de la capacité. Le regroupement par `kind` fournit la segmentation.

## Testé (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797 (`placesService.test` reste vert).

## En suspens — **build requis**
- Rendu de l'écran fusionné sur device : bascule Carte↔Liste, défilement de la liste, panneau carte. Invérifiable sans build.

## Enhancements optionnels (hors scope, aucun schéma)
- Autorat admin `endsAt` (plage de dates) + galerie `media` ; validation ISO de `startsAt`.
- Suppression définitive des 3 coquilles + `placesService` + son test (blast radius nul, après ≥ 1 cycle).
