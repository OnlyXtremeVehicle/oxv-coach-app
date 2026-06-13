# Réconciliation — Repo OXV Mirror ↔ Bundle de specs raffiné (14 blocs)

> Document produit le **2026-06-13** par Claude Code, après ingestion du bundle
> `oxv-mirror-specs (2).zip` (désormais versionné dans `docs/specs-bundle-v2/`).
> Méthode : 19 audits parallèles spec↔code + synthèse + critique adversariale, recoupés
> par vérification directe du code. Le bundle (`docs/specs-bundle-v2/00_CLAUDE.md`) est
> le **contrat qui fait foi** ; ce rapport mesure l'écart de l'implémentation existante.
>
> **Le `CLAUDE.md` racine du repo est désormais périmé** vis-à-vis de ce contrat (il
> décrit 26 écrans / WatermelonDB / Zustand / QDI). Sa mise à jour relève d'une
> validation Gabin (changement de doc doctrinal) — non effectuée ici.

---

## 1. Verdict global

Alignement estimé : **~65 % du nouveau contrat est déjà satisfait.** La **doctrine**, les
**fondations techniques** (chaîne BLE/UBX, client Supabase unique, assainissement V1
GARDER/JETER) et **5/8 écrans du cœur** (bloc 20) sont en place et conformes.

L'écart est surtout de **couverture** (blocs entiers non bâtis : 50, 70, 80, 90, E0) et de
**factorisation** (grammaire `TrackStage`/`CoachBand` + bibliothèque de composants nommés
non formalisée). **À deux exceptions près qui touchent le cœur doctrinal/juridique** : un
conseil de pilotage qui atteint le pilote, et le droit à l'effacement RGPD non déclenchable.

---

## 2. Ce que le bundle confirme (déjà fait, avec preuves)

**Doctrine miroir — très bien défendue**
- Scanner de verbes interdits en CI : `scripts/check-doctrine.ts` (24 patterns) + `.github/workflows/check.yml`.
- Garde-fou déterministe sur le debrief IA (scan sortie GPT + retry + refus 422 → fallback local) : `supabase/functions/generate-debrief-ai/index.ts`, `src/services/debriefGenerator.ts` (+ test).
- Aucun score/note/classement côté pilote ; QDI retiré (migration `0007_drop_qdi_scores`). Comparaison sociale recadrée « entre copains, sans classement » : `app/(app)/cote-a-cote/[friendId].tsx`, migration `0027`.

**Stack & chaîne data**
- Client Supabase **unique typé** (les 2 clients V1 fusionnés) : `src/lib/supabase.ts` (`createClient<Database>`, ExpoSecureStore). L'ancien `src/supabase/client.ts` n'existe plus.
- Projet `fouvuqkdxarjpjbqnsjq` / Frankfurt (`supabase/config.toml`), URL via env. Météo Open-Meteo conservée (`src/services/weatherService.ts`).

**Héritage V1 (Section 6) — quasi intégralement traité**
- GARDÉ intact : parser UBX (`src/ubx/parser.ts`), service BLE + reconnexion (`src/ble/bluetoothService.ts`, `initBle.ts`), types télémétrie, géo + détection tours cooldown (`src/utils/lapDetection.ts`).
- JETÉ : QDI (0007), arbo onglets V1 (`app/(app)/_layout.tsx` = Stack, plus d'écran « live »), prefs notif legacy `rank_change/new_record/new_follower`.

**Cœur de restitution (bloc 20) — 5/8 écrans substantiels et doctrine-clean**
- 20.1 Synthèse `app/(app)/bilan.tsx` · 20.3 Régularité `app/(app)/regularite.tsx` · 20.5 Heatmap `app/(app)/heatmap.tsx` · 20.2 Signature `app/(app)/signature.tsx` · 20.4 Évolution `app/(app)/progression.tsx`.

**Coach (C0) — richement implémenté** : rôle + RLS `is_coach_of` + consentement révocable, annotations/repères/contexte attribués, dashboard business gaté (migrations 0020, 0032, 0034-0040).

**États limites (B0.2)** : EmptyStates soignés sur chaque écran data. **Social/carte (D0 partiel)** : carte native + annuaire circuits, réservés membres validés (RLS `is_validated_member`, migrations 0033/0036).

---

## 3. Vrais deltas (à bâtir ou compléter)

| # | Delta | État actuel | Écart | Effort |
|---|---|---|---|---|
| D1 | **TrackStage formalisé** (conteneur maître, 4 modes faisceau/replay/a_vs_b/heatmap) | Brique ad hoc `CircuitMap` + `PilotPreset` + `LapScrubber` (heatmap + replay partiel) | Pas de conteneur nommé ; modes `faisceau` et `a_vs_b` absents | **L** |
| D2 | **CoachBand normé** (badge PAROLE COACH, avatar+nom+rôle, ancrage, bordure `oxv-gold`) | Cartes coach attribuées « en esprit » (`bilan.tsx`, `virage.tsx`, accent bleu nuit) | Pas de composant réutilisable ; pas de nom du coach ; pas de badge/ancrage ; couleur ≠ `oxv-gold` | **M** |
| D3 | **Bibliothèque de composants nommés** (MetricHero, FactRow, ComparisonPair, TimelineEvolution, PactBanner, ConsentGate, SessionCard, DataChart) | Patterns implémentés inline par écran (intention OK, dupliquée) | Aucun composant partagé nommé (grep = 0) | **M** |
| D4 | **Bloc E0 — AR coach via WebView `ar-view`** (E0.1 config + E0.2 in-lens, realtime, flag preview) | Totalement absent | Aucune route/dépendance/realtime/flag — voir conflit C-3 | **L** (non publiable avant GA Meta) |
| D5 | **Idiome HUD (30.3)** : Cap/Trajectoire/Anticipation/Visée/Plongée en mesures factuelles | Absent | Signature conceptuelle du produit non rendue | **M** |
| D6 | **Insights spatiaux profonds (30.5)** : dispersion faisceau (3.1), tour composé (3.2), cohérence flow jerk×lap (4.1) | Seule la heatmap (profondeur 1-2) ; jerk = TODO `analysis.ts:85` | Les 3 insights différenciants absents | **L** |
| D7 | **Pricing SaaS coach 750 €/saison + gate abonnement (C0.2)** | Aucune logique paiement ; migration note « D1 — Free » | Modèle économique fondateur non matérialisé — voir décision | **M** |
| D8 | **Bloc 50 traces perso** (création, privé par défaut, « Proposer à OXV ») | `circuits.tsx` = annuaire écosystème (bloc 13), pas le bloc 50 | Création + gouvernance privé/validation OXV absentes | **L** |
| D9 | **Bloc 70 identité** (avatar driver, carte/licence partageable, empreinte de saison) | `stats.tsx`/`progression.tsx` couvrent partiellement les « faits » | Aucun objet identitaire ; pas d'export image | **M** |
| D10 | **Bloc 80 garage** (CRUD véhicules, fiche×données, comparaison) | Table `vehicles` existe ; `vehicle_id` toujours `null` à la capture (`debug-capture.tsx:156`) | 3 écrans absents — la décision 2026-06-07 nomme pourtant le garage « in-scope natif » | **L** |
| D11 | **Bloc 90 features neuves** (journal de bord, conditions&ressenti, carnet/passeport, export+suppression) | Export/suppression = libellés « Bientôt » non câblés | 4 écrans absents ; ressenti pilote inexistant | **M** |
| D12 | **Charte officielle du `:root` du site** (#FFB703 Or UI, #E63946 rouge UI, 5 couleurs piliers, Syncopate/JetBrains Mono) | `tokens.ts` suit `docs/screens/01_DESIGN_TOKENS.md` (#C8102E, #C4A459, Menlo) | **Le code diverge de la charte mandatée** — voir conflit C-5 (corrigé) | **M** |
| D13 | **Onboarding 3 écrans** (Splash/Pacte/Appairage) + corps juridique du pacte + placeholder avocat | 6 écrans (ancienne maquette) ; pacte = 2 phrases + case, sans corps légal | Pièce juridique du pacte non affichée ; appairage hors onboarding | **M** |

> Fiabilité : sur D1/D3 l'écart est d'architecture, pas d'intention. Sur la survie multi-version (40.3), preuve mince : `algo_version` écrit en dur `'v1.0'` (`analysesService.ts:124`) mais jamais relu — mono-version aujourd'hui.

---

## 4. Conflits à arbitrer (triés par sévérité — corrigés après critique adversariale)

### BLOQUANT
- **B-1 — Droit à l'effacement RGPD non déclenchable (A0.2).** `settings.tsx` affiche « Supprimer mon compte » inerte (« Bientôt ») ; la RLS `users_delete_admin_only` (migration `20260530111333`, L282-284) réserve le DELETE à `is_admin()`. **Le pilote ne peut pas supprimer son compte.** FK en `ON DELETE CASCADE` mais aucun chemin pilote ne les déclenche. *Vérifié.* Risque juridique réel avant soumission store.

### MAJEUR (doctrine / juridique)
- **C-1 — Conseil de pilotage atteignant le pilote (`focusCorner` / « La prochaine fois »).** `src/services/focusCorner.ts:116,119` renvoie, côté pilote **sans coach**, « …peut-être un repère de freinage un peu plus tôt ? » et « …un peu plus de patience à la corde ? », rendus dans `app/(app)/prochaine-fois.tsx:77`. *Vérifié directement.* Ce sont des **causes corrigibles orientées**, interdites hors `CoachBand` (Pattern 4). **Reformuler en question n'y change rien** (contrat `00_CLAUDE.md:55`, `01:48-49`, garde-fou `02:112-117`). Le scanner CI **ne capte pas** ces formulations (regex lexicale sur « freinez », pas « repère de freinage »). **Cœur doctrinal + défense juridique d'OXV.** Le correctif doit **supprimer** la suggestion de geste, pas l'adoucir.
- **C-1bis — Le garde-fou runtime du debrief IA a le même angle mort.** Les `FORBIDDEN_PATTERNS` de `generate-debrief-ai/index.ts:46-65` sont aussi purement lexicaux (verbes) : une sortie IA en groupe nominal (« un repère de freinage un peu plus tôt ») passerait. À étendre en même temps que C-1.
- **C-2 — Fausse donnée présentée comme réelle.** `app/(app)/carte.tsx:78` : `liveMargins ?? mockCornerMargins(...)` → zones rouge/jaune/vert pseudo-aléatoires (`circuitTopology.ts:121-131`), rendues sans label « démo ». **Idem `prochaine-fois.tsx:33`** (seed `mockCornerMargins`, 2ᵉ instance — pire, car elle porte aussi le conseil C-1). Comme `telemetry_frames` est **vide jusqu'à la 1ʳᵉ capture**, c'est le **chemin dominant aujourd'hui** → viole B0.2 « jamais de fausse donnée présentée comme réelle ».
- **C-2bis — Le chiffre central de l'app est colorié en rouge-jugement (20.1).** `app/(app)/bilan.tsx:208-216` colorie le `MetricHero` de marge via `colorForZone()` → `colors.margin.red` (#C8102E) en zone rouge. Or `01:69` impose : valeur du `MetricHero` = donnée (`bleu_data`), **jamais de rouge alerte qui jugerait**. C'est **le chiffre le plus visible de l'app**, rendu comme un verdict. *Signalé par la critique adversariale, à traiter comme conflit doctrine.*
- **C-8 — `BleErrorModal` peut s'afficher en roulage.** Monté global (`_layout.tsx`), déclenché par timeout 30 s (`initBle.ts`) sans garde `state === 'S6_roulage'`, alors que la state machine encode `VALID_SCREENS_BY_STATE.S6_roulage = []`. Viole le Principe 3 (silence en piste). Déjà signalé en question ouverte (sem. 7).
- **C-6 — Relation coach inversée (C0.1).** Spec **et `CLAUDE.md` du repo** : le pilote **invite** son coach. Code : OXV/admin **assigne** (`coach_pilots_admin_all`, `send-coach-invitation`). Rapproche OXV de la prestation de coaching qu'elle doit décliner.
- **C-7 — Debrief coach sans nom du coach (C0.5).** Attribution générique « VOTRE COACH » au lieu de « Debrief de [nom] » → affaiblit la traçabilité auteur-coach (point juridique).

### À ARBITRER (plan / dépendance / archi)
- **C-3 — WebView AR (E0) vs décision « tout natif » (2026-06-07).** `AUDIT_OXV_MIRROR.md:104-105` enregistre « tout natif, pas de WebView » — mais le contexte vise **« garage / documents / progression »** (livraison de contenu), **pas** l'AR coach. La spec E0 retient la WebView `ar-view` (hébergée côté site) comme seul moyen viable. **À réconcilier explicitement.**
- **C-4 — Calcul des indicateurs in-app au lieu de Supabase (§4/§7-2).** Le chemin de prod calcule marge + 14 segments + debrief en local (`analyzeSessionService`, `marginCalculator`, `trackviz/analysis`) ; l'edge function cron n'est qu'un fallback minimal qui **duplique la formule de marge**. Choix tracé (rapports sem 13/14) mais **dérive vs le contrat non validée explicitement par Gabin**. *Note : la convergence des deux formules n'a pas été prouvée — risque de divergence asserté, non démontré.*
- **C-5 — Charte couleurs : le code diverge de la charte mandatée.** ⚠️ **Correction par rapport à la synthèse initiale** : le contrat (`00_CLAUDE.md` §3) est **sans ambiguïté** — il déclare #FFB703 / #E63946 / les 5 couleurs piliers / Syncopate / JetBrains Mono comme « valeurs qui font foi » et « intouchables ». Le seul document qui les conteste (`docs/architecture/07_CODE_V1_RECUPERE.md`) **n'est pas dans le contrat** : c'est un doc repo. Il n'y a donc **pas de contradiction de specs** : `tokens.ts` (#C8102E, #C4A459, Menlo) **ne suit simplement pas la charte mandatée**. La décision n'est pas « quel document gagne » mais « **quand** aligner ».

### MINEUR / À NOTER
- **N-1 — Lieu de la 1ʳᵉ capture : divergence réelle contrat ↔ planning repo.** ⚠️ **Correction** : le **contrat** dit **Valence (Espagne), juillet 2026** (`00_CLAUDE.md:190`, `02:146`). « Bouteville, 5 juillet 2026 » n'apparaît que dans `roadmap/AUDIT` et les rapports. C'est une **vraie divergence à trancher**, pas une erreur d'audit. (Enjeu opérationnel faible, mais le contrat doit primer.)
- **N-2 — Géométrie du tracé dessinée à la main** (`HAUTE_SAINTONGE_TRACK`, polyline OSM figée) vs règle TrackStage « dérivée des frames GNSS ». Acceptable en fallback tant que `telemetry_frames` est vide ; dette à lever après la 1ʳᵉ capture.
- **N-3 — Marque résiduelle « Coach »** : header `X-Client-Info: oxv-coach-mobile`, id MMKV `oxv-coach-cache`. Cosmétique.

---

## 5. Points doctrine sensibles (conformité miroir la plus fragile)

1. **`focusCorner` / « La prochaine fois » (C-1)** — seul contenu actionnable de pilotage qui atteint réellement le pilote. **Priorité doctrinale n°1**, invisible à la CI.
2. **Mocks présentés comme réels (C-2 / C-2bis)** — fausse donnée + chiffre central rouge-jugement, dans l'état dominant aujourd'hui. Touche aussi l'exactitude (responsabilité technique d'OXV).
3. **30.3 idiome HUD** (quand implémenté) — risque de glisser de « descripteur de fait » vers « consigne ». Mapping donnée→notion factuel uniquement ; ne jamais nommer le faucon.
4. **30.5 insights profondeur 4** (dispersion, cohérence du flow) — « afficher du nouveau sans coacher » : chaque insight reste un constat spatial, cause orientée → `CoachBand` uniquement.
5. **`CoachBand` non normé (D2/C-7)** — l'attribution explicite (nom + badge + séparation visuelle) préserve le non-agrément juridique d'OXV.
6. **Scanners lexicaux (CI + runtime IA)** — ne détectent pas un conseil reformulé en groupe nominal/question. À étendre.

---

## 6. Recommandation de séquence

Respecte « pas de refacto spéculatif » et les frontières d'autonomie (doctrine/dépendances/plan = validation Gabin).

**Étape 1 — Correctifs doctrine/sécurité avant alpha (faible effort, fort impact)**
1. **C-1 + C-1bis** : supprimer les suggestions de geste de `focusCorner.ts` (ne garder que le fait + question ouverte « Que sentiez-vous ? ») ; étendre les scanners CI + runtime IA aux groupes nominaux (« repère de freinage », « corde », « patience »).
2. **C-2 + C-2bis** : remplacer les fallbacks `mockCornerMargins` (`carte.tsx`, `prochaine-fois.tsx`) par un `EmptyState` honnête quand `telemetry_frames` est vide ; neutraliser le rouge-jugement du `MetricHero` central de `bilan.tsx`.
3. **C-8** : gater `BleErrorModal`/`OfflineBanner` sur `state !== 'S6_roulage'` (silence en piste garanti techniquement).

**Étape 2 — Bloquant juridique (décision Gabin sur le mécanisme)**
4. **B-1** : suppression de compte self-service (edge function + cascade).

**Étape 3 — Deltas structurants (validation Gabin AVANT code)**
5. Arbitrer charte (C-5/D12), pricing coach (D7), relation coach (C-6), AR WebView (C-3), lieu de capture (N-1).
6. Puis extraire `CoachBand` (D2) + bibliothèque de composants (D3) **si** le vocabulaire normé est voulu pour l'alpha.

**Étape 4 — Hors chemin critique alpha (différer explicitement dans la roadmap)**
7. Blocs 50, 70, 80, 90, E0, insights 30.5, idiome HUD : marquer « différé V1.1 / preview » dans `roadmap/SEMAINES.md` (aujourd'hui aucune décision Gabin ne les déferre nommément — sauf le garage que la décision 2026-06-07 dit pourtant in-scope).

---

## 7. Décisions qui appartiennent à Gabin

| # | Décision | Recommandation |
|---|---|---|
| 1 | **Périmètre alpha** : quels blocs (50/70/80/90/E0/HUD) in vs différés ? Trancher surtout le **garage (80)** que la décision 2026-06-07 dit in-scope mais qui est absent. | Périmètre minimal (4 piliers + coach + social + correctifs) ; reste différé V1.1, **tracé**. |
| 2 | **Correctifs doctrine `focusCorner` (C-1)** : supprimer le geste (sûr, tous pilotes) ou déplacer en `CoachBand` (pilotes avec coach) ? | (a) Supprimer immédiatement ; (b) en plus, quand le `CoachBand` normé existera. |
| 3 | **Mécanisme suppression RGPD (B-1)** : self-service vs demande admin ? | Self-service (edge function) — le plus défendable devant les stores. |
| 4 | **Charte (D12/C-5)** : aligner sur le `:root` mandaté maintenant ou V1.1 ? (le contrat tranche déjà la *source*, reste le *timing*) | Garder pour l'alpha (pas de refacto visuel à J-22), aligner en V1.1, **acté**. |
| 5 | **Relation coach (C-6)** : pilote-invite vs OXV-assigne ? | Pilote-invite (ou double voie « OXV propose / pilote active ») pour préserver le non-agrément. |
| 6 | **Pricing coach 750 €/saison (D7)** : maintenu pour quand ? | Gratuit à l'alpha, pricing différé V1.1 — lié au statut juridique d'OXV. |
| 7 | **AR WebView (C-3)** : autoriser la WebView pour E0 seul (hébergée côté site) ? | Oui — la décision native-only visait le contenu app, pas l'AR coach. Non bloquant alpha. |
| 8 | **Lieu 1ʳᵉ capture (N-1)** : Valence (contrat) ou Bouteville (planning) ? | Aligner les deux sources sur la réalité terrain. |
