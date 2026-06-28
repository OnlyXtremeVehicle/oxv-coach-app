# Rapport — PR-E · dataLabService (agrégateur) + File de lecture coach

> Audit CDC V2, P1 (§4.2, §6.2, §24). **Zéro schéma, zéro accord.** Deux écarts comblés.

## Part 1 — `dataLabService` (§4.2, §24)
- **`dataLabLogic.ts`** (pur, testé) : `deriveDataLabAvailability({found, frameCount, validLapCount, cornerCount})` → couches activables (trajectoire/vitesse/G/régularité) + **état vide honnête** (« Session introuvable. » / « pas encore assez de matière pour être relue. » — copie §12).
- **`dataLabService.ts`** : `getDataLabSessionView(sessionId)` assemble depuis l'existant (`telemetry_sessions.total_frames`, tours, analyses de segment) — **aucune table**. Best-effort.
- **`data-lab.tsx`** : charge la vue ; affiche la bannière d'état vide ; annote chaque couche d'un « Pas de données pour cette session » quand elle est vide (cartes **restent tappables** — les écrans-feuilles gardent leur propre état vide). Comble le « workspace éclaté §4.2 » sans casser les feuilles.
- **Test** `dataLabService.test.ts` : 5 cas sur la logique pure (couches + état vide).

## Part 2 — File de lecture coach (§6.2)
- **`coachService.loadReadingQueue()`** : **une seule requête** `telemetry_sessions` (RLS = pilotes consentis) + map nom pilote + set des sessions déjà annotées par le coach → entrées `{sessionId, pilotName, circuitName, startedAt, annotated}`. **Ni N+1, ni log d'accès par pilote.** Tri : non lues d'abord, puis récentes.
- **`(coach)/file-lecture.tsx`** : sections **À LIRE — N** (puce coach) puis **DÉJÀ LUES** ; un tap ouvre la fiche pilote `(coach)/pilote/[id]`. Lecture seule, accent coach neutre, aucune injonction.
- Lié depuis le **hub coach** (carte « File de lecture » sous le bandeau 24 h).

## « Lu / non-lu » sans schéma
Proxy honnête : une session est « lue » dès que le coach l'a **annotée** (présence d'une `coach_annotations`). Aucune colonne ajoutée.

## Doctrine
- Pilote : data descriptive, états vides honnêtes (jamais maquillés), aucun or décoratif ajouté.
- Coach : miroir aussi pour lui (il voit ce que le pilote vit), lecture seule, vouvoiement.

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 812 (+5 dataLab).

## En suspens — build requis + raffinements
- Deep-link **session** (au lieu de la fiche pilote) quand l'écran de lecture coach par session sera cadré.
- `telemetry_frames = 0` → la plupart des couches afficheront « pas de données » jusqu'à Valence (honnête).
