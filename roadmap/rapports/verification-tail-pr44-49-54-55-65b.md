# Vérification du tail — PR-44 / 49 / 54 / 55 / 65b

Passe de vérification adversariale (5 agents en lecture) confrontant chaque PR au
code réel, pour clore honnêtement ce qui est fait et ne bâtir que les vrais écarts.

## PR-54 — Key Moments, logique pure → VÉRIFIÉ FAIT

`src/services/keyMomentsLogic.ts` + `__tests__/keyMomentsLogic.test.ts` :
`computeKeyMoments({ laps, segments }) → KeyMoment[]` dérive jusqu'à 3 moments
**factuels** (référence = tour le plus rapide, engagé = G latéral max, variation =
plus grand écart entre tours). Pur, déterministe, testé, descriptif (jamais un
classement). **Rien à faire.**

## PR-55 — Key Moments, intégration → VÉRIFIÉ FAIT (sur le Bilan)

Section « MOMENTS DE LA SÉANCE » affichée dans `app/(app)/bilan.tsx`. Le libellé
du backlog (« écran Insights ») a été **superseded** : le rapport d'implémentation
`roadmap/rapports/pr-43-key-moments.md` place délibérément les Key Moments sur le
**Bilan**, avant « Toutes les lectures ». L'écran Insights reste la galerie des 6
lectures approfondies. Conforme à la décision d'implémentation. **Rien à faire.**

## PR-44 — Test « l'éthique peut échouer » → BÂTI

`src/__tests__/doctrineGuard.test.ts` (4 tests, verts). Gardes anti-régression :

- **E1** — aucune surface compétitive (`community_circuit_leaderboard`,
  `community_model_observatory`) branchée dans `app/` ou `src/` (hors types/tests).
  Ces deux RPC **existent en base** (signature TS) mais ne sont **jamais appelées** ;
  le test garantit qu'elles **restent en quarantaine**. Si un écran les branche, ROUGE.
- **T6 / D7** — aucun jeton de jugement composite (`note_globale`, `score_global`,
  `percentile`, `pilot_rank`, …) ni d'addiction (`infinite_scroll`,
  `engagement_score`, `streak_count`) dans `database.types.ts`.
- **E1** — aucune table de classement/streak/badge (`leaderboards`, `rankings`,
  `pilot_streaks`, `badges`, `trophies`, `achievements`).

Le test devient rouge si une future migration ou un futur écran introduit l'un de
ces artefacts → on refuse le merge plutôt que de laisser filer.

> **Décision Gabin 2026-06-29 : SUPPRIMÉES.** Les RPC
> `community_circuit_leaderboard` / `community_model_observatory` ont été
> `DROP`-ées (migration `drop_competitive_rpcs`). Le garde a basculé : il vérifie
> désormais qu'elles ne **réapparaissent** ni dans le schéma ni dans l'app (4/4).

## PR-49 — Rétention / purge des trames → VÉRIFIÉ ; 2 résiduels = décision Gabin

Présent :
- **Fonction** `cleanup_old_telemetry_frames()` (migration
  `20260614120500_app_telemetry_frames_retention.sql`) : supprime les
  `telemetry_frames` > 12 mois, `SECURITY DEFINER` service_role, index dédié. Les
  insights dérivés (analyses, segments, laps, session_insights) sont **conservés**.
- **Politique interne** documentée (`docs/refonte-app/07_DATA_POLICY.md`) :
  rétention ~1 saison (fenêtre glissante 12 mois).

Résiduels — **tous résolus le 2026-06-29 (accord Gabin)** :
1. **Planification pg_cron** → FAIT. Migration `schedule_telemetry_frames_purge` :
   `cron.schedule('cleanup-telemetry-frames', '30 3 * * *', …)`. Vérifié : job
   actif. La purge des trames > 12 mois tourne désormais quotidiennement.
2. **Copie publique de rétention** → DÉJÀ EN PLACE (le « gap » signalé par l'agent
   était une erreur de lecture). La politique de confidentialité §6 documente déjà :
   « Données télémétriques brutes (trames du boîtier) — **12 mois (environ une
   saison)** », analyses dérivées conservées pendant la vie du compte, suppression
   définitive en fin de durée. **Parfaitement cohérent** avec le cron. Aucun texte
   juridique à modifier.

## PR-65b — Empreinte de saison → BÂTI (finalement, plutôt que reporté)

Initialement documenté comme report ; bâti dans la même session puisque faisable
**zéro-schéma**. `app/(app)/empreinte-saison.tsx` (zone Progression) : résumé
factuel de l'**année civile en cours**, dérivé de `fetchAllSessions(fromDate =
1er janvier)` — aucune table saisonnière.
- MetricHero : séances de la saison (chiffre dominant).
- FactRow : circuits, tours, distance, mois actifs.
- TimelineEvolution : cadence mois par mois (12 barres, or = donnée).
- Doctrine : « Votre saison, telle que mesurée. Pas un palmarès. »
- Accès depuis le Passeport (« Voir mon empreinte de saison ») ; appMap
  `empreinte-saison → progression`.

Le Passeport (cumul, fenêtre glissante 6 séances) et l'Empreinte de saison
(année civile) sont désormais deux tranches identitaires complémentaires.

---

### Bilan
- Clos vérifiés : **PR-54**, **PR-55**.
- Bâtis : **PR-44** (garde doctrinal), **PR-65b** (empreinte de saison).
- Vérifié + résiduels Gabin : **PR-49** (planification destructive + copie juridique).
