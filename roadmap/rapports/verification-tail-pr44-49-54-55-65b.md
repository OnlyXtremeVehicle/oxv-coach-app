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

> **À l'attention de Gabin** — les RPC `community_circuit_leaderboard` /
> `community_model_observatory` sont des surfaces compétitives dormantes dans la
> base. Décision à prendre : les **supprimer** (migration, recommandé si non
> prévues) ou les **garder en quarantaine documentée**. Tant qu'elles existent, le
> garde ci-dessus les surveille.

## PR-49 — Rétention / purge des trames → VÉRIFIÉ ; 2 résiduels = décision Gabin

Présent :
- **Fonction** `cleanup_old_telemetry_frames()` (migration
  `20260614120500_app_telemetry_frames_retention.sql`) : supprime les
  `telemetry_frames` > 12 mois, `SECURITY DEFINER` service_role, index dédié. Les
  insights dérivés (analyses, segments, laps, session_insights) sont **conservés**.
- **Politique interne** documentée (`docs/refonte-app/07_DATA_POLICY.md`) :
  rétention ~1 saison (fenêtre glissante 12 mois).

Résiduels (NON faits ici, volontairement) :
1. **Planification pg_cron absente.** La fonction n'est jamais appelée
   automatiquement. **Je ne l'auto-planifie pas** : c'est un job **destructif
   récurrent** (suppression de données pilote) — l'activation relève d'une décision
   ops explicite de Gabin. Snippet prêt à appliquer (Dashboard → SQL) :

   ```sql
   select cron.schedule(
     'cleanup-telemetry-frames', '30 3 * * *',
     $$ select public.cleanup_old_telemetry_frames(); $$
   );
   ```
2. **Copie publique de rétention.** La politique de confidentialité ne mentionne
   pas explicitement la durée de conservation des trames brutes. Ajout = texte
   **juridique** → validation Gabin requise (cf. CLAUDE.md).

## PR-65b — Empreinte de saison → REPORT DOCUMENTÉ (backlog : « ou report documenté »)

Non implémenté comme agrégat **saisonnier** distinct. Couvert partiellement par :
- **Passeport** (`app/(app)/passeport.tsx`) — identité cumulée sur les 6 séances
  récentes (fenêtre glissante), radar Empreinte.
- **Signature** — signature par séance + historique des snapshots.

Manque (spec `70_identite_avatar.md §70.3`) : un résumé **par saison/année civile**
(MetricHero « 14 séances · 5 circuits », timeline d'évolution, FactRow). Faisable
**zéro-schéma** (dérivé de `telemetry_sessions` filtrées par année + signature),
sans nouvelle table. Le backlog V6 autorise explicitement « agrégat saisonnier
**ou report documenté** » → **reporté**, à bâtir en tranche dédiée (effort M).
Aucune donnée fabriquée entre-temps.

---

### Bilan
- Clos vérifiés : **PR-54**, **PR-55**.
- Bâti : **PR-44** (garde doctrinal).
- Vérifié + résiduels Gabin : **PR-49** (planification destructive + copie juridique).
- Reporté documenté : **PR-65b**.
