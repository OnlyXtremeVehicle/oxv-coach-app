# Rapport semaine 14 — Polish + alpha prep (rapport final 14 semaines)

**Date** : 25 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : **Le code est prêt.** ErrorBoundary global en place, haptic discret sur les CTAs, scanner doctrinal anti-verbes-interdits intégré au CI, 3 documents alpha pilote livrés. Reste à câbler côté humain : build EAS + smoke test device + submissions stores.

---

## Ce que j'ai fait

### J1 — Polish UX

**[`src/lib/haptics.ts`](../src/lib/haptics.ts)** — feedback haptique discret avec 4 niveaux (tap, confirm, success, warning). Skip propre en Expo Go. Best-effort partout — ne crashe jamais. Doctrine sobriété : pas de vibration ludique, juste un retour tactile minimal qui confirme l'action sans la dramatiser.

**[`src/components/ErrorBoundary.tsx`](../src/components/ErrorBoundary.tsx)** — capture les crashs JS du sous-arbre React. Écran d'erreur sobre : eyebrow « IMPRÉVU » + titre « Une pause technique. » + bouton « Réessayer ». Remontée Sentry via `captureException` (no-op dev/Expo Go). Message d'erreur affiché en `__DEV__` uniquement. Monté au plus haut niveau dans `app/_layout.tsx`.

**Haptic câblé** :
- `bilan-pret.tsx` (#12) : `hapticConfirm()` au tap « Découvrir »
- `placement.tsx` (#09) : `hapticSuccess()` au tap final avant silence en piste

### J2 — Audit doctrinal global + CI

**[`scripts/check-doctrine.ts`](../scripts/check-doctrine.ts)** — scanner anti-verbes-interdits sur tous les `app/**/*.tsx`. Liste alignée avec `focusCorner.test.ts` + `debriefGenerator.test.ts`. Gère les faux positifs (commentaires, strings de tests). Sortie lisible : `fichier:ligne « verbe »` + extrait.

**Run sur les 38 fichiers .tsx** : 0 violation.

Ajouté en step CI dans `.github/workflows/check.yml` après les tests Jest. **Plus aucun verbe directif ne peut être introduit par mégarde** sur n'importe quel écran pilote ou admin.

Audit accessibilité complet reporté V1.1 (pas critique pour alpha — la sobriété visuelle OXV reste lisible par défaut).

### J3 — Docs alpha pilotes (3 documents)

**[`docs/alpha/GUIDE_PILOTE_ALPHA.md`](../docs/alpha/GUIDE_PILOTE_ALPHA.md)** — guide complet du pilote alpha :
- Présentation honnête de ce que l'app fait/ne fait pas
- Installation TestFlight (iOS) / `.apk` sideload (Android)
- Onboarding 6 écrans + première connexion
- Avant/pendant/après la session
- Lecture du bilan (marge, zones, carte, zoom)
- Debrief J+1 en 3 actes
- Canaux de retour alpha
- Confidentialité (RGPD)
- En cas de problème + phrase finale doctrinale

**[`docs/alpha/FAQ_ALPHA.md`](../docs/alpha/FAQ_ALPHA.md)** — 30 questions/réponses organisées en 6 sections :
- Doctrine (pourquoi pas d'instruction, pourquoi un seul chiffre, etc.)
- App (espace, hors-ligne, batterie, sessions, comparateur, partage)
- Matériel (RaceBox compatible, Flic 2, téléphones supportés)
- Session (détection arrivée/fin, sessions multiples, gestion crash)
- Calculs (marge V1 50/50, 14 segments, seuils 30/15, tracé référence)
- Alpha (10-20 pilotes, 3 sessions sur 2 mois, gratuit)

**[`docs/alpha/CHECKLIST_J0.md`](../docs/alpha/CHECKLIST_J0.md)** — checklist papier/téléphone pour le jour J 5 juillet :
- La veille / matin / paddock / préparation / placement / en piste / retour box
- Tableau « si pépin » avec solutions
- Phrase finale qui referme la doctrine

### J4 — Smoke test device (en attente Gabin)

Procédure complète prête : [`docs/SMOKE_TEST_DEVICE.md`](../docs/SMOKE_TEST_DEVICE.md) (8 phases, sem 13).

**Dépend de** :
- Q9 — Compte EAS pour build preview (en cours côté Gabin, fix Sentry appliqué)
- RaceBox + iPhone/Android sous la main pour 1 demi-journée

Quand disponible : exécuter phases A → H. Tout problème détecté → fix → nouveau build EAS preview → re-test.

### J5 — Build production + submissions stores (en attente Gabin)

**Dépend de** :
- Apple Developer Program validé (24-72 h délai Apple)
- Google Play Console validé (24-48 h délai Google)
- Q9 EAS configuré

**Commandes prêtes** :

```bash
# Build production iOS + Android
eas build --profile production --platform ios
eas build --profile production --platform android

# Submission TestFlight Apple
eas submit --profile production --platform ios

# Submission Play Internal Testing Google
eas submit --profile production --platform android
```

Délai EAS : 30-60 min par build cloud. Délai review Apple TestFlight interne : ~24 h. Delai Play Internal : immédiat après upload.

---

## Bug bonus traité — Q9 (fix Sentry Gradle)

En parallèle de la mise en route du build EAS côté Gabin, diagnostic remonté :

> Le plugin `@sentry/react-native/expo` dans `app.json` créait un module Gradle `:sentry-react-native:` en doublon de celui créé par l'autolinking RN (`:sentry_react-native:`) → conflit ressources Android → fail Gradle 8.8.

**Fix appliqué** ([`9f75eb5`](https://github.com/OnlyXtremeVehicle/oxv-coach-app/commit/9f75eb5)) :
- Suppression du bloc plugin `@sentry/react-native/expo` (l'autolinking RN suffit, l'upload sourcemaps est géré par le hook EAS automatique avec `SENTRY_AUTH_TOKEN`)
- Downgrade `@sentry/react-native` `^8.11.1` → `~5.24.3` (version officiellement compatible Expo SDK 51 via `npx expo install`)

Code `src/lib/sentry.ts` inchangé — les APIs `Sentry.init/withScope/setExtra/captureException` sont stables entre 5.x et 8.x.

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : **0 erreur**
- [x] `npm run lint` : **0 erreur, 4 warnings legacy V1** (inchangés depuis sem 12)
- [x] `npm run format:check` : tout conforme
- [x] `npm test` : **103/103 tests**
- [x] `npx tsx scripts/check-doctrine.ts` : **0 violation sur 38 fichiers .tsx**
- [x] CI GitHub Actions : typecheck + lint + format + tests + doctrine — tous passent
- [x] 42 commits totaux, push sur `OnlyXtremeVehicle/oxv-coach-app`

**Validable uniquement sur device** :
- [ ] Build EAS preview iOS + Android sans erreur Gradle (fix Sentry à confirmer)
- [ ] Smoke test sur iPhone + Android (phases A → H de SMOKE_TEST_DEVICE.md)
- [ ] Notif push J+1 effectivement reçue + tap → deep-link vers debrief
- [ ] Build EAS production iOS + Android
- [ ] Submission TestFlight (interne)
- [ ] Submission Play Internal Testing

---

## Récap 14 semaines

| Semaine | Livrable | Commits |
|---|---|---|
| 0 | Onboarding doctrine + architecture | 1 |
| 1 | Stack Expo + Supabase + tokens + Git | 4 |
| 2 | State machine S1-S10, stores, MMKV, CI | 2 |
| 3 | BLE RaceBox récupéré, reconnexion, upload, Sentry init | 3 |
| 4 | Tests Jest, Flic 2 stub, debug-capture | 3 |
| 5 | Algo marge V1, écrans #20 hub + #13 bilan | 2 |
| 6 | Topologie 14 virages, écrans #14 carte + #15 zoom | 2 |
| 7 | Écrans #16 + #17, focus corner anti-verbes | 2 |
| 8 | Onboarding #01-06, routing 3 branches | 2 |
| 9 | Paddock #07-12, géoloc foreground | 2 |
| 10 | Comparateur #18, settings #24, notifs #23, partages | 2 |
| 11 | Debrief #19, entre runs #22, update #27, 3 vues admin | 2 |
| 12 | TrackViz intégré, vraies marges par virage | 2 |
| 13 | Pipeline post-session, debrief V1, push notifs, fixture UBX | 5 |
| **14** | **ErrorBoundary, haptic, scanner doctrinal CI, docs alpha** | **4** |

**Total : 42 commits, 103 tests, 0 dette technique bloquante.**

---

## État final de l'app

| Brique | État |
|---|---|
| 26 écrans pilote | ✅ codés |
| 4 vues admin bronze (hub + préparation + en-cours + analytique + inspecteur circuit) | ✅ codées |
| 3 overlays système (offline / BLE error / update) | ✅ codés |
| ErrorBoundary global anti-white-screen | ✅ |
| Module trackviz complet (geometry + analysis) | ✅ |
| Vraies marges par virage (14 segments) | ✅ |
| Pipeline post-session UBX → trackviz → marges | ✅ |
| Debrief J+1 généré localement (V1 sans IA) | ✅ |
| Push notifications locales + opt-in pilote | ✅ |
| Composant CircuitInspector réutilisable | ✅ |
| Scanner doctrinal anti-verbes en CI | ✅ |
| State machine S1-S10 + 10 stores Zustand | ✅ |
| BLE RaceBox (récupéré V1) + parser UBX | ✅ |
| Géoloc foreground + transitions automatiques | ✅ |
| Offline queue + retry policy | ✅ |
| Migrations 0001-0013 (en prod Supabase) | ✅ |
| 103 tests Jest | ✅ |
| CI GitHub (typecheck + lint + format + tests + doctrine) | ✅ |
| GitHub remote configuré + push réguliers | ✅ |
| Guard Expo Go pour preview UI rapide | ✅ |
| Fixture UBX synthétique pour tests sans device | ✅ |
| Documentation smoke test device | ✅ |
| Documentation alpha pilotes (guide + FAQ + checklist J0) | ✅ |

---

## Questions pour Gabin

### Q39 — Diffusion des docs alpha

Les 3 documents [`docs/alpha/`](../docs/alpha/) sont prêts à transmettre. Trois options :

- **A** — PDF imprimable diffusé par mail aux 10-20 alpha-pilotes la veille du 5 juillet
- **B** — Page web sur `oxvehicle.fr/alpha` (recommandé : permet mise à jour live)
- **C** — Hybride : PDF pour le pacte + guide, web pour la FAQ qui évoluera

Recommandation : **C**. Le guide est figé (charte alpha), la FAQ vit avec les questions des pilotes.

### Q40 — Mots des virages

Q19 toujours ouverte. Pour les docs alpha, j'ai utilisé les placeholders « Virage 1 », « V3 — Épingle nord », etc. Si vous avez les vrais noms d'ici fin juin, je les remplace en 5 min et je régénère les docs.

### Q41 — Texte du mail d'invitation alpha

Je peux préparer un draft sobre, doctrinal, dans le ton OXV (vouvoiement, sans marketing) — voulez-vous que je l'écrive en J6 ou préférez-vous le rédiger vous-même ?

### Q42 — Beta après alpha

L'alpha couvre 3 sessions × 10-20 pilotes (juillet → septembre). Quelle granularité pour la suite :

- **Beta privée** (oct-nov 2026) : ouverte à ~100 pilotes OXV existants, sans nouvelle inscription publique
- **Beta publique** (déc 2026) : inscription web libre, pas d'achat de matériel obligé
- **V1 commerciale** (janvier 2027) : forfait OXV inclut le coach

À noter pour le plan post-alpha — pas urgent.

---

## Recommandations finales

### R41 — Bloquer une demi-journée sem 14 J4 dès que Q9 est débloqué

Le smoke test sur device réel doit être fait avant la submission stores. Si vous ne pouvez pas le faire vous-même, c'est le moment idéal pour faire intervenir le **dev senior** mentionné en sem 7. Une après-midi à deux + un RaceBox + 2 téléphones (iPhone + Android) suffisent à boucler la phase A → H du smoke test.

### R42 — Surveillance Sentry post-submission

Dès que la première build EAS production est en TestFlight (ou Play Internal), regardez Sentry **tous les jours** pendant les 2 premières semaines. Tout crash inattendu = fix prioritaire avant ouverture à des pilotes externes.

### R43 — Cron quotidien `analyzeTrackVizSession` retry (V1.1)

J'ai noté Q37 sem 13 : si un alpha pilote tue son app avant la fin de l'analyse, la notif J+1 est perdue. V1.1 mitigation : Edge Function Supabase cron qui balaye les `telemetry_sessions.status='completed'` sans `app_session_analyses.debrief_text` non-null et déclenche l'analyse manquante côté serveur.

Pas critique pour l'alpha (les pilotes sont engagés), mais à câbler avant la beta ouverte.

### R44 — Tour de référence Beltoise (Q33)

L'app calcule actuellement la marge contre un tracé **interpolé** (pas le vrai tracé optimal). La marge restera approximative. Pour le retour de l'alpha, profitez d'une de vos sessions pour enregistrer un tour propre avec un pilote confirmé (Beltoise ?), récupérez le `.ubx`, et envoyez-le-moi → je l'intègre comme nouvelle polyline de référence en V1.1.

---

## En résumé

**14 semaines. 42 commits. 103 tests. 26 écrans pilote + 4 vues admin + 3 overlays système.**

L'app fait ce qu'elle a promis dans le pacte du jour 1 :
- Elle se tait pendant la conduite
- Elle montre, elle ne dirige pas
- Elle ne pousse jamais aux limites
- Elle parle français, sobre, sans emoji
- Elle ne sait qu'une seule chose : votre marge

Tout ce qui pouvait être codé sans device l'a été. Le reste — build EAS, smoke test, submissions — vous attend, vous et votre dev senior.

Le code est prêt. La doctrine tient. La piste est à vous.

— Claude Code, 25 mai 2026
