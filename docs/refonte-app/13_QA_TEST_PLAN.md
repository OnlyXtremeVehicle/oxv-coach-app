# Plan QA & tests

> Débloque l'**alpha terrain**. Réf. nav verrouillée : `00_PLATEFORME_OXV.md §4`. Canon design (loi) : `04_DESIGN_CANON.md`. Critères « réussi si… » : `12_ACCEPTANCE_CRITERIA.md`.
> Ce plan ne décrit pas un idéal théorique : il s'ancre sur le code réel (`src/ble/*`, `src/services/offlineQueue.ts`, `src/__tests__/rls/*`, `src/services/dataExportService.ts`, `src/services/accountService.ts`, `src/services/pushNotificationsService.ts`) et sur la suite Jest existante.
> **Principe QA** : on teste d'abord ce qui peut casser la confiance du pilote (perte de session, donnée vue par le mauvais rôle, écran qui s'allume en piste). Le confort vient après.

---

## 0. Socle de tests existant (point de départ — ne pas réinventer)

| Couche | Fichiers réels | Ce qui est couvert |
|---|---|---|
| Parser télémétrie | `src/ubx/__tests__/parser.test.ts`, `src/services/__tests__/parseUbxFile.integration.test.ts` | décodage UBX RaceBox, intégration fichier |
| Algos bilan | `marginCalculator.test.ts`, `focusCorner.test.ts`, `brakingPoints.test.ts`, `regularity.test.ts`, `pilotSignature.test.ts`, `debriefGenerator.test.ts` | marge globale, virage à observer, constance, signature, débrief |
| Logique coach | `coachContextLogic.test.ts`, `coachCurationLogic.test.ts`, `coachReadingLogic.test.ts`, `coachReferenceLogic.test.ts` | file de lecture, curation, repères |
| Club / social | `ecosystemLogic.test.ts`, `roulagesLogic.test.ts`, `placesService.test.ts`, `sharesService.test.ts` | annuaire, historique, carte, partage |
| **RLS (live Supabase)** | `src/__tests__/rls/coachSessionsRLS.test.ts`, `coachAnnotationsRLS.test.ts`, `pilotFriendshipsRLS.test.ts` + `setup.ts` | accès par rôle, **skippé** sans `TEST_SUPABASE_URL` / `TEST_SUPABASE_SERVICE_KEY` |

Config : `jest.config.js` → `testMatch: ['**/__tests__/**/*.test.ts']`, seuil de couverture (`coverageThreshold`), `test:coverage` dans `package.json`.

**Règle** : `jest` doit rester **vert** à chaque PR de la roadmap (`00_PLATEFORME_OXV.md §7`). Les tests RLS exigent une **branche Supabase `ci-test`** (cf. `setup.ts` / `docs/TESTS_RLS_SETUP.md`) — ils ne tournent jamais contre la prod.

---

## 1. Tests par catégorie

### 1.1 UX & doctrine (manuel + revue)

La doctrine est testable : tout texte côté pilote est une assertion à vérifier.

| Test | Attendu | Réf |
|---|---|---|
| Lexique prescriptif | Aucune occurrence de *freinez, corrigez, vous devez, évitez, erreur, mauvais* côté pilote | `04_DESIGN_CANON §7`, `09_UX_COPY_LIBRARY` |
| Lexique autorisé | Constats en « à observer » / « à conserver » / « était-ce volontaire ? » | `01_ORGANISATION_PRODUIT` (Bilan) |
| Un seul chiffre dominant | Chaque écran a **une** valeur majeure (marge globale instrument 226–230) | `04_DESIGN_CANON §3` |
| Or = donnée only | Aucun or sur la nav, le décor, les CTA | `04_DESIGN_CANON §1, §7` |
| Rouge = coach / REC only | Rouge uniquement bande coach + voyant REC | `04_DESIGN_CANON §1` |
| Nav active/inactive | Onglet actif `#F8F9FA`, inactif `#54545C`, **jamais d'or** | `00 §4`, `04 §4` |
| Vouvoiement / pas d'emoji | Partout, status bar incluse | doctrine |
| Accessibilité | Cibles ≥ 44 px, lisible plein soleil, VoiceOver/TalkBack | `03_MVP_SCOPE §9` |

Grep de contrôle (à scripter, CI bloquante sur `app/(app)/**`) : recherche des verbes interdits hors `app/(coach)/**` et hors bande coach.

### 1.2 BLE — `src/ble/bluetoothService.ts` (`react-native-ble-plx`)

Le service expose `isAvailable()`, `connect/disconnect`, reconnexion auto (`ReconnectPhase = 'idle' | 'reconnecting' | 'lost'`, `RECONNECT_MAX_ATTEMPTS = 5`, déclenchée par `device.onDisconnected`), `forget`, et un statut qui *flappe* pendant les tentatives. Chaque message d'erreur doit répondre : **que s'est-il passé ? qu'est-ce qui est préservé ? que puis-je faire ?** (`01_ORGANISATION_PRODUIT`, Session).

| Scénario | Manip terrain | Attendu | Doctrine |
|---|---|---|---|
| **Introuvable** | RaceBox éteint / hors portée, lancer le scan | Statut `scanning` borné, message « équipement introuvable » + action « réessayer » ; pas de blocage | message 3-temps |
| **Perte en roulage** | Couper l'alim du boîtier pendant capture | `onDisconnected` → phase `reconnecting`, **capture déjà enregistrée préservée**, **aucun écran allumé** (silence en piste) | silence + préservation |
| **Reconnexion auto** | Rallumer le boîtier sous le seuil 5 tentatives | retour `connected`, capture reprise sans perte, status cesse de flapper | `RECONNECT_MAX_ATTEMPTS` |
| **Reconnexion épuisée** | Garder le boîtier coupé > 5 tentatives | phase `lost`, message calme + chemin de récupération manuel, données partielles conservées | échec gracieux |
| **Dégradé** | BT OS désactivé / permission refusée | `permissions.ts` + `initBle.ts` : message d'état, pas de crash, app navigable | robustesse |
| **Expo Go** | Lancer dans Expo Go | `loadBleManagerCtor()` renvoie `null` → `isAvailable()` false, message « Bluetooth indisponible dans ce runtime (Expo Go) », **pas de crash** | `bluetoothService L21-29, 119, 229, 277` |

**Note Expo Go (à acter)** : le module natif BLE n'existe **pas** en Expo Go. Tout test BLE réel exige un **development build** (cf. `app/_layout.tsx` qui skippe push/BLE en Expo Go). L'alpha terrain se fait obligatoirement sur build dev/preview.

### 1.3 Offline — `src/services/offlineQueue.ts` (MMKV + Supabase)

File FIFO d'écritures différées (`enqueueAction` → `flushQueue` au retour réseau via NetInfo), `MAX_ATTEMPTS = 5`, **pas de DLQ** (perte assumée après 5 échecs), idempotence exigée côté serveur (`upsert` / contraintes UNIQUE).

| Scénario | Manip | Attendu |
|---|---|---|
| **Pas de réseau (circuit)** | Mode avion, accepter le pacte / marquer notif lue / changer niveau pilote | action `enqueueAction` persistée en MMKV (`STORAGE_KEYS.OFFLINE_QUEUE`), aucune erreur bloquante UI |
| **Sync différée** | Rétablir le réseau | `flushQueue()` rejoue en ordre FIFO ; `accept_pact` écrit `pact_accepted_at` (horodaté au tap = valeur juridique), `profile_completed_at` ; `accept_cgu_privacy`, `update_pilot_level` idem |
| **Rejeu / crash** | Couper l'app pendant le flush, relancer | rejeu idempotent : aucun doublon, état serveur identique (doctrine `offlineQueue L9-15`) |
| **Conflit** | Action différée vs valeur changée online entre-temps | dernière écriture cohérente, pas de perte silencieuse de la donnée juridique (pacte/CGU) |
| **Épuisement** | Forcer 5 échecs (RLS/réseau) | action abandonnée + `console.warn`, file purgée de l'item, app stable (acceptable : actions V1 toutes optionnelles) |
| **JSON corrompu** | Corrompre la clé MMKV | `readQueue()` purge la clé et repart à vide, pas de crash (`L42-47`) |

### 1.4 Supabase RLS par rôle — `src/__tests__/rls/*`

Tests live (skippés sans env de test). À **étendre** au fil des PR ; toute nouvelle table = nouveau test RLS avant exposition.

| Test existant | Vérifie |
|---|---|
| `coachSessionsRLS.test.ts` | coach voit `telemetry_sessions` d'un pilote **uniquement si** `coach_pilots(active=true)` ET `pilot_consent_at IS NOT NULL` ; coach **ne peut pas** UPDATE (RLS bloque silencieusement) ; pilote ne voit pas les sessions d'un autre pilote |
| `coachAnnotationsRLS.test.ts` | accès aux `coach_annotations` (overlay coach) borné |
| `pilotFriendshipsRLS.test.ts` | `are_friends()` — comparaison **consentie** seulement |

Matrice à couvrir (réf. `05_ROLES_PERMISSIONS.md`, `06_RLS_POLICIES_ACTUELLES.sql`) :

| Acteur | Doit voir | Ne doit jamais voir |
|---|---|---|
| Pilote | ses sessions/frames, ses partages, ses amis consentis | sessions/frames d'autrui non consenties |
| Coach | sessions des pilotes **affiliés + consentants** | sessions hors affiliation ou sans consentement ; écriture sur la session pilote |
| Admin | opérations/qualité data selon `is_admin` | — (à border : pas de lecture sauvage des frames sans motif) |
| Ami | frames d'un ami **accepté** (`telemetry_frames_select_friend`, cf. `00_BUILD_GAMING`) | tout hors amitié, tout INSERT/UPDATE/DELETE |

> **Toute table nouvelle (Data Lab assemblé, Passeport, espace Partenaire…) nécessite une migration + ses policies + son test RLS. Aucun schéma n'est acquis : chaque migration est À SOUMETTRE à l'accord de Gabin** (`00 §6`).

### 1.5 RGPD — export / suppression / consentement

| Sujet | Service réel | Test |
|---|---|---|
| **Export (portabilité, art. 20)** | `dataExportService.ts` → `exportAndShareMyData()` | l'export collecte par section, **note les échecs** (`partial=true` + `failedSections`) au lieu de les masquer ; frames lourdes exclues (durée annoncée à l'UI). Vérifier : export honnête, partage déclenché, RLS respectée (n'exporte que les données du pilote) |
| **Suppression (effacement, art. 17)** | `accountService.ts` → `requestAccountDeletion()` | horodate `deletion_requested_at` + `deletion_scheduled_at` (J+30, `DELETION_GRACE_DAYS`) ; `.select('id')` confirme l'écriture réelle (sinon `ok:false`). Effacement RÉEL = edge function service_role à venir → **test d'intégration de l'edge function à ajouter** ; réactivable pendant la grâce |
| **Consentement coach** | `pilotConsentService.ts`, RLS `pilot_consent_at` | donner/révoquer consentement → coach gagne/perd l'accès aux sessions **immédiatement** (cf. `coachSessionsRLS`) ; écran `mon-coach` neutre, sans moralisation |
| **Consentement légal** | `offlineQueue` (`accept_pact`, `accept_cgu_privacy`) | versions + horodatage écrits, même en différé |

### 1.6 Notifications — `src/services/pushNotificationsService.ts`

Stratégie V1 : notifs **locales** (débrief J+1, veille de session), token Expo persisté pour V1.1, **handler sans son** (`shouldPlaySound:false`).

| Type | Fonction | Test |
|---|---|---|
| Débrief J+1 | `scheduleDebriefNotification` | déclenche à J+1 (min 60 s plancher), titre « Votre debrief est prêt. », `data.type='debrief'` |
| Veille de session | `scheduleSessionReminder` | déclenche `hoursBefore` (def. 18 h) avant `sessionAt` ; si déjà passé → non programmé (`delayMs<=0` → null) |
| **Silence en piste** | appelant | **aucune** notif programmée en états roulage (S5-S8) ; le service ne connaît pas l'état → l'appelant doit garantir | 
| Opt-in respecté | `isChannelEnabled` | `push_notif_enabled=false` ⇒ rien ; préférence fine par canal (`notification_preferences`, défaut-ON) |
| Annulation | `cancelAllOxvNotifications` | à la déconnexion / coupure opt-in, plus aucune notif planifiée |
| Expo Go | `app/_layout.tsx` | enregistrement push **skippé** en Expo Go, pas de crash |

**Deep-links — valides / expirés** (route via `useLastNotificationResponse`, `app/_layout.tsx`) :

| Deep-link | Valide | Expiré / invalide |
|---|---|---|
| `debrief` → `/debrief?sessionId=xxx` | ouvre le débrief de la session | session supprimée (purge RGPD) → écran d'état propre, pas de crash ni d'écran blanc |
| `session_reminder` → écran session | ouvre la prépa | session OXV passée/annulée → message calme, retour Paddock |
| Partage public `share/[token]` | page publique | token révoqué/expiré → page « lien indisponible » (réf. `sharesService`) |

### 1.7 Publication (stores)

| Test | Attendu |
|---|---|
| Build EAS dev + preview | passe (TestFlight interne), BLE/push opérationnels (build natif, pas Expo Go) |
| Permissions déclarées | Bluetooth, notifications, localisation justifiées (`app.json`) |
| Pas de secret commité | `.env` exclu, clés non hardcodées |
| Légal en place | CGU, pacte, confidentialité accessibles (`legal/[doc]`, `donnees-securite`) |
| Comptes de revue | parcours testable sans matériel RaceBox (dataset UBX de test) |
| **Pas de soumission prod sans accord Gabin** | doctrine déploiement |

---

## 2. Tests par rôle

| Rôle | Espace | Parcours critique à valider | Garde-fou |
|---|---|---|---|
| **Pilote** | `app/(app)` | Paddock contextuel → Session (silence) → Bilan → Data Lab → Progression → Club ; export/suppression données | aucun verbe prescriptif ; ne voit que ses données |
| **Coach** | `app/(coach)` (`index`, `lecture`, `annoter`, `demandes`, `disponibilites`, `priorites`, `reperes`, `comparer`) | file de lecture priorisée → lecture session **affiliée+consentie** → annotation overlay → réponse demande | n'accède qu'aux pilotes consentants ; ne modifie pas la session pilote |
| **Admin** | `app/(admin)` (`operations` prep/`en-cours`, `analytique`, `circuit`, `coachs`, `sessions-media`, `points-carte`) | préparation événement → suivi en cours → qualité data → gestion coachs | accès borné par `is_admin` ; pas de lecture sauvage |
| **Partenaire** | `app/(partner)` — **net-neuf, V1 annuaire** | (V1) visibilité annuaire ; (V1.5) offres/leads | espace inexistant aujourd'hui → tests à créer avec l'espace, RLS dédiée **à soumettre** |
| **Bascule** | `SpaceSwitcher` | changer d'espace n'expose pas de données d'un autre rôle | session/JWT cohérents |

---

## 3. Test terrain obligatoire (bout-en-bout, sans assistance)

**Condition de l'alpha** : un pilote réel, sur build dev/preview (pas Expo Go), avec un vrai RaceBox Mini, accomplit le parcours **seul, sans qu'on l'aide**. Si une étape exige une explication orale, elle a échoué.

Scénario de référence :

> **Connexion** au compte → **équipement** (jumelage BLE RaceBox) → **placement** → **rouler** (état piste, UI éteinte, REC minimal) → retour stands → **bilan** (marge globale, phrase miroir, 2 constats, bande coach si annotation) → **data** (Data Lab : carte / virages / tours) → **partage coach** (consentement → le coach voit la session).

### Grille d'observation terrain

| # | Étape | Réussi (O/N) | Hésitation (où, combien de s) | Commentaire observateur |
|---|---|:--:|---|---|
| 1 | Connexion / arrivée Paddock | | | l'action principale du moment est-elle évidente ? |
| 2 | Jumelage équipement (BLE) | | | message clair si introuvable ? |
| 3 | Placement | | | |
| 4 | Roulage — état piste | | | **aucun écran/son** vérifié ? le pilote a-t-il regardé le téléphone ? |
| 5 | Perte/reconnexion BLE (si survenue) | | | capture préservée ? message rassurant ? |
| 6 | Retour stands → bilan prêt | | | |
| 7 | Bilan (un seul chiffre, ton non jugeant) | | | a-t-il compris la marge sans aide ? |
| 8 | Data Lab (carte/tours/virages) | | | exploration intuitive ou perdu ? |
| 9 | Bande coach (si annotation) | | | perçue comme question ouverte, pas comme ordre ? |
| 10 | Partage / consentement coach | | | a-t-il compris ce qu'il partage et à qui ? |
| 11 | Offline (si réseau coupé au circuit) | | | a-t-il perdu une donnée ? sync au retour ? |

Colonnes annexes à relever : **lisibilité plein soleil**, **taille des cibles**, **batterie/chaleur device**, **moment où l'app a paru “coach” plutôt que “miroir”** (signal doctrine).

### Critère d'acceptation alpha

L'alpha est validée si : parcours bout-en-bout réussi **sans assistance**, **zéro écran allumé en piste**, **zéro fuite de données entre rôles**, **zéro verbe prescriptif côté pilote**, et toute perte BLE laisse la capture **récupérable**.

---

## 4. Référence alpha terrain

Le PoC BLE/parser est **validé sur le terrain (mai 2026)** (`bluetoothService.ts L4`). La donnée télémétrique réelle (frames) arrive avec **Valence** : de nombreux écrans Data Lab/Insight/Signature affichent aujourd'hui un `EmptyState` honnête tant que `telemetry_frames` / `segment_analyses` sont vides (cf. `00_BUILD_GAMING.md`). 

Conséquence QA : tant que Valence n'a pas fourni de frames, **deux régimes de test** cohabitent —
1. **Avant Valence** : dataset UBX de test + EmptyState vérifiés (l'app reste navigable, jamais de crash sur données absentes).
2. **Pendant/après Valence** : reprise de la grille terrain §3 avec données réelles, puis branchement des vizs Insight et de la Signature sur la session réelle (post-Valence).

L'alpha terrain doit donc être **rejouée avec données réelles** dès Valence, la première passe (dataset de test) ne valant que pour le flux et la robustesse, pas pour le contenu du bilan.
