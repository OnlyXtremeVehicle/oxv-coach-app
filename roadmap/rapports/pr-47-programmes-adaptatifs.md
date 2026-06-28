# PR-47 — Programmes adaptatifs coach (version durcie, M3, C-2)

**Milestone** : M3 (innovation V4) · **Date** : 2026-06-28 · **Branche** : `main`
**Méthode** : workflow (7 agents : comprendre infra+doctrine+spec → concevoir → critique adversariale 3 lentilles), puis build durci.

## Intention

Un programme = un **cycle qualitatif authoré par le coach humain** pour un pilote
consenti (niveau `programme`), qu'il **fait évoluer dans le temps**. C'est ça
« l'adaptatif » : **l'ajustement humain**. L'app NE génère, NE pré-remplit, N'adapte
JAMAIS — elle stocke et affiche. Lecture a posteriori, jamais en piste.

Classé **V1.5** dans la spec (03_MVP_SCOPE) ; construit maintenant dans M3 sur
demande, en version durcie.

## Doctrine tenue (vérifiée par la critique)

- **App n'adapte jamais** : l'écriture est réservée au coach (RLS) ; aucune colonne,
  aucun trigger, aucun service ne produit de contenu.
- **Aucun score chiffré** : par construction (pas de colonne %), statut qualitatif
  `en_cours`/`atteint` **observé par le coach** — le pilote ne coche rien (ce serait
  un score déguisé) ; s'il veut réagir, c'est dans son carnet (étanche).
- **Souveraineté pilote** : visible seulement si le coach partage (`is_shared`) ET
  consentement niveau `programme` ; la révocation (downgrade) coupe tout, effet immédiat.
- Distinct de `pilot_goals` (0023, intime) : ici c'est l'avis d'un tiers.

## La critique a trouvé un trou structurel — corrigé

🟠 **Fuite prescriptive inter-tables** (consensus 2 lentilles) : le garde-fou portait
sur l'en-tête seul. Un coach pouvait écrire des axes prescriptifs en **privé**, puis
basculer `is_shared=true` → les axes **n'étaient jamais re-scannés** et atteignaient
le pilote. **Correctif** : au flip `is_shared=true`, le garde de l'en-tête **re-scanne
TOUS les axes enfants** et refuse le partage si l'un est prescriptif (testé en RLS).

🟢 **Consolidation du lexique** : extrait dans une **fonction SQL unique
`public.is_prescriptive(text)`**, réutilisée par le garde des programmes **et** par
celui de `coach_annotations` (0026) — **rembourse la dette** de duplication.

🟢 Autres : helper strict `is_program_coach_of` (cran de consentement au-dessus de
`lecture_detaillee`), `corner_indexes` bornés (1..30, validé en base), FK `auth.users`
(cohérent avec 0026).

## Schéma (migration `0027`, appliquée en prod)

- `pilot_development_cycles` (en-tête : titre, intention-observation, status active/closed,
  is_shared) + `cycle_steps` (focus, note, corner_indexes bornés, status `en_cours`/`atteint`,
  position).
- Helpers `is_prescriptive`, `is_program_coach_of`, `corner_indexes_valid` (search_path durci).
- 3 triggers doctrinaux : en-tête (re-scan axes au partage), axes (scan si parent partagé),
  + refactor du garde `coach_annotations` vers `is_prescriptive`. Vérifié en base.
- RLS : coach auteur niveau programme (CRUD) ; pilote lecture seule si partagé ;
  admin SELECT audit ; partenaire jamais.

`database.types.ts` régénéré (+86/-0). Advisors : aucune alerte propre (WARN
`is_program_coach_of` = pattern accepté `is_coach_of`).

## App

- `src/services/developmentCycleService.ts` (coach CRUD + pilote read-only).
- `app/(coach)/cycles.tsx` (pilote + liste + création) + `cycles/[id].tsx` (édition
  en-tête, axes, partage) + lien hub coach.
- `app/(app)/programme.tsx` (pilote, lecture seule) + entrée Progression + appMap
  `programme → progression` (route + écran même commit).

## Vérifié

- `tsc` · `eslint` · `prettier`/`format:check` clean · `doctrine` 137 fichiers OK.
- `npx jest` : **918 passed, 0 échec** ; `appMap.test.ts` vert.
- Tests RLS `developmentCyclesRLS.test.ts` : 8 cas (coach programme crée ; coach
  detailed-only refusé ; pilote lit partagé, pas le privé, n'écrit pas ; partenaire
  aveugle ; **axe prescriptif privé bloque le partage** ; descriptif se partage).

## Reste / suite M3

- Tester sur device avec un compte coach niveau `programme`.
- Tranches M3 restantes : jumeau numérique, modération.
