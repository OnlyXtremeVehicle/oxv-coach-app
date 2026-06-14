# Plan vers Valence 100 % — audit + feuille de route

> Objectif non négociable : **OXV Mirror prêt à 100 % pour Valence (juillet 2026)** —
> premier essai réel avec **UN coach + UN pilote + la première récupération de données RaceBox**, de bout en bout.

Audit de préparation réalisé le 2026-06-14 (6 axes, lecture du code réel).

## Avancement (2026-06-14)

- ✅ **Navigation** : hub d'accueil pilote (PR #100) — tous les écrans atteignables sans session.
- ✅ **P0 — Chaîne de capture** : write path de bout en bout (PR #101). `placement` → `roulage` →
  écriture `telemetry_frames` + `laps` + session `completed` → analyse → bilan peuplé. Mapping testé,
  flush anti-perte, `.ubx` filet. **Reste : smoke test RaceBox réel + BLE arrière-plan.**
  ⚠️ Déviation à arbitrer : laps écrits par l'app (vs décision « dérivés des frames côté serveur »).
- ✅ **P2 — Runbook comptes** : `roadmap/RUNBOOK_VALENCE.md`.
- ⏳ **P1 — Moteur d'insights** (`mirror-insights-v1`) : à construire (tracé coloré par vraies données).
- ⏳ **P3 — Finitions** : 6 écrans minces + bugs mineurs + (optionnel) barre d'onglets.

---

## Verdict en une phrase

**Les écrans et l'analyse sont faits et de bonne qualité (~68/76 écrans « riches »). Il manque UNE chose, mais elle est critique : la chaîne de CAPTURE qui écrit les données du boîtier en base.** Sans elle, la première session de Valence ne produit aucune donnée — donc aucun bilan, aucune lecture coach.

---

## Ce qui est RÉELLEMENT fait (pas du stub)

- **Briques bas niveau capture** : BLE (scan/connexion RaceBox), parser UBX (checksum, resync, testé), détection de tours. Qualité PoC validée.
- **Moteur d'analyse RÉEL** : découpage en segments Haute Saintonge, vitesses entrée/apex/sortie, G latéral, marge par segment + zone, marge globale (40 % véhicule / 60 % pilote), régularité. **Du vrai calcul, branché à l'écran #11.**
- **Debrief IA** doctrinal (gpt-4o-mini + garde-fou verbes interdits) — déployé, anonymisé (lot S5 du 14/06).
- **Onboarding** pilote ET coach complets et persistés (pactes, CGU, niveau, rôle).
- **Lien coach↔pilote** architecturalement complet et correct : assignation admin → consentement pilote → RLS `is_coach_of` (actif + consenti) → lecture bilan/virages/annotations.
- **Navigation** : hub d'accueil pilote + hub coach fonctionnels (un pilote atteint équipement/réglages, un coach atteint ses pilotes/lecture).
- **~68/76 écrans riches** : bilan, signature, heatmap, tracé 3D, écosystème, social, partage, admin… prêts à se remplir dès qu'arrivent les données.

---

## Les BLOCAGES Valence (par ordre de priorité)

### 🔴 P0 — Chaîne de CAPTURE (write path) — LE chantier
Aujourd'hui, entre « boîtier connecté » et « données en base », **rien n'est branché** en production :
- `placement.tsx` « C'est fait » renvoie à l'accueil **sans démarrer aucune capture**.
- Aucun `insert` dans `telemetry_frames`, aucune création de `telemetry_sessions`, aucun `lap` persisté.
- La vraie capture n'existe que dans `debug-capture.tsx` (**__DEV__**), qui écrit un `.ubx` **local**.
- Le flux post-session (#10 pilotage-fini → #11 donnees-securite → #13 bilan) est **orphelin** (rien n'y route).

**À construire** :
1. `placement` « C'est fait » → démarre session + capture + détection de tours (réutiliser `startSession`/`startCapture`/`startLapDetection` aujourd'hui __DEV__-only).
2. Créer la ligne `telemetry_sessions` (status `recording`).
3. Batcher + **INSERT** les frames dans `telemetry_frames` (25 Hz, par paquets).
4. Persister les `laps`.
5. Fin de roulage → `status='completed'` + route vers #10 pilotage-fini → #11 (qui appelle déjà `analyzeAndPersistSession`) avec `sessionId` (+ `ubxUri`).
6. Upload du `.ubx` brut (bucket `telemetry_raw` à créer) comme filet de sécurité.
**Effort : ~1 à 2 semaines + un smoke test avec un vrai RaceBox.**

### 🔴 P1 — Moteur d'insights `mirror-insights-v1`
`session_insights` n'a que la **démo**. Même avec de vraies frames, le **tracé 3D ne sera pas coloré par les données réelles** et les couches anatomie/dispersion/tour idéal resteront vides. (Le bilan/segments/marges, eux, se rempliront via le moteur d'analyse existant.)
**Effort : ~1 à 2 semaines.** *Décision : indispensable au tracé « data » ; peut être un cran après la 1re capture si le bilan MVP suffit au premier essai.*

### 🟠 P2 — Processus comptes Valence (pas du code, à documenter)
Pas d'inscription in-app ni d'attribution auto du rôle coach. Pour le 1er essai :
1. Un admin crée les 2 comptes (Dashboard Supabase ou site).
2. `is_admin=true` sur un compte staff (1 UPDATE SQL — bootstrap).
3. Cet admin promeut le coach via `/(admin)/preparation` (fonctionne).
4. Coach + pilote se connectent, font leur onboarding/pacte.
5. Admin assigne le pilote au coach ; le pilote consent (`mon-coach`).
**Effort : ~0 j de code, à mettre dans un runbook.**

### 🟡 P3 — Finitions
- `coach_permissions` non auto-provisionnées à la promotion (0,5 j).
- Bug mineur : coach ouvrant une session non analysée → `upsertAnalysis` avec l'id du coach (bilan.tsx) (0,5 h).
- 6 écrans minces/stubs : `entre-runs` (marge live en dur), `notifications`, `admin/en-cours` (pas de realtime), liens LÉGAL settings, `prochaine-fois`/`carte` (mock à remplacer par état vide).
- Barre d'onglets + topbar du sitemap (optionnel si le hub suffit).

---

## Ordre de bataille proposé
1. **P0 capture** (le cœur — sans ça, pas d'essai).
2. **P2 runbook comptes** (en parallèle, rapide).
3. **P1 insights** (pour le tracé data ; ou juste après la 1re capture).
4. **P3 finitions**.

Tout le reste (écrans, analyse, coach, RGPD, builds) est prêt et tient.
