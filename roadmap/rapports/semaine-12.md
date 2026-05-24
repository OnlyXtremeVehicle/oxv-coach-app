# Rapport semaine 12 — Intégration trackviz doctrinale (vraies marges par virage)

**Date** : 25 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : **Le mock `mockCornerMargins` est mort.** Les écrans #14 Carte, #15 Zoom virage et #16 Prochaine fois lisent désormais de vraies marges par segment quand la session a été analysée. Doctrine tenue : pas de verdict, pas de score affiché, pas de verbe directif dans le module.

---

## Ce que j'ai fait

### Jour 1 — Migration 0012 + structure trackviz

**Migration [`supabase/migrations/0012_app_segment_analyses.sql`](../supabase/migrations/0012_app_segment_analyses.sql)** (appliquée en prod via MCP) :

- Table `app_segment_analyses` — 1 ligne par `(telemetry_session_id, segment_index 1..14)`
- Stats physiques : `entry_speed_kmh`, `apex_speed_kmh`, `exit_speed_kmh`, `min/max/avg_speed_kmh`, `max_g_lateral`, `max_g_braking`, `max_g_accel`
- Stats trajectoire : `avg_lateral_error_m`, `max_lateral_error_m`
- **Doctrine** : `margin_percent` numeric(5,2) + `margin_zone` text CHECK in ('green', 'yellow', 'red') — cohérent avec `marginZoneOf`
- `UNIQUE (telemetry_session_id, segment_index)` pour idempotence des recalculs
- 4 policies RLS own-row CRUD + delete admin only (calqué sur `app_session_analyses`)

`src/types/database.types.ts` régénéré (la 7ème fois, c'est devenu rituel).

**Module [`src/trackviz/`](../src/trackviz/)** créé en partant du code partagé sem 11, mais **réécrit pour respecter la doctrine** :

- [`hauteSaintonge.ts`](../src/trackviz/hauteSaintonge.ts) — polyline interpolée à partir des 14 `BELTOISE_CORNERS` : 3 points par virage (entrée pondérée 70/30 vers le précédent, apex exact, sortie pondérée 60/40 vers le suivant) → ~42 points GPS. `HAUTE_SAINTONGE_SEGMENTS` : 14 segments uniformes (1 par virage, `progressStart`/`progressEnd` = `i/14` / `(i+1)/14`, `apexProgress` au centre). Note explicite dans le header : **V1 placeholder, calibration topométrique précise renvoyée sem 13+** quand vous fournirez les vrais relevés.

- [`types.ts`](../src/trackviz/types.ts) — `TrackVizSample`, `TrackVizSegmentDefinition`, `TrackVizSegmentAnalysis`, `TrackVizAnalysisResult`. **Différence assumée avec le code partagé : aucun champ `verdict`, aucun champ `score`.** Juste les stats brutes + `marginPercent`/`marginZone`.

### Jour 2 — Géométrie + analyse

**[`src/trackviz/geometry.ts`](../src/trackviz/geometry.ts)** (logique préservée du code partagé, vocabulaire adapté) :

- `buildTrackGeometry(points)` — calcule les distances cumulées segment par segment (haversine via `@/utils/geo`)
- `mapMatchPoint(point, geometry)` — projection orthogonale du point GPS sur chaque sous-segment de la polyline, garde le plus proche. Renvoie `{ progress 0..1, distanceM, lateralErrorM, nearestSegmentIndex }`
- `segmentForProgress(progress, segments)` — quel segment contient ce progress ?
- `phaseForProgress(progress, segment)` — `entry` / `apex` (bande ±18% autour de l'apex) / `exit` / `straight`
- `TrackProjection` — classe utilitaire pour projeter un point GPS en coords locales 2D (mètres autour de l'origine du tracé), pour le SVG. Y inversé (cohérence SVG bas-droite).

**[`src/trackviz/analysis.ts`](../src/trackviz/analysis.ts)** (logique préservée, **scoring 0-100 et verdicts retirés**) :

- `normalizeTrackVizSamples` — enrichit chaque sample brut avec `progress`, `distance_m`, `lateral_error_m`, `phase`
- `analyzeSegment` — stats par segment : speeds (entry / apex via percentile 25 sur fenêtre ±1.8% autour de l'apex / exit), max G_lat, max G_braking, max G_accel, avg & max lateral_error
- `computeSegmentMargin` — **marge composite doctrinale V1** :
  - 50 % précision trajectoire — `max_lateral_error / 4 m` (seuil "dispersion")
  - 50 % sécurité pneumatique — `max_G_lat / 1.2 g` (seuil "limite confortable")
  - `margin = 100 × (1 − 0.5 × trajectoryUsage − 0.5 × tyreUsage)`, clampée [0, 100]
  - Sem 13+ enrichira avec smoothness (jerk) et stabilité dynamique (sous/sur-virage) selon le doc algos P2
- `analyzeTrackVizSession` — découpe la session en 14 analyses + un `summary` agrégé (sampleCount, durationSeconds, maxSpeed, maxGLat, maxBraking, maxAccel, avgLateralError)
- `buildDemoTrackVizSamples` — 240 samples cohérents avec le tracé Beltoise (vitesse modulée par phase, G_lat sinusoïdal dans les virages) pour tests sans device

### Jour 3 — Service + composant + intégration

**[`src/services/segmentAnalysesService.ts`](../src/services/segmentAnalysesService.ts)** (203 lignes) :

- `listSegmentAnalyses(sessionId)` — toutes les analyses de la session, ordre `segment_index`
- `getSegmentAnalysis(sessionId, segmentIndex)` — une analyse précise
- `upsertSegmentAnalyses(sessionId, userId, segments)` — bulk upsert sur `(telemetry_session_id, segment_index)`
- `persistTrackVizAnalysis(sessionId, userId, result)` — convertit un `TrackVizAnalysisResult` complet en N rows et persiste tout d'un coup
- **`getCornerMarginsZones(sessionId)`** — format compatible avec `selectFocusCorner` (`{ zone, numeric }` par segmentIndex). Renvoie `null` si rien en base → l'UI fallback sur `mockCornerMargins`

**[`src/components/TrackVizMap.tsx`](../src/components/TrackVizMap.tsx)** (235 lignes) — adapté du composant partagé avec **nos tokens** :

- ViewBox calculée depuis `TrackProjection` (mètres locaux centrés sur le tracé) + padding 10%
- Tracé de référence en pointillés `colors.border.medium` (4-4)
- Trajectoire pilote en **heatmap par vitesse** : palette `colors.margin.{red, yellow, green}` (rouge < 30% maxSpeed, jaune entre, vert > 70% maxSpeed)
- Segment sélectionné surligné en **blanc** au-dessus de la heatmap
- Apex marqués par cercles vides `colors.text.tertiary`
- Tokens partout : `typography.eyebrow`, `fontFamily Menlo` pour les chiffres, `colors.background.primary`
- **PAS d'affichage de verdict, de score, ou de barre de progression "performance"**. Juste la donnée brute, le pilote interprète.

**Intégrations** :

- **[`app/(app)/carte.tsx`](../app/(app)/carte.tsx)** — au mount avec un `sessionId`, appel `getCornerMarginsZones(sessionId)`. Si la réponse est non-null → utilisation des vraies marges. Sinon → fallback `mockCornerMargins`. La pastille couleur sur chaque virage reflète donc maintenant la réalité de la session si elle a été analysée.
- **[`app/(app)/virage.tsx`](../app/(app)/virage.tsx)** — section Physique remplie depuis `app_segment_analyses` : vitesse entrée / G_lat max / vitesse sortie. Section Trajectoire : écart latéral moyen + max au tracé de référence. Zone + label colorisés depuis la vraie marge. Fallback texte pédagogique si pas de stats encore.
- **[`app/(app)/prochaine-fois.tsx`](../app/(app)/prochaine-fois.tsx)** — `selectFocusCorner` reçoit maintenant les vraies marges (numeric pour le tie-break) si dispo, sinon fallback mock. La règle "rouge > jaune > rien" du test anti-verbes-interdits tient toujours.

### Jour 4 — Tests + lint propre

**[`src/trackviz/__tests__/geometry.test.ts`](../src/trackviz/__tests__/geometry.test.ts)** — 14 tests :

- `buildTrackGeometry` — longueur totale dans [500, 3500] m, `cumulativeDistances` croissantes
- `mapMatchPoint` — projette `track[0]` en progress ≈ 0 / erreur < 1 m, clamp [0, 1], détecte erreur élevée (> 50 m) pour un point ~200 m hors tracé
- `segmentForProgress` — bornes (0 → premier, 1 → dernier), milieu (0.5)
- `phaseForProgress` — apex/entry/exit selon position relative à l'apex
- `TrackProjection` — centre du tracé projeté à |x|, |y| < 2000 m de l'origine
- `analyzeTrackVizSession` sur demo — 14 segments, marges toutes dans [0, 100], summary cohérent (sampleCount, durationSeconds > 0, maxSpeed > 100 km/h)

Cleanup lint : un warning `Array<T>` dans `analysis.ts` corrigé en `T[]`. **Retour à 4 warnings legacy V1 only** (3 `any` + 1 `Array<T>` dans `sessionsService.ts` — code récupéré V1, à toiletter sem 13).

### Jour 5 — Ce rapport

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : **0 erreur**
- [x] `npm run lint` : **0 erreur, 4 warnings legacy V1** (inchangés)
- [x] `npm run format:check` : tout conforme
- [x] `npm test` : **75/75 tests** (61 + 14 trackviz)
- [x] Migration `0012_app_segment_analyses` appliquée en prod
- [x] Types regenerés depuis Supabase

Pas validable sans device + session réelle :
- [ ] Wire `analyzeTrackVizSession` sur le flux post-session réel (cron Edge Function ou trigger end-of-session côté app) — sem 13
- [ ] Vérifier que le map-matching tient sur une vraie trace GPS Beltoise (la polyline V1 est interpolée, pas relevée)
- [ ] Visualiser le `TrackVizMap` avec une vraie trajectoire (la heatmap n'a tourné que sur la demo)
- [ ] Confirmer que les seuils 4 m / 1.2 g de `computeSegmentMargin` produisent des marges cohérentes avec votre ressenti pilote

---

## État après sem 12

| Brique | État |
|---|---|
| 26 écrans pilote | ✅ codés |
| 3 vues admin bronze | ✅ codées |
| 3 overlays système (offline / BLE / update) | ✅ codés |
| Module trackviz (geometry + analysis) | ✅ codé, testé sur demo |
| TrackVizMap composant | ✅ codé, intégré #14 et indirectement #15 |
| Vraies marges par virage | ✅ branchées #14 #15 #16 (fallback mock V1) |
| State machine S1-S10 + 10 stores | ✅ |
| Pipeline BLE RaceBox + parser UBX + lapDetection | ✅ (sans device) |
| Géoloc foreground + transitions automatiques | ✅ |
| Offline queue + retry policy | ✅ |
| Migrations 0001-0012 | ✅ en prod |
| 75 tests Jest | ✅ |

**33 commits, 0 dette technique bloquante.**

---

## Questions pour Gabin

### Q33 — Vrais relevés topométriques Beltoise

Notre polyline trackviz V1 est interpolée à partir des 14 apex placeholder de `circuitTopology.ts`. Le map-matching tient mathématiquement, mais l'erreur latérale moyenne sur une vraie session risque d'être faussée (le tracé de référence n'est pas le vrai tracé).

Pour la sem 13 / test alpha juillet, il faudrait soit :

- **A — Une trace GPS de référence** : un tour "optimal" enregistré par un pilote confirmé OXV (Beltoise lui-même ?), qu'on importe comme nouvelle polyline `HAUTE_SAINTONGE_TRACK`. Idéal.
- **B — Un relevé topométrique** : les vraies coordonnées GPS du tracé (chaque 5-10 m), depuis une carte officielle ou un GPS différentiel. Plus précis mais plus lourd.
- **C — Garder l'interpolation V1** pour le test alpha, calibrer après. Le pilote verra une marge approximative, c'est mieux que rien.

Recommandation : **C en test alpha, A après**, si vous avez accès à une trace propre.

### Q34 — Quand déclencher `analyzeTrackVizSession` ?

Le module calcule, mais personne ne l'appelle encore après une session réelle. Trois options :

- **A — Côté app, end-of-session** : à la fin du roulage (ou au retour box), l'app lit les samples du `.ubx` local, lance `analyzeTrackVizSession`, persiste via `persistTrackVizAnalysis`. Synchrone, l'utilisateur attend ~2-3 s.
- **B — Edge Function Supabase, post-upload** : trigger sur upload `.ubx` → fonction qui parse + analyse + persiste. Asynchrone, l'utilisateur ne sait pas. Bilan disponible quand il revient sur l'app.
- **C — Trigger PG sur insert `telemetry_sessions.status='completed'`** : impossible (le `.ubx` est dans Storage, pas en SQL).

Recommandation : **A pour V1** (plus simple, pas d'infra additionnelle), B pour V1.1.

### Q35 — Seuils marge composite à valider

`computeSegmentMargin` utilise 4 m de seuil lateral_error et 1.2 g de seuil G_lat. Ces valeurs viennent du doc algos P2 (sem 5). Sur la demo, les marges segment tombent souvent dans [50, 80]%, ce qui semble cohérent (pilote demo = "à l'aise, marge présente"). Mais ces seuils restent **théoriques** — il faudrait calibrer sur 5-10 vraies sessions pour valider que la distribution des zones reflète bien le ressenti pilote.

Action : noter pour sem 14 (post-alpha) de réviser les seuils à partir des sessions du 5 juillet.

---

## Recommandations

### R34 — Câbler le déclenchement de l'analyse en sem 13

Le module trackviz est inerte si rien ne l'appelle. Sem 13 j'ajouterai un call dans le flow post-session (option A ci-dessus) pour qu'un retour box → bilan utilise systématiquement les vraies marges. Sinon on garde un mock-en-fallback éternel.

### R35 — Le test alpha 5 juillet 2026 est dans **6 semaines**

Il reste : (1) câblage analyse post-session, (2) Edge Function `generate_debrief` (ou fallback), (3) push notifs, (4) calibration BLE sur vrai RaceBox, (5) tests sur device iPhone + Android, (6) soumission TestFlight interne, (7) docs alpha pilotes. Sem 13 sera **dense**, sem 14 polish + soumission. Pas de marge confortable.

### R36 — Pousser sur GitHub avant le diff sem 13

Comme dit en R31 (sem 11), c'est le dernier moment où le diff reste digérable. Sem 13 risque d'ajouter Edge Functions, push notifs, refactor flow post-session → diff massif.

---

## Estimation pour la semaine 13

Sem 13 originellement = "Tests internes". Mais il y a du wire restant et l'alpha approche. Proposition :

- **J1** — Câbler `analyzeTrackVizSession` sur le flow post-session (option A) + tests d'intégration
- **J2** — Edge Function `generate_debrief` (option A de Q31) ou fallback finalisé selon votre choix
- **J3** — Push notifs Expo (sem alpha → notifs J+1 debrief + reminder veille session)
- **J4** — Calibration BLE sur RaceBox réel (si dispo) + smoke tests device
- **J5** — Build EAS interne + rapport sem 13

5 jours-claude pleins, blocants externes : RaceBox + compte EAS + DSN Sentry + push notifs setup.

---

## En résumé

Le code trackviz partagé sem 11 est **digéré, adapté, intégré**. Le `mockCornerMargins` est un fallback, plus une muletter principale. Les 14 segments de Beltoise ont chacun leur marge composite quand l'analyse a tourné, et l'app affiche le réel sans rien inventer.

Doctrine tenue à 100 % : zéro verdict, zéro score affiché, zéro verbe directif dans le module. La marge composite est **le** chiffre, et c'est le seul.

L'app est prête à recevoir une vraie session de roulage. Reste à câbler le déclencheur (sem 13).

— Claude Code, 25 mai 2026
