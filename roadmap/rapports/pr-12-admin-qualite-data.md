# Rapport — PR-D · Admin Qualité Data + Équipements

> Audit CDC V2, P1 (§7, §7.1, §22, §25, DoD §30.7). Décision Gabin : **portée complète, 4 tables**.

## Schéma (migration `0016`, appliquée en prod)
- **`devices`** : parc d'équipement (label, type `racebox/flic/battery/other`, serial, `battery_status`, `health_status`, notes). RLS **admin-only**, `updated_at` auto.
- **`device_assignments`** : affectation boîtier ↔ session/pilote/événement (`device_id`, `session_id`, `pilot_id`, `event_id`, `assigned_by`, `assigned_at`). RLS admin-only + index.
- **`telemetry_sessions.source_device_id`** → `devices` (traçabilité par boîtier).
- **`data_quality_reports`** : état suivi des anomalies (`severity`, `type`, `status` open/assigned/resolved, `owner_admin_id`). RLS admin-only + index.

Toutes les nouvelles tables : **une seule policy `*_admin_all` (`is_admin()`)** → invisibles à tout pilote/coach/partenaire (deny-by-default).

## Détection (zéro table de détection)
`adminQualityService.detectSessionAnomalies()` **dérive** les anomalies des données existantes (`telemetry_sessions` + `app_session_analyses`) :
- `no_frames` (critique), `recording_stuck` (recording non clôturé), `analysis_missing`, `no_debrief`.

`data_quality_reports` ne sert qu'à l'**état suivi** : `createQualityReport` (tag), `setReportStatus` (résolu), `listQualityReports`.

## Écran `app/(admin)/qualite-data.tsx`
- Compte « sessions à surveiller » + liste : par session, les anomalies (puce colorée par sévérité) + action **Suivre** (crée un rapport).
- Section **Suivis en cours** + action **Résolu**.
- Lié depuis le hub Admin. Doctrine : sobre, bronze = rôle admin ; le **rouge code la sévérité critique technique** (surface admin), jamais le pilote.

## Tests
- `adminTablesRLS` : un pilote ne voit ni `data_quality_reports`, ni `devices`, ni `device_assignments` ; un admin voit les rapports. (Skippé hors `TEST_SUPABASE_*`.)
- `tsc` 0 · `eslint` 0 · `jest` 807 (types régénérés proprement, 4 tables).

## Hors scope (assumé, suite possible)
- Écran **Équipements** complet (CRUD `devices` + affectations) : les tables sont prêtes ; l'UI d'admin équipement est une ébauche (le service Qualité Data ne lit pas encore `devices`). À faire quand il y a du matériel réel.
- « Relancer l'analyse » depuis l'écran (rappel `analyzeAndPersistSession`) : noté, hors scope strict.
- Réserve : `telemetry_frames = 0` → l'écran montrera surtout `no_frames`/`no_debrief` tant qu'aucune capture réelle (mode démo jusqu'à Valence).

## En suspens — build requis
- Rendu + parcours (suivre → résoudre) sur device, avec un compte admin.
