# Paquet Claude Code — OXV Mirror (à joindre tel quel)

> Dézippez `oxv-mirror-specs.zip` à la racine du repo Expo de l'app mobile.
> Ce fichier est l'index : il dit QUOI lire et DANS QUEL ORDRE.

---

## ORDRE DE LECTURE (du contrat aux écrans)

**1. Le contrat — non négociable**
- `00_CLAUDE.md` — doctrine Mirror, charte, briques à garder/jeter, règles de code.
- `01_doctrine_et_composants.md` — composants et idiome visuel.

**2. Le moteur de données**
- `02_moteur_insights.md` — les 5 niveaux d'insights.
- `04_moteur_validation.md` — ce qui est validé / à valider à Valence.
- `CONTRAT_DONNEES_session_insights.json` — forme exacte produite par le moteur.
- `09_template_donnees_live.md` — **comment interroger un exemple RÉEL en direct**
  (ligne de démo en base, 7 virages). À lire avant de brancher un écran sur la donnée.

**3. La capture (chantier amont, déjà cadré)**
- `03_chantier_capture.md` — capteur RaceBox, BLE, mapping vers `telemetry_frames`.
- `BRIEF_DEMARRAGE_CLAUDE_CODE.md` — brief du chantier capture (étape 1).

**4. L'intégration du tracé 3D — la clé de voûte**
- `05_integration_trace_3d.md` — composant `<CircuitTrace>`, couches pilote/coach,
  branchement template par template. À lire avant tout écran d'insight.
- `circuit-tool/circuit-generator.mjs` — générateur (way OSM → tracé + virages + ruban 3D).
- `circuit-tool/circuit-3d-offline.html` — référence d'allure (ouvrir par double-clic).
- `circuit-tool/circuit-3d.html` — version servie (réseau).

**5. Les espaces (conception, tables vérifiées en base)**
- `06_espace_coach.md` — lire + annoter + gérer ; RGPD consentement pilote.
- `07_social_rgpd.md` — amis + partage granulaire ; RGPD fondation.
- `08_carte_lieux.md` — carte + lieux + création de tracé utilisateur.

**6. Specs écran par écran (détail)**
- `specs/` — onboarding, cœur restitution, détail data, historique, circuits, communauté,
  identité/avatar, garage, fonctionnalités neuves, compte, états limites, coach, map, AR.

**7. Maquettes (rendu pixel à reproduire)**
- `maquette_*.html` — 14 maquettes. Le style est FIGÉ : Claude Code reproduit, n'invente pas.

**8. Moteur de référence (pour comprendre, pas à recopier tel quel)**
- `moteur/insights.mjs`, `moteur/synth.mjs`.

---

## ÉTAT DE LA BASE (vérifié — ne pas re-migrer à l'aveugle)

- Supabase projet `fouvuqkdxarjpjbqnsjq` (Frankfurt). Supabase MCP disponible.
- `telemetry_frames` : schéma prêt (gyroscope inclus), **vide** jusqu'à Valence.
- `session_insights` : structure prête ; **1 ligne de démo** (`mirror-insights-demo`,
  7 virages) sur la session Haute Saintonge `b62ab3af-5d6a-4e88-b316-73a0729933ae`.
- `circuits` : nettoyé. UN circuit officiel par défaut = « Haute Saintonge » (Beltoise,
  La Genétouze, 2,20 km, 7 virages, 7 sessions). Géométrie de mai préservée.
- Carte : tables `partners` / `lodgings` / `restaurants` créées, RLS actif,
  **écriture admin seul** ; lecture = lignes publiées. `circuit_services`,
  `social_pings` existent (vides).
- Modération des tracés : colonne `circuits.review_status`
  (private/submitted/approved/rejected). Un utilisateur ne peut pas s'auto-promouvoir
  en officiel (faille corrigée).

## COMMENT OBTENIR LE TEMPLATE DE DONNÉES EN DIRECT
Via Supabase MCP, exécuter :
```sql
select * from session_insights
where telemetry_session_id = 'b62ab3af-5d6a-4e88-b316-73a0729933ae';
```
Détails et comportement (états vides, remplacement auto par la vraie donnée) :
`09_template_donnees_live.md`.

---

## POINTS OUVERTS (à trancher au fil de l'eau, signalés honnêtement)
1. Incohérence `users.role` vs `users.is_admin` — les fonctions `is_admin()` utilisent
   `role = 'admin'`. À clarifier (lequel fait foi).
2. Politiques d'écriture coach & social — à définir au moment de coder ces espaces,
   avec validation avocat pour le consentement (RGPD).
3. Alignement de la numérotation des virages : moteur d'insights (13, minima vitesse)
   vs générateur (7, courbure). À caler sur vraies données Valence (cf. 05 §5.1).

## RÈGLES DE TRAVAIL
Incréments validés un par un. Pas de refactor spéculatif. Architecture mono-repo Expo
préservée. Toujours vérifier l'état réel en base avant d'agir.
