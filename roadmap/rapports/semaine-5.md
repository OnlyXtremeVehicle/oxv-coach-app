# Rapport semaine 5 — Hub #20, bilan #13, algo marge V1

**Date** : 24 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : Cœur de l'app commence. 5 jours livrés. Premier vrai écran d'analyse en place.

---

## Ce que j'ai fait

### Jour 1 — Lecture des algos + migration `app_session_analyses`

**Lecture intégrale** de [docs/architecture/02_PARTIE_2_algorithmes.md](docs/architecture/02_PARTIE_2_algorithmes.md) (788 lignes). Synthèse :

- **Pacejka complet, Kalman, optimal lap time** → V2, hors scope V1
- **V1 obligatoire** : marge véhicule simple (μ_eff), smoothness via jerk, détection sous/sur-virage
- **V1 simplifié** que j'ai retenu pour cette semaine : marge véhicule = % G_lat non utilisé, marge pilote = régularité + smoothness, marge composite pondérée 40/60

La doc liste explicitement ce que RaceBox Mini **ne mesure pas** (pression frein, position gaz, régime moteur, angle braquage). On dérive depuis ce qu'on a, avec une honnêteté affichée : précision attendue 70-85% — adapté à la pédagogie OXV, pas à la compétition stricte.

**Migration 0009** appliquée en prod :
- Table `app_session_analyses` (margin_global, zone, vehicle, pilot, breakdown jsonb)
- UNIQUE (`telemetry_session_id`) pour idempotence
- 4 policies RLS (own row pour CRUD, delete admin only)
- Types TypeScript régénérés depuis Supabase

### Jour 2 — Service circuits + utilitaire time

**[src/services/circuitsService.ts](src/services/circuitsService.ts)** :
- `fetchCircuits(forceRefresh)` — cache-first MMKV (TTL 24h), fallback stale si Supabase répond avec erreur
- `getDefaultCircuit()` — renvoie Haute Saintonge officiel (hors BACKUP), utilisé en V1 partout où on a besoin de la finish line ou du SVG tracé

**[src/utils/time.ts](src/utils/time.ts)** :
- `timeBasedGreeting()` — Bonjour de 5h à 17h59, Bonsoir sinon (pas de "Bonne nuit" pour ne pas sonner fin-de-journée si l'app s'ouvre tard)
- `formatChronoMs()` — MM:SS.mmm
- `timeAgoFr()` — "à l'instant", "il y a X min/h/jours/sem/mois/ans"
- `daysUntil()` — arrondi à l'entier supérieur

### Jour 3-4 — Algo marge composite V1 + tests

**[src/services/marginCalculator.ts](src/services/marginCalculator.ts)** — formule V1 :

```
Marge véhicule  = (1 − G_lat_observé / G_lat_max) × 100
Marge pilote    = 0.6 × régularité + 0.4 × smoothness
                  où régularité  = f(stddev des temps au tour)
                       smoothness = f(stddev des G_lat max par tour)
Marge globale   = 0.4 × véhicule + 0.6 × pilote
```

**Pondérations** :
- 40/60 véhicule/pilote — c'est le pilote qu'on évalue, pas la voiture. La voiture est un input, pas un sujet.
- 60/40 régularité/smoothness — la régularité prime, c'est le signal le plus stable et le plus exigible.

**Seuils** (calibrables) :
- stddev temps au tour ≤ 1s → régularité 100 ; ≥ 5s → 0
- stddev G_lat ≤ 0.05g → smoothness 100 ; ≥ 0.55g → 0
- Outlap et inlap **exclus** du calcul pilote

**[src/services/__tests__/marginCalculator.test.ts](src/services/__tests__/marginCalculator.test.ts) — 8 tests** :
- Session vierge → 100 zone verte
- Pilotage régulier loin de la limite → vert
- Véhicule saturé + tours très irréguliers → rouge (< 15%)
- Exclusion outlap/inlap (validLapCount n'inclut que les tours utiles)
- Véhicule au-delà limite → marge véhicule 0
- Pondération vérifiée (40/60)
- Clamp [0, 100] sur inputs aberrants
- `DEFAULT_VEHICLE` appliqué si pas de paramètres

Total : **43 tests passants** (16 parser + 19 state + 8 marge).

### Jour 4 — Service analyses + écran #20 (hub)

**[src/services/analysesService.ts](src/services/analysesService.ts)** :
- `getAnalysisForSession(sessionId)` — lit `app_session_analyses` ou retourne null
- `upsertAnalysis({sessionId, userId, result})` — upsert idempotent via la contrainte UNIQUE
- Mappers row → camelCase TypeScript

**[app/(app)/index.tsx](app/(app)/index.tsx)** — réécrit en écran **#20 Hub** :

3 modes calculés depuis `useAppStateStore.state` :
- `S5_approche` → ModeEnroute : "Bon trajet vers Beltoise. Coupez l'app. Je conduis."
- `S4_anticipation` → ModeCountdown : placeholder en V1 (wire-up `upcomingSessions` viendra sem 8)
- Sinon → ModePassive : greeting heure-dependent + card "Votre dernier bilan" si dispo (fetch direct Supabase), sinon "Votre première session écrira la première ligne."

Le lien `Mode debug — capture UBX` reste visible sous `__DEV__`. Bouton "Se déconnecter" déplacé en bas dans le ton tertiary (moins agressif que le bouton entouré rouge précédent).

### Jour 5 — Écran #13 (bilan)

**[app/(app)/bilan.tsx](app/(app)/bilan.tsx)** — premier vrai écran d'analyse OXV :

Logique :
1. Lit la session cible — param `sessionId` ou la dernière complétée du user
2. Cache-first : si `app_session_analyses` existe pour cette session, on l'utilise
3. Sinon : compute via `marginCalculator` + `upsertAnalysis` en arrière-plan (best-effort, échec non bloquant)
4. Affiche selon la grammaire doctrinale

Rendu :
- Eyebrow `BILAN DE SESSION`
- Chiffre central géant (`heroNumber` 120pt, weight 200), colorisé selon la zone (vert/jaune/rouge)
- Étiquette humaine ("Confortable", "À explorer", "Terrain serré") même couleur
- Manifeste italique contextuel selon la zone :
  - vert : *"Belle séance. Vous avez du terrain à explorer en sécurité."*
  - jaune : *"Belle séance. Une zone à creuser la prochaine fois."*
  - rouge : *"Vous avez touché vos limites. C'est noté."*
- 4 NavCards vers `#14 Carte`, `#15 Détails par virage`, `#16 La prochaine fois`, `#17 Progression` — routes à venir sem 6-7, tap → `+not-found` en attendant
- Bouton "Retour" discret

États distincts :
- Loading : spinner discret
- Empty (pas de session) : "Aucune session encore. Votre première session écrira la première ligne."
- Error : message d'erreur + retour

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1
- [x] `npm run format:check` : ✅ tout conforme
- [x] `npm test` : ✅ 43/43 tests en ~14s
- [x] `app_session_analyses` accessible côté Supabase prod
- [x] Le compute marge passe sur des inputs synthétiques variés (vérifié par les 8 nouveaux tests)

Pas validable sans device + un compte avec session :
- [ ] Affichage du hub avec un greeting personnalisé réel
- [ ] Affichage du bilan calculé en live pour une session existante (vous avez ≥1 telemetry_session de test)
- [ ] Persistance dans `app_session_analyses` au premier calcul
- [ ] Re-ouverture du bilan : doit lire depuis la base (pas recalculer)

---

## Ce qui reste en suspens

### Bloqué côté vous (rappels)

- **Q9 — Compte EAS** : toujours le vrai goulot pour tester sur device
- **Q5 — Capture fixture .ubx** : pas urgent mais utile
- **Q11 — Sentry DSN** : à activer avant sem 12
- **Q12 — Flic 2 matériel** : pour sem 7-8
- **Q13 — Test alpha 5 juillet** : à arbitrer (lecture des docs alpha)

### Wiring incomplets, à finir sem 6+

- `useAppStateStore.upcomingSessions` et `.pastSessions` ne sont pas alimentés depuis Supabase → mode countdown du hub reste générique
- Le mode "enroute" suppose qu'on a `S5_approche`, qui suppose une position GPS active (pas branché en V1)
- Les 4 NavCards du bilan pointent vers des routes qui n'existent pas encore — sem 6 fera #14 et #15

---

## Questions pour Gabin

### Q16 — Calibration `maxGLateral` du véhicule

Actuellement `DEFAULT_VEHICLE.maxGLateral = 1.0g` (profil route sportive). Pour une GT3 sur Beltoise ça serait plutôt **1.4g**. Pour une berline familiale plutôt **0.9g**.

Trois options :
- **A — Garder 1.0g** comme défaut neutre pour V1, calibration manuelle V2
- **B — Permettre au pilote de choisir** une catégorie véhicule en onboarding (sem 8), stockée dans `users.preferred_vehicle_category` (nouvelle colonne)
- **C — Calibrer automatiquement** à partir des max G observés sur les 5 premières sessions (apprentissage adaptatif)

**Ma recommandation** : A pour la V1, et on garde B/C en V1.1 pour ne pas surcharger la sem 8 d'onboarding. À l'usage, certains pilotes verront leur marge véhicule sortir négative (clampée à 0) sur les premiers passages — c'est OK, c'est un signal "vous êtes au-delà du profil par défaut, on va affiner".

### Q17 — Persistance en cas de re-calcul

Si vous mettez à jour l'algo (sem 6+ avec sous/sur-virage, V2 avec transfert de charge), les analyses existantes ont l'ancien `algo_version`. Question : on les recalcule automatiquement à l'ouverture, ou on les laisse figées comme historique de leur date ?

**Ma recommandation** : les laisser figées (`algo_version` est dans la table). À l'ouverture, si `algo_version < current`, afficher un message discret "Recalculer avec la dernière version" — opt-in pilote. Pas urgent, à acter sem 11-12 (polish).

### Q18 — Personnalisation du manifeste

Les 3 phrases (vert/jaune/rouge) sont génériques. Vous voulez :
- **A — Les garder ainsi** (simple, prévisible, doctrinal)
- **B — Une variante par tier Heritage** (Access plus pédagogique, Heritage plus sobre)
- **C — Génération OpenAI à chaque session** (sem 11, debrief J+1 fait déjà ça pour son texte littéraire)

**Recommandation** : A en V1, C plus tard si vous voulez du texte unique par session (mais payload OpenAI à chaque session, à intégrer dans le pipeline Edge Function du debrief J+1).

---

## Recommandations

### R17 — Tests visuels manuels dès que vous avez le build dev

Quatre cas à valider à l'œil sur device :
1. Login → hub passif greeting "Bonsoir, {first_name}." + pas de card (compte sans session)
2. Login → hub avec card "Votre dernier bilan" (compte avec ≥1 session complétée)
3. Tap sur la card → bilan calculé, chiffre central avec la bonne couleur
4. Retour → re-tap : doit charger instantanément depuis l'analyse persistée

### R18 — Surveiller la cohérence des couleurs

La doctrine impose un mapping strict zone → couleur. J'ai utilisé `colors.margin.{green|yellow|red}` partout. Si vous décidez de durcir une nuance (ex. yellow plus orange), un seul changement dans `tokens.ts` propage à tous les écrans.

### R19 — Le `DEFAULT_VEHICLE` est un compromis

Avec `maxGLateral = 1.0`, beaucoup de pilotes "agressifs" sur route sportive vont saturer la marge véhicule (G_lat observé > 1.0). C'est OK — la marge composite reste lisible parce qu'elle est pondérée par le pilote (60%). Mais à l'usage on devra calibrer (Q16).

---

## Estimation pour la semaine 6

Selon roadmap : **Écran #14 (Carte du circuit) + Écran #15 (Zoom virage).**

- **J1** — Charger le SVG du tracé Beltoise depuis `circuits.track_svg_path` + helpers pour positionner des pastilles sur le SVG (projection lat/lon → coordonnées SVG via bbox)
- **J2** — Écran #14 : tracé SVG, 14 pastilles colorées par virage (data temporaire random pour V1, vraie data en sem 7), toggle plan/satellite (V1 = plan seulement)
- **J3-4** — Écran #15 : détail virage avec 3 éclairages (trajectoire / physique / question), graphes simples (lib `react-native-svg` déjà installée)
- **J5** — Gestes swipe entre virages + rapport

Estimation : **5 jours-claude**. Possible débordement sur le calcul des marges par virage (data) — à voir.

---

## En résumé

Premier vrai écran d'analyse en place. La grammaire est posée : eyebrow, chiffre central géant colorisé, étiquette humaine, manifeste italique, navigation discrète. L'algo marge V1 est testé, documenté, et persisté côté Supabase pour les recalculs ultérieurs.

18 commits totaux sur `main`. 43 tests passants. Le code est prêt pour la sem 6 (carte + zoom virage) sans aucune dette technique bloquante.

Le vrai test sera visuel et émotionnel : un pilote qui voit "24% · À explorer · Belle séance, une zone à creuser la prochaine fois." doit ressentir une lecture juste, ni complaisante ni accusatrice. Difficile à valider sans un vrai usage. C'est pourquoi le test alpha de juillet est crucial (Q13).

— Claude Code, 24 mai 2026
