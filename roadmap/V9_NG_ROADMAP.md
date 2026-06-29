# Roadmap V9 — Interface Nouvelle Génération (couche au-dessus du V6)

> Source : `OXV_Platform_Interface_Nouvelle_Generation_V9.docx`. Gap-analysis
> automatique (5 agents) recoupée à la main. Le V6 est **code-complet** ; la V9
> n'ajoute pas de features — elle ajoute la **couche interface NG** + le récit
> **OXV Trace**. Tally brut : 67 done · 45 partial · 33 missing · 2 needs-schema
> (147 livrables). Après filtrage des faux négatifs (voir ci-dessous), le vrai
> reste tient en **5 axes**.

## Progrès — nuit du 28→29 juin

**Livré + commité (gates vertes, jest 473 passed) :**
- Axe 1 — **Trace du jour** (`6cb3206`), **Saison narrée** (`f1ae3da`),
  **OXVPromiseBlock** (`2f792be`). Axe 1 complet **sauf Intention** (gated).
- Axe 2 — **LayerToggle** couches Tracé/Vitesse/Marges (`0f6d682`), sur le SVG
  existant, sans dépendance native.
- Doctrine — **garde-fou silence en piste** sur l'haptique (`9f1f3f0`,
  Principe 3) : aucune vibration en S6_roulage.

**Faux négatifs CONFIRMÉS (déjà faits, ne pas refaire) :** Passeport
(RadarEmpreinte = signature, carte-licence exportable, lien empreinte) ;
silence notifications (handler `notificationBehaviorForState` coupe déjà
bannière/son/badge en S6) ; OXV Moment cœur (`carte-trophee` :
TrophyCard→captureRef→partage).

**Reste — gated sur décision/aval Gabin :**
- **Intention** : créer la table `session_intentions` (approche validée,
  DDL en attente du « go » d'application) → puis IntentionCard + juxtaposition.
- **OXV Moment watermark** (Axe 3) : sortant → aval avant.
- **Paddock NG hero contextuel** (Axe 5) : front door → aval avant.
- **Tables** `device_health_logs`, `media_exports`, `coach_*` (Coach AI) : STOP.
- **Reste Axe 2** : LapTimeline (scrubber) + CornerPanel (bottom-sheet) —
  chantiers plus lourds, zéro-décision, à enchaîner.

## Lecture honnête de la matrice

**Faux négatifs (déjà faits, mal nommés par l'audit)** — la *fonction* existe,
seul le *nom de composant V9* manque (= refactor, pas du neuf) :
MaintenanceScreen/RequiredUpdateScreen = `MaintenanceGate`+`maintenance.tsx` ;
DataConfidenceBadge = `DataConfidenceBanner` ; KeyMomentsList = bilan ;
DeviceStatusCard/QualityIssueCard/SupportTicketCard/EventStatusPanel/Control-
TowerCard = cartes inline dans `devices`/`qualite-data`/`support`/`evenements`/
`tour-controle` ; PartnerOfferCard/LeadStatusPill/LeadConsentBadge = inline dans
`offres`/`leads` ; MethodLimitBlock = `BlindspotsBlock` ; ErrorRecoveryBlock =
`ErrorBoundary` ; Pass OXV / Carnet / Garage / Conditions / Équipe Pro / Média
Pro = faits.

---

## Les 5 axes du vrai reste V9

### Axe 1 — OXV Trace (LE signature V9) · zéro-schéma · priorité 1
Le récit « chaque session laisse une trace ». Manque réellement :
- **`traceNarrativeService`** : assemble la Trace du jour (session + confidence +
  key moment + ressenti) et la Saison.
- **Écran « Trace du jour »** (`app/(app)/trace.tsx`) : hero narratif post-analyse
  — badge qualité + aperçu d'un moment-clé + CTA Data Lab + CTA ressenti. Distinct
  du Bilan (qui reste l'analyse détaillée). Intercalé après `bilan-pret`.
- **Composants narration** : `TraceHero`, `SeasonCard`, `StoryMilestone`,
  `IntentionCard` (avec **persistance** de l'intention via `pilot_notes`),
  `OXVPromiseBlock`.

### Axe 2 — Data Lab NG / Skia · **dépendance native** · priorité 2
Rendu data riche et interactif. **Nécessite `@shopify/react-native-skia`** (dep
native → décision Gabin + rebuild, comme expo-av).
- **`TrackCanvas`** (tracé Skia multi-couches), **`LayerToggle`** (vitesse / G /
  constance / virages), **`LapTimeline`** (scrubber Reanimated), **`CornerPanel`**
  (bottom-sheet détail virage). **`PartnerPerfChart`** + perf Pro = mêmes charts.

### Axe 3 — OXV Moment / exports premium · view-shot · priorité 3
- **`OXVMomentCard`** + **export image sobre** (souvenir partageable), avec
  **`ExportWatermark`** (méthode visible) et **`SharePreview`** (aperçu avant
  partage). Rouge = marque uniquement (garde PR-69 déjà en place).

### Axe 4 — Formalisation des composants NG · zéro-schéma · priorité 4
Extraire en composants réutilisables nommés (§17) ce qui vit aujourd'hui inline :
`RoleShell`/`RoleGate`, `ConsentSwitchRow`, `CoachQueueCard`, `AccessLevelBadge`,
`CoachNoteCard`, `AIReviewBanner`, `LeadStatusPill`, `LeadConsentBadge`,
`PartnerOfferCard`, `DeviceStatusCard`, `QualityIssueCard`, `SupportTicketCard`,
`ControlTowerCard`, `EventStatusPanel`, `MethodLimitBlock`. DRY + cohérence kit.

### Axe 5 — Élévation NG + perf des écrans existants · zéro-schéma · priorité 5
Passe NG sur Paddock (hero contextuel + cards Pass/coach/équipement), Bilan,
Saison, Passeport, Coach dashboard / fiche pilote / lecture session, +
**FlashList** (sessions/leads/tickets/devices), accessibilité (44px, contrastes,
labels), offline terrain (cache Pass/sessions).

---

## STOP-schéma (accord Gabin requis)
- **Skia** (`@shopify/react-native-skia`) — dépendance native (Axe 2).
- `device_health_logs`, `media_exports` (tables, si persistées).
- `coach_ai_suggestions`, `ai_safety_reviews`, `coach_queue` (view) — Coach AI
  Assistant (PR-58, déjà STOP au V6).
- `partner_profile_views` — perf partenaire (déjà contourné par dérivation).

## Ordre d'exécution proposé
1. **Axe 1 (OXV Trace)** — zéro-schéma, valeur produit max, on commence ici.
2. Axe 4 (formalisation composants) — DRY pendant qu'on y est.
3. Axe 3 (OXV Moment) — si view-shot dispo.
4. Axe 2 (Skia) — après ton OK dépendance + au build de juillet.
5. Axe 5 (élévation + perf) — passes continues.
