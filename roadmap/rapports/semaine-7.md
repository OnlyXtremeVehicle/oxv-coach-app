# Rapport semaine 7 — Prochaine fois + Progression + mi-parcours

**Date** : 24 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : **MI-PARCOURS** — fin de la Phase 3 (cœur de l'app). Les 5 écrans principaux sont là. Audit dev senior humain recommandé avant de poursuivre.

---

## Ce que j'ai fait

### Jour 1-2 — Écran #16 La prochaine fois

**[src/services/focusCorner.ts](src/services/focusCorner.ts)** — heuristique doctrinale :

- `selectFocusCorner(marginByCornerIndex, numericMarginByCornerIndex?)` — priorité **rouge > jaune le plus faible > rien**. Si plusieurs candidats de même zone, on prend le plus petit margin numérique.
- `selectExplicitFocusCorner(cornerIndex, zone, ?numericMargin)` — variante quand le pilote sélectionne lui-même un virage (V1.1).
- Phrases et observations contextualisées par zone + `pace` du virage (`slow` → freinage, `fast` → patience à la corde, `medium` → question ouverte).

**9 nouveaux tests** ([focusCorner.test.ts](src/services/__tests__/focusCorner.test.ts)) dont **un test anti-verbes-interdits** qui vérifie que ni `phrase` ni `observation` ne contiennent "freinez", "accélérez", "ouvrez les gaz", "tracez", "évitez", "il faut", "vous devez". C'est doctrinal et testé.

**[app/(app)/prochaine-fois.tsx](app/(app)/prochaine-fois.tsx)** — écran #16 :
- Eyebrow `LA PROCHAINE FOIS`
- Phrase principale en `headline` 32pt weight 200 — *"Le S des chênes vous tend les bras."*
- Observation italique non-directive — *"Marge estimée 16%. La prochaine fois, peut-être un peu plus de patience à la corde ?"*
- Boutons `Compris` (primaire rouge OXV) + `Plus tard` (secondaire bordé)
- Signature en bas, caption italic tertiary : *"Une chose. Pas plus."*
- État `NoFocusState` quand `selectFocusCorner` renvoie `null` : *"Confortable partout. / Aucune zone ne ressort. Continuez comme ça."*

Pas de persistance "Compris" en V1 (les deux boutons font `router.back()`). Une colonne `acknowledged_at` peut venir en V1.1 si vous voulez tracker le taux de lecture.

### Jour 3-4 — Écran #17 Progression + service enrichi

**[src/services/analysesService.ts](src/services/analysesService.ts)** — ajout :
- `listRecentAnalyses(userId, limit=50)` qui fait un join `telemetry_sessions(started_at, circuit_name)` pour ordonner sur l'axe X et afficher le nom du circuit. Retourne `RecentAnalysisRow[]` enrichi.

**[app/(app)/progression.tsx](app/(app)/progression.tsx)** — écran #17 :

- Eyebrow `PROGRESSION` + titre `Vous avancez.` (manifeste fixe, doctrine)
- `GranularityPicker` — 3 boutons toggle : **Semaine / Mois / Tout**, état actif en accent rouge subtil
- **Line chart SVG natif** (`react-native-svg`), viewBox 320×180 :
  - 3 bandes de fond colorisées : verte (> 30%) opacité 8%, jaune (15–30%) opacité 10%, rouge (< 15%) opacité 10%
  - Courbe `<Path>` blanche stroke 2pt, line-cap round
  - Points `<Circle>` r=3, fill noir, stroke blanc 1.5pt — design pellet visible sur fond noir
  - Dates min/max sous le chart en `caption` tertiary
- `StatsGrid` 3 cards : **Sessions / Marge moyenne / Meilleure**, chiffres en `titleLarge` weight 200
- **État vide pédagogique** si `analyses.length < 3` : *"Votre progression apparaîtra après 3 sessions complètes."* + caption nb de sessions courantes
- Cas intermédiaire : 3+ sessions au total mais < 2 sur la période filtrée → *"Pas assez de sessions sur la période sélectionnée."* (au lieu de masquer)

**Doctrine** : aucune comparaison avec d'autres pilotes nulle part. Le mot "leaderboard" et ses cousins n'existent pas dans le code.

### Jour 5 — Bout-en-bout + rapport + audit

**Pipeline pilote complet désormais opérationnel** :

```
Hub #20 ──► Bilan #13 ──► Carte #14 ──► Zoom virage #15
                       ├──► Détails virage (entrée directe) #15
                       ├──► La prochaine fois #16
                       └──► Progression #17
```

Toutes les NavCards du bilan (sem 5) pointent maintenant vers des écrans **qui existent** et qui rendent un contenu cohérent — plus de 404 sur les routes attendues.

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1 (sessionsService inchangé depuis 7 semaines, à nettoyer en sem 11-12 polish)
- [x] `npm run format:check` : ✅ tout conforme
- [x] `npm test` : ✅ **61/61 tests** en ~14s
  - 16 parser UBX
  - 19 state machine
  - 8 calc de marge
  - 9 geo→SVG
  - 9 focus corner
- [x] Le tri rouge > jaune > rien de `selectFocusCorner` est verrouillé par tests
- [x] L'anti-verbes-interdits est verrouillé par test

Pas validable sans device :
- [ ] Affichage de la courbe de progression sur device (qualité du rendu SVG, lisibilité des bandes colorées sur fond très sombre)
- [ ] Lisibilité de la phrase principale de #16 (32pt headline weight 200 — à valider à l'œil)
- [ ] Hit-test des 3 boutons granularité picker

---

## MI-PARCOURS — recommandation audit dev senior humain

`SEMAINES.md` recommande explicitement un audit par un développeur senior humain à ce stade (sem 6-7). **Je rejoins cette recommandation**. Vous avez codé 7 semaines avec un assistant IA — c'est le bon moment pour qu'un œil externe relise l'architecture avant qu'on consolide les semaines 8-14.

### Brief court à transmettre à l'auditeur

**Repo** : `oxv-coach-app` (à push sur GitHub avant l'audit). 23 commits, branche `main`.

**Stack** : Expo SDK 51, React Native 0.74, TypeScript strict, Zustand 5, react-native-svg 15, react-native-mmkv 4, react-native-ble-plx 3, @supabase/supabase-js, Sentry, expo-router 3.

**Pipeline** : Jest 29 + ts-jest, ESLint expo + Prettier, GitHub Actions (typecheck + lint + format + tests sur chaque PR).

**Périmètre audit recommandé** (1-2 jours, 800-1500 €) :

| Sujet | Fichiers | Question à poser |
|---|---|---|
| **Sécurité Supabase RLS** | `supabase/migrations/0001-0009`, `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql` | Les 80+ policies couvrent-elles tous les cas ? Les nouvelles `app_session_analyses` + `telemetry_raw` bucket suivent-elles le pattern propriétaire ? |
| **State machine** | `src/types/state.ts`, `src/store/useAppStateStore.ts`, `src/types/__tests__/state.test.ts` | La logique des 10 états S1-S10 est-elle correcte et complète ? Edge cases sur les transitions ? |
| **Pipeline BLE** | `src/ble/*.ts`, `src/components/BleErrorModal.tsx` | Reconnexion auto solide ? Memory leaks sur listeners non démontés ? Comportement Android 12+ (BLUETOOTH_SCAN/CONNECT runtime) ? |
| **Algo marge V1** | `src/services/marginCalculator.ts`, ses tests | Les seuils (1.0g, 1s stddev, 0.05g stddev) sont-ils défendables ? Risque d'overfitting ? |
| **Offline-first** | `src/lib/mmkv.ts`, `src/services/offlineQueue.ts`, `src/lib/netinfo.ts` | Le pattern queue + flush au retour réseau gère-t-il bien les race conditions ? Idempotence respectée côté actions ? |
| **TypeScript strict** | global | Pourquoi 4 warnings `any` dans `sessionsService.ts` (legacy V1) ? Quel coût à nettoyer ? |
| **Doctrine technique** | `CLAUDE.md`, `docs/sitemap/`, code | Le silence en piste (S6 = 0 écran valide) est-il vraiment garanti par le code (pas juste par discipline) ? Y a-t-il des paths d'échec qui pourraient afficher un écran pendant le roulage ? |

**Pas auditer** (encore) :
- Assets visuels (placeholders, designer en cours)
- Vrais écrans onboarding (sem 8) — la structure est là mais le contenu vient
- Algorithmes V2 (Pacejka, Kalman) — explicitement hors-scope V1

**Livrables attendus de l'auditeur** :
1. Rapport écrit (5-10 pages)
2. 2-3 recommandations **prioritaires** à intégrer en sem 8-9
3. 5-10 recommandations secondaires pour V1.1

**Profil idéal** : React Native + Supabase, 5+ ans XP, sensibilité produit (pas qu'un pur tech).

---

## Ce qui reste en suspens

Identique aux semaines précédentes :
- **Q9 — compte EAS** : sans build natif, le smoke test des 7 écrans codés reste théorique
- **Q5 — fixture .ubx** : sera utile pour les tests bout-en-bout du parser sur un vrai fichier
- **Q11 Sentry, Q12 Flic 2, Q13 test alpha, Q14-Q21** ouvertes

Nouveaux depuis le rapport sem 6 :
- **Détails circuit promis par Gabin** ("je t'envoie des détails du circuit après") — sem 8 je les intégrerai si arrivés (vrais noms virages Q19, SVG plus détaillé Q20, positions exactes pour calibration anticipée)

---

## Questions pour Gabin

### Q22 — Persistance "Compris" sur #16

Actuellement les deux boutons `Compris` et `Plus tard` font la même chose (back vers le bilan). Si vous voulez tracker le taux de lecture pour les pilotes, je peux :
- **A — Ajouter une colonne `next_focus_acknowledged_at`** dans `app_session_analyses` + un toggle dans le service
- **B — Le faire à l'usage post-stats** quand on aura des métriques d'engagement

Recommandation : B, pas urgent. La V1 doit déjà éviter de surcharger la base.

### Q23 — Bandes de fond du chart progression

J'ai mis les 3 bandes (vert 30%+, jaune 15-30%, rouge < 15%) avec opacité 8-10%. Sur un écran AMOLED ça doit être très subtil (peut-être trop). Quelques pilotes apprécieront peut-être de voir clairement la zone "à explorer" et la zone "terrain serré".

- **A — Opacité actuelle (8-10%)** — discret, ne pollue pas la courbe
- **B — Opacité 15-20%** — bandes plus visibles
- **C — Ligne pointillée aux seuils 15 et 30** plutôt que bandes pleines

À trancher à l'œil sur device.

---

## Recommandations

### R22 — Lancer l'audit avant la sem 8

Si vous trouvez un dev en cette semaine, l'audit fait pendant qu'on continue est l'idéal. Sinon c'est OK de continuer sans, je ne suis pas bloqué.

### R23 — Tester le bout-en-bout sur device dès que possible

Les 5 écrans principaux sont là, le pipeline est cohérent. Un test à l'œil sur device permettrait de valider :
- La hiérarchie typographique (eyebrow / titre / manifeste / caption)
- Les couleurs sur AMOLED (les bandes de fond, les pastilles)
- Les transitions entre écrans (fade par défaut, peut-être trop lent ou trop rapide)

R23 dépend de Q9 (compte EAS). Cercle vicieux.

### R24 — Préparer la sem 8 (onboarding) en relisant docs/juridique

L'onboarding (sem 8) implique :
- Écran #06 Pacte — texte issu de `docs/juridique/01_PACTE_DE_PILOTAGE.md`
- Écran #05 CGU/RGPD — `docs/juridique/02_CGU_APP_OXV_COACH.md` et `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md`

Je n'ai pas encore lu 02 et 04. Je le ferai en début sem 8.

---

## Estimation pour la semaine 8

Selon roadmap : **Onboarding écrans #01-06.**

- **J1** — Lecture docs juridique CGU + RGPD + ré-lecture pacte
- **J2** — #01 Accueil philosophique + #02 Doctrine
- **J3** — #03 Méthode + #04 Niveau pilote (4 niveaux, écrit dans `users.pilot_level`)
- **J4** — #05 CGU/RGPD (3 cases à cocher, horodatage Supabase) + #06 Pacte (signature, stockage horodatée)
- **J5** — Routing onboarding → app principale (logique `users.profile_completed_at`) + rapport

Estimation : **5 jours-claude**. Le contenu juridique étant figé, pas de complexité algorithmique.

---

## En résumé

**Mi-parcours du projet (sem 7 sur 14).** Les 5 écrans principaux du cœur de l'app sont en place. La doctrine est respectée à tous les niveaux du code — y compris testée (anti-verbes-interdits sur #16). 22 commits, 61 tests passants, 0 erreur lint, format conforme.

Le pipeline pilote tient debout de bout en bout sur la maquette : hub → bilan → carte → zoom → prochaine fois → progression. Avec les vraies données (`margin_breakdown` par virage en sem 8), les placeholders se rempliront sans toucher à la grammaire.

Recommandation forte : **audit dev senior humain maintenant** (cf. brief ci-dessus) avant qu'on attaque l'onboarding (sem 8) et les écrans secondaires (sem 9-10). C'est le bon moment.

— Claude Code, 24 mai 2026
