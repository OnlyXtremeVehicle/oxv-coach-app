# Rapport — PR-05 · Garde de rendu du débrief (Bilan)

> Backlog V6, jalon M1. Défense en profondeur : le rendu ne fait jamais
> aveuglément confiance à `debrief_text`. Zéro schéma.

## Ce que j'ai fait
- **`src/services/debriefRenderGuard.ts`** (pur) — `guardDebriefActs(acts)` : blanchit
  tout acte (act1/act2/act3) contenant une tournure prescriptive, pour qu'il ne soit
  jamais affiché. L'écran retombe alors sur son texte d'attente neutre. Préserve les
  autres champs (`sign`).
- **`src/components/DebriefMirror.tsx`** — le `useMemo` qui parse le débrief applique
  désormais `guardDebriefActs(parseActs(debrief_text))`.

## Pourquoi au rendu (en plus de PR-01)
La génération locale est déjà filtrée (PR-01), mais `debrief_text` peut arriver par un
chemin non maîtrisé : edge OpenAI, écriture manuelle, donnée historique. Le rendu blanchit
ce qui n'est pas conforme — couche indépendante, testable hors composant.

## Tests
- 3 tests `guardDebriefActs` (conforme / acte prescriptif blanchi / `sign` préservé).
- `tsc 0 · eslint 0 · jest 880` (+3).

## Suite (M1)
- **PR-05b** RGPD transfert IA hors-UE (gate `ai_debrief_enabled` + opt-in) — touche
  l'edge + le centre de consentement.
- PR-06→08, puis **PR-09 = 1er STOP-schéma** (`support_tickets`/`messages`) → accord Gabin.
