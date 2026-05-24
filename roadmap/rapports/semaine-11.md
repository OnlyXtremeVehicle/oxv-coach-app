# Rapport semaine 11 — Debrief + off-track + admin + intégration trackviz reportée

**Date** : 25 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : **Les 26 écrans pilote sont codés.** Section admin bronze en place. Code trackviz partagé par Gabin reporté en sem 12 pour adaptation doctrinale.

---

## Ce que j'ai fait

### Jour 1 — Analyse du code trackviz partagé

Gabin a transmis trois fichiers (`trackviz/analysis.ts`, `trackviz/service.ts`, `TrackVizMap.tsx`). Analyse complète + plan d'intégration noté en mémoire ([trackviz-code-review](memory/trackviz_code_review.md)).

**Verdict** : la **logique** (map-matching GPS, projection viewBox, segments avec phases entry/apex/exit, heatmap par vitesse) vaut son pesant d'or, mais le **vocabulaire et la structure de scoring** entrent en conflit avec la doctrine :
- `verdict` + `score 0-100` → gamification, contre le "un seul chiffre central = marge"
- Verbes directifs (*"Freine plus droit"*, *"Tu peux ouvrir"*, *"vise une entrée"*) + tutoiement → fail-fast sur le test anti-verbes-interdits
- Tables `telemetry_samples`, `lap_segment_analysis`, `session_insights` inexistantes en prod
- Imports `@/supabase/client` obsolètes depuis sem 1
- Tokens `COLORS.performance`, `FONTS.serif` étrangers à `tokens.ts`

**Décision** : reporter l'intégration en sem 12 (qui était polish) en adaptant la logique au vocabulaire OXV et à notre schéma. Garder le composant `TrackVizMap` mais réécrire avec nos tokens. Plan détaillé dans la mémoire.

### Jour 2 — Écran #19 Debrief J+1

[app/(app)/debrief.tsx](app/(app)/debrief.tsx) — l'écran le plus littéraire :

- 3 actes empilés : **Récit** / **Méta-analyse** / **Préparation**
- Chaque acte = eyebrow tertiary `ACTE N · TITRE` + body italique light 16pt line-height 1.7
- Lit `app_session_analyses.debrief_text` (sera généré par Edge Function OpenAI `generate_debrief` à câbler sem 13)
- `parseDebrief()` découpe sur `---` ou double saut de ligne → 3 paragraphes
- **Fallback pédagogique** selon la zone de marge si pas encore généré :
  - Confortable : *"vous avez piloté avec aisance. La marge restait confortable, le geste était posé."*
  - À explorer : *"vous avez exploré. La marge était travaillée, présente sans être inconfortable."*
  - Terrain serré : *"vous avez touché vos limites. La marge s'est rétractée."*
- Signature de fermeture : *"L'app se taira jusqu'à la veille de votre prochaine session. Profitez de cette pause."* + `— OXV COACH` en monospace eyebrow

`DebriefEmpty` si aucune session, `dateLong()` formate en français long ("25 mai 2026").

### Jour 3 — Écran #22 Paddock entre runs + #27 Update

**[app/(app)/entre-runs.tsx](app/(app)/entre-runs.tsx) — #22** :
- Vue compacte : eyebrow `ENTRE RUNS` + manifeste *"À chaud, l'essentiel."*
- Card `DERNIER RUN` avec marge hero colorisée + label humain
- 2 stat cards : nombre de tours + meilleur tour formaté MM:SS.mmm
- Bouton primaire `Préparer le prochain run` → `/(app)/equipement` (boucle paddock)
- `estimateLiveMargin` V1 = heuristique simple, à remplacer sem 12 par la vraie live margin du trackviz

**[src/components/UpdateModal.tsx](src/components/UpdateModal.tsx) — #27** :
- Modal slide depuis le bas (animation native), backdrop noir 65%
- Pilotée par `useUIStore.updateModalVisible`
- 3 cards de nouveautés (eyebrow rouge OXV, titre light, body caption)
- Boutons `Mettre à jour` (primaire, future intégration Expo Updates V1.1) + `Plus tard`
- Monté dans `app/_layout.tsx` au-dessus du `Stack`, donc accessible depuis n'importe quel écran

### Jour 4 — Section admin bronze (3 vues)

Nouveau routeur `app/(admin)/` avec **guard `is_admin`** dans `_layout.tsx` (`<Redirect href="/(app)" />` si pas admin).

Toute la grammaire admin utilise `colors.accent.bronze` (`#B87333`) pour distinguer visuellement du mode pilote (rouge OXV).

**[app/(admin)/index.tsx](app/(admin)/index.tsx)** — hub avec 3 cards de navigation bronze :
- Préparation
- En cours
- Analytique

**[app/(admin)/preparation.tsx](app/(admin)/preparation.tsx)** :
- Liste les `users.role='pilot'` triés par `last_name`
- Affiche prénom + nom, email, niveau pilote (en français)
- Status KYC colorisé en monospace (vert validated / jaune expired / rouge rejected / gris pending)

**[app/(admin)/en-cours.tsx](app/(admin)/en-cours.tsx)** :
- Liste `telemetry_sessions.status='recording'` actuelles
- User ID tronqué (pour éviter de leak des identifiants visibles)
- Heure de démarrage + nombre de tours
- Note : live realtime renvoyé en V1.1 (subscription Supabase)

**[app/(admin)/analytique.tsx](app/(admin)/analytique.tsx)** :
- 3 BigStat agrégés : Sessions complétées (count exact), Pilotes uniques (set), Marge moyenne (sur `app_session_analyses`)
- Export PDF V1.1

### Jour 5 — Rapport

Ce document.

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1
- [x] `npm run format:check` : ✅ tout conforme
- [x] `npm test` : ✅ 61/61 tests

Pas validable sans device + un admin :
- [ ] Guard `(admin)/_layout` redirige bien les non-admin
- [ ] Les 3 listes admin se peuplent avec les vraies données (la prod a 13 users)
- [ ] Le `UpdateModal` ne s'affiche jamais en prod (V1) sauf trigger manuel debug

---

## État final côté écrans (26/26)

| # | Nom | Route | Sem |
|---|-----|-------|-----|
| 01 | Accueil philosophique | `(onboarding)/` | 8 |
| 02 | Doctrine | `(onboarding)/doctrine` | 8 |
| 03 | Méthode | `(onboarding)/methode` | 8 |
| 04 | Niveau pilote | `(onboarding)/niveau` | 8 |
| 05 | CGU/RGPD | `(onboarding)/cgu` | 8 |
| 06 | Pacte | `(onboarding)/pacte` | 8 |
| 07 | Vous y êtes | `(app)/paddock` | 9 |
| 08 | Détection équipement | `(app)/equipement` | 9 |
| 09 | Placement | `(app)/placement` | 9 |
| 10 | Vous avez piloté | `(app)/pilotage-fini` | 9 |
| 11 | Données en sécurité | `(app)/donnees-securite` | 9 |
| 12 | Bilan prêt | `(app)/bilan-pret` | 9 |
| 13 | Bilan | `(app)/bilan` | 5 |
| 14 | Carte du circuit | `(app)/carte` | 6 |
| 15 | Zoom virage | `(app)/virage` | 6 |
| 16 | La prochaine fois | `(app)/prochaine-fois` | 7 |
| 17 | Progression | `(app)/progression` | 7 |
| 18 | Comparateur | `(app)/comparateur` | 10 |
| 19 | Debrief J+1 | `(app)/debrief` | 11 |
| 20 | Hub accueil | `(app)/` | 5 |
| 21 | Accueil en route | (variant `#20` mode B) | 5 |
| 22 | Entre runs | `(app)/entre-runs` | 11 |
| 23 | Notifications | `(app)/notifications` | 10 |
| 24 | Settings | `(app)/settings` | 10 |
| 25 | BLE error (modal) | `<BleErrorModal>` | 3 |
| 26 | Offline mode (bannière) | `<OfflineBanner>` | 2 |
| 27 | App update (modal) | `<UpdateModal>` | 11 |

Plus :
- Login `(auth)/login` (sem 1)
- Partage `(app)/partage` (sem 10, sous-écran de Settings)
- Debug capture `(app)/debug-capture` (dev only, sem 4)
- 3 vues admin `(admin)/{index,preparation,en-cours,analytique}` (sem 11)

**Total : 31 routes navigables.**

---

## Questions pour Gabin

### Q30 — Validation du plan trackviz sem 12

Confirmation que je peux :
1. Créer une migration `0012_app_segment_analyses` (id, telemetry_session_id, segment_index 1..14, entry/apex/exit speed, max G_lat, lateral_error, score interne)
2. Récupérer la **logique** map-matching + projection + phases de votre code partagé
3. **Réécrire** les verdicts/conseils en respectant le test anti-verbes-interdits
4. Adapter le `<TrackVizMap>` avec nos tokens (heatmap vert/jaune/rouge OXV)
5. Brancher sur #14 Carte (trajectoire réelle superposée) et #15 Zoom virage (stats Physique remplies)
6. Remplacer `mockCornerMargins` par les vraies marges dans `selectFocusCorner`

Si OK → 3 jours en sem 12. Si vous voulez ajuster avant, dites-moi.

### Q31 — Generate_debrief Edge Function

L'écran #19 lit `debrief_text` mais pour V1 personne ne le génère. Trois options pour la sem 13 :

- **A — Edge Function Supabase + cron** : déclenchée 24h après chaque session, appelle OpenAI avec le contexte (marge, pilote, circuit), écrit le texte dans `app_session_analyses.debrief_text` et envoie une push notif
- **B — On-demand côté app** : pas de cron, le pilote ouvre `/(app)/debrief` → si pas généré, on appelle OpenAI à la volée
- **C — Renvoyer en V1.1** : le fallback pédagogique V1 suffit pour la première saison, OpenAI vient en septembre

Recommandation : C en V1, A en V1.1 (l'effet "littéraire J+1" est plus fort si le texte arrive en push, pas si on doit ouvrir l'app pour le récupérer).

### Q32 — Session OXV vs telemetry_session pour admin

Mes vues admin (`preparation`, `en-cours`) lisent `users` et `telemetry_sessions` directement. Mais l'admin OXV pense en termes de **sessions OXV** (la journée track day) — qui est la table `sessions` (avec inscriptions via `registrations`). Pour V1 sans filtrage par session OXV, je liste tous les pilotes / toutes les sessions actives.

Option V1.1 : ajouter un picker "Quelle session OXV ?" en haut de chaque vue admin, qui filtre par `registrations.session_id`.

---

## Recommandations

### R31 — Profiter de la fin de cette semaine pour pousser sur GitHub

C'est le dernier moment où c'est un effort 0 (juste un `git remote add + push`). Quand on aura intégré trackviz en sem 12, le diff sera énorme — moins agréable à reviewer pour vous.

### R32 — Si l'audit dev senior est en cours, lui transmettre la nouvelle archi

Le périmètre a évolué depuis le brief sem 7 : 26 écrans codés, 3 vues admin, table `app_progression_shares`, géoloc, partage. À retransmettre.

### R33 — Pour le test alpha juillet, anticiper l'intégration trackviz

Si vous voulez du **vrai map-matching** au test alpha, sem 12 dédiée trackviz est cruciale. La semaine 13 serait polish + test alpha prep. Sem 14 stores. Ça tient.

---

## Estimation pour la semaine 12

Selon roadmap originale : **Polish + Performance + Tests internes.**

Mais avec le code trackviz à intégrer, je propose :

- **J1** — Migration `0012_app_segment_analyses` + types regen + `src/trackviz/{geometry, hauteSaintonge, types}.ts` adaptés
- **J2** — `src/trackviz/analysis.ts` adapté **doctrinalement** (sans verdict ni score affiché, juste les stats par segment + reuse `selectFocusCorner`)
- **J3** — Composant `<TrackVizMap>` réécrit avec nos tokens, intégration dans #14 Carte et #15 Zoom virage
- **J4** — Remplace `mockCornerMargins` par vraies marges + tests unitaires sur la projection et l'analyse
- **J5** — Polish UX (animations, micro-interactions) + rapport sem 12

Estimation : **5 jours-claude pleins**, sans recul possible — c'est dense.

---

## En résumé

**Les 26 écrans pilote sont là.** Plus les 3 vues admin bronze. Plus les overlays système (offline, BLE, update). 31 routes navigables au total.

32 commits, 61 tests, 0 dette technique bloquante. Doctrine tenue partout — y compris dans la décision de **différer** l'intégration du code trackviz pour le réécrire proprement plutôt que de céder à la tentation du copy-paste.

— Claude Code, 25 mai 2026
