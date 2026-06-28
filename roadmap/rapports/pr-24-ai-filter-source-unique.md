# Rapport — PR-03 · Source unique du lexique + anti-divergence edge

> Backlog V6, jalon M1. Termine le trio « doctrine verrouillée au runtime »
> (PR-01 débrief, PR-02 focusCorner, PR-03 unification). Zéro schéma.

## Ce que j'ai fait
- **Filtre app = superset de l'edge** : ajout des 6 termes que le garde-fou serveur
  `generate-debrief-ai` bannissait sans que le filtre app les couvre — `corrigez`,
  `ameliorez`, `optimisez`, `gagnez` (impératifs de performance), `je vous conseille`,
  `je vous recommande` (conseils). Snapshot du lexique mis à jour (changement tracé).
- **Dé-duplication** : `debriefGenerator.test.ts` et `focusCorner.test.ts` n'ont plus de
  liste locale de verbes interdits — ils délèguent à `isDoctrineSafe`. `focusCorner`
  conserve deux extras de **contexte** (`plus tôt`/`plus tard`, comparatifs directifs
  volontairement hors du filtre général car trop sujets aux faux positifs en prose).
- **Test anti-divergence** : `aiSafetyFilter.test.ts` vérifie que le filtre app couvre
  **chaque** terme scanné par l'edge (18 termes). Échoue si les listes divergent.
- **Traçabilité edge** : commentaire dans `generate-debrief-ai/index.ts` désignant le
  filtre app comme source canonique + pointant le test. (Commentaire seul, pas de
  changement de comportement → pas de redeploy requis.)

## Honnête
- L'edge garde sa propre liste (runtimes distincts, pas d'import partagé). Le test
  anti-divergence est le garde-fou contre la dérive ; une vraie unification de code
  serveur n'est pas justifiée (coût > bénéfice).

## Tests
- `tsc 0 · eslint 0 · jest 877` (+18).

## Suite (M1)
- **PR-04** garde-langage lintable (charte 09 §C, étend `scripts/check-doctrine.ts`).
- **PR-05** garde `assertDoctrineSafe` au rendu Bilan. **PR-05b** RGPD transfert hors-UE.
- Puis PR-06→08 (silence, EmptyState, OfflineBanner), **PR-09 = 1er STOP-schéma**
  (`support_tickets`/`messages`) → **accord Gabin requis**.
