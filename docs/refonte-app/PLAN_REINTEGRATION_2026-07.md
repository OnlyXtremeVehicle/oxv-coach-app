# Plan de réintégration Claude Design — 50 écrans (2026-07-06)

> Généré par le workflit d'analyse d'écart (design ↔ code réel). ⚠️ Les mentions « absent / à créer » peuvent être des faux négatifs (agents ayant résolu de mauvais chemins) — vérifier le .tsx réel avant de créer.

Voici la synthèse de réintégration.

# Synthèse de réintégration OXV — 50 écrans (design refonte ↔ code RN)

## File de réintégration priorisée

Triée par `priority` puis `effort`, groupée par vague. Ordre SPEC_BUILD (pilote → coach → partenaire → admin) appliqué à priorité égale.

### Vague 1 — Priorité 1 (impact structurant)

| Écran | Route .tsx | Arch | Chiffre roi (design→actuel) | Chrome-only ? | Skia ? | Effort | Écart |
|---|---|---|---|---|---|---|---|
| role__pilote (hub spéc, 10 écrans) | (aucune route — spéc dispersée) | A1–A6 | 73 → varie/écran | oui | non | S | Hub de spécification, pas de route à créer. Kit NG en place, doctrine respectée. |
| app__paddock | `app/(app)/index.tsx` | A6 | 73 (QDI composite) → stdDev régularité | oui | non | M | Chiffre-roi composite vs factuel + hero divergents. **Conflit QDI (connu).** États chargement/erreur manquants. |
| app__virage | `app/(app)/virage.tsx` | A1 | 118 km/h → aucun | non | **oui** | L | Refonte d'architecture : héros speed or, trace Skia, 3 phases collapsibles, 5 états. Lecteur plat actuel. |
| coach__direction | `app/(coach)/direction.tsx` (absent) | A4 | 78 → aucun | oui | non | L | **À créer.** Direction temps réel, leaderboard live, BROADCAST. Conflit QDI composite par pilote. |

### Vague 2 — Priorité 2 (cœur refonte)

| Écran | Route .tsx | Arch | Chiffre roi (design→actuel) | Chrome-only ? | Skia ? | Effort | Écart |
|---|---|---|---|---|---|---|---|
| app__bilan | `app/(app)/bilan.tsx` | A9 | spreadSeconds or → conforme | oui | non | M | Quasi conforme. Manque état hors-ligne. |
| app__data-lab | `app/(app)/data-lab.tsx` (absent) | A2 | aucun | non | **oui** | M | **À créer.** Index 7 vues (trace Skia). 4 états manquants. Conflit bandeau confiance 82 %. |
| app__tours | `app/(app)/tours.tsx` | A4 | 1:24.6 or → héros crème (pas or) | oui | non | M | Héros en crème au lieu d'or pur + glow ; états offline/erreur manquants. |
| app__progression | `app/(app)/progression.tsx` | A2 | 73 (QDI) → aucun | oui | non | M | KingNumber QDI absent, 5 vues data-color → 7 génériques, cockpit HUD manquant. **Conflit QDI.** |
| app__carte | `app/(app)/carte.tsx` | A1 | nom circuit (pas de KPI) → aucun | oui | non | L | Liste → carte gestuelle full-bleed + panneaux flottants + bottom sheet. |
| app__virage-comparer | `app/(app)/virage-comparer.tsx` | A6 | delta CORDE −3 km/h → aucun | non | **oui** | L | KingNumber delta or + SpeedTrace Skia superposée absents. |
| coach__home | `app/(coach)/index.tsx` | A5 | QDI 73–81 → nb pilotes | oui | non | M | Hub 3 onglets (À traiter/Pilotes/Outils), feed triage absente. **Conflit QDI.** |
| coach__pilotes | `app/(coach)/index.tsx` | A4 | QDI 73–81 → aucun | oui | non | M | Listing QDI or + tags état + filtres ; liste plate actuelle. |
| coach__pilote | `app/(coach)/pilote/[id].tsx` | A11 | 73 (QDI) → 73 (QDI) | oui | non | M | Réduire portée profil étendu → coach minimaliste, KingNumber+CockpitPanel+CoachBand. |
| coach__studio | `app/(coach)/studio.tsx` (absent) | A7 | 73 → aucun | oui | non | M | **À créer.** Cockpit data-viz SVG + QDI AUTO or. Manque CoachBand. |
| coach__triage | `app/(coach)/triage.tsx` (absent) | A3 | « 3 pertes majeures » → aucun | non | **oui** | L | **À créer.** Triage IA, carte animée Skia, Smart Flagging cloud. |
| coach__annoter | `app/(coach)/annoter.tsx` | A2 | aucun | oui | non | M | Manque bande rouge + serif (identité coach), sélecteur coins, mini-trace. |
| coach__comparer | `app/(coach)/comparer.tsx` | A3 | 73 (QDI) → aucun | oui | non | L | Delta hero QDI + 5 piliers MeterBar ; modèle données ne porte pas le QDI. **Conflit QDI.** |
| coach__priorites | `app/(coach)/priorites.tsx` | A1 | 1,2 s/tour → aucun | oui | non | M | KingNumber gain or, CockpitPanel, badge COACH, StateWrapper. |
| coach__reperes | `app/(coach)/reperes.tsx` | A6 | aucun | oui | non | M | FREINAGE bleu #60A5FA à corriger, champ `type` enum absent, états manquants. |
| coach__facturation | `app/(coach)/facturation.tsx` (absent) | A4 | 4 820 € → aucun | oui | non | M | **À créer.** CA mensuel or, bande déverrouillage, liste factures. |
| coach__calendrier | `app/(coach)/calendrier.tsx` (absent) | A2 | 31 → aucun | oui | non | M | **À créer.** Calendrier mensuel + liste séances + CTA. |
| coach__vitrine | `app/(app)/coach/[id].tsx` | A5 | 450 → aucun | oui | non | M | Migration Card→CockpitPanel/KingNumber, galerie, CTA sticky, 5 états. |

### Vague 3 — Priorité 3 (secondaires)

| Écran | Route .tsx | Arch | Chiffre roi (design→actuel) | Chrome-only ? | Skia ? | Effort | Écart |
|---|---|---|---|---|---|---|---|
| coach__plan | `app/(coach)/plan.tsx` (absent) | A11 | 76 → aucun | oui | non | S | **À créer.** Formulaire plan séance, cible QDI or, bande rouge. |
| admin__utilisateurs | `app/(admin)/utilisateurs.tsx` | A9 | aucun | oui | non | M | Palette bronze → canon (rôles or/rouge/bleu), status pills, badge ADMIN, 4 états. |
| admin__moderation | `app/(admin)/moderation.tsx` | A3 | badge ambre 4 → aucun | oui | non | M | 2 sections (candidatures+signalements), badge compteur ; états offline/erreur. |
| partenaire__offres | `app/(partner)/offres.tsx` | A1 | prix € → statut texte | oui | non | M | Prix = chiffre roi or Rajdhani, toggle switch statut, section comptage. |
| role__partenaire | `app/(partner)/index.tsx` | A10 | 7340 → aucun | oui | non | M | Hub linéaire → catalog grille glyphes + chiffres rois + face badges. |
| app__replay | `app/(app)/replay.tsx` | A3 | 60 → aucun | non | **oui** | L | POV 3D canvas Saintonge, throttle bar. UX HUD entièrement différente. |
| coach__file | `app/(coach)/file-lecture.tsx` | A9 | 3 → aucun | oui | non | M | Hero card « 3 séances à lire » + barre 40 % + coach band ; 2 états manquants. |
| coach__contexte | `app/(coach)/contexte.tsx` | A4 | aucun | oui | non | M | Sélecteurs pré-définis vs champs libres ; états via StateWrapper. |
| coach__suivi | `app/(coach)/suivi.tsx` (absent) | A4 | 3 valeurs égales → aucun | oui | non | M | **À créer.** Multi-cartes objectifs + sparklines. Conflit chiffre-roi multiple. |
| coach__debrief | `app/(coach)/debrief.tsx` (absent) | A2 | 118 → aucun | non | **oui** | M | **À créer.** POV telestration + timeline Skia. |
| coach__materiel | `app/(coach)/materiel.tsx` (absent) | A7 | aucun | oui | non | M | **À créer.** Assignations boîtiers + décharges. BatteryMeter/CheckboxPill à créer. |
| coach__crm | `app/(coach)/crm.tsx` (absent) | A6 | 73 → aucun | oui | non | M | **À créer.** Fiche CRM pilote, QDI or, notes privées, 5 états. |
| coach__rapport | `app/(coach)/rapport.tsx` (absent) | A2 | 73 → aucun | oui | non | M | **À créer.** Rapport PDF post-session, QDI roi, 5 piliers barres. Conflit QDI (à-valider). |
| coach__profil-edit | `app/(coach)/profil.tsx` | A5 | 85 % → aucun | oui | non | M | Chiffre roi complétude + StatusPill verte + tarif or + accroche serif. |

### Vague 4 — Priorité 4 (partenaire/admin étendus)

| Écran | Route .tsx | Arch | Chiffre roi (design→actuel) | Chrome-only ? | Skia ? | Effort | Écart |
|---|---|---|---|---|---|---|---|
| role__admin | `app/(admin)/…` hub (absent) | A1 | 5 → aucun | oui | non | S | **À créer.** Hub catalog admin, 2 KingNumber cyan. Conflit cyan à-valider. |
| role__coach | `app/(coach)/…` index galerie (absent) | A11 | 19 → aucun | oui | non | S | **À créer.** Index galerie 19 écrans coach. Conflit « 19 » en rouge marque. |
| partenaire__home | `app/(partner)/index.tsx` | A3 | 4 → aucun | oui | non | L | Legacy pilote → dashboard partenaire 3 KPIs, DEMANDES DE DEVIS absente, palette refonte. |
| partenaire__marketplace | `app/(partner)/marketplace.tsx` (absent) | A11 | aucun | oui | non | M | **À créer.** Marketplace sous-écrans partenaire. |
| partenaire__fiche | `app/(partner)/…fiche` (absent) | A5 | 4,9 → aucun | oui | non | M | **À créer.** Profil partenaire, note or, badges certif, offres. |
| partenaire__reservations | `app/(partner)/reservations.tsx` (absent) | A9 | aucun | oui | non | M | **À créer.** Liste réservations + timeline. Timeline custom à créer. |
| partenaire__evenements | `app/(partner)/evenements.tsx` (absent) | A2 | 14/20 → aucun | oui | non | M | **À créer.** Conflit data : champs currentPilots/maxPilots absents du modèle partenaire. |
| partenaire__devis | `app/(partner)/devis.tsx` (absent) | A6 | 560 → aucun | oui | non | M | **À créer.** Builder de devis, total roi or. Conflit bleu #5B8DEF hors canon. |
| partenaire__facturation | `app/(partner)/facturation.tsx` | A9 | 7 340 € → aucun | oui | non | M | Placeholder actuel → écran nominal CA or + 3 KPI + liste factures. |
| partenaire__stats | `app/(partner)/stats.tsx` (absent) | A2 | 18 % → aucun | oui | non | M | **À créer.** Funnel + top offres. Conflit chiffre-roi bleu #5B8DEF hors palette KingNumber. |
| partenaire__vitrine-edit | `app/(partner)/vitrine-edit.tsx` (absent) | A4 | aucun | oui | non | M | **À créer.** Formulaire édition vitrine + upload media + toggle public. |
| admin__home | `app/(admin)/index.tsx` | A7 | 128 k € → aucun | oui | non | L | Hub nav → dashboard temps réel GMV or + population + sparkline. Conflits couleur à-valider. |
| admin__revenus | `app/(admin)/revenus.tsx` (absent) | A2 | 19,2 k € → aucun | oui | non | M | **À créer.** Hero cyan (doit être or), répartition rôles, top contributeurs. |

---

## Kit NG encore à créer

Composants manquants, dédupliqués, avec le nombre d'écrans qui en dépendent (comptage sur les `kitNeeded` où le composant n'existe pas encore) :

| Composant | Écrans dépendants (approx.) | Notes |
|---|---|---|
| **StateWrapper** (5 états) | ~28 | Le plus transverse. Wrapper nominal/vide/chargement/hors-ligne/erreur. Priorité absolue. |
| **KingNumber** | ~30 | Chiffre roi or Rajdhani. Réutilisé quasi partout. Extension couleur requise (cyan admin, bleu stats). |
| **CockpitPanel** | ~16 | Cadre HUD à équerres, radius 6px. |
| **CoachBand** | ~11 | Bande rouge #C8102E + serif italique. Explicitement « à créer » (annoter, comparer, studio, priorites, direction, suivi, rapport, plan, facturation coach…). |
| **MeterBar** | ~9 | Barres comparatives / progress vers cible (piliers QDI, suivi). |
| **SpeedTrace** (Skia) | ~5 | virage, virage-comparer, studio, debrief. **Build-pending** (Skia hors Expo Go). |
| **StatusPill** | ~13 | Existe partiellement ; à généraliser (couleurs statut/rôle). |
| **RoleBadge / couleur rôle** | ~3 | pilote or / coach rouge / partenaire bleu (utilisateurs, admin__home, direction). |
| **Timeline (custom)** | 2 | reservations, debrief. |
| **BatteryMeter + CheckboxPill** | 1 | coach__materiel. |
| **Chip (filtres)** | 3 | marketplace, devis, pilotes. |
| **QdiRadar** | 2 | signature, coach__home (sparkline SVG). |
| **PoVCanvas / GGDiagram** (Skia) | 2 | replay, studio. |
| **Segmented / ConsentSwitchRow / MediaGrid / ImagePicker** | 1–2 | contexte, vitrine-edit. |

Ordre de fabrication conseillé : **StateWrapper → KingNumber → CockpitPanel → CoachBand → MeterBar → StatusPill/RoleBadge**, puis les composants Skia (SpeedTrace, PoVCanvas) en fin, une fois le build natif validé.

---

## Registre des conflits doctrine (à faire trancher par le fondateur)

### A. QDI composite / score global opaque (garde-fou T6) — **le plus lourd, transverse**
Le « QDI composite 73/100 » du Paddock est déjà connu ; le même conflit se répète et doit être tranché une fois pour toutes (QDI 5 branches OU régularité factuelle, jamais score agrégé unique) :

| Sévérité | Écran source | Détail |
|---|---|---|
| bloquant | app__paddock | QDI 73/100 composite vs régularité std-dev factuelle actuelle. |
| bloquant | app__signature | QDI composite + 5 piliers doivent rester branches indépendantes. |
| bloquant | app__progression | Chiffre roi QDI 73 exigé mais viole opacité composite. |
| bloquant | coach__comparer | Delta hero QDI 70→73 ; modèle données ne porte pas le QDI. |
| bloquant | coach__direction | QDI affiché en nombre unique par pilote (78, 73…). |
| à-valider | coach__home | QDI brut 73–81 sans 5 branches visibles. |
| à-valider | coach__rapport | QDI 73 acceptable **si** rapport pilote lecture seule, bloquant si métrique décisionnelle coach. |

### B. Palette / couleur de donnée (rouge, or, cyan, bleu)

| Sévérité | Écran source | Détail |
|---|---|---|
| bloquant | app__signature | Freinage en rouge #E63946 vs #C8102E marque — à clarifier (cf. décision fondateur 2026-07-04 : freinage = rouge de donnée #E63946). |
| bloquant | coach__reperes | FREINAGE en bleu #60A5FA au lieu du rouge de donnée #E63946. |
| bloquant | admin__utilisateurs | Bronze #B87333 hors canon ; rôles doivent être or/rouge/bleu. |
| bloquant | admin__revenus | Chiffre roi cyan #22D3EE au lieu d'or. |
| bloquant | partenaire__stats | Chiffre roi bleu #5B8DEF hors palette KingNumber (or/ambre seuls). |
| bloquant | role__coach | Chiffre « 19 » en rouge marque #C8102E au lieu d'or. |
| à-valider | app__paddock | QDI en or sans distinction donnée/marque (nature composite opaque). |
| à-valider | admin__home | GMV commercial en or (or réservé donnée pilote) ; coachs en rouge marque. |
| à-valider | admin__revenus | Barre % par rôle en rouge #C8102E (identity coach) sur donnée générique. |
| à-valider | coach__direction | Rang de position par chiffre or (or = donnée brute, pas comparaison). |
| à-valider | admin__moderation | Ambre #F2792B (trajectoire pilote) détourné en couleur de TAG modération. |
| à-valider | role__admin | Cyan #22D3EE sur méta-stats informatives (pas données perf). |
| à-valider | partenaire__fiche / devis | Bleu #5B8DEF hors canon (accent/bouton). |
| à-valider | app__carte | Typo Rajdhani design vs Geist/GeistMono système. |

### C. Structure / données / doctrine produit

| Sévérité | Écran source | Détail |
|---|---|---|
| bloquant | coach__home | Onglet « À traiter » (feed 6 actions) absent du code — pas de workflow triage. |
| bloquant | coach__pilote | Code = profil étendu (médias/carnet/empreinte) ; maquette = coach minimaliste. Réduire la portée. |
| bloquant | coach__triage | Smart Flagging cloudé (service backend + état sync) + carte Skia animée. |
| bloquant | app__virage | Chiffre roi or, trace Skia, 3 phases, 5 états tous absents (refonte archi). |
| bloquant | partenaire__home | DEMANDES DE DEVIS non implémentée ; structure sectionnée différente. |
| bloquant | partenaire__evenements | Champs currentPilots/maxPilots (14/20) absents du modèle partenaire (RLS admin-only). |
| à-valider | coach__suivi | 3 chiffres de poids égal violent Principe 5 (un seul dominant). Hiérarchiser. |
| à-valider | partenaire__evenements | Bouton « + Créer événement » (création admin/site only) — retirer ou adapter. |
| mineur | coach__suivi | Bande « à remettre en priorité » potentiellement prescriptive. |

### D. Skia / build-pending (non doctrinal mais bloquant technique)
`app__virage`, `app__virage-comparer`, `app__data-lab`, `app__replay`, `coach__triage`, `coach__debrief` — vues centrales en Skia (@shopify/react-native-skia) **ne tournent pas en Expo Go**, bloquées jusqu'au build natif.

---

## Écrans sans .tsx (à créer de zéro)

`exists=false` (24 écrans). Les hubs de spécification (role__*) ne sont pas de vraies routes.

**Vraies routes à créer :**
- **Pilote** : `app/(app)/data-lab.tsx`
- **Coach** : `crm`, `studio`, `triage`, `plan`, `suivi`, `debrief`, `direction`, `materiel`, `facturation`, `calendrier`, `rapport` (11 écrans)
- **Partenaire** : `marketplace`, `fiche`, `reservations`, `evenements`, `devis`, `stats`, `vitrine-edit` (7 écrans)
- **Admin** : `revenus` (`admin__home` et `admin__utilisateurs`/`moderation` existent déjà)

**Hubs de spécification (pas de route TSX dédiée) :** `role__pilote` (dispersé sur 10 fichiers existants), `role__coach` (galerie index), `role__admin` (hub selector), `coach__crm` (fiche). À traiter comme catalogues, pas comme écrans applicatifs.

---

## Recommandation de séquence — prochaine vague (6 écrans)

Critère : impact × faisabilité chrome-only, ordre SPEC_BUILD (pilote d'abord), et déblocage maximal du kit partagé. **On évite délibérément les 6 écrans Skia** (build-pending) tant que le build natif n'est pas validé.

**Pré-requis vague (à faire avant les écrans) :** construire **StateWrapper** puis **KingNumber** + **CockpitPanel**. Ces trois briques débloquent ~30 écrans et sont exigées par presque toute la file. C'est le vrai chemin critique.

1. **app__bilan** (`app/(app)/bilan.tsx`, M, chrome) — quasi conforme, il ne manque que l'état hors-ligne. Victoire rapide qui valide StateWrapper sur un écran pilote déjà bon. **Aucun conflit doctrine.**
2. **app__tours** (`app/(app)/tours.tsx`, M, chrome) — pilote, correction héros crème→or + glow + états offline/erreur. Faible risque, valide KingNumber en conditions réelles.
3. **app__progression** (`app/(app)/progression.tsx`, M, chrome) — pilote A2, intègre KingNumber (QDI) + CockpitPanel + 5 vues data-color. **Porte le conflit QDI** — à faire trancher par Gabin avant implémentation du chiffre-roi (QDI 5 branches vs régularité), mais le reste de l'écran avance.
4. **app__paddock** (`app/(app)/index.tsx`, M, chrome) — hub pilote, priorité 1. Même dépendance QDI que #3 : une fois la décision QDI prise, les deux écrans s'alignent d'un coup. Ajoute états chargement/erreur.
5. **coach__pilotes + coach__home** (`app/(coach)/index.tsx`, M, chrome) — passage au rôle coach dans l'ordre SPEC_BUILD. Même fichier, 3 onglets + listing QDI or + StateWrapper. Fait naître **CoachBand** (réutilisé par 11 écrans coach ensuite). Porte aussi le conflit QDI (cohérent avec décision de #3).
6. **coach__priorites** (`app/(coach)/priorites.tsx`, M, chrome) — workflow déjà en place, il ne manque que la présentation NG (KingNumber gain or + CockpitPanel + badge COACH + StateWrapper). Consolide tout le kit fraîchement construit sans conflit QDI. **Aucun conflit doctrine bloquant.**

**Justification d'ensemble :** cette vague (1) reste 100 % chrome-only donc testable en Expo Go, (2) construit dans l'ordre StateWrapper→KingNumber→CockpitPanel→CoachBand — soit les 4 briques les plus réutilisées, (3) respecte l'ordre pilote→coach, (4) concentre le **conflit QDI** sur 4 écrans consécutifs (progression, paddock, home, pilotes) pour une seule décision fondateur qui les débloque tous ensemble. Les écrans Skia (virage, virage-comparer, data-lab, replay, triage, debrief) et la vague partenaire/admin sont volontairement repoussés.

**Point de décision à obtenir de Gabin avant #3 :** trancher le QDI — 5 branches indépendantes exposées avec contexte **ou** conserver la régularité factuelle (std-dev) comme chiffre-roi. Cette décision conditionne 7 écrans.

---

## Registre brut des conflits doctrine (extrait machine, 50 écrans)

### app__paddock  ·  P1 · M
- **[bloquant]** QDI 73/100 (score composite opaque) en maquette viole guard-fou T6 — aucun jugement global unique. Code actuel contourne via régularité factuelle (std-dev). Refonte doit trancher : QDI 5-branches OU régularité.
- **[à-valider]** Maquette affiche QDI en or (#FFB703) sans distinction donnée/marque. Conforme à palette, mais la nature composite du QDI est opaque. Recommandation : garder régularité ou exposer le QDI en 5 piliers avec contexte.

### app__virage  ·  P1 · L
- **[bloquant]** Pas de chiffre roi dominant en or (#FFB703) - la maquette impose un héros « 118 km/h » central que le code actuel ignore complètement
- **[bloquant]** Absence totale du profil de vitesse (speed trace Skia) — élément clé de l'archétype A1 deep-dive
- **[bloquant]** Manque les 3 phases collapsibles (freinage/corde/réaccél) avec couleurs données et glow — le code ne montre que des vitesses brutes
- **[bloquant]** Pas de gestion d'états (nominal/vide/chargement/hors-ligne/erreur) — le code affiche tout ou rien
- **[à-valider]** GForceBars présent mais non aligné avec la structure de maquette (qui place speed trace avant les forces)

### coach__direction  ·  P1 · L
- **[bloquant]** QDI affiché comme chiffre unique par pilote (78, 73, 71…) — viole le garde-fou T6 : le QDI doit vivre en 5 branches, jamais comme score composite opaque
- **[à-valider]** Rang inter-pilotes visible côté coach (pos 1,2,3…) — bon ; mais maquette montre rang de position par chiffre OR (#FFB703) qui est censé être donnée brute, pas comparaison

### app__signature — Signature de pilotage  ·  P2 · L
- **[bloquant]** Composite score QDI 73/100 violates guard-rail T6 : no opaque global judgment score allowed. The 5 pillars must remain independent branches, never aggregated. Design must be corrected to remove composite metric.
- **[à-valider]** Freinage uses red #E63946 in design but doctrine reserves red #C8102E for brand/coach-band only. Braking should use trajectory amber #F2792B or a distinct data-color. Design color incorrect.

### app__data-lab  ·  P2 · M
- **[à-valider]** Metrique de confiance 82% avec barre : peut induire jugement composite opaque sur qualite globale—contraire garde-fou T6. A valider si c'est metrique systeme seulement.
- **[bloquant]** Vue unifiee Skia (TRACE + VITESSE + MARGES) : multi-couches ne tournent PAS en Expo Go. Bloquee en build-pending jusqu'a release native.

### app__carte  ·  P2 · L
- **[à-valider]** Design uses Rajdhani for title 'CIRCUIT' and layer labels, but theme/v2 declares all text as Geist/GeistMono — typo mismatch between design and current system
- **[à-valider]** Design shows 'CIRCUIT' in uppercase 15px Rajdhani 700 centered in AppBar; current AppBar uses display font (Geist 600) at h3 size — different visual hierarchy

### app__virage-comparer  ·  P2 · L
- **[bloquant]** KingNumber absent — delta CORDE doit être le chiffre roi or 40px Rajdhani, actuellement en texte neutral dans DeltaRow
- **[bloquant]** SpeedTrace Skia (traces superposées vitesse) n'existe pas et n'est pas importée — la data-viz centrale de la maquette est absente
- **[à-valider]** Layout colonnes : maquette montre CETTE SÉANCE | RECORD DE SOI symétriques avec stats côte à côte ; code utilise MiniCard (cartes avec CircuitMap zoomée), structure différente

### app__tours  ·  P2 · M
- **[à-valider]** Chiffre roi #FFB703 en couleur mais héros HUD en crème actuellement — design demande or domaine seul ; actualiser heroNumber style color:gold avec textShadow or approprié
- **[à-valider]** LapRow affiche delta en crème neutre (simple) ou détails téchniques (mode détaillé) — design ne montre pas détail mode sur mockup : vérifier si simple-only ou toggle respecte le canon

### app__progression  ·  P2 · M
- **[bloquant]** Chiffre roi QDI (73) manquant — le code n'expose aucun KingNumber ni libellé de chiffre dominant. La maquette est explicite : grand 73 or avec « QDI · 8 DERNIÈRES SÉANCES ».
- **[bloquant]** Architecture des vues détaillées : la maquette en affiche 5 avec couleurs de donnée distinctes (violet, vert, or, gris) + icône carrée avec glow ; le code en expose 7 génériques sans couleurs de pilier.
- **[à-valider]** CockpitPanel absent du panneau hero trend — la maquette le place dans un cockpit aux équerres ; le code utilise une Card standard. Le radius hud (6px) n'est pas appliqué.
- **[à-valider]** Segmented control (week/month/all) absent de la maquette — le code ajoute un filtre temporel non visible en refonte.

### coach__home  ·  P2 · M
- **[à-valider]** QDI affiché brut (73, 78, 69) sans 5 branches visibles = risque garde-fou T6 (composite opaque). Clarifier si raccourci ou faux signal.
- **[bloquant]** Onglet À traiter montre feed avec 6 actions (à lire, plan, décharge, facture, suivi) — pas présent dans code. Code n'a pas de workflow feed/triage.
- **[à-valider]** Montant à encaisser (500 €) utilise or #FFB703 correctement mais nécessite un lien vers coach__facturation → dépendance non gérée

### coach__pilotes  ·  P2 · M
- **[bloquant]** Chiffre roi QDI absent du code : maquette affiche 73-81 or par pilote, code n'affiche rien
- **[à-valider]** Indicateur statut (dot rouge/vert/gris) absent : maquette visualise l'état du pilote, code plat
- **[à-valider]** Tags (À LIRE/ANNOTÉ/INACTIF) absents : maquette affiche pastille colorée mono, code sans

### coach__pilote  ·  P2 · M
- **[bloquant]** Code offre un profil pilote étendu (niveau, véhicule, liens réseau) + carnet partagé + empreinte + priorités — la maquette refonte n'en veut pas. Écart: focalisation coach vs. richesse délocalisée.
- **[bloquant]** Bande coach (CoachBand) n'est pas intégrée. La maquette montre « NOTE DU COACH » avec libellé rouge, initiales du coach, marqueur « BROUILLON ». Le code manque cette zone entièrement.
- **[à-valider]** QDI ne passe pas par KingNumber — affichée en texte brut. Pas de CockpitPanel (équerres HUD). Miroir neutre doit être encadré.
- **[à-valider]** Aucun wrapper StateWrapper autour du contenu — états (chargement/offline/erreur) ne sont gérés que par des conditions ad-hoc (loading, sessions.length === 0).

### coach__triage  ·  P2 · L
- **[bloquant]** Maquette affiche '3 pertes majeures identifiées' (texte qualificatif Instrument Serif) comme KingNumber — devrait être un Rajdhani or ou nécessiter une reformulation chiffre-centric (ex. '3' avec label 'PERTES DÉTECTÉES')
- **[bloquant]** Carte circuit = SVG réactif avec tracking de souris / animation en temps réel (oxvscan 2.6s infini) — nécessite Skia (@shopify/react-native-skia) pour interpolation fluide non disponible en Expo Go
- **[à-valider]** Flags rangées par perte (0,5 s > 0,4 s > 0,3 s) = tri inter-pilote implicite — self-only côté coach est OK, mais le titre 'SMART FLAGGING HAUTE SAINTONGE' sous-entend un algo cloudé (prévoir service backend + état de sync)

### coach__annoter  ·  P2 · M
- **[à-valider]** Éditeur de note: code utilise Field générique (Geist body crème) vs maquette serif italique #F2D9DD + bande rouge #C8102E — affaiblit l'identité visuelle « parole du coach »
- **[à-valider]** Sélecteur de coins non implémenté: maquette montre 7 boutons (1,4,6,7,9,12,14) avec state rouge marque, code n'a pas d'UI pour changer de coin pendant l'édition

### coach__comparer  ·  P2 · L
- **[bloquant]** Maquette affiche QDI composite 73 comme chiffre roi de B ; le code actuel affiche des MARGES % par session sans delta hero oro. QDI aux 5 piliers canonique manque.
- **[bloquant]** La maquette montre une « bande coach » (fond #12080a + filet #C8102E33 + accent rouge left) avec texte Instrument Serif italic — ce composant CoachBand n'existe pas en kit.
- **[bloquant]** Code actuel utilise delta.marginGlobal (%) ; la maquette veut QDI par session (chiffre roi 70/73 + delta +3). Le modèle de données SessionSnapshot ne porte pas le QDI.
- **[bloquant]** Les 5 piliers (Trajectoire/Fluidité/Freinage/Accélération/Régularité) sont affichés avec BARRES COMPARATIVES (aW/bW en %), composant MeterBar à créer. Code actuel montre des row delta virages à la place.

### coach__priorites  ·  P2 · M
- **[bloquant]** King number absent : le gain estimé (1,2 s/tour) doit être rendu via <KingNumber value='1,2' unit='s / tour' label='GAIN ESTIMÉ' tone='gold' /> avec glow discret de donnée, pas du texte brut
- **[bloquant]** CoachBand manquant : le badge rouge 'COACH' en haut-droit doit être un composant dédié avec border #C8102E 1px, padding 2px 6px, radius 3px, color #C8102E, bg transparent
- **[bloquant]** CockpitPanel absent : la carte de gain (1,2 s/tour) doit être wrapped dans <CockpitPanel /> avec rayon HUD 6px et filet edge #rgba(255,255,255,0.20)
- **[à-valider]** StateWrapper non intégrée : écran ne gère que nominal/loading, manquent empty/offline/error selon SPEC_BUILD §5
- **[à-valider]** Couleur gold non-thématisée : le gain et les rangs prioritaires top doivent utiliser theme.palette.gold et theme.dataColors.flow, pas couleurs inline

### coach__reperes  ·  P2 · M
- **[bloquant]** Couleurs de type repère (FREINAGE #60A5FA bleu, CORDE #F2792B ambre, RÉACCÉL #4ADE80 vert, TRAJECT. #F2792B ambre) ne correspondent pas au dataColors du kit (brake:#E63946 rouge, accel:#4ADE80 vert, trajectory:#F2792B ambre). FREINAGE devrait être #E63946 (rouge de donnée), non #60A5FA. Maquette uti
- **[à-valider]** Label « COACH » dans le coin droit du header rouge vif (#C8102E bordure+texte) : cet insigne rouge de marque sur du texte/label peut confondre avec une alerte. À clarifier si c'est un badge de rôle ou une simple étiquette — la doctrine dit rouge marque pour REC/bande coach seulement, pas pour des ét
- **[bloquant]** Typage des catégories « type » du repère : maquette énumère FREINAGE/CORDE/RÉACCÉL/TRAJECT., mais le code (summarizeReference) n'expose que braking/speed/trajectory notes — pas d'enum TYPE. La maquette attendrait un champ type:string avec couleur associée, le code ne le supporte pas.
- **[à-valider]** Absence d'état vide : code gère seulement loading/nominal, maquette n'indique aucun repère. Code doit avoir un état « aucun repère » distinct de l'état nominal rempli. 5 états obligatoires (nominal/vide/chargement/hors-ligne/erreur) — seuls loading et nominal sont présents.

### coach__suivi  ·  P3 · M
- **[bloquant]** Chiffre roi multiple : 3 valeurs d'égale importance (Freinage, Vitesse, Régularité) viole Principe 5 (un seul dominant par écran). Faut hiérarchiser : ex. % atteint comme roi, sparklines comme support
- **[à-valider]** Absence de gestion d'états (5 requis : nominal/vide/chargement/offline/erreur). Maquette statique ne démontre que cas nominal

### coach__rapport  ·  P3 · M
- **[à-valider]** QDI composite 73/100 en chiffre roi peut violer garde-fou T6 (score composite opaque) — la doctrine spécifie 'le QDI vit en 5 branches' et rejette les jugements globaux. À confirmer : si ce rapport est généré pour le PILOTE (lecture seule), c'est acceptable ; si c'est une métrique décisionnelle coac

### coach__profil-edit  ·  P3 · M
- **[bloquant]** Pas de calcul ni affichage du chiffre roi (85% complétude)
- **[bloquant]** Pas de StatusPill verte avec complétude pour l'état publication
- **[à-valider]** États obligatoires incomplètement gérés (offline/empty/error manquants)

### partenaire__home  ·  P3 · L
- **[bloquant]** Chiffre roi absent — maquette affiche 3 KPIs dominants (CA, FICHE VUE, NOTE) dont 2 en or ; code utilise 3 Fact génériques sans hiérarchie
- **[bloquant]** Structure sectionnée différente : maquette = KPIs d'abord, puis DEMANDES DE DEVIS, puis GÉRER MON ESPACE ; code = titre, Fact, cartes nav + événements
- **[bloquant]** DEMANDES DE DEVIS (4 quotes list) absent du code — feature non implémentée
- **[bloquant]** Palette couleurs maquette : gold #FFB703 (CA/NOTE), blue #5B8DEF (tags), ambre #F2792B (wait) ; code = cream/creamMute/green (typage thème legacy non-refonte)
- **[à-valider]** Typos : maquette = Rajdhani/JetBrains Mono/Instrument Serif (refonte) ; code = display/body/mono (legacy v2)

### partenaire__offres  ·  P3 · M
- **[bloquant]** Prix actuellement en creamMute (gris) au lieu d'or #FFB703 — viole règle or=DONNÉE uniquement
- **[bloquant]** Pas de Rajdhani 700 sur le prix (utilise bodyMedium Geist) — doit être king/Rajdhani
- **[à-valider]** Statut affiché en énumération textuelle au lieu de toggle switch visuel (actif/masqué avec knob) — dévie du design de reference

### admin__utilisateurs  ·  P3 · M
- **[bloquant]** Code utilise BRONZE #B87333 pour eyebrow et role label — non aligné palette v2. Canon: eyebrow=#6E6E76 (gris), or=#FFB703 (donnée seule). Rôles doivent avoir couleurs distinctes (pilote or, coach rouge #C8102E, partenaire bleu #5B8DEF).
- **[bloquant]** Maquette affiche couleur rôle (pilote/coach/partenaire) dans le petit square à côté du nom — code n'implémente pas. Design montre: pilote or #FFB703, coach rouge #C8102E, partenaire bleu #5B8DEF.
- **[bloquant]** Status pills avec couleurs (vert #97C459 actif, ambre #F2792B à valider, rouge #C8102E signalé) — code manque l'implémentation visuelle distincte du statut.

### admin__moderation  ·  P3 · M
- **[à-valider]** Surcharge sémantique #F2792B : l'ambre (trajectoire pilote) sert ici de couleur de TAG/ÉTAT modération au lieu de rouge de donnée #E63946 ou neutre. Heurte le canon couleur pilote.
- **[à-valider]** Pas de section candidatures coach en code actuel ; deux types de contenu doivent coexister (candidatures + signalements) mais le code ne les distingue pas.

### partenaire__fiche  ·  P4 · M
- **[à-valider]** Badges iconiques (CERTIFIÉ OXV, RÉPOND EN 2H, GARANTIE 12 MOIS) : les icônes SVG ne sont pas tokenisés — faudra les implémenter comme composant <Badge> ou réutiliser StatusPill variant

### partenaire__evenements  ·  P4 · M
- **[bloquant]** Maquette affiche currentPilots/maxPilots (14/20) ; PassEvent partenaire ne contient pas ces champs — query RLS admin-only. Adapter à une métrique partenaire (statut événement, revenu attendu, nombre places) ou enrichir RLS.
- **[à-valider]** Bouton '+ Créer un événement' en maquette ; partenaire ne crée pas d'événements (création admin/site only). À retirer ou adapter en lien vers marketplace/catalogue.
- **[à-valider]** Tags ambre (BROUILLON) et vert (PUBLIÉ) = statuts admin. Partenaire a statuts différents : invited/confirmed/declined. Décider du mapping visuel partenaire.

### partenaire__devis  ·  P4 · M
- **[à-valider]** Badge couleur non définie (5B8DEF bleu) — dépasse la palette canonique ; utiliser gold #FFB703 ou secondary #C9C9CE
- **[à-valider]** Bouton primaire bleu #5B8DEF n'existe pas en theme.v2.ts — confirmer avec tokens ou créer StatusPill

### partenaire__stats  ·  P4 · M
- **[bloquant]** Couleur du chiffre roi : maquette utilise #5B8DEF (bleu) ; KingNumber supporte uniquement gold/amber. Exige extension ou wrapper.
- **[à-valider]** 5 états obligatoires (nominal/vide/chargement/hors-ligne/erreur) absents de la maquette design — à implémenter en code.

### admin__home  ·  P4 · L
- **[à-valider]** Maquette affiche GMV commercial (128k €) en OR dominant — or est réservé à la DONNÉE pilote. Admin dashboard doit-il vraiment montrer commerce en héros?
- **[à-valider]** Population cards colorcoded (pilotes #FFB703 OR, coachs #C8102E ROUGE marque, partenaires #5B8DEF) — le rouge marque ne doit jamais être donnée. Les coachs doivent-ils être distingués par une autre teinte de rôle?

### admin__revenus  ·  P4 · M
- **[bloquant]** KingNumber #22D3EE est cyan (signature), non or #FFB703 — mandate or uniquement pour chiffre roi
- **[à-valider]** Barre % par rôle : rouge #C8102E (identity coach) ne doit pas dénoter une donnée générique — doctrine : rouge marque seulement, couleurs de données différentes
- **[à-valider]** Absence d'états obligatoires (vide/chargement/hors-ligne/erreur) — à implémenter via StateWrapper

### role__coach  ·  P4 · S
- **[bloquant]** Chiffre roi '19' affiché en rouge marque #C8102E au lieu d'or #FFB703 pour une donnée quantitative. Le rouge doit rester pour REC/insigne/bande coach seulement.

### role__admin  ·  P4 · S
- **[à-valider]** Cyan #22D3EE utilisé pour les chiffres « 5 ÉCRANS » et « 3 RÔLES SUPERVISÉS » — cyan est réservé à l'administration dans les données, mais ici ce sont des méta-stats purement informatives (pas des données de performance). À valider : doit-on utiliser crème neutre à la place ?
- **[à-valider]** Badge archétype droit (A1, HUB, A9, A11, A3) — dans la maquette ces badges sont en teinte grise crème, mais la doc dit qu'ils doivent être identifiés par couleur. À confirmer si le role__admin (as a hub) doit avoir une couleur distinctive.
