# Rapport — PR-13 · Matrice RLS rôle × télémétrie (dette P0-2)

> Backlog V6, jalon M1. Zéro schéma. Codifie la règle cardinale de la doctrine.

## Ce que j'ai fait
- **`src/__tests__/rls/roleMatrixRLS.test.ts`** — 3 scénarios verrouillant la
  **règle cardinale** (07_DATA_POLICY §148, « le partenaire ne voit JAMAIS la
  télémétrie ») :
  - NÉGATIF — un **partenaire** ne voit aucune `telemetry_sessions` ni `telemetry_frames` ;
  - NÉGATIF — un pilote ne voit pas la session d'un **autre** pilote ;
  - POSITIF — le pilote voit SA session.
- Échouerait si une migration ouvrait par erreur la télémétrie à un autre rôle.
  Skippés sans creds de test (pattern existant) ; complète la couverture coach
  (graduée), partenaire (marketplace), admin, support déjà testée.

## Reste de M1 — état honnête
- **PR-16** (export portabilité + suppression) : **déjà satisfait** — `dataExportService`
  exporte 11 tables, note les échecs, exclut les trames brutes (volume) avec mention
  « sur demande » (RGPD OK ; CSV dédié = PR-66) ; suppression J+30 conforme.
- **PR-17** (Plausible) : **déjà satisfait** — domaine `oxvehicle.fr` dans `eas.json`
  (preview+prod) et consommé par `analyticsService` (gated domaine + opt-out).
- **PR-15** (alignement UI consentement coach ↔ RGPD binaire) : **décision juridique**
  — l'accès coach est gradué (lecture_simple/détaillée/programme) ; savoir si le cadre
  RGPD exige un consentement binaire distinct relève de l'avocat. À trancher par Gabin,
  non modifié unilatéralement (doctrine : ne pas toucher au juridique sans accord).
- **PR-18/19** (build device + validation terrain) : **bloqués** par le quota EAS (1er juil.).

## Gates
- `tsc 0 · eslint 0 · jest 886` (+3 RLS skippés).
