# PROMPT CLAUDE CODE — LOT V2-L2 · PORTE REC (8 écrans, version sensorielle)
### Repo oxv-app · DA Instrument · state machine INTACTE · un lot = un commit — 18/07/2026

---

## CONTEXTE
Le jour J en v2 — le parcours qui fait la réputation. Ambition : **cinématique et rassurant** : chaque étape est un écran plein, un geste, une confirmation haptique. Prérequis : L0 sensoriel, BE-1, L1. **RÈGLE CARDINALE inchangée : `useAppStateStore`, `captureSessionService`, `captureSyncQueue`, `bluetoothService` = zéro diff.** Live Activity en sous-lot L2-B séparé.
Contraintes : celles de L1 + flux complet fonctionnel en mode avion + AUCUN chiffre en roulage + biométrie jamais rendue en roulage.

---

## ÉCRAN 1/8 — PISTE HUB · `rec/index.tsx`
`useCaptureStep()` (hook extrait, store non modifié). Hors jour J : `HeroPhoto` de la voiture du membre + Dial countdown (mêmes composants que l'accueil, importés) + entrée « Préparation » `ListRow`. Aucune inscription : état RÉSERVER. Jour J : redirection étape courante.

## ÉCRAN 2/8 — PRÉPARATION · `rec/preparation.tsx`
1. Header condensable « PRÉPARATION ».
2. **Héros journée** : `HeroPhoto` 170px du CIRCUIT (asset/tracé Skia) — scrim, superposés : Dial m countdown (ou badge « AUJOURD'HUI » accent pulsé doucement) + circuit + créneau.
3. Météo réelle : `ListRow` icône `meteo-piste`, T°, vent, fait sec (weatherService).
4. **Check-list** : `ListRow` cochables — coche = trait qui se dessine (Skia 200 ms) + haptic `tap` ; barre de progression hairline en tête (x/6) ; état MMKV v1 conservé.
5. **QR Pass** : carte compacte, tap → plein écran luminosité forcée max (patron billets Airbnb), dismiss swipe.
6. 🆕 **C1 Qui roule** : FlashList horizontale avatars 44px + @handle (inscrits opt-in — mini-migration `users.show_attendance` + service `attendancePublicService`, autorisés dans CE lot) ; mon switch opt-in en tête ; Stagger d'apparition. 🆕 filtre `Chip` « Mon groupe » si crew (A3, BE-1).
7. 🆕 **C2 Convoi** (flag `convoys`) : carte route certifiée (mini-tracé), RDV, participants, Rejoindre `PressScale`.

## ÉCRAN 3/8 — ARRIVÉE · `rec/arrivee.tsx`
Plein écran cérémoniel : fond base, **insigne OXV en trait Skia qui se dessine** (2 s, une fois), « {CIRCUIT} » display, « Vous y êtes » `text.mid`. Bouton unique pleine largeur « JE SUIS AU PADDOCK » bord accent — appui = haptic `arm` + transition door. (Transition S5→S7 manuelle v1 assumée.)

## ÉCRAN 4/8 — ÉQUIPEMENT · `rec/equipement.tsx`
1. **Scan BLE théâtralisé** (services v1 intacts) : pendant le scan — anneau radar Skia balayage lent + boîtiers trouvés apparaissant en Stagger ; carte boîtier appairé : pastille verte pulsée 1×, batterie `RollingCounter`, n° série mono. Mémoire dernier boîtier v1.
2. 🆕 **Ceinture Polar (coachés)** : carte icône `ceinture` — état « À appairer au paddock par le staff » + lien consentement. (Scan Polar = BIO-2.)
3. 🆕 **Consentement biométrie** : `Sheet` plein — icône `coeur`, texte exact `docs/juridique/consentement_biometrie.md` (créé depuis l'annexe A avocat, marqué VALIDATION REQUISE), 2 cases distinctes (capture / partage coach), Accorder/Refuser → `consentService` kind biometry. Fail-closed.
4. 🆕 **Rappel Watch phase A** (flag+consent, pas de ceinture, iOS) : `ListRow` icône `montre` « Lancez un entraînement sur votre Watch » — répété sur Placement.

## ÉCRAN 5/8 — PLACEMENT · `rec/placement.tsx`
Carte circuit sélectionné : tracé Skia `GlowStroke`, ligne d'arrivée marquée blanche pulsée 1×. Multi-circuit : sélecteur `Chip`. **« ARMER LA CAPTURE »** : bouton pleine largeur fond accent — appui long 600 ms (jauge circulaire qui se remplit autour du doigt, gesture-handler) puis haptic `arm` + départ — l'armement est un GESTE, pas un tap accidentel. Services v1 (`startCaptureSession`) inchangés.

## ÉCRAN 6/8 — ROULAGE · `rec/roulage.tsx`
Le plus sobre — c'est voulu et c'est du design : fond base pur, point REC pulsant (motion.pulse) + « REC » mono, RIEN d'autre. Le silence total EST l'expérience premium (doctrine). Bouton bas discret « Terminer le run ». Keep-awake service v1.

## ÉCRAN 7/8 — ENTRE-RUNS · `rec/entre-runs.tsx`
1. **Dial l central** — LE cadran : countdown du break (aiguille NeedleSweep continue, value mm:ss RollingCounter).
2. Meilleur tour du jour : `ChronoHero` s (`celebrate` si nouveau record du jour → RecordFlash, une fois).
3. Note rapide : champ hairline (service v1).
4. 🆕 **Biométrie à la pause** : coachés+Polar → `BiometryStrip` du run (point pulsé au bpm). Autres (flag+consent) : `ListRow` `montre` « Cœur disponible au bilan » `text.dim` — honnêteté phase A.
5. Fond : tracé du circuit en filigrane Skia 6 % — la piste respire derrière les chiffres.

## ÉCRAN 8/8 — FIN DE SÉANCE · `rec/fin.tsx` (fusion des 3 écrans v1, transitions de la machine INCHANGÉES)
États cross-fadés (door) :
- `fini` : « Pilotage terminé » display + résumé Stagger (runs, tours, km en RollingCounter) + « PRÉSERVER LA SÉANCE » bord accent. 🆕 déclencheur **BIO-1 Watch** ici (garde idempotente MMKV) : `healthKitService.readHeartRate(start,end)` → `saveSamples('apple_watch')` + `computeQuality` — échec = Sentry + silencieux, JAMAIS bloquant.
- `preservation` : Dial m jauge (progress réel upload sinon arc rotatif) + micro-textes d'étapes qui défilent (« Trames sécurisées… », « Analyse… ») — la préservation se REGARDE, elle rassure.
- `pret` : `RecordFlash` si record + `ChronoHero` l + **« OUVRIR LE BILAN »** fond accent → HeroMorph vers `/bilan/[id]`.
- `erreur` : StateView error « Vos données sont en sécurité sur l'appareil » + relance (la file garantit la reprise).
🆕 **D4 Incident** : lien hairline « Déclarer un incident » → Sheet (heure préremplie, description ≥10, photo) → `incidentService.report` ; OFFLINE : type d'action ajouté au registre `offlineQueue` (mécanisme non modifié) ; confirmation sobre + mention immuabilité.

---

## SOUS-LOT L2-B — LIVE ACTIVITY (commit séparé, natif iOS)
ActivityKit {circuit, nextRunAt?, bestLapMs?, state} : start à l'armement, update fin de run (meilleur tour SEUL — jamais biométrie), end à `pret`. Dynamic Island compacte : point REC + chrono. WidgetKit accueil : mini-signature + prochaine journée. Si >1 j de travail natif : reporter, le noter au rapport.

## PREUVES
tsc 0 · jest vert (useCaptureStep, garde idempotente BIO-1, incident offline, appui long armement) · greps 0 · **test simulateur : flux complet S5→pret en mode avion** · vidéos courtes : armement appui long, préservation, RecordFlash (rapport `v2-l2.md`) · vérif zéro diff : `git diff --stat` sur les 4 fichiers cardinaux = vide.

## HORS PÉRIMÈTRE
Scan Polar (BIO-2) · HealthKit à la pause (BIO-3) · board TV (LIVE-B) · paiement.
