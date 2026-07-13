# ÉTAT DE L'APPLICATION OXV MIRROR — AUDIT

> Audit en lecture seule. Baseline : commit `c83925b` (2026-07-13 11:35 +0200,
> branche `feat/site-document-emails`), arbre de travail propre au lancement.
> Caveat : une vague de reskin (8 écrans pilote : trace, passeport, empreinte-saison,
> replay, virage-comparer, insights, comparateur, entre-runs) s'exécutait en
> parallèle de l'audit et a pu modifier ces fichiers pendant les lectures —
> toute affirmation les concernant est à re-vérifier après son commit.
> Règle de preuve : chaque affirmation s'appuie sur un chemin exact ou une
> commande vérifiée ; INCONNU sinon.

---

## 1. Stack et dépôt

| Composant | Version exacte | Source |
|---|---|---|
| Expo SDK | `~51.0.28` | `package.json` |
| React Native | `0.74.5` | `package.json` |
| expo-router | `~3.5.23` | `package.json` |
| @supabase/supabase-js | `^2.45.4` | `package.json` |
| BLE | `react-native-ble-plx ^3.2.0` | `package.json` |
| Stripe (SDK app) | ABSENT (`stripe` et `@stripe/stripe-react-native` absents) | `package.json` |
| Stockage local | `react-native-mmkv ^2.12.2` (file offline), `expo-file-system ~17.0.1` (.ubx), `expo-secure-store ~13.0.2` (session auth) | `package.json` |
| Absents | WatermelonDB, expo-sqlite, AsyncStorage | `package.json` |
| Réseau | `@react-native-community/netinfo 11.3.1` | `package.json` |

État git : branche `feat/site-document-emails` · dernier commit `c83925b`
« feat(vague2)… » (2026-07-13 11:35:06 +0200) · `git status --short` = 0 fichier
non commité au lancement de l'audit (des modifications de la vague de reskin en
cours sont attendues dans l'arbre après l'audit).

---

### SECTION 2 — ARBORESCENCE DES ROUTES

Commande : `find app -name "*.tsx" | sort` → **178 fichiers .tsx**. Aucun fichier `.ts` (non-tsx) sous `app/`. Répartition (`sed 's|^app/||' | awk -F/ ...| uniq -c`) :

| Groupe | Fichiers .tsx | Dont `_layout` | Routes effectives |
|---|---|---|---|
| `(app)` (pilote) | 78 | 3 (`_layout`, `cote-a-cote/_layout`, `session-media/_layout`) | 75 |
| `(coach)` | 37 | 1 | 36 |
| `(admin)` | 30 | 1 | 29 |
| `(pro)` | 8 | 1 | 7 |
| `(partner)` | 8 | 1 | 7 |
| `(onboarding)` | 7 | 1 | 6 |
| `(coach-onboarding)` | 4 | 1 | 3 |
| `(auth)` | 3 | 1 | 2 |
| racine | 3 | 1 (`_layout`) | 2 (`index`, `+not-found`) |
| **Total** | **178** | **11** | **167** |

#### Sortie complète par groupe (préfixe `app/` retiré)

**(app) — 78**
```
(app)/_layout.tsx
(app)/amis.tsx
(app)/belle-route.tsx
(app)/bilan-pret.tsx
(app)/bilan.tsx
(app)/carnet.tsx
(app)/carte-licence.tsx
(app)/carte-oxv.tsx
(app)/carte-trophee.tsx
(app)/carte.tsx
(app)/circuit/[id].tsx
(app)/circuits.tsx
(app)/club/index.tsx
(app)/coach/[id].tsx
(app)/coachs.tsx
(app)/comparateur.tsx
(app)/compte/index.tsx
(app)/conditions.tsx
(app)/consentements.tsx
(app)/cote-a-cote/[friendId].tsx
(app)/cote-a-cote/_layout.tsx
(app)/creer-trace.tsx
(app)/data-lab-canvas.tsx
(app)/data-lab.tsx
(app)/debrief-presentiel.tsx
(app)/debrief.tsx
(app)/debug-capture.tsx
(app)/debug-circuit.tsx
(app)/decharge.tsx
(app)/donnees-securite.tsx
(app)/empreinte-saison.tsx
(app)/entre-runs.tsx
(app)/equipement.tsx
(app)/galerie.tsx
(app)/garage.tsx
(app)/garage/[vehicleId].tsx
(app)/heatmap.tsx
(app)/index.tsx
(app)/insight/[reading].tsx
(app)/insights.tsx
(app)/legal/[doc].tsx
(app)/mes-demandes.tsx
(app)/mes-routes.tsx
(app)/mon-coach.tsx
(app)/mon-equipement.tsx
(app)/notifications.tsx
(app)/objectifs.tsx
(app)/paddock.tsx
(app)/partage.tsx
(app)/partenaires.tsx
(app)/pass-oxv.tsx
(app)/passeport.tsx
(app)/pilotage-fini.tsx
(app)/placement.tsx
(app)/preparation.tsx
(app)/preservation.tsx
(app)/prochaine-fois.tsx
(app)/profil.tsx
(app)/programme.tsx
(app)/progression.tsx
(app)/regularite.tsx
(app)/replay.tsx
(app)/roulage.tsx
(app)/roulages.tsx
(app)/session-media/[sessionId].tsx
(app)/session-media/_layout.tsx
(app)/session/index.tsx
(app)/settings.tsx
(app)/share/[token].tsx
(app)/signature.tsx
(app)/stats.tsx
(app)/support/[id].tsx
(app)/support/index.tsx
(app)/telemetry.tsx
(app)/tours.tsx
(app)/trace.tsx
(app)/virage-comparer.tsx
(app)/virage.tsx
```

**(coach) — 37**
```
(coach)/_layout.tsx
(coach)/annoter.tsx
(coach)/ar.tsx
(coach)/assistant.tsx
(coach)/business.tsx
(coach)/calendrier.tsx
(coach)/comparer-pilotes.tsx
(coach)/comparer.tsx
(coach)/contexte.tsx
(coach)/cycles.tsx
(coach)/cycles/[id].tsx
(coach)/debrief.tsx
(coach)/demandes.tsx
(coach)/disponibilites.tsx
(coach)/en-direct.tsx
(coach)/en-direct/[sessionId].tsx
(coach)/facturation-identite.tsx
(coach)/facturation.tsx
(coach)/facture-nouvelle.tsx
(coach)/file-lecture.tsx
(coach)/gabarits.tsx
(coach)/index.tsx
(coach)/lecture.tsx
(coach)/messages.tsx
(coach)/messages/[coachPilotId].tsx
(coach)/pilote/[id].tsx
(coach)/plan.tsx
(coach)/priorites.tsx
(coach)/profil.tsx
(coach)/rapport.tsx
(coach)/repere/[index].tsx
(coach)/reperes.tsx
(coach)/roulages/[id].tsx
(coach)/roulages/index.tsx
(coach)/roulages/nouveau.tsx
(coach)/studio.tsx
(coach)/triage.tsx
```

**(admin) — 30**
```
(admin)/_layout.tsx
(admin)/ambassadeurs.tsx
(admin)/analyse-session/[id].tsx
(admin)/analytique.tsx
(admin)/b2b-rapport.tsx
(admin)/circuit.tsx
(admin)/coachs.tsx
(admin)/coachs/[id].tsx
(admin)/devices.tsx
(admin)/en-cours.tsx
(admin)/evenements.tsx
(admin)/evenements/[id].tsx
(admin)/evenements/nouveau.tsx
(admin)/feature-flags.tsx
(admin)/index.tsx
(admin)/maintenance.tsx
(admin)/moderation.tsx
(admin)/partenaires.tsx
(admin)/points-carte.tsx
(admin)/preparation.tsx
(admin)/presences.tsx
(admin)/qualite-data.tsx
(admin)/routes-certification.tsx
(admin)/scan-checkin.tsx
(admin)/sessions-media.tsx
(admin)/support.tsx
(admin)/support/[id].tsx
(admin)/tour-controle.tsx
(admin)/utilisateurs.tsx
(admin)/utilisateurs/[id].tsx
```

**(pro) — 8**
```
(pro)/_layout.tsx
(pro)/ambassadeur.tsx
(pro)/bibliotheque.tsx
(pro)/equipe.tsx
(pro)/index.tsx
(pro)/media.tsx
(pro)/partage.tsx
(pro)/performance.tsx
```

**(partner) — 8**
```
(partner)/_layout.tsx
(partner)/facturation.tsx
(partner)/index.tsx
(partner)/leads.tsx
(partner)/offres.tsx
(partner)/performance.tsx
(partner)/profil.tsx
(partner)/rapports.tsx
```

**(onboarding) — 7**
```
(onboarding)/_layout.tsx
(onboarding)/cgu.tsx
(onboarding)/doctrine.tsx
(onboarding)/index.tsx
(onboarding)/methode.tsx
(onboarding)/niveau.tsx
(onboarding)/pacte.tsx
```

**(coach-onboarding) — 4**
```
(coach-onboarding)/_layout.tsx
(coach-onboarding)/index.tsx
(coach-onboarding)/mission.tsx
(coach-onboarding)/pacte.tsx
```

**(auth) — 3**
```
(auth)/_layout.tsx
(auth)/lier.tsx
(auth)/login.tsx
```

**racine — 3**
```
+not-found.tsx
_layout.tsx
index.tsx
```

#### Navigation hors Expo Router

`grep -rn "createStackNavigator|createBottomTabNavigator|NavigationContainer|@react-navigation"` sur `app/`, `src/` et l'ensemble du repo (`**/*.{ts,tsx}`) : **aucun hit**. Zéro import direct de react-navigation dans le code source. Seule trace : `package.json:39` — `"@react-navigation/native": "^6.1.18"` (peer dependency d'expo-router, jamais importée). Toute la navigation passe par expo-router (`router.push/replace/navigate`, `Redirect`, `Link`), avec 3 tab bars maison pilotées par des tables de routes : `src/lib/appMap.ts:27` (`TAB_MAIN_ROUTE`, consommée par `src/components/AppTabBar.tsx:67`), `src/lib/coachNav.ts:29` (`COACH_TAB_MAIN_ROUTE` → `src/components/CoachTabBar.tsx:51`), `src/lib/proNav.ts:30` (`PRO_TAB_MAIN_ROUTE` → `src/components/ProTabBar.tsx:51`).

#### Écrans orphelins (aucun `router.push`/`Link`/`pathname`/`href`/table de nav ne pointe dessus)

Méthode : extraction exhaustive de tous les littéraux `'/(<groupe>)/...'` (grep sur `app/` + `src/`), plus les valeurs `href:` d'objets, `href=` JSX, tables `screen:` (Data Lab navigue dynamiquement via `app/(app)/data-lab.tsx:252` : ``router.push(`/(app)/${screen}...`)`` — couvre `carte`, `virage`, `tours`, `heatmap`, `replay`, `telemetry`, `virage-comparer`, `insights`), `TAB_MAIN_ROUTE`/`COACH_`/`PRO_`, et les `step.href` du flux séance (`app/(app)/session/index.tsx:75` → `preparation`, `equipement`, `placement`, `roulage`, `pilotage-fini`). Groupes `(coach)`, `(admin)`, `(pro)`, `(partner)`, `(auth)`, `(onboarding)`, `(coach-onboarding)` : **100 % des routes référencées**, zéro orpheline. Toutes les orphelines sont dans `(app)` :

| Route orpheline | Preuve (seules références trouvées) |
|---|---|
| `(app)/paddock.tsx` | Aucune nav. En-tête : « navigable manuellement depuis le debug-capture ou un deep link » — FAUX aujourd'hui : `debug-capture.tsx` ne contient que `router.back()` (lignes 181, 335). Le Paddock réel est `(app)/index.tsx` (refonte-v2 §7.1) |
| `(app)/entre-runs.tsx` | `appMap.ts:61` (zone) + `appMap.ts:159` (set `CAPTURE_FLOW`, visibilité tab bar seulement). Absent des steps de `session/index.tsx` |
| `(app)/prochaine-fois.tsx` | `appMap.ts:84` (zone) uniquement |
| `(app)/debrief-presentiel.tsx` | `appMap.ts:48` (zone) uniquement |
| `(app)/club/index.tsx` | `appMap.ts:89` (zone) uniquement — l'onglet Découverte pointe vers `/(app)/coachs` (`appMap.ts:31`) |
| `(app)/mes-routes.tsx` | `appMap.ts:99` (zone) uniquement |
| `(app)/creer-trace.tsx` | `appMap.ts:100` (zone) uniquement |
| `(app)/donnees-securite.tsx` | `appMap.ts:115` (zone) uniquement. Écran RGPD réaffecté le 2026-07-13 (en-tête du fichier) mais `compte/index.tsx` n'y lie pas |
| `(app)/conditions.tsx` | Zéro référence (PR-62, « zone Bilan » selon en-tête ; ni `bilan.tsx` ni `carnet.tsx` n'y lient) |
| `(app)/decharge.tsx` | Zéro nav (seuls hits : slug légal `src/legal/legalDocuments.ts:36`, `src/services/waiverService.ts:22`). Gaté flag `pilot_waivers` OFF selon en-tête |
| `(app)/debug-circuit.tsx` | Seul hit : liste de test `src/lib/__tests__/appMap.test.ts:34` |

Cas à part, pas un bug : `(app)/share/[token].tsx` — cible de deep link externe par design (`src/services/sharesService.ts:7` : « oxvehicle.fr/share/{token} »), scheme `"oxv"` déclaré (`app.json:8`) ; aucune nav interne, ce qui est attendu.

Bilan : **11 routes orphelines sur 75 effectives dans `(app)` (14,7 %)**, 0 dans les 7 autres groupes. Le commentaire `appMap.ts:37` (« Toute route a une entrée ici (pas d'orpheline) ») décrit la couverture de la table zone→route, pas l'atteignabilité réelle : une entrée `ROUTE_TO_ZONE` ne rend pas l'écran navigable.

---

### SECTION 3 — CORRESPONDANCE SCHÉMA ↔ CODE

Racine auditée : `C:\Users\Julie\OneDrive\Desktop\oxv-app` (branche `feat/site-document-emails`). Chemins relatifs à cette racine. Inventaire réel : **167 écrans** hors `_layout` (`find app -name "*.tsx"`) : 75 `(app)` pilote, 36 `(coach)`, 29 `(admin)`, 7 `(partner)`, 7 `(pro)`, 2 `(auth)`, 6 `(onboarding)`, 3 `(coach-onboarding)`. Le référentiel en prévoit 66. Chaque statut ci-dessous a été établi en ouvrant le fichier (imports service, requêtes, états loading/erreur/vide, navigation).

#### 3.1 Public / Auth (8 écrans prévus)

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| splash | `app/index.tsx` | FONCTIONNEL | Gate auth+rôle : spinner, état erreur avec « Réessayer » (l.32-68), redirect par rôle (l.79-103). |
| onboarding | `app/(onboarding)/index.tsx` + `doctrine/methode/niveau/pacte.tsx` | FONCTIONNEL | Flux 6 étapes persisté : `setPilotLevel`, `acceptPact` + `completeOnboarding` (`pacte.tsx` l.30). Redirigé si profil incomplet (`app/index.tsx:79-87`). |
| login | `app/(auth)/login.tsx` | FONCTIONNEL | `signIn` via `useAuthStore` → Supabase, loading + erreur affichée sur le champ (l.24-27, 66). |
| register | — | ABSENT | Aucun `signUp` dans le code (grep `signUp` : 0 hit). Le compte naît sur oxvehicle.fr ; `app/(auth)/lier.tsx` lie un compte site par code (`verifyOtp` type magiclink, `src/services/pairingService.ts:61`). |
| magic-sent | — | ABSENT | Aucun envoi de magic link ; `verifyOtp` sert uniquement au code de liaison. |
| forgot | — | ABSENT | `app/(app)/donnees-securite.tsx:11-14` documente : « aucun flux de changement/réinitialisation de mot de passe n'existe dans l'app » (lignes masquées volontairement). |
| consent (CGU + télémétrie) | `app/(onboarding)/cgu.tsx` + `app/(app)/consentements.tsx` | FONCTIONNEL | CGU : 3 cases obligatoires + IA, horodatées (`acceptCguAndPrivacy`, l.14). Centre de consentement : `consentService`, opt-out analytics, export, suppression (l.17-20). |
| select-space | `app/index.tsx` + `src/components/SpaceSwitcher.tsx` | PARTIEL | Pas d'écran de choix : routage automatique par `profile.role` (`app/index.tsx:93-103`). `SpaceSwitcher` = bloc inline réservé `is_admin === true` (l.32). Un compte mono-rôle ne choisit jamais. |

#### 3.2 Pilote — 5 onglets (41 écrans prévus)

**Hub (4)**

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| hub | `app/(app)/index.tsx` (Paddock) | FONCTIONNEL | 614 l., 7 services réels (QDI, régularité, laps, boîtier, prochaine journée), 3 modes d'état. |
| notifications | `app/(app)/notifications.tsx` | SQUELETTE | 164 l., 0 import service ; 3 tabs avec états vides codés en dur (« wiring push réel arrive en sem 11 », l.10-11). Le compteur `unreadNotificationsCount` (useUIStore) n'a **aucun appelant** de son setter (grep `setUnreadNotificationsCount` : défini, jamais appelé). Le push OS existe (`pushNotificationsService` + deep-links `app/_layout.tsx:81-139`), mais pas d'inbox in-app. |
| annonces | — | ABSENT | Aucun fil d'annonces (grep « annonce » : 0 écran). `app/(app)/club/index.tsx` = hub de liens statiques. |
| annonce détail | — | ABSENT | Idem. |

**Sessions (9)** — la boucle commerciale (réservation payante) vit sur le site web ; l'app **lit** `registrations`/`sessions` (`src/services/nextTrackDayService.ts:1-6`).

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| calendrier | `app/(app)/pass-oxv.tsx` | PARTIEL | Liste des événements ouverts (`listOpenEvents`, `eventsService.ts:357`) + inscription 1-tap gratuite (`registerForEvent`, l.372). Pas de vue calendrier, pas d'offres tarifées. |
| détail session | — (carte inline dans `pass-oxv.tsx`) | PARTIEL | Lieu/horaires/briefing/statut inline ; pas d'écran détail événement côté pilote (existe côté admin : `app/(admin)/evenements/[id].tsx`). |
| offre | — | ABSENT | `registrations.offer_type` est lu (palier, `passeport.tsx`) mais le choix d'offre = site web. |
| récap | `app/(app)/preparation.tsx` | FONCTIONNEL | Jour J : `listMyRegistrations` + `getMyNextTrackDay` + météo réelle + QR du pass (684 l., 5 services). |
| paiement | — | ABSENT | Zéro paiement in-app (grep stripe/paiement : uniquement facturation coach). `coach/[id].tsx:7` : « AUCUN paiement ». |
| confirmation | — | ABSENT | Inscription directe sans écran de confirmation (rechargement de liste). |
| mes réservations | `app/(app)/pass-oxv.tsx` | FONCTIONNEL | Bloc « Mes inscriptions » : `listMyRegistrations` (`eventsService.ts:336`), statuts, QR `oxv:checkin:<registrationId>`. |
| détail réservation | — (carte inline dans `pass-oxv.tsx`) | PARTIEL | Carte avec QR et statut ; pas d'écran dédié. |
| annulation | — | ABSENT | `pass-oxv.tsx:159` : « Pour annuler une inscription, écrivez-nous depuis le support. » |

**Données (12)**

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| liste sessions | — | PARTIEL | Pas d'écran liste dédié ; accès via `comparateur.tsx` (`listRecentAnalyses`, 10 dernières) et `bilan.tsx` (dernière séance par défaut). |
| synthèse 4 piliers | `app/(app)/bilan.tsx` | FONCTIONNEL | 1172 l., 19 imports services, bloc « Quatre piliers » QDI, lecture coach pondérée, export PDF (`bilanPdfExportService`). |
| signature | `app/(app)/signature.tsx` | FONCTIONNEL | Radar QDI 5 branches + empreinte self-only + snapshots partagés coach (554 l., 7 services). |
| régularité | `app/(app)/regularite.tsx` | FONCTIONNEL | `computeRegularity` sur `fetchSessionLaps`, RLS owner, états vides. |
| évolution | `app/(app)/progression.tsx` | FONCTIONNEL | Meilleur tour + constance sur toutes les séances (`fetchAllSessions`). |
| heatmap | `app/(app)/heatmap.tsx` | FONCTIONNEL | `telemetry_frames` de la session, `EmptyState` si frames absentes (l.15-16). |
| relais | — | PARTIEL | Divergence de modèle : pas de hiérarchie journée→relais ; 1 `telemetry_session` = 1 run. `entre-runs.tsx` (144 l.) lit uniquement le store live (`useSessionStore`), pas la base. |
| détail relais | `app/(app)/bilan.tsx` | FONCTIONNEL | Par équivalence : le bilan EST la lecture d'un run. |
| détail tour | `app/(app)/tours.tsx` | FONCTIONNEL | Tour-par-tour avec deltas, mode détaillé (vmax, G) ; complété par `telemetry.tsx` (884 l.) et `virage.tsx` (1140 l., trajectoire réelle + annotations coach). |
| comparaison soi-vs-soi | `app/(app)/comparateur.tsx` | FONCTIONNEL | Sélection de 2 analyses, deltas marge/chronos (`listRecentAnalyses`). Aussi `cote-a-cote/[friendId].tsx` (comparaison consentie entre amis, hors référentiel). |
| export | `donnees-securite.tsx` / `consentements.tsx` / `data-lab.tsx` | PARTIEL | Fonction réelle (`exportAndShareMyData`, `exportSessionFramesCsv`) mais pas d'écran export dédié — action portée par 3 écrans. |
| historique | `app/(app)/stats.tsx` | FONCTIONNEL | Agrégats (km, sessions, tours) + records par circuit (`telemetry_sessions`). |

**Coaching (7)**

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| annuaire | `app/(app)/coachs.tsx` | FONCTIONNEL | Racine Découverte : coachs publiés (`listPublishedCoaches`, RLS `is_published`) + partenaires + roulages (704 l.). |
| profil coach | `app/(app)/coach/[id].tsx` | FONCTIONNEL | Fiche `coach_profiles` + créneaux + avis (`listCoachReviews`) + demande (655 l.). |
| demande relecture | — | ABSENT | Flux inversé : le coach lit les séances des pilotes **consentis** via sa file (`(coach)/file-lecture.tsx`, table `coach_queue`) ; le pilote ne demande jamais une relecture. |
| demande accompagnement | `app/(app)/coach/[id].tsx` | FONCTIONNEL | `requestBooking` → `coaching_bookings` (formulaire créneau + message, intégré à la fiche). |
| mes demandes | `app/(app)/mes-demandes.tsx` | FONCTIONNEL | `coaching_bookings` RLS pilote, annulation des `pending` (505 l.). |
| relecture reçue | `bilan.tsx` + `virage.tsx` | PARTIEL | Pas d'écran dédié : « lecture de votre coach » (`coach_reading_weights`, `bilan.tsx:43-44, 573`) + annotations virage (deep-link notif `coach_annotation`, `app/_layout.tsx:107-115`). |
| évaluation | `app/(app)/mes-demandes.tsx` | FONCTIONNEL | Avis 1-5 + texte, UPSERT `coach_reviews` (un avis par coach), intégré à l'écran demandes (l.10-13 du header). |

**Profil (9)**

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| compte | `app/(app)/compte/index.tsx` | FONCTIONNEL | 5e onglet ; profil réel, boîtier affecté (`deviceHealthService`), véhicules (537 l.). |
| abonnement | — | ABSENT | Aucune gestion d'abonnement pilote ; le palier est lu de `registrations.offer_type` (`passeport.tsx:14-16`), géré hors app. |
| véhicules | `app/(app)/garage.tsx` + `garage/[vehicleId].tsx` | FONCTIONNEL | `garageService` (listMyVehicles/addVehicle) + journal de réglages. |
| appairage RaceBox | `app/(app)/equipement.tsx` + `mon-equipement.tsx` | FONCTIONNEL | Scan/connexion BLE réels (`bluetoothService`, permissions, SecureStore) + vue état/batterie/historique (`deviceHealthService`). |
| documents KYC | `app/(app)/decharge.tsx` | PARTIEL | E-sign décharge branchée (`waiverService`, empreinte du texte) mais **gatée flag `pilot_waivers` OFF** → « Bientôt » (l.7-9). `kyc_status` n'est visible que côté admin (`(admin)/preparation.tsx:53`) ; aucun upload de document pilote. |
| statut | `app/(app)/passeport.tsx` | FONCTIONNEL | Palier réel + stats cumulées + records par circuit (`passportService`, `qdiService.getQdiAccessLevel`). |
| notifications (préfs) | `app/(app)/settings.tsx` | FONCTIONNEL | `push_notif_enabled` + `notification_preferences` JSONB (l.24, 66) + consentements IA. |
| RGPD | `app/(app)/donnees-securite.tsx` + `consentements.tsx` | FONCTIONNEL | Export (`dataExportService`), suppression J+30 (`accountService`), centre de consentement. |
| aide | `app/(app)/support/index.tsx` + `support/[id].tsx` | FONCTIONNEL | Tickets catégorisés + fil de suivi (`supportService`), création in-app. |

#### 3.3 Coach (10 écrans prévus)

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| hub | `app/(coach)/index.tsx` | FONCTIONNEL | Pilotes suivis via `coach_pilots_view` (actifs ET consentis) ; layout adaptatif rail/tabs (`_layout.tsx`), guard `role !== 'coach'` → redirect. |
| vitrine | `app/(coach)/profil.tsx` | FONCTIONNEL | Édition `coach_profiles` RLS owner + publication + tarif (459 l.). |
| demandes | `app/(coach)/demandes.tsx` | FONCTIONNEL | `coaching_bookings` côté coach, accepter/décliner les `pending`. |
| détail demande | — (inline dans `demandes.tsx`) | PARTIEL | Message + actions dans la carte de liste ; pas de route détail. |
| pilotes suivis | `app/(coach)/index.tsx` | FONCTIONNEL | Même écran que le hub (fusion). |
| dossier pilote | `app/(coach)/pilote/[id].tsx` | FONCTIONNEL | Sessions analysées, notes partagées, snapshots signature, nav vers bilan RLS coach (677 l., 5 services). |
| analyse QDI | `app/(coach)/studio.tsx` | FONCTIONNEL | `getStudioSession` : radar QDI 5 branches, triage, moments-clés (+ `triage.tsx`, `lecture.tsx` pondérations). |
| éditeur relecture | `app/(coach)/annoter.tsx` | FONCTIONNEL | CRUD notes par virage, visibilité private/shared (480 l.) ; complété par `gabarits.tsx` et `rapport.tsx`. |
| abonnement | — | ABSENT | Aucun abonnement plateforme. `facturation.tsx` = factures du coach à SES clients, gatée flag `coach_billing` INACTIF (l.10-11) ; `business.tsx` = dashboard gaté permission. |
| agenda | `app/(coach)/calendrier.tsx` | FONCTIONNEL | Séances confirmées + créneaux ouverts groupés par jour (`coachMarketplaceService`) + `disponibilites.tsx` (édition créneaux). |

#### 3.4 Staff / Ops (7 écrans prévus) — portés par l'espace `(admin)` (29 écrans), pas un espace « staff » dédié

| Écran prévu | Fichier trouvé | État | Note |
|---|---|---|---|
| hub session | `app/(admin)/tour-controle.tsx` | FONCTIONNEL | Photo opérationnelle du jour : événements, attendus/pointés, sessions à surveiller (`adminControlTowerService`) + accès rapides. |
| check-in | `app/(admin)/scan-checkin.tsx` + `presences.tsx` | FONCTIONNEL | Scan QR caméra (`expo-camera`) → `setRegistrationStatus('checked_in')` ; pointage manuel `registrations.attended_at` (`attendanceService`, tables du site). Caméra non testée sur device (l.6 du header). |
| appairage boîtiers | `app/(admin)/devices.tsx` | FONCTIONNEL | Parc RaceBox : ajout, santé, affectations (`adminDevicesService`). |
| flotte | `app/(admin)/devices.tsx` | FONCTIONNEL | Même écran (parc + santé fusionnés). |
| suivi relais | `app/(admin)/en-cours.tsx` | PARTIEL | Requête réelle `telemetry_sessions.status='recording'` avec états loading/erreur/vide (l.44-88), mais snapshot au montage — le Realtime est explicitement « à câbler » (l.5-7). Le live existe côté coach : `(coach)/en-direct/[sessionId].tsx` (`liveSessionService`). |
| incidents | — | ABSENT | Aucun registre d'incidents piste (grep « incident » : 1 hit debug Flic). `moderation.tsx` ne couvre que les signalements de contenu communautaire. |
| restitution Pavillon | `app/(app)/debrief-presentiel.tsx` | FONCTIONNEL | Débrief présentiel branché `session_insights` + `debrief_text` + modules RaceBox, états d'attente honnêtes — mais il vit côté **pilote**, pas dans un espace staff. |

#### 3.5 Décompte et divergences

**41/66 fonctionnels, 11 partiels, 1 squelette, 13 absents.**

- **Nav réelle ≠ référentiel** : côté pilote, 5 zones Miroir · Data Lab · Carnet · Découverte · Compte (`src/lib/appMap.ts:9-17`, `TAB_ORDER` l.24), pas Hub/Sessions/Données/Coaching/Profil. 167 écrans réels pour 66 prévus — le repo est un sur-ensemble avec un découpage différent.
- **3 espaces in-app non prévus** : `(admin)` 29 écrans, `(partner)` 7, `(pro)` 7, routés par rôle depuis `app/index.tsx:84-101` — le référentiel ne prévoit ni partner ni pro, et suppose le staff hors app.
- **Auth et commerce délégués au site** : pas de register/forgot/magic (0 hit `signUp`/`resetPasswordForEmail`) — le compte se lie par code (`(auth)/lier.tsx`) ; toute la boucle offre → paiement → confirmation → annulation est absente par design (zéro paiement in-app), d'où 7 des 13 ABSENT.
- **QDI côté pilote** : le référentiel réserve l'« analyse QDI » au coach ; le repo l'expose au pilote en self-only (`signature.tsx`, `QdiBars` sur le Paddock `app/(app)/index.tsx:29`, `empreinte-saison.tsx`) en plus du studio coach.
- **Modèle données inversé sur deux points** : 1 `telemetry_session` = 1 run (pas de hiérarchie journée→relais→tour), et la relecture est tirée par le coach (file `coach_queue`) au lieu d'être demandée par le pilote.

---

### SECTION 4 — Chaîne de capture (critique, jalon Valencia)

#### (a) BLE : UUIDs, protocole, fréquence

Constantes exactes — `src/types/telemetry.ts:13-24` :

| Constante | Valeur |
|---|---|
| `UART_SERVICE_UUID` | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` (Nordic UART) |
| `RX_CHARACTERISTIC_UUID` | `6E400002-…` — **déclaré mais jamais utilisé** (aucun `writeCharacteristic` dans `src/`, grep vérifié) |
| `TX_CHARACTERISTIC_UUID` | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` (notifications, abonnement à `bluetoothService.ts:329-331`) |
| Trame | UBX `0xB5 0x62`, classe `0xFF` id `0x01`, payload 80 o, total 88 o, checksum Fletcher-8 vérifié (`src/ubx/parser.ts:15-50`) |

- Scan filtré sur le service UART + préfixe nom `RaceBox` (`bluetoothService.ts:240-252`). Connexion timeout 10 s (`:284-286`). Reconnexion auto : 5 tentatives, backoff fixe 2 s (`:72-73`), phase `idle/reconnecting/lost` (`:51`).
- Resynchronisation de flux : `UbxFrameBuffer.push()` cherche le header, rejette les trames > 512 o (`parser.ts:106-153`). Testé (`src/ubx/__tests__/parser.test.ts` existe).
- **25 Hz : jamais configuré par le code.** L'app n'écrit aucune commande de cadence au boîtier (RX inutilisé) ; 25 Hz est le défaut usine du RaceBox Mini S, affirmé uniquement par les docs (`docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md:170`, `02_PARTIE_2_algorithmes.md:42`). Le code **mesure** le débit réel (`getCurrentRate()`, `bluetoothService.ts:532-544`) et la checklist terrain exige ≥ 20 Hz (`docs/alpha/CHECKLIST_J0.md:40`). Confirmation 25 Hz en conditions réelles : manuelle, pas programmatique.

#### (b) Écriture des trames, buffer, mémoire

- **Mapping** : `raceBoxToFrameInsert()` (`src/services/captureFrameMapping.ts:41-69`) produit 19 colonnes de `telemetry_frames` : `session_id, elapsed_ms, latitude, longitude, altitude_m, speed_kmh, speed_ms, heading, gps_fix, fix_valid, gps_accuracy_m, satellites, g_force_x/y/z, rotation_x/y/z, battery_level, itow_ms`. Colonnes conformes au schéma prod (`src/types/database.types.ts:6702-6756` ; `pdop`, `heading_accuracy`, `speed_accuracy` existent en base mais ne sont pas remplies).
- **Flush** : buffer en RAM, vidé à **50 trames** (= 2 s à 25 Hz) OU toutes les **4 s** (`captureSessionService.ts:55-56, 223-225`). `flush()` non réentrant, draine tout y compris les trames arrivées pendant l'écriture (`:300-321`) ; `drain()` au stop attend le flush en vol puis vide (`:324-333`).
- **`elapsed_ms`** : horloge murale rendue monotone par `Math.max` (`:219-220`) ; `itow_ms` stocké en secours.
- **Tenue mémoire 20 min à 25 Hz (30 000 trames)** : buffer DB borné (~50-100 objets ≈ dizaines de Ko). En revanche la capture `.ubx` locale garde **tous** les bytes bruts en RAM jusqu'à l'arrêt (`src/ble/captureMode.ts:59-62`) : 30 000 × 88 o ≈ **2,6 Mo** bruts + overhead par chunk BLE (~1-2 Mo) ≈ **4-5 Mo**, avec pic transitoire ~×3 à l'arrêt (merge + base64, `captureMode.ts:77-97`). Ordre de grandeur sans risque pour 20 min ; croissance linéaire (90 min ≈ 15-20 Mo, encore tenable).
- **Réseau** : ~600 requêtes `insert` de 50 lignes sur 20 min. Purge serveur à 12 mois planifiée (`supabase/migrations/20260614120500_app_telemetry_frames_retention.sql:27-41`).

#### (c) Hors-ligne, sync, idempotence, garde écran

| Phase | Sans réseau | Preuve |
|---|---|---|
| Démarrage | **Capture impossible** : l'insert `telemetry_sessions` échoue → `{ok:false}` → erreur à l'écran, pas de mode local | `captureSessionService.ts:139-154`, `app/(app)/placement.tsx:82-88` |
| Pendant | Chaque lot en échec est **définitivement perdu côté DB** (compté `dropped`, pas de requeue) ; le `.ubx` local reste le seul filet | `captureSessionService.ts:305-315` |
| Arrêt | `laps` perdus (insert best-effort, warn), session reste `status='recording'` (update échoue en warn), upload `.ubx` perdu (catch, **aucun retry ultérieur**) | `:353-354`, `:408-425`, `:432-437` |

- La file offline MMKV existe mais ne couvre **que 6 actions** (pacte, CGU, notif, niveau…) — **rien de la capture** (`src/services/offlineQueue.ts:21-27` ; flush au retour réseau via `src/lib/netinfo.ts:33-36`).
- Atténuation réelle : le bilan pilote peut se calculer depuis le `.ubx` **local** en source 1 (`src/services/analyzeSessionService.ts:23-24, 90`) — mais aucun chemin de réimport `.ubx` → `telemetry_frames` n'existe (coach/insights serveur aveugles sur les lots perdus).
- **Idempotence** : `insert` simple, pas d'upsert ; `telemetry_frames` n'a **aucune contrainte UNIQUE** sur `(session_id, elapsed_ms)` (PK `BIGSERIAL` + index non unique, `supabase/_archive_pre_timestamp/0003_telemetry_sessions.sql:67-98`). Doublons possibles si un insert timeout côté client a commité côté serveur (alors aussi compté `dropped` → `total_frames` faux). Seul l'upload `.ubx` est idempotent (`upsert:true`, `telemetryStorage.ts:56-58`).
- **Garde écran/batterie : ABSENTE.** Aucun usage d'`expo-keep-awake` dans le code (grep : seule une dépendance transitive dans `package-lock.json`). Le service assume « capture au premier plan » (`captureSessionService.ts:18-21`). `app.json` déclare `UIBackgroundModes:["bluetooth-central"]` (`app.json:26`) mais le plugin ble-plx est configuré `isBackgroundEnabled:false` (`app.json:79`) — configuration contradictoire, comportement réel après verrouillage d'écran : **INCONNU** (non testé sur device dans le repo ; `docs/SMOKE_TEST_DEVICE.md` ne couvre pas le verrouillage).

#### (d) Points de rupture concrets

1. **Perte de lots réseau sans requeue** — `captureSessionService.ts:307-312` : `splice` puis insert ; échec = perte DB définitive.
2. **Verrouillage écran** — pas de keep-awake + capture « premier plan » (`captureSessionService.ts:18-21`) : sur un stint de 20 min, l'iPhone se verrouille par défaut ; la survie de la capture repose sur `bluetooth-central` non validé (`app.json:26` vs `:79`).
3. **Coupure BLE > ~60 s = fin de séance forcée** — 5 tentatives × (2 s backoff + 10 s timeout) puis `lost` → `finalizeOnLostLink()` clôt la session (`bluetoothService.ts:72-73, 455-470` ; `captureSessionService.ts:267-292`). Pas de reprise dans la même session.
4. **Arrêt hors couverture** — session bloquée en `recording`, tours et `.ubx` jamais resynchronisés (`:353-354, 423-425, 433-437`) ; aucune reprise au retour réseau.
5. **Ligne d'arrivée par défaut piégée** — sans `finishLine`, repli `BELTOISE_FINISH` volontairement hors de tout circuit → 0 tour (`captureSessionService.ts:53, 165-171`) ; le flux nominal la passe (`placement.tsx:80`, `captureFinishLineFor` retourne `undefined` si 0/0, `captureFinishLineLogic.ts:29-39`) mais Valencia doit avoir sa ligne renseignée en base `circuits`, sinon capture sans tours.
6. **Chronos de tours sur `Date.now()`** — `lapDetectionRunner.ts:77-78` : throttling arrière-plan ou saut d'horloge fausse les durées (les frames DB, elles, sont protégées par le monotone).

#### Verdict

**SOUS CONDITIONS** — la chaîne BLE→parse→buffer→`telemetry_frames`+`.ubx` est réelle, branchée et testée, mais une session complète à Valencia exige aujourd'hui : (1) réseau présent au démarrage ET à l'arrêt (sinon pas de capture / session orpheline en `recording`), (2) écran déverrouillé ou auto-verrouillage désactivé manuellement (aucun keep-awake, arrière-plan BLE non validé), (3) aucune coupure BLE > ~60 s (sinon clôture forcée), (4) ligne d'arrivée du circuit de Valencia renseignée dans `circuits` (sinon 0 tour).

---

### SECTION 5 — TRACES DU PIPELINE COACHING IA (périmètre Lot 0)

Provider unique : **OpenAI `gpt-4o-mini`** via `https://api.openai.com/v1/chat/completions` (`supabase/functions/generate-debrief-ai/index.ts:43-44`, `supabase/functions/coach-ai-draft/index.ts:24-25`). Aucune trace Anthropic/Claude API, aucun autre LLM (grep `anthropic|api\.anthropic|claude-3` sur `src/ app/ supabase/functions/` : 0 hit hors commentaires de maquette). Secret : `OPENAI_API_KEY` lu dans l'env edge (`generate-debrief-ai/index.ts:161`, `coach-ai-draft/index.ts:75`).

#### 5.1 Edge functions IA (3)

| Fonction | Lignes | Rôle | Appel LLM |
|---|---|---|---|
| `supabase/functions/generate-debrief-ai/index.ts` | 390 | Débrief J+1 littéraire pilote : prompt doctrinal 3 actes (l.233-265), écrase `app_session_analyses.debrief_text` (l.364-367) | OUI (gpt-4o-mini, temp 0.6, 600 tokens, l.275) |
| `supabase/functions/coach-ai-draft/index.ts` | 230 | Brouillon d'observation IA sur 1 virage pour le coach ; insère `coach_ai_drafts` en `status='draft'` (l.208-221) | OUI (gpt-4o-mini, temp 0.5, 220 tokens, l.147) |
| `supabase/functions/coach-ai-validate/index.ts` | 136 | Validation humaine du brouillon : re-filtre le texte édité (l.87-91), crée `coach_annotations` avec `ai_assisted=true` via service_role (l.100-110), passe le draft en `validated` (l.120-127) | NON (maillon du pipeline IA, zéro appel OpenAI) |

`cron-analyze-pending-sessions/index.ts` (200 l.) : **vérifié, AUCUNE IA** — calcul statistique pur des marges (stddev/pondérations, l.28-59). Hors périmètre de retrait.

Prompts : 2 system prompts doctrinaux inline (`generate-debrief-ai/index.ts:233-250`, `coach-ai-draft/index.ts:128-137`) + 2 prompts de retry (l.314 et l.178 resp.). Config déploiement : `supabase/config.toml` n'a PAS d'entrée `[functions.generate-debrief-ai|coach-ai-*]` (verify_jwt=true par défaut ; seule mention = commentaire l.28). Déploiement prod : affirmé par le commentaire de `supabase/migrations/20260629150000_drop_redundant_coach_ai_suggestions.sql` (« déjà en prod, avec les edge functions coach-ai-draft / coach-ai-validate déployées ») — état réel en ligne : INCONNU (audit lecture seule, non vérifié).

#### 5.2 Fichiers app — retrait total (5)

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/services/coachAiService.ts` | 134 | Orchestration coach : `requestDraft`/`validateDraft` (invoke edges, l.59, 121), `listMyDrafts`/`discardDraft` sur `coach_ai_drafts` |
| `app/(coach)/assistant.tsx` | 312 | Écran Assistant IA coach. **FONCTIONNEL** : données réelles (`listMyPilots`/`listPilotSessions` l.71-95, edges l.108/121+), états requesting/validating/error (l.60-67, 103-116), nav câblée depuis `app/(coach)/index.tsx:231` |
| `src/components/AIReviewBanner.tsx` | 66 | Bandeau « Suggestion assistée par IA » posé sur le brouillon (`assistant.tsx:241`) |
| `src/services/consentService.ts` | 52 | 100 % IA : lecture/écriture `ai_debrief_enabled` + `coach_ai_enabled` (l.27-50) |
| `src/__tests__/rls/coachAiRLS.test.ts` | 210 | Tests RLS de `coach_ai_drafts` |

#### 5.3 Fichiers app — modifications partielles (13)

| Fichier:ligne | Ce qui est IA |
|---|---|
| `src/services/analyzeSessionService.ts:225-264` | `invoke('generate-debrief-ai')` (l.233) + bascule fallback local — garder le fallback comme chemin unique |
| `src/services/adminSessionDiagnosticService.ts:124` | `relaunchDebrief` invoque `generate-debrief-ai` |
| `app/(admin)/analyse-session/[id].tsx:181` | Bouton admin « Régénérer le débrief » (hint `generate-debrief-ai`) |
| `app/(app)/settings.tsx:22,42-45,66-79,103-114,329-330` | 2 toggles IA (débrief + assistant coach) |
| `app/(app)/consentements.tsx:116-130` | Section « Transfert de données hors UE » : 2 ToggleRow IA |
| `app/(onboarding)/cgu.tsx:25,33,46,114-115` | Case à cocher consentement débrief IA à l'onboarding |
| `src/services/onboardingService.ts:45-61` | Param `aiDebriefConsent` → write `users.ai_debrief_enabled` |
| `src/services/coachAnnotationsService.ts:45,61` | Mapping colonne `ai_assisted` |
| `app/(app)/virage.tsx:608` | Badge pilote « · Assistée par IA, validée par votre coach » |
| `app/(coach)/index.tsx:231` | Lien nav « Assistant IA » |
| `src/types/database.types.ts:69-118,884-952,1005+,6946,6952,7807` | Types `ai_safety_reviews`, `coach_ai_drafts`, `ai_assisted`, `ai_debrief_enabled`, `coach_ai_enabled`, RPC `coach_ai_consent` — à régénérer après migrations |
| `src/legal/legalDocuments.ts:25,32` | Politique de confidentialité : OpenAI cité comme sous-traitant (débrief) + ElevenLabs (synthèse vocale) — **texte juridique, validation Gabin requise** (CLAUDE.md) |
| `src/services/__tests__/aiSafetyFilter.test.ts:42-106` | Describes « PARITÉ avec le garde-fou edge » (lit physiquement `generate-debrief-ai/index.ts`, l.51) et « anti-divergence coach » — à retirer avec les edges |

À statuer (recommandation : **conserver**, non spécifiques à l'IA) : `src/services/aiSafetyFilter.ts` (204 l., filtre doctrinal aussi utilisé par les générateurs LOCAUX non-IA : `debriefGenerator.ts:23`, `focusCorner.ts:16,129`, `developmentCycleService.ts:13`, `debriefRenderGuard.ts:15`, `app/(app)/debrief.tsx:31,105`, `notifCopy.test.ts:9`) ; trigger DB `coach_annotations_doctrine_guard` (protège aussi les notes coach MANUELLES partagées). Cosmétique : `app/(admin)/feature-flags.tsx:131` (placeholder « ex. coach_ai_v2 », 1 ligne).

#### 5.4 Tables, colonnes, RPC (base)

| Objet | Migration | État code |
|---|---|---|
| Table `coach_ai_drafts` (+5 policies RLS l.115-149, trigger `coach_ai_drafts_set_updated_at` l.89-101) | `supabase/migrations/0026_coach_ai_drafts.sql:63` | Lue/écrite par `coachAiService.ts` + 2 edges |
| Table `ai_safety_reviews` | `supabase/migrations/20260629140000_coach_ai_assistant_foundation.sql:11` | **Orpheline** : 0 lecteur/écrivain dans `src/`, `app/`, `supabase/functions/` (grep vérifié) — seuls les types la connaissent |
| Colonne `users.ai_debrief_enabled` | `20260614120000_app_ai_debrief_optout.sql` | Gate opt-out edge (`generate-debrief-ai:204`) |
| Colonne `users.coach_ai_enabled` | `0026_coach_ai_drafts.sql:27` | Gate opt-in via RPC |
| Colonne `coach_annotations.ai_assisted` | `0026` §2 | Provenance affichée au pilote (`virage.tsx:608`) |
| RPC `coach_ai_consent(uuid)` | `0026:34-46` | Gate fail-closed de `coach-ai-draft` (l.90) |
| Trigger + fn `coach_annotation_doctrine_guard` | `0026:165-185` | À statuer : rempart doctrinal DB valable aussi hors IA |

Déjà purgé : `coach_ai_suggestions` droppée par `20260629150000` (doublon de `coach_ai_drafts`, 0 ligne). Attention : `coach_queue` est créée dans la migration « coach_ai_assistant_foundation » mais n'est PAS de l'IA (file de lecture coach, utilisée par `src/services/coachQueueService.ts:26,58` et `app/(coach)/file-lecture.tsx`) — à conserver. Hors périmètre app : `ritual_dispatches.elevenlabs_chars` (schéma prod côté site ; seule référence code = purge RGPD `purge-deleted-accounts/index.ts:57`).

#### 5.5 Garde-fous existants (note factuelle pour décider le retrait)

| Garde-fou | Preuve |
|---|---|
| **Validation humaine obligatoire** : le brouillon IA n'atteint JAMAIS le pilote ; RLS interdit au coach de poser `status='validated'` lui-même ; seule voie = edge `coach-ai-validate` (service_role) après re-filtrage du texte édité | `0026_coach_ai_drafts.sql:133` (policy update), `coach-ai-validate/index.ts:87-98` |
| **Opt-in pilote fail-closed (coach)** : `coach_ai_consent` = coach détaillé consenti ET `coach_ai_enabled=true` (défaut false) ; erreur/absent → 403, rien n'est envoyé à OpenAI | `0026:34-46`, `coach-ai-draft/index.ts:89-95` |
| **Opt-out pilote (débrief)** : `ai_debrief_enabled=false` → 403 sans appel OpenAI, fallback local. Modèle défaut-ON assumé | `generate-debrief-ai/index.ts:196-209`, `analyzeSessionService.ts:229-232` |
| **Filtre lexical doctrinal en sortie** : 52 termes proscrits (debrief) / 18 patterns (coach), retry unique, sinon refus 422 sans persistance + log `admin_audit` | `generate-debrief-ai/index.ts:58-116,299-353`, `coach-ai-draft/index.ts:29-54,166-201` |
| **Triple rempart** : filtre app (`aiSafetyFilter.ts`, source canonique, test de parité qui lit le fichier edge) + filtre edge + trigger SQL sur les notes partagées | `aiSafetyFilter.test.ts:42-106`, `0026:165-185` |
| **Garde-fou au rendu** : le texte du débrief est re-scanné avant affichage | `app/(app)/debrief.tsx:105`, `debriefRenderGuard.ts:30-32` |
| **Minimisation RGPD** : payloads non nominatifs (ni prénom, ni id, ni `started_at`) | `generate-debrief-ai/index.ts:176-192,252`, `coach-ai-draft/index.ts:121-126` |
| **RLS-first** : `coach-ai-draft` lit les données via le JWT du coach (pas service_role) — pas d'exfiltration cross-pilote possible | `coach-ai-draft/index.ts:78-106` |
| **Transparence pilote** : provenance `ai_assisted` marquée et affichée | `0026` §2, `virage.tsx:608` |

Statut fonctionnel : les deux pipelines sont **FONCTIONNELS** (débrief J+1 : invoke + fallback local + garde de rendu ; assistant coach : écran branché bout en bout). Le retrait ne supprime donc pas du code mort mais une fonctionnalité vivante — le fallback local `debriefGenerator.ts` (non-IA, doctrinal) devient le chemin unique du débrief.

#### 5.6 Périmètre de retrait chiffré

- **Fichiers app** : **18** (5 suppressions complètes + 13 modifications partielles), +2 à statuer (`aiSafetyFilter.ts` et son test — recommandé de les garder pour les générateurs locaux).
- **Edge functions** : **3** (`generate-debrief-ai`, `coach-ai-draft`, `coach-ai-validate`) + 1 commentaire `config.toml:28`.
- **Tables/colonnes DB** : **2 tables** (`coach_ai_drafts`, `ai_safety_reviews` — cette dernière orpheline) + **3 colonnes** (`users.ai_debrief_enabled`, `users.coach_ai_enabled`, `coach_annotations.ai_assisted`) + **1 RPC** (`coach_ai_consent`) ; 1 trigger doctrinal à statuer (utile hors IA). Toute migration = schéma prod → validation Gabin requise (CLAUDE.md).
- **Flags** : **2** flags de consentement (`ai_debrief_enabled` opt-out défaut ON ; `coach_ai_enabled` opt-in défaut OFF) + 1 marqueur de provenance (`ai_assisted`) + **1 secret env** à révoquer (`OPENAI_API_KEY`). Zéro flag IA dans `app_feature_flags` (migration `20260629003722` : 0 occurrence).
- **Textes juridiques** : 2 passages citant OpenAI dans `src/legal/legalDocuments.ts` (l.25, l.32) — modification soumise à validation fondateur.

---

### SECTION 6 — CONFORMITÉ DOCTRINE CÔTÉ PILOTE

Référentiel d'audit : zéro QDI/score/note/conseil côté pilote · paiement coach jamais in-app · comparaisons soi-contre-soi uniquement. Périmètre grep : `app/(app)/` uniquement.

#### 6.1 Grep `-iE "qdi"` — 121 occurrences, 10 fichiers

| Fichier | Occ. | Nature |
|---|---|---|
| `app/(app)/signature.tsx` | 46 | **QDI affiché** : radar pentagonal 5 branches (`QdiRadar`, :258-263), référence = médiane self-only (`getQdiReference`, :136), mini-radars mensuels (:321). Copy :339 : « La référence est votre propre historique… jamais un classement. » |
| `app/(app)/insights.tsx` | 23 | Couleur QDI par dimension uniquement (pas de valeur). Disclaimer :87 : « Aucune lecture n'est une note, un score ni un classement. » |
| `app/(app)/bilan.tsx` | 17 | **QDI affiché** : « Quatre piliers » = valeur numérique 0-100 par branche (:464-471), chiffres masqués si offre Access (`showValue={qdiAccess === 'full'}`, :471) |
| `app/(app)/index.tsx` | 15 | **QDI affiché** : `QdiBars` 5 barres colorées sur le hub (:336-340), recalcul paresseux `getOrComputeQdiForSession` (:104) |
| `app/(app)/empreinte-saison.tsx` | 12 | **QDI affiché** : `MiniQdiRadar` médiane mensuelle self-only (:233), source affichée `app_session_analyses.qdi` (:210) |
| `passeport.tsx` (3), `insight/[reading].tsx` (2) | 5 | Réutilisation de la règle d'accès / couleur ; passeport :158 : « Jamais une couleur QDI ici » |
| `carnet.tsx` :15, `comparateur.tsx` :157, `data-lab.tsx` :38 | 3 | Bruit : commentaires de NÉGATION (« zone SANS donnée QDI », « pas une donnée QDI », icône) |

Structure vérifiée : `QdiResult` = 5 branches 0-100 + métadonnées, **aucun champ composite** (`src/services/qdiLogic.ts:47-59`) ; self-only strict, référence = historique du pilote même circuit (`src/services/qdiService.ts:5-13`) ; version d'algo estampillée (`qdi-1.1.0`, qdiLogic.ts:25).

**Verdict** : NON-CONFORME au référentiel tel qu'énoncé (« zéro QDI côté pilote ») — le QDI est visible pilote sur 4 écrans. Voir 6.6 pour la décision fondateur qui l'acte.

#### 6.2 Grep `-iE "score|note[^s]|rating"` — tri du bruit

Occurrences significatives (chiffre /5 réellement affiché côté pilote) :
- `app/(app)/mes-demandes.tsx:229-302` — le pilote **note son coach** 1-5 (pastilles chiffrées, pas d'étoiles emoji) ; en-tête :19 : « la note est un fait de l'avis et jamais un classement de coachs ».
- `app/(app)/coach/[id].tsx:379-437` — moyenne /5 + `RatingDots` des avis d'UN coach ; :393 : « Aucun classement inter-coachs : seulement l'agrégat de CE coach. »

Classement honnête : c'est une **note de prestataire** (avis marketplace), pas une note de performance de pilotage. Hors cible du référentiel « note de performance », mais c'est le seul endroit de l'espace pilote où un « n/5 » existe.

Bruit écarté : notes libres du carnet (`carnet.tsx` — texte du pilote, zone sans perf ni couleur QDI :15) ; notes texte/vocales du coach lues par le pilote (`virage.tsx:584-603` — filtrées, cf. 6.4) ; styles `note:`/`footnote:` (UI) ; `scoreDown()` interne à qdiLogic (jamais affiché comme « score »). Négations explicites : `passeport.tsx:6` (« aucun rang, aucun score »), `objectifs.tsx:10`, `programme.tsx:8`, `regularite.tsx:176` (« Un fait statistique, pas une note »), `signature.tsx:12` (« JAMAIS un score unique »).

#### 6.3 Grep `-iE "classement|ranking|leaderboard"` — 27 occurrences, 16 fichiers

**100 % des occurrences sont des négations** (commentaires doctrine ou copy visible : « Entre copains. Pas de classement. » `cote-a-cote/[friendId].tsx:237` ; « Juste vous, pas de classement » `progression.tsx:222`). Aucun leaderboard, aucun rang inter-pilotes rendu. CONFORME.

#### 6.4 Grep `-iE "conseil|advice|recommend"` (+ `recommand|suggér|devriez|il faut`) — 1 occurrence

- `cote-a-cote/[friendId].tsx:14` — négation en commentaire. Les variantes françaises : **0 occurrence**.
- Remparts vérifiés : texte IA du débrief refusé côté client s'il est prescriptif (`debrief.tsx:98-106`, `isDoctrineSafe` de `src/services/aiSafetyFilter`) ; annotations coach partagées filtrées app + trigger DB 0026 (`src/services/coachAnnotationsService.ts:152-158`) ; copy des notifications verrouillé par test (`src/services/__tests__/notifCopy.test.ts:9`).
- Point ouvert : `app_session_analyses.next_focus_phrase` (« Une chose à creuser », migration `0009:23-25`) est lu (`DebriefMirror.tsx:518`) mais **aucun writer dans le repo** (grep vide dans `src/` et `supabase/functions/`). La génération de cette phrase est hors-repo : conformité du contenu généré = **INCONNU**.

#### 6.5 Paiement coach (référentiel : jamais in-app)

| Preuve | Constat |
|---|---|
| `coach/[id].tsx:7` | « AUCUN paiement (Phase 2) » ; :147 copy visible « Tarif indicatif · réglé hors application » |
| `src/services/coachMarketplaceService.ts:362-396` | `requestBooking` = INSERT `coaching_bookings` status `pending`, **aucun champ prix/paiement** |
| `coachs.tsx:224-226, 338, 406-408` | Prix affichés à titre indicatif (`season_price_eur`, offre partenaire, roulage « par place ») — pas de CTA d'achat |
| `roulages.tsx:53-57` + `src/services/roulagesService.ts:260-278` | Accepter un roulage payant = UPDATE `status` uniquement |
| `package.json` | grep `stripe\|purchase\|iap\|revenuecat` = **0** — aucun SDK de paiement |

**CONFORME** : prix affichés informatifs, aucun checkout in-app. Distinction prix-indicatif/checkout respectée y compris dans le libellé visible.

#### 6.6 Comparaisons : soi-contre-soi, ou un autre pilote ?

- **`comparateur.tsx` : self-only garanti par la requête.** `listRecentAnalyses(profile.id)` (:70) → `.eq('user_id', userId)` (`src/services/analysesService.ts:65`), sous RLS own-row. Aucun sélecteur d'autrui.
- **`cote-a-cote/[friendId].tsx` : compare EXPLICITEMENT avec un autre pilote** (ami). `loadFriendSessionList` fait `.eq('user_id', friendId)` sur `app_session_analyses` (`src/services/duelService.ts:60-68`). La contrainte n'est **pas seulement UI : elle est en RLS** — fonction `are_friends()` SECURITY DEFINER exigeant `status='accepted'` (migration `20260526120000_0027_pilot_friendships.sql:69-97`) et policies `app_session_analyses_select_friend` (:143-146), `telemetry_sessions_select_friend` (:158-161), `app_segment_analyses_select_friend` (migration `0030:17-20`). Double consentement révocable ; l'écran n'affiche ni gagnant ni QDI de l'ami (0 occurrence `qdi` dans `cote-a-cote/`), seulement marges % et marges par virage. Détail mineur : le commentaire `cote-a-cote:18` cite « migration 0027 », ambigu — le repo contient aussi `0027_coach_development_cycles.sql`.
- `amis.tsx:10` : « pas de notion de "score d'amitié", pas de classement ».

#### 6.7 Conclusion — non-conformités vs référentiel et décisions fondateur en vigueur

| # | Écart vs référentiel énoncé | Statut dans le repo |
|---|---|---|
| 1 | QDI visible pilote (hub, bilan, signature, empreinte-saison) | **Acté par décision fondateur** : `roadmap/specs/QDI_CARTOGRAPHIE_M1.md:3` — « Décision fondateur 2026-07-04 : QDI réintroduit, visible pilote, self-only » ; repris par `src/services/qdiService.ts:9` (« décision fondateur 2026-07-04, "assumer" »). Le garde-fou T6 (jamais de score composite) reste respecté : 5 branches, aucun agrégat. |
| 2 | Comparaison ciblant un autre pilote (`cote-a-cote`) | **Acté** : header migration `0027_pilot_friendships.sql:2-6` (« Duel pédagogique… Pas de gagnant désigné, pas de classement ») ; consentement mutuel imposé en RLS, pas en UI. |
| 3 | Note /5 côté pilote (avis coach) | Note de prestataire marketplace, pas de performance pilote — à faire trancher si le référentiel « zéro note » est lu strictement. |
| 4 | `next_focus_phrase` : writer introuvable dans le repo | Contenu généré hors-repo → conformité du texte **INCONNU** ; le lecteur (`debrief.tsx:105`) est fail-closed via `isDoctrineSafe`, mais `DebriefMirror.tsx:518` affiche la phrase sans ce filtre (à vérifier). |

**Contradiction documentaire résiduelle** : `docs/specs-bundle-v4/00_CLAUDE.md:62` (« Le QDI est abandonné côté app. Ne réintroduis aucun score global ») et `docs/specs-bundle-v4/11_ethique_transparence_algorithmique.md:19,66,76` (QDI abandonné, T6) n'ont **pas été mis à jour** après la décision du 2026-07-04. La chaîne de décision la plus récente (`roadmap/specs/QDI_CARTOGRAPHIE_M1.md`, `docs/refonte-app/CARTOGRAPHIE_FONCTIONNELLE_2026-07.md:15` — « QDI 5 branches jamais composite (T6) ») fait foi dans le code ; les specs v4 restent la lettre contraire. L'arbitrage porte donc sur la mise à jour des specs v4, pas sur le code : celui-ci applique fidèlement la décision fondateur (QDI self-only, 5 branches, sans composite, gating offre).

---

### SECTION 7 — SUPABASE

#### 7.a — Tables référencées par le code

Commande : `grep -rhoE "\.from\('[^']+'\)" src/ app/ --include="*.ts" --include="*.tsx" | sort | uniq -c` → **67 cibles uniques** (66 tables + 1 vue `coach_pilots_view`, définie en SECURITY INVOKER dans `supabase/migrations/20260525114148_coach_pilots_table_and_rls.sql:168-174`). Occurrences = nombre de `.from()` dans src/+app/ (tests inclus).

| Table | Occ. | Exemple d'usage |
|---|---|---|
| `telemetry_sessions` | 66 | `src/services/adminAnalyticsService.ts:32` |
| `users` | 48 | `src/services/accountService.ts:37` |
| `app_session_analyses` | 25 | `src/services/adminAnalyticsService.ts:33` |
| `pilot_friendships` | 22 | `src/services/dataExportService.ts:92` |
| `coach_annotations` | 22 | `src/services/coachAnnotationsService.ts:81` |
| `pilot_development_cycles` | 19 | `src/services/developmentCycleService.ts:80` |
| `events` | 16 | `src/services/adminAnalyticsService.ts:65` |
| `support_tickets` | 15 | `src/services/supportAdminService.ts:44` |
| `pilot_notes` | 15 | `src/services/pilotNotesService.ts:47` |
| `pilot_signature_snapshots` | 14 | `src/services/pilotSignatureSnapshotService.ts:112` |
| `telemetry_frames` | 13 | `src/services/analyzeSessionService.ts:373` |
| `moderation_reports` | 13 | `src/services/moderationService.ts:79` |
| `event_registrations` | 13 | `src/services/b2bReportService.ts:71` |
| `coach_pilots` | 13 | `src/services/coachAdminService.ts:84` |
| `partner_leads` | 12 | `src/services/partnerService.ts:162` |
| `partner_accounts` | 12 | `src/services/adminAnalyticsService.ts:62` |
| `coach_profiles` | 11 | `src/services/coachBillingService.ts:56` |
| `coach_ai_drafts` | 11 | `src/services/coachAiService.ts:78` |
| `support_messages` | 9 | `src/services/supportAdminService.ts:103` |
| `partner_offers` | 9 | `src/services/partnerService.ts:131` |
| `cycle_steps` | 9 | `src/services/developmentCycleService.ts:160` |
| `app_segment_analyses` | 9 | `src/services/dataExportService.ts:110` |
| `scenic_routes` | 8 | `src/services/routing/scenicRoutesService.ts:59` |
| `event_partners` | 8 | `src/services/eventsService.ts:403` |
| `devices` | 8 | `src/services/adminDevicesService.ts:32` |
| `b2b_event_reports` | 8 | `src/services/b2bReportService.ts:56` |
| `vehicle_setups` | 7 | `src/services/garageService.ts:123` |
| `session_media` | 7 | `src/services/dataExportService.ts:115` |
| `pilot_goals` | 7 | `src/services/dataExportService.ts:89` |
| `data_quality_reports` | 7 | `src/services/adminQualityService.ts:120` |
| `session_intentions` | 6 | `src/services/intentionsService.ts:59` |
| `roulage_invitations` | 6 | `src/services/roulagesService.ts:159` |
| `circuits` | 6 | `src/services/attendanceService.ts:61` |
| `vehicles` | 5 | `src/services/dataExportService.ts:88` |
| `social_pings` | 5 | `src/services/socialPingsService.ts:101` |
| `registrations` | 5 | `src/services/attendanceService.ts:69` |
| `moderation_report_reviews` | 5 | `src/services/moderationService.ts:137` |
| `laps` | 5 | `src/services/captureSessionService.ts:353` |
| `coaching_bookings` | 5 | `src/services/coachMarketplaceService.ts:376` |
| `ambassador_profiles` | 5 | `src/services/ambassadorService.ts:37` |
| `device_assignments` | 4 | `src/services/adminDevicesService.ts:41` |
| `coach_roulages` | 4 | `src/services/roulagesService.ts:85` |
| `coach_messages` | 4 | `src/services/coachMessagesService.ts:63` |
| `coach_availability` | 4 | `src/services/coachMarketplaceService.ts:313` |
| `app_progression_shares` | 4 | `src/services/dataExportService.ts:101` |
| `app_feature_flags` | 4 | `src/services/featureFlagsService.ts:31` |
| `sessions` (calendrier site) | 3 | `src/services/attendanceService.ts:50` |
| `session_insights` | 3 | `src/services/dataExportService.ts:98` (écriture réservée à l'edge `compute-session-insights`) |
| `pro_team_members` | 3 | `src/services/proTeamService.ts:37` |
| `coach_reviews` | 3 | `src/services/coachMarketplaceService.ts:674` |
| `coach_reading_weights` | 3 | `src/services/coachReadingService.ts:44` |
| `coach_pilots_view` (vue) | 3 | `src/services/coachService.ts:220` |
| `coach_objectives` | 3 | `src/services/coachObjectivesService.ts:96` |
| `coach_invoices` | 3 | `src/services/coachBillingService.ts:131` |
| `weather_snapshots` | 2 | `src/services/weatherService.ts:211` |
| `pilot_waiver_signatures` | 2 | `src/services/waiverService.ts:76` |
| `device_health_logs` | 2 | `src/services/deviceHealthService.ts:76` |
| `coach_session_context` | 2 | `src/services/coachSessionContextService.ts:59` |
| `coach_queue` | 2 | `src/services/coachQueueService.ts:26` |
| `app_config` | 2 | `src/services/appConfigService.ts:19` |
| `restaurants` | 1 | `src/services/placesService.ts:60` |
| `partners` | 1 | `src/services/placesService.ts:52` |
| `media_exports` | 1 | `src/services/mediaExportsService.ts:19` |
| `lodgings` | 1 | `src/services/placesService.ts:56` |
| `coach_permissions` | 1 | `src/services/coachPermissionsService.ts:43` |
| `circuit_services` | 1 | `src/services/ecosystemService.ts:114` |

RPC hors tables : `log_coach_view` (3 appels, ex. `src/services/coachService.ts:261`), `get_shared_progression` (`src/services/sharesService.ts:167`), `next_coach_invoice_number` (`src/services/coachBillingService.ts:186`). Tables touchées uniquement par les edge functions (pas par l'app) : `admin_audit` (`supabase/functions/coach-ai-draft/index.ts:193`), `documents`, `email_log`, `heritage_packs`, `ritual_dispatches`, `payments` (`supabase/functions/purge-deleted-accounts/index.ts:48-72`).

#### 7.b — Edge Functions (`supabase/functions/*`) — 14 dossiers, 14 `index.ts`

| Fonction | Lignes | Statut | Preuve |
|---|---|---|---|
| `coach-ai-draft` | 230 | Implémentée | Gate fail-closed `rpc('coach_ai_consent')` (index.ts:90-95), appel OpenAI gpt-4o-mini (:143-154), filtre doctrinal + retry (:167-185), insert `coach_ai_drafts` status='draft' (:208-221) |
| `coach-ai-validate` | 136 | Implémentée | Re-filtre serveur du texte édité (index.ts:88-91), insert `coach_annotations` via service_role (:100-112), transition draft→validated (:120-127) |
| `compute-session-insights` | 166 | Implémentée | Calcule anatomy/ideal_lap/data_quality depuis `app_segment_analyses`+`laps`+`telemetry_frames` puis delete+insert `session_insights` (index.ts:150-151) ; seul chemin d'écriture (écriture service_role only, en-tête :6-9) |
| `cron-analyze-pending-sessions` | 200 | Implémentée | Balaye les sessions completed sans analyse, upsert `app_session_analyses` (index.ts:158) ; garde X-Cron-Token **optionnelle** — si `CRON_TOKEN` absent, endpoint public (:64-70, verify_jwt=false) |
| `generate-debrief-ai` | 390 | Implémentée | Lexique proscrit complet miroir de `aiSafetyFilter.ts` (index.ts:58+), appel OpenAI, écrase `app_session_analyses.debrief_text` (:363-366), opt-out `users.ai_debrief_enabled` (:23-24) |
| `notify-coach-consent-received` | 71 | Implémentée | Lit `users.expo_push_token`+opt-in (index.ts:30-41), POST Expo Push (:53-60) |
| `notify-coach-session-analyzed` | 169 | Implémentée | Déclenchée par trigger pg_net (migration 0022), garde Bearer secret **best-effort** : si `EDGE_FUNCTIONS_INVOKE_SECRET` non configuré, laisse passer avec warning (index.ts:43-50) |
| `notify-pilot-coach-annotated` | 170 | Implémentée | Trigger pg_net migration 0021, même garde best-effort (index.ts:53-60), silence 22h-8h (en-tête :15) |
| `notify-pilot-coach-assigned` | 77 | Implémentée | verify_jwt=true (en-tête :12), lecture token + no-op si opt-out (index.ts:36-47) |
| `notify-pilot-friend-accepted` | 133 | Implémentée | Trigger `pilot_friendships_after_update` pending→accepted (en-tête :8-9), garde secret (index.ts:45-49) |
| `notify-pilot-friend-request` | 147 | Implémentée | Trigger `pilot_friendships_after_insert` (en-tête :8-9), garde secret (index.ts:45-49) |
| `purge-deleted-accounts` | 173 | Implémentée mais **DRAFT déclaré** | En-tête : « DRAFT — A VALIDER JURIDIQUEMENT et a TESTER […] AVANT tout deploiement en prod » (index.ts:4-6) ; logique réelle complète : 23 couples table/colonne purgés (:48-72), purge Storage 4 buckets (:74), scrub PII users |
| `send-coach-invitation` | 126 | Implémentée | Email HTML complet via Resend (index.ts:22, :31-36), verify_jwt=true (en-tête :18) |
| `send-document-status` | 147 | Implémentée | Trigger `notify_document_status` (migration `20260630160000_document_status_email_trigger.sql`), email Resend validé/refusé, dédup via `email_log` (en-tête :10), dormante sans `EDGE_FUNCTIONS_INVOKE_SECRET` (:12) |

Aucune n'est un template vide. **Anomalie** : l'app invoque une 15e fonction `pair-app` (`src/services/pairingService.ts:33`, `functions.invoke('pair-app', { body: { action: 'redeem', code } })`) qui **n'existe pas dans `supabase/functions/`** — code source hors dépôt (site web ou déployée directement). Son état réel : INCONNU depuis ce repo. Fonctions invoquées depuis l'app : 7 sur 15 (`coach-ai-draft`, `coach-ai-validate`, `compute-session-insights`, `cron-analyze-pending-sessions`, `generate-debrief-ai`, `pair-app`, `send-coach-invitation`) ; les 8 autres sont déclenchées par triggers pg_net/pg_cron.

#### 7.c — RLS

Comptes vérifiés : **103 fichiers** dans `supabase/migrations/` (`ls | wc -l` = 103), **259 `CREATE POLICY`** au total (`grep -c "CREATE POLICY\|create policy"` sommé = 259).

Policies clés (extraits exacts) :

1. **`coach_pilots`** — `supabase/migrations/20260525114148_coach_pilots_table_and_rls.sql:54-82` : `coach_pilots_select_own_coach` (`USING (coach_id = auth.uid())`), `coach_pilots_select_own_pilot`, `coach_pilots_update_own_pilot_consent` (le pilote ne peut toucher que son consentement), `coach_pilots_admin_all` (`USING (is_admin())`).
2. **`telemetry_frames_coach_select`** — même fichier :122-131 : `USING (session_id IN (SELECT id FROM telemetry_sessions WHERE is_coach_of(user_id)))` ; **remplacée** par la version graduée dans `0014_coach_access_level_graduated.sql:40-46` qui exige `is_detailed_coach_of(user_id)` (accès frames réservé au niveau « détaillé »).
3. **`is_coach_of()`** — `20260525114148...sql:90-104` : SECURITY DEFINER, exige `active = true AND pilot_consent_at IS NOT NULL` → le consentement pilote est une condition SQL, pas un flag UI.
4. **Realtime** — `20260711181903_live_realtime_authorization.sql:6-53` : 4 policies sur `realtime.messages` — `live_session_recv` (coach du binôme actif **ET** `cp.live_sharing_at IS NOT NULL`), `live_session_send` (pilote propriétaire de la séance), `live_roster_read` (coach lit uniquement `live:roster:<son uid>`), `live_roster_join` (pilote consenti live). Canaux ouverts en `private: true` côté app (`src/services/liveSessionService.ts:128`).
5. **Vue colonne-limitée** — `20260525114148...sql:168-174` : `coach_pilots_view` en SECURITY INVOKER expose nom/prénom/avatar mais PAS email/téléphone/documents au coach.

**Verdict cloisonnement pilote/coach : en BASE.** Preuves : (i) les fonctions `is_coach_of` / `is_detailed_coach_of` (SECURITY DEFINER, `REVOKE FROM PUBLIC, anon` — :110) conditionnent chaque `coach_select` au consentement stocké en base ; (ii) l'edge `coach-ai-draft` lit volontairement via le JWT du coach et non service_role précisément pour s'appuyer sur la RLS (index.ts:11-13) ; (iii) **17 fichiers de tests RLS** dans `src/__tests__/rls/` (+ `setup.ts`), dont `coachGradedAccessRLS.test.ts`, `coachSessionsRLS.test.ts`, `roleMatrixRLS.test.ts`, exercent ces policies contre la base.

#### 7.d — Buckets Storage

Commandes : `grep -rn "\.storage" src/ app/` + `grep "storage.buckets|bucket_id" supabase/migrations/*.sql`.

| Bucket | Visibilité | Usage code (preuve) | Création |
|---|---|---|---|
| `telemetry_raw` | privé | `src/services/telemetryStorage.ts:20` (const BUCKET), upload UBX brut :56 | Migration `20260524182915_0008_telemetry_raw_storage_bucket.sql:9-13` (`INSERT INTO storage.buckets`) |
| `pilot-media` | privé | `src/services/pilotMediaService.ts:24` ; signed URLs :62, upload :148, remove :163/:195 | Migration `0011_pilot_media_bucket.sql:14-18` |
| `session-media` | privé | `src/services/sessionMediaService.ts:59` ; signed URL :144, upload :175 | Bucket créé **manuellement au Dashboard** (instructions migration `20260526160000_0031_session_media.sql:124-129`) ; les policies storage (`bucket_id = 'session-media'` :154, admin :173-174) sont dans la migration |
| `coach-media` | **public** (vitrine commerciale — comment `0011_pilot_media_bucket.sql:3`) | `src/services/coachMediaService.ts:22` ; `getPublicUrl` :40, upload :147 | **Aucune migration locale** ne le crée → créé en prod hors repo. INCONNU ici |
| `coach-audio` | privé (signed URL) | `src/services/coachAudioService.ts:19` ; upload :80-82, `createSignedUrl(…, 3600)` :104 | **Aucune migration locale** ne le crée → INCONNU ici |
| `avatars` | public (intentionnel) | Référencé `supabase/migrations/20260525111333_security_hardening.sql:84-88` (policy de listing retirée, URLs publiques conservées) | Hors migrations locales (héritage site V1) |
| `vehicles`, `documents`, `audio_briefings` | — | Purgés par `purge-deleted-accounts` (`supabase/functions/purge-deleted-accounts/index.ts:74` : `STORAGE_BUCKETS = ['vehicles','documents','avatars','audio_briefings']`) ; aucun usage direct dans src/app | Héritage site V1, hors migrations locales |

Synthèse : 5 buckets manipulés par l'app (`telemetry_raw`, `pilot-media`, `session-media`, `coach-media`, `coach-audio`), 4 buckets legacy touchés uniquement par la purge RGPD. 2 buckets utilisés par l'app (`coach-media`, `coach-audio`) n'ont **aucune trace de création ni de policies dans les migrations locales** — leur configuration prod (visibilité, RLS storage) n'est pas versionnée dans ce dépôt.

---

### SECTION 8 — PAIEMENTS ET ABONNEMENTS

**Verdict global : AUCUN encaissement in-app. Zéro SDK Stripe, zéro clé, zéro checkout. Le flag `coach_billing` est `false` en production (vérifié en base). Le modèle « aide à la facture, émetteur = coach, OXV n'encaisse pas » est implémenté et cohérent avec l'attendu (inactif jusqu'au SIRET, août 2026). Une divergence de traçabilité côté prod (2 edge functions paiement non versionnées dans ce repo).**

#### 8.1 SDK et clés

| Point | Constat | Preuve |
|---|---|---|
| SDK Stripe / IAP / RevenueCat dans l'app | **ABSENT** | `grep -iE "stripe\|purchase\|billing\|iap"` sur `package.json`, `app.json`, `eas.json` → 0 résultat (exit 1) |
| Clés en dur (`pk_live`, `sk_live`, `pk_test`, `sk_test`, `whsec_`, `STRIPE`) | **AUCUNE** (repo entier hors node_modules/.git) | `grep -rInE "pk_live\|sk_live\|pk_test\|sk_test\|whsec_\|STRIPE"` → 0 ligne (exit 1) |
| Variables d'env paiement | **AUCUNE** | `.env` (540 o) et `.env.example` : `grep -iE "stripe\|payment"` → 0 résultat |

Aucun point CRITIQUE : pas de clé exposée.

#### 8.2 Écrans de paiement in-app

| Écran | Statut | Preuve |
|---|---|---|
| `app/(coach)/facturation.tsx` | **FONCTIONNEL mais GATÉ** (invisible en prod, flag off) : données réelles via `coachBillingService` → Supabase, états loading/error/nominal via `StateWrapper` (`facturation.tsx:111`), toggle avec revert serveur (`:103-109`), export PDF (`:96-101`) | En-tête `:2-11` : « paiement DIRECT au coach, hors OXV… Gaté par le flag coach_billing (INACTIF jusqu'au SIRET d'OXV) » ; check flag `:70-76` |
| `app/(coach)/facture-nouvelle.tsx`, `app/(coach)/facturation-identite.tsx` | Présents (émission + identité de facturation) | Fichiers trouvés par grep `payment_link` |
| Entrée dashboard coach | Lien facturation **caché** tant que flag off (pas de « bientôt » visible) | `app/(coach)/index.tsx:51-57`, `:241` |
| `app/(partner)/facturation.tsx` | **Placeholder statique assumé** (pas de logique — c'est le design) : « Rien à régler ici… OXV ne prélève rien dans l'application » | `:4-8`, `:30-42` |
| Réservation coach côté pilote | **Aucun champ prix/Stripe** dans la demande de séance | `src/services/coachMarketplaceService.ts:198-199` |

Aucun écran de checkout, aucun `payment_intent`, aucun formulaire carte. Le seul artefact « paiement » est `coach_profiles.payment_link` (coordonnées de paiement du coach), rendu uniquement sur le PDF de facture partagé hors app (`src/services/coachInvoicePdfService.ts:37-42`) — jamais un lien de paiement in-app côté pilote (grep `paymentLink` : 8 fichiers, tous côté coach/service/PDF/types/migration/doc).

#### 8.3 Webhooks et edge functions paiement

- **Repo** : `supabase/functions/` contient 14 fonctions (`ls`), **aucune** liée au paiement. Grep `invoice_on_payment_succeeded` sur tout le repo → 0 résultat.
- **Prod** (`list_edge_functions`, projet `fouvuqkdxarjpjbqnsjq` oxv-platform) : 32 fonctions déployées, dont **`send-payment-confirmed` (v2)** et **`generate-invoice` (v4)** — **absentes de ce repo** (pipeline du site web oxvehicle.fr). Aucune fonction nommée `invoice_on_payment_succeeded` ; aucune fonction webhook Stripe (`resend_webhook` = délivrabilité e-mail Resend, pas paiement).
- **Déclencheurs réels en prod** (SQL `pg_get_triggerdef` sur `payments`) : `trg_payment_invoice` AFTER UPDATE OF status → `notify_payment_invoice()` et `trg_payment_confirmed_email` AFTER UPDATE → `notify_payment_confirmed()` (+ `trg_referral_validate`, `trigger_auto_reference`). C'est l'équivalent fonctionnel de « facture à l'encaissement » — piloté par un changement de statut en base, **pas** par un webhook Stripe.
- **DIVERGENCE à signaler** : ces 2 fonctions prod et leurs triggers ne sont versionnés nulle part dans ce repo ; leur code exact = **INCONNU** depuis l'audit du dépôt.

#### 8.4 Flags et modèle « aide à la facture »

| Point | Constat | Preuve |
|---|---|---|
| Flag `coach_billing` en prod | **`enabled = false`** (vérifié) | `SELECT … FROM app_feature_flags` → `{"key":"coach_billing","enabled":false}` ; défaut posé par `supabase/migrations/20260704150000_p2_coach_billing_and_invoicing.sql:90-92` |
| OXV n'encaisse pas | Explicite et implémenté | Migration `:2-5` : « OXV n'encaisse ni ne facture la prestation » ; `coachInvoicePdfService.ts:10-13` : « n'intervient NI dans l'émission NI dans l'encaissement » |
| Émetteur = coach | `seller` = identité du coach figée à l'émission | `coachBillingService.ts:215-221` ; snapshot destinataire `buyer_name` `:206`, `:315-317` |
| Opt-in coach | `invoicing_assist_enabled` + garde-fou `canIssueInvoice` (nom + SIRET requis) | `coachBillingService.ts:170-180` ; `coachBillingLogic.ts:54-66` |
| Numérotation | Séquence atomique par coach, côté serveur (`security definer`, `for update`) ; refus si séquence anormale | Migration `:66-88` ; `coachBillingService.ts:193-197` |
| TVA | Franchise 293 B CGI ou assujetti, calcul pur testé (12 `it(` dans `src/services/__tests__/coachBillingLogic.test.ts`) | `coachBillingLogic.ts:13`, `:28-46` |
| RLS | Coach = ses factures ; pilote = lecture de celles qui le concernent ; admin | Migration `:54-63` |

#### 8.5 État des données de paiement en prod (lecture seule)

- `payments` : **2 lignes**, toutes `status='pending'`, `payment_method='bank_transfer'`, 25 000 (EUR), `stripe_payment_intent_id`/`stripe_charge_id` **NULL** (mai 2026). **Aucune transaction Stripe n'a jamais transité.**
- `subscriptions` : **0 ligne**. `coach_invoices` : **0 ligne**.
- Les colonnes Stripe existent dans le schéma (héritage site web) : `payments.stripe_charge_id/stripe_invoice_id/stripe_payment_intent_id` (`src/types/database.types.ts:4684-4686`), `subscriptions.stripe_customer_id/stripe_subscription_id` (`:6553-6554`), `users.stripe_customer_id` (`:6997`) — **jamais lues ni écrites par le code app** : grep `from('payments')` / `from('subscriptions')` sur tout le repo → 0 résultat.

#### 8.6 Cohérence juridique / RGPD

- Politique de confidentialité : Stripe listé comme sous-traitant **« (à venir) … quand activé »**, Irlande/UE (`src/legal/legalDocuments.ts:32`).
- Purge de comptes : `payments`/`registrations`/`stripe_customer_id` **conservés** (obligation légale facturation), effacement côté Stripe = appel API séparé non couvert, explicitement documenté comme point à trancher (`supabase/functions/purge-deleted-accounts/index.ts:29-31`, `:153` ; `README.md:30-32`).
- Migration 0008 : « Paiement Stripe = reporté » (`supabase/migrations/0008_coaching_reviews.sql:7`).

#### 8.7 Divergences et points d'attention

1. **Traçabilité prod** : `generate-invoice` et `send-payment-confirmed` (+ triggers `trg_payment_invoice`, `trg_payment_confirmed_email`, `trg_referral_validate` sur `payments`) tournent en prod sans être versionnés dans ce dépôt. Contenu = INCONNU ici. À rapatrier ou documenter.
2. **Commentaire périmé** : `coachBillingService.ts:11` dit « Rendu PDF = étape ultérieure » alors que `coachInvoicePdfService.ts` existe et est branché (`app/(coach)/facturation.tsx:28`, `:96-101`). Mineur.
3. **Gabarit facture + régime TVA** : marqués « à faire VALIDER par un comptable avant service » (migration `:6`, `coachBillingLogic.ts:6-7`) — toujours ouvert, cohérent avec flag off.
4. Conforme à l'attendu : **inactif jusqu'au SIRET** — flag `false` en prod, aucun encaissement, écrans coach cachés, placeholder partenaire honnête.

---

---

## 9. Synthèse de pilotage

### Avancement par lot (vs référentiel 66 écrans)

| Lot | Contenu | Avancement honnête | Détail |
|---|---|---|---|
| Lot 0 | Retrait pipeline coaching IA | **Périmètre identifié à 100 %, exécution 0 % — arbitrage requis AVANT exécution** | Périmètre chiffré §5.6 : 18 fichiers app, 3 edge functions, 2 tables + 3 colonnes + 1 RPC, 2 flags de consentement, 1 secret env (`OPENAI_API_KEY`), 2 passages légaux. ATTENTION : les deux pipelines IA sont FONCTIONNELS et sous garde-fous (validation humaine obligatoire, opt-in pilote, fail-closed) ; le référentiel contredit la décision fondateur actée dans le repo (`roadmap/specs/QDI_CARTOGRAPHIE_M1.md:3`, 2026-07-04). Le retrait supprime une fonctionnalité vivante, pas du code mort. |
| Lot A | Auth + consentement + profil minimal + appairage | **≈ 70 %** | Login + appairage par code site (`(auth)/login.tsx`, `(auth)/lier.tsx`) fonctionnels ; consentement CGU/pacte/télémétrie fonctionnel (`(onboarding)/cgu.tsx`, `pacte.tsx`) ; profil fonctionnel ; appairage RaceBox = scan BLE réel (`(app)/equipement.tsx`). ABSENTS vs référentiel : register, magic-sent, forgot, select-space — par ARCHITECTURE (l'inscription vit sur le site oxvehicle.fr, l'app s'appaire par code). |
| Lot B | Capture 25 Hz hors-ligne + sync (Valencia) | **≈ 65 %** | Chaîne BLE→parse UBX→buffer→`telemetry_frames`+`.ubx` réelle, branchée, testée (§4). MANQUE le hors-ligne de bout en bout : pas de démarrage sans réseau, pas de requeue des lots perdus, pas de réimport `.ubx`→frames, pas de keep-awake, session orpheline si arrêt hors couverture. |
| Lots C-G | Données, coaching, staff, paiements | **41/66 écrans du référentiel fonctionnels** (§3) ; couverture réelle du dépôt LARGEMENT au-delà (167 routes effectives, espaces partner/pro/admin non prévus au référentiel) | Divergence structurelle : nav réelle = 5 zones Miroir·Data Lab·Carnet·Découverte·Compte (refonte-v2, décision fondateur 2026-07-12), pas les 5 onglets du référentiel. Espace Staff/Ops du référentiel ≈ espace `(admin)` existant (29 routes). Paiements : conformes à l'attendu (inactifs jusqu'au SIRET, §8). |

### Les 5 blocages majeurs pour Valencia (par risque décroissant)

1. **Capture impossible sans réseau au démarrage, session orpheline à l'arrêt hors-ligne** — l'insert `telemetry_sessions` initial échoue sans réseau (`captureSessionService.ts:139-154`) ; à l'arrêt hors couverture, la session reste `status='recording'`, laps et upload `.ubx` perdus sans retry (`:408-437`). La file offline MMKV ne couvre PAS la capture (`offlineQueue.ts:21-27`).
2. **Verrouillage d'écran non maîtrisé sur un stint de 20 min** — aucun `expo-keep-awake` dans le code ; config contradictoire `UIBackgroundModes:["bluetooth-central"]` (`app.json:26`) vs plugin BLE `isBackgroundEnabled:false` (`app.json:79`). Comportement réel après verrouillage : INCONNU (non testé device).
3. **Lots de trames perdus définitivement en cas d'échec réseau pendant la capture** — pas de requeue (`captureSessionService.ts:305-315`) ; aucun chemin de réimport `.ubx`→`telemetry_frames` (le bilan local marche, le serveur/coach reste aveugle). Pas de contrainte UNIQUE sur `(session_id, elapsed_ms)` → doublons possibles.
4. **Coupure BLE > ~60 s = clôture forcée de la séance** — 5 tentatives puis `finalizeOnLostLink()` (`bluetoothService.ts:455-470`, `captureSessionService.ts:267-292`) ; pas de reprise dans la même session.
5. **Ligne d'arrivée de Valencia à renseigner en base `circuits`** — sans elle, repli volontairement hors-circuit → 0 tour détecté (`captureSessionService.ts:53, 165-171`). Blocage DATA, une ligne SQL suffit — à faire avant le départ.

Blocage transverse (non-Valencia mais bloquant Lot 0) : la divergence
référentiel ↔ décisions fondateur en vigueur (QDI pilote + coaching IA actés
2026-07-04 et implémentés ; specs-bundle-v4 non mises à jour, §6.7). Trancher
AVANT d'exécuter le Lot 0.

### Prochaine action de développement (une phrase)

Durcir la chaîne de capture hors-ligne : mode local au démarrage (session
différée), requeue des lots de trames, keep-awake + validation BLE arrière-plan
sur device, et reprise `.ubx`→serveur au retour réseau — c'est l'unique chemin
critique de Valencia.

### Risques sécurité relevés en passant

- **Aucune clé Stripe** (SDK absent, aucun `pk_live`/`sk_live` en dur — §8). Secrets edge en variables d'environnement (conforme) ; `OPENAI_API_KEY` à révoquer si Lot 0 exécuté.
- **RLS : cloisonnement pilote/coach EN BASE** (fonctions `is_coach_of`/`is_detailed_coach_of` SECURITY DEFINER + policies dédiées) et exercé par 17 fichiers de tests RLS (`src/__tests__/rls/`) — pas seulement UI (§7).
- `telemetry_frames` sans contrainte UNIQUE `(session_id, elapsed_ms)` : doublons possibles sur retry client (intégrité, pas confidentialité).
- **Traçabilité prod incomplète** : `generate-invoice`, `send-payment-confirmed` (+ 3 triggers `payments`) tournent en prod sans être versionnés dans ce dépôt — contenu INCONNU ici (§8.7). À rapatrier.
- Config iOS contradictoire (background BLE, cf. blocage n° 2) — risque opérationnel plus que sécurité.
- 6 advisors Supabase ERROR préexistants (vues `*_public` SECURITY DEFINER) — connus, hors périmètre de ce lot (constat des sessions précédentes, à re-vérifier).
