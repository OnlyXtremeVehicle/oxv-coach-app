# Tickets de développement

> Tickets prêts à coder pour les premières PR. Réf. : `00_PLATEFORME_OXV.md §7` (roadmap PR), `01_ORGANISATION_PRODUIT.md` (zones), `02_AUDIT_ROUTES.md` (routes réelles), `04_DESIGN_CANON.md` (loi design).
> Statut : **cadrage** — chaque ticket est grounded sur du code réel (routes `app/(app)/*`, services `src/services/*`, stores `src/store/*`).
> Règle absolue : **aucune migration Supabase n'est acquise**. Tout schéma nouveau est marqué « **nécessite accord Gabin** » et reste hors PR jusqu'à validation.

---

## Conventions de ticket

Chaque ticket suit ce format :

- **Objectif** — la valeur produit, en une phrase.
- **Fichiers concernés** — chemins RÉELS existants ou à créer (marqués _net-neuf_).
- **Données** — tables / services réels touchés.
- **Critères d'acceptation** — vérifiables, binaires.
- **Risque** — niveau + cause.

Garde-fous transverses (valent pour tous les tickets) :

- TypeScript strict, pas de `any`, hooks fonctionnels, pas de `localStorage`/`sessionStorage`.
- Doctrine : un seul chiffre dominant/écran · **or = donnée** · **rouge = coach/REC** · vouvoiement · pas d'emoji · aucun verbe prescriptif côté pilote.
- Nav : **l'or est interdit sur la nav** (actif `#F8F9FA` / inactif `#54545C`).
- Pas de modification de schéma sans accord. Les tickets de couche profonde portent un encart « nécessite accord ».

---

## Lot A — PR 1 · Navigation 5 zones + carte d'app

### A1 — `appMap.ts` : source unique de vérité de la navigation

**Objectif** — Centraliser le mapping route → zone (Paddock · Session · Bilan · Progression · Club · Compte) pour que la nav, le Paddock contextuel et le futur Data Lab lisent la même table.

**Fichiers concernés**
- `src/lib/appMap.ts` _(net-neuf)_ — exporte `type Zone`, `ROUTE_TO_ZONE`, `TAB_ORDER`, helpers `zoneOfRoute(path)`, `dataLabScreens()`.
- Aucun écran modifié dans ce ticket : `appMap.ts` est consommé en A2.

**Données** — aucune. Pur mapping statique, dérivé de `02_AUDIT_ROUTES.md` (colonnes « Zone cible »).

**Critères d'acceptation**
- `TAB_ORDER` = `['paddock','session','bilan','progression','club']` exactement, dans cet ordre.
- Chaque route réelle de `app/(app)/*` listée dans `02_AUDIT_ROUTES.md` a une entrée dans `ROUTE_TO_ZONE` (test : aucune route orpheline).
- `compte` n'est PAS dans `TAB_ORDER` (icône haut-droite, pas un onglet).
- `dataLabScreens()` retourne au minimum `carte`, `virage`, `virage-comparer`, `tours`, `heatmap`, `replay`, `telemetry`, `insights` (routes RANGÉES sous Bilan).
- Test Jest : `zoneOfRoute('/bilan')==='bilan'`, `zoneOfRoute('/mon-coach')==='club'`, `zoneOfRoute('/settings')==='compte'`.

**Risque** — faible. Aucune UI, aucune donnée.

---

### A2 — Barre d'onglets 5 zones

**Objectif** — Remplacer le `Stack` actuel de `app/(app)/_layout.tsx` par une navigation 5 onglets conforme à la décision verrouillée, sans casser les routes existantes.

**Fichiers concernés**
- `app/(app)/_layout.tsx` — aujourd'hui un `Stack` (redirect auth + `animation: 'fade'`). À convertir en `Tabs` Expo Router OU `Stack` + barre custom persistante. Conserver la garde `status === 'unauthenticated' → Redirect /(auth)/login`.
- `src/components/AppTabBar.tsx` _(net-neuf)_ — barre custom (le canon impose des specs précises non couvertes par la tab bar par défaut).
- `app/(app)/index.tsx` → écran de l'onglet **Paddock** (déjà le hub d'accueil, cf. A3).
- Hubs _net-neufs_ stubs pour les onglets sans écran racine dédié : `app/(app)/session/index.tsx`, `app/(app)/club/index.tsx` (Bilan = `bilan.tsx`, Progression = `progression.tsx` existent déjà).

**Données** — `useAppStateStore` (état `S5_approche`/`S6_roulage` masque la tab bar, cf. A6/B-session). `useAuthStore` pour la garde.

**Critères d'acceptation**
- Tab bar : hauteur 88, fond `rgba(5,5,5,0.9)` flouté, border-top `#1C1C20`, 5 items icône 21 stroke 1.65 + label Geist Mono 8.5 ls 0.05em (`04_DESIGN_CANON §4`).
- Actif `#F8F9FA`, inactif `#54545C`. **Aucune trace d'or sur la nav** (grep `#FFB703` dans `AppTabBar.tsx` → 0 résultat).
- Compte = icône en haut à droite (via `SpaceSwitcher`/header), jamais un 6e onglet.
- En état `S6_roulage` (et `S5_approche` selon `04_DESIGN_CANON §6`), **la tab bar est masquée** (silence en piste).
- Toutes les routes de `02_AUDIT_ROUTES.md` restent accessibles (aucune route supprimée en PR 1) ; les écrans RANGÉS s'ouvrent au toucher depuis leur zone, pas comme onglet.
- Cibles tactiles ≥ 44 px.

**Risque** — moyen. Conversion Stack→Tabs touche tous les écrans pilote ; risque de régression de navigation et de double header.

---

## Lot B — PR 2 · Paddock contextuel

### B1 — Paddock unique et contextuel

**Objectif** — Un seul Paddock qui montre « ce qui compte maintenant » selon l'état pilote, avec une action principale contextuelle.

**Fichiers concernés**
- `app/(app)/index.tsx` — déjà 3 modes (`enroute` / `countdown` / `passive`) câblés sur `useAppStateStore`. À aligner sur les 6 états produit de `01_ORGANISATION_PRODUIT` (aucune session / session prévue / arrivée circuit / en piste / après roulage / hors événement).
- `app/(app)/paddock.tsx` — **doublon** à fusionner dans `index.tsx` (cf. `02_AUDIT_ROUTES` : « un seul Paddock »). Ne pas supprimer le fichier en PR 2 ; le rediriger vers `index` puis dédupliquer en PR de migration (`10_PLAN_MIGRATION.md`).
- `src/components/SpaceSwitcher.tsx` — conservé (bascule espaces).

**Données**
- `useAppStateStore` (`state: PilotState` S1..S10, dérivé par `determineState()`).
- `regularityService.computeRegularity` + `sessionsService.fetchSessionLaps` (chiffre héros actuel = régularité au tour, fait factuel — déjà en place).
- Dernier bilan : `analysesService` / `sessionsService.fetchPreviousSessions`.

**Critères d'acceptation**
- Un seul chiffre dominant à l'écran (régularité au tour en Geist Mono ; PAS la marge globale — réservée au Bilan).
- Action principale dérivée de l'état (`01_ORGANISATION_PRODUIT`) : avant → « Préparer ma session » · arrivée → « Connecter l'équipement » · après roulage → « Découvrir mon bilan » · hors événement → « Voir ma progression ». Max 2–3 raccourcis.
- En `S6_roulage` : aucun contenu utile, aucune notif, aucun son (renvoi à l'état « en piste », cf. B-session).
- Aucun verbe prescriptif, aucun emoji, vouvoiement. Texte serif autorisé pour la salutation (« Bonsoir. »).
- Pas de longue liste de liens (social/réglages/lieux → Club/Compte, pas ici).

**Risque** — faible/moyen. Réconciliation `index`/`paddock` + dépendance à l'exactitude de `determineState()`.

---

## Lot C — PR 3 · Bilan hub à divulgation progressive

### C1 — Bilan hub (le cœur)

**Objectif** — Le Bilan est la première chose vue après une session : un chiffre dominant, une phrase miroir, 2 constats, une bande coach — et le détail seulement au toucher.

**Fichiers concernés**
- `app/(app)/bilan.tsx` — existe (charge la session cible, calcule/persiste l'analyse, affiche gauge + cards). À recadrer sur l'ordre de révélation `01_ORGANISATION_PRODUIT` : **retenir → où regarder → pourquoi → détails sur demande**.
- `src/components/instruments` (`GaugeInstrument`, `CoachBand`, `MeterBar`, `EmptyState`) — réutilisés tels quels.
- `src/components/InsightTransparency` (`DataQualityBanner`, `ProvenanceLine`, `SourceMethodBlock`, `BlindspotsBlock`) — conservés (charte transparence).

**Données**
- `analysesService.getAnalysisForSession` / `upsertAnalysis`.
- `marginCalculator.computeMargin` (marge globale = LE chiffre dominant du Bilan).
- `regularityService.computeRegularity`, `sessionsService.fetchSessionLaps`/`fetchPreviousSessions`.
- Couche coach : `coachCurationService.listHighlightsForMe`, `coachReadingService`, `coachContextLogic.buildContextRows`, `coachSessionContextService.getSessionContext`.

**Critères d'acceptation**
- Un seul chiffre dominant : la marge globale via `GaugeInstrument` (arc 270°, or `#FFB703`, taille ≈ 226–230 — `04_DESIGN_CANON §3`).
- Exactement 2 constats factuels max en surface : puce or « à observer » / puce verte « à conserver » (`04_DESIGN_CANON §4` Fact).
- Bande coach = SEUL espace prescriptif, en rouge (`#C8102E`, bordure `#5A1A22`), citation en Instrument Serif, question ouverte. Si pas de coach affilié → absente, pas de placeholder rouge.
- Les sous-vues (Carte, Virages, Tours, Heatmap, Insights, Débrief, Replay, Export) sont accessibles **au toucher**, jamais en entrées principales — elles pointent vers le Data Lab (Lot D).
- Vocabulaire : « à observer / à explorer / était-ce volontaire ? » autorisé ; « freinez / corrigez / vous devez / mauvais / erreur » absent (grep doctrine).
- Si session sans analyse : calcul à la volée puis persistance best-effort (comportement actuel conservé), avec `DataQualityBanner` si data incomplète.

**Risque** — moyen. Écran dense existant ; le recadrage par couches ne doit pas casser export PDF (`bilanPdfExportService`) ni couches coach.

---

## Lot D — PR 3 (suite) · Data Lab V1 (assemblage d'écrans existants)

### D1 — Hub Data Lab

**Objectif** — Regrouper les écrans d'analyse détaillée existants sous une seule porte « lecture détaillée », sans réécrire les écrans.

**Fichiers concernés**
- `app/(app)/data-lab.tsx` _(net-neuf)_ — hub d'assemblage. Liste de lignes (`04_DESIGN_CANON §4` Ligne de liste) vers les écrans RANGÉS, lues depuis `appMap.dataLabScreens()` (A1).
- Écrans RANGÉS **réutilisés tels quels** (existent déjà) : `carte.tsx`, `virage.tsx`, `virage-comparer.tsx`, `tours.tsx`, `heatmap.tsx`, `replay.tsx`, `telemetry.tsx`, `insights.tsx`, `insight/[reading].tsx`.
- `app/(app)/bilan.tsx` — un point d'entrée « Data Lab » remplace les 4 cards éparses.

**Données** — aucune donnée nouvelle ; chaque écran cible garde ses propres services (`segmentAnalysesService`, `brakingPointsService`, `cornerDeepDiveService`, `sessionTelemetryService`, `sessionInsightsService`…).

**Critères d'acceptation**
- Le Data Lab n'introduit **aucune** logique d'analyse propre : c'est un index de navigation.
- Chaque ligne ouvre l'écran existant avec le `sessionId` courant en paramètre (continuité de session).
- Réplique simple V1 (`03_MVP_SCOPE` : « Data Lab simple — carte + tours + couches » en V1 ; replay avancé en V1.5).
- Or = donnée uniquement dans les écrans cibles ; le hub lui-même reste neutre (texte crème/muted, pas d'or décoratif).
- Aucune entrée Data Lab visible en surface du Bilan (uniquement au toucher).

**Risque** — faible. Pur assemblage. Risque résiduel : paramètres `sessionId` non propagés à un écran cible.

---

### D2 — Virage Explorer (deep-dive virage)

**Objectif** — Lecture seule d'un virage : carte zoomée, vitesses, forces vécues, écart au tracé, question ouverte. Le pilote pro lit les chiffres, le particulier lit les formes.

**Fichiers concernés**
- `app/(app)/virage.tsx` — existe (écran #15) : `CircuitMap` + couches (`CornersLayer`, `TrackLayer`, `TrajectoryLayer`, `getCornerViewBox`), `GForceBars`, navigation virage précédent/suivant (`nextCornerIndex`/`previousCornerIndex` de `circuitTopology`).
- `app/(app)/virage-comparer.tsx` — existe : comparaison du virage avec une 2e session (picker).

**Données**
- `cornerDeepDiveService.loadCornerDeepDive` (`CornerDeepDive`, `CornerTrajectoryPoint`).
- `circuitTopology.getCorner` / `nextCornerIndex` / `previousCornerIndex`.
- `coachAnnotationsService.listVisibleAnnotationsForCorner` (couche coach sur le virage).

**Critères d'acceptation**
- Lecture seule stricte : la vue décrit (vitesses entrée/min/apex/sortie, delta, G latéral/freinage/accélération, écart latéral moyen/max), elle ne juge pas.
- Question ouverte de clôture en registre miroir (« Était-ce volontaire ? »), pas de consigne.
- Annotations coach affichées en rouge (`#C8102E`) et distinctes de la donnée (or). Aucune annotation coach rendue en or.
- Navigation virage précédent/suivant fonctionnelle ; le `sessionId` et l'index virage sont préservés vers `virage-comparer`.
- Barres de force = `GForceBars` (or = donnée), pas de couleur « performance ».

**Risque** — moyen. Densité de données et exactitude géo (`geoToSvg`, `CircuitMap`) ; veiller à la lisibilité au soleil (contraste).

---

## Lot E — PR 4 · Flux Session + état en piste

### E1 — Flux Session linéaire

**Objectif** — Un parcours rassurant et prévisible : Équipement → Placement → Capture → Retour stands → Bilan prêt.

**Fichiers concernés** (tous existent, réutilisés)
- `app/(app)/equipement.tsx` (étape 1, appairage BLE) · `placement.tsx` (étape 2) · `roulage.tsx` (état en piste) · `entre-runs.tsx` (inter-runs) · `pilotage-fini.tsx` (retour stands) · `bilan-pret.tsx` (transition Bilan).
- `app/(app)/session/index.tsx` _(net-neuf, du Lot A)_ — hub de l'onglet Session qui oriente vers l'étape courante selon l'état.

**Données**
- `useAppStateStore` (`activeRecording: RecordingState`, `setActiveRecording`, `position`, `recompute()`).
- `src/ble/bluetoothService.ts` (appairage / flux) — réutilisé tel quel.
- `captureSessionService`, `captureFrameMapping`, `sessionTelemetryService`, `telemetryStorage`, `offlineQueue`.

**Critères d'acceptation**
- L'onglet Session ouvre toujours l'étape correspondant à l'état courant (`equipement` en `S5_approche`, etc.) — pas un menu.
- Erreurs BLE : chaque message répond à *que s'est-il passé ? / qu'est-ce qui est préservé ? / que puis-je faire maintenant ?* (`01_ORGANISATION_PRODUIT` Session). Aucun jargon brut non traduit.
- Offline : la capture se met en file via `offlineQueue` ; aucune perte silencieuse.
- Vouvoiement, aucun emoji, aucun verbe prescriptif.

**Risque** — moyen/élevé. Dépendance BLE matériel ; tests sans RaceBox via dataset UBX (cf. `CLAUDE.md`).

---

### E2 — État « en piste » (doctrine du silence)

**Objectif** — Pendant le roulage, l'app s'efface totalement : aucun écran utile, aucune notif, aucun son.

**Fichiers concernés**
- `app/(app)/roulage.tsx` — écran d'état « en piste ».
- `app/(app)/_layout.tsx` + `src/components/AppTabBar.tsx` (Lot A) — masquage de la tab bar.
- `app/(app)/index.tsx` — mode `enroute` déjà présent (« Coupez l'app. Je conduis. ») à aligner sur le canon.

**Données** — `useAppStateStore` (`state === 'S6_roulage'`, dérivé par `determineState()` via `position.speed >= drivingMinSpeedKmh`). Aucune lecture data affichée.

**Critères d'acceptation**
- Conforme `04_DESIGN_CANON §6` : fond `#020202`, voyant rouge 16px `#C8102E` qui pulse, « EN PISTE » Mono ls 0.4em, « L'app s'efface. » Instrument Serif, « Aucun écran. Aucun son. Conduisez. ».
- **Pas de tab bar, pas de données, pas de chrono, pas de carte.**
- Seule animation tolérée : voyant REC qui pulse lentement + anneau qui s'évase (`04_DESIGN_CANON §5`). Aucune autre animation.
- Aucune notification déclenchée tant que `S6_roulage` est actif (vérifier `pushNotificationsService` ne pousse rien en piste).
- Transition automatique vers `S7_paddock`/`S8_atterrissage` au retour stands (vitesse < seuil), sans action requise.

**Risque** — moyen/élevé. Le masquage UI doit être total et fiable ; un seul composant résiduel casse la doctrine.

---

## Lot F — PR 6 · Club hub

### F1 — Club hub « qui m'entoure »

**Objectif** — Regrouper coach affilié, découverte coachs, partenaires, carte OXV et communauté sous une seule zone, sans réseau social généraliste.

**Fichiers concernés** (existent, à ranger sous le hub)
- `app/(app)/club/index.tsx` _(net-neuf, du Lot A)_ — hub.
- `mon-coach.tsx` (affiliation **mise en avant**) · `coachs.tsx` (découverte) · `coach/[id].tsx` (fiche) · `mes-demandes.tsx` (demandes).
- `amis.tsx` (communauté) · `cote-a-cote/[friendId].tsx` (comparaison **consentie**) · `carte-oxv.tsx` (La carte OXV).
- À FUSIONNER (cf. `02_AUDIT_ROUTES`, doublons) : `social.tsx`→`amis`, `social-carte.tsx`+`lieux.tsx`→`carte-oxv`. Fusion réalisée en PR de migration, pas ici ; en PR 6 on range et on redirige.

**Données**
- `coachMarketplaceService`, `coachService`, `coachProfileService`, `pilotConsentService` (affiliation/consentement coach).
- `friendshipsService`, `socialPingsService`, `duelService` (`cote-a-cote`, comparaison consentie).
- `placesService`, `ecosystemService`/`ecosystemLogic` (carte OXV, partenaires — annuaire V1).

**Critères d'acceptation**
- « Mon coach » est l'élément le plus proéminent du hub (affiliation en avant) ; la découverte (`coachs`) est secondaire.
- Comparaison entre pilotes **uniquement consentie** (`pilotConsentService`/`friendshipsService`) ; aucun classement, aucun leaderboard.
- Une seule carte (« La carte OXV ») — `social-carte` et `lieux` ne sont plus des destinations parallèles.
- Partenaires = annuaire en lecture (V1) ; offres/leads reportés V1.5 (`03_MVP_SCOPE`).
- Vouvoiement, pas d'emoji. Aucune donnée de tier Heritage hors badge (`#C4A459` réservé).

**Risque** — faible/moyen. Beaucoup de routes à réconcilier ; risque de doublons d'entrée si la fusion n'est pas faite proprement.

---

## Lot G — PR 6 (suite) · Compte hub

### G1 — Compte hub (icône, jamais un onglet)

**Objectif** — Regrouper profil, réglages, notifications, données/RGPD et légal derrière l'icône haut-droite, rangé et discret.

**Fichiers concernés** (existent)
- `app/(app)/compte/index.tsx` _(net-neuf, optionnel)_ — hub listant les destinations, OU header `SpaceSwitcher` ouvrant directement les écrans.
- `profil.tsx` · `settings.tsx` · `notifications.tsx` · `donnees-securite.tsx` (RGPD) · `legal/[doc].tsx`.

**Données** — `accountService`, `pilotProfileService`, `notifPreferencesLogic`, `pushNotificationsService`, `dataExportService` (RGPD — export/suppression).

**Critères d'acceptation**
- Compte accessible via l'**icône en haut à droite uniquement** — jamais comme 6e onglet (`00_PLATEFORME_OXV §4`).
- Lignes de liste conformes (`04_DESIGN_CANON §4`) : h ~50, icône stroke 1.6 `#9A9AA3`, chevron `#54545C`, séparateur `#161618`.
- `donnees-securite` expose les droits RGPD (export via `dataExportService`, accès aux documents légaux via `legal/[doc]`).
- Le Compte ne passe jamais devant le Bilan dans la hiérarchie de nav.
- Aucun or décoratif, aucun emoji.

**Risque** — faible. Écrans existants ; risque limité à l'emplacement de l'entrée (icône vs onglet).

---

## Couches profondes — hors PR 1–7 (rappel : chacune avec migration soumise)

> Ces tickets ne sont PAS à coder dans les premières PR. Ils sont listés pour traçabilité ; ils dépendent d'un schéma **non encore validé**.

| Ticket futur | Écran(s) net-neuf | Migration | Statut schéma |
|---|---|---|---|
| Passeport pilote (lecture V1) | `app/(app)/passeport.tsx` | table passeport / signature | **nécessite accord Gabin** |
| Garage pilote | `app/(app)/garage.tsx` | table véhicules pilote | **nécessite accord Gabin** |
| Cycles de progression | `app/(app)/cycles.tsx` | tables cycles / axes | **nécessite accord Gabin** |
| Carnet (avant/après) | `app/(app)/carnet.tsx` | table carnet | **nécessite accord Gabin** |
| Pass OXV (QR événement) | `app/(app)/pass-oxv.tsx` | table pass / événement | **nécessite accord Gabin** |
| Notes coach overlay sur data | overlay dans `virage`/`bilan` | extension `coach_annotations` | **nécessite accord Gabin** |
| Espace Partenaire | `app/(partner)/*` (net-neuf complet) | tables partenaires / offres / leads | **nécessite accord Gabin** |
| Admin qualité data / incidents | `app/(admin)/qualite-data.tsx`, `incidents.tsx` | tables qualité / incidents | **nécessite accord Gabin** |

Réf. existant à réutiliser pour ces couches : `pilotSignatureService`, `pilotGoalsService`, `coachAnnotationsService`, `coachBusinessService`, `coachAdminService`. Toute extension de leurs tables passe par une migration explicitement validée.

---

## Ordre d'exécution recommandé

1. **A1 → A2** (PR 1) : carte d'app puis tabs. A1 débloque le contextuel et le Data Lab.
2. **B1** (PR 2) : Paddock, dès que la tab bar et l'état pilote sont fiables.
3. **C1 → D1 → D2** (PR 3) : Bilan hub, puis Data Lab d'assemblage, puis Virage Explorer.
4. **E1 → E2** (PR 4) : flux Session puis silence en piste (E2 dépend du masquage tab bar de A2).
5. **F1 → G1** (PR 6) : Club puis Compte.
6. **PR 7** : polish canon (réalignement `src/theme/v2.ts`, Instrument Serif, gaming tempéré) — transverse, appliqué après que la structure est stable.

Aucun ticket de couche profonde n'entre tant que sa migration n'est pas validée par Gabin.
