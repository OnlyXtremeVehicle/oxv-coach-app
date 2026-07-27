# Inventaire des écrans — `app/(app2)` et `app/(coach)`

**26 juillet 2026** · lecture seule · relevé, non commenté

Chaque affirmation porte son fichier et sa ligne. `INCONNU` figure partout où le code n'établit pas la réponse. Aucun jugement de qualité, aucune recommandation : c'est un relevé.

## Méthode, et ses limites

L'extraction est automatique et relit le code, jamais les noms de fichiers. Trois précisions comptent pour lire les fiches :

**Les points d'entrée** retiennent les lignes qui naviguent réellement (`router.push`, `navigate`, `replace`, `<Redirect>`, `href`, `pathname`) ET les déclarations de tables de routes — la machine de capture (`src/features/rec/captureStepLogic.ts:65`) et la barre coach (`src/lib/coachNav.ts:29`) en sont. Sans ce second cas, cinq écrans du flux de capture et cinq écrans coach seraient comptés orphelins à tort.

**Les routes dynamiques** (`[id]`, `[doc]`, `[sessionId]`) sont presque toujours atteintes par gabarit — `` `/(app2)/data/session/${id}` `` — jamais par leur littéral. La recherche porte donc aussi sur leur préfixe.

**Les écritures** : aucune écriture directe en base n'a été trouvée dans ces deux arbres — les écrans passent tous par un service. Le champ « Écrit » liste donc les fonctions importées dont le nom commence par un verbe d'écriture. C'est une HEURISTIQUE, signalée comme telle sur chaque fiche : la table touchée reste à confirmer dans le service.

## Comptes

| Groupe | Fichiers | Layouts | Écrans | Dont coupés hors développement |
|---|---|---|---|---|
| `app/(app2)` | 38 | 1 | 37 | `/(app2)/dev-galerie` |
| `app/(coach)` | 37 | 1 | 36 | — |

Tous les fichiers des deux arbres portent un commentaire d'en-tête : aucune fonction n'a dû être déduite du rendu.

---

## Arbre pilote actif — `app/(app2)`

### `/(app2)`

- **Fichier** : `app/(app2)/index.tsx` — 1068 lignes
- **Fonction** : « ACCUEIL MIROIR — porte d'entrée (app2), lot V2-L1 écran 1/3. » (en-tête, ligne 2)
- **Lit** : services — `@/services/analyticsService` (`:47`), `@/services/paddockHeroLogic` (`:48`) · features — `@/features/miroir/miroirHomeLogic` (`:91`), `@/features/miroir/bilanLogic` (`:92`), `@/features/miroir/useMiroirHome` (`:93`) · magasins — `@/store/useAppStateStore` (`:49`), `@/store/useAuthStore` (`:50`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(admin)/index.tsx:166`, `app/(admin)/_layout.tsx:18`, `app/(app2)/bilan/[sessionId].tsx:363`, `app/(app2)/bilan/[sessionId].tsx:525`, `app/(app2)/club/index.tsx:345`, `app/(app2)/club/index.tsx:381`, `app/(app2)/club/pass.tsx:127`, `app/(app2)/club/roulages.tsx:576` … et 56 autres
- **Sorties** : `/(app2)/vous`, `/(app2)/rec/preparation`, `/(app2)/bilan/${session.id}`, `/(app2)/signature`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(app2)/_layout`

- **Fichier** : `app/(app2)/_layout.tsx` — 122 lignes · **layout**
- **Fonction** : « Layout du groupe (app2) — coquille V2 (lot L0, Livrable 8). » (en-tête, ligne 2)
- **Lit** : magasins — `@/store/useAppStateStore` (`:27`), `@/store/useAuthStore` (`:28`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : `/(app2)`, `/(app2)/data`, `/(app2)/club`, `/(app2)/vous`, `/(auth)/login` ← hors groupe, `/(app2)/rec`
- **Drapeaux** : aucun
- **Composants propres** : `@/ui/v2/TabBar`, `@/ui/v2/centralButtonLogic`, `@/ui/v2/useCentralButtonState`

### `/(app2)/bilan/[sessionId]`

- **Fichier** : `app/(app2)/bilan/[sessionId].tsx` — 1181 lignes
- **Fonction** : « BILAN DE SÉANCE — porte Miroir (V2-L1, écran 2/3). Route NOUVELLE du » (en-tête, ligne 2)
- **Lit** : services — `@/services/bilanPdfExportService` (`:81`), `@/services/sessionMediaService` (`:82`) · features — `@/features/miroir/bilanLogic` (`:79`), `@/features/miroir/useBilan` (`:80`) · magasins — `@/store/useAuthStore` (`:83`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/data/saison.tsx:427`, `app/(app2)/data/session/[id].tsx:572`, `app/(app2)/index.tsx:448`, `app/(app2)/vous/carnet.tsx:472`, `app/_layout.tsx:105`, `app/_layout.tsx:113`
- **Sorties** : `/(app2)/data/session/${sessionId}`, `/(app)/carte-trophee?sessionId=${sessionId}` ← **sortie V1**
- **Drapeaux** : aucun
- **Composants propres** : `@/features/miroir/useBilan`

### `/(app2)/club`

- **Fichier** : `app/(app2)/club/index.tsx` — 646 lignes
- **Fonction** : « CLUB HUB — porte communauté (app2), lot V2-L5 écran 1/7. » (en-tête, ligne 2)
- **Lit** : features — `@/features/club/clubHubLogic` (`:47`), `@/features/club/useClubHub` (`:55`) · magasins — `@/store/useAuthStore` (`:27`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/club/pass.tsx:127`, `app/(app2)/vous/index.tsx:345`, `app/(app2)/_layout.tsx:40` (table de routes), `app/_layout.tsx:135`, `app/_layout.tsx:142`, `src/features/miroir/miroirHomeLogic.ts:238`, `src/features/miroir/miroirHomeLogic.ts:240`, `src/features/miroir/__tests__/miroirHomeLogic.test.ts:214` … et 2 autres
- **Sorties** : `/(app2)/club/coaching`, `/(app2)/club/pass`, `/(app2)/club/partenaires`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/club/clubHubLogic`

### `/(app2)/club/coaching`

- **Fichier** : `app/(app2)/club/coaching.tsx` — 1267 lignes
- **Fonction** : « COACHING — sous-écran du CLUB (app2), lot V2-L5 écran 2/7. » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachMarketplaceService` (`:31`), `@/services/pilotConsentService` (`:32`), `@/services/pilotCoachBillingService` (`:33`) · features — `@/features/club/coachingLogic` (`:61`), `@/features/club/useCoaching` (`:62`) · magasins — `@/store/useAuthStore` (`:25`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/_layout.tsx:135`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/club/useCoaching`

### `/(app2)/club/galerie`

- **Fichier** : `app/(app2)/club/galerie.tsx` — 1003 lignes
- **Fonction** : « GALERIE — porte Club (V2-L5 CLUB, Mission D, écran 6/7 · l'écran émotion). » (en-tête, ligne 2)
- **Lit** : services — `@/services/sharesService` (`:81`), `@/services/sessionMediaService` (`:82`) · features — `@/features/club/galerieLogic` (`:70`), `@/features/club/useGalerie` (`:71`), `@/features/club/useHeritageBook` (`:72`), `@/features/miroir/bilanLogic` (`:73`) · magasins — `@/store/useAuthStore` (`:83`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : `/(app2)/club/galerie`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/club/useGalerie`, `@/features/club/useHeritageBook`

### `/(app2)/club/partenaires`

- **Fichier** : `app/(app2)/club/partenaires.tsx` — 460 lignes
- **Fonction** : « PARTENAIRES — porte CLUB, écran 5/7 du lot V2-L5 (Mission B). » (en-tête, ligne 2)
- **Lit** : services — `@/services/partnerService` (`:24`) · features — `@/features/club/partenairesLogic` (`:47`), `@/features/club/useClubPartenaires` (`:48`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/club/index.tsx:381`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/club/useClubPartenaires`

### `/(app2)/club/pass`

- **Fichier** : `app/(app2)/club/pass.tsx` — 496 lignes
- **Fonction** : « PASS OXV — porte CLUB, écran 7/7 (V2-L5, mission C). Route `club/pass`. » (en-tête, ligne 2)
- **Lit** : services — `@/services/eventsService` (`:33`), `@/services/featureFlagsService` (`:34`) · features — `@/features/club/passLogic` (`:56`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/club/index.tsx:345`, `src/services/paddockHeroLogic.ts:68`
- **Sorties** : `/(app2)/reserver`, `/(app2)/club`
- **Drapeaux** : `app_payments` (`:107`)
- **Composants propres** : aucun

### `/(app2)/club/roulages`

- **Fichier** : `app/(app2)/club/roulages.tsx` — 1033 lignes
- **Fonction** : « ROULAGES & AMIS — porte CLUB, écran 3/7 du lot V2-L5 (Mission B). » (en-tête, ligne 2)
- **Lit** : features — `@/features/club/roulagesLogic` (`:46`), `@/features/club/useClubRoulages` (`:47`), `@/features/club/useClubAmis` (`:53`) · magasins — `@/store/useAuthStore` (`:27`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/_layout.tsx:142`
- **Sorties** : `/(app2)/data/comparer?friend=<id>`, `/(app2)/data`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/club/roulagesLogic`, `@/features/club/useClubRoulages`

### `/(app2)/club/territoire`

- **Fichier** : `app/(app2)/club/territoire.tsx` — 1428 lignes
- **Fonction** : « TERRITOIRE — porte CLUB, écran 4/7 (V2-L5, mission C). Route `club/territoire`. » (en-tête, ligne 2)
- **Lit** : services — `@/services/circuitsService` (`:45`), `@/services/socialPingsService` (`:46`), `@/services/routing/scenicRoutesService` (`:51`), `@/services/featureFlagsService` (`:52`), `@/services/nextTrackDayService` (`:53`), `@/services/v2/convoysService` (`:55`) · features — `@/features/rec/attendancePublicService` (`:54`), `@/features/club/territoireLogic` (`:88`) · magasins — `@/store/useAuthStore` (`:44`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : `/(app)/creer-route` ← **sortie V1**, `/(app)/creer-trace` ← **sortie V1**
- **Drapeaux** : `convoys` (`:159`)
- **Composants propres** : aucun

### `/(app2)/data`

- **Fichier** : `app/(app2)/data/index.tsx` — 745 lignes
- **Fonction** : « DATA HUB — porte analyse (app2), lot V2-L3 écran 1/4. Route : `/(app2)/data`. » (en-tête, ligne 2)
- **Lit** : services — `@/services/sessionsService` (`:67`), `@/services/dataExportService` (`:68`) · features — `@/features/data/dataHubLogic` (`:66`) · magasins — `@/store/useAuthStore` (`:69`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/bilan/[sessionId].tsx:363`, `app/(app2)/bilan/[sessionId].tsx:525`, `app/(app2)/club/roulages.tsx:576`, `app/(app2)/data/session/[id].tsx:564`, `app/(app2)/signature.tsx:342`, `app/(app2)/_layout.tsx:39` (table de routes), `app/_layout.tsx:146`
- **Sorties** : `/(app2)/data`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/data/dataHubLogic`

### `/(app2)/data/comparer`

- **Fichier** : `app/(app2)/data/comparer.tsx` — 1627 lignes
- **Fonction** : « COMPARER — mise en regard de deux lectures (V2-L3 DATA). Route NOUVELLE du » (en-tête, ligne 2)
- **Lit** : services — `@/services/sessionsService` (`:78`), `@/services/sessionTelemetryService` (`:79`), `@/services/duelService` (`:80`), `@/services/friendshipsService` (`:81`) · features — `@/features/data/comparerLogic` (`:76`), `@/features/data/seasonLogic` (`:77`) · magasins — `@/store/useAuthStore` (`:82`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/_layout.tsx:146`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/data/seasonLogic`

### `/(app2)/data/saison`

- **Fichier** : `app/(app2)/data/saison.tsx` — 1308 lignes
- **Fonction** : « SAISON — lot V2-L3 (Data), écran « votre trajectoire, contre vous-même ». » (en-tête, ligne 2)
- **Lit** : services — `@/services/ecosystemLogic` (`:83`), `@/services/ecosystemService` (`:84`), `@/services/sessionsService` (`:85`), `@/services/statsService` (`:86`) · features — `@/features/data/dataHubLogic` (`:68`), `@/features/data/seasonLogic` (`:76`) · magasins — `@/store/useAuthStore` (`:87`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : `/(app2)/data/saison`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/data/dataHubLogic`, `@/features/data/seasonLogic`

### `/(app2)/data/session/[id]`

- **Fichier** : `app/(app2)/data/session/[id].tsx` — 2058 lignes
- **Fonction** : « SÉANCE — l'écran pivot de la zone DATA (V2-L3). Route » (en-tête, ligne 2)
- **Lit** : services — `@/services/sessionInsightsService` (`:77`), `@/services/flowService` (`:79`), `@/services/flowLogic` (`:80`), `@/services/sessionsService` (`:82`), `@/services/cornerEvolutionService` (`:83`), `@/services/cornerEvolutionService` (`:84`), `@/services/segmentAnalysesService` (`:88`), `@/services/sessionTelemetryService` (`:95`), `@/services/weatherCorrelationService` (`:96`), `@/services/weatherCorrelationService` (`:97`), `@/services/trajectoryLogic` (`:101`) · features — `@/features/data/comparerLogic` (`:69`) · magasins — `@/store/useAuthStore` (`:98`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/bilan/[sessionId].tsx:363`, `app/(app2)/bilan/[sessionId].tsx:525`, `app/(app2)/data/index.tsx:199`
- **Sorties** : `/(app2)/data/session/[id]`, `/(app2)/data`, `/(app2)/bilan/${data.session.id}`
- **Drapeaux** : aucun
- **Composants propres** : `@/components/insights/AnatomieViz`, `@/components/insights/DispersionViz`, `@/components/insights/FlowViz`, `@/components/insights/GGViz`, `@/components/insights/TourIdealViz`, `@/components/insights/TransfertViz`

### `/(app2)/dev-galerie`

- **Fichier** : `app/(app2)/dev-galerie.tsx` — 764 lignes · **garde `__DEV__`**
- **Fonction** : « DEV-GALERIE — écran de validation fondateur du kit V2 (lot L0, Livrable 8). » (en-tête, ligne 2)
- **Lit** : aucun service, hook ni magasin importé
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/ui/v2/BiometryStrip`, `@/ui/v2/CentralButton`, `@/ui/v2/Chip`, `@/ui/v2/ChronoHero`, `@/ui/v2/Dial`, `@/ui/v2/HeritageBand`, `@/ui/v2/ListRow`, `@/ui/v2/PillarBar`, `@/ui/v2/RadarQdi`, `@/ui/v2/SectionHeader`, `@/ui/v2/SessionCard`, `@/ui/v2/Sheet`, `@/ui/v2/StatCell`, `@/ui/v2/StateView`, `@/ui/v2/TraceCircuit`, `@/ui/v2/haptics`, `@/ui/v2/icons`, `@/ui/v2/media`, `@/ui/v2/uiLogic`

### `/(app2)/rec`

- **Fichier** : `app/(app2)/rec/index.tsx` — 261 lignes
- **Fonction** : « PISTE HUB — écran 1/8 du flux de capture v2 (lot V2-L2, PORTE REC), cible du » (en-tête, ligne 2)
- **Lit** : services — `@/services/analyticsService` (`:28`) · features — `@/features/rec/captureStepLogic` (`:47`), `@/features/rec/useCaptureStep` (`:48`), `@/features/miroir/miroirHomeLogic` (`:49`), `@/features/miroir/useMiroirHome` (`:50`) · magasins — `@/store/useAuthStore` (`:29`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/index.tsx:377`, `app/(app2)/index.tsx:524`, `app/(app2)/rec/equipement.tsx:553`, `app/(app2)/rec/placement.tsx:268`, `src/features/rec/captureStepLogic.ts:63` (table de routes), `src/features/rec/captureStepLogic.ts:64` (table de routes), `src/features/rec/captureStepLogic.ts:65` (table de routes), `src/features/rec/captureStepLogic.ts:66` (table de routes) … et 8 autres
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/rec/useCaptureStep`

### `/(app2)/rec/arrivee`

- **Fichier** : `app/(app2)/rec/arrivee.tsx` — 230 lignes
- **Fonction** : « ARRIVÉE — écran 3/8 du flux de capture v2 (lot V2-L2, PORTE REC). » (en-tête, ligne 2)
- **Lit** : services — `@/services/nextTrackDayService` (`:32`) · features — `@/features/rec/captureStepLogic` (`:45`), `@/features/rec/arriveeInsigneLogic` (`:53`) · magasins — `@/store/useAuthStore` (`:33`)
- **Écrit** : aucune écriture établie
- **Entrées** : `src/features/rec/captureStepLogic.ts:65` (table de routes)
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(app2)/rec/entre-runs`

- **Fichier** : `app/(app2)/rec/entre-runs.tsx` — 431 lignes
- **Fonction** : « ENTRE-RUNS — écran 7/8 du flux capture v2 (lot V2-L2, PORTE REC). » (en-tête, ligne 2)
- **Lit** : services — `@/services/featureFlagsService` (`:25`), `@/services/nextTrackDayService` (`:26`), `@/services/pilotNotesService` (`:27`), `@/services/consentService` (`:28`) · features — `@/features/rec/captureStepLogic` (`:46`), `@/features/rec/entreRunsLogic` (`:56`) · magasins — `@/store/useAuthStore` (`:30`), `@/store/useSessionStore` (`:31`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `addNote`
- **Entrées** : `src/features/rec/captureStepLogic.ts:69` (table de routes)
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : `biometry` (`:123`)
- **Composants propres** : aucun

### `/(app2)/rec/equipement`

- **Fichier** : `app/(app2)/rec/equipement.tsx` — 1146 lignes
- **Fonction** : « ÉQUIPEMENT — écran 4/8 du lot V2-L2 (porte REC). Route `rec/equipement` » (en-tête, ligne 2)
- **Lit** : services — `@/services/featureFlagsService` (`:57`), `@/services/consentService` (`:62`), `@/services/deviceHealthService` (`:63`), `@/services/pilotConsentService` (`:64`) · features — `@/features/rec/equipementLogic` (`:56`) · magasins — `@/store/useAuthStore` (`:65`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `setBiometryCaptureConsent`, `setBiometryCoachShareConsent`
- **Entrées** : `src/features/rec/captureStepLogic.ts:66` (table de routes)
- **Sorties** : `/(app2)/rec/placement`
- **Drapeaux** : `biometry` (`:519`)
- **Composants propres** : `@/features/rec/equipementLogic`

### `/(app2)/rec/fin`

- **Fichier** : `app/(app2)/rec/fin.tsx` — 678 lignes
- **Fonction** : « FIN DE SÉANCE — écran 8/8 du flux capture v2 (lot V2-L2, PORTE REC). » (en-tête, ligne 2)
- **Lit** : services — `@/services/analyzeSessionService` (`:34`), `@/services/featureFlagsService` (`:35`), `@/services/consentService` (`:36`), `@/services/v2/biometryLogic` (`:37`), `@/services/v2/biometryService` (`:38`), `@/services/v2/healthKitService` (`:39`), `@/services/v2/incidentService` (`:40`) · features — `@/features/miroir/bilanLogic` (`:60`), `@/features/rec/bio1Trigger` (`:61`), `@/features/rec/finLogic` (`:71`), `@/features/rec/incidentOffline` (`:72`) · magasins — `@/store/useAuthStore` (`:43`), `@/store/useSessionStore` (`:44`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `saveSamples`
- **Entrées** : `src/features/rec/captureStepLogic.ts:70` (table de routes)
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/rec/bio1Trigger`, `@/features/rec/incidentOffline`

### `/(app2)/rec/placement`

- **Fichier** : `app/(app2)/rec/placement.tsx` — 424 lignes
- **Fonction** : « PLACEMENT — écran 5/8 du lot V2-L2 (porte REC). Route `rec/placement` » (en-tête, ligne 2)
- **Lit** : services — `@/services/captureFinishLineLogic` (`:33`), `@/services/captureSessionService` (`:34`), `@/services/circuitsService` (`:40`) · features — `@/features/rec/armementLogic` (`:32`) · magasins — `@/store/useAuthStore` (`:41`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `startCaptureSession`
- **Entrées** : `app/(app2)/rec/equipement.tsx:553`, `src/features/rec/captureStepLogic.ts:67` (table de routes)
- **Sorties** : `/(app2)/rec/roulage`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/rec/armementLogic`

### `/(app2)/rec/preparation`

- **Fichier** : `app/(app2)/rec/preparation.tsx` — 1081 lignes
- **Fonction** : « PRÉPARATION — porte REC, écran 2/8 (V2-L2). PEAU v2 sur les mêmes données » (en-tête, ligne 2)
- **Lit** : services — `@/services/circuitsService` (`:45`), `@/services/eventsService` (`:46`), `@/services/nextTrackDayService` (`:47`), `@/services/featureFlagsService` (`:48`), `@/services/weatherService` (`:54`), `@/services/v2/referralService` (`:55`), `@/services/v2/convoysService` (`:56`) · features — `@/features/rec/preparationLogic` (`:100`), `@/features/rec/attendancePublicService` (`:106`) · magasins — `@/store/useAuthStore` (`:57`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/index.tsx:377`, `app/(app2)/index.tsx:524`, `src/features/rec/captureStepLogic.ts:64` (table de routes), `src/services/paddockHeroLogic.ts:61`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : `convoys` (`:186`)
- **Composants propres** : `@/features/rec/preparationLogic`

### `/(app2)/rec/roulage`

- **Fichier** : `app/(app2)/rec/roulage.tsx` — 275 lignes
- **Fonction** : « ROULAGE — écran 6/8 du flux de capture v2 (lot V2-L2, PORTE REC). » (en-tête, ligne 2)
- **Lit** : services — `@/services/captureLinkStatusLogic` (`:31`), `@/services/captureSessionService` (`:37`) · features — `@/features/rec/captureStepLogic` (`:50`) · magasins — `@/store/useSessionStore` (`:38`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `stopCaptureSession`
- **Entrées** : `app/(app2)/rec/placement.tsx:268`, `src/features/rec/captureStepLogic.ts:68` (table de routes)
- **Sorties** : `/(app2)`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(app2)/reserver`

- **Fichier** : `app/(app2)/reserver/index.tsx` — 206 lignes
- **Fonction** : « RÉSERVER — catalogue (V2-L4, mission D, flux A1, écran 1/3). Route NOUVELLE. » (en-tête, ligne 2)
- **Lit** : services — `@/services/bookingCatalogService` (`:22`) · features — `@/features/vous/useReserverCatalog` (`:23`), `@/features/vous/reserverUi` (`:29`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/club/pass.tsx:127`, `app/(app2)/reserver/[sessionId].tsx:126`
- **Sorties** : `/(app2)/reserver/${item.sessionId}`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/useReserverCatalog`

### `/(app2)/reserver/[sessionId]`

- **Fichier** : `app/(app2)/reserver/[sessionId].tsx` — 370 lignes
- **Fonction** : « RÉSERVER — détail & choix d'offre (V2-L4, mission D, flux A1, écran 2/3). » (en-tête, ligne 2)
- **Lit** : services — `@/services/bookingCatalogService` (`:19`), `@/services/bookingCatalogLogic` (`:20`) · features — `@/features/vous/useReserverDay` (`:17`), `@/features/vous/reserverUi` (`:18`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/reserver/index.tsx:158`
- **Sorties** : `/(app2)/reserver/paiement`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/useReserverDay`

### `/(app2)/reserver/paiement`

- **Fichier** : `app/(app2)/reserver/paiement.tsx` — 293 lignes
- **Fonction** : « RÉSERVER — paiement (V2-L4, mission D, flux A1, écran 3/3). Route NOUVELLE. » (en-tête, ligne 2)
- **Lit** : features — `@/features/vous/useReserverPayment` (`:18`), `@/features/vous/reserverUi` (`:19`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/reserver/[sessionId].tsx:126`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/useReserverPayment`

### `/(app2)/signature`

- **Fichier** : `app/(app2)/signature.tsx` — 465 lignes
- **Fonction** : « SIGNATURE — écran 3/3 du lot V2-L1 (porte Miroir), route NOUVELLE. » (en-tête, ligne 2)
- **Lit** : services — `@/services/qdiLogic` (`:50`), `@/services/qdiService` (`:51`) · features — `@/features/miroir/signatureLogic` (`:84`), `@/features/miroir/useSignature` (`:85`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/data/saison.tsx:522`, `app/(app2)/index.tsx:581`
- **Sorties** : `/(app2)/data`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/miroir/useSignature`

### `/(app2)/vous`

- **Fichier** : `app/(app2)/vous/index.tsx` — 643 lignes
- **Fonction** : « VOUS HUB — porte d'identité (app2), lot V2-L4 écran 1/8 (Mission A). » (en-tête, ligne 2)
- **Lit** : features — `@/features/miroir/miroirHomeLogic` (`:54`), `@/features/vous/vousHubLogic` (`:55`), `@/features/vous/useVousHub` (`:56`) · magasins — `@/store/useAuthStore` (`:31`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/index.tsx:313`, `app/(app2)/vous/documents.tsx:170`, `app/(app2)/vous/documents.tsx:184`, `app/(app2)/vous/equipement.tsx:91`, `app/(app2)/_layout.tsx:41` (table de routes), `src/features/vous/reserverUi.tsx:150`
- **Sorties** : `/(app2)/vous/profil`, `/(app2)/vous/garage`, `/(app2)/vous/carnet`, `/(app2)/vous/equipement`, `/(app2)/vous/documents`, `/(app2)/vous/reglages`, `/(app2)/vous/support`, `/(app2)/vous/fondateur`, `/(app2)/club`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/useVousHub`

### `/(app2)/vous/carnet`

- **Fichier** : `app/(app2)/vous/carnet.tsx` — 915 lignes
- **Fonction** : « CARNET — porte VOUS, écran 4/8 du lot V2-L4. Route `vous/carnet`. » (en-tête, ligne 2)
- **Lit** : services — `@/services/pilotGoalsService` (`:89`), `@/services/developmentCycleService` (`:90`) · features — `@/features/vous/carnetLogic` (`:82`), `@/features/vous/useCarnet` (`:88`) · magasins — `@/store/useAuthStore` (`:53`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/vous/index.tsx:66`
- **Sorties** : `/(app2)/bilan/${item.intention.sessionId}`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(app2)/vous/decharge`

- **Fichier** : `app/(app2)/vous/decharge.tsx` — 503 lignes
- **Fonction** : « DÉCHARGE — sous-écran de VOUS/Documents (lot V2-L4). Route `vous/decharge`. » (en-tête, ligne 2)
- **Lit** : services — `@/services/featureFlagsService` (`:21`), `@/services/waiverService` (`:27`), `@/services/waiverLogic` (`:28`) · magasins — `@/store/useAuthStore` (`:29`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `acceptWaiver`
- **Entrées** : `app/(app2)/vous/documents.tsx:170`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : `pilot_waivers` (`:68`)
- **Composants propres** : aucun

### `/(app2)/vous/document/[doc]`

- **Fichier** : `app/(app2)/vous/document/[doc].tsx` — 199 lignes
- **Fonction** : « LECTEUR LÉGAL — sous-écran de VOUS/Documents (lot V2-L4). Route » (en-tête, ligne 2)
- **Lit** : aucun service, hook ni magasin importé
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/vous/documents.tsx:184`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(app2)/vous/documents`

- **Fichier** : `app/(app2)/vous/documents.tsx` — 505 lignes
- **Fonction** : « LICENCE & DOCUMENTS — porte VOUS, écran 6/8 du lot V2-L4. Route `vous/documents`. » (en-tête, ligne 2)
- **Lit** : features — `@/features/vous/documentsLogic` (`:54`), `@/features/vous/useDocuments` (`:55`) · magasins — `@/store/useAuthStore` (`:30`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/vous/index.tsx:68`
- **Sorties** : `/(app2)/vous/decharge`, `/(app2)/vous/document/${doc.slug}`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/useDocuments`

### `/(app2)/vous/equipement`

- **Fichier** : `app/(app2)/vous/equipement.tsx` — 423 lignes
- **Fonction** : « ÉQUIPEMENT — porte VOUS, écran 5/8 du lot V2-L4. Route `vous/equipement`. » (en-tête, ligne 2)
- **Lit** : features — `@/features/vous/equipementLogic` (`:51`), `@/features/vous/useEquipement` (`:52`) · magasins — `@/store/useAuthStore` (`:27`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/vous/index.tsx:67`
- **Sorties** : `/(app2)/vous/reglages`
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/useEquipement`

### `/(app2)/vous/fondateur`

- **Fichier** : `app/(app2)/vous/fondateur.tsx` — 473 lignes
- **Fonction** : « MEMBRE FONDATEUR — candidature (app2), lot V2-L4 (Mission A, A2). » (en-tête, ligne 2)
- **Lit** : services — `@/services/featureFlagsService` (`:26`), `@/services/v2/founderService` (`:31`), `@/services/v2/founderLogic` (`:36`) · features — `@/features/vous/vousHubLogic` (`:52`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `apply`
- **Entrées** : `app/(app2)/vous/index.tsx:293`, `src/features/vous/reserverUi.tsx:150`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : `founders` (`:77`)
- **Composants propres** : aucun

### `/(app2)/vous/garage`

- **Fichier** : `app/(app2)/vous/garage.tsx` — 979 lignes
- **Fonction** : « GARAGE — écran 3/8 de la porte VOUS (V2-L4), « l'écran photo ». Route NOUVELLE. » (en-tête, ligne 2)
- **Lit** : services — `@/services/garageService` (`:55`), `@/services/pilotMediaService` (`:61`) · features — `@/features/vous/garageLogic` (`:76`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `addMyPilotMedia`
- **Entrées** : `app/(app2)/vous/index.tsx:65`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(app2)/vous/profil`

- **Fichier** : `app/(app2)/vous/profil.tsx` — 830 lignes
- **Fonction** : « PROFIL PUBLIC — écran 2/8 de la porte VOUS (V2-L4), route NOUVELLE. » (en-tête, ligne 2)
- **Lit** : services — `@/services/pilotMediaService` (`:48`) · requêtes — `@/lib/queries/profil` (`:42`) · features — `@/features/vous/profilLogic` (`:61`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/vous/index.tsx:64`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(app2)/vous/reglages`

- **Fichier** : `app/(app2)/vous/reglages.tsx` — 675 lignes
- **Fonction** : « RÉGLAGES — écran 7/8 de la porte VOUS (V2-L4, mission D). Route NOUVELLE. » (en-tête, ligne 2)
- **Lit** : features — `@/features/vous/reglagesRitualsLogic` (`:33`), `@/features/vous/reglagesConsentLogic` (`:34`), `@/features/vous/useReglages` (`:35`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/vous/equipement.tsx:91`, `app/(app2)/vous/index.tsx:69`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/reglagesRitualsLogic`, `@/features/vous/reglagesConsentLogic`, `@/features/vous/useReglages`

### `/(app2)/vous/support`

- **Fichier** : `app/(app2)/vous/support.tsx` — 506 lignes
- **Fonction** : « SUPPORT — écran 8/8 de la porte VOUS (V2-L4, mission D). Route NOUVELLE. » (en-tête, ligne 2)
- **Lit** : services — `@/services/supportService` (`:25`) · features — `@/features/vous/supportLogic` (`:31`), `@/features/vous/useSupport` (`:32`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app2)/vous/index.tsx:70`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/features/vous/useSupport`

---

## Espace coach — `app/(coach)`

### `/(coach)`

- **Fichier** : `app/(coach)/index.tsx` — 1239 lignes
- **Fonction** : « Poste de pilotage — hub de l'espace COACH (handoff §12, `coach/01-poste.png` » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:74`), `@/services/coachQueueLogic` (`:75`), `@/services/coachQueueService` (`:76`), `@/services/featureFlagsService` (`:77`) · hooks — `@/hooks/useCoachPermissions` (`:66`) · magasins — `@/store/useAuthStore` (`:78`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(app)/virage.tsx:718`, `app/(coach)/business.tsx:256`, `app/(coach)/business.tsx:419`, `app/(coach)/calendrier.tsx:162`, `app/(coach)/calendrier.tsx:178`, `app/(coach)/cycles.tsx:392`, `app/(coach)/debrief.tsx:384`, `app/(coach)/demandes.tsx:140` … et 40 autres
- **Sorties** : `/(coach)/pilote/[id]`, `/(coach)/demandes`, `/(coach)/comparer-pilotes`, `/(coach)/cycles`, `/(coach)/reperes`, `/(coach)/gabarits`, `/(coach)/assistant`, `/(coach)/lecture`, `/(coach)/ar`, `/(coach)/roulages`, `/(coach)/business`, `/(coach)/facturation`, `/(coach)/studio`, `/(coach)/file-lecture`, `/(coach)/profil`
- **Drapeaux** : `coach_billing` (`:178`)
- **Composants propres** : aucun

### `/(coach)/_layout`

- **Fichier** : `app/(coach)/_layout.tsx` — 66 lignes · **layout**
- **Fonction** : « Layout coach OXV — ADAPTATIF deux formats (décision fondateur 2026-07-13) : » (en-tête, ligne 2)
- **Lit** : magasins — `@/store/useAuthStore` (`:24`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : `/(app2)` ← hors groupe
- **Drapeaux** : aucun
- **Composants propres** : `@/components/CoachRail`, `@/components/CoachTabBar`

### `/(coach)/annoter`

- **Fichier** : `app/(coach)/annoter.tsx` — 1113 lignes
- **Fonction** : « Coach — Annoter un virage d'un pilote suivi. Reskin refonte-v2 §12, RESPONSIVE » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachAnnotationsService` (`:59`), `@/services/coachAudioService` (`:65`), `@/services/coachCurationLogic` (`:67`), `@/services/coachCurationService` (`:68`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `attachAudioToAnnotation`, `startRecording`, `stopRecording`
- **Entrées** : `app/(app)/virage.tsx:718`, `app/(coach)/en-direct/[sessionId].tsx:595`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/ar`

- **Fichier** : `app/(coach)/ar.tsx` — 1010 lignes
- **Fonction** : « Vue Coach — E0.1 : configuration de la vue AR (lunettes Ray-Ban Display). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:82`), `@/services/liveSessionLogic` (`:83`) · hooks — `@/hooks/useLiveRoster` (`:73`), `@/hooks/usePilotLive` (`:74`) · magasins — `@/store/useAuthStore` (`:84`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/assistant`

- **Fichier** : `app/(coach)/assistant.tsx` — 1302 lignes
- **Fonction** : « Coach — Assistant IA (C-1). Reskin refonte-v2 §12, RESPONSIVE deux formats, » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:64`), `@/services/coachAiService` (`:65`), `@/services/coachTriageLogic` (`:66`), `@/services/coachTriageService` (`:67`), `@/services/marginZoneColorLogic` (`:68`) · RPC — `coach_ai_consent` (`:370`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : `@/components/AIReviewBanner`

### `/(coach)/business`

- **Fichier** : `app/(coach)/business.tsx` — 642 lignes
- **Fonction** : « Coach — Business / Roulages (handoff §12 `coach/24-business`, sur les roulages » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:40`), `@/services/roulagesLogic` (`:47`), `@/services/roulagesService` (`:48`) · hooks — `@/hooks/useCoachPermissions` (`:38`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/index.tsx:335` (table de routes)
- **Sorties** : `/(coach)/roulages/nouveau`, `/(coach)/roulages`, `/(coach)/roulages/[id]`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/calendrier`

- **Fichier** : `app/(coach)/calendrier.tsx` — 832 lignes
- **Fonction** : « Coach — Calendrier / Agenda (handoff §12 `coach/22-calendrier.png` console + » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachMarketplaceService` (`:46`)
- **Écrit** : aucune écriture établie
- **Entrées** : `src/lib/coachNav.ts:33` (table de routes), `src/lib/coachNav.ts:115` (table de routes)
- **Sorties** : `/(coach)/pilote/[id]`, `/(coach)/disponibilites`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/comparer`

- **Fichier** : `app/(coach)/comparer.tsx` — 551 lignes
- **Fonction** : « Écran Coach — Comparer DEUX séances d'un même pilote (handoff §12 · » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:41`), `@/services/regularityService` (`:42`), `@/services/sessionsService` (`:43`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/index.tsx:306` (table de routes), `app/(coach)/pilote/[id].tsx:107`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/comparer-pilotes`

- **Fichier** : `app/(coach)/comparer-pilotes.tsx` — 802 lignes
- **Fonction** : « Coach — Comparer DEUX pilotes, RESPONSIVE DEUX FORMATS (décision fondateur » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:55`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/index.tsx:306` (table de routes)
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/contexte`

- **Fichier** : `app/(coach)/contexte.tsx` — 356 lignes
- **Fonction** : « Coach — Contexte de séance (§12 handoff · coach/13-contexte), RESKIN » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachContextLogic` (`:42`), `@/services/coachSessionContextService` (`:43`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `upsertSessionContext`
- **Entrées** : `app/(coach)/pilote/[id].tsx:779`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/cycles`

- **Fichier** : `app/(coach)/cycles.tsx` — 869 lignes
- **Fonction** : « Coach — Programmes adaptatifs (handoff §12 `coach/14-programmes`), RESPONSIVE » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:50`), `@/services/developmentCycleService` (`:56`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `createCycle`
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : `/(coach)/cycles/${cycle.id}`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/cycles/[id]`

- **Fichier** : `app/(coach)/cycles/[id].tsx` — 871 lignes
- **Fonction** : « Coach — Détail d'un programme (C-2), reskin refonte-v2 §12, RESPONSIVE deux » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:55`), `@/services/developmentCycleService` (`:66`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `addStep`, `deleteCycle`, `deleteStep`, `updateCycle`, `updateStep`
- **Entrées** : `app/(coach)/cycles.tsx:392`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/debrief`

- **Fichier** : `app/(coach)/debrief.tsx` — 524 lignes
- **Fonction** : « Coach — Débrief, MODE PRÉSENTATION, RESPONSIVE DEUX FORMATS (décision fondateur » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachStudioService` (`:40`), `@/services/featureFlagsService` (`:41`), `@/services/v2/biometryService` (`:42`), `@/services/marginZoneColorLogic` (`:44`), `@/services/sessionTelemetryService` (`:45`) · features — `@/features/miroir/bilanLogic` (`:38`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/studio.tsx:335`
- **Sorties** : `/(coach)/triage`
- **Drapeaux** : `biometry` (`:108`)
- **Composants propres** : aucun

### `/(coach)/demandes`

- **Fichier** : `app/(coach)/demandes.tsx` — 557 lignes
- **Fonction** : « Coach — Demandes reçues (handoff §12 `coach/21-demandes`, sur `coaching_bookings`). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachMarketplaceService` (`:55`)
- **Écrit** : aucune écriture établie
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : `/(coach)/disponibilites`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/disponibilites`

- **Fichier** : `app/(coach)/disponibilites.tsx` — 902 lignes
- **Fonction** : « Coach — Disponibilités (handoff §12 `coach/20-disponibilites.png`). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachMarketplaceService` (`:58`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/calendrier.tsx:178`, `app/(coach)/demandes.tsx:140`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/en-direct`

- **Fichier** : `app/(coach)/en-direct.tsx` — 707 lignes
- **Fonction** : « En direct — roster coach des pilotes en piste (P5), au langage refonte-v2 §12. » (en-tête, ligne 2)
- **Lit** : services — `@/services/cardioZoneLogic` (`:58`), `@/services/liveSessionLogic` (`:59`), `@/services/liveSessionService` (`:60`) · hooks — `@/hooks/useLiveRoster` (`:55`), `@/hooks/useRosterBiometry` (`:56`) · magasins — `@/store/useAuthStore` (`:61`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `startSimulatedStream`
- **Entrées** : `src/lib/coachNav.ts:30` (table de routes)
- **Sorties** : `/(coach)/en-direct/[sessionId]`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/en-direct/[sessionId]`

- **Fichier** : `app/(coach)/en-direct/[sessionId].tsx` — 948 lignes
- **Fonction** : « Coach — En direct · focus pilote (handoff §12 `coach/27-en-direct-focus` + » (en-tête, ligne 2)
- **Lit** : services — `@/services/liveSessionLogic` (`:56`), `@/services/sessionsService` (`:57`) · hooks — `@/hooks/usePilotLive` (`:47`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/en-direct.tsx:285`
- **Sorties** : `/(coach)/annoter`, `/(coach)/reperes`, `/(coach)/messages`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/facturation`

- **Fichier** : `app/(coach)/facturation.tsx` — 701 lignes
- **Fonction** : « Coach — Facturation (P2, VISION_COACH_STUDIO.md · décision fondateur 2026-07-04). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachBillingLogic` (`:41`), `@/services/coachBillingService` (`:49`), `@/services/coachInvoicePdfService` (`:50`), `@/services/coachService` (`:51`), `@/services/featureFlagsService` (`:52`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `setInvoicingAssist`
- **Entrées** : `app/(coach)/facture-nouvelle.tsx:295`, `app/(coach)/index.tsx:343` (table de routes), `src/lib/coachNav.ts:116` (table de routes)
- **Sorties** : `/(coach)/facture-nouvelle`, `/(coach)/facturation-identite`
- **Drapeaux** : `coach_billing` (`:108`)
- **Composants propres** : aucun

### `/(coach)/facturation-identite`

- **Fichier** : `app/(coach)/facturation-identite.tsx` — 422 lignes
- **Fonction** : « Coach — Identité de facturation (P2, aide à la facture · émetteur = le coach). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachBillingLogic` (`:50`), `@/services/coachBillingService` (`:51`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `updateMyBillingProfile`
- **Entrées** : `app/(coach)/facturation.tsx:256`, `app/(coach)/facture-nouvelle.tsx:295`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/facture-nouvelle`

- **Fichier** : `app/(coach)/facture-nouvelle.tsx` — 751 lignes
- **Fonction** : « Coach — Émettre une facture (P2, aide à la facture · émetteur = le coach). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachBillingLogic` (`:44`), `@/services/coachBillingService` (`:50`), `@/services/coachInvoicePdfService` (`:51`), `@/services/coachService` (`:52`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `issueInvoice`
- **Entrées** : `app/(coach)/facturation.tsx:187`
- **Sorties** : `/(coach)/facturation-identite`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/file-lecture`

- **Fichier** : `app/(coach)/file-lecture.tsx` — 591 lignes
- **Fonction** : « Coach — File de lecture (handoff §12 `coach/02-file-lecture`, sur `coach_queue`). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachQueueLogic` (`:33`), `@/services/coachQueueService` (`:34`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `setQueueStatus`
- **Entrées** : `app/(coach)/index.tsx:494`, `src/lib/coachNav.ts:112` (table de routes)
- **Sorties** : `/(coach)/studio`, `/(coach)/rapport`, `/(coach)/pilote/[id]`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/gabarits`

- **Fichier** : `app/(coach)/gabarits.tsx` — 899 lignes
- **Fonction** : « Coach — Gabarits de commentaire (handoff §12 `coach/10-gabarits`), RESPONSIVE » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachCurationLogic` (`:65`), `@/services/coachCurationService` (`:66`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `createTemplate`, `deleteTemplate`
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/lecture`

- **Fichier** : `app/(coach)/lecture.tsx` — 530 lignes
- **Fonction** : « Coach — « Ma lecture » (§10.3c-D), RESKIN refonte-v2 §12, RESPONSIVE deux » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachReadingLogic` (`:42`), `@/services/coachReadingService` (`:43`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `upsertReadingWeights`
- **Entrées** : **ORPHELIN** — aucune navigation ni table de routes ne le cite
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/messages`

- **Fichier** : `app/(coach)/messages.tsx` — 658 lignes
- **Fonction** : « Messages — fils coach↔pilote (handoff §12 `coach/29-messagerie` + coach-mobile » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachMessagesService` (`:48`) · hooks — `@/hooks/useCoachThread` (`:42`) · magasins — `@/store/useAuthStore` (`:49`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/en-direct/[sessionId].tsx:617`, `app/(coach)/messages/[coachPilotId].tsx:208`, `src/lib/coachNav.ts:32` (table de routes)
- **Sorties** : `/(coach)/messages/[coachPilotId]`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/messages/[coachPilotId]`

- **Fichier** : `app/(coach)/messages/[coachPilotId].tsx` — 641 lignes
- **Fonction** : « Coach — Fil de discussion coach↔pilote (handoff §12 `coach/29-messagerie` + » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachMessagesService` (`:51`) · hooks — `@/hooks/useCoachThread` (`:43`) · magasins — `@/store/useAuthStore` (`:52`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/messages.tsx:136`
- **Sorties** : `/(coach)/messages/[coachPilotId]`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/pilote/[id]`

- **Fichier** : `app/(coach)/pilote/[id].tsx` — 1090 lignes
- **Fonction** : « Vue Coach — Fiche pilote (CRM lecture seule, handoff §12 · coach/15-fiche-pilote). » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:46`), `@/services/pilotProfileService` (`:47`), `@/services/pilotNotesService` (`:48`), `@/services/pilotSignatureSnapshotService` (`:52`), `@/services/pilotMediaService` (`:53`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/calendrier.tsx:162`, `app/(coach)/file-lecture.tsx:342`, `app/(coach)/index.tsx:293`, `app/_layout.tsx:129`
- **Sorties** : `/(coach)/comparer`, `/(coach)/priorites`, `/(coach)/plan`, `/(app)/bilan` ← **sortie V1**, `/(coach)/contexte`, `/(app)/virage` ← **sortie V1**
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/plan`

- **Fichier** : `app/(coach)/plan.tsx` — 694 lignes
- **Fonction** : « Coach — Plan d'objectifs (P-plan). Reskin refonte-v2 §12, RESPONSIVE deux formats. » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachObjectivesService` (`:53`), `@/services/coachService` (`:54`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/pilote/[id].tsx:268`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/priorites`

- **Fichier** : `app/(coach)/priorites.tsx` — 552 lignes
- **Fonction** : « Coach — Priorités du bilan (§12 handoff · coach/07-priorites), RESKIN » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachCurationLogic` (`:42`), `@/services/coachCurationService` (`:43`), `@/services/coachService` (`:44`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `upsertHighlight`
- **Entrées** : `app/(coach)/pilote/[id].tsx:258`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/profil`

- **Fichier** : `app/(coach)/profil.tsx` — 829 lignes
- **Fonction** : « Écran Coach — Ma fiche publique / compte pro (édition de la fiche vue par les » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachProfileService` (`:55`), `@/services/coachMediaService` (`:62`) · magasins — `@/store/useAuthStore` (`:63`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `addMyCoachMedia`, `removeMyCoachMedia`
- **Entrées** : `app/(coach)/index.tsx:551`, `src/components/CoachRail.tsx:65`, `src/lib/coachNav.ts:34` (table de routes)
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/rapport`

- **Fichier** : `app/(coach)/rapport.tsx` — 667 lignes
- **Fonction** : « Coach — Rapport de séance (PDF). Reskin refonte-v2 §12, RESPONSIVE deux formats. » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachReportPdfService` (`:44`), `@/services/coachStudioService` (`:45`) · magasins — `@/store/useAuthStore` (`:46`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/file-lecture.tsx:325`, `app/(coach)/studio.tsx:321`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/repere/[index]`

- **Fichier** : `app/(coach)/repere/[index].tsx` — 642 lignes
- **Fonction** : « Coach — Éditeur d'un repère de virage (§12 handoff · coach/08-reperes), » (en-tête, ligne 2)
- **Lit** : services — `@/services/circuitsService` (`:53`), `@/services/coachReferenceLogic` (`:54`), `@/services/coachReferenceService` (`:55`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `upsertCornerReference`
- **Entrées** : `app/(coach)/reperes.tsx:269`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/reperes`

- **Fichier** : `app/(coach)/reperes.tsx` — 900 lignes
- **Fonction** : « Coach — Repères de virage MULTI-CIRCUIT. Reskin refonte-v2 §12, RESPONSIVE » (en-tête, ligne 2)
- **Lit** : services — `@/services/circuitsService` (`:57`), `@/services/coachReferenceLogic` (`:62`), `@/services/coachReferenceService` (`:63`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/en-direct/[sessionId].tsx:613`, `app/(coach)/index.tsx:315` (table de routes)
- **Sorties** : `/(coach)/repere/[index]`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/roulages`

- **Fichier** : `app/(coach)/roulages/index.tsx` — 438 lignes
- **Fonction** : « Vue Coach — mes roulages (§8 OXV Mirror ; langage §12 handoff). » (en-tête, ligne 2)
- **Lit** : services — `@/services/roulagesLogic` (`:37`), `@/services/roulagesService` (`:38`) · hooks — `@/hooks/useCoachPermissions` (`:35`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/business.tsx:256`, `app/(coach)/business.tsx:419`, `app/(coach)/index.tsx:327` (table de routes), `app/(coach)/roulages/nouveau.tsx:142`
- **Sorties** : `/(coach)/roulages/nouveau`, `/(coach)/roulages/[id]`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/roulages/[id]`

- **Fichier** : `app/(coach)/roulages/[id].tsx` — 672 lignes
- **Fonction** : « Vue Coach — détail d'un roulage (§8 OXV Mirror ; langage §12 handoff, proche du » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachService` (`:35`), `@/services/roulagesLogic` (`:44`), `@/services/roulagesService` (`:51`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `removeInvitation`, `setRoulageStatus`
- **Entrées** : `app/(coach)/business.tsx:256`, `app/(coach)/business.tsx:419`, `app/(coach)/roulages/index.tsx:99`, `app/(coach)/roulages/index.tsx:286`
- **Sorties** : aucune route de groupe citée
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/roulages/nouveau`

- **Fichier** : `app/(coach)/roulages/nouveau.tsx` — 538 lignes
- **Fonction** : « Coach — Nouveau roulage (§8 OXV Mirror ; langage §12 handoff). » (en-tête, ligne 2)
- **Lit** : services — `@/services/roulagesLogic` (`:43`), `@/services/roulagesService` (`:44`)
- **Écrit** : via service (nom de fonction importée, table à confirmer) — `createRoulage`
- **Entrées** : `app/(coach)/business.tsx:256`, `app/(coach)/roulages/index.tsx:99`
- **Sorties** : `/(coach)/roulages`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/studio`

- **Fichier** : `app/(coach)/studio.tsx` — 909 lignes
- **Fonction** : « Coach — Studio télémétrique (P0/VISION_COACH_STUDIO.md), RESPONSIVE DEUX » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachStudioService` (`:60`), `@/services/marginZoneColorLogic` (`:61`), `@/services/sessionTelemetryService` (`:62`), `@/services/sessionsService` (`:63`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/file-lecture.tsx:268`, `app/(coach)/index.tsx:484`, `app/(coach)/triage.tsx:233`, `src/lib/coachNav.ts:113` (table de routes)
- **Sorties** : `/(coach)/rapport`, `/(coach)/debrief`, `/(coach)/triage`
- **Drapeaux** : aucun
- **Composants propres** : aucun

### `/(coach)/triage`

- **Fichier** : `app/(coach)/triage.tsx` — 377 lignes
- **Fonction** : « Coach — Triage (smart flagging). Reskin refonte-v2 §12, RESPONSIVE deux formats. » (en-tête, ligne 2)
- **Lit** : services — `@/services/coachTriageLogic` (`:36`), `@/services/coachTriageService` (`:37`), `@/services/marginZoneColorLogic` (`:38`), `@/services/sessionTelemetryService` (`:39`)
- **Écrit** : aucune écriture établie
- **Entrées** : `app/(coach)/debrief.tsx:384`, `app/(coach)/studio.tsx:549`
- **Sorties** : `/(coach)/studio`
- **Drapeaux** : aucun
- **Composants propres** : aucun

---

## Synthèses

### Écrans orphelins

Aucune navigation ni table de routes du dépôt ne les cite. Ils existent, ils sont écrits, aucun chemin connu n'y mène.

| Route | Fichier | Lignes |
|---|---|---|
| `/(app2)/club/galerie` | `app/(app2)/club/galerie.tsx` | 1003 |
| `/(app2)/club/territoire` | `app/(app2)/club/territoire.tsx` | 1428 |
| `/(app2)/data/saison` | `app/(app2)/data/saison.tsx` | 1308 |
| `/(app2)/dev-galerie` | `app/(app2)/dev-galerie.tsx` | 764 |
| `/(coach)/ar` | `app/(coach)/ar.tsx` | 1010 |
| `/(coach)/assistant` | `app/(coach)/assistant.tsx` | 1302 |
| `/(coach)/cycles` | `app/(coach)/cycles.tsx` | 869 |
| `/(coach)/demandes` | `app/(coach)/demandes.tsx` | 557 |
| `/(coach)/gabarits` | `app/(coach)/gabarits.tsx` | 899 |
| `/(coach)/lecture` | `app/(coach)/lecture.tsx` | 530 |

**Volume total : 9670 lignes.**

### Liens sortants vers `app/(app)` — la dette de bascule V1

| Fichier | Ligne | Cible |
|---|---|---|
| `app/(app2)/bilan/[sessionId].tsx` | 577 | `/(app)/carte-trophee?sessionId=${sessionId}` |
| `app/(app2)/club/territoire.tsx` | 622 | `/(app)/creer-route` |
| `app/(app2)/club/territoire.tsx` | 629 | `/(app)/creer-trace` |
| `app/(coach)/pilote/[id].tsx` | 759 | `/(app)/bilan` |
| `app/(coach)/pilote/[id].tsx` | 797 | `/(app)/virage` |

### Drapeaux et leurs consommateurs

| Drapeau | Écrans |
|---|---|
| `app_payments` | `/(app2)/club/pass` (`app/(app2)/club/pass.tsx:107`) |
| `convoys` | `/(app2)/club/territoire` (`app/(app2)/club/territoire.tsx:159`), `/(app2)/rec/preparation` (`app/(app2)/rec/preparation.tsx:186`) |
| `biometry` | `/(app2)/rec/entre-runs` (`app/(app2)/rec/entre-runs.tsx:123`), `/(app2)/rec/equipement` (`app/(app2)/rec/equipement.tsx:519`), `/(coach)/debrief` (`app/(coach)/debrief.tsx:108`) |
| `pilot_waivers` | `/(app2)/vous/decharge` (`app/(app2)/vous/decharge.tsx:68`) |
| `founders` | `/(app2)/vous/fondateur` (`app/(app2)/vous/fondateur.tsx:77`) |
| `coach_billing` | `/(coach)` (`app/(coach)/index.tsx:178`), `/(coach)/facturation` (`app/(coach)/facturation.tsx:108`) |

### Écrans qui écrivent en base

Aucune écriture DIRECTE (`.from(...).insert/update/upsert/delete`) n'existe dans ces deux arbres. La liste ci-dessous relève les écrans important une fonction dont le nom est un verbe d'écriture — **la table touchée reste à confirmer dans le service concerné**.

| Route | Fonctions d’écriture importées |
|---|---|
| `/(app2)/rec/entre-runs` | `addNote` |
| `/(app2)/rec/equipement` | `setBiometryCaptureConsent`, `setBiometryCoachShareConsent` |
| `/(app2)/rec/fin` | `saveSamples` |
| `/(app2)/rec/placement` | `startCaptureSession` |
| `/(app2)/rec/roulage` | `stopCaptureSession` |
| `/(app2)/vous/decharge` | `acceptWaiver` |
| `/(app2)/vous/fondateur` | `apply` |
| `/(app2)/vous/garage` | `addMyPilotMedia` |
| `/(coach)/annoter` | `attachAudioToAnnotation`, `startRecording`, `stopRecording` |
| `/(coach)/contexte` | `upsertSessionContext` |
| `/(coach)/cycles` | `createCycle` |
| `/(coach)/cycles/[id]` | `addStep`, `deleteCycle`, `deleteStep`, `updateCycle`, `updateStep` |
| `/(coach)/en-direct` | `startSimulatedStream` |
| `/(coach)/facturation` | `setInvoicingAssist` |
| `/(coach)/facturation-identite` | `updateMyBillingProfile` |
| `/(coach)/facture-nouvelle` | `issueInvoice` |
| `/(coach)/file-lecture` | `setQueueStatus` |
| `/(coach)/gabarits` | `createTemplate`, `deleteTemplate` |
| `/(coach)/lecture` | `upsertReadingWeights` |
| `/(coach)/priorites` | `upsertHighlight` |
| `/(coach)/profil` | `addMyCoachMedia`, `removeMyCoachMedia` |
| `/(coach)/repere/[index]` | `upsertCornerReference` |
| `/(coach)/roulages/[id]` | `removeInvitation`, `setRoulageStatus` |
| `/(coach)/roulages/nouveau` | `createRoulage` |

### Casts `as never` sur des routes

Le typage des routes est périmé : `.expo/types/router.d.ts` ne connaît pas `(app2)`. Ces casts font taire le compilateur sur les cibles de navigation — une route fausse ne serait pas détectée.

| Fichier | Occurrences |
|---|---|
| `app/(app2)/index.tsx` | 7 |
| `app/(app2)/_layout.tsx` | 2 |
| `app/(app2)/bilan/[sessionId].tsx` | 3 |
| `app/(app2)/club/index.tsx` | 4 |
| `app/(app2)/club/pass.tsx` | 1 |
| `app/(app2)/club/roulages.tsx` | 1 |
| `app/(app2)/club/territoire.tsx` | 2 |
| `app/(app2)/data/index.tsx` | 2 |
| `app/(app2)/data/saison.tsx` | 2 |
| `app/(app2)/data/session/[id].tsx` | 2 |
| `app/(app2)/rec/index.tsx` | 3 |
| `app/(app2)/rec/arrivee.tsx` | 1 |
| `app/(app2)/rec/entre-runs.tsx` | 1 |
| `app/(app2)/rec/equipement.tsx` | 1 |
| `app/(app2)/rec/fin.tsx` | 1 |
| `app/(app2)/rec/placement.tsx` | 1 |
| `app/(app2)/rec/roulage.tsx` | 3 |
| `app/(app2)/reserver/index.tsx` | 1 |
| `app/(app2)/reserver/[sessionId].tsx` | 1 |
| `app/(app2)/signature.tsx` | 1 |
| `app/(app2)/vous/index.tsx` | 3 |
| `app/(app2)/vous/carnet.tsx` | 1 |
| `app/(app2)/vous/documents.tsx` | 2 |
| `app/(app2)/vous/equipement.tsx` | 1 |
| `app/(coach)/index.tsx` | 5 |
| `app/(coach)/_layout.tsx` | 1 |
| `app/(coach)/business.tsx` | 2 |
| `app/(coach)/calendrier.tsx` | 2 |
| `app/(coach)/cycles.tsx` | 1 |
| `app/(coach)/debrief.tsx` | 1 |
| `app/(coach)/demandes.tsx` | 1 |
| `app/(coach)/en-direct.tsx` | 1 |
| `app/(coach)/en-direct/[sessionId].tsx` | 3 |
| `app/(coach)/facturation.tsx` | 2 |
| `app/(coach)/facture-nouvelle.tsx` | 1 |
| `app/(coach)/file-lecture.tsx` | 3 |
| `app/(coach)/messages.tsx` | 1 |
| `app/(coach)/messages/[coachPilotId].tsx` | 1 |
| `app/(coach)/pilote/[id].tsx` | 6 |
| `app/(coach)/reperes.tsx` | 1 |
| `app/(coach)/roulages/index.tsx` | 2 |
| `app/(coach)/roulages/nouveau.tsx` | 1 |
| `app/(coach)/studio.tsx` | 3 |
| `app/(coach)/triage.tsx` | 1 |

**Total sur les deux arbres : 86.**

### Services sans consommateur dans ces deux arbres

INCONNU — établir cette liste demande de recenser tous les services de `src/services/` et de les confronter aux imports des DEUX arbres ainsi que des services entre eux. Un service non importé par un écran peut être appelé par un autre service : le déclarer « sans consommateur » sur la seule base de ces deux arbres serait faux.

---

*Relevé produit en lecture seule. Aucun fichier du dépôt modifié hors celui-ci.*