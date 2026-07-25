# État complet de l'application OXV Mirror

**26 juillet 2026** · branche `feat/site-document-emails`

Ce document a été écrit en lisant le dépôt fichier par fichier et en interrogeant
la base de production en lecture seule. Huit enquêtes parallèles, chacune sur une
dimension, puis assemblage. Chaque affirmation renvoie à un chemin précis. Ce qui
n'a pas pu être vérifié est dit comme tel — la dernière section liste
honnêtement tous les angles morts.

Il est long parce que vous avez demandé à tout savoir. Cette ouverture suffit si
vous ne lisez qu'une page.

---

## Les cinq faits à retenir avant tout le reste

**1. L'espace coach n'est atteignable par personne.** Il n'existe aucun compte
`role = 'coach'` en base. Les 37 écrans coach — plus de 26 000 lignes de code —
ne s'ouvrent pour aucun utilisateur aujourd'hui. Même situation pour les 8 écrans
`pro_pilot`. Et les deux comptes `role = 'admin'` ont `is_admin = false`, alors
que l'espace admin est gardé par ce drapeau et non par le rôle : ces deux comptes
atterrissent dans l'arbre pilote V1, sans accès admin. Le double système
`users.role` / `users.is_admin` produit là une incohérence de fait.

**2. Le neuf n'est pas ce qui tourne.** Les deux arbres pilote coexistent : 83
écrans V1 et 38 écrans V2. C'est le V1 qui reçoit l'utilisateur aujourd'hui. La
bascule est le lot L6, et elle attend le terrain. Tant qu'elle n'a pas eu lieu,
l'application embarque les deux et le travail de refonte reste invisible pour le
pilote.

**3. Le dépôt ne raconte pas toute l'histoire de la base.** 125 migrations ici,
215 appliquées en production. L'écart vient du site, qui applique les siennes sur
le même projet Supabase. Conséquence pratique : un `supabase db push` depuis ce
dépôt ne serait pas idempotent, et le fichier de types généré connaît des colonnes
qu'aucune migration locale ne crée.

**4. Rien n'a été observé en fonctionnement.** Aucun simulateur, aucun téléphone.
Tout ce qui est dit du rendu, des gestes, des transitions, de VoiceOver ou de la
reconnexion Bluetooth en piste est une lecture de code, pas une observation. C'est
la limite majeure de ce document, et elle recoupe la vôtre : les builds attendent
toujours un verdict sur appareil.

**5. Trois fuites de consentement ont été trouvées et corrigées ce matin.** Un
audit adversarial de l'espace coach (35 agents, 29 constats confirmés) a montré
que retirer son consentement de coaching ne coupait pas le direct, et que la
fréquence cardiaque partait à des coachs en « lecture simple » qui n'y avaient pas
droit. Corrigé et commité (`29d5cfd`). Il reste 26 constats confirmés non traités,
dont un critique.

---

## Ce que l'application est aujourd'hui

824 fichiers TypeScript, 158 fichiers de tests pour 1 846 tests verts, 125
migrations dans le dépôt, 146 documents. Une base Supabase PostgreSQL 17 en
`eu-west-1` (Irlande), partagée avec le site : l'application n'a pas de base à
elle.

Sept espaces de routes coexistent — pilote V2, pilote V1, coach, admin, partner,
pro, auth — dont trois sont destinés à migrer vers le web. Deux design systems
cohabitent sans se mélanger : le kit « DA Instrument » pour le pilote V2, l'ancien
pour tout le reste. Un seul drapeau fonctionnel est actif en base : `biometry`.
Les six autres sont fermés.

La chaîne de capture — du boîtier RaceBox jusqu'à la base — est le cœur technique
et le seul endroit du dépôt protégé par un gel explicite de quatre fichiers.

---

## Chronologie, ordre et décisions

### 1. Sur quoi cette reconstitution s'appuie

Trois sources ont été ouvertes et croisées : l'historique Git complet (623 commits, du 24 mai au 26 juillet 2026, extrait avec `git log --date=short`), les 81 rapports de `roadmap/rapports/` (16 rapports « semaine », 51 rapports « PR », 7 rapports « v2-* », plus `bio-2.md`, `live-b.md`, `m1-closeout.md` et `verification-tail-pr44-49-54-55-65b.md`), et les 12 documents de programme de `design-retours/programme-v2/`. Les documents de cadrage antérieurs (`roadmap/AUDIT_CABLAGE_2026-07.md`, `roadmap/V9_NG_ROADMAP.md`, `roadmap/DECISIONS_GABIN_2026-06-13.md`, `docs/refonte-app/`) complètent la partie juin.

Le contrat qui fait aujourd'hui autorité sur l'ordre des choses est `design-retours/programme-v2/OXV_APP_V2_DOSSIER_MAITRE.md`, daté du 18/07/2026. C'est lui qui définit les 13 lots, les 4 gates externes et l'ordre d'exécution. Tout ce qui a été livré depuis le 19 juillet suit ce document.

### 2. Vue d'ensemble : neuf phases, pas une roadmap continue

L'application n'a pas suivi un plan unique. Elle a traversé neuf programmes successifs, chacun ouvert par un document de cadrage et refermé par des rapports. Le plan d'origine (`roadmap/SEMAINES.md`, 14 semaines vers l'App Store) a été entièrement consommé dès la fin mai, puis remplacé quatre fois.

| Phase | Dates (Git) | Programme | Commits |
|---|---|---|---|
| 1 | 24 → 26 mai | Semaines 1-15 du plan initial + feature coach + amis/duel + médias | 149 |
| 2 | 7 → 8 juin | Rebrand OXV Coach → OXV Mirror, cahier « OXV Mirror » §3-§10 | 31 |
| 3 | 13 → 20 juin | Réconciliation bundle v2/v4, chartes éthiques, RGPD, RLS PII, write-path Valence | 50 |
| 4 | 21 → 27 juin | Reskin V2 (63 écrans), bascule typo Geist, belles routes, marketplace coach, carte OXV | 60 |
| 5 | 27 → 30 juin | **OXV Platform** : nav 5 zones + backlog PR-01…PR-86 + roadmap V9 NG | 148 |
| 6 | 4 → 7 juillet | **Lots M** (M0 audit, M-IA, M1 QDI, M3 appairage, M6, M7, M8) + passation Claude Design | 52 |
| 7 | 11 → 18 juillet | **Refonte V3 / refonte-v2** : thème, 5 zones, console coach §12, durcissement Valencia, calibration circuits | 87 |
| 8 | 18 → 19 juillet | **Programme V2 « DA Instrument »** : SEC-1, BE-1, L0, L1, L2, L4, L5, L5-B, L3 | 28 |
| 9 | 25 → 26 juillet | BIO-2, LIVE-B, accessibilité, A-FLOW-1, BIO-1, correctifs du direct | 16 |

Entre le 20 et le 24 juillet, aucun commit : cinq jours de silence entre la fin du programme V2 écrans et sa reprise.

### 3. Chronologie détaillée

#### Phase 1 — Les fondations (24-26 mai 2026)

Le dépôt s'ouvre le 24 mai avec `f7fe331` (« initialisation projet OXV Coach »). Les quinze semaines du plan `roadmap/SEMAINES.md` sont exécutées en trois jours calendaires, chaque semaine close par son rapport (`roadmap/rapports/semaine-1.md` à `semaine-15.md`). L'ordre suivi est celui du plan : state machine S1-S10 et stores Zustand (`54dfa6f`), offline MMKV (`73f9339`), BLE RaceBox complet (`92245db`), détection de tours (`1b76218`), écrans bilan et algorithme de marge V1 (`0adcc8e`), carte et zoom virage (`427c62d`), onboarding (`81c2f41`), paddock (`68b960b`), module trackviz (`7092175`), orchestration post-session (`7b195f0`).

Le 25 mai, la feature coach entre en scène en cinq phases (`a899de8` schéma et RLS, `c23100e` app coach, `c4fa629` backoffice admin, `233b7a2` opt-in pilote RGPD, `43e361b` journal d'audit). Le 25-26 mai s'ajoutent le scanner doctrinal anti-verbes-interdits (`bf7f932`), les amis et le duel (`a020d66` à `dbd117c`), et les médias de session (`9b26f0d` à `b0d515f`).

#### Phase 2 — Le rebrand et le cahier « OXV Mirror » (7-8 juin)

Le 7 juin, `f74e2a8` renomme le produit : OXV Coach devient OXV Mirror. La logique du renommage se lit dans le commit suivant, `aecde58`, qui « dé-coachifie » le duel pilote en « Côte à côte entre copains ». Suit l'exécution d'un cahier des charges numéroté : les quatre piliers (`def973e` signature, `39be193` régularité, `ec2a2bd` heatmap, `e0d30ef` évolution), le volet social (`c932116`, `2bab5c2`), le tableau de bord business coach (`5d787ef`), l'écosystème national (`c5712cd`), l'analytics RGPD type Plausible (`01ac625`).

#### Phase 3 — Réconciliation et durcissement légal (13-20 juin)

Le 13 juin, `e31f9cd` ingère le `specs-bundle-v4` et `0892e3b` porte la « réconciliation specs v2 ». C'est là que se placent les huit arbitrages de `roadmap/DECISIONS_GABIN_2026-06-13.md` (détaillés en §6). Le 14 juin est la journée la plus dense de la période : quatre chartes éthiques ingérées (`c470ce6`), le garde-langage étendu (`b86756a`), l'anonymisation du flux OpenAI et l'opt-out IA (`7e796cc`), l'export et la suppression de compte (`632bb9e`), et surtout le **write-path de capture de bout en bout** (`0ebe59b`, « P0 Valence »). Le 15-16 juin traite les fuites RLS (`f598687` vue `sessions_public`, `197eb5c` search_path sur 15 fonctions) et rédige la purge RGPD art. 17 (`88ba669`).

#### Phase 4 — La première refonte visuelle (21-27 juin)

Le 21 juin, `8d25f32` pose la « fondation du design V2 » et trois commits reskinnent 63 écrans (`24ac301`, `7b2a94f`, `4b1ab80`, `946b562`). Le 22 juin, `47652ac` bascule la charte sur Geist. Le 23-24 juin, la branche `gaming` explore une direction cockpit, fusionnée le 27 juin par `b7dfde3`. En parallèle : les belles routes avec GraphHopper (`73dc8b9` à `9039cca`), la marketplace coaching (`6edd534`, `9a76acc`, `e24f2dc`, `b498c2d`), le multi-circuit avec l'ajout de la Charente (`f895b30`).

#### Phase 5 — OXV Platform : le pivot (27-30 juin)

Le 27 juin, deux commits déposent 19 documents de cadrage (`e631fba` et `5bc19de`, → `docs/refonte-app/05_*` à `18_*`). L'application cesse d'être une app compagnon pour devenir une plateforme à quatre rôles. `a4b2464` livre la barre d'onglets 5 zones et `src/lib/appMap.ts`. Suivent les PR 1 à 8 (Paddock, Bilan/Data Lab, Session, Progression, Compte, fusions, carte OXV).

Le 28 juin, `39a5a33` produit `AUDIT_CDC_V2` (écart entre le dépôt réel et le cahier exécutable), puis `07970ff` dépose le backlog ordonné `docs/refonte-app/V6_BACKLOG_PR.md`. S'ensuit l'exécution la plus intense du projet : 122 commits en 48 heures, du filtre doctrinal IA (PR-01 à PR-05) au support (PR-09/10/11), à l'admin utilisateurs (PR-12), aux événements et au Pass OXV (PR-20 à PR-40), à l'espace partenaire (PR-31 à PR-36), à l'espace pro (PR-70 à PR-78), à la modération (PR-49). Chaque PR a son rapport dans `roadmap/rapports/pr-NN-*.md`. Le jalon M1 est clos le 28 juin par `roadmap/rapports/m1-closeout.md` et le commit `87c5e67`.

Le 29 juin, la roadmap V9 (`roadmap/V9_NG_ROADMAP.md`) ajoute une couche interface au-dessus : les cinq axes sont déclarés complets dans la nuit (Axe 1 OXV Trace, Axe 2 Data Lab NG, Axe 3 OXV Moment, Axe 5 Paddock NG ; Axe 4 entamé). Le 30 juin ajoute Skia (`a060224`) et deux tables validées par STOP-schéma (`45e25e8`).

#### Phase 6 — Les lots M (4-7 juillet)

Le 4 juillet, `041c7d6` produit `roadmap/AUDIT_CABLAGE_2026-07.md` : l'audit de câblage écran par écran qui devient « base de vérité des lots M ». Sont ensuite livrés M-IA (verrouillage « débriefe, ne coache jamais », `2d50c38`), M1 (QDI 5 branches, `e05ebd4`), M3 (appairage site↔app par code `pair-app`, `2b515ad`), M7 (flotte RaceBox et hub Paddock, `062eb81`, `cb215dc`), M8 (identité et passe canon visuelle, `4ab0920`, `73f2c19`), M6 (`sessions.circuit_id`, `6e5b91`). Le 5 juillet, `801c23c` rédige le dossier de passation vers Claude Design pour la refonte des 150 écrans.

**M2, M4 et M5 n'apparaissent nulle part comme livrés.** M4 (migration `events` → `sessions`) est identifié dans l'audit (`AUDIT_CABLAGE_2026-07.md:40-41`) comme impactant 7 écrans et 4 services ; M5 concernait le passage en privé des buckets `coach-media` et `partner-media` (`AUDIT_CABLAGE_2026-07.md:150-155`). J'ai vérifié : `src/services/eventsService.ts` interroge toujours la table `events` (15 appels `.from('events')`/`.from('event_registrations')`), et deux écrans **V2** la consomment encore — `app/(app2)/club/pass.tsx:33` et `app/(app2)/rec/preparation.tsx:46` importent `listMyRegistrations`, qui fait une jointure sur `events`. C'est en contradiction directe avec la règle n°6 du dossier maître (« la table `events` est DEPRECATED, aucun nouveau code ne s'y branche »).

Le 6-7 juillet, `d8ce871` réceptionne « refonte Claude Design v1 » (46 écrans + docs), suivi du kit NG (`5245129` typo Rajdhani + JetBrains Mono, `2a91468` kit cockpit, `db0341a` StateWrapper) et de la propagation aux espaces coach, admin et partenaire. Sept écrans coach neufs sont créés dans la foulée (Facturation, Studio, Calendrier, Plan, Rapport, Triage, Débrief).

#### Phase 7 — Refonte V3, console coach, terrain (11-18 juillet)

Le 11 juillet est le point de bascule visuel : `fac0f0f` pose la « fondation thème refonte design complète » (palette QDI par branche, Hanken Grotesk), suivie de `cf0d200` (KingNumber mono, radar QDI coloré) et d'une longue « passe audit-or » qui confine l'or au chronomètre (`a30fb4b`, `033edb8`, `3b93e26`, `94ada16`). Le même jour, la chaîne du direct coach est construite de bout en bout (`8224792` fondation, `b8d575a` service Realtime, `227b6b4` roster, `653eef3` cockpit focus, `eb90f58` relais monté sur la capture, `0b72092` durcissement du transport), ainsi que l'aide à la facture coach P2 (`ab4e81e`, `3a0c655`) et la décharge e-sign P3 gatée OFF (`b9c9f66`).

Du 12 au 14 juillet, les maquettes « refonte-v2 » sont réintégrées écran par écran (Paddock, Bilan, Signature, Progression, Data Lab), puis la console coach §12 en quatre vagues A/B/C/D (`a8a2350`, `a490d77`, `d4e1701`, `ff3922f`, 36 écrans au total). Le 12 juillet, `4ce429a` corrige un défaut qualifié de critique : les axes G étaient mal alignés et le QDI n'était pas calculé sur la séance entière.

Du 15 au 16 juillet, le chantier terrain : le catalogue partenaires (`cb9bb03`), le paiement coach par lien (`426abb1`), puis le durcissement Valencia en six chantiers (`dabfbe8`, `3e91df8`, `0a201d7`, `f3699b1`) suivi de trois vagues de correctifs adversariaux (17 findings, 3 critiques — `RAPPORT_DURCISSEMENT_VALENCIA.md`). Le 16 juillet, la calibration des deux circuits est appliquée en production (`d579e95` Haute Saintonge, `e64c37e` détection de tour par franchissement de porte, `5a0e2f0` base de prod calibrée).

Les 16-17 juillet traitent les « retours build 23 » du fondateur (`601f86e`, `506e3f0`, `3aa29cd`, `0e701b1`), le 18 juillet livre le lot PROFIL_CARTES (`f2fcfe2`) et produit `BILAN_COMPLET_OXV.md` (`96d4c84`), l'état des lieux de 89 Ko qui sert d'entrée au programme suivant.

#### Phase 8 — Le programme V2 « DA Instrument » (18-19 juillet)

Le 19 juillet à 02h31, `69a0bd0` dépose les 11 prompts du programme et l'audit de sécurité. Le reste tient en une seule journée de travail. Voici l'ordre horodaté réel :

| Heure | Commit | Lot |
|---|---|---|
| 02h31 | `52bb7bd` | **L0** — tokens DA Instrument, 20 icônes, 11 primitives de motion, 18 composants |
| 02h57 | `b4748a2` | **SEC-1** préparé (migrations non appliquées) |
| 03h31 | `b9896ff` | **SEC-1** appliqué en prod + durcissement `ritual_dispatcher` |
| 04h35 | `d920d2f` | **BE-1** — flags, `biometry_raw`, `founder_applications`, incidents, vidéo, convois |
| 05h47 | `87ab0e6` | **L1 MIROIR** — accueil, bilan, signature |
| 07h34 | `6d2b453` | Migration C1 (présence jour J) appliquée en prod |
| 08h24 | `f151fab` | **L2 REC** — les 8 écrans du jour J |
| 14h53 | `650b029` | **L4 VOUS** — 8 écrans + fondateurs + parrainage + réservation gatée |
| 17h39 | `79aabbb` | **L5 CLUB** — 7 écrans |
| 18h43 | `eb46c00` | **L5-B** — `coach_testimonials` remplace `coach_reviews` |
| 19h18-20h56 | `c07d0b7` → `6bea17d` | **L3 DATA** — 4 écrans + de-mock des 5 lectures Insight |
| 21h04-21h20 | `c07b3bc`, `4caa1b6` | **A-FLOW-1** — définition du `flowService`, validée le soir même |

Chaque lot est suivi d'un commit de correctifs issus d'une vérification adversariale, et documenté dans `roadmap/rapports/v2-lN.md`. Le volume de findings corrigés est consigné : 28 pour L0, 34 pour L1, 10 pour L2, 14 pour L4, 6 pour L5, 5 pour L5-B, 4 pour L3.

**Un écart d'ordre est visible ici.** L'audit `OXV_V2_AUDIT_EXHAUSTIVITE_SECURITE.md:45` prescrivait « SEC-1 → BE-1 → L0 ». L'exécution réelle a été **L0 → SEC-1 → BE-1**. Le rapport L0 le reconnaît explicitement (`roadmap/rapports/v2-l0.md:64` : « Prochain lot selon l'ordre révisé : SEC-1, puis BE-1 — prompt BE-1 toujours manquant »). Deuxième écart : L3 était prévu **après** la gate terrain ; il a été exécuté quand même, sur décision du fondateur (`roadmap/rapports/v2-l3.md:4-7` : « Le fondateur a demandé d'enchaîner sur L3 malgré le gate terrain ouvert »).

#### Phase 9 — La reprise (25-26 juillet)

Après cinq jours sans commit, le travail reprend le 25 juillet à 15h18 par `e05796b`, qui solde la dette A-WEATHER-1 consignée le 19 (le service météo fabriquait un 0 °C). Puis, en neuf heures :

| Heure | Commit | Objet |
|---|---|---|
| 16h37 → 18h13 | `f9b7767`, `8ba669d`, `a2560da`, `ba00004` | **BIO-2** en quatre incréments (parser Polar H10, greffe live coach, capture locale offline-first, appairage paddock + vue coach) |
| 19h49-20h06 | `a1da3f8`, `1f49a62` | Pastille cardio colorée (arbitrage) + refcount du canal de séance |
| 20h00 | `b8ffc93` | **Drapeau `biometry` levé en production** |
| 20h58 | `dccbe25` | **LIVE-B variante A** — tableau de marche par numéro, Meta Display, multi-live |
| 21h53-22h06 | `5685704`, `0222d94` | Passe d'accessibilité (~40 écrans, 81 constats) + relèvement des gris |
| 23h04 | `5a7bed7` | **A-FLOW-1** — `flowLogic` + `flowService` écrits (44 tests) |
| 23h26 | `8d5bc2a` | **BIO-1** — HealthKit câblé (dépendance `react-native-health` ^1.19.0 validée) |
| 23h37 | `93dad66` | 9 tests verrouillant le refcomptage des topics live |
| 26/07 00h35 | `29d5cfd` | **3 constats critiques du direct** corrigés + `docs/ETAT_APP_2026-07-26.md` |

Le dernier commit est le plus lourd de conséquences : un audit adversarial de l'espace coach (35 agents, 29 constats) a révélé que le retrait du consentement pilote ne coupait pas le direct, et que la fréquence cardiaque partait à des coachs en simple lecture — une donnée de l'article 9 RGPD chez quelqu'un sans droit dessus, armée depuis la levée du drapeau cinq heures plus tôt.

### 4. L'état de la ligne Git — un point qui n'est pas anodin

| Référence | Commit de tête | Date |
|---|---|---|
| `origin/main` | `1a803f3` | 29 juin 2026 |
| `main` (local) | `2740868` | 30 juin 2026 |
| `origin/feat/site-document-emails` | `21f7dab` | 7 juillet 2026 |
| `feat/site-document-emails` (local, HEAD) | `29d5cfd` | 26 juillet 2026 |

**126 commits n'ont jamais été poussés**, et 179 commits n'ont jamais été fusionnés dans `main`. Concrètement : toute la refonte V3, la console coach §12, le durcissement Valencia, la calibration des deux circuits, l'intégralité du programme V2 DA Instrument, BIO-1, BIO-2 et LIVE-B n'existent que dans ce clone local. L'arbre de travail est propre (`git status` vide), donc rien n'est perdu au niveau du fichier, mais rien n'est sauvegardé ailleurs non plus.

### 5. L'ordre restant, et le verrou de chacun

L'ordre canonique est celui de `PROMPT_CLAUDE_CODE_LOTS_CLOTURE.md:49` : `BE-1 → L0 → L1 → L2 (+L2-B) → L4 → L5 → [SMOKE TEST TERRAIN] → L3 → BIO-2 → [DÉCISION CLASSEMENT] → LIVE-B → BIO-3 → B1 → [SIRET] → A1-ON → L6 → App Store`. Voici où l'on en est.

| Lot | État | Ce qui le bloque |
|---|---|---|
| SEC-1, BE-1, L0, L1, L2, L4, L5, L5-B, L3 | **Livrés** (19/07) | — |
| BIO-2 | **Livré** (25/07) | — |
| LIVE-B | **Livré, variante A** (25/07) | — |
| BIO-1 | **Livré** (25/07) | — |
| **L2-B — Live Activity iOS** | **Non commencé** | Sous-lot natif Swift (ActivityKit + WidgetKit). Reporté explicitement au rapport L2 (`v2-l2.md:79-82`) : « > 1 j de travail natif ». Vérifié : **zéro occurrence** de `ActivityKit`/`LiveActivity` dans `app/`, `src/` ou la config. |
| **Smoke test terrain** | **Gate toujours ouverte** | Une journée de piste avec une séance dense. Au 19/07, le rapport L3 constate « 10 séances closes, **1 seule avec 1 tour** ». C'est la gate la plus structurante : elle conditionne le calage de `flowService`, l'alimentation des 5 lectures Insight, la mesure du scrubbing 60 fps, B1 et L6. |
| **BIO-3 — mini-app watchOS** | **Non commencé** | Gate : « BIO-1 en production et validé une journée réelle ». BIO-1 est câblé mais **pas compilé** (dépendance native ajoutée sans build). Vérifié : zéro occurrence de `WCSession`/`HKWorkoutSession`/`watchOS`. |
| **B1 — vidéo synchronisée** | **Non commencé** | Trois gates : frames réelles, flag `video_overlay` (OFF), coût de stockage validé. La table `video_overlays` existe (BE-1) et attend son usage. |
| **A1-ON — activation paiements** | **Non commencé** | Gates : SIRET (attendu **août 2026** selon le dossier maître §Gates), Stripe live, CGV validées avocat, et flux L4 en production drapeau OFF depuis ≥ 2 semaines. Vérifié : ni `@stripe/stripe-react-native` ni `react-native-iap` dans `package.json`. |
| **V2-L6 — bascule finale** | **Non commencé** | Gates : L0-L5 validés par le fondateur **sur device**, smoke test v2 complet en conditions réelles, crash-free ≥ 99,5 % sur deux semaines de build interne. Or le crash-free est immesurable : Sentry est câblé (`src/lib/sentry.ts`, dépendance `@sentry/react-native` présente) mais **inactif faute de DSN** (`docs/architecture/16_SENTRY_SETUP.md`, marqué « ACTION FONDATEUR »). |
| Coach / Admin v2 | Reporté | « Après pilote » (dossier maître §10). L'espace coach n'a jamais été refondu et n'a aucune maquette de référence. |

Deux dettes hors lots sont consignées et non traitées : les **26 constats restants** de l'audit coach du 26/07 (mentionnés dans le message de `29d5cfd` : « 1 critique sur l'annotation, des majeurs sur la fabrication de valeurs et des boutons sans effet ») — ils ne font l'objet **d'aucun fichier de rapport dans le dépôt**, seul le message de commit les mentionne ; et le **canal biométrie par coach** (`live:bio:<coachId>:<sessionId>`), désigné dans ce même commit comme « la réponse propre, à faire avant d'élargir l'usage ».

### 6. Décisions déjà tranchées par le fondateur

Ces décisions se retrouvent soit dans les rapports, soit inscrites en commentaire dans le code — ce qui les rend durables au-delà des conversations.

| Date | Décision | Où c'est écrit |
|---|---|---|
| 2026-06-07 | Tableau de bord business **côté coach**, sans remise dégressive | `src/services/coachBusinessService.ts:4` |
| 2026-06-13 | Périmètre alpha **maximal** (tout inclure, rien de différé par défaut) | `roadmap/DECISIONS_GABIN_2026-06-13.md` décision 1 |
| 2026-06-13 | **Supprimer** la suggestion de geste pour tous les pilotes (cadre légal) | idem, décision 2 — appliqué dans `focusCorner.ts` |
| 2026-06-13 | Suppression RGPD **self-service** ; charte alignée sur le `:root` du site ; relation coach **pilote-invite** ; coach gratuit à l'alpha ; AR en WebView pour E0 seulement ; Haute Saintonge = premier circuit | idem, décisions 3 à 8 |
| 2026-06-29 | Les RPC de classement sont **supprimées en base** | `src/__tests__/doctrineGuard.test.ts:19` |
| 2026-07-04 | IA : « on garde l'IA si elle ne coache pas mais débriefe » — amende le retrait total prévu | `roadmap/AUDIT_CABLAGE_2026-07.md`, section « Inventaire IA — AMENDÉ » |
| 2026-07-04 | QDI 5 branches, radar **self-only**, exposition aux amis assumée | `src/services/qdiLogic.ts:4`, `src/services/qdiService.ts:9` |
| 2026-07-04 | Freinage = rouge de donnée `#E63946` | commit `a6d2a2b` |
| 2026-07-06 | Couleurs d'identité de rôle = celles des maquettes | `src/ui/RoleBadge.tsx:6`, `src/theme/v2.ts:86` |
| 2026-07-11 | Accent coach = crème neutre, **pas de sweep** | commit `e740204` |
| 2026-07-12 | Nav = les 5 zones des maquettes Claude Design | `src/lib/appMap.ts:7`, `src/components/AppTabBar.tsx:5` |
| 2026-07-13 | Coach : **les DEUX formats** (console tablette + compagnon téléphone) | `src/lib/coachNav.ts:82` |
| 2026-07-16 | Prix coach affiché = **la session** ; validation admin des points de la carte ; visibilité privée par défaut des tracés créés | `src/services/coachProfileService.ts:10`, `src/services/socialPingsService.ts:7`, `src/services/userCircuitsService.ts:9` |
| 2026-07-16 | « On corrige » : la fluidité devient réelle (maxima par tour écrits à la capture) | commit `c409dcc` |
| 2026-07-18 | **Direction visuelle « Instrument »** retenue parmi trois (Monolithe / Instrument / Lumière) | dossier maître §1 |
| 2026-07-18 | Bouton central à **3 états** (RÉSERVER / PRÉPARER / REC) | dossier maître §2 |
| 2026-07-18 | Miroir à **deux visages** (après-séance < 7 j / entre-journées) | dossier maître §3.1, `src/features/miroir/miroirHomeLogic.ts:13` |
| 2026-07-18 | Plafond Membres Fondateurs = **30**, « jamais plus » | `src/features/vous/vousHubLogic.ts:174` |
| 2026-07-18 | Badge Fondateur affiché **après validation admin** (clôt le TODO_ARBITRAGE v1) | dossier maître §7 |
| 2026-07-19 | **Libellés Signature** : Cap→trajectoire, Trajectoire→régularité, Visée→freinage, Plongée→accélération, Anticipation→fluidité. Conséquence assumée : sur cet écran, « Trajectoire » ≠ la branche technique du même nom | `src/features/miroir/signatureLogic.ts:46`, verrou de test `signatureLogic.test.ts:54` |
| 2026-07-19 | **A-WEATHER-1** : le service doit exposer `null`, jamais un nombre placebo. Consigne de doctrine, pas un bug | `roadmap/rapports/v2-l1.md:92-98` — appliqué le 25/07 (`e05796b`) |
| 2026-07-19 | **`flowService`** : jerk IMU normalisé par la sévérité, anti-bruit causal et déterministe, fenêtre en paramètre exposé, sortie sans score, **seuil reporté au post-piste** | `docs/architecture/A-FLOW-1_flowService_definition.md` §6 |
| 2026-07-19 | Avis coach notés → **témoignages sans note** (`coach_reviews` droppée, `coach_testimonials` créée) | `roadmap/rapports/v2-l5b.md`, garde-fou `coachDomainNoScore.test.ts:2` |
| 2026-07-19 | Enchaîner sur L3 **malgré** la gate terrain ouverte | `roadmap/rapports/v2-l3.md:4-7` |
| 2026-07-19 | « Oui — tout appliquer » + « Durcir `ritual_dispatcher` » (mutations SEC-1 en prod) | `docs/architecture/SEC1_PROD_APPLY.md`, section « APPLIQUÉ EN PROD » |
| 2026-07-25 | **Pastille cardio colorée** au roster (rampe froid→chaud, jamais or ni rouge, zone relative au pilote) | `roadmap/rapports/bio-2.md:115-136` |
| 2026-07-25 | **Levée du drapeau `biometry` en production**, en connaissance de l'absence de smoke test à deux appareils | `roadmap/rapports/bio-2.md:175-176`, commit `b8ffc93` |
| 2026-07-25 | **LIVE-B variante A** : tableau de marche trié par numéro de voiture, jamais par chrono. Motif : un classement peut requalifier juridiquement un track day en compétition | `roadmap/rapports/live-b.md:7-21`, verrou `src/services/boardLogic.ts:47` |
| 2026-07-25 | « On assouplit » : relèvement des gris faibles pour l'accessibilité | `src/theme/v2.ts:17`, `src/ui/v2/tokens.ts:26` |
| 2026-07-25 | Validation de la dépendance native `react-native-health` | message de commit `8d5bc2a` |
| 2026-07-25 | **Validation avocat de l'annexe A** (consentement biométrie) | `docs/juridique/consentement_biometrie.md:1` — le document est passé de « VALIDATION AVOCAT REQUISE » à validé |

### 7. Décisions encore en attente

Elles se répartissent en quatre familles.

**Arbitrages produit ouverts dans le code (marqueurs `TODO_ARBITRAGE`)**

| Marqueur | Emplacement | Sujet |
|---|---|---|
| `TODO_ARBITRAGE` | `app/(app)/profil.tsx:385` | Statut Fondateur en V1 — tranché au niveau produit (dossier maître §7), mais le marqueur subsiste dans l'écran V1 |
| `TODO_ARBITRAGE` | `src/features/miroir/signatureLogic.ts:8` | Marqueur conservé **à la demande du fondateur** : le mapping Signature reste renégociable mot à mot |
| `TODO_ARBITRAGE D2` | `src/features/miroir/signatureLogic.ts:278` | Nom du pilier physiologique BIO-4 — « Aplomb » est provisoire |

**Questions juridiques en attente (marqueurs `TODO_AVOCAT`)**

| Marqueur | Emplacement | Sujet |
|---|---|---|
| `TODO_AVOCAT E5` | `supabase/migrations/20260719_sec1_purge_sante.sql:119`, `20260719147000_be1_purge_extend.sql:93`, `20260719143000_be1_incident_reports.sql:10`, `supabase/functions/purge-deleted-accounts/index.ts:23` | `incident_reports` : durée de rétention et périmètre exact du gel. L'immuabilité probatoire assurantielle s'oppose au droit à l'effacement RGPD art. 17. Position provisoire : anonymiser (`user_id` → NULL) au lieu de supprimer |
| `TODO_AVOCAT CGV` | `app/(app2)/reserver/paiement.tsx:152` | Texte des conditions générales de vente + distinction Stripe (journées, service physique) / achat in-app (abonnement 99 €/an, règle Apple) |
| — | `BILAN_COMPLET_OXV.md:748` | Rétention des décharges D4 + relecture avocat (le flag `pilot_waivers` est OFF) |

**Décisions de schéma (identifiées, chiffrées, non tranchées)**

1. **Rang fondateur** — `founder_applications` n'a pas de colonne de rang, donc « FONDATEUR N° 07 » est impossible sans fabriquer. Affiché « MEMBRE FONDATEUR » sans ordinal (`roadmap/rapports/v2-l4.md:52-56`).
2. **Véhicule principal** — `garageService` n'a ni `is_primary` ni `setPrimary` ; « EN TÊTE » = le premier créé, non modifiable (`v2-l4.md:57-59`).
3. **Chaînon séance → journée** — une colonne `telemetry_sessions.day_session_id` vers `public.sessions`. Sans elle, le tableau de marche reste lisible du seul binôme coach, alors qu'il devrait l'être par tout inscrit de la journée. La migration LIVE-B a **refusé de deviner** ce lien (`roadmap/rapports/live-b.md:136-144`).
4. **Compte de service du téléviseur de paddock** — un écran TV n'est pas un utilisateur authentifié ; il lui faut son propre chemin d'autorisation (`live-b.md:145-146`).
5. **RIB / QR SEPA coach** — schéma IBAN à trancher (`BILAN_COMPLET_OXV.md:749`).
6. **DROP des tables `_backup_*`** — 44 lignes avec colonnes PII ; la RLS a été activée en défense, la suppression attend l'accord (`SEC1_PROD_APPLY.md`, « Reste ouvert »).

**Décisions de calage et actions matérielles**

1. **Seuil de fluidité** — reporté au post-piste par décision explicite : il doit émerger des percentiles réels, pas être décrété (`A-FLOW-1_flowService_definition.md` §3). Le document signale aussi une **limite connue non résolue** : `gSustained` est lu sur le |g| mesuré, donc la boucle est partiellement fermée et un pilote brusque bénéficie d'une indulgence mémorisée (§7).
2. **DSN Sentry** — action fondateur de quelques minutes, sans laquelle le crash-free de L6 est immesurable (`docs/architecture/16_SENTRY_SETUP.md`).
3. **Secrets CI RLS** — les 85 tests RLS ne s'exécutent pas ; depuis SEC-1 le job échoue franchement au lieu de sauter en silence (`docs/architecture/17_CI_RLS_SETUP.md`).
4. **Document protocole ceinture Polar** — `OXV_Ceinture_Protocole_Connexion_Biometrie.md` n'a jamais été livré ; le parser dérive de la spec publique Bluetooth SIG et reste à confronter au document (`bio-2.md:105-109`).
5. **Attribution des premiers numéros de voiture** — geste admin nécessaire avant la prochaine journée circuit (`BILAN_COMPLET_OXV.md`).

### 8. Trois écarts entre l'ordre écrit et l'ordre exécuté

Ils méritent d'être nommés parce qu'ils expliquent la forme actuelle du produit.

Le premier est l'inversion **L0 avant SEC-1 et BE-1**. Elle n'a rien cassé (les trois lots sont livrés le même jour, dans la même fenêtre de quelques heures), mais elle signifie que le kit visuel a été bâti avant que le socle de sécurité et de données ne soit posé.

Le second est **L3 exécuté avant la gate terrain**, sur demande explicite. Conséquence directe et assumée : les six lectures Insight ont été construites puis « de-mockées » à moitié dans la même nuit, et FlowViz reste une démonstration. Le rapport L3 est franc là-dessus : « prod sans ligne d'insight calculée → “données insuffisantes” jusqu'à une séance dense ».

Le troisième est la **levée du drapeau `biometry` avant le smoke test à deux appareils**. Le rapport BIO-2 note que Gabin en a été informé. Le coût s'est matérialisé cinq heures plus tard : les deux fuites de fréquence cardiaque corrigées par `29d5cfd` étaient armées en production pendant cet intervalle, sur une donnée relevant de l'article 9 du RGPD. La note d'atténuation existe et elle est vérifiée : au moment de la levée, zéro consentement de capture, zéro consentement de partage, zéro ligne dans `biometry_raw`.

### 9. Ce que je n'ai pas pu vérifier

**Je n'ai pas exécuté la suite de tests.** Le chiffre de 1 846 tests verts provient du message de commit `29d5cfd` et du document `docs/ETAT_APP_2026-07-26.md` ; je l'ai lu, pas mesuré. J'ai en revanche vérifié par comptage direct les 824 fichiers TypeScript de `app/` + `src/`, les 158 fichiers de tests et les 125 migrations. Je note au passage une **incohérence entre deux rapports** : `v2-l3.md` annonce 1 741 tests le 19/07, tandis que `bio-2.md` en annonce 1 721 le 25/07 — un chiffre en baisse que ni l'un ni l'autre n'explique.

**Je n'ai pas interrogé la base de production.** L'état des drapeaux (`biometry` ON, six autres OFF), la localisation `eu-west-1`, l'existence des crons (jobid 9 purge RGPD, jobid 11 rétention biométrie) et l'application effective des migrations SEC-1, C1, BE-1, L5-B et LIVE-B sont tous rapportés par les documents du dépôt (`13_BE1_ETAT.md`, `SEC1_PROD_APPLY.md`, les rapports de lot). Je ne les ai pas recontrôlés auprès de Supabase.

**Je n'ai pas vérifié l'état des builds EAS.** L'affirmation « six builds attendent un verdict sur device » vient de `docs/ETAT_APP_2026-07-26.md` §7 ; je n'ai aucun moyen de la confirmer depuis le dépôt. De même, la numérotation « build 23 » utilisée dans les commits du 16-17 juillet n'est reliée à aucun artefact vérifiable ici.

**Je n'ai pas ouvert les 51 rapports PR individuellement.** J'ai lu leur liste complète, `m1-closeout.md`, `verification-tail-pr44-49-54-55-65b.md` et les messages de commit correspondants ; le détail écran par écran de la phase 5 repose donc sur les titres de commits et non sur la lecture intégrale de chaque rapport.

**Je n'ai pas ouvert les 16 rapports « semaine ».** La chronologie de la phase 1 est reconstituée depuis les seuls messages de commits, qui portent les numéros de semaine.

**Je n'ai pas retrouvé de trace des lots M2, M4 et M5.** Ni rapport, ni commit portant leur nom. J'ai vérifié leur non-réalisation par un signe indirect et solide pour M4 (la table `events` est toujours interrogée par `src/services/eventsService.ts`, y compris depuis deux écrans V2), mais je n'ai pas vérifié l'état des buckets `coach-media` et `partner-media` en production pour M5.

**Les 26 constats restants de l'audit coach du 26/07 ne sont documentés nulle part** dans le dépôt en dehors du message de commit de `29d5cfd`. Je ne peux ni les lister, ni les qualifier, ni dire lesquels touchent quels écrans.

---

## Connexion, réseau et transport

Cette section décrit tout ce qui relie l'application au monde extérieur : le compte du pilote, la base de données, le direct, le boîtier Bluetooth, la survie hors-ligne et les fournisseurs tiers. Chaque affirmation a été vérifiée en ouvrant le fichier cité ; les chemins sont donnés pour que vous puissiez retourner à la source.

### Vue d'ensemble : sept canaux, et rien d'autre

L'application ne parle qu'à sept interlocuteurs. Il n'existe aucun autre point de sortie réseau dans le code (recherche exhaustive des appels `fetch(` et des URL littérales dans `src/` et `app/`).

| Canal | Interlocuteur | Rôle | Fichier d'entrée |
|---|---|---|---|
| Base de données, authentification, fichiers, direct | Supabase | Cœur du produit | `src/lib/supabase.ts` |
| Radio courte portée | RaceBox Mini S, ceinture Polar | Télémétrie et cardio | `src/ble/bluetoothService.ts` |
| Météo | Open-Meteo | Conditions du roulage | `src/services/weatherService.ts` |
| Itinéraires sinueux | GraphHopper (ou Kurviger) | Écran « Belle route » | `src/services/routing/scenicRouteService.ts` |
| Points de vue | Overpass / OpenStreetMap | Waypoints remarquables et tracés de circuit | `src/services/routing/scenicPoiService.ts`, `src/circuit/circuitGenerator.ts` |
| Mesure d'audience | Plausible | Comptage anonyme | `src/services/analyticsService.ts` |
| Remontée d'erreurs et notifications | Sentry, Expo Push | Diagnostic et rappels | `src/lib/sentry.ts`, `src/services/pushNotificationsService.ts` |

---

### 1. L'authentification

#### Le mécanisme

Il n'y a qu'un seul mécanisme de connexion réellement fonctionnel : **email et mot de passe**, contre Supabase Auth. L'écran est `app/(auth)/login.tsx` ; il appelle `signIn` du magasin `src/store/useAuthStore.ts`, qui appelle `supabase.auth.signInWithPassword`. Il n'y a ni écran d'inscription, ni mot de passe oublié dans `app/(auth)/` : le dossier ne contient que trois fichiers, `_layout.tsx`, `login.tsx` et `lier.tsx`. Un compte se crée donc ailleurs — sur le site — et l'application se contente de s'y connecter.

Le second chemin est l'**appairage par code du site** (`app/(auth)/lier.tsx`, service `src/services/pairingService.ts`). Le pilote génère un code court de huit caractères sur oxvehicle.fr, le saisit dans l'application ; celle-ci le poste à la fonction serveur `pair-app`, qui le consomme et renvoie un `token_hash` ; l'application échange ce jeton contre une session via `supabase.auth.verifyOtp({ type: 'magiclink' })`. Le code est valable dix minutes et le serveur limite à dix tentatives par minute et par adresse IP (indiqué dans l'en-tête du service ; je n'ai pas ouvert le code de la fonction serveur pour le confirmer). Un lien profond `oxv://lier?code=XXXXXXXX` pré-remplit le champ, ce qui permet au site de proposer un bouton « Ouvrir dans l'app ». Le schéma `oxv` est bien déclaré dans `app.json` ligne 8.

#### Sign in with Apple : déclaré, jamais écrit

C'est un point important et net. Le paquet `expo-apple-authentication` est installé (`package.json` ligne 48), le module est déclaré comme plugin Expo (`app.json` ligne 74) et l'option `usesAppleSignIn: true` est posée pour iOS (`app.json` ligne 19). **Mais aucune ligne de code de l'application ne l'utilise.** Une recherche sur tout le dépôt de `AppleAuthentication`, `signInWithIdToken` et `signInWithOAuth` ne remonte que : des copies dans `.claude/worktrees/`, la ligne de `package.json`, et une note de `docs/architecture/07_CODE_V1_RECUPERE.md` qui dit « peut être V1.1 ». Autrement dit, la plomberie native est prête, le bouton n'existe pas. C'est un sujet à connaître : Apple exige Sign in with Apple dès qu'une application propose une connexion par un tiers ; ici il n'y en a pas, donc l'exigence ne s'applique probablement pas, mais la déclaration `usesAppleSignIn` sans implémentation peut interroger un examinateur.

#### Où vivent les jetons

Les jetons de session sont stockés dans **`expo-secure-store`**, c'est-à-dire le trousseau chiffré de l'appareil (Keychain sur iOS, Keystore sur Android). L'adaptateur est écrit à la main dans `src/lib/supabase.ts` lignes 24-28 et branché sur l'option `storage` du client. Le commentaire d'en-tête de `src/lib/mmkv.ts` explicite la règle : **les jetons ne passent jamais par MMKV**, qui ne contient que du cache de lecture et une file d'écritures non sensibles. Sur iOS, la permission Face ID nécessaire au trousseau est déclarée (`app.json` lignes 104-109).

#### Ce qui se passe à l'expiration

Le client est configuré avec `autoRefreshToken: true` et `persistSession: true` (`src/lib/supabase.ts` lignes 33-34) : la bibliothèque rafraîchit donc le jeton d'accès en tâche de fond tant qu'elle tourne. Le magasin d'authentification installe un écouteur `supabase.auth.onAuthStateChange` (`src/store/useAuthStore.ts` lignes 94-107) : dès qu'une session nulle arrive — déconnexion, ou rafraîchissement définitivement échoué — l'état bascule sur `unauthenticated`. Les gardes de navigation renvoient alors au login : `app/index.tsx` (ligne « `if (status !== 'authenticated') return <Redirect href="/(auth)/login" />` ») et `app/(app2)/_layout.tsx` lignes 73-75, qui commente explicitement ce cas.

Un détail technique mérite d'être noté, car il est factuel et vérifiable : **il n'y a nulle part d'écouteur `AppState` appelant `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()`**. La recherche de `startAutoRefresh` dans `src/` et `app/` ne renvoie rien ; les seules occurrences d'`AppState` sont le nom du magasin `useAppStateStore`, sans rapport. C'est le motif que Supabase recommande en React Native pour que le rafraîchissement suive les passages en arrière-plan. Je décris, je ne juge pas : le rafraîchissement repose ici uniquement sur la minuterie interne de la bibliothèque.

Le cas « échec de l'initialisation » est traité à part et proprement : `app/index.tsx` affiche un écran « Connexion impossible / Vérifiez votre réseau, puis réessayez » avec un bouton qui relance `initialize()`, au lieu de rejeter silencieusement au login.

#### Le profil et les rôles

À chaque authentification, `fetchProfile` (`src/store/useAuthStore.ts` lignes 55-70) lit quatorze colonnes de la table `users` : identité, `role`, `is_admin`, `pilot_level`, et les six horodatages d'acceptation (pacte pilote, pacte coach, CGU, confidentialité) avec leurs versions. Un rôle absent retombe sur `pilot`. Cinq rôles existent : `pilot`, `admin`, `coach`, `partner`, `pro_pilot`. `app/index.tsx` aiguille ensuite vers l'espace correspondant, en passant d'abord par l'onboarding si `isOnboardingComplete` est faux.

---

### 2. Le client Supabase

#### Configuration

Un client unique pour toute l'application, créé dans `src/lib/supabase.ts` (42 lignes). Il est **typé** contre `@/types/database.types`, ce qui signifie que les erreurs de nom de colonne sont attrapées à la compilation. Il porte un en-tête d'identification `X-Client-Info: oxv-coach-mobile`, ce qui permet de distinguer le trafic de l'application de celui du site dans les journaux Supabase. `detectSessionInUrl` est désactivé, ce qui est correct pour du mobile.

Le fichier **lève une exception au chargement** si `EXPO_PUBLIC_SUPABASE_URL` ou `EXPO_PUBLIC_SUPABASE_ANON_KEY` manquent, avec un message en français expliquant quoi faire. C'est un choix assumé : l'application ne démarre pas plutôt que de démarrer à moitié. Un fichier `.env` existe bien à la racine (540 octets, daté du 25 juin) ; je ne l'ai pas ouvert, son contenu étant du secret. `.env.example` (7 365 octets) documente vingt-cinq variables, dont beaucoup ne concernent que le serveur.

#### La région d'hébergement : une contradiction dans le dépôt

Le dépôt se contredit sur ce point, et il faut le dire plutôt que trancher à sa place.

| Source | Région annoncée |
|---|---|
| `src/lib/supabase.ts` ligne 5 (commentaire) | Frankfurt |
| `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md` ligne 534 | eu-central-1 / Frankfurt |
| `docs/architecture/03_PARTIE_3_deploiement.md` ligne 678 | Frankfurt |
| `docs/alpha/GUIDE_PILOTE_ALPHA.md`, `docs/app_store/KIT_APP_STORE_OXV_MIRROR.md` | Frankfurt (texte destiné aux pilotes) |
| `docs/architecture/14_PURGE_MATRIX.md` ligne 3 (audit du 19/07/2026) | **eu-west-1** |
| `docs/architecture/15_EDGES_REGISTRY.md` ligne 4 | **eu-west-1** |

Les documents les plus récents (juillet 2026, audits menés en lecture directe sur la production) disent eu-west-1, c'est-à-dire l'Irlande. Les documents anciens et surtout **les textes lus par vos pilotes et par Apple** disent Frankfurt. Les deux régions sont dans l'Union européenne, donc l'engagement RGPD tient dans les deux cas, mais deux documents publics annoncent une ville qui n'est peut-être plus la bonne. Je n'ai pas interrogé la production pour trancher.

#### Les surfaces Supabase utilisées

L'application se sert de cinq surfaces distinctes du même produit.

| Surface | Usage | Ampleur constatée |
|---|---|---|
| Base (PostgREST, `from()`) | Toutes les lectures et écritures métier | Omniprésent, dans presque tous les services |
| Fonctions serveur (`functions.invoke`) | 5 fonctions appelées | `pair-app`, `compute-session-insights`, `generate-debrief-ai`, `cron-analyze-pending-sessions`, `send-coach-invitation`, `coach-ai-draft`, `coach-ai-validate` |
| Procédures (`rpc`) | 7 points d'appel | `get_shared_progression`, `founders_count`, `oxv_get_my_referral_code`, `oxv_redeem_referral`, `oxv_name_my_crew`, `oxv_my_crew_id`, `coach_ai_consent`, plus une séquence de facturation |
| Fichiers (Storage) | 5 seaux | `telemetry_raw`, `session-media`, `pilot-media`, `coach-media`, `coach-audio` |
| Temps réel | Voir section 3 | 3 familles de sujets, plus 2 abonnements aux changements de table |

Le dossier `supabase/functions/` contient **32 fonctions**, dont sept seulement sont appelées depuis l'application. Les vingt-cinq autres sont déclenchées par le site, par des tâches planifiées ou par des webhooks (emails Resend, confirmations de réservation, rappels d'éligibilité, purge des comptes supprimés). Elles font partie du système mais ne passent pas par l'application mobile.

Le dossier `supabase/migrations/` contient **125 fichiers**, ce qui confirme le chiffre du repère.

---

### 3. Le temps réel

C'est la partie la plus soignée, et la plus subtile, de la couche réseau. Elle sert le direct coach et le tableau de marche du paddock.

#### Les sujets

Il existe **trois sujets** de temps réel « métier », tous définis en haut de `src/services/liveSessionService.ts` (475 lignes), plus deux abonnements classiques aux changements de table.

| Sujet | Type | Qui émet | Qui écoute | Contenu |
|---|---|---|---|---|
| `live:roster:<coachId>` | Présence | Le pilote, une fois par coach consenti | Le coach, uniquement le sien | Prénom, circuit, indicateur « cardio partagé » |
| `live:session:<sessionId>` | Diffusion | Le pilote propriétaire de la séance | Le ou les coachs du binôme consenti | Trames de pilotage (événement `frame`) et cardio (événement `biometry`) |
| `live:board:<sessionId>` | Diffusion | Le pilote propriétaire | Audience élargie (écran du paddock) | Pseudo public, numéro de voiture, durées de tour — jamais de santé |
| `thread:<coachPilotId>` | Changements de table | Postgres | Les deux membres du binôme | Nouveaux messages du fil coach↔pilote (`src/hooks/useCoachThread.ts`) |
| `relay-consent:<pilotId>` | Changements de table | Postgres | Le pilote en séance | Révocation de consentement en vol (`src/services/liveRelayRunner.ts` lignes 361-382) |

Le choix d'un roster **par coach** plutôt que d'un roster global est explicitement un durcissement de confidentialité daté du 11 juillet 2026 : un coach ne voit que les pilotes qui lui ont consenti le direct, à lui personnellement.

#### L'autorisation, côté serveur

Les trois sujets métier sont ouverts en mode **privé** (`{ config: { private: true } }`), ce qui veut dire que Supabase applique une politique de sécurité au niveau de la ligne sur la table système `realtime.messages`. Deux migrations écrivent ces politiques :

`supabase/migrations/20260711181903_live_realtime_authorization.sql` pose quatre règles. Recevoir le flux d'une séance exige d'être un coach du binôme actif **et** consenti au direct (jointure `telemetry_sessions` × `coach_pilots`, conditions `active` et `live_sharing_at IS NOT NULL`). Émettre exige d'être le pilote propriétaire de la séance. Lire un roster exige que l'identifiant dans le nom du sujet soit le sien. Se déclarer dans un roster exige le consentement au direct chez ce coach précis.

`supabase/migrations/20260725190000_live_board_realtime_authorization.sql` pose deux règles pour le tableau de marche, et son en-tête de 50 lignes est un document en soi. Il énonce que **la règle de contenu — aucune donnée de santé sur ce canal — ne peut pas s'écrire en SQL**, parce que le serveur ne lit pas le corps des messages ; elle est donc applicative et tenue par `stripHealth()` dans `src/services/v2/liveHealthGate.ts`, appliquée deux fois (à l'émission par le relais, et à nouveau par le service lui-même, l'opération étant idempotente). Il énonce aussi une **limite assumée** : le cahier voulait que tout inscrit de la journée puisse lire le tableau, mais aucune colonne ne relie une séance de télémétrie à une journée de roulage. Plutôt que de rapprocher par circuit et date — « une devinette », dit le commentaire — l'audience a été refermée sur le pilote et ses coachs consentis, en attendant une décision de schéma. **Le tableau de marche du paddock n'est donc, aujourd'hui, pas lisible par le paddock.**

#### Pourquoi les canaux sont comptés

Le comptage de références n'est pas une élégance, c'est une correction de bogue documentée. La bibliothèque `supabase-js` **dédoublonne les canaux par sujet** : deux appels à `supabase.channel('live:session:42')` renvoient la même instance. Depuis que le roster du coach lit le cardio pendant que la fiche direct lit les trames, deux consommateurs partagent la même instance. Sans comptage, le premier `removeChannel` arrache le canal à l'autre : fermer la fiche direct tuait le cardio du roster. Pire, le second abonné, branché sur un canal déjà souscrit, ne recevait jamais son événement `SUBSCRIBED` et affichait « hors ligne » sur un flux pourtant vivant.

La solution, appliquée à l'identique aux trois sujets (`ensureRoster`, `ensureSession`, `ensureBoard`) : une carte par identifiant, un compteur `refs`, la diffusion des événements à tous les inscrits, le **rejeu du statut courant** à l'arrivée d'un retardataire, et la libération du canal seulement au départ du dernier. Chaque fonction de désabonnement est en outre **idempotente** (drapeau `released`), parce que sur un sujet compté un double appel décrémenterait deux fois et arracherait le canal aux autres.

Un mécanisme voisin protège le relais côté pilote : `relayGeneration` dans `src/services/liveRelayRunner.ts` (lignes 37-53). Le démarrage du relais est asynchrone et enchaîne plusieurs requêtes avant d'ouvrir le moindre canal ; si la capture s'arrête pendant ces attentes, l'arrêt ne trouve rien à couper et le démarrage en vol ouvrirait ensuite des canaux que personne ne fermerait jamais — y compris le canal du tableau de marche, qui continuerait de diffuser après la séance. Chaque démarrage prend donc un numéro, et tout arrêt l'invalide.

#### Le triple verrou de la biométrie

Le cardio ne part vers un coach que si trois conditions sont vraies **à chaque émission**, revérifiées toutes les deux secondes et non une seule fois au démarrage (`src/services/liveRelayRunner.ts` lignes 296-350) : le drapeau `biometry` est actif en base, le pilote a consenti la capture *et* le partage au coach, et **tous** les coachs à l'écoute sont au niveau « lecture détaillée ». Ce dernier point a été corrigé le 26 juillet après audit : la règle valait auparavant « au moins un coach écoute », ce qui laissait passer la fréquence cardiaque vers un coach en lecture simple. Le commentaire explique que la biométrie voyageant sur le canal de séance partagé, la seule position tenable est le tout ou rien, et que la réponse propre serait un canal par coach — à faire avant d'élargir.

Côté réception, `src/hooks/usePilotLive.ts` **périme** le cardio au bout de dix secondes sans événement : révocation en vol, ceinture décrochée ou réseau tombé effacent l'affichage au lieu de figer la dernière valeur. Même logique dans `src/hooks/useRosterBiometry.ts`, qui réconcilie ses abonnements en delta pour ne pas réinitialiser la plage observée d'un pilote quand un autre arrive.

#### Un point non vérifié

Les deux abonnements aux changements de table (`coach_messages`, `coach_pilots`) exigent que ces tables soient inscrites dans la publication `supabase_realtime`. **Aucune migration du dépôt ne fait cette inscription** (recherche de `ALTER PUBLICATION` dans `supabase/migrations/` : aucun résultat). Soit elle a été faite à la main dans la console Supabase, soit ces deux abonnements ne reçoivent rien. Je n'ai pas pu le déterminer depuis le dépôt.

#### Le simulateur

`startSimulatedStream` (`src/services/liveSessionService.ts` lignes 440-475) émet un flux plausible à environ 3 Hz — chrono qui monte, secteurs, vitesse et forces G crédibles, un virage « à surveiller » de temps en temps — pour développer l'interface coach sans RaceBox ni réseau de circuit.

---

### 4. Le Bluetooth

#### Deux chemins strictement séparés

`src/ble/bluetoothService.ts` (833 lignes) porte les deux liaisons radio, mais avec **deux états entièrement disjoints** : device, abonnements, minuterie de reconnexion et drapeau de coupure volontaire sont dupliqués côté RaceBox et côté Polar. L'intention est écrite noir sur blanc lignes 25-31 : « aucun couplage d'échec — la ceinture tombe, la capture télémétrique reste intacte, et réciproquement ». Une double connexion simultanée est assumée.

| | RaceBox Mini S | Ceinture Polar |
|---|---|---|
| Service BLE | `6E400001-…` (UART Nordic) | `0000180d-…` (Heart Rate standard) |
| Caractéristique écoutée | TX `6E400003-…` | Mesure `00002a37-…` |
| Filtre de scan | Service + préfixe de nom RaceBox | Service + préfixe de nom « Polar » |
| Décodage | `src/ubx/parser.ts` (trames UBX, resynchronisation) | `src/services/v2/heartRateParser.ts` (fonction pure testée) |
| Reconnexion | Bornée hors capture, **illimitée** en capture | Toujours bornée |

Une trame cardio tronquée est silencieusement ignorée ; une trame UBX invalide est écartée par le tampon de resynchronisation.

#### La politique de reconnexion

`src/ble/reconnectPolicy.ts` (55 lignes) est du code pur, sans dépendance native, donc testable sans radio. Il expose deux décisions.

Le **délai** suit un retrait géométrique plafonné : 2 s, 4 s, 8 s, 16 s, puis 30 s au maximum, quel que soit le mode. Le plafond existe pour ne pas marteler la radio sur une coupure longue.

L'**abandon** dépend du mode. En mode borné (hors capture), on renonce après cinq tentatives et l'état passe à `lost`. En **mode illimité**, on ne renonce jamais.

#### Le mode illimité pendant la capture

C'est le durcissement « Valence ». `bluetoothService.setUnlimitedReconnect(true)` est appelé à l'armement de la capture (`src/services/captureSessionService.ts` ligne 410) et désarmé aux trois sorties possibles : arrêt normal (ligne 738), abandon (ligne 833), et clôture après interruption prolongée. Pendant la capture, une coupure ne devient donc **jamais** terminale.

Ce que fait l'application pendant le trou, décrit dans `handleReconnect` (lignes 437-470) : la séance passe en statut `interrupted`, les compteurs affichés sont mis en pause — pour ne pas laisser croire qu'on enregistre alors que le boîtier a décroché —, le début du trou est horodaté, et un **timeout long de quinze minutes** est armé. Si le lien revient, on reprend, on annule le timeout, et on trace la durée du trou dans la console. Si quinze minutes passent sans reprise, la séance est clôturée proprement, exactement comme si le pilote l'avait arrêtée. `src/services/captureLinkStatusLogic.ts` traduit ces états en deux messages sobres à l'écran : « LIEN INTERROMPU — Reconnexion au boîtier en cours » et « LIEN PERDU — Votre session a été enregistrée jusqu'ici ».

L'écran est maintenu allumé pendant toute la capture (`expo-keep-awake`, tag `oxv-capture`), parce que la capture tourne au premier plan : `app.json` déclare explicitement `isBackgroundEnabled: false` pour le module BLE (ligne 78). Le commentaire de `captureSessionService.ts` lignes 101-108 assume ce choix et renvoie l'arrière-plan BLE à des droits Apple à demander plus tard.

#### La deuxième couche : le chien de garde

`src/ble/initBle.ts` (198 lignes) branche le service sur les magasins et pose une **seconde** logique de reconnexion, plus ancienne, avec son propre retrait (2, 5, 10, 20 s) et son propre seuil de 30 secondes. Les deux couches sont coordonnées explicitement : quand le service est déjà en train de reconnecter (`isReconnecting()`), le chien de garde se contente de refléter l'état et **ne programme pas un second appel concurrent** (lignes 122-126). Sa vraie valeur ajoutée aujourd'hui est la **modal #25** (`src/components/BleErrorModal.tsx`), qui propose au pilote de réessayer manuellement (`manualReconnect`) ou de continuer sans équipement (`abandonReconnect`, qui oublie le boîtier pour couper toute reconnexion future).

#### Permissions et disponibilité

`src/ble/permissions.ts` demande `BLUETOOTH_SCAN` et `BLUETOOTH_CONNECT` sur Android 12 et plus, `ACCESS_FINE_LOCATION` en dessous, et la permission Bluetooth sur iOS. Les neuf permissions Android et les descriptions iOS sont déclarées dans `app.json` lignes 20-31 et 60-70.

Le module natif est chargé **paresseusement** (`loadBleManagerCtor`, lignes 43-51) : si `react-native-ble-plx` est absent — cas d'Expo Go — le service ne plante pas, il devient inerte et répond « Bluetooth indisponible dans ce runtime ». `app/_layout.tsx` ne l'initialise d'ailleurs pas du tout sous Expo Go (`if (!isExpoGo())`, ligne 51).

#### Le bouton Flic 2 : un mannequin

`src/ble/flic2Service.ts` (88 lignes) est un **stub assumé**. Le commentaire d'en-tête l'explique : la vraie intégration passe par le SDK natif de Flic, pas par du BLE nu, leurs caractéristiques n'étant pas documentées publiquement. Le service expose la bonne API (`scan`, `connect`, `onClick`), mais `scan()` ne trouve jamais rien et seul `simulateClick()` déclenche un événement. Le marquage manuel par bouton physique n'existe donc pas aujourd'hui.

---

### 5. Le hors-ligne

Le hors-ligne n'est pas un mode dégradé ici, c'est le mode de référence : le circuit est un endroit sans réseau.

#### La détection

`src/lib/netinfo.ts` (63 lignes) branche un écouteur unique au démarrage — pas un hook React, pour éviter les contextes multiples. Il considère qu'on est en ligne si `isConnected` est vrai **et** que `isInternetReachable` n'est pas explicitement faux. Il alimente la condition `network` du magasin d'état et la bannière hors-ligne. Surtout, **au retour du réseau après une coupure**, il déclenche les deux files : `flushQueue()` pour les petites actions et `processQueue()` pour la capture. Une lecture initiale est faite au démarrage, au cas où l'application se lance déjà hors ligne.

#### La file de capture : des fichiers, pas de la mémoire

`src/services/captureSyncQueue.ts` (1 234 lignes) est la pièce centrale. Contrairement à la file MMKV, elle persiste **une opération par fichier JSON** dans `capture-queue/` sous le répertoire documents — parce qu'une séance produit des dizaines de milliers de trames, plusieurs mégaoctets.

L'ordre est un FIFO strict garanti par le nom de fichier : `horodatage(15)-séquence(6)-type.json`. L'horodatage est rendu monotone dans un même lancement, la séquence casse les ex æquo, et le tri lexicographique des noms reproduit exactement l'ordre d'insertion. Au relancement de l'application, les opérations d'un lancement précédent portent un horodatage antérieur et sont donc drainées en premier. L'écriture est **atomique** : fichier `.tmp` puis déplacement (`writeEnvelopeAtomic`, lignes 338-344), et les `.tmp` orphelins laissés par un crash sont balayés au démarrage.

Six types d'opérations circulent : `create_session`, `attach_intention`, `frames`, `laps`, `complete`, `ubx_upload`.

Le drain (`drainOnce`, lignes 752-834) traite les fichiers dans l'ordre, supprime chaque succès, et applique trois comportements distincts en cas d'échec.

**Il s'arrête** au premier échec réseau ou transitoire, en gardant tout le reste — « on ne martèle pas un réseau tombé ».

**Il met en quarantaine** — déplacement sous `capture-queue/quarantine/`, jamais suppression — les échecs réellement logiques, et remonte l'incident à Sentry.

**Il saute** un `ubx_upload` en échec sans bloquer la file, parce que c'est une opération feuille dont rien ne dépend, jusqu'à dix tentatives.

La classification des erreurs (lignes 399-494) est une **liste blanche d'abandon**, et c'est une inversion volontaire par rapport à une version antérieure où « tout code d'erreur valait abandon », règle qui faisait détruire une séance entière sur un simple 503. Aujourd'hui : tout code inconnu est traité comme transitoire, donc conservé. Les codes 23503 (clé étrangère) et 23505 (unicité) sont explicitement exclus de l'abandon, le premier étant un signal d'ordonnancement et non une erreur de donnée. Les erreurs Storage sont traitées à part, car la bibliothèque de fichiers n'expose pas de `.code` : seuls 400, 413 et 415 sont abandonnés, jamais 401 ni 403, qui sont réparables. Et une **garde dure** interdit d'abandonner un `create_session` en toutes circonstances, puisque cette ligne porte la clé étrangère de toutes les trames en cascade : mieux vaut une file bloquée, visible et réparable, que des heures de piste effacées en silence.

L'idempotence au rejeu est assurée type par type : `create_session` par upsert sur l'identifiant, `frames` et `laps` par upsert « ne rien faire en cas de conflit » sur les clés naturelles, `complete` par une mise à jour qui **recompte** les trames réellement en base, `ubx_upload` par un envoi en écrasement. Un repli automatique est prévu si la contrainte d'unicité n'est pas encore appliquée en production (erreur 42P10), avec réarmement dès qu'un 23505 prouve que la migration est passée.

Le choix de la clé d'idempotence des trames fait l'objet de trente lignes de justification (lignes 58-90) : `(session_id, elapsed_ms)` a été retenu contre `(session_id, itow_ms)`, parce que l'iTOW est un temps GPS produit par le boîtier, qui peut se répéter avant fix et se réenroule chaque dimanche — fonder l'identité d'une donnée de pilote sur une valeur qu'on ne contrôle pas et dont on ne peut pas prouver l'unicité aurait détruit des trames réelles en silence.

#### La file des petites actions

`src/services/offlineQueue.ts` (207 lignes) est l'autre file, beaucoup plus légère, stockée dans MMKV sous la clé `queue:offline`. Elle porte six types d'actions : acceptation du pacte pilote, du pacte coach, des CGU et de la confidentialité, marquage d'une notification lue, enregistrement d'un marqueur de tour, mise à jour du niveau pilote. Cinq tentatives maximum, puis abandon avec un simple avertissement en console — **il n'y a pas de lettre morte ici**, et l'en-tête l'assume : « si une action échoue 5 fois, on la perd ». Deux des six actions (`mark_notification_read`, `register_lap_marker`) sont des emplacements réservés qui ne font rien côté serveur.

#### MMKV

`src/lib/mmkv.ts` (90 lignes) définit un magasin unique `oxv-coach-cache`, synchrone et persistant. Il porte du cache de lecture avec expiration (dernières séances, profil, circuits), la file ci-dessus, l'intention de séance en attente, et une préférence d'affichage. La clé `pending:intention` mérite mention : elle gèle localement l'identifiant et la date de l'intention posée en préparation, précisément pour que le rattachement à la séance puisse se faire **sans aucun appel réseau** au démarrage de la capture — donc en mode avion, où la lecture équivalente échouerait.

#### Les deux registres séparés

Deux mécanismes locaux supplémentaires existent, et tous deux portent en tête la même **règle cardinale** : ils ne touchent jamais `captureSyncQueue`.

`src/features/rec/incidentOffline.ts` (165 lignes) tient les signalements d'incident en attente, sous la clé MMKV `rec:incident-offline-queue`. Il déduplique par identifiant local, persiste après **chaque** succès, et relit la file depuis le stockage avant chaque retrait — de sorte qu'une déclaration ajoutée pendant le rejeu n'est jamais écrasée.

`src/features/rec/biometryCaptureBuffer.ts` (159 lignes) tient les échantillons cardio d'une séance sous le préfixe `rec:biometry:samples:`, plus un registre des séances en attente. Il écarte les lectures hors de la plage physiologique 25-250 bpm, qui sont des décrochages de capteur et non des mesures. Le runtime associé (`src/services/biometryCaptureRunner.ts`) persiste toutes les quelques secondes et ne tente l'envoi qu'à la clôture ; un abandon de séance **purge** le local sans rien préserver, au titre de la minimisation.

#### Le filet de dernier recours

En parallèle de tout ce qui précède, `src/ble/captureMode.ts` écrit **tous les octets bruts** reçus du RaceBox dans un fichier `.ubx` local sous `fixtures/`. Ce fichier n'est pas supprimé après l'envoi : il reste le filet de reprise, et n'est effacé que **par âge** (sept jours) par `gcOldCaptures`, sous trois verrous — la file doit être vide, le fichier ne doit pas être référencé par une opération en attente, et son nom doit être lisible. `reimportUbxToFrames` permet de rejouer un `.ubx` vers la base a posteriori, en réconciliant cette fois sur `itow_ms`, l'identité physique de la trame.

#### Bilan : ce qui survit et ce qui ne survit pas

| Élément | Survit à une coupure réseau | Survit à un crash / redémarrage | Perte possible |
|---|---|---|---|
| Trames de télémétrie | Oui (fichiers) | Oui (fichiers sur disque, ordre préservé) | Non, sauf quarantaine |
| Création de séance | Oui | Oui | Jamais abandonnée (garde dure) |
| Tours détectés | Oui | Oui | Non |
| Fichier `.ubx` brut | Oui (purement local) | Oui | Après 7 jours, sous 3 verrous |
| Cardio | Oui (MMKV par séance) | Oui | Purgé si la séance est abandonnée |
| Signalements d'incident | Oui (MMKV) | Oui | Non |
| Acceptation du pacte, CGU, niveau pilote | Oui (MMKV) | Oui | **Oui, après 5 échecs** |
| Trames pendant une coupure BLE | Sans objet | Sans objet | **Oui — rien n'est enregistré pendant le trou**, seule sa durée est tracée en console |
| Envoi du `.ubx` | Oui | Oui | Quarantaine après 10 tentatives |

---

### 6. Les services externes

#### Météo — Open-Meteo

`src/services/weatherService.ts` (380 lignes) interroge `https://api.open-meteo.com/v1/forecast`, **sans clé**, service européen dont les sources sont Météo-France, DWD et ECMWF. Cache mémoire de dix minutes par coordonnées arrondies à trois décimales. La règle doctrinale « A-WEATHER-1 » y est appliquée strictement : **une mesure absente vaut `null`, jamais un zéro fabriqué**, et les écrans affichent alors un tiret. La visibilité est explicitement `null` parce qu'Open-Meteo ne la fournit pas en mesure courante. Les vingt-huit codes météo WMO sont traduits en français.

#### Itinéraires — GraphHopper, ou Kurviger

`src/services/routing/scenicRouteService.ts` accepte deux fournisseurs, pilotés par `EXPO_PUBLIC_ROUTING_PROVIDER` (défaut : `graphhopper`). GraphHopper est appelé en POST sur `https://graphhopper.com/api/1/route` avec un modèle de coût personnalisé qui privilégie les routes sinueuses ; Kurviger en GET sur `https://api.kurviger.de/v1/route`. **Sans clé configurée, la fonction renvoie `null` et l'écran tombe sur un état vide** — elle ne plante pas. La clé n'est pas dans `.env.example` (champ laissé vide), donc l'écran « Belle route » est vraisemblablement inerte aujourd'hui, mais je ne peux pas le confirmer sans lire le `.env`.

#### Points remarquables et tracés — OpenStreetMap

`src/services/routing/scenicPoiService.ts` interroge `https://overpass-api.de/api/interpreter` en POST, sans clé, pour lister les points de vue, plans d'eau, cols et sommets dans un rayon. `src/circuit/circuitGenerator.ts` interroge `https://api.openstreetmap.org/api/0.6/way/<id>/full.json` pour importer le tracé d'un circuit ; il est utilisé par l'écran `app/(app)/creer-trace.tsx`. Les deux renvoient une liste vide ou lèvent proprement en cas d'erreur.

#### Cartes

Deux fournisseurs selon la plateforme. **iOS utilise Apple Maps** via `PROVIDER_DEFAULT`, sans aucune clé. **Android exige une clé Google Maps**, injectée au build par `app.config.js` depuis la variable `GOOGLE_MAPS_ANDROID_KEY` — un secret EAS en CI, le `.env` en local. Si la variable est absente, aucune clé n'est injectée et les cartes Android restent grises ; le reste de l'application fonctionne. Trois écrans utilisent `react-native-maps` : `app/(app)/carte-oxv.tsx`, `app/(app)/creer-route.tsx`, `app/(app2)/club/territoire.tsx`. Ce dernier ouvre par ailleurs un lien externe `https://www.google.com/maps/dir/?api=1&destination=…` pour l'itinéraire vers un point.

#### Mesure d'audience — Plausible

`src/services/analyticsService.ts` (118 lignes) poste des événements anonymes à `https://plausible.io/api/event`, en « tire et oublie » : la réponse n'est pas attendue et un échec est avalé. Trois garde-fous sont en place. Le service est **totalement inactif** tant que `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` est vide. Un opt-out local est respecté (clé MMKV `analytics.optOut`). Et une **garde anti-données personnelles** lève une exception en développement si une propriété d'événement porte une clé interdite (`email`, `name`, `first_name`, `last_name`, `handle`, `phone`, `iban`) — la garde s'exécute avant même le court-circuit « domaine absent », pour jouer aussi quand Plausible n'est pas configuré. L'URL envoyée est un pseudo-URL `app://oxv-mirror/<événement>`.

Le domaine `oxvehicle.fr` est renseigné dans `eas.json` pour les profils **preview et production** : la mesure est donc active dans les builds distribués, pas en développement.

#### Remontée d'erreurs — Sentry

`src/lib/sentry.ts` (58 lignes). L'initialisation est **triplement conditionnelle** : rien en développement, rien sans `EXPO_PUBLIC_SENTRY_DSN`, sinon initialisation avec traces à 100 %. L'en-tête précise un point d'état important : **le plugin Expo de Sentry a été retiré d'`app.json` en semaine 14** à cause d'un conflit Gradle. Le module natif reste fourni par l'autolinking, donc la capture fonctionne au runtime dès qu'un DSN est présent ; ce qui n'est plus câblé, c'est l'auto-instrumentation et l'envoi des sources maps — à reconfigurer le jour où Sentry sera réellement activé. Le DSN n'est nulle part dans le dépôt : il doit venir des variables d'environnement EAS, et le poser est décrit comme une action fondateur (`docs/architecture/16_SENTRY_SETUP.md`, que je n'ai pas ouvert). `captureException` est appelé aux points sensibles de la file de capture (quarantaine, abandon d'envoi, échec de reprise).

#### Notifications — Expo Push

`src/services/pushNotificationsService.ts`. La stratégie V1 est celle des **notifications locales** : le debrief du lendemain et le rappel de veille sont programmés sur l'appareil, sans dépendance serveur ni coût. Le jeton Expo Push est néanmoins enregistré dans `users.expo_push_token` — et seulement s'il a changé — pour préparer un envoi distant ultérieur. Le doctrinal est tenu au niveau du gestionnaire : en état `S6_roulage`, toute notification arrivant au premier plan est supprimée, bannière, son et pastille compris. L'enregistrement est ignoré sous Expo Go et sur émulateur. `app/_layout.tsx` lignes 86-144 route ensuite le tap sur notification vers neuf destinations différentes selon le champ `type` de la charge utile.

#### Aperçu web dans l'application

`app/(coach)/ar.tsx` charge `https://app.oxvehicle.fr/ar-view` dans une WebView. Le commentaire d'en-tête précise que la donnée sensible est rendue en natif et **n'est jamais passée à la WebView ni ajoutée à l'URL**, et que la route web peut ne pas être en ligne, auquel cas un repli sobre s'affiche. Je n'ai pas vérifié si cette route existe réellement.

#### Partage public

`src/services/sharesService.ts` génère des liens `https://oxvehicle.fr/share/<token>`, avec un jeton de 192 bits tiré de `crypto.getRandomValues`. La lecture côté site passe par la procédure `get_shared_progression`.

#### Apple Health

Ce n'est pas du réseau, mais c'est une entrée de données extérieure. `src/services/v2/healthKitService.ts` enveloppe `react-native-health`, iOS seulement, résolution **dynamique** du module pour qu'un binaire compilé avant l'installation retombe proprement sur « indisponible » plutôt que d'échouer au chargement. La lecture est barrée par le consentement de capture, en mode fermé par défaut. L'en-tête est explicite : « il ne fonctionnera qu'après un build natif ».

---

### 7. Ce que le transport n'a pas

Pour être complet, voici ce que j'ai cherché et **pas** trouvé, ce qui est aussi une information sur l'état réel.

Il n'y a **aucun serveur intermédiaire propre à OXV** : l'application parle directement à Supabase et aux quatre API publiques. Il n'y a **aucun WebSocket hors Supabase Realtime**. Il n'y a **aucune synchronisation par WatermelonDB**, pourtant annoncée dans la pile imposée du `CLAUDE.md` : le paquet n'est pas dans `package.json`, la persistance locale est MMKV plus des fichiers. Il n'y a **aucune mise à jour à distance du code** (`expo-updates` absent des dépendances) ; le kill-switch de maintenance et la version minimale sont lus en base via `src/services/appConfigService.ts` et affichés par `MaintenanceGate` et `UpdateModal`. Il n'y a **aucun paiement in-app** côté transport. Et il n'y a **pas de BLE en arrière-plan** : `isBackgroundEnabled: false`, compensé par le maintien de l'écran allumé.

Enfin, l'ensemble du groupe `app/(app2)` — l'espace pilote V2 — est **redirigé vers la racine hors développement** (`app/(app2)/_layout.tsx` lignes 66-68), y compris pour les liens profonds. Les 38 écrans V2 ne sont donc pas atteignables dans un build distribué tant que cette garde n'est pas retirée au lot L6.

---

### Ce que je n'ai pas pu vérifier

Je n'ai pas ouvert le fichier `.env` : son contenu est un secret, et je ne peux donc pas dire quelles clés sont réellement renseignées (GraphHopper, Google Maps Android, Sentry). Je n'ai pas interrogé la base de production, donc je ne peux ni trancher la contradiction Frankfurt / eu-west-1, ni confirmer que les tables `coach_messages` et `coach_pilots` sont bien inscrites dans la publication `supabase_realtime` — aucune migration du dépôt ne le fait. Je n'ai pas ouvert le code des fonctions serveur (`supabase/functions/`), y compris `pair-app` : ce que j'affirme sur l'anti-force-brute et la consommation du code vient des commentaires de `src/services/pairingService.ts`, pas de la fonction elle-même. Je n'ai pas vérifié que `https://app.oxvehicle.fr/ar-view` existe. Je n'ai pas exécuté la suite de tests, donc je ne confirme ni n'infirme le chiffre de 1 846 tests verts ; j'ai en revanche compté 824 fichiers TypeScript, 159 fichiers de tests et 125 migrations. Enfin, je n'ai lu qu'une partie de `src/services/captureSessionService.ts` (869 lignes) et de `src/services/captureSyncQueue.ts` (1 234 lignes) : les sections de flush final, d'agrégats de fin de séance et de réimport `.ubx` ne sont décrites qu'à partir de leurs en-têtes et de leurs signatures.

---

## La chaîne de capture télémétrique

Cette section décrit le trajet réel d'une mesure, du capteur jusqu'à la base, dans l'ordre où il se produit. Tout ce qui suit a été lu dans le dépôt à la date du 26/07/2026, branche `feat/site-document-emails`. Les chiffres de production ont été relevés directement sur le projet Supabase `oxv-platform` (`fouvuqkdxarjpjbqnsjq`, région `eu-west-1`).

### Vue d'ensemble : sept maillons

| Étape | Fichier | Rôle |
|---|---|---|
| 1. Radio BLE | `src/ble/bluetoothService.ts` | connexion au boîtier, réception des notifications |
| 2. Reconstruction de trames | `src/ubx/parser.ts` (`UbxFrameBuffer`) | recolle les octets en trames complètes |
| 3. Décodage | `src/ubx/parser.ts` (`parseRaceBoxDataMessage`) | transforme 88 octets en mesures physiques |
| 4. Orchestration | `src/services/captureSessionService.ts` | ouvre la séance, bufferise, écrit, clôture |
| 5. Détection de tours | `src/ble/lapDetectionRunner.ts` + `src/utils/lapDetection.ts` | compte les passages sur la ligne |
| 6. File de synchro | `src/services/captureSyncQueue.ts` | survivance hors-ligne, idempotence, rejeu |
| 7. Base et stockage | Supabase : `telemetry_sessions`, `telemetry_frames`, `laps`, bucket `telemetry_raw` | la destination |

---

### 1. Du capteur à l'octet

Le boîtier est un RaceBox Mini S. Il expose un service BLE de type UART Nordic dont les identifiants sont figés dans `src/types/telemetry.ts` (`RACEBOX_PROTOCOL`) : service `6E400001-…`, caractéristique de sortie `6E400003-…`. Le scan (`startScan`, `bluetoothService.ts` ligne 276) filtre sur cet identifiant de service **et** sur le préfixe de nom « RaceBox » : un appareil qui ne porte pas les deux n'apparaît jamais dans la liste.

La connexion (`connect`, ligne 324) impose un délai maximal de 10 secondes, découvre tous les services, puis s'abonne aux notifications de la caractéristique de sortie. Chaque notification arrive encodée en base64 ; elle est décodée en octets bruts avant tout traitement (`subscribeToData`, ligne 378).

Le module natif `react-native-ble-plx` est chargé **paresseusement** (`loadBleManagerCtor`, ligne 43). S'il est absent — cas d'Expo Go — le service se met en mode inerte : `isAvailable()` renvoie faux, chaque appel émet un message d'erreur explicite et rien ne plante. C'est pourquoi la capture exige un build de développement, jamais Expo Go.

### 2. La reconstruction des trames

Une notification BLE ne correspond pas à une trame. Elle peut en contenir plusieurs, ou une moitié. `UbxFrameBuffer` (`src/ubx/parser.ts`, ligne 106) accumule les octets et applique une resynchronisation stricte : tant que les deux premiers octets du tampon ne sont pas `0xB5 0x62`, il en jette un et recommence. Quand l'en-tête est trouvé, il lit la longueur de charge utile annoncée, calcule la taille totale (`6 + longueur + 2`), refuse toute trame prétendant dépasser 512 octets, et attend d'avoir assez d'octets avant d'extraire la trame.

Ce point a une conséquence importante et documentée dans le code : **plusieurs trames peuvent sortir du tampon dans le même tick JavaScript**, donc porter la même milliseconde d'horloge. C'est l'une des trois raisons qui ont imposé la règle d'horodatage décrite plus bas.

### 3. Le décodage d'une trame

`parseRaceBoxDataMessage` (ligne 55) ne traite qu'un seul type de message : le « RaceBox Data Message », reconnu à trois conditions cumulatives — taille exactement 88 octets, classe `0xFF` / identifiant `0x01`, et checksum Fletcher-8 valide (`computeChecksum`, ligne 15). Toute autre trame sortie du tampon est silencieusement ignorée par `subscribeToData`. Une trame au checksum faux ne produit rien : elle n'est ni corrigée ni comptée.

Les conversions appliquées, lisibles lignes 61-100 :

| Champ | Décalage | Conversion |
|---|---|---|
| Temps GPS (iTOW) | 6 | entier 32 bits, en millisecondes |
| Latitude | 34 | entier signé ÷ 10 000 000 |
| Longitude | 30 | entier signé ÷ 10 000 000 |
| Altitude | 42 | millimètres ÷ 1000 → mètres |
| Précision GPS | 46 | millimètres ÷ 1000 → mètres |
| Vitesse | 54 | mm/s × 3,6 ÷ 1000 → km/h |
| Cap | 58 | ÷ 100 000, valide seulement si le bit `0x20` des drapeaux de fix est posé |
| G longitudinal / latéral / vertical | 74 / 76 / 78 | milli-g ÷ 1000 → g |
| Vitesses de rotation | 80 / 82 / 84 | ÷ 100 |
| Batterie | 73 | bit 7 = en charge, 7 bits bas = niveau |

La cadence nominale du boîtier est de 25 Hz. Elle est traitée partout comme **nominale et non garantie** : `src/services/flowLogic.ts` (ligne 14) le dit explicitement, et le service BLE mesure la cadence réelle sur une fenêtre glissante d'une seconde (`updateRate`, ligne 600), exposée par `getCurrentRate()`. Cette mesure ne sert qu'au débogage : `initBle.ts` (ligne 77) la pousse dans `useTelemetryStore.rateHz` une fois par seconde, et le seul écran qui l'affiche est `app/(app)/debug-capture.tsx`.

### 4. Quatre consommateurs du même flux

`bluetoothService.onData` est un simple registre de fonctions rappelées. Quatre abonnés existent en production, et **l'ordre d'abonnement est porteur de sens** :

1. `src/ble/initBle.ts` (ligne 49) — pousse la dernière trame dans `useTelemetryStore` (débogage uniquement, la doctrine du silence interdit l'affichage live) ;
2. `src/ble/lapDetectionRunner.ts` (ligne 90) — la détection de tours, abonnée **avant** la capture ;
3. `src/services/captureSessionService.ts` (ligne 391) — la capture proprement dite ;
4. `src/services/liveRelayRunner.ts` (ligne 239) — le relais coach, avec son propre étranglement (environ 3-4 Hz vers le binôme, 1 Hz vers le tableau de marche).

Un cinquième abonnement, temporaire, existe sur l'écran d'équipement (`app/(app2)/rec/equipement.tsx`, ligne 504) pour afficher l'état du boîtier pendant l'appairage.

L'ordre 2 avant 3 est explicitement commenté (`captureSessionService.ts` lignes 364-372) : pour une trame donnée, le détecteur a déjà arbitré un éventuel franchissement de ligne quand la capture lit `getCurrentLapNumber()`. C'est ce qui permet de rattacher chaque trame à son tour sans dupliquer la détection.

### 5. L'armement de la capture

L'armement est déclenché depuis `app/(app2)/rec/placement.tsx` par un **appui long de 600 ms** avec jauge circulaire (constante `ARM_HOLD_MS`, `src/features/rec/armementLogic.ts`) — un relâchement précoce n'ouvre aucune séance. L'écran V1 équivalent, `app/(app)/placement.tsx`, appelle exactement les mêmes arguments.

`startCaptureSession` (`captureSessionService.ts`, ligne 260) exécute, dans cet ordre :

1. **Génération locale de l'identifiant de séance** (`newUuid`, UUID v4 client). L'application n'attend jamais le serveur pour obtenir un identifiant.
2. **Mise en file de la création de séance** — pas un appel réseau direct. Une opération `create_session` est écrite sur disque avec `status: 'recording'`, l'horodatage de départ, le circuit et le véhicule.
3. **Mise en file du rattachement d'intention**, si le pilote en a posé une en préparation (`peekPendingIntentionId`, `src/services/intentionsService.ts`). L'identifiant est lu localement, jamais par une requête — précisément pour fonctionner en mode avion. L'ordre d'enfilement (après `create_session`) est verrouillé par un test.
4. **Drain en arrière-plan** (`processQueue`), sans attendre.
5. **Démarrage du filet .ubx local** (`startCapture`, `src/ble/captureMode.ts`).
6. **Démarrage de la détection de tours** avec la ligne d'arrivée du circuit choisi.
7. **Abonnement au flux BLE** et armement du minuteur de vidage.
8. **Reconnexion BLE illimitée** (`setUnlimitedReconnect(true)`) et **verrou d'écran** (`expo-keep-awake`, étiquette `oxv-capture`).
9. **Démarrage du relais live** et de la **capture cardio**, tous deux en « au mieux » et non bloquants.

La fonction ne renvoie jamais un échec pour cause d'absence de réseau. C'est le principe du *local-first* : le pilote n'est jamais bloqué avant la piste.

### 6. Le tampon, la cadence d'écriture, l'horodatage

À chaque trame reçue, la capture fait quatre choses (lignes 391-404) : calculer un `elapsed_ms`, empiler une ligne prête à insérer, mettre à jour les maxima de séance, mettre à jour les maxima du tour en cours.

**Deux déclencheurs de vidage**, définis lignes 98-99 :
- `FLUSH_EVERY_FRAMES = 50` — dès que le tampon atteint 50 trames ;
- `FLUSH_INTERVAL_MS = 4000` — un minuteur toutes les 4 secondes, qui garantit qu'un tampon partiel finit par partir.

À 25 Hz, cela donne environ un lot de 50 lignes toutes les deux secondes. Le vidage courant (`flush`, ligne 584) ne traite que **le retard présent à son entrée** : les trames qui arrivent pendant l'écriture attendent le déclencheur suivant. Le commentaire du code explique pourquoi (lignes 559-583) : drainer aussi les nouvelles arrivées faisait courir la boucle après un producteur à 25 Hz, et la taille de lot s'effondrait vers 1 à 4 lignes par requête. Seul le vidage **final** vide tout, et il n'est appelé qu'après le désabonnement du flux.

L'écriture elle-même est un `insert` **direct** sur `telemetry_frames` (ligne 594). Ce n'est qu'en cas d'échec que le lot bascule dans la file sur disque, sous l'opération `frames`, et alimente le compteur `requeued`.

`elapsed_ms` mérite un paragraphe à lui seul, parce que c'est la pièce la plus fragile de la chaîne. Il est produit par `nextElapsedMs` (`src/services/captureFrameMapping.ts`, ligne 43) :

```ts
return Math.max(nowMs - startMs, lastElapsed + 1);
```

Le `+ 1` n'est pas un détail d'ordonnancement : `elapsed_ms` est la **clé d'idempotence** des trames, et la contrainte `UNIQUE (session_id, elapsed_ms)` existe réellement en production (vérifié : contrainte `telemetry_frames_session_elapsed_unique`, migration `20260716165100` appliquée). Sous un `ON CONFLICT DO NOTHING`, deux trames réelles partageant un `elapsed_ms` verraient l'une des deux détruite en silence. Trois causes rendaient les ex æquo possibles : plusieurs trames par notification, blocage du fil JavaScript, recul d'horloge après resynchronisation réseau. L'arbitrage assumé, écrit dans le code : pendant un recul d'horloge, le temps avance de 1 ms par trame — le chronométrage est momentanément comprimé, mais aucune donnée n'est perdue.

Chaque ligne porte aussi `itow_ms`, le temps GPS du boîtier. Il n'est **pas** la clé d'unicité (l'argumentaire complet est en tête de `captureSyncQueue.ts`, lignes 58-90 : l'iTOW se répète avant fix, se réenroule chaque dimanche, et la colonne est nullable). Il sert d'identité physique pour réconcilier un réimport .ubx avec les trames déjà captées.

### 7. La détection de tours

`startLapDetection` (`lapDetectionRunner.ts`, ligne 74) instancie un détecteur et s'abonne au flux. Les trames dont le fix GPS est inférieur à 3D sont écartées immédiatement.

Deux modes, arbitrés par la présence d'un **cap** de franchissement (`src/utils/lapDetection.ts`, lignes 1-31) :

- **Mode porte** (cap fourni) : la ligne est un segment perpendiculaire à la piste, de demi-largeur configurable. Un tour est compté quand le segment [point précédent → point courant] coupe la porte **dans le sens du cap**. Ce mode existe pour une raison mesurée sur le terrain et documentée : à Haute Saintonge la voie des stands est à 22,9 m de la ligne avec 2,3° d'écart de cap ; à Ricardo Tormo, 16,2 m et 0,4°. En mode rayon, la fenêtre admissible à Valence est de 20 centimètres — donc vide dès que la voie des stands fait sa largeur normale. Aucun rayon ne peut couvrir la piste et exclure les stands.
- **Mode rayon** (pas de cap) : entrée dans un disque autour de la ligne. C'est le repli historique, utilisé quand `finish_line_heading` est nul en base (le circuit « La charade » est cité).

Deux garde-fous communs : un **délai de garde de 10 secondes** entre deux tours (`COOLDOWN_MS`), et en mode porte un **pas maximal de 50 mètres** (`MAX_STEP_M`) au-delà duquel le franchissement n'est pas évalué — après un trou de liaison, le segment reliant deux points éloignés n'est pas une trajectoire et pourrait couper la porte sans que la voiture y soit passée.

La durée d'un tour est mesurée sur une **base monotone** (`src/utils/monotonicClock.ts`), jamais sur l'horloge murale ; les dates affichables (`startedAtMs`, `endedAtMs`), elles, restent murales. Le premier passage de ligne n'est pas compté : c'est la fin de l'outlap, et il ne fait que mémoriser le point de départ du premier tour chronométré.

La ligne d'arrivée transmise vient de `captureFinishLineFor` (`src/services/captureFinishLineLogic.ts`), qui renvoie `undefined` plutôt qu'une fausse ligne si les coordonnées valent 0/0 ou ne sont pas finies. Si l'appelant ne fournit rien, `captureSessionService` retombe sur `BELTOISE_FINISH` (lat 45,6004 / lon −0,141, rayon 40 m) en écrivant un avertissement en console — et le commentaire est explicite : ces coordonnées ne correspondent à aucun circuit réel, les tours ne seront pas comptés.

### 8. Ce qui est écrit, et QUAND

C'est le point le plus important de cette section.

| Destination | Moment d'écriture | Chemin |
|---|---|---|
| `telemetry_sessions` (ligne, statut `recording`) | **à l'armement** | file de synchro, opération `create_session` |
| `session_intentions.session_id` | **à l'armement**, juste après | file, opération `attach_intention` |
| `telemetry_frames` | **en continu**, tous les 50 trames ou 4 s | insertion directe ; file seulement en cas d'échec |
| Fichier `.ubx` local | **en continu** en mémoire, écrit sur disque **à la clôture** | `src/ble/captureMode.ts` |
| `laps` | **à la clôture uniquement** | file, opération `laps` |
| Agrégats de séance (`duration_seconds`, `lap_count`, `best_lap_seconds`, `max_speed_kmh`, `max_g_lateral`, `max_g_longitudinal`, `total_frames`, `status: completed`) | **à la clôture uniquement** | file, opération `complete` |
| Bucket `telemetry_raw` (upload du `.ubx`) | **à la clôture uniquement** | file, opération `ubx_upload` |
| `biometry_raw` | **à la clôture** (ou au rejeu) | registre MMKV séparé, `biometryCaptureRunner` |
| `app_session_analyses`, `app_segment_analyses`, `session_insights`, débrief | **après la clôture**, sur l'écran de fin | `analyzeAndPersistSession`, hors file |

Autrement dit : **les tours n'existent nulle part tant que le pilote n'a pas terminé son run.** Pendant toute la séance, seuls les compteurs vivent en mémoire (`useSessionStore.lapCount`, `bestLapMs`) ; la table `laps` reste vide. Si l'application est tuée en piste, les trames déjà envoyées sont en base mais les tours sont perdus — le `.ubx` local reste alors le seul témoin.

Les maxima **par tour** (`laps.max_g_lateral`, `max_g_braking`, `max_g_accel`, `max_speed_kmh`, `avg_speed_kmh`) sont accumulés pendant la capture (`accumulateLapMaxima`, ligne 653) puis figés au changement de tour. Le commentaire de `captureFrameMapping.ts` (lignes 130-142) explique la raison d'être : ces colonnes existaient en base depuis la migration `0004` mais n'étaient **jamais écrites**, de sorte que le calcul de fluidité lisait `0` partout et rendait une fluidité de 100 sur 100 % des séances réelles. La règle appliquée depuis : un tour sans trame rattachée garde ses colonnes à `null`, jamais `0`. Le dernier tour est figé explicitement à l'arrêt (`freezeCurrentLap` appelé avant `stopLapDetection`, ligne 754), sans quoi il partirait avec des colonnes vides alors qu'il a bien été mesuré.

**Colonnes jamais écrites par la chaîne de capture**, vérifiées par recherche sur tout le dépôt : `telemetry_sessions.distance_km`, `avg_lap_seconds`, `best_lap_number`, `weather`, `notes` ; `laps.distance_meters`. Elles sont lues à plusieurs endroits (`statsService.ts`, `bilanPdfExportService.ts`, `useBilan.ts`) mais restent nulles. De même, la fonction `saveWeatherSnapshot` (`src/services/weatherService.ts`, ligne 208) **n'a aucun appelant** : aucun instantané météo n'est associé à une séance, et la table `weather_snapshots` compte 0 ligne en production.

### 9. La clôture

`stopCaptureSession` (ligne 723) suit une séquence stricte :

1. **Capture-and-null synchrone** : `current` est remis à null dès la première ligne, avant tout `await`, pour qu'un second appel concurrent court-circuite.
2. Désabonnement du flux, du suivi de reconnexion, arrêt du minuteur.
3. Désarmement de la reconnexion illimitée, libération du verrou d'écran, coupure du relais live, clôture de la capture cardio.
4. `drain()` : on attend un vidage éventuellement en vol, puis on vide **intégralement** le tampon.
5. Gel du tour en cours, arrêt de la détection, relevé des compteurs.
6. Fermeture du fichier `.ubx`.
7. Mise en file, **dans l'ordre**, de `laps`, puis `complete`, puis `ubx_upload`.
8. Drain en arrière-plan.

Le total de trames renvoyé est « émis » (insérées en direct + requeuées). Il n'est pas définitif : au moment d'exécuter `complete`, la file **recompte les trames réellement présentes en base** pour cette séance (`execComplete`, `captureSyncQueue.ts` ligne 679) et écrase `total_frames` avec ce nombre. C'est possible grâce au FIFO : toutes les opérations `frames` précèdent le `complete`.

L'abandon (`abortCaptureSession`, ligne 825) suit le même démontage mais met en file un `complete` avec `status: 'aborted'`, ne persiste **aucun tour**, ne fait **aucun upload**, et purge le cardio local. Le fichier `.ubx` est bien écrit sur disque mais son URI n'est stocké nulle part hors de `captureMode.getLastSavedUri()` — il n'est plus référencé par aucune opération, donc éligible au ménage par âge au bout de 7 jours.

### 10. La file de synchronisation

`captureSyncQueue.ts` est le fichier le plus long de la chaîne (1235 lignes). Sa raison d'être : une séance produit des dizaines de milliers de trames, plusieurs mégaoctets, ce qui exclut la file MMKV utilisée pour les petites actions.

**Disposition sur disque.** Un dossier `capture-queue/` dans le répertoire documents, **une opération par fichier JSON**. Le nom est `${horodatage sur 15 chiffres}-${séquence sur 6}-${type}.json` : le tri lexicographique des noms est exactement l'ordre d'insertion. L'écriture est **atomique** (fichier `.tmp` puis renommage, ligne 338) parce que sur Android un fichier à demi écrit était listable et donc lisible tronqué.

**Six types d'opérations** : `create_session`, `attach_intention`, `frames`, `laps`, `complete`, `ubx_upload`.

**Idempotence.** Chaque opération est rejouable :
- `create_session` : `upsert` sur `id` ;
- `frames` : `upsert onConflict (session_id, elapsed_ms)` avec `ignoreDuplicates` ;
- `laps` : `upsert onConflict (session_id, lap_number)` avec `ignoreDuplicates` ;
- `complete` : `update` filtré sur l'identifiant **et** l'utilisateur ;
- `ubx_upload` : `upsert: true` côté Storage.

Les deux `upsert` multi-lignes passent par un mécanisme commun (`writeIdempotent`, ligne 541) qui gère le cas où la contrainte n'existe pas encore en production : erreur `42P10` → repli sur un `insert` simple avec un avertissement unique ; puis un `23505` en mode repli prouve que la migration est passée entre-temps et **ré-arme** l'upsert. Le client est donc correct avant comme après l'application de la migration. Les deux contraintes sont aujourd'hui **bien présentes en production** (vérifié sur `pg_constraint`).

**Classification des erreurs.** C'est le cœur de la robustesse, et le raisonnement est inversé par rapport à l'intuition (lignes 26-37 et 442-457) : seule une **liste blanche** d'erreurs autorise l'abandon (SQLSTATE 22, 23 sauf 23503 et 23505, 42 ; PostgREST 202 et 205 ; fichier source absent ; statuts Storage 400/413/415). Tout code **inconnu est traité comme transitoire** et conservé. `23503` (violation de clé étrangère) est explicitement classé transitoire : c'est un signal d'ordonnancement, la séance n'est pas encore créée côté serveur. `401` et `403` sur Storage ne sont **pas** abandonnés — un jeton expiré est réparable.

**Garde dure** : une opération `create_session` n'est **jamais** abandonnée, quelle que soit l'erreur. La ligne de séance porte la clé étrangère de toutes les trames et de tous les tours avec `ON DELETE CASCADE` : l'abandonner ferait tomber la séance entière en silence.

**Quarantaine plutôt que suppression.** Une opération réellement condamnée est **déplacée** dans `capture-queue/quarantine/`, jamais effacée, et remontée à Sentry (`captureException`). Un fichier illisible subit le même sort.

**Comportement du drain** (`drainOnce`, ligne 752) : traitement dans l'ordre, suppression de chaque opération réussie ; **arrêt au premier échec réseau** en conservant le reste (on ne martèle pas un réseau tombé) ; exception pour `ubx_upload`, qui est une opération feuille dont aucune autre ne dépend — on la **saute** en incrémentant un compteur, et on la met en quarantaine après 10 tentatives (`MAX_UPLOAD_ATTEMPTS`).

**Coalescence.** `processQueue` n'est pas réentrant, mais un déclencheur concurrent n'est pas avalé : il arme `rerunRequested` et la passe en cours est rejouée avant de rendre la main (ligne 861). Le commentaire cite deux cas réels que cela corrige : le retour de réseau pendant l'upload de fin de séance, et la création de la séance suivante enfilée pendant ce même upload.

**Déclencheurs du drain**, au nombre de trois seulement :
- au lancement de l'application — `app/_layout.tsx` ligne 48, `void resumeUnsyncedCaptures()` ;
- au retour du réseau — `src/lib/netinfo.ts` ligne 40, sur transition hors-ligne → en ligne ;
- au démarrage et à la clôture d'une capture — `void processQueue()` dans `captureSessionService`.

### 11. Le filet .ubx local

`src/ble/captureMode.ts` s'abonne à `onRawData`, c'est-à-dire aux octets **avant** resynchronisation et décodage. Les morceaux sont accumulés en mémoire pendant toute la séance, puis concaténés et écrits en un seul fichier `${documentDirectory}fixtures/racebox-capture-<horodatage>.ubx` à l'arrêt (ligne 65). Le fichier est la concaténation stricte des trames brutes ; il est rejouable par `UbxFrameBuffer` et partageable via la feuille de partage système.

Ce fichier n'est **pas** supprimé après l'upload : il reste le filet de reprise. Il est effacé par âge (`gcOldCaptures`, 7 jours) avec trois verrous, dans l'ordre de la règle « en cas de doute, conserver » : file non vide → aucun ménage ; fichier encore référencé par une opération `ubx_upload` (y compris en quarantaine) → conservé ; nom dont on ne sait pas lire la date → conservé.

Deux consommateurs du `.ubx` existent :
- `analyzeAndPersistSession` (`src/services/analyzeSessionService.ts`, ligne 104) le parse **en priorité** sur les trames en base pour produire l'analyse par segment ;
- `reimportUbxToFrames` (`captureSyncQueue.ts`, ligne 1139), filet de dernier recours qui réinjecte les trames manquantes. Sa logique est soignée — appariement multi-ensemble sur `itow_ms`, recalage de la base de temps sur une ancre live, allocation d'`elapsed_ms` garantie sans collision, refus explicite si la séance porte des trames sans `itow_ms`. **Mais cette fonction n'a aucun appelant dans l'application** : elle n'est référencée que dans un commentaire et dans ses tests. Il n'existe donc aujourd'hui aucun bouton, aucun écran, aucune commande pour la déclencher.

### 12. La reprise après coupure

Trois natures de coupure, trois traitements distincts.

**Coupure BLE pendant la capture.** Le service détecte la déconnexion via `device.onDisconnected` et distingue le volontaire de l'inattendu grâce au drapeau `userInitiatedDisconnect`. En capture, le mode **illimité** est armé : `shouldGiveUpReconnect` (`src/ble/reconnectPolicy.ts`) renvoie toujours faux, on retente indéfiniment avec un délai croissant plafonné — 2 s, 4, 8, 16, puis 30 s au maximum. Côté capture, la phase `reconnecting` fait passer le statut de lien à `interrupted`, met les compteurs en pause, horodate le début du trou et arme un minuteur. Au retour du lien, on reprend et la durée du trou est écrite en console (`logLinkGap`, ligne 513) — console seulement, car le silence en piste interdit tout écran. Si le lien ne revient pas au bout de **15 minutes** (`LONG_INTERRUPT_TIMEOUT_MS`), la séance est clôturée proprement, par le même chemin qu'un arrêt pilote.

Hors capture, le mode est **borné** : 5 tentatives (`RECONNECT_MAX_ATTEMPTS`) puis phase terminale `lost`. Un second filet applicatif vit dans `src/ble/initBle.ts` avec son propre backoff (2, 5, 10, 20 s) et un seuil de 30 secondes au-delà duquel la modale paddock #25 s'affiche. Ce watchdog vérifie `isReconnecting()` avant de programmer quoi que ce soit, pour ne pas composer deux fois en parallèle.

Une garde de génération protège le chemin terminal (`finalizeOnLostLink`, lignes 526-557) : comme `stopCaptureSession` remet `current` à null dès son entrée, une capture suivante peut démarrer pendant le drain. Les trois effets globaux — reconnexion illimitée, verrou d'écran, statut de lien — ne sont appliqués que si aucune autre capture n'a pris la main. Ce comportement est verrouillé par un test (`captureSessionService.test.ts`, ligne 273).

**Coupure réseau.** Traitée par la file : le lot en échec est requeué sur disque, le drain s'arrête, et tout repart au retour du réseau ou au prochain lancement. Le mode avion complet est un cas nominal assumé.

**Application tuée en piste.** C'est le cas le moins bien couvert. Au redémarrage, `resumeUnsyncedCaptures` rejoue ce qui restait sur disque : la séance est créée, les lots de trames partent. Mais aucune opération `complete` n'a jamais été enfilée — **la séance reste indéfiniment au statut `recording`**, sans tours, sans agrégats. Aucun mécanisme de récupération automatique n'existe dans l'application. Le seul filet est humain et côté admin : `src/services/adminQualityService.ts` (ligne 69) lève un drapeau `recording_stuck`, et `app/(admin)/en-cours.tsx` liste les séances restées dans cet état.

Il faut aussi noter que **l'état de la file n'est visible nulle part côté pilote** : `hasPending()` et `pendingSessionIds()` sont exportés mais n'ont aucun appelant en dehors du module lui-même et des tests. Rien ne dit au pilote que des données attendent encore d'être envoyées.

### 13. La capture cardio (BIO-2)

Elle se greffe sur le cycle de vie de la capture par **trois lignes seulement** dans `captureSessionService` : `startBiometryCapture` à l'armement (ligne 433), `stopBiometryCapture` à la clôture (ligne 742), `discardBiometryCapture` à l'abandon (ligne 837). Les trois sont en « au mieux », jamais bloquantes.

Le chemin BLE est **entièrement séparé** du RaceBox (`bluetoothService.ts`, lignes 619-817) : service standard Heart Rate `0x180D`, mesure `0x2A37` en notification, appareil distinct, abonnements distincts, reconnexion cardio **bornée** et indépendante. La ceinture tombe → la capture télémétrique continue intacte, et réciproquement. Le décodage est délégué à un module pur et testé, `src/services/v2/heartRateParser.ts`, écrit d'après la spécification publique Bluetooth SIG — le document protocole OXV promis n'a jamais été livré (`roadmap/rapports/bio-2.md`, point 2 des suspens).

`src/services/biometryCaptureRunner.ts` applique un **double verrou local fail-closed** : drapeau serveur `biometry` **et** consentement de capture du pilote. Sans les deux, le module est dormant — aucun abonnement, aucune entrée-sortie. Les échantillons sont persistés en MMKV toutes les **10 secondes** dans un registre `rec:biometry:` **strictement séparé de `captureSyncQueue`** (règle cardinale, `src/features/rec/biometryCaptureBuffer.ts` ligne 5). À la clôture, ils sont envoyés en `upsert` idempotent vers `biometry_raw` (clé naturelle `session_id, ts, source`) **puis purgés du local**. Les lectures hors de l'intervalle [25, 250] bpm sont écartées avant envoi, en miroir du `CHECK` en base. Une séance abandonnée ne préserve rien du tout.

Le drapeau `biometry` est **actif en production** (vérifié : `app_feature_flags.biometry = true`, levé le 25/07/2026, description en base mentionnant que le test à deux appareils n'a pas eu lieu). C'est le seul des sept drapeaux qui soit à `true`. La table `biometry_raw` compte **0 ligne**.

### 14. Pourquoi quatre fichiers sont gelés

Le gel est une **règle cardinale du programme V2**, écrite noir sur blanc dans deux documents de cadrage :

> `design-retours/programme-v2/PROMPT_CLAUDE_CODE_V2_L2_REC.md`, ligne 7 : « RÈGLE CARDINALE inchangée : `useAppStateStore`, `captureSessionService`, `captureSyncQueue`, `bluetoothService` = zéro diff. »

> `design-retours/programme-v2/OXV_APP_V2_DOSSIER_MAITRE.md`, ligne 147 : « La machine S5/S6 de `useAppStateStore` et `captureSessionService`/`captureSyncQueue` ne bougent pas d'une ligne. Seule la coque change. »

Ce que le gel protège se lit dans l'historique de ces fichiers. Les commits qui les ont amenés à leur état actuel portent des titres qui disent exactement ce qui a failli être perdu :

- `5cb86ba` — « critique 2 : la contrainte d'unicité aurait détruit des trames réelles » ;
- `b6c1ee2` — « séance détruite par erreur passagère, marge 100 % fabriquée » ;
- `c409dcc` — « la fluidité devient réelle : maxima par tour écrits à la capture » ;
- `3c89996` — « concurrence & cycle de vie, 6 derniers findings de la vérif adversariale » ;
- `3e91df8` — « coupure BLE sans clôture forcée : reconnexion illimitée armée ».

Chacune de ces corrections répare un défaut qui **détruisait silencieusement de la donnée pilote** ou en **fabriquait**. Le gel protège donc quatre invariants qu'aucun travail d'habillage n'a le droit de rouvrir : la stricte croissance d'`elapsed_ms`, la classification conservatrice des erreurs de la file, la garde de génération sur le cycle de vie de la capture, et la séparation des horloges murale et monotone.

Le gel n'a pas été absolu. **Deux dérogations** ont été accordées, toutes deux revendiquées comme purement additives et vérifiées par `git diff` (`roadmap/rapports/bio-2.md`, lignes 74-76) :

| Fichier | Statut réel |
|---|---|
| `src/store/useAppStateStore.ts` | gel tenu — dernier commit `9f1f3f0`, antérieur au programme V2 |
| `src/services/captureSyncQueue.ts` | gel tenu — dernier commit `b4748a2` (SEC-1, remontée Sentry) |
| `src/ble/bluetoothService.ts` | **dérogé** (`8ba669d`) — extension Polar, « exception cardinale sanctionnée », 0 ligne retirée sur le chemin RaceBox |
| `src/services/captureSessionService.ts` | **dérogé** (`a2560da`) — « dégel cardinal ciblé approuvé », 3 lignes d'appel cardio ajoutées |

### 15. Ce que la base contient réellement

Relevé en production le 26/07/2026 :

| Table | Lignes |
|---|---|
| `telemetry_sessions` | 18 (10 `completed`, 8 `aborted`) |
| `telemetry_frames` | **53** |
| `laps` | **1** |
| `biometry_raw` | 0 |
| `weather_snapshots` | 0 |
| `app_session_analyses` | 13 |
| `app_segment_analyses` | 0 |
| `session_insights` | 1 |
| Objets dans le bucket `telemetry_raw` | 3 fichiers (30 ko, 13 ko, 5,6 ko) |

Le détail est parlant. Les 10 séances `completed` datent des 16 et 17 mai 2026 — l'époque du proof of concept V1. Elles portent des `total_frames` de 93 à 1206 (5574 au total) mais **zéro ligne réelle dans `telemetry_frames`** : à cette époque, seules les lignes de séance étaient écrites. La rétention par âge n'y est pour rien (elle purge à 12 mois, `cleanup_old_telemetry_frames`, tâche cron `cleanup-telemetry-frames` active à 3 h 30). Les 8 séances `aborted` s'étalent de juin au 15 juillet 2026 : ce sont les essais de développement de la chaîne actuelle. Une seule a écrit des trames — 53 lignes, le 28 juin. Trois ont uploadé leur `.ubx`. L'unique ligne de `laps` appartient à une séance de mai, avec une durée de 0,022 seconde et un G latéral à 0.

Conclusion factuelle : **la chaîne V2 n'a jamais produit une seule séance `completed` en production.** Tout ce qui est décrit ci-dessus est vérifié par 3 161 lignes de tests (`captureSyncQueue.test.ts` 1348, `lapDetectionGate.test.ts` 577, `captureSessionService.test.ts` 546, `captureFrameMapping.test.ts` 278, `parser.test.ts` 225, `biometryCaptureRunner.test.ts` 187) mais n'a pas encore été validé par une journée de piste réelle.

### 16. Ce qui manque ou ne fonctionne pas

- **Aucun test automatisé de `bluetoothService.ts` ni de `lapDetectionRunner.ts`.** Ces deux fichiers n'ont pas de fichier de test propre ; seul `captureSessionService.test.ts` les touche par ses simulacres. La politique de reconnexion, elle, est extraite et testée (`reconnectPolicy.test.ts`).
- **`reimportUbxToFrames` n'a aucun appelant.** Le filet de dernier recours est écrit, testé, et injoignable depuis l'application.
- **Pas de récupération d'une séance restée en `recording`** après un arrêt brutal de l'application. Le repérage est manuel, côté admin.
- **La file de synchro est invisible pour le pilote.** `hasPending` et `pendingSessionIds` ne sont câblés sur aucun écran.
- **Aucun instantané météo** n'est rattaché à une séance : `saveWeatherSnapshot` est du code mort.
- **Plusieurs colonnes restent nulles par construction** : `distance_km`, `avg_lap_seconds`, `best_lap_number`, `laps.distance_meters`.
- **Pas de BLE en arrière-plan.** `app.json` ne déclare **aucun** `UIBackgroundModes` (vérifié). La stratégie assumée est le premier plan avec verrou d'écran (`expo-keep-awake`). Si le pilote quitte l'application ou verrouille manuellement, la radio peut être coupée par le système.
- **Le document protocole de la ceinture** (`OXV_Ceinture_Protocole_Connexion_Biometrie.md`) n'existe toujours pas ; le parser cardio dérive de la norme publique.
- **Le smoke test à deux appareils réels** (pilote + coach) n'a pas eu lieu, alors que le drapeau `biometry` est levé.
- **Le seul écran de diagnostic de capture** (`app/(app)/debug-capture.tsx`) vit dans l'espace V1, celui qui doit disparaître au lot L6. Aucun équivalent n'existe dans `app/(app2)`.

### Ce que je n'ai pas pu vérifier

Je n'ai pas exécuté la suite de tests : le chiffre de 1 846 tests verts vient des rapports de lot du dépôt, pas d'une exécution de ma part. Je n'ai pas ouvert `app/(app2)/rec/entre-runs.tsx`, `arrivee.tsx`, `preparation.tsx` ni `index.tsx` — je ne décris donc pas ce que la pause entre deux runs affiche exactement, seulement sa place dans l'enchaînement, lue dans `src/features/rec/captureStepLogic.ts`. Je n'ai lu que les 80 premières lignes de `src/services/liveRelayRunner.ts` et n'ai pas ouvert `liveSessionService.ts` : ce que je dis des cadences du relais (3-4 Hz vers le coach, 1 Hz vers le tableau de marche) vient de commentaires dans le code, pas de la lecture des fonctions d'émission elles-mêmes. Je n'ai pas ouvert `src/store/useAppStateStore.ts` et ne peux donc rien affirmer de première main sur la machine à états S1-S10 ni sur le garde-fou runtime du silence en piste. Je n'ai vérifié aucun comportement sur appareil réel : tout ce qui touche au comportement effectif de la radio, du verrou d'écran ou de la reconnexion en conditions de piste reste, à ce jour, non observé.

---

## Les fonctionnalités pilote

Cette section décrit le contenu du groupe de routes `app/(app2)/`, c'est-à-dire l'espace pilote de deuxième génération. Elle a été écrite en ouvrant les fichiers un par un ; chaque affirmation renvoie à un chemin précis. Tout ce qui n'a pas pu être vérifié est signalé en fin de section.

### Le périmètre exact : ce que contient `app/(app2)/`

Le dossier contient très exactement 38 fichiers `.tsx`, dont 36 écrans, un fichier de layout et un écran de développement. La répartition réelle constatée est la suivante.

| Zone | Fichiers | Détail |
| --- | --- | --- |
| Coquille | 1 | `_layout.tsx` |
| Miroir | 3 | `index.tsx`, `bilan/[sessionId].tsx`, `signature.tsx` |
| REC (jour J) | 8 | `rec/index`, `preparation`, `arrivee`, `equipement`, `placement`, `roulage`, `entre-runs`, `fin` |
| DATA | 4 | `data/index`, `data/session/[id]`, `data/comparer`, `data/saison` |
| CLUB | 7 | `club/index`, `coaching`, `roulages`, `territoire`, `partenaires`, `galerie`, `pass` |
| VOUS | 11 | `vous/index`, `profil`, `garage`, `carnet`, `equipement`, `documents`, `document/[doc]`, `decharge`, `reglages`, `support`, `fondateur` |
| Réservation | 3 | `reserver/index`, `reserver/[sessionId]`, `reserver/paiement` |
| Développement | 1 | `dev-galerie.tsx` |

Le repère de départ annonçait « VOUS (12) ». Le compte réel est de onze écrans sous `vous/`. L'écart s'explique probablement par le fait que les trois écrans de réservation ont été développés dans le même lot que VOUS — leurs hooks vivent d'ailleurs dans `src/features/vous/` (`useReserverCatalog.ts`, `useReserverDay.ts`, `useReserverPayment.ts`) — ou par le comptage de `dev-galerie.tsx`. Je le signale sans trancher.

Le volume de code est de 25 424 lignes pour l'ensemble du groupe. Les écrans les plus lourds sont `data/comparer.tsx` (1 626 lignes), `club/territoire.tsx` (1 427), `data/saison.tsx` (1 307), `club/coaching.tsx` (1 266) et `bilan/[sessionId].tsx` (1 182).

### Ce que fait `app/(app2)/_layout.tsx` : la coquille et les onglets

Ce fichier de 123 lignes est la porte d'entrée de tout l'espace V2, et il porte cinq responsabilités.

**Première responsabilité, et la plus importante à connaître : une garde de build.** Les lignes 66 à 68 contiennent `if (!__DEV__) { return <Redirect href="/" />; }`. En clair : dans un build de production, l'intégralité de l'espace pilote V2 — les 36 écrans — n'est pas atteignable, y compris par lien profond. Le commentaire du fichier précise que cette garde est à retirer au lot L6, celui de la bascule. J'ai vérifié en cherchant toute référence à `app2` depuis `app/(app)` : il n'en existe aucune, sauf un commentaire dans `app/(app)/insight/[reading].tsx` ligne 136. Le groupe est donc réellement orphelin : rien dans l'application V1 n'y mène, et le routeur racine `app/index.tsx` renvoie les pilotes vers `/(app)`, jamais vers `/(app2)`.

**Deuxième responsabilité, une garde d'authentification.** Si le store d'auth passe en `unauthenticated`, l'utilisateur est renvoyé vers `/(auth)/login`, exactement comme dans le layout V1.

**Troisième responsabilité, le contexte d'animation.** Le layout monte un `GestureHandlerRootView` racine (dont dépendent le `Sheet` et le `PullToRefreshDial`) et un `HeroMorphProvider`, registre inter-écrans qui permet à une photo « héros » de voyager d'un écran à l'autre pendant la navigation. Le `Stack` est configuré sans en-tête natif et avec `animation: 'none'` : l'entrée d'un écran n'est pas une transition de navigateur, c'est l'effet « porte » du kit (`useDoorTransition`).

**Quatrième responsabilité, la barre d'onglets.** Elle n'est pas la barre d'expo-router mais un composant maison, `src/ui/v2/TabBar.tsx`, posé en position absolue au-dessus du contenu. La table des portes vit dans `src/ui/v2/shellLogic.ts` (`TAB_ITEMS`) et compte quatre portes latérales : Miroir, Data, Club, Vous (icône casque). La porte active est rendue en `text.hi` avec une mise à l'échelle de 1,06 en ressort ; les inactives en `text.low`. Le fond est un flou `expo-blur` d'intensité 30 sur iOS ; sur Android, le composant retombe volontairement sur un aplat opaque, le commentaire expliquant que le re-flou par image sous un contenu qui défile est coûteux et produit des artefacts. La hauteur de contenu est de 56 points, avec un débord de 12 points pour que le bouton central reste tappable sur Android.

Au centre, le `CentralButton` a trois états, tranchés par une logique pure testée (`src/ui/v2/centralButtonLogic.ts`) et alimentée par `useCentralButtonState.ts` : `rec` quand une capture est en cours (cercle plein accent, point pulsant, retour haptique « armement »), `countdown` quand une journée circuit est à venir (libellé « J-3 », « J-0 » le jour J), et `reserve` sinon. La prochaine journée est relue à la connexion, à la fin d'une capture et à chaque retour de l'application au premier plan, pour qu'un « J-x » calculé la veille ne reste pas figé.

**Un point important sur ce bouton central : sa destination est encore provisoire.** Les lignes 107 à 110 du layout envoient vers `/(app2)/club` en mode `reserve` et vers `/(app2)/rec` dans les deux autres cas. Le commentaire l'assume comme un « câblage provisoire (lot L0) ». Le bouton central n'ouvre donc jamais le tunnel de réservation.

**Cinquième responsabilité, le silence en piste.** La barre disparaît quand `shouldShowTabBar(pathname, pilotState)` — la logique V1 importée sans modification depuis `src/lib/appMap.ts` — le demande, et aussi quand le chemin courant est un segment immersif V2. Ces segments sont listés dans `V2_HIDDEN_SEGMENTS` : `arrivee`, `equipement`, `placement`, `roulage`, `fin`. À l'inverse, `preparation` et `entre-runs` gardent la barre visible.

Enfin, la fonction `currentTabOf` fait retomber sur « miroir » tout écran hors des quatre portes — c'est-à-dire tout le flux REC et `dev-galerie` : la barre n'est jamais dans un état indéterminé.

---

### Zone Miroir : le présent du pilote

#### L'accueil — `app/(app2)/index.tsx` (1 067 lignes)

C'est la porte d'entrée. L'écran a deux visages, tranchés par `decideHomeMode` selon l'ancienneté de la dernière séance (seuil de sept jours).

En mode **après-séance**, le héros est la photo de la séance avec le chrono du meilleur tour en surimpression (`ChronoHero`). Un appui déclenche la capture de géométrie `HeroMorph` puis pousse vers `/(app2)/bilan/{sessionId}` : la photo « voyage » visuellement vers l'écran de bilan. En mode **entre-journées**, le héros devient la voiture du membre — la photo de couverture de son garage — surmontée d'un cadran de compte à rebours, du nom du circuit, de la date courte et d'une pastille « PRÉPARER ». Si aucune journée n'est au calendrier, le héros est remplacé par une carte vide portant « Aucune journée au calendrier. » et un bouton « RÉSERVER ».

Trois modes de capture priment sur tout le reste. Aux états `S5_approche` et `S6_roulage`, l'écran ne rend qu'un texte plein cadre : « L'app s'efface. / Aucun écran. Aucun son. Conduisez. » en piste, « Bon trajet. / Coupez l'app. Je conduis. » en approche. Aucun chrono, aucun radar, aucune statistique — c'est l'application littérale du principe 3. À l'état `S4_anticipation`, l'écran devient un compte à rebours sobre avec une pastille d'action calculée par `decidePaddockAction` (logique V1 importée, non dupliquée).

Sous le héros viennent, dans l'ordre : un bandeau rituel J-3 (affiché uniquement pour une journée réelle à trois jours ou moins, écartable par un glissement horizontal dont l'oubli est persisté par journée en MMKV, avec une action d'accessibilité dédiée puisqu'un lecteur d'écran ne peut pas produire ce geste) ; une carte Signature compacte portant le radar QDI en petit format et la légende des cinq branches (masquée entièrement si aucune branche n'est mesurée — pas de radar inventé) ; « le fait », un texte nu qui est soit le récit narratif de la dernière séance, soit un fait de saison ; et une rangée de trois statistiques en filets fins : Record, Saison (kilomètres), puis Heritage ou Séances.

**D'où viennent les données.** Tout passe par `src/features/miroir/useMiroirHome.ts`, qui n'utilise que des services existants. Le hook procède en deux vagues de `Promise.allSettled` : d'abord la dernière séance (lecture directe de `telemetry_sessions`), les statistiques (`loadPilotStats`), la prochaine journée (`getMyNextTrackDay`), le drapeau `app_payments`, le garage et ses couvertures, les inscriptions (pour le palier Heritage), le pack Heritage et l'avatar ; puis les données dépendantes de la séance : tours, QDI, récit, médias. La météo du circuit de la prochaine journée est lue en dernier, et uniquement si la journée est à sept jours ou moins.

Trois garde-fous méritent d'être connus. Premièrement, les trois sources primaires sont lues en mode strict : une erreur de base de données rejette au lieu de se déguiser en vide, et si les trois échouent ensemble, l'écran bascule en état d'erreur avec un bouton « Réessayer » — jamais un écran calme qui affirmerait « aucune journée » ou « 0 km ». Deuxièmement, la météo affichée est explicitement étiquetée « Météo actuelle » et non une prévision du jour J, et si la température est absente, le bloc entier est omis plutôt que d'afficher un « 0° » fabriqué. Troisièmement, le compteur Heritage lit les vraies colonnes `sessions_used` / `sessions_total` de la table `heritage_packs` ; sans pack actif, la cellule devient « Séances ».

Sur le QDI, une règle importante : seul un QDI persisté à la version courante de l'algorithme est affiché. Les QDI enregistrés sous 1.0.x sont documentés comme invalides (axes G inversés) et ne sont jamais montrés. Un recalcul paresseux n'est tenté qu'une fois par lancement et seulement pour une séance récente.

**Deux liens de cet écran sortent vers la V1** : le bandeau rituel et la pastille « PRÉPARER » naviguent tous deux vers `/(app)/preparation` (lignes 377 et 524), pas vers l'écran de préparation V2 qui existe pourtant à `/(app2)/rec/preparation`.

#### Le bilan de séance — `app/(app2)/bilan/[sessionId].tsx` (1 182 lignes)

C'est le rendez-vous d'après-piste. L'écran s'ouvre par un bloc héros qui est la cible du `HeroMorph` venu de l'accueil ; ce bloc est monté dès le premier rendu, même pendant le chargement, pour que le mouvement parte au moment du geste. Le reste de l'écran entre par la « porte » seulement au passage à l'état prêt.

Les sections, dans l'ordre : le chrono en grand avec célébration de record éventuelle (une seule fois par séance, tous écrans confondus, grâce à une garde MMKV partagée dans `src/features/miroir/recordCelebration.ts`) ; **LE TRACÉ**, qui n'affiche la carte que si la géométrie exacte du circuit réel de la séance est disponible — sinon la carte est masquée, jamais remplacée par une silhouette générique ; **QUATRE PILIERS** ; **MOMENTS-CLÉS**, calculés par `computeKeyMoments` ; **FRÉQUENCE CARDIAQUE** ; **DEBRIEF J+1** ; le fil de messages avec le coach ; **SOUVENIRS** ; et un pied de page.

Le débrief a trois formes possibles : en attente (un texte unique, constante testée `DEBRIEF_PENDING_TEXT`), généré, ou rédigé. Quand il est généré automatiquement, l'écran l'annonce en toutes lettres : « RÉCIT GÉNÉRÉ AUTOMATIQUEMENT À PARTIR DE VOTRE SÉANCE ». Le fil de messages est intitulé « VOTRE FIL AVEC {NOM} » et l'auteur de chaque bulle est déterminé par l'identité d'authentification courante, pas par le rôle — un coach qui roule verrait sinon ses propres bulles attribuées au pilote.

La bande de fréquence cardiaque est triplement gatée : drapeau `biometry`, consentement, et présence réelle de données. Absent l'un des trois, la section n'existe pas — pas de teasing. La cellule « ◉ VIDÉO DU TOUR » en fin de rail Souvenirs n'apparaît que si le drapeau `video_overlay` est actif.

**Deux dettes explicitement consignées dans le code.** Les lignes 358 et 523 portent le marqueur `TODO_L3_TARGET` : les moments-clés et le lien « Ouvrir dans Data » devraient mener à `/data/session/[id]` avec une ancre, mais naviguent aujourd'hui vers le hub `/(app2)/data`. L'écran cible existe pourtant désormais — le rebranchement n'a pas été fait.

La feuille de partage propose un export PDF et une « Carte trophée », cette dernière renvoyant vers la route V1 `/(app)/carte-trophee`.

**Sources** : `src/features/miroir/useBilan.ts`, qui orchestre en `Promise.allSettled` les services sessions, analyses, QDI, segments, annotations coach, fil de messages, médias, centerline, biométrie et drapeaux. Seul l'échec de la séance elle-même met l'écran en erreur ; chaque autre section se dégrade seule. Le record est déterminé en mode strict : si la liste des séances n'a pas pu être établie, le record est déclaré indéterminé plutôt que fabriqué.

#### La signature — `app/(app2)/signature.tsx` (464 lignes)

L'écran porte le grand radar QDI avec ses cinq branches (Cap, Trajectoire, Visée, Plongée, Anticipation) et la mention « x/5 axes mesurés ». En dessous, « l'Empreinte » : une bande horizontale de mini-radars mensuels. Toucher un mois fait se déformer le grand radar vers les valeurs de ce mois par interpolation ; un second toucher ramène à la fenêtre de trente jours.

L'animation de déformation est décrite en détail dans le fichier : une progression 0→1 animée sur le fil UI, échantillonnée à environ 30 Hz vers le fil JavaScript pour limiter le nombre de rendus. Le commentaire précise honnêtement que la preuve par profileur sur appareil réel reste due.

Le pilier physiologique est gaté par la même chaîne fail-closed que le bilan, avec en plus un seuil de trois séances portant des données (`PHYSIO_MIN_SESSIONS = 3`). Et même quand il est visible, sa valeur est rendue à `null`, donc « — » : la valeur n'est pas encore calculée, elle n'est pas inventée.

**Sources** : `src/features/miroir/useSignature.ts`. La ligne de base est la médiane par branche des QDI valides des trente derniers jours (`SIGNATURE_WINDOW_DAYS = 30`), bornée à douze séances lues. L'Empreinte demande six mois à `listMonthlyQdi`. Les deux sources sont lues en mode strict et le statut de l'écran est arbitré par une fonction pure testée, pour qu'une panne réseau ne se déguise jamais en état vide « après votre premier roulage analysé ».

Le lien de bas d'écran « Voir la saison complète » navigue vers `/(app2)/data` et non vers `/(app2)/data/saison` — le commentaire ligne 337 dit attendre le lot L3, qui a pourtant livré l'écran saison.

---

### Zone REC : les huit écrans du jour J

Le flux repose sur une projection de la machine à états V1 (S1 à S10) vers huit étapes. Cette table est la seule chose qui relie les deux, elle vit dans `src/features/rec/captureStepLogic.ts` et elle est purement lectrice : le module ne modifie jamais la machine à états.

| État pilote | Étape | Le hub redirige vers |
| --- | --- | --- |
| S1 découverte, S2 initiation, S3 attente, S4 anticipation | hors-jour | rien, le hub s'affiche |
| S5 approche | arrivée | `/(app2)/rec/arrivee` |
| S6 roulage | roulage | `/(app2)/rec/roulage` |
| S7 paddock | entre-runs | `/(app2)/rec/entre-runs` |
| S8 atterrissage, S9 décantation, S10 repos | hors-jour | rien, le hub s'affiche |

Le choix pour S8/S9 est documenté : l'écran `fin` est un transit atteint depuis `roulage` avec l'identifiant réel de séance, jamais par une redirection du hub qui n'aurait pas cet identifiant.

**1. Le hub — `rec/index.tsx` (260 lignes).** Cible du bouton central. Le jour J, il redirige immédiatement. Hors jour J, il rend la photo de la voiture du membre, un cadran de compte à rebours et une entrée « Préparation » vers `REC_ROUTES.preparation`. Sans journée au calendrier, il bascule en état « RÉSERVER » avec la même décision que l'accueil. Il réutilise `useMiroirHome` et, quand il redirige, passe `null` comme identifiant utilisateur pour ne payer aucune requête.

**2. La préparation — `rec/preparation.tsx` (1 080 lignes).** C'est une peau V2 sur les mêmes données que `app/(app)/preparation.tsx`. Sept blocs : en-tête condensable, héros de la journée avec cadran ou badge « AUJOURD'HUI », météo réelle (ligne absente si la mesure est absente), check-list cochable dont l'état est persisté en MMKV, QR Pass en compact puis en plein écran clair, le bloc C1 « Qui roule », et le bloc C2 Convoi. Le bloc « Qui roule » s'appuie sur `src/features/rec/attendancePublicService.ts`, qui appelle la fonction serveur `session_attendance_public` : seuls les inscrits de la journée lisent la liste, seuls les pilotes ayant activé `users.show_attendance` y figurent, et la fonction ne renvoie que le pseudo, l'avatar et l'écurie — jamais le nom complet. Le bloc Convoi est gaté par le drapeau `convoys`, vérifié en fail-closed.

**3. L'arrivée — `rec/arrivee.tsx` (229 lignes).** Écran cérémoniel plein cadre : l'insigne OXV se dessine au trait en deux secondes, une seule fois par jour (garde MMKV), puis le nom réel du circuit et « Vous y êtes ». Un seul bouton, « JE SUIS AU PADDOCK », qui fait un retour haptique d'armement et remplace la route par l'écran équipement. **Aucune écriture dans la machine à états** : le commentaire précise que la bascule S5→S7 reste portée par la géolocalisation dans `src/lib/geolocation.ts`.

**4. L'équipement — `rec/equipement.tsx` (1 145 lignes).** Peau sensorielle sur les services BLE V1 intacts : mêmes appels que la V1 vers `bluetoothService` (l'un des quatre fichiers gelés), mémoire du dernier boîtier via SecureStore, boîtier affecté via `getMyAssignedDevice`. La mise en scène ajoute un anneau radar Skia pendant le scan, une pastille de connexion pulsée, la batterie en compteur roulant et le numéro de série en police à chasse fixe. Trois blocs supplémentaires sont gatés par le drapeau `biometry` : la carte ceinture Polar (« à appairer au paddock par le staff » — le scan Polar réel est renvoyé au lot BIO-2), la feuille de consentement biométrie à deux cases distinctes (capture et partage coach), et le rappel Apple Watch soumis à quatre conditions.

**5. Le placement — `rec/placement.tsx` (423 lignes).** Dernière étape avant le silence. La carte du circuit est un tracé Skia avec un marqueur blanc de ligne d'arrivée placé depuis les coordonnées réelles ; si la ligne n'est pas renseignée, le marqueur retombe au départ du tracé plutôt que d'inventer une fausse ligne. L'armement est un geste : un appui long de 600 millisecondes avec jauge circulaire qui se remplit, et un relâchement précoce annule sans créer de session. Le démarrage appelle `startCaptureSession` avec exactement les mêmes arguments que la V1.

**6. Le roulage — `rec/roulage.tsx` (274 lignes).** Le plus sobre, et c'est délibéré : fond noir, un point REC qui pulse, le mot « REC ». Aucun chrono, aucun chiffre, aucune biométrie. Une seule exception d'honnêteté, reprise de la V1 : si le lien Bluetooth décroche, l'écran le dit sobrement, sans rouge — pour ne pas laisser croire qu'on enregistre quand le boîtier a lâché. « Terminer le run » appelle `stopCaptureSession` puis part vers `rec/fin` avec l'identifiant de séance ; une annulation discrète appelle `abortCaptureSession`.

**7. L'entre-runs — `rec/entre-runs.tsx` (430 lignes).** La pause au stand. Un cadran de compte à rebours du break (échelle de 45 minutes), qui ne s'affiche que pour un vrai départ à venir ; le meilleur tour du jour, célébré une fois s'il bat le précédent (garde MMKV par jour) ; une note rapide écrite dans le carnet réel via `addNote` ; et un bloc biométrie fail-closed. Le commentaire assume que les chiffres sont autorisés ici : on est au stand, pas en piste. Le bouton « Préparer le prochain run » remplace la route par l'écran équipement, ce qui garantit que la capture reste toujours joignable.

**8. La fin — `rec/fin.tsx` (677 lignes).** Fusionne trois écrans V1 (pilotage-fini, préservation, bilan-prêt) plus un état d'erreur, en quatre phases fondues entre elles : `fini`, `preservation`, `pret`, `erreur`. La préservation rebranche exactement `analyzeAndPersistSession` de la V1. Sur la phase « fini » se déclenche le mécanisme BIO-1 de lecture Apple Watch : idempotent, fail-closed, jamais bloquant, et aujourd'hui sans effet puisque HealthKit est absent. L'écran rejoue aussi les incidents déclarés hors ligne, depuis un registre séparé de la file de capture durcie, et propose de déclarer un incident dans une feuille. Le résumé n'affiche que ce que le store a mesuré : le message d'erreur est la constante « Vos données sont en sécurité sur l'appareil. » L'écran mène ensuite au bilan V2 via `finBilanRoute(sessionId)`.

---

### Zone DATA : quatre écrans, dont un inatteignable

**Le hub — `data/index.tsx` (744 lignes).** La liste de vos séances, exclusivement les vôtres. Des filtres en pastilles (Tous, un par circuit rencontré, Cette saison), une liste de `SessionCard` portant le chrono au millième et un « badge d'honnêteté de la donnée » calculé par `confidenceBadge`. Un appui long ouvre le mode comparaison : la sélection est bornée à deux par `toggleSelect`, une barre flottante sort en ressort et mène au comparateur. Le chargement est strict — une panne de base de données devient un état d'erreur avec « Réessayer », jamais une liste vide muette. L'export de vos données passe par `dataExportService` ; le cadran de progression est **indéterminé** et le code le dit : le service est atomique et ne publie aucune progression réelle (`TODO device-tune`).

**La séance — `data/session/[id].tsx` (1 782 lignes environ, sept sections).** L'écran pivot, avec un rail horizontal collant d'ancres sous l'en-tête condensé.

| Section | Contenu | Source |
| --- | --- | --- |
| 1 · RÉSUMÉ | Chrono en grand, statistiques en filets | `fetchAllSessions` |
| 2 · TOURS | Histogramme Skia, une barre par tour | `fetchSessionLaps` (strict) |
| 3 · TRACÉ & VIRAGES | Tracé du tour, pastilles de marge, zoom | `listSegmentAnalysesForSession` |
| 4 · TÉLÉMÉTRIE | Onglets internes G-G, Canaux, Heatmap, Replay | trames, chargées paresseusement |
| 5 · CONSTATS | Six lectures dans une feuille | `fetchSessionInsights` + `loadGGPoints` |
| 6 · CŒUR | Vide honnête | aucune — voir ci-dessous |
| 7 · CONDITIONS | Température et humidité, corrélation | `weather_snapshots` |

Sur la section 5, il faut être précis, car c'est le seul endroit du groupe où subsiste de la démonstration. Cinq des six lectures sont branchées sur des données réelles : `anatomie`, `dispersion`, `tour-ideal` et `transfert` consomment des tranches de `session_insights`, `gg` consomme le nuage g-g réel — et chacune rend un état vide honnête si la donnée manque. **La sixième, `flow`, reste une démonstration** : le commentaire ligne 1 559 explique qu'aucune source d'insight « fluidité » n'existe et qu'il faudrait un calcul dédié dérivé des trames. Elle est donc la seule à porter un bandeau `DemoBanner`. Par ailleurs, une panne de lecture des insights produit une erreur honnête distincte du vide, et le sous-libellé des lignes est désormais le niveau de la lecture, plus l'ancien « fait » de démonstration aux chiffres fabriqués.

La section 6, « Cœur », est un vide assumé : `telemetry_frames` ne porte pas de fréquence cardiaque, donc aucune valeur n'est inventée. La section 7 préserve les `null` de la base — température et humidité s'affichent « — » plutôt qu'un zéro.

**Le comparateur — `data/comparer.tsx` (1 626 lignes).** Trois modes en pastilles : Séances, Tours, Ami. Aucun gagnant, aucun classement : deux colonnes strictement symétriques, l'écart présenté comme un signe orienté neutre, les deux valeurs dans la même couleur de texte. Le code explique pourquoi l'or est banni de cet écran : réservé au record et au prestige ailleurs dans l'application, il peindrait le côté B en étalon et créerait une hiérarchie. A est en accent, B en crème neutre. Le mode Ami s'appuie sur les politiques d'amitié en base, qui n'ouvrent que les faits de séance de l'ami — meilleur tour et vitesse maximale — jamais ses tours ni ses trames ; sa régularité et sa distance restent donc « — ». Deux dettes de performance sont consignées : l'ajustement indépendant de chaque tracé à sa boîte, et un balayage en version de base (`PanResponder` + état React) plutôt qu'un worklet. Le partage passe par une capture d'écran de la carte de comparaison puis la feuille de partage du système.

**La saison — `data/saison.tsx` (1 307 lignes).** Quatre lectures : la courbe de progression du meilleur tour par circuit (courbe dorée Skia, points tappables, ligne pointillée pour le record), l'histogramme de régularité avec le fait « X % de vos tours à moins d'une seconde », une grille de faits consolidés en compteurs roulants, et les circuits roulés avec les silhouettes pointillées des circuits OXV à découvrir. Tous les services sont appelés en mode strict pour distinguer panne et compte vide.

**Point de navigation à connaître : `data/saison.tsx` n'a aucun point d'entrée dans le groupe.** J'ai cherché toute référence à `data/saison` dans `app/(app2)` : le seul résultat est son propre en-tête de fichier. Ni le hub Data ni l'écran Signature n'y mènent (Signature envoie vers `/(app2)/data`). L'écran existe, il est complet, il est inatteignable par navigation.

---

### Zone CLUB : sept écrans, trois inatteignables

**Le hub — `club/index.tsx` (645 lignes).** Un fil vertical de blocs qui n'apparaissent que s'ils ont du contenu réel. Dans l'ordre : Mon coaching (binôme ou découverte), Mon groupe (le fil de faits d'écurie), Roulages à venir (invitations avec Accepter / Décliner en place), Pass (prochaine inscription), Partenaires (rail de logos). Si aucun bloc n'a de contenu, l'écran affiche un état vide unique ; si toutes les sources tombent, un état d'erreur avec « Réessayer ».

Le fil d'écurie mérite une note doctrinale, car le hook l'explique : le seul canal autorisé pour connaître la présence d'un autre pilote est `session_attendance_public`, interrogé sur mes journées passées. Les membres de mon écurie qui y étaient produisent un fait « a roulé » — **jamais un chrono**, la fonction serveur n'en renvoie pas et `crewFactFeed` l'exclut structurellement.

**Depuis ce hub, seuls trois sous-écrans sont atteignables** : `club/coaching` (bloc coaching), `club/pass` (bloc pass) et `club/partenaires` (bloc partenaires). Les blocs Écurie et Roulages agissent sur place et ne naviguent nulle part.

**Le coaching — `club/coaching.tsx` (1 266 lignes).** Trois onglets en pastilles, également parcourables au glissement : Trouver, Mon coach, Demandes. L'onglet Trouver présente des cartes coach puis une fiche en feuille avec biographie, avis **en citations, sans aucune note étoilée ni score** — le fichier le pose comme doctrine —, créneaux et demande de séance. L'onglet Mon coach porte les consentements granulaires en interrupteurs neutres avec révocation immédiate, les factures gatées par le drapeau `coach_billing` en fail-closed avec ouverture d'un lien externe, et la fin de binôme derrière une confirmation. L'onglet Demandes est une chronologie d'états plus les avis post-séance en texte libre.

**Roulages et amis — `club/roulages.tsx` (1 028 lignes).** Deux onglets. Roulages : invitations à venir avec réponse, compteur « roulé ensemble ×n » par coach, historique factuel. Amis : recherche de pseudo en direct, liste des amis avec **leur dernier circuit, jamais leur chrono** — la règle est verrouillée dans `amisLogic`, badge « groupe » pour l'écurie, et « Comparer côte à côte ». Une dette est consignée ligne 570 : le comparateur ami vers `/(app2)/data/comparer?friend=` n'est pas rebranché.

**Le territoire — `club/territoire.tsx` (1 427 lignes).** Trois onglets. Carte : plein écran avec une garde `isExpoGo` (sans carte en Expo Go, une liste honnête prend le relais), style sombre, repères pour les circuits OXV, les pings sociaux publiés et les départs de routes certifiées, plus un panneau bas listant les repères visibles et synchronisé au déplacement. Routes : cartes de route avec badge « CERTIFIÉE OXV », détail en feuille, ouverture dans l'application Plans, et bloc Convoi gaté par le drapeau `convoys`. Créer : deux entrées vers les planificateurs V1, `/(app)/creer-route` et `/(app)/creer-trace`.

Ce fichier porte la divergence de données la plus explicitement documentée du groupe : `scenicRoutesService` n'expose ni polyligne ni durée, donc **aucune géométrie réelle de route n'est dessinée**. Sur la carte, une route certifiée n'apparaît que par son point de départ réel ; dans les cartes et le détail, le motif affiché est le circuit-repère générique, pas la route. La durée n'est pas affichée du tout.

**La galerie — `club/galerie.tsx` (1 002 lignes).** Deux onglets. Galerie : mosaïque à deux colonnes de tous vos médias, groupés par séance avec des en-têtes collants, visionneuse plein écran avec zoom, glissement horizontal entre photos et fermeture vers le bas. Partages : la carte-souvenir capturée en image (chrono et tracé or sur fond titane, composant V1 réutilisé), le Carnet Heritage réservé au palier Heritage — **absent, pas teasé, si le palier n'est pas atteint** —, et les liens de partage révocables. La cellule vidéo n'apparaît que si le drapeau `video_overlay` est actif.

**Les partenaires — `club/partenaires.tsx` (459 lignes).** Une liste de cartes puis une fiche en feuille, avec un bouton « ÊTRE MIS EN RELATION » qui exige un consentement explicite en une phrase avant l'appel à `requestPartnerContact`. Le garde-fou V1 est conservé mot pour mot dans `PARTNER_CONSENT_SENTENCE` : la mise en relation transmet uniquement les coordonnées du pilote, jamais de donnée de pilotage. Catalogue vide en production, l'écran affiche « Les offres arrivent ».

**Le pass — `club/pass.tsx` (495 lignes).** Les inscriptions à venir en cartes, avec un QR de présence qui s'ouvre en plein écran sur fond clair (même source que la V1) ; l'historique en lignes fines dessous. **C'est le seul écran du groupe qui mène au tunnel de réservation** : ligne 127, si `passEmptyCta` décide `reserve` — ce qui dépend du drapeau `app_payments` en fail-closed — l'écran pousse vers `/(app2)/reserver`, sinon vers `/(app2)/club`.

**Trois écrans du Club sont donc orphelins dans le groupe** : `roulages`, `territoire` et `galerie` n'ont aucun lien entrant depuis un autre écran de `(app2)`.

---

### Zone VOUS : onze écrans, tous atteignables

**Le hub — `vous/index.tsx` (642 lignes).** Le passeport du pilote : un héros avec la photo du véhicule principal, l'avatar bordé d'or si le palier Heritage est atteint, le nom, le pseudo, et une ligne d'identité en chasse fixe qui roule au premier affichage (« palier · n records · km »). Puis la carte Membre Fondateur, gatée par le drapeau `founders` en fail-closed — carte absente si le drapeau est éteint. Puis le code de parrainage avec partage natif et la ligne d'écurie. Puis les sept sections d'accès, dont la table est en dur lignes 345 et suivantes : Profil public, Garage, Carnet, Équipement, Licence & documents, Réglages, Support.

Le fichier consigne une déviation doctrinale assumée : la jauge fondateur, décrite « remplie or » dans la spécification, est rendue en gris neutre parce que l'or reste exclusif au palier Heritage.

**Sources** : `src/features/vous/useVousHub.ts`. L'identité est la source primaire — son échec bascule l'écran en erreur, parce que le héros ne peut pas mentir un nom ou un pseudo. Tout le reste est au mieux : une source en panne masque sa section ou affiche « — ».

**Le profil public — `vous/profil.tsx` (829 lignes).** Deux visages sur un seul écran : consultation, c'est-à-dire ce que voient les autres, et édition en place derrière un bouton « MODIFIER ». L'écran documente trois replis honnêtes imposés par le schéma actuel : il n'existe pas de colonne de couverture dédiée, donc la couverture est la photo de profil la plus récente ; l'avatar n'a aucun chemin d'écriture dans l'application et n'est donc pas éditable ; et la biographie, le numéro de course et l'option pavillon sont masqués tant que la migration correspondante n'est pas appliquée.

**Le garage — `vous/garage.tsx` (978 lignes).** Liste verticale de cartes véhicule plein cadre, avec ouverture en feuille : carrousel de photos, spécifications, journal de réglages daté avec composeur. Deux limites documentées : il n'existe pas de colonne « véhicule principal », donc le véhicule qui illustre l'accueil est simplement le premier enregistré et **aucun bouton « Définir principal » n'est inventé** ; et le sélecteur de photos n'en ajoute qu'une à la fois.

**Le carnet — `vous/carnet.tsx` (914 lignes).** Quatre onglets parcourus au glissement, avec un indicateur qui suit le doigt : Notes (avec la météo réelle du jour de la note quand elle existe, lue directement en base pour préserver les valeurs nulles — passer par `weatherService` fabriquerait un « 0° du jour »), Intentions (une carte par intention liée à sa séance, état honorée ou en attente, tappable vers le bilan de la séance), Objectifs (personnels, invisibles du coach, barre de progression seulement si l'objectif porte une mesure), et Programme (cycles partagés par le coach, lus tels quels — le fichier note que c'est le seul espace prescriptif autorisé).

**L'équipement — `vous/equipement.tsx` (422 lignes).** À ne pas confondre avec l'écran équipement du flux REC : ici, aucun scan, seulement l'état. Carte boîtier avec pastille d'état, batterie en cadran, numéro de série et dernier contact. Carte ceinture pour les coachés. Carte Apple Watch sur iOS uniquement, avec statut HealthKit et bouton d'autorisation gaté ; sur Android la carte n'existe pas.

**Licence et documents — `vous/documents.tsx` (504 lignes).** Trois blocs : la carte licence FFSA au format carte bancaire avec les données réelles de `users` et zéro champ inventé, ouvrable en plein écran et partageable par capture ; la décharge gatée par le drapeau `pilot_waivers` (éteint, la ligne affiche « disponible prochainement » et n'est pas tappable) ; et les documents légaux embarqués. Le fichier note honnêtement que `expo-brightness` est absent du projet, donc la carte ne monte pas la luminosité de l'écran.

**Le lecteur légal — `vous/document/[doc].tsx` (encart court).** Affiche le Pacte de pilotage, les CGU ou la Politique de confidentialité depuis `src/legal/legalDocuments.ts`, en rendu markdown minimal, corps 15 et interligne 1,65. Le fichier justifie cet écran par l'exigence RGPD d'accès permanent.

**La décharge — `vous/decharge.tsx` (502 lignes).** Flux de signature électronique V1 rhabillé, services inchangés. Le drapeau est **revérifié sur l'écran lui-même**, en fail-closed : tant qu'il est éteint — parce que le texte n'a pas été relu par un avocat — l'écran affiche « Bientôt » et rien de légalement effectif n'est présenté.

**Les réglages — `vous/reglages.tsx` (674 lignes).** Quatre groupes : Notifications (interrupteur maître, rituels, rappel J-1, offres partenaires), Consentements (IA débrief, IA coach, audience, partage live coach, biométrie capture et partage), Données et sécurité (export, suppression à J+30 sous double confirmation) et Session (déconnexion). Le mécanisme d'écriture est décrit précisément dans `useReglages.ts` : les bascules sont optimistes mais chaque retour est inspecté, et sur échec l'état optimiste est annulé et une erreur est posée, rendue en bandeau sobre. **Une exception pessimiste** : la révocation de la capture cardiaque ne passe visuellement à « éteint » qu'après confirmation du serveur, parce qu'on ne prétend pas avoir coupé une collecte de santé qui resterait horodatée en base.

**Le support — `vous/support.tsx` (505 lignes).** Liste des demandes avec pastille de statut, fil du ticket en feuille avec réponse, et composeur avec catégorie, objet et message. Services V1 inchangés.

**Membre fondateur — `vous/fondateur.tsx` (472 lignes).** Écran de candidature : insigne qui se dessine, manifeste « 30 membres. Jamais plus. », jauge x/30 alimentée par le compteur réel `founders_count` — le fichier précise « jamais un 12/30 codé en dur » —, champ de motivation borné à 2 000 caractères, code parrain optionnel. Le drapeau `founders` est vérifié sur l'écran : éteint, aucune écriture n'est possible. Même déviation doctrinale assumée que le hub : insigne et jauge en tons titane, pas en or.

---

### Zone Réservation : trois écrans, entièrement gatés

Les trois écrans vérifient chacun le drapeau `app_payments` — dont la clé est `BOOKING_FLAG_KEY` dans `src/services/bookingCatalogLogic.ts` — via leur hook respectif, en fail-closed. Quand l'accès est fermé, ils affichent tous le même écran « Réservations à l'ouverture » (`ReserverClosedView`), sur lequel une jauge et un appel à l'action fondateur n'apparaissent que si le drapeau `founders` est lui aussi actif. Trois événements d'entonnoir sont émis, `reserve_funnel_1`, `2` et `3`, **que l'accès soit ouvert ou fermé** — la mesure d'intention fonctionne donc même tunnel fermé.

**Le catalogue — `reserver/index.tsx` (205 lignes).** Liste de cartes journée avec héros du circuit, date pleine, offres en pastilles et une jauge de places à vingt segments pour que la rareté se voie ; complet, la carte propose « LISTE D'ATTENTE ». Les données viennent du site via `bookingCatalogService`, en lecture seule.

**Le détail — `reserver/[sessionId].tsx` (369 lignes).** Héros du circuit, programme de la journée en chronologie, sélection d'offre en cartes radio avec prix TTC, récapitulatif. Un prix absent s'affiche « — ».

**Le paiement — `reserver/paiement.tsx` (292 lignes).** Récapitulatif puis méthodes de paiement. **La structure est prête mais les boutons sont inertes** : le fichier le dit deux fois, Stripe PaymentSheet et l'achat intégré d'abonnement sont renvoyés au lot A1-ON. Une mention `TODO_AVOCAT CGV` ligne 152 signale que le texte des conditions générales de vente reste à rédiger.

**Comment on entre dans ce tunnel.** Un seul chemin existe : l'état vide de `club/pass.tsx`. J'ai vérifié la fonction `decideReserve` dans `src/features/miroir/miroirHomeLogic.ts` lignes 236 à 241 : elle retourne `/(app2)/club` dans **les deux branches**, drapeau actif ou non. Le commentaire l'assume et précise que c'est verrouillé par un test « pour que le futur branchement soit un choix, pas un accident ». Conséquence concrète : le bouton « RÉSERVER » de l'accueil Miroir, celui du hub REC et le bouton central de la barre d'onglets mènent tous les trois à la porte Club, jamais au tunnel.

---

### L'écran de développement — `dev-galerie.tsx`

Il n'est pas une fonctionnalité pilote mais il figure dans le dossier. Strictement `__DEV__` : en production il redirige et ne rend rien. Il présente les composants du kit, les vingt icônes, les primitives de mouvement rejouables et les retours haptiques. **Toutes ses valeurs sont des constantes de démonstration locales au fichier**, jamais exportées. C'est aussi, d'après l'en-tête du layout, le seul point d'accès historique au groupe `(app2)`.

---

### Vue d'ensemble : ce qui est alimenté par du réel, ce qui ne l'est pas

L'immense majorité du groupe est branchée sur des données réelles. Le seul reste de démonstration explicitement identifié dans le code de production est **la lecture « flow » de la section Constats de `data/session/[id].tsx`**, et elle porte son bandeau. Ce qui est absent ailleurs est absent honnêtement : la fréquence cardiaque de la section Cœur, la géométrie des belles routes du Territoire, la progression réelle de l'export de données, la valeur du pilier physiologique de Signature.

Les gates par drapeau se répartissent ainsi :

| Drapeau | Ce qu'il gate côté pilote | Écrans concernés |
| --- | --- | --- |
| `biometry` | Fréquence cardiaque, consentements biométrie, ceinture Polar, rappel Watch, pilier physiologique | bilan, signature, rec/equipement, rec/entre-runs, rec/fin, vous/equipement |
| `app_payments` | Tout le tunnel de réservation, l'appel à l'action du Pass | reserver ×3, club/pass, accueil, rec/index |
| `founders` | Carte Membre Fondateur, écran de candidature, jauge sur l'écran fermé | vous/index, vous/fondateur, reserver ×3 |
| `video_overlay` | Cellule « vidéo du tour » | bilan, club/galerie |
| `convoys` | Bloc convoi | rec/preparation, club/territoire |
| `coach_billing` | Factures du coach | club/coaching |
| `pilot_waivers` | Décharge e-sign | vous/documents, vous/decharge |

La migration `supabase/migrations/20260719140000_be1_feature_flags.sql` insère cinq de ces drapeaux à `false`, avec `on conflict do nothing` pour ne jamais réactiver un drapeau qu'un administrateur aurait basculé. `coach_billing` et `pilot_waivers` sont insérés par leurs migrations respectives (`20260704150000` et `20260712091000`).

Enfin, sur la navigabilité : quatre écrans complets et terminés sont aujourd'hui sans lien entrant dans le groupe — `data/saison`, `club/roulages`, `club/territoire` et `club/galerie` — et deux liens du Bilan (`TODO_L3_TARGET`) pointent encore vers le hub Data plutôt que vers l'écran de séance qui existe désormais.

---

### Ce que je n'ai pas pu vérifier

Je n'ai **pas interrogé la base de production** : je ne peux donc pas confirmer l'état actuel des sept drapeaux. Ce que j'ai vérifié, c'est que les migrations les créent tous à `false` et que `isFlagEnabled` est fail-closed. L'affirmation « seul `biometry` est actif » vient du brief, pas de ma vérification.

Je n'ai **pas exécuté l'application ni la suite de tests**. Je n'ai donc pas observé un seul écran fonctionner ; tout ce qui précède est lu dans le code. Les 33 fichiers de tests de `src/features/*/__tests__/` ont été listés, pas ouverts ni lancés. Je note au passage que `supportLogic.ts` et `reserverUi.tsx` n'ont pas de fichier de test dans `src/features/vous/__tests__/`.

Je n'ai **pas ouvert intégralement** les fichiers les plus longs. Pour `data/comparer.tsx`, `club/territoire.tsx`, `club/coaching.tsx`, `club/galerie.tsx`, `data/saison.tsx`, `vous/garage.tsx`, `vous/carnet.tsx`, `vous/profil.tsx` et `rec/preparation.tsx`, je me suis appuyé sur leur en-tête de documentation, leurs imports et des recherches ciblées. Ces en-têtes se sont révélés fiables partout où j'ai pu recouper — mais je ne peux pas garantir qu'aucun détail de rendu ne leur échappe.

Je n'ai **pas ouvert les composants du kit** `src/ui/v2/*` autres que `TabBar.tsx`, `shellLogic.ts`, `centralButtonLogic.ts` et `useCentralButtonState.ts`. Le comportement précis de `RadarQdi`, `ChronoHero`, `PillarBar`, `TraceCircuit`, `StateView`, `Sheet` ou `PullToRefreshDial` est décrit tel que les écrans l'utilisent, pas tel que ces composants l'implémentent.

Je n'ai **pas vérifié les services** cités (`qdiService`, `sessionsService`, `analysesService`, `bookingCatalogService`, `scenicRoutesService`, etc.) au-delà de `featureFlagsService.ts` et `attendancePublicService.ts`. Quand j'écris « la source est X », je rapporte ce que l'écran ou son hook appelle, pas ce que ce service fait en interne.

Enfin, je n'ai **pas mesuré la performance** d'aucun écran. Plusieurs fichiers portent des marqueurs `TODO device-tune` par lesquels leurs auteurs reconnaissent eux-mêmes qu'une mesure sur appareil réel reste due — je les ai signalés sans pouvoir en juger.

---

## L'espace coach

> Tous les chemins de fichiers cités ci-dessous sont relatifs à la racine du dépôt `C:\Users\Julie\OneDrive\Desktop\oxv-app`.

### Ce que contient l'espace, et sous quelle forme

Le dossier `app/(coach)/` contient **37 fichiers `.tsx`**, dont un `_layout.tsx` : cela fait **36 écrans réellement routés** (vérifié par énumération du dossier). Ils vont de 332 lignes (`contexte.tsx`) à 1301 lignes (`assistant.tsx`) ; le hub `index.tsx` en fait 1238 et la fiche pilote `pilote/[id].tsx` 1084. Ce sont donc des écrans denses, pas des maquettes creuses.

L'ensemble de l'espace parle **un seul langage visuel** : les 37 fichiers importent `@/theme/v2`. Un seul écran emprunte un composant au kit V2 « DA Instrument » de l'espace pilote : `debrief.tsx` importe `BiometryStrip` depuis `@/ui/v2` (ligne 43). Autrement dit, l'espace coach n'a pas été repris par la refonte V2 du pilote — il est resté sur le langage précédent, et cette frontière est nette.

L'onboarding du coach vit **hors** de cet espace, dans `app/(coach-onboarding)/` (4 fichiers : `_layout`, `index`, `mission`, `pacte`). Un coach signe un **Pacte de coaching** distinct du pacte pilote : les colonnes `users.coach_pact_accepted_at` et `users.coach_pact_version` ont été ajoutées pour cela (`supabase/migrations/20260525130959_coach_pact_columns.sql`), et le commentaire SQL explique la raison : le pilote s'engage sur sa responsabilité en piste, le coach s'engage sur la confidentialité du pilote.

### Comment on entre dans l'espace, et comment on en sort

Le routage par rôle est fait à la racine, dans `app/index.tsx` (lignes 78-100) : si le profil n'est pas complet et que `role === 'coach'`, l'utilisateur part vers `/(coach-onboarding)` ; une fois l'onboarding terminé, `role === 'coach'` redirige vers `/(coach)`. Le garde de l'espace lui-même est dans `app/(coach)/_layout.tsx` (lignes 32-35) : si le profil n'est pas chargé, l'écran ne rend rien ; si `profile.role !== 'coach'`, redirection vers `/(app)`. L'espace coach est donc **strictement mono-rôle**.

Deux notifications poussées ouvrent directement l'espace coach depuis `app/_layout.tsx` : `session_analyzed` ouvre `/(coach)/pilote/[id]` sur le pilote concerné (lignes 121-128) et `pilot_consented` ouvre le hub `/(coach)` (ligne 134).

Un point de navigation à connaître : depuis la fiche pilote, taper une séance ouvre `/(app)/bilan` (ligne 759 de `app/(coach)/pilote/[id].tsx`), c'est-à-dire un écran de **l'espace pilote**. Or `app/(app)/_layout.tsx` ne garde que l'authentification, pas le rôle (vérifié : le seul `Redirect` du fichier concerne `status === 'unauthenticated'`). Le coach entre donc réellement dans l'écran de bilan pilote, et c'est la RLS Supabase qui décide de ce qu'il y voit.

### Les deux formats : console tablette et compagnon téléphone

La décision fondatrice du 2026-07-13 est écrite dans le code : les deux formats **coexistent**, et c'est la largeur d'écran qui tranche. Le seuil est `COACH_CONSOLE_MIN_WIDTH = 900` (`src/lib/coachNav.ts`, ligne 163).

Au-dessus de 900 points de large, `_layout.tsx` pose un **rail vertical** à gauche (`src/components/CoachRail.tsx`, largeur fixée à 198 px, ligne 83) et le contenu à droite. En dessous, il pose une **barre d'onglets basse** en superposition du Stack (`src/components/CoachTabBar.tsx`), avec l'actif en rouge doux `#E2685A` et — règle explicite du fichier — **aucun or sur la navigation**. Le Stack de routes est rigoureusement le même dans les deux cas : aucun fichier n'est déplacé, la navigation ne diverge pas, seuls les chrome changent.

| Format | Éléments de navigation | Entrées |
|---|---|---|
| Console tablette (≥ 900) | Rail 198 px | Poste → `/(coach)` · File de lecture → `/(coach)/file-lecture` · Studio → `/(coach)/studio` · Pilotes → `/(coach)` · Agenda → `/(coach)/calendrier` · Business → `/(coach)/facturation` · avatar en bas → profil |
| Compagnon téléphone (< 900) | Barre d'onglets 5 zones | EN DIRECT → `/(coach)/en-direct` · PILOTES → `/(coach)` · MESSAGES → `/(coach)/messages` · AGENDA → `/(coach)/calendrier` · MOI → `/(coach)/profil` |

Les deux tables de correspondance (`COACH_ROUTE_TO_ZONE` et `COACH_ROUTE_TO_RAIL`) rangent **chacun des 36 écrans** sous une zone et sous un item de rail. Ce n'est pas une promesse de commentaire : `src/lib/__tests__/coachNav.test.ts` lit réellement le contenu du dossier `app/(coach)` avec `fs.readdirSync` et vérifie qu'aucun écran n'est orphelin et qu'aucune entrée de navigation ne pointe vers une route inexistante, dans les deux formats.

Deux asymétries factuelles entre les formats méritent d'être signalées, parce qu'elles se voient à l'usage :

Sur le rail tablette, « Pilotes » et « Poste » pointent vers **la même route** `/(coach)` — le commentaire du fichier l'assume : « le Poste EST la liste des pilotes », donc pas d'écran liste séparé et pas de contrôle mort.

Sur le rail tablette, il **n'y a pas d'entrée Messages**. La messagerie est mappée sur l'item de rail `pilotes` (ligne 143 de `coachNav.ts`), mais aucun lien vers `/(coach)/messages` n'existe ni dans le rail, ni dans le hub `index.tsx` (vérifié par recherche : le mot « messages » n'apparaît pas dans `app/(coach)/index.tsx`), ni sur la fiche pilote. Le seul lien interne vers la messagerie part de l'écran de direct focus (`app/(coach)/en-direct/[sessionId].tsx`, ligne 564, action rapide « Message »). Sur téléphone, à l'inverse, MESSAGES est un onglet de premier niveau. La messagerie est donc pleinement atteignable en compagnon, et quasiment inatteignable en console.

### Le modèle d'accès : comment un coach obtient les données d'un pilote

C'est la partie la plus verrouillée de l'application, et elle repose sur une seule table pivot : `coach_pilots`.

**L'affiliation est créée par l'admin, pas par le coach ni par le pilote.** La table est définie dans `supabase/migrations/20260525114148_coach_pilots_table_and_rls.sql` : couple `(coach_id, pilot_id)` unique, `active` par défaut vrai, `pilot_consent_at` nul, et une contrainte `coach_id <> pilot_id`. Côté application, l'insertion se fait dans `src/services/coachAdminService.ts` (`assignPilotToCoach`, ligne 167), qui laisse délibérément `pilot_consent_at` à null et déclenche une notification `notify-pilot-coach-assigned` vers le pilote. Les policies RLS de la table le confirment : le coach ne peut que **lire** ses affiliations, le pilote ne peut que lire les siennes et mettre à jour la ligne qui le concerne, seul l'admin a le CRUD complet.

**Rien n'est visible tant que le pilote n'a pas consenti.** Le consentement est posé côté pilote dans `src/services/pilotConsentService.ts` : `giveConsent()` horodate `pilot_consent_at` et enregistre le niveau choisi ; `revokeConsent()` remet la colonne à null, ce qui coupe l'accès immédiatement puisque toutes les policies passent par le helper `is_coach_of()`. Le commentaire d'en-tête du service est explicite : « le consentement est libre, retiré à tout moment, et sans justification. L'app n'insiste jamais ni ne moralise. »

**Le consentement est gradué en trois niveaux**, introduits par `supabase/migrations/0014_coach_access_level_graduated.sql` (appliquée en production le 2026-06-28 d'après son en-tête) :

| Niveau (`coach_pilots.level`) | Libellé montré au pilote | Ce que le coach obtient |
|---|---|---|
| `lecture_simple` (défaut) | « Sessions seulement » | Sessions, tours, bilans — via `is_coach_of()` |
| `lecture_detaillee` | « Analyse détaillée » | En plus : `telemetry_frames` et `app_segment_analyses` — via `is_detailed_coach_of()` |
| `programme` | « Programme » | En plus : l'autorisation d'écrire des programmes — via `is_program_coach_of()` |

Les libellés cités sont ceux de `COACH_ACCESS_LEVELS` dans `pilotConsentService.ts` (lignes 23-39).

**Ce que « binôme détaillé » veut dire concrètement.** La fonction `public.is_detailed_coach_of(pilot_uuid)` (migration 0014, lignes 19-35) est une fonction SQL `stable security definer` qui renvoie vrai si, et seulement si, **quatre** conditions sont réunies simultanément : `coach_id = auth.uid()`, `pilot_id = pilot_uuid`, `active = true`, `pilot_consent_at IS NOT NULL`, et `level IN ('lecture_detaillee', 'programme')`. Concrètement, ce booléen commande aujourd'hui quatre portes :

Les **trames brutes** : la policy `telemetry_frames_coach_select` est repointée sur lui (migration 0014, lignes 39-46). Les **métriques de virage** : `app_segment_analyses_coach_select` également (lignes 48-51). La **biométrie** : `biometry_coach_read` sur `biometry_raw` exige `is_detailed_coach_of()` **et** un second consentement dédié, `users.biometry_coach_share_consent_at` non nul (`supabase/migrations/20260719141000_be1_biometry.sql`, lignes 55-65) ; aucune policy partenaire, staff ou anonyme n'existe sur cette table, le commentaire le dit en toutes lettres. Enfin l'**assistant IA** : `coach_ai_consent()` est défini comme `is_detailed_coach_of(pilot) AND users.coach_ai_enabled` avec `coalesce(..., false)` — fail-closed explicite (`supabase/migrations/0026_coach_ai_drafts.sql`, lignes 32-44).

La migration 0014 précise aussi ce qui **ne** bascule **pas** : « sessions / laps / app_session_analyses restent sur `is_coach_of` (lecture_simple suffit) ». Et lorsqu'un pilote redescend son niveau via `setConsentLevel()`, le commentaire du service annonce l'effet réel : l'accès aux frames et aux métriques de virage est coupé sans rompre l'affiliation.

Le niveau `programme` va un cran plus loin : `is_program_coach_of()` exige `level = 'programme'` **strictement** (migration `0027_coach_development_cycles.sql`, lignes 64-79), avec un commentaire qui interdit explicitement de réutiliser `is_detailed_coach_of` pour l'authoring, « ce qui contournerait le consentement gradué ».

**Le direct est un consentement séparé.** La colonne `coach_pilots.live_sharing_at` (migration `20260711172949_coach_pilots_live_sharing_consent.sql`) est décrite comme « distincte de `pilot_consent_at` (après-séance). Révocable. » Le relais côté pilote (`src/services/liveRelayRunner.ts`, fonction `consentedCoaches`, lignes 77-93) exige **quatre** conditions pour émettre vers un coach : `active`, `status = 'active'`, `pilot_consent_at` non nul et `live_sharing_at` non nul. Le commentaire au-dessus documente un correctif du 26/07 : sans la condition `pilot_consent_at`, retirer son consentement ne coupait pas le direct. Le même fichier écoute `coach_pilots` en temps réel pour réconcilier une révocation **en séance** (ligne 358 et suivantes). Enfin, la biométrie n'est pas due au même titre que les trames : le relais remonte `level` et ne marque `detailed` que pour `lecture_detaillee` ou `programme`, avec un commentaire clair — « un coach en `lecture_simple` a droit au direct de pilotage, pas à une donnée de santé ».

**Ce que le coach ne voit jamais.** Les coordonnées passent par une vue dédiée, `coach_pilots_view`, créée en `security_invoker = on` et filtrée sur coach courant + `active` + `pilot_consent_at IS NOT NULL`. Elle expose prénom, nom, niveau, avatar, et — après les migrations `0010_coach_pilots_view_profile.sql` et `0012_coach_pilots_view_media.sql` — l'expérience, la licence FFSA, le véhicule, les réseaux et les chemins média. Jamais l'email ni le téléphone. Le commentaire d'origine le formule ainsi : « pas d'email/tel/docs ».

**Chaque consultation est journalisée.** La fonction `public.log_coach_view()` (`supabase/migrations/20260525122829_coach_audit_log_function.sql`) écrit dans `admin_audit` après avoir re-vérifié que l'appelant est bien coach actif et consenti ; si ce n'est pas le cas, elle ne lève pas d'erreur, elle **ne fait rien silencieusement** — le commentaire explique que c'est pour ne pas révéler à un attaquant l'existence d'un pilote. L'appel est visible dans `src/services/coachService.ts` (`logCoachView`, ligne 266) et consommé par les écrans de comparaison.

**Une seconde grille, indépendante : les permissions modulaires.** La table `coach_permissions` (`supabase/migrations/20260526170000_0032_coach_permissions.sql`) porte trois booléens par coach : `can_view_pilots` (défaut vrai), `can_manage_own_sessions` (défaut faux) et `can_view_business_dashboard` (défaut faux). Un trigger `users_ensure_coach_permissions` crée la ligne à la promotion d'un utilisateur en coach. Le helper `coach_has_permission()` est fail-safe : pas de ligne, pas de permission. La distinction est importante et elle est écrite dans le commentaire de la table : la RLS **des données** reste gérée par `is_coach_of` ; ces drapeaux gatent des **fonctionnalités** (tableau de bord, roulages). Côté application, ils sont lus par `src/hooks/useCoachPermissions.ts`, lui aussi fail-safe (il conserve les permissions de base en cas d'erreur).

### Famille 1 — Le suivi des pilotes (5 écrans)

| Écran | Route | Rôle | Source des données |
|---|---|---|---|
| Poste de pilotage | `app/(coach)/index.tsx` | Hub, liste des binômes, activité, outils | `listMyPilots()`, `loadCoachQueue()`, `loadCoachDashboardSummary()` |
| Fiche pilote | `app/(coach)/pilote/[id].tsx` | CRM lecture seule d'un pilote | `listMyPilots()`, `listPilotSessions()`, `listSharedNotesForPilot()` |
| Comparer deux pilotes | `app/(coach)/comparer-pilotes.tsx` | Deux pilotes côte à côte | `loadSessionSnapshot()` ×2, `logCoachView()` |
| Messages (liste) | `app/(coach)/messages.tsx` | Fils coach↔pilote | `listMyThreads()`, `useCoachThread` (Realtime) |
| Fil de discussion | `app/(coach)/messages/[coachPilotId].tsx` | Une conversation plein écran | `coach_messages` via `useCoachThread`, `sendMessage()` |

Le **Poste** est le cœur de l'espace. Il est à la fois la liste des pilotes suivis (cartes issues de `coach_pilots_view`, donc uniquement les actifs et consentis), l'état de lecture (« à lire », dérivé de `coach_queue`), et la grille d'outils. Le fichier documente deux graphiques réels : une sparkline en barres « séances reçues par jour » sur sept jours, dérivée des `startedAt` déjà chargés (zéro requête supplémentaire), et un anneau « lues / à lire » calculé sur les compteurs réels de `groupQueue`. La règle est écrite : « valeur absente → graphique masqué, jamais de courbe plate inventée ».

La grille d'outils du Poste est **conditionnelle** (lignes 297-346 de `index.tsx`). « Comparer deux pilotes » n'apparaît que si `canViewPilots` et qu'il y a au moins deux pilotes. « Mes roulages » n'apparaît que si `canManageOwnSessions`. « Tableau de bord » n'apparaît que si `canViewBusinessDashboard`. « Facturation » n'apparaît que si le drapeau `coach_billing` est actif. Les outils toujours présents sont : Demandes, Programmes, Mes repères de virage, Mes gabarits, Assistant IA, Ma lecture, Vue AR (aperçu).

La **fiche pilote** est le point de départ de la guidance : elle mène à Priorités du bilan, Plan d'objectifs, Contexte et Annoter (paramétrés avec `pilotId` et, pour les deux derniers, `sessionId`), et elle porte une sélection FIFO de deux séances qui ouvre l'écran `comparer` (lignes 95-113).

La **messagerie** repose sur la table `coach_messages` (`supabase/migrations/20260711173005_coach_messages_table.sql`) : `body` de 1 à 2000 caractères, `session_id` optionnel, `read_at`. Sa policy d'insertion exige que le binôme soit `active` **et** consenti. Le service note un point de doctrine : la table ne porte que du texte, donc les cartes « note vocale » et pièce jointe des maquettes ne sont pas rendues — pas de contrôle mort.

### Famille 2 — La lecture d'une séance (14 écrans)

C'est la famille la plus fournie, et elle décrit une chaîne de travail cohérente : la file amène une séance, le studio la lit, le triage désigne où regarder, la note est écrite, le rapport et le débrief la restituent.

| Écran | Route | Rôle | Source des données |
|---|---|---|---|
| File de lecture | `file-lecture.tsx` | Séances à lire / lues / archivées | `loadCoachQueue()` + `setQueueStatus()` sur `coach_queue` |
| Studio | `studio.tsx` | Atelier de lecture d'UNE séance | `getStudioSession()`, `fetchSessionLaps()`, `loadSessionTrajectory()` |
| Triage | `triage.tsx` | Virages où la marge est la plus fine | `getSessionTriage()`, `loadSessionTrajectory()` |
| Débrief | `debrief.tsx` | Mode présentation, à montrer au pilote | `getStudioSession()`, `getSessionBiometry()` (si drapeau) |
| Rapport | `rapport.tsx` | Bilan écrit + PDF partagé | `getStudioSession()` + `coachReportPdfService` |
| Annoter | `annoter.tsx` | Note sur un virage, texte + mémo vocal | `coach_annotations`, `coachAudioService` |
| Contexte | `contexte.tsx` | Cadrage sportif de la séance | `coach_session_context` |
| Priorités | `priorites.tsx` | Virages mis en avant sur le bilan pilote | `coach_pilot_highlight` |
| Ma lecture | `lecture.tsx` | Pondérations personnelles du coach | `coach_reading_weights` |
| Comparer deux séances | `comparer.tsx` | Deux séances d'un même pilote | `loadSessionSnapshot()`, `computeRegularity()` |
| Gabarits | `gabarits.tsx` | Modèles de commentaire réutilisables | `coach_annotation_template` |
| Assistant IA | `assistant.tsx` | Brouillons IA à valider | `coach_ai_drafts` + edges `coach-ai-draft` / `coach-ai-validate` |
| Repères (liste) | `reperes.tsx` | Repères de virage par circuit | `coach_corner_reference`, `cornersForCircuit()` |
| Repère (éditeur) | `repere/[index].tsx` | Un repère : freinage + vitesse d'apex | `coach_corner_reference` |

La **file de lecture** s'appuie sur une table dédiée, `coach_queue` (`supabase/migrations/20260629140000_coach_ai_assistant_foundation.sql`, ligne 73). La logique de statut est pure et testée (`src/services/coachQueueLogic.ts`) : le statut explicite posé par le coach fait foi ; à défaut, une séance annotée est considérée comme lue. Le commentaire pose la doctrine : « la file aide le coach à s'organiser ; elle ne le presse pas ».

Le **Studio** est l'écran le plus structurant. Il agrège en un seul appel (`src/services/coachStudioService.ts`) le triage factuel, le radar QDI, le résumé des marges, les moments-clés et la méta de la séance. En console, il s'organise en trois colonnes : signature QDI et lecture rapide à gauche, trajectoire et marge par virage avec le chiffre roi au centre, « où regarder » et liste des tours à droite. Le garde-fou est écrit : « QDI en 5 branches, JAMAIS un score composite ». Depuis le Studio partent trois routes réelles : `rapport`, `debrief` et `triage`, toutes avec le `sessionId` en paramètre.

L'**annotation** est la seule sortie du coach vers le pilote, et elle est doublement gardée. Côté application, `createAnnotation()` refuse une note partagée qui ne passe pas `isDoctrineSafe()` (`src/services/coachAnnotationsService.ts`, ligne 155). Côté base, un trigger `coach_annotation_doctrine_guard` lève une exception `doctrine_violation` si une note partagée contient un verbe prescriptif ; depuis la migration 0027, ce trigger et celui des programmes partagent **un seul lexique SQL**, la fonction `public.is_prescriptive()`, qui liste 18 termes (« freinez », « accélérez », « il faut », « vous devriez », « je vous recommande »…) et se déclare miroir de `src/services/aiSafetyFilter.ts`. La note vocale passe par le bucket privé `coach-audio`, avec une contrainte de nommage stricte : l'objet doit s'appeler exactement l'UUID de l'annotation, sans extension ni dossier, parce que la policy storage lit l'objet par son nom (`src/services/coachAudioService.ts`, lignes 4-8). L'en-tête prévient : l'enregistrement requiert `expo-av`, donc un build natif.

L'**assistant IA** applique un protocole en trois temps que le code rend impossible à contourner. `requestDraft()` appelle l'edge `coach-ai-draft`, qui vérifie le consentement côté serveur. Le brouillon reste en `status='draft'` : le pilote ne le voit jamais. La validation passe par l'edge `coach-ai-validate` qui **re-filtre le texte édité** avant de créer l'annotation. La migration 0026 explique pourquoi : « la RLS coach interdit de poser `status='validated'` soi-même ». La provenance est conservée et affichée au pilote via `coach_annotations.ai_assisted`.

Les **repères de virage** sont multi-circuit depuis la demande fondateur du build 23 : le coach choisit d'abord le circuit, et la page s'adapte — 7 virages nommés sur Haute Saintonge (topologie Beltoise), des virages dérivés du tracé réel ailleurs (Valence en donne 14), et un état vide honnête si le circuit n'a pas de centerline. La clé est `coach_id + circuit_id + corner_index` (migration `20260716180000_corner_references_multicircuit.sql`).

### Famille 3 — Le direct (3 écrans)

| Écran | Route | Rôle | Source des données |
|---|---|---|---|
| En direct (roster) | `en-direct.tsx` | Qui est en piste, maintenant | `useLiveRoster` (presence Realtime), `useRosterBiometry` |
| En direct (focus) | `en-direct/[sessionId].tsx` | Un pilote suivi en détail | `usePilotLive` (broadcast Realtime), `fetchSessionLaps()` |
| Vue AR | `ar.tsx` | Aperçu des lunettes Ray-Ban Display | `usePilotLive` + WebView sur `https://app.oxvehicle.fr/ar-view` |

Le **roster** affiche qui est présent, depuis quand, en piste ou au stand, et sur quel circuit. Trois décisions y sont documentées et vérifiables dans le code. L'ordre suit le **numéro de voiture** (`sortRosterByCarNo`), jamais la performance — la justification écrite est juridique : « affiché publiquement, un ordre de performance peut requalifier un track day en compétition ». La biométrie ne transite **jamais** par le canal de présence : elle vient d'un hook distinct (`useRosterBiometry`), et la protection est décrite comme structurelle, aucune FC n'étant écrite dans `RosterMeta`. Enfin, le roster n'affiche **aucun bpm** : seulement une pastille de couleur, sur une échelle propre à chaque pilote, avec une mention explicite sous la liste — parce qu'une colonne de valeurs chiffrées se lirait comme un classement. La pastille est volontairement inerte : « pas de pulsation, pas de clignotement — ce serait une alerte, et l'app ne diagnostique pas ». En développement, un déclencheur `startSimulatedStream` permet de simuler un pilote en piste sans RaceBox ni réseau (ligne 175 et 437).

Le **focus pilote** montre le chrono du tour en cours comme chiffre roi (en or, seule couleur réservée au chrono), la vitesse et les G en relevés neutres, les forces G, les tours terminés lus dans la table `laps`. L'état de connexion est explicitement honnête (`live` / connexion / ralenti / coupé) : `usePilotLive` fait périmer le cardio au bout de 10 secondes sans événement et **efface** la valeur au lieu de la figer, avec ce commentaire : « l'absence est un état honnête ». Trois actions rapides existent et pointent toutes vers des écrans réels : Note vocale → `annoter`, Poser un repère → `reperes`, Message → `messages`.

La **vue AR** est marquée EXPÉRIMENTAL dans l'interface. Sa doctrine, écrite en tête de fichier, est catégorique : l'AR est l'outil **du coach au bord de piste**, jamais du pilote, et elle ne montre que des faits, jamais une consigne. L'aperçu in-lens est une WebView sur une route web externe qui peut ne pas être en ligne — les états de chargement et d'erreur sont gérés. Point notable : la fréquence cardiaque est rendue **en natif** et n'est jamais passée à la WebView ni ajoutée à l'URL, « aucune donnée de santé ne quitte cet écran coach ».

### Famille 4 — Le programme d'entraînement (3 écrans)

| Écran | Route | Rôle | Table |
|---|---|---|---|
| Programmes (liste) | `cycles.tsx` | Cycles d'un pilote, progression par étapes | `pilot_development_cycles` |
| Programme (détail) | `cycles/[id].tsx` | Étapes, statut, partage | `pilot_development_cycles` + `cycle_steps` |
| Plan d'objectifs | `plan.tsx` | Objectifs mesurables par pilote | `coach_objectives` |

Le modèle des programmes est posé par `supabase/migrations/0027_coach_development_cycles.sql`, dont la première ligne fixe le principe : « L'APP NE GÉNÈRE NI N'ADAPTE JAMAIS : elle stocke et affiche. L'"adaptatif" est l'ajustement humain. » Un cycle porte un titre, une intention formulée en observation, un statut `active`/`closed`, et un drapeau `is_shared` faux par défaut — le pilote ne voit rien tant que le coach n'a pas partagé. Les étapes (`cycle_steps`) portent un focus qualitatif, des virages associés bornés à 1..30, et **deux statuts seulement** : `en_cours` ou `atteint`. Il n'y a aucun score chiffré, par construction.

Trois durcissements de cette migration méritent d'être connus. Le partage **rescanne les enfants** : basculer `is_shared` à vrai revalide tous les `cycle_steps` du cycle, ce qui ferme le trou « axe prescriptif écrit en privé puis partagé ». L'authoring exige le niveau `programme` strict via `is_program_coach_of()`. Et le partenaire n'a **aucune** policy sur ces tables — le commentaire cite la « règle cardinale §148 ».

Le **plan d'objectifs** écrit dans `coach_objectives` (métrique, direction, cible, baseline). L'écran assume explicitement l'absence de barre de progression : la table ne stocke pas de valeur mesurée courante, donc il affiche « baseline → cible », jamais un pourcentage inventé. Il n'y a pas non plus d'échéance, absente du schéma.

### Famille 5 — L'activité commerciale et l'agenda (8 écrans)

| Écran | Route | Rôle | Source |
|---|---|---|---|
| Ma fiche publique | `profil.tsx` | Édition de la fiche vue par les pilotes | `coach_profiles` |
| Demandes reçues | `demandes.tsx` | Accepter / décliner une demande de séance | `coaching_bookings` |
| Disponibilités | `disponibilites.tsx` | Ouvrir, fermer, annuler des créneaux | `coach_availability` |
| Calendrier | `calendrier.tsx` | Semaine (console) ou liste (téléphone) | `listCoachBookings()` + `listMyAvailability()` |
| Tableau de bord | `business.tsx` | Suivi factuel de l'activité | `listMyPilots()`, `listMyRoulages()`, `roulagesLogic` |
| Facturation | `facturation.tsx` | Registre des factures émises | `coach_invoices`, `coach_profiles` |
| Identité de facturation | `facturation-identite.tsx` | Émetteur, régime TVA, SIRET | `coach_profiles` |
| Nouvelle facture | `facture-nouvelle.tsx` | Saisie de lignes, calcul HT/TVA/TTC | `coachBillingLogic` + `coach_invoices` |

La mise en relation vient de la place de marché (`supabase/migrations/0007_coaching_marketplace.sql`, tables `coach_availability` et `coaching_bookings`). Le point de sécurité important est écrit dans `src/services/coachMarketplaceService.ts` : « une demande `pending` n'ouvre aucun accès : l'affiliation `coach_pilots` reste le seul vecteur de consentement, et n'est PAS touchée ici ». Le coach voit un **prénom dénormalisé** porté par la demande (`coaching_bookings.pilot_first_name`), jamais la ligne `users` du pilote ; l'avatar de l'écran Demandes n'affiche donc qu'une initiale, faute de nom de famille. « Proposer un créneau » n'a pas d'action serveur propre et ouvre l'écran Disponibilités — le commentaire dit pourquoi : plutôt que d'exposer un contrôle mort.

Le **tableau de bord business** est gaté par `can_view_business_dashboard`. Il expose des faits : pilotes suivis, roulages organisés, présences confirmées, revenu cumulé des roulages tarifés, et un histogramme sur six mois glissants. La décision Gabin du 2026-06-07 est reprise en commentaire : aucune commission, aucune remise, aucun classement. Et « sans revenu tarifé, l'histogramme cède la place à une note ».

La **facturation** est entièrement conditionnée au drapeau `coach_billing`, **semé à `false`** par `supabase/migrations/20260704150000_p2_coach_billing_and_invoicing.sql` (ligne 90) avec la mention « INACTIF jusqu'au SIRET d'OXV ». Deux conséquences visibles : la tuile Facturation n'apparaît pas dans le Poste tant que le drapeau est éteint (`index.tsx`, lignes 337-345, avec le commentaire « le lien reste caché plutôt qu'un "bientôt" visible »), et l'écran lui-même se met en état neutre si `flagOn === false` (ligne 258 de `facturation.tsx`). Il faut noter que le rail de la console tablette, lui, route « Business » vers `/(coach)/facturation` sans condition : sur tablette, l'item existe donc, mais mène à un écran désactivé tant que le drapeau est off.

Le modèle économique est explicite dans le code : « le paiement de la prestation va DIRECTEMENT au coach, hors OXV : pas de suivi d'encaissement ». Il n'y a donc **aucun statut de règlement** — l'écran refuse de montrer des badges PAYÉE / ENVOYÉE présents sur les maquettes, parce que la donnée n'existe pas. Le numéro de facture est alloué atomiquement côté serveur (`coach_invoice_counters` + une fonction d'allocation durcie par `20260712090000_harden_next_coach_invoice_number_authz.sql`).

Le **profil public** édite `coach_profiles` (présentation, circuits, spécialités, liens, médias, publication via `is_published`). Depuis la migration `20260716200000_coach_session_price_and_partner_pings.sql`, la base porte deux tarifs : `session_price_eur`, le prix affiché aux pilotes, et `season_price_eur` en secondaire discret.

### Famille 6 — Les roulages (3 écrans)

| Écran | Route | Rôle | Table |
|---|---|---|---|
| Mes roulages | `roulages/index.tsx` | À venir / passés | `coach_roulages` |
| Nouveau roulage | `roulages/nouveau.tsx` | Création : titre, date, lieu, places, prix | `coach_roulages` |
| Détail roulage | `roulages/[id].tsx` | Roster, invitations, briefing, statut | `coach_roulages` + `roulage_invitations` |

Les roulages sont la seule fonctionnalité coach dont le gating est **doublement** appliqué : côté interface par `useCoachPermissions` (l'écran l'indique sobrement sans rien exposer si la permission est absente), et côté base par la policy `coach_roulages_manage_own`, qui exige `coach_id = auth.uid() AND coach_has_permission(auth.uid(), 'manage_own_sessions')` en `USING` **et** en `WITH CHECK` (`supabase/migrations/20260526190000_0034_coach_roulages.sql`, lignes 124-127). Les invitations sont limitées aux pilotes déjà assignés au coach (`coach_pilots` actif), d'après l'en-tête de `src/services/roulagesService.ts`.

### Ce qui est branché, et ce qui ne l'est pas

L'espace coach s'appuie sur 33 services `src/services/coach*.ts` plus `roulagesService`, `pilotConsentService` et `liveRelayRunner`. La quasi-totalité est consommée par un écran. Deux exceptions vérifiées par recherche sur tout `src/` et `app/`, hors tests :

`src/services/coachConsoleService.ts` et sa logique pure `coachConsoleLogic.ts` — la « console de direction » P4, qui calcule pour chaque pilote sa dernière séance et sa tendance de marge par rapport à **sa propre** séance précédente — ne sont importés par **aucun écran**. `src/services/coachBusinessService.ts` non plus : l'écran `business.tsx` passe par `roulagesLogic` et `computeCoachBusinessSummary`, pas par ce service.

Côté couverture de test, l'espace coach dispose de tests de logique pure (`coachQueueLogic`, `coachTriageLogic`, `coachReadingLogic`, `coachCurationLogic`, `coachReferenceLogic`, `coachContextLogic`, `coachBillingLogic`, `coachConsoleLogic`, `coachObjectivesService`, `coachDomainNoScore`, `coachPaymentLinkGuard`) et de quatre suites RLS (`src/__tests__/rls/coachSessionsRLS.test.ts`, `coachAnnotationsRLS`, `coachGradedAccessRLS`, `coachAiRLS`), plus le test de cohérence de navigation déjà cité. Je n'ai pas exécuté la suite ; je constate l'existence des fichiers.

### Deux tensions relevées dans le dépôt

Ce ne sont pas des jugements, ce sont deux écarts que j'ai constatés entre des fichiers du dépôt et que je ne peux pas trancher sans interroger la base de production.

**Premièrement, la colonne `status` de `coach_pilots`.** Le type de production (`src/types/database.types.ts`, lignes 2176-2221) montre que la table porte en réalité `status` (énum `affiliation_status` : `pending` / `active` / `declined` / `ended`), `initiated_by` (énum `affiliation_initiator` : `coach` / `pilot`), `coach_consent_at` et `affiliation_price_eur`. **Aucune migration du dépôt ne crée ces colonnes ni ces énums** (recherche sur `supabase/` : zéro résultat). Conséquence observable : `liveRelayRunner.ts` filtre bien sur `status = 'active'` (ligne 83), mais les helpers SQL du dépôt — `is_coach_of`, `is_detailed_coach_of`, `is_program_coach_of`, `log_coach_view` — ne testent que `active` et `pilot_consent_at`. Les deux chemins n'appliquent donc pas la même définition d'une affiliation vivante, du moins d'après le code présent ici.

**Deuxièmement, la lecture des noms de pilotes.** La vue `coach_pilots_view` est en `security_invoker = on` et joint `public.users`, or la seule policy SELECT sur `users` que je trouve dans le dépôt est `users_select_own_or_admin` (`id = auth.uid() OR is_admin()`), reprise à l'identique dans `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`. Avec ces deux éléments seuls, un coach ne lirait aucune ligne par la vue. Comme l'espace coach fonctionne, il existe très probablement en production une policy supplémentaire sur `users` (par exemple fondée sur `is_coach_of`) qui n'est pas dans le dépôt — le document RLS lui-même est daté du 24 mai 2026, soit avant les fonctionnalités coach. Le même raisonnement vaut pour `coachMessagesService.listMyThreads`, qui embarque `users(first_name, last_name)` et retombe sur le libellé « Pilote » en cas d'échec.

### Ce que je n'ai pas pu vérifier

Je n'ai **pas interrogé la base Supabase de production** : tout ce qui précède est lu dans le dépôt. Je ne peux donc pas confirmer l'état réel des drapeaux (`coach_billing` est semé à `false` par sa migration, `biometry` est semé à `false` par `20260719140000_be1_feature_flags.sql` — le repère qui m'a été donné dit que `biometry` est aujourd'hui le seul actif, ce qui suppose une bascule admin que je n'ai pas vue), ni la liste réelle des policies sur `public.users`, ni l'existence en base des colonnes `status` / `initiated_by` / `coach_consent_at` au-delà de ce qu'en dit le fichier de types généré.

Je n'ai **pas exécuté les tests** ni lancé l'application : je n'ai donc constaté aucun comportement à l'exécution, seulement du code et des migrations.

Je n'ai **pas lu intégralement** les 36 écrans. J'ai lu en entier `_layout.tsx` et `coachNav.ts`, et j'ai lu l'en-tête documentaire complet (30 à 55 lignes) de chacun des 36 écrans, en descendant dans le corps de `index.tsx`, `pilote/[id].tsx`, `file-lecture.tsx`, `facturation.tsx`, `debrief.tsx`, `en-direct.tsx` et `en-direct/[sessionId].tsx`. Pour les autres écrans, la description de la mise en page console/compagnon repose sur leur en-tête, pas sur une lecture ligne à ligne du rendu ; il est possible qu'un détail d'affichage diffère de ce que l'en-tête annonce.

Je n'ai **pas ouvert** les edge functions `coach-ai-draft` et `coach-ai-validate` (je décris leur contrat tel que le service app et la migration 0026 l'énoncent), ni les maquettes PNG référencées (`coach/01-poste.png`, `coach-mobile/…`), ni les documents de cadrage cités par les en-têtes (`VISION_COACH_STUDIO.md`, `docs/specs-bundle-v4/specs/E0_ar_coach.md`, le handoff §12). Enfin, je n'ai pas vérifié où et comment les productions du coach (priorités, repères, « ma lecture », programmes partagés) apparaissent effectivement **côté pilote** : je décris ce que le coach écrit, pas ce que le pilote voit.

---

## Données, permissions et conformité

### Où vivent les données, et sous quel nom

Toute la donnée de l'application vit dans un seul projet Supabase (PostgreSQL 17.6), référence `fouvuqkdxarjpjbqnsjq`, nommé **`oxv-platform`**, créé le 8 mai 2026, statut `ACTIVE_HEALTHY`. Ce projet est partagé avec le site oxvehicle.fr : l'application n'a pas de base à elle.

**Sa région est `eu-west-1`, c'est-à-dire l'Irlande.** Ce point mérite votre attention, car trois documents du dépôt se contredisent sur ce sujet :

| Source | Ce qu'elle affirme | Vérifié |
|---|---|---|
| `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md` (l. 3 et 534) | « Frankfurt », « région eu-central-1 » | **faux aujourd'hui** |
| `docs/architecture/14_PURGE_MATRIX.md` (l. 3) | « eu-west-1 » | exact |
| `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md` (l. 149 et 316) | « Frankfurt, Allemagne (UE) », « principalement en Allemagne (Frankfurt) chez notre hébergeur Supabase » | **faux** |

L'API Supabase, interrogée en lecture seule pendant cet état des lieux, renvoie `"region":"eu-west-1"`. Le fait que la donnée reste dans l'Union européenne n'est pas remis en cause ; c'est le pays annoncé au pilote dans un document juridique opposable qui est inexact. Le document `docs/juridique/consentement_biometrie.md` (l. 11-13) le pressent d'ailleurs : il laisse explicitement en blanc « la localisation d'hébergement des mesures », « faute d'information vérifiée ».

Le schéma `public` contient **114 tables et 14 vues**. Le fichier de types généré `src/types/database.types.ts` (9 275 lignes) en connaît 113 : la table `founding_members`, présente en base, n'y figure pas — les types sont en léger retard sur la production. Le dépôt contient **125 fichiers de migration** dans `supabase/migrations/`, alors que la base en a **215 d'appliquées** (dernière version enregistrée : `20260725185806`). L'écart s'explique par le fait que le site web applique ses propres migrations sur le même projet : le dépôt de l'application ne raconte pas toute l'histoire du schéma.

### Les tables principales, par famille

Je décris ici ce que j'ai réellement lu, en indiquant le volume constaté en production au moment de l'audit.

**Les personnes.** `users` est la table maîtresse : **72 colonnes**, 14 lignes. Elle porte l'identité (nom, date de naissance, adresse, contact d'urgence), le KYC (`kyc_status`, `kyc_validated_at/by`), le rôle (`user_role` : `pilot`, `admin`, `coach`, `partner`, `pro_pilot`), le profil pilote, la visibilité communautaire (`community_visibility` : `private` / `anonymous_only` / `nominative`, défaut `anonymous_only`), les préférences de notification, et — c'est important pour la suite — **l'intégralité des consentements et des acceptations juridiques**. Elle porte aussi deux colonnes de santé héritées du site, `blood_type` et `medical_notes`.

**Les séances télémétriques.** `telemetry_sessions` (18 lignes) est la séance de roulage enregistrée par le boîtier : circuit, véhicule, horodatage, statistiques agrégées (vitesse max, G latéral/longitudinal, nombre de tours, meilleur tour), statut, et `raw_data_url` pointant vers le fichier `.ubx` brut. `telemetry_frames` (53 lignes) porte les trames à 25 Hz : GPS, vitesse, cap, trois axes de G, niveau de batterie. Depuis la migration `20260715120000_valencia_telemetry_frames_unique.sql`, cette table a une contrainte **`UNIQUE (session_id, elapsed_ms)`** vérifiée présente en base — c'est elle qui rend le rejeu de la file de synchronisation idempotent. La migration porte un avertissement long et explicite : elle n'est sûre qu'à partir de la version d'application qui génère un `elapsed_ms` strictement croissant, sans quoi elle aurait détruit en silence des trames réelles. Symétriquement, `laps` (1 ligne) porte `UNIQUE (session_id, lap_number)` (migration `20260716120000_valencia_laps_unique.sql`).

**Les analyses.** `app_session_analyses` (13 lignes) porte la lecture de séance : marge globale, zone de marge, marges par zone en JSON, texte de débrief, et depuis `20260704120000_qdi_jsonb_on_app_session_analyses.sql` un bloc QDI en JSONB. `app_segment_analyses` (0 ligne) porte le détail par segment, plafonné à 7 segments (`20260525141634_cap_segment_index_to_7.sql`). `session_insights` (1 ligne) est alimentée par les fonctions edge `compute-session-insights`. La table `qdi_scores` décrite dans `05_SCHEMA_SUPABASE_ACTUEL.md` **n'existe plus** : `to_regclass('public.qdi_scores')` renvoie NULL, elle a été supprimée par `20260524144630_0007_drop_qdi_scores_doctrine_alignment.sql`. De même, `app_circuit_zones`, annoncée comme « à créer » dans ce même document, **n'a jamais été créée**. Le document 05 décrit donc, sur ces deux points, un état qui n'est plus le vôtre.

**La biométrie.** `biometry_raw` (0 ligne) a été créée par `20260719141000_be1_biometry.sql`. Une ligne = un échantillon : `session_id`, `user_id`, horodatage, `hr` (contraint entre 25 et 250), `rr_ms` (tableau d'intervalles R-R, ceinture Polar seulement), `source` contraint à `polar_h10` ou `apple_watch`, et `quality`. La clé `UNIQUE (session_id, ts, source)` assure l'idempotence au rejeu. C'est la seule table du schéma explicitement traitée comme donnée de santé au sens de l'article 9.

**Le coaching.** Le socle est `coach_pilots` (1 ligne) : un lien nominatif coach↔pilote, avec `active`, `pilot_consent_at` (consentement RGPD du pilote), `level` (énumération `coach_access_level` : `lecture_simple`, `lecture_detaillee`, `programme`) et `live_sharing_at` (consentement distinct au partage temps réel, ajouté par `20260711172949`). Autour gravitent une trentaine de tables : `coach_profiles` (dont la facturation : `billing_siret`, `billing_address`, `payment_link`), `coach_annotations`, `coach_messages`, `coach_objectives`, `coach_availability`, `coach_roulages`, `coach_session_context`, `coach_corner_reference`, `coach_reading_weights`, `coach_ai_drafts`, `coach_queue`, `coach_testimonials`, `pilot_sheets`, `coaching_bookings`, `pilot_development_cycles`, `cycle_steps`.

**Les événements et l'exploitation.** `sessions` (1 ligne) est la journée de roulage vendue par le site, `registrations` (1 ligne) l'inscription, `events` (1 ligne) + `event_registrations` la brique événementielle propre à l'application (migration `0021_events.sql`), `circuits` (4 lignes), `weather_snapshots`, `devices` / `device_assignments` / `device_health_logs` pour le parc de boîtiers.

**La facturation.** Deux chaînes distinctes coexistent, et elles ne se mélangent pas. Côté OXV : `payments` (1 ligne), `invoices`, `invoice_counters`, `subscriptions`, `pricing`. Côté coach, posée par `20260704150000_p2_coach_billing_and_invoicing.sql` : `coach_invoices` (0 ligne), `coach_invoice_counters`, et `coach_payout_details`. L'en-tête de cette migration est net : « OXV n'encaisse ni ne facture la prestation ; l'app = suivi + outil de facture pour le coach qui l'active », avec un avertissement en toutes lettres — « Gabarit de facture + régime TVA à faire VALIDER par un comptable avant service ».

### Le contrôle d'accès : les patrons RLS

**110 tables sur 114 ont RLS activée**, pour **322 politiques** dans le schéma `public`, plus 39 sur `storage.objects`. Les quatre tables sans RLS sont des copies de sauvegarde (`_backup_payments_20260719`, `_backup_registrations_20260719`, `_backup_session_feedback_20260719`, `_backup_weather_20260719`) ; j'ai vérifié leurs droits : **seul `service_role` a le moindre privilège dessus**, `anon` et `authenticated` n'en ont aucun, elles ne sont donc pas exposées par l'API. La cinquième, `_backup_sessions_20260719`, a bien RLS activée et zéro politique — c'est un refus total.

Cinq patrons se répètent dans tout le schéma.

**Le patron « ma ligne ou admin »**, le plus fréquent. Sur `users` : `((id = auth.uid()) OR is_admin())` en lecture, en écriture, en insertion ; la suppression est réservée à `is_admin()`. Sur `documents` (le KYC), même chose en lecture, mais **la validation d'un document est admin-only** (`documents_update_admin_only`) : un pilote ne peut pas valider son propre permis.

**Le patron « propriétaire strict »**, sans admin. Sur `telemetry_sessions` : les quatre politiques historiques sont `auth.uid() = user_id`, et une politique `telemetry_sessions_admin_all` a été ajoutée ensuite. Sur `telemetry_frames`, la propriété est indirecte : `session_id IN (SELECT id FROM telemetry_sessions WHERE user_id = auth.uid())`.

**Le patron « coach binôme », gradué.** Il repose sur deux fonctions `SECURITY DEFINER` à `search_path` épinglé :
- `is_coach_of(pilot_uuid)` — vrai si l'appelant est coach de ce pilote, avec `active = true` **et** `pilot_consent_at IS NOT NULL`. Tant que le pilote n'a pas consenti, le coach ne voit rien.
- `is_detailed_coach_of(pilot_uuid)` — les mêmes conditions **plus** `level IN ('lecture_detaillee','programme')`.

La graduation, posée par `0014_coach_access_level_graduated.sql`, est appliquée avec précision : `telemetry_sessions`, `laps` et `app_session_analyses` sont ouvertes au coach par `is_coach_of` (lecture simple suffit) ; `telemetry_frames` et `app_segment_analyses` exigent `is_detailed_coach_of`. Une vue dédiée, `coach_pilots_view`, en `security_invoker`, expose au coach le prénom, le nom, le niveau et l'avatar de ses pilotes — **jamais l'e-mail ni le téléphone**, PostgreSQL ne sachant pas faire de RLS colonne par colonne.

**Le patron « admin ».** `is_admin()` est `SECURITY DEFINER`, ce qui évite la récursion sur `users`. Depuis `20260617000000_0041_is_admin_honor_flag.sql`, elle honore aussi le drapeau `is_admin` de la ligne. Elle gouverne l'écriture des drapeaux, des tarifs, la validation KYC, et la lecture de `admin_audit`.

**Le patron « ami ».** `are_friends(a, b)` ouvre une lecture croisée sur `telemetry_sessions`, `telemetry_frames` et `app_session_analyses`. C'est le seul chemin par lequel un pilote lambda peut voir la donnée d'un autre pilote, et il exige une amitié établie des deux côtés (`pilot_friendships`).

À côté de cela, quelques politiques méritent d'être connues telles quelles : `coach_profiles_read_published` ouvre le profil coach à **tout le monde** dès `is_published = true` — c'est la raison pour laquelle SEC-1 a sorti l'IBAN de cette table ; `coach_annotations_pilot_select` ne laisse le pilote lire une annotation de son coach que si `visibility = 'shared'` et qu'elle n'est pas supprimée ; `session_intentions_coach_select` exige `shared_with_coach = true` ; `incident_reports` n'a que deux politiques, insertion et lecture — **aucun UPDATE, aucun DELETE**, la table est immuable par construction, pour sa valeur probatoire.

Le temps réel a ses propres politiques, dans le schéma `realtime`, que j'ai vérifiées en base. Trois canaux : `live:session:<id>` (coach du binôme, exige `cp.active` et `cp.live_sharing_at IS NOT NULL`), `live:roster:<uid>`, et `live:board:<sessionId>` — le tableau de marche du paddock, ajouté le 25 juillet par `20260725190000_live_board_realtime_authorization.sql`. L'en-tête de cette migration pose une interdiction définitive : aucune donnée de santé ne transite sur le canal board. Et elle reconnaît honnêtement sa limite : l'ouverture « tout inscrit de la journée » n'a **pas** été écrite, parce qu'une séance télémétrique ne porte aucune référence vers la journée de roulage — « on n'écrit pas une règle d'accès sur une devinette ».

Ce garde-fou n'est pas seulement déclaratif. `src/services/v2/liveHealthGate.ts` porte deux fonctions pures : `stripHealth()`, une **liste blanche** de huit clés (`position`, `lapMs`, `sector`, `ts`, `pilotHandle`, `carNo`, `lastLapMs`, `bestLapMs`) — tout le reste est écarté, y compris un capteur qu'on brancherait demain ; et `canEmitBiometry()`, qui n'autorise l'émission vers le coach que si **trois verrous** sont strictement vrais : consentement de capture actif, binôme détaillé, drapeau `biometry` serveur.

Enfin, la RLS est testée : **18 fichiers de tests** dans `src/__tests__/rls/` (le document `17_CI_RLS_SETUP.md` en annonce 85 tests répartis en 17 suites). Le workflow `.github/workflows/check.yml` porte un job dédié `rls` qui est **fail-closed** depuis SEC-1 : sans les secrets `TEST_SUPABASE_*`, il échoue avec « Secrets CI RLS manquants », au lieu de sauter silencieusement. La seule exception loggée concerne les forks et dependabot. Le document précise que ces tests **n'avaient jamais tourné en CI** avant ce durcissement ; je n'ai pas pu vérifier si les secrets ont été posés depuis.

### Les consentements

Tous les consentements sont stockés **en colonnes sur `users`**, pas dans une table dédiée. Le service unique qui les lit et les écrit est `src/services/consentService.ts`.

| Consentement | Colonne(s) | Modèle | Défaut | Ce qu'il gouverne |
|---|---|---|---|---|
| Débrief J+1 rédigé par IA | `ai_debrief_enabled` (bool) | opt-out | **activé** | Transfert vers OpenAI (hors UE) pour le récit de séance |
| Assistant IA du coach | `coach_ai_enabled` (bool) | opt-in | désactivé | Traitement IA des données du pilote pour le coach |
| Capture cardiaque | `biometry_capture_consent_at` (timestamptz) | opt-in | NULL = OFF | Autorise la capture FC en séance |
| Partage cardiaque au coach | `biometry_coach_share_consent_at` (timestamptz) | opt-in | NULL = OFF | Autorise le coach détaillé à lire la FC |
| Coaching (par binôme) | `coach_pilots.pilot_consent_at` | opt-in | NULL | Ouvre la lecture après-séance au coach |
| Partage live (par binôme) | `coach_pilots.live_sharing_at` | opt-in | NULL | Ouvre le canal temps réel au coach |
| Nom affiché au Pavillon | `pavilion_name_optin` + `_at` | opt-in | false | Affichage du nom sur l'écran TV |
| Marketing | `accepts_marketing`, `notif_newsletter`, `notif_offers` | opt-in | false | Sollicitations commerciales |
| Mesure d'audience | drapeau local MMKV `analytics.optOut` | opt-out | activé | Plausible ; **pas en base**, propre à l'appareil |

Le choix du **timestamptz plutôt que du booléen** pour la biométrie est délibéré et documenté dans la migration : une date fournit la piste d'audit exigée par l'article 9, la révocation étant un retour à NULL.

Un invariant est maintenu dans les deux sens, à la fois dans le service (`consentService.ts`, l. 141-192) et dans sa copie pure côté interface (`src/features/vous/reglagesConsentLogic.ts`) : **partager implique capter**. Révoquer la capture révoque le partage en cascade ; activer le partage active la capture si elle ne l'était pas, sans écraser une date antérieure. Révoquer la capture demande une confirmation à l'écran ; l'activer, non.

Les acceptations juridiques sont horodatées et versionnées sur `users` : `pact_accepted_at`/`pact_version`, `cgu_accepted_at`/`cgu_version`, `privacy_accepted_at`/`privacy_version`, `coach_pact_accepted_at`/`coach_pact_version`. Elles sont **conservées après effacement du compte**, comme preuve de consentement.

Deux écarts de couverture sont à connaître, et le premier est écrit noir sur blanc en tête de `consentService.ts` (l. 14-26) par son propre auteur :

> Le Centre de consentement unifié (`app/(app)/consentements.tsx`) « se présente pourtant comme exhaustif (“chacun de ses consentements”) » mais **ne référence pas la biométrie**, qui n'existe que dans les Réglages de l'espace app2. Sa revendication d'exhaustivité est donc inexacte pour le consentement le plus sensible. La décision produit est ouverte.

J'ai vérifié en ouvrant l'écran : il expose l'IA débrief, l'IA coach, la mesure d'audience, l'export et la suppression — pas la biométrie.

Le second écart est plus lourd. `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md` **ne contient aucune occurrence** des mots « cardiaque », « biométrie », « santé » ou « article 9 » (recherche insensible à la casse, zéro résultat). Le texte de consentement biométrique existe bien et est marqué « VALIDÉ PAR L'AVOCAT (annexe A) — 25/07/2026 » dans `docs/juridique/consentement_biometrie.md`, mais il annonce lui-même figurer « sous une forme équivalente, dans la Politique de confidentialité » — ce qui n'est pas le cas dans le fichier du dépôt.

### Les drapeaux de fonctionnalité

La table `app_feature_flags` (créée par `20260629003722_app_feature_flags.sql`) est en lecture ouverte à tous (`USING (true)`) et en écriture `is_admin()`. Le service `src/services/featureFlagsService.ts` la lit via `isFlagEnabled(key)`, **fail-closed** : une erreur ou une clé absente renvoie `false`.

Interrogée en production, elle contient **sept drapeaux**, dont **un seul actif** :

| Clé | État | Ce qu'elle commande | Dernière modification |
|---|---|---|---|
| **`biometry`** | **activé** | Capture et affichage de la fréquence cardiaque | 2026-07-25 |
| `app_payments` | désactivé | Réservations et paiements dans l'application | 2026-07-19 |
| `coach_billing` | désactivé | Suivi et aide à la facture du coach | 2026-07-06 |
| `convoys` | désactivé | Convois vers une journée | 2026-07-19 |
| `founders` | désactivé | Candidatures Membre Fondateur (30 places) | 2026-07-19 |
| `pilot_waivers` | désactivé | Décharge de responsabilité e-signée | 2026-07-12 |
| `video_overlay` | désactivé | Vidéo du tour synchronisée à la télémétrie | 2026-07-19 |

La description en base du drapeau `biometry` est elle-même un document : « Gate consentement biometry par pilote (capture + partage coach) TOUJOURS requis. Levé le 2026-07-25 sur décision fondateur, après validation avocat du consentement. **Reste non tenu à la levée : smoke test 2 appareils reels.** » Le drapeau est donc actif alors que le test terrain sur deux appareils réels n'a pas été fait.

Ces drapeaux sont réellement consommés : j'ai relevé une vingtaine d'appels à `isFlagEnabled` dans `src/features/` et `src/services/`, notamment `useBilan.ts`, `useEquipement.ts`, `useSignature.ts`, `bio1Trigger.ts`, `biometryCaptureRunner.ts` pour la biométrie, `useReserverDay/Catalog/Payment.ts` pour les paiements, `useDocuments.ts` pour les décharges.

### Rétention, purges et automatismes

Trois durées de conservation sont **codées** en base, et une quatrième est seulement écrite dans la politique.

| Objet | Durée | Fonction | Cron |
|---|---|---|---|
| Trames télémétriques brutes | 12 mois | `cleanup_old_telemetry_frames()` | **jobid 6**, `30 3 * * *` |
| Échantillons cardiaques | 30 jours | `purge_old_biometry()` | **jobid 11**, `15 3 * * *` |
| Comptes en attente d'effacement | 30 jours de grâce | edge `purge-deleted-accounts` → `purge_user_data()` | **jobid 9**, `30 2 * * *` |
| Journaux de throttle notification | non planifié | `cleanup_old_notif_logs()` existe | **aucun cron trouvé** |

Les trois fonctions de purge sont `SECURITY DEFINER` avec `search_path` figé et `EXECUTE` réservé à `service_role` : aucun client ne peut les déclencher. La purge des trames conserve délibérément les dérivés (analyses, segments, insights, tours) : « la lecture de session reste intacte après la purge ».

`cleanup_old_notif_logs()` existe en base mais **aucun des huit jobs cron ne l'appelle** — le nettoyage des journaux de notification n'est donc pas automatisé.

La chaîne d'effacement mérite d'être détaillée, parce qu'elle a beaucoup bougé en une semaine. L'audit du 19 juillet (`14_PURGE_MATRIX.md`) constatait sept problèmes, dont trois majeurs : aucun cron ne déclenchait la purge (« infraction art. 17 en pratique »), une vingtaine de tables porteuses de données personnelles étaient hors périmètre, et le Storage n'était couvert qu'à 4 buckets sur 12, sans récursivité. `SEC1_PROD_APPLY.md` (§ « APPLIQUÉ EN PROD — 2026-07-19 ») documente la correction, et **je l'ai vérifiée en base** : la fonction `purge_user_data(uuid)` existe, le cron jobid 9 existe et tourne.

Sa stratégie est **anonymiser-et-purger**, et la raison est mécanique : `payments.user_id` est en `NO ACTION`, donc un `DELETE` de la ligne `users` échouerait. La ligne reste, vidée. J'ai lu la définition déployée : elle supprime une cinquantaine de tables, anonymise `coaching_bookings.pilot_first_name`, `email_log` (user_id, subject, metadata), `admin_audit.user_id`, `device_assignments.pilot_id`, `duels.opponent_id`, `crew_members.referred_by`, anonymise `incident_reports.user_id` sans jamais le supprimer, purge `biometry_raw` et remet à NULL les deux colonnes de consentement biométrique. Le scrub de `users` couvre 33 colonnes, dont **`blood_type` et `medical_notes`** — les données de santé héritées.

Deux conservations sont volontaires et assumées : `stripe_customer_id` (réconciliation de facturation ; l'effacement côté Stripe reste « à trancher »), et les acceptations pacte/CGU/confidentialité (preuve de consentement). Le bucket `invoices` est explicitement conservé pour l'obligation légale de facturation.

Une remarque de vigilance sur le Storage : la base compte aujourd'hui **13 buckets** (`audio_briefings`, `avatars`, `coach-audio`, `coach-media`, `documents`, `founding-members`, `invoices`, `partner-media`, `pavillon-photos`, `pilot-media`, `session-media`, `telemetry_raw`, `vehicles`). La fonction edge `purge-deleted-accounts/index.ts` en liste huit dans `PREFIX_BUCKETS`, plus `coach-audio` traité à part. Le bucket **`founding-members`, créé le 21 juillet — soit deux jours après l'audit de purge — n'est dans aucune de ces listes**. Trois buckets sont publics : `avatars`, `coach-media`, `partner-media`.

Enfin, l'en-tête du fichier `purge-deleted-accounts/index.ts` dans le dépôt dit encore « VERSION 5 (SEC-1) — PRÉPARÉE, NON DÉPLOYÉE » et « AUCUN cron ne l'invoque » ; c'est **périmé** — `SEC1_PROD_APPLY.md` et la base montrent que la v5 est déployée et le cron planifié. Idem pour `20260719_sec1_purge_sante.sql`, qui porte toujours « PRÉPARÉE, NON APPLIQUÉE » alors que la fonction est en production.

### Droit à l'effacement et portabilité

**Effacement (art. 17).** `src/services/accountService.ts` pose la demande côté application : il horodate `deletion_requested_at` et calcule `deletion_scheduled_at` à J+30 (`DELETION_GRACE_DAYS = 30`, aligné sur le §7.3 de la politique). Le service prend soin de faire `.select('id')` pour **vérifier qu'une ligne a bien été écrite**, plutôt que de laisser croire au pilote que sa suppression est planifiée alors que la RLS aurait bloqué. Passé le délai, le cron quotidien réveille l'edge, qui collecte les références Storage, supprime les objets de façon récursive et fail-closed, puis appelle `purge_user_data()` en une seule transaction, et enfin anonymise et bannit le compte Auth. L'idempotence repose sur le courriel placeholder `deleted-<id>@oxv.invalid`.

**Portabilité (art. 20).** `src/services/dataExportService.ts` fait un export **100 % côté application** : il relit les lignes du pilote (la RLS l'y autorise déjà), assemble un JSON versionné et le passe à la feuille de partage native. Le périmètre est le profil, les séances, véhicules, objectifs, amitiés, analyses de séance et de segment, insights, tours, médias et partages. Deux exclusions sont documentées : les trames brutes (volume), disponibles sur demande à contact@oxvehicle.fr, et — ceci n'est **pas** documenté dans le fichier — **`biometry_raw` ne figure pas dans l'export**. L'export est honnête sur ses échecs : il porte un drapeau `partial` et une liste `failed_sections` plutôt que de masquer une lecture ratée.

**Rétention annoncée au pilote** (`04_POLITIQUE_CONFIDENTIALITE.md`, §6) : compte inactif 3 ans, documents KYC 5 ans, trames 12 mois, analyses dérivées pendant la vie du compte, factures 10 ans, journaux techniques 12 mois. Je n'ai trouvé **aucune automatisation** pour la purge du compte inactif à 3 ans ni pour les documents KYC à 5 ans : ces deux durées sont annoncées mais non implémentées, et aucun cron ne les porte. La durée de 30 jours de la biométrie, elle, est implémentée mais **absente du tableau de la politique**.

### Journal d'accès et audit

Il existe un journal, `admin_audit`, en accès strictement admin (trois politiques, toutes `is_admin()`). Il contient **59 lignes** au moment de l'audit. Il est alimenté par trois chemins que j'ai vérifiés :

- **Le changement de rôle**, par trigger. `0015_audit_user_role_change.sql` pose `trg_audit_user_role_change` sur `users`, qui écrit une entrée `role_changed` avec l'ancien rôle, le nouveau et `auth.uid()`. L'en-tête est explicite : avant, les promotions de rôle mutaient `users.role` « sans trace ». Trois entrées `role_changed` en production, du 7 au 20 juillet.
- **L'accès du coach aux données du pilote**, à la demande de l'application. `log_coach_view(pilot, subtype, session)` est `SECURITY DEFINER`, vérifie d'abord que l'appelant est bien coach actif et consenti, et **ne lève pas d'erreur** s'il ne l'est pas — un no-op silencieux, pour ne pas révéler à un attaquant si un pilote existe. Deux entrées `coach_view_sessions` en production.
- **Les fonctions edge**, qui y relaient leurs envois (`session_analysis_notified` 13 fois, `contact_ack_relayed` 7, `application_ack_relayed` 3, `inscription_accept_relayed` 3, `coach_annotation_notified` 3), plus 23 entrées `login`.

Ce journal est un **journal d'actions sensibles, pas un journal d'accès exhaustif** : une lecture de données par un coach n'y apparaît que si l'application appelle explicitement `log_coach_view`. Rien au niveau de la base ne garantit qu'elle le fasse à chaque consultation. Par ailleurs, `admin_audit.user_id` est anonymisé (mis à NULL) par la purge de compte, et la matrice note que « la rétention globale du log est à borner (hors SEC-1) » — je n'ai trouvé aucune purge par âge sur cette table.

### État de sécurité constaté

Les advisors de sécurité Supabase, que j'ai relancés pendant cet état des lieux, renvoient **83 avertissements, dont zéro ERROR** — conforme à ce qu'annonce `SEC1_PROD_APPLY.md` §8. La répartition : 57 `authenticated_security_definer_function_executable`, 19 `anon_security_definer_function_executable`, 2 `public_bucket_allows_listing` (`coach-media` et `partner-media`, vitrines publiques du site, assumées), 1 `rls_policy_always_true` (`corporate_leads`, politique d'insertion sans condition — signalée comme « à traiter dans un lot dédié »), et 4 INFO `rls_enabled_no_policy` (les refus volontaires : `app_pairing_redeem_attempts`, `invoice_counters`, `founding_members`, `_backup_sessions_20260719`).

Le registre des fonctions edge (`15_EDGES_REGISTRY.md`) inventorie 32 fonctions et cinq découvertes. Une seule a été corrigée depuis : `ritual_dispatcher`, dont la garde « décodait le payload du JWT sans vérifier la signature » — un jeton forgé passait — a été remplacée par un secret Vault (v23), et son job cron réécrit sans la clé `service_role` en clair (l'ancien jobid 3 a disparu, le nouveau est jobid 10 : je l'ai vérifié en base). Les autres restent ouvertes, notamment le fait que `compute-session-insights`, `compute-session-insights-v3` et `generate-debrief-ai` ne contrôlent pas la propriété du `sessionId` — tout utilisateur authentifié peut déclencher un calcul sur la séance d'autrui.

---

### Ce que je n'ai pas pu vérifier

Je n'ai pas ouvert les 125 fichiers de migration : j'en ai lu une vingtaine intégralement ou en tête, et j'ai systématiquement recoupé leurs effets contre l'état réel de la base plutôt que contre leur texte. Les 90 migrations appliquées en production qui ne sont pas dans ce dépôt (215 appliquées contre 125 fichiers) proviennent du site oxvehicle.fr et me sont donc invisibles ; le schéma que je décris est celui que la base rapporte, pas celui que le dépôt raconte.

Je n'ai pas lu les 322 politiques RLS une par une : j'en ai extrait et lu le texte exact pour dix tables représentatives (`users`, `telemetry_sessions`, `telemetry_frames`, `app_session_analyses`, `biometry_raw`, `admin_audit`, `documents`, `coach_profiles`, `coach_annotations`, `coach_messages`, `session_intentions`, `pilot_waiver_signatures`, `incident_reports`, `app_config`) et je n'ai compté que le nombre de politiques pour les autres. Je n'ai lu aucune des 39 politiques de `storage.objects` dans leur texte en base — ce que j'en dis vient de la migration `20260719124000_sec1_e_storage.sql` et de son annexe de rollback.

Je n'ai pas vérifié si les secrets `TEST_SUPABASE_*` de la CI RLS ont été posés dans GitHub : je n'ai pas d'accès aux secrets du dépôt, et le document `17_CI_RLS_SETUP.md` les présentait comme une action fondateur restant à faire au 19 juillet. Je ne sais donc pas si les 85 tests RLS tournent aujourd'hui.

Je n'ai pas exécuté la suite de tests. Le chiffre de 1 846 tests verts m'a été donné dans le cadrage ; je ne l'ai pas reproduit.

Je n'ai pas vérifié la présence effective des secrets côté fonctions edge (`EDGE_FUNCTIONS_INVOKE_SECRET`, `CRON_TOKEN`, etc.) — ce n'est pas lisible en lecture seule, comme le note déjà le registre des edges. Les gardes « fail-open » qu'il signale restent donc de gravité indéterminée. Je n'ai pas non plus appelé `list_edge_functions` : ce que je dis des versions déployées vient de `SEC1_PROD_APPLY.md`, pas d'une interrogation directe.

Je n'ai pas lu les fichiers `05_DECHARGE_RESPONSABILITE.md`, `06_PACTE_DE_COACHING.md`, `03_CGV_PRESTATIONS_OXV.md` ni `02_CGU_APP_OXV_MIRROR.md`. Mes constats juridiques ne portent que sur la politique de confidentialité et le document de consentement biométrique.

Enfin, je n'ai fait **aucune écriture** en base : toutes mes requêtes sont des lectures (`select`, `pg_get_functiondef`, catalogues système). Les volumes que je cite sont ceux du 26 juillet 2026.

---

## Affichage, design system et accessibilité

### Deux systèmes visuels coexistent, avec une frontière nette

L'application ne possède pas un design system mais deux, et ils ne se mélangent pas. La séparation est vérifiable ligne à ligne : sur les 38 fichiers de l'espace pilote V2 (`app/(app2)/`), **38 importent `@/ui/v2` et zéro importe `@/theme/v2`**. Inversement, les six autres espaces — `app/(app)` (80 écrans), `app/(coach)` (36), `app/(admin)` (29), `app/(partner)` (8), `app/(pro)` (7), `app/(auth)` (2), auxquels s'ajoutent `app/(onboarding)` (6) et `app/(coach-onboarding)` (3), que le repérage initial ne mentionnait pas — importent **tous** `@/theme/v2` et **aucun** n'importe `@/ui/v2`. La seule exception dans tout le dépôt est `app/(coach)/debrief.tsx`, qui emprunte un composant unique au kit V2 (`BiometryStrip`, la bande cardio) parce qu'il n'en existe pas d'équivalent dans l'ancien langage.

Deux points de contexte importants pour lire ce qui suit. D'abord, l'espace V2 n'est pas visible en production : `app/(app2)/_layout.tsx` commence par `if (!__DEV__) { return <Redirect href="/" />; }`, avec le commentaire « garde de build à retirer au lot L6 ». Le nouveau langage visuel est donc entièrement construit mais entièrement invisible aux pilotes tant que le lot L6 n'a pas basculé. Ensuite, le layout racine `app/_layout.tsx` peint le fond de toute l'application avec `theme.palette.night` (`#0B0B0D`, la couleur de l'ancien système), alors que les écrans V2 posent le leur en `#14151A` : les deux fonds diffèrent, mais chaque écran V2 pose le sien par-dessus, donc l'écart ne se voit pas — il n'apparaîtrait que sur un écran V2 qui oublierait son fond.

L'application est en thème **sombre unique**. `app.json` déclare `userInterfaceStyle: "dark"`, `orientation: "portrait"`, splash et icône adaptative sur `#050505`, `supportsTablet: false` côté iOS. Le layout racine force `<StatusBar style="light" />`. Il n'existe aucun mode clair, aucun basculement, nulle part.

---

### Le système pilote V2 — « DA Instrument » (`src/ui/v2/tokens.ts`)

Le fichier fait 78 lignes et s'ouvre sur six règles d'usage présentées comme non négociables : un seul accent rouge par zone d'écran, l'or Heritage réservé au tier Heritage, les couleurs QDI réservées aux données (jamais un fond, jamais du chrome), un seul cadran par écran et jamais décoratif, les « glow » réservés aux ombres portées de traits Skia, et le `scrim` réservé aux photos comme seule exception autorisée à la règle anti-dégradé.

#### Palette

| Rôle | Jeton | Valeur | Emploi constaté dans le code |
|---|---|---|---|
| Fond d'écran | `bg.base` | `#14151A` | fond de tous les écrans (app2) |
| Carte | `bg.card` | `#1B1D24` | cartes, bandeaux, feuille du `Sheet` |
| Carte imbriquée | `bg.card2` | `#232630` | pastilles actives, pistes de barres, vignettes de repli |
| Voile photo | `bg.scrim` | `rgba(10,11,14,0.72)` | dégradé de lisibilité sous texte sur photo (`HeroPhoto`) |
| Filet de carte | `border.card` | `#2A2D38` | bordures de cartes, piste du cadran, grille du radar |
| Filet appuyé | `border.strong` | `#3A3E4C` | graduations du cadran, poignée du sheet, pills |
| Filet cheveu | `border.hairline` | `#22242C` | séparateurs de liste, haut de la barre d'onglets |
| Accent | `accent` | `#C8102E` | rouge de marque : arc du cadran, cercle REC, millièmes du chrono |
| Lumière d'accent | `accentGlow` | `rgba(200,16,46,0.35)` | flou sous un trait Skia uniquement |
| Texte 1 | `text.hi` | `#E8E9ED` | titres, valeurs, chrono |
| Texte 2 | `text.mid` | `#A9ADBB` | corps secondaire, icônes de ligne |
| Texte 3 | `text.low` | `#9195A3` | sur-titres, sous-labels, unités, « — » d'absence |
| Texte 4 | `text.dim` | `#787C8A` | inactifs, placeholders de saisie, illustration d'état vide |
| Or Heritage | `heritage.gold` | `#C4A459` | trait de la bande Heritage, annotation coach, record |
| Texte Heritage | `heritage.text` | `#E8DCB8` | libellé de la bande Heritage |
| Lumière Heritage | `heritage.glow` | `rgba(196,164,89,0.30)` | ombre du trait doré, halo du chrono record |

Les cinq couleurs QDI sont dans un bloc à part, `colors.qdi` : trajectoire `#60A5FA` (bleu), fluidité `#FFB703` (ambre), freinage `#E63946` (rouge de donnée), accélération `#4ADE80` (vert), régularité `#C084FC` (violet). L'ordre canonique des branches est verrouillé dans `src/ui/v2/vizMath.ts` par un `satisfies readonly (keyof typeof colors.qdi)[]` — le type ne peut pas dériver des jetons sans casser la compilation — et un test le vérifie.

#### Typographie

Le jeton `type` (exporté sous l'alias `typo` par le barrel `src/ui/v2/index.ts`) déclare six familles : `display: 'Michroma_400Regular'`, `body: 'Inter_400Regular'`, `bodyMedium: 'Inter_500Medium'`, `bodySemi: 'Inter_600SemiBold'`, `mono: 'JetBrainsMono_500Medium'`, `monoSemi: 'JetBrainsMono_600SemiBold'`.

La répartition est nette dans le code : Michroma ne sert que de display, avec 60 occurrences de `typo.display` dans les écrans (app2) et le kit — titres de section, nom du pilote, libellé de la bande Heritage à 10 px avec 3 px d'interlettrage. Inter porte tout le texte courant. JetBrains Mono porte tout ce qui est chiffre ou étiquette d'instrument, systématiquement avec `fontVariant: ['tabular-nums']` pour que les colonnes ne dansent pas (`StatCell`, `ListRow`, `SessionCard`, `ChronoHero`, `RollingCounter`, `RecordFlash`).

Il n'y a pas d'échelle de tailles centralisée dans les jetons V2 : chaque composant fixe sa taille en dur (11 px pour les eyebrows, 13 pour les labels de barre, 15 pour les libellés de ligne, 17 pour les titres de section, 22 pour les valeurs de `StatCell`, et 22/34/56 pour les trois tailles du `ChronoHero` via `CHRONO_HERO_FONT_SIZES` dans `uiLogic.ts`). C'est un écart assumé avec l'ancien système, qui, lui, possède un objet `fontSize`.

#### Espacements, rayons, mouvement

L'échelle d'espacement est `space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 36 }`. Les rayons sont `radius = { card: 18, cell: 12, hero: 24, pill: 999 }` — la carte à 18, la cellule à 12, le grand cadre (photo héros, haut du bottom-sheet) à 24, et la pilule circulaire. Les durées et ressorts sont `motion = { door: 260, stagger: 45, radar: 600, pulse: 1200, needle: 800, spring: { damping: 18, stiffness: 180 }, springSoft: { damping: 22, stiffness: 120 } }`.

---

### Le système précédent — coach, admin, partenaire, pro, pilote V1 (`src/theme/v2.ts`)

Ce fichier de 166 lignes s'annonce en tête comme la « charte OXV — REFONTE V3 (2026-07-10) ». Il est structuré différemment : une `palette` de 25 entrées, un bloc `dataColors` séparé pour les cinq piliers, une rampe `speedHeat`, un bloc `roleColors`, un objet `fonts` de 13 entrées, une échelle `fontSize` de 10 paliers, `spacing`, `radius`, `motion`, `easing`, `hitSlop`, puis un bloc additif `lotProfilTokens` réservé aux écrans Profil et Panel de cartes.

| Rôle | Jeton | Valeur |
|---|---|---|
| Fond | `night` | `#0B0B0D` |
| Surfaces | `card` / `card2` / `surface3` | `#111113` / `#141416` / `#16161A` |
| Textes (fort → faible) | `cream` / `creamSoft` / `secondary` / `creamMute` / `legend` / `eyebrow` / `faint` | `#F5F5F7` / `#E5E5E8` / `#C9C9CE` / `#9A9AA3` / `#8A8A92` / `#898991` / `#797981` |
| Filets | `line` / `cardBorderProminent` / `separator` / `borderHair` | `#1E1E22` / `#232326` / `#17171A` / `#1A1A1D` |
| Or chrono | `gold` | `#FFB703` |
| Or Heritage | `heritageGold` | `#C4A459` |
| Rouge de marque | `red` | `#C8102E` |
| Accents coach | `coachAccent` / `coachAlert` | `#E23A4E` / `#E2685A` |
| Vert | `green` | `#4FC98A` |

Les couleurs de donnée y sont différentes de celles du kit V2 : trajectoire `#4F9DF7`, freinage `#F65B5B`, accélération `#4FC98A`, fluidité `#F2CE3B`, régularité `#A783F2`. Il existe en plus une rampe de chaleur vitesse `speedHeat = ['#4F9DF7', '#3FD0D8', '#4FC98A', '#F2CE3B']`, présentée en commentaire comme la source unique partagée par la carte, la heatmap et leurs légendes « pour qu'elles ne divergent jamais », et volontairement sans or ni rouge. Enfin, `roleColors` attribue une couleur d'identité par rôle : pilote blanc `#F5F5F7`, coach rouge de marque `#C8102E`, partenaire bleu `#5B8DEF`, admin cyan `#22D3EE`.

Les échelles diffèrent aussi : `spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 }`, `radius = { hud: 6, sm: 10, md: 12, lg: 14, xl: 18, pill: 999 }` — le rayon `hud: 6` est décrit comme « l'angle d'instrument des panneaux cockpit », plus sec que la carte web arrondie — et `motion = { fast: 160, base: 240, slow: 420, reveal: 640 }` avec une courbe `easing = [0.22, 1, 0.36, 1]`.

Les composants de ce système vivent dans `src/ui/` (18 fichiers : `Screen`, `AppBar`, `Button`, `Card`, `Chip`, `Field`, `Fact`, `KpiCard`, `Segmented`, `SectionLabel`, `StatusPill`, `RoleBadge`, `AccountButton`, `DoctrineFooter`, `Cockpit`, `CockpitPanel`, `KingNumber`, `QdiBars`, `StateWrapper`) et dans `src/components/` (une trentaine, dont les barres de navigation `AppTabBar`, `CoachTabBar`, `ProTabBar`, `CoachRail`, les instruments `GaugeInstrument`, `MeterBar`, `ABTrace`, `EmptyState`, `CoachBand`, et les visualisations `QdiRadar`, `MiniQdiRadar`, `GForceBars`, `LapTimeline`, `LapScrubber`, `CircuitMap`).

Deux pièces méritent d'être signalées parce qu'elles se comportent à part. `KingNumber` porte la règle « un seul chiffre par écran » : grand chiffre JetBrains Mono, tabular-nums, interlettrage serré, couleur héritée de la donnée qu'il représente, sans halo. Et `src/components/DebriefMirror.tsx` est un composant « vendored » qui déclare sa propre table de couleurs et ses propres polices en dur — c'est le **seul endroit du dépôt qui utilise encore Geist** (`Geist_600SemiBold` / `Geist_400Regular`).

Enfin, la console coach est **adaptative en deux formats** (`app/(coach)/_layout.tsx`) : au-delà de `COACH_CONSOLE_MIN_WIDTH` la navigation passe par un rail vertical gauche de 198 px (`CoachRail`, item actif en `#E23A4E`), en dessous elle reste une barre d'onglets bas (`CoachTabBar`, actif `#E2685A`). Dans les deux cas la pile de navigation est identique.

---

### La loi couleur du dépôt

La loi est écrite à trois endroits : en tête de `src/ui/v2/tokens.ts`, dans les commentaires de `src/theme/v2.ts`, et dans un document normatif `docs/refonte-app/REGLES_COULEUR.md`. Elle se résume à quatre interdits.

**L'or ne colore que de la donnée.** Dans l'ancien système, deux ors coexistent et ne se confondent pas : `gold #FFB703` est réservé au chrono, au record et au rythme (« jamais une donnée QDI »), et `heritageGold #C4A459` à l'offre Heritage. Dans le kit V2, il n'existe **qu'un seul or**, `heritage.gold #C4A459`. Son emploi réel, vérifié par recherche exhaustive, dépasse légèrement l'énoncé « tier Heritage exclusivement » du commentaire d'en-tête : on le trouve sur la bande Heritage (`HeritageBand`), sur la bande et les puces d'annotation coach (`TraceCircuit`, `bilanLogic.ts` ligne 277), sur le moment-clé « référence » (`bilanLogic.ts` ligne 164, dont le commentaire dit « l'or ne marque QUE le chrono/record »), sur la célébration de record (`RecordFlash`), et sur les circuits certifiés de l'écran Territoire. C'est cohérent avec l'esprit de la règle (chrono, record, Heritage, main du coach) mais plus large que sa lettre.

**Le rouge de marque `#C8102E` ne colore que la marque et l'enregistrement.** Dans le kit V2 il s'appelle `accent` et sert à l'arc du cadran, au cercle plein du bouton REC, au bord du bouton central, et aux millièmes du chrono. La règle « un seul accent rouge par zone d'écran » est posée en tête des jetons mais n'est vérifiée par aucun test automatique — c'est une discipline de relecture.

**Le freinage a son propre rouge**, `#E63946` dans le kit V2 et `#F65B5B` dans l'ancien, distinct du rouge de marque. La note de `REGLES_COULEUR.md` explicite pourquoi : convention télémétrique (freinage rouge, accélération verte), et surtout « la marge serrée reste en ambre, jamais en rouge » — l'app ne peint jamais un verdict de performance en rouge.

**Une couleur QDI = une donnée, partout.** Le commentaire de `dataColors` le dit ainsi : « chaque branche a une couleur FIXE, utilisée PARTOUT où sa donnée apparaît (radar, barres, points sur la piste, chips, annotations) ». Dans `RadarQdi`, cette règle est appliquée avec une rigueur visible : la grille, les axes et le polygone sont en jetons neutres (`border.card`, `border.hairline`, `text.hi`), et la couleur QDI ne vit que sur les cinq sommets — les points de mesure.

Trois observations factuelles sur l'état de cette loi.

D'abord, **le document normatif a divergé du code**. `docs/refonte-app/REGLES_COULEUR.md` s'ouvre sur « Référence normative. Valeurs = `src/theme/v2.ts` », mais son dernier commit date du 05/07/2026 alors que `src/theme/v2.ts` a été modifié le 25/07/2026. Les valeurs ne correspondent plus : le document annonce `night #050505` (le code dit `#0B0B0D`), `cream #F8F9FA` (le code dit `#F5F5F7`), `faint #54545C` (le code dit `#797981`), et surtout il donne la trajectoire en ambre `#F2792B` alors que le code la donne en bleu `#4F9DF7`, en précisant que « le bleu n'est plus un pilier » — ce qui est l'inverse de ce que fait le code aujourd'hui. Quiconque lit ce document comme une référence prendra de mauvaises valeurs.

Ensuite, **le même hexadécimal ne veut pas dire la même chose des deux côtés de la frontière**. `#FFB703` est le chrono/record dans l'espace coach et la **fluidité** dans l'espace pilote V2. Tant que les deux espaces ne se croisent pas à l'écran, l'ambiguïté est théorique ; elle deviendra réelle au moment de la bascule L6 si les deux palettes doivent cohabiter.

Enfin, **les barres de navigation codent leurs couleurs en dur, hors des jetons, volontairement**. `src/components/AppTabBar.tsx` (pilote V1) l'assume en commentaire : « couleurs nav codées en dur ici pour rester indépendantes du thème — la nav ne porte jamais d'or ». Il en va de même pour `CoachTabBar` et `ProTabBar`. Conséquence mesurable : lors du relèvement de contraste du 25/07, `CoachTabBar` a été rattrapée (son onglet inactif suit désormais le jeton `faint`) mais `AppTabBar` **ne l'a pas été** — son onglet inactif reste sur la valeur figée `#54545C`.

Côté rigueur d'application, le kit V2 est propre : **zéro couleur hexadécimale en dur dans `src/ui/v2/`** en dehors de `tokens.ts`. Dans les 38 fichiers de `app/(app2)`, on ne compte que **9 hexadécimaux en dur**, tous documentés et justifiés : sept fonds blancs `#FFFFFF` sous des QR codes (le commentaire dit « fond clair NÉCESSAIRE à la lecture optique du QR — pas un décor, un code ») et un noir pur `#000000` pour le fond de la visionneuse photo plein écran.

---

### Les composants du kit V2 (`src/ui/v2/`)

Le barrel `src/ui/v2/index.ts` expose dix-huit composants, cinq modules de logique pure et deux hooks. Voici ce que chacun fait, tel que vérifié dans son fichier.

| Composant | Fichier | Rôle |
|---|---|---|
| `StateView` | `StateView.tsx` | les quatre états non nominaux de toute section : chargement (squelettes `Shimmer` aux formes réelles, jamais un spinner), vide (illustration SVG d'un tracé de circuit qui se dessine en boucle de 8 s), erreur (icône + message + bouton Réessayer), hors ligne (bandeau sobre, le dernier contenu connu reste affiché dessous) |
| `SectionHeader` | `SectionHeader.tsx` | tête de section : sur-titre mono capitales, titre optionnel, compteur en pilule. Porte `accessibilityRole="header"` |
| `Chip` | `Chip.tsx` | filtre ou catégorie en pilule ; actif = fond `bg.card2` + bord appuyé |
| `ListRow` | `ListRow.tsx` | la ligne de liste universelle : icône, libellé, sous-libellé, valeur ou slot libre à droite, chevron si navigable, séparateur cheveu |
| `StatCell` | `StatCell.tsx` | cellule de statistique : eyebrow mono capitales + valeur mono tabulaire |
| `SessionCard` | `SessionCard.tsx` | carte de séance : vignette 56 px (blurhash, repli sur une tuile icône — jamais d'image stock), circuit, date, chrono au millième |
| `ChronoHero` | `ChronoHero.tsx` | le chiffre roi chrono, trois tailles (22/34/56 px), permutation vers `RecordFlash` en cas de record sans saut de mise en page |
| `RadarQdi` | `RadarQdi.tsx` | le radar 5 axes, rendu Skia, tracé progressif puis sommets qui claquent en cascade. Une branche absente est **masquée** (ni axe, ni point, ni label) |
| `PillarBar` | `PillarBar.tsx` | barre de pilier, remplissage animé au premier viewport, valeur mono à droite ; absence → « — » et barre vide |
| `TraceCircuit` | `TraceCircuit.tsx` | le tracé du circuit en Skia, trait de fond + trait lumineux qui se dessine, puces d'événements, bande d'annotation coach au bord or |
| `BiometryStrip` | `BiometryStrip.tsx` | sparkline cardio dont le dernier point pulse au rythme réel de la série (période = 60/bpm), badge source et confiance |
| `HeritageBand` | `HeritageBand.tsx` | la bande du tier Heritage : libellé capitales + un trait or dont la lumière est l'ombre du trait |
| `SpringDot` | `SpringDot.tsx` | fragment Skia : la puce qui claque (rayon 0 → r en ressort), utilisée par le radar et le tracé |
| `Dial` | `Dial.tsx` | le cadran instrument : course de 270°, aiguille en ressort pour l'instantané, arc Skia pour le cumul, valeur centrale en compteur roulant |
| `CentralButton` | `CentralButton.tsx` | le bouton central de la barre, trois états (réserve, compte à rebours, REC), flottant de −8 px |
| `Sheet` | `Sheet.tsx` | le bottom-sheet, écrit en Reanimated pur (le commentaire précise que `@gorhom/bottom-sheet` est absent du dépôt) |
| `TabBar` | `TabBar.tsx` | la barre des quatre portes (miroir, data, club, vous) plus le bouton central |
| `Photo` / `HeroPhoto` | `media/` | wrappers `expo-image` avec blurhash titane maison et parallaxe optionnelle |

Cinq modules `.ts` purs portent toute la logique testable sans rendu : `uiLogic.ts` (conversion millisecondes → « 1:41.203 », formes de squelettes, géométrie de l'illustration d'état vide dont la longueur du tracé est **calculée et non estimée**), `vizMath.ts` (géométrie du radar, échantillonnage des sparklines, projection des centerlines), `shellLogic.ts` (géométrie du cadran, décisions de fermeture du sheet, table des portes), `centralButtonLogic.ts`, `motionMath.ts`. Ce découpage est ce qui permet de tester le design system sans simulateur.

L'iconographie est intégralement maison : `icons/registry.ts` contient **20 icônes** dessinées à la main sur une grille 24×24, sous forme de listes d'attributs `d` uniquement — aucune couleur, aucun style dans le registre. Le composant `OxvIcon` applique le trait (1,5 px, terminaisons rondes) et la couleur. Une seule icône est pleine, `rec`. Un test (`iconRegistry.test.ts`) vérifie les 20 noms, la non-vacuité des chemins, l'absence de couleur dans le registre, la validité géométrique sur la grille 0–24 et le fait que `rec` soit la seule pleine.

Un motif se répète dans tout le kit et mérite d'être nommé, parce qu'il est visible à l'écran : **l'absence ne devient jamais un zéro**. `Dial` accepte `value: number | null` et affiche « — » avec l'aiguille au repos ; `PillarBar` affiche « — » et une barre vide ; `RadarQdi` masque la branche non mesurée ; `StatCell` annonce « non mesuré » aux lecteurs d'écran. Le commentaire de `Dial` le formule : « une valeur absente ne devient JAMAIS un zéro d'apparence mesurée ».

---

### Le mouvement

Onze primitives vivent dans `src/ui/v2/motion/`, plus la logique pure `motionMath.ts`.

| Primitive | Ce qu'elle fait |
|---|---|
| `useDoorTransition` | l'entrée d'écran, dite « la porte » : fondu + translation de 12 px sur 260 ms. Utilisée dans **37 des 38 fichiers** de `app/(app2)` |
| `Stagger` / `staggerEntering(i)` | entrée en cascade des enfants (45 ms de pas), avec un délai plafonné pour les longues listes |
| `useCondensingHeader` | le grand titre s'efface au-delà de 64 px de défilement et une barre condensée prend le relais |
| `HeroMorph` | la carte tapée « voyage » vers l'écran de détail : la géométrie est capturée avant navigation, périmée au bout de 2 s, et tout chemin dégradé retombe sur la porte |
| `PullToRefreshDial` | tirer la liste fait tourner une aiguille de cadran ; geste `Pan` à activation manuelle, avec la justification écrite du choix (RefreshControl n'est pas stylisable, l'overscroll n'existe pas sur Android) |
| `RollingCounter` | chiffres d'odomètre qui roulent, séparateurs statiques, millièmes en couleur accent |
| `Shimmer` | squelette de chargement balayé par une lumière froide ; remplace tout spinner |
| `RecordFlash` | célébration de record : 900 ms, deux pulses blanc → or, halo bref, un haptic. « Pas de confetti, jamais » |
| `NeedleSweep` | l'aiguille rejoint son angle en ressort, avec l'overshoot mécanique |
| `PressScale` | le wrapper Pressable universel : contraction à 0,97 à l'appui, retour en ressort |
| `GlowStroke` | fragment Skia à deux passes : le trait flouté dessous, le trait net dessus |

Trois technologies de rendu se partagent le travail, et la ligne de partage est claire. **Reanimated 3.10.1** porte toutes les animations, toujours sur le thread UI. **Skia 1.2.3** ne sert qu'aux surfaces où le trait doit être lumineux ou trimé : dans le kit V2 il n'est employé que par `Dial`, `RadarQdi`, `TraceCircuit`, `BiometryStrip`, `SpringDot`, `HeritageBand` et `GlowStroke` ; côté ancien système il n'y a que `DataLabCanvas` et `PerfChart`, tous deux marqués « BUILD-PENDING » et chargés derrière un `require()` gardé dans `app/(app)/data-lab-canvas.tsx` parce que Skia est un module natif qui ne tourne pas sous Expo Go. **react-native-svg** fait tout le reste et reste de loin le plus répandu : 79 fichiers l'importent, dont toute l'iconographie, les radars de l'ancien système et les cartes de circuit.

Le vocabulaire tactile est fermé : `src/ui/v2/haptics.ts` expose un seul point d'entrée `haptic(kind)` avec cinq gestes (`tap` = sélection, `arm` = impact lourd pour armer la capture, `record` = notification de succès, `doorSnap` = impact léger, `warn` = notification d'avertissement). Deux coupe-circuits sont câblés : `isSilenced()` (silence en piste, Principe 3 — aucune vibration pendant que le véhicule roule) et `isExpoGo()`.

Le réglage « animations réduites » est **entièrement piloté par le système d'exploitation ; il n'existe aucun réglage interne à l'application** — j'ai lu `app/(app2)/vous/reglages.tsx`, qui compte quatre groupes de réglages (notifications, IA, partage coach, cardio, données) et aucune entrée relative aux animations. Deux implémentations coexistent : `src/components/motion/useReduceMotion.ts` (ancien, asynchrone, via `AccessibilityInfo.isReduceMotionEnabled()`, avec écoute des changements) et `src/ui/v2/motion/useReduceMotion.ts` (kit V2, **synchrone**, via `useReducedMotion()` de Reanimated). Le commentaire du second explique le remplacement : l'ancien répond `false` pendant les premières frames, donc toute l'entrée d'un écran jouait avant de claquer à l'état final, ce qui ne tient pas WCAG 2.3.3 au premier rendu. Le prix est documenté : la version Reanimated ne réagit pas à un changement de réglage en cours de session.

Le respect du réglage est réel et systématique dans le kit V2 : `Dial` place l'arc directement, `RadarQdi` rend l'état final sans claquement ni haptic, `CentralButton` fige son point, `StateView` rend l'illustration complète sans boucle, `Sheet` apparaît et disparaît sans animation mais **conserve le geste** (manipulation directe, pas décoration), `PressScale` supprime l'échelle mais **garde l'haptic** (retour utile). 24 fichiers de `app/(app2)` consomment `useReduceMotion` directement, en plus de ce que le kit gère seul.

---

### L'accessibilité : l'état après la passe du 25/07

Deux commits du 25/07/2026 constituent la passe.

**`5685704` — passe accessibilité des écrans pilote (app2) + direct coach.** 37 fichiers modifiés, +918 / −161 lignes. Le message de commit indique un audit neuf d'environ 40 écrans, 81 constats relevés, « l'essentiel appliqué » — la formulation implique donc explicitement qu'une partie ne l'a pas été, et je n'ai trouvé **aucun rapport détaillant les constats restants** sur disque (le commit note lui-même que le rapport précédent des 47 constats « n'existait plus sur disque »). Le périmètre est strictement `app/(app2)/*`, plus `app/(coach)/en-direct.tsx` et `app/(coach)/en-direct/[sessionId].tsx`, plus quatre fichiers du kit corrigés à la source : `ListRow`, `StatCell`, `Chip`, `PressScale`. Les espaces `(app)`, `(admin)`, `(partner)`, `(pro)`, `(auth)` et les deux onboarding **n'ont pas été touchés par cette passe**.

Le travail effectué, tel que lisible dans le code : regroupement des données lues en miettes (`ListRow` compose désormais son libellé par défaut à partir de ce que la ligne montre réellement — label, sous-label, valeur — parce que `PressScale` aplatit ses enfants et que le sous-label restait muet) ; états annoncés (`Chip` expose `selected`, et devient un simple `text` sans rôle bouton quand elle n'a pas d'`onPress`, parce qu'« annoncer bouton sur un élément inerte est un mensonge d'interface ») ; décor Skia masqué (`Shimmer` et l'illustration d'état vide portent `accessibilityElementsHidden` et `importantForAccessibility="no-hide-descendants"`) ; titres de section ; cibles tactiles élargies.

Le message de commit consigne aussi que **la vérification a attrapé deux régressions tactiles introduites par la passe elle-même**, toutes deux dues au même piège d'API (`PressScale` pose le `style` reçu sur sa vue interne, pas sur le `Pressable` externe qui porte le `hitSlop`, donc les marges vivent à l'intérieur de la cible et un hitSlop symétrique fait se recouvrir des zones voisines). La plus grave : sur l'écran de consentement biométrique, « Refuser » mordait sur les derniers pixels d'« Accorder », de sorte qu'appuyer sur le bas d'« Accorder » révoquait le consentement. C'est corrigé, et la répartition des styles est désormais documentée dans le contrat d'API de `PressScale` (`containerStyle` = layout sur le Pressable externe, `style` = visuel sur la vue animée interne).

**`0222d94` — relèvement des gris faibles.** Quatre valeurs de jeton ont bougé, mesurées avant modification sur le pire fond de chaque palette :

| Palette | Jeton | Avant | Après | Contraste avant → après |
|---|---|---|---|---|
| Pilote (app2) | `text.low` | `#7A7E8C` | `#9195A3` | 3,73 → 5,05 |
| Pilote (app2) | `text.dim` | `#5A5E6C` | `#787C8A` | 2,34 → 3,63 |
| Coach | `eyebrow` | `#6E6E76` | `#898991` | 3,10 → 4,52 |
| Coach | `faint` | `#55555C` | `#797981` | 2,12 → 3,63 |

La teinte a été conservée, seule la luminance a été relevée (le commentaire précise les relations maintenues : `R = G−4, B = G+14` côté pilote, `R = G, B = G+8` côté coach). `dim` reste assumé sous 4,5 avec une justification explicite : le porter plus haut le collerait à `low` et effacerait le palier — « quatre gris lisibles mais indistinguables ne hiérarchisent plus rien ». Ce jeton porte 61 usages dans (app2) et sert notamment de `placeholderTextColor` sur quatre écrans de saisie.

#### Ce qui est verrouillé par un test

Le verrou est `src/theme/__tests__/contrastTokens.test.ts` (119 lignes, **8 tests**, tous verts). Il recalcule la luminance relative WCAG 2.1 et le rapport de contraste, puis vérifie, pour chaque palette, le pire contraste de chaque gris sur **l'ensemble des fonds où il peut se poser** : `bg.base`, `bg.card` et `bg.card2` côté pilote ; `night`, `card`, `card2`, `surface3` et `cardBorderProminent` côté coach.

Il impose quatre choses par palette : que les gris forts tiennent le seuil texte AA de 4,5 ; que `low` (pilote) et `eyebrow` (coach) tiennent aussi 4,5 parce qu'ils portent du texte réel ; que `dim` et `faint` tiennent au moins le seuil 3,0 des grands textes et éléments d'interface ; et — c'est l'idée la moins évidente et la plus utile — que **la hiérarchie reste strictement décroissante**. Sans cet invariant, relever un gris pour l'accessibilité pourrait aplatir les paliers et faire perdre à l'écran sa lecture.

Ce que le test **ne fait pas** est écrit noir sur blanc dans son en-tête : il ne juge pas les couleurs sémantiques (or du chrono, rouge de marque, teintes QDI, Heritage), parce que « leur contraste se traite au cas par cas, à la taille et au poids réels du texte concerné » et que « les toucher ici serait déplacer un arbitrage de doctrine dans un test d'accessibilité ».

J'ai recalculé indépendamment, avec la même formule, le contraste des couleurs sémantiques sur les fonds réels. Toutes les couleurs QDI passent confortablement (de 3,62 pour le freinage `#E63946` sur `bg.card2` — le plus bas — à 8,66 pour l'accélération), l'or Heritage est à 6,33–7,64, le texte Heritage à 11–13. **Une seule couleur sémantique est basse : le rouge de marque `#C8102E`, à 3,10 sur `bg.base` et 2,57 sur `bg.card2`.** Ce n'est pas gênant là où il sert de bordure ou de fond (le bouton REC est un cercle plein, l'arc du cadran est un trait épais), mais il sert aussi de **couleur de texte** : `RollingCounter` peint les millièmes du chrono avec `colors.accent` quand `accentMillis` est actif, ce que fait `ChronoHero` par défaut. Les trois derniers chiffres du chrono héros sont donc à environ 3,1:1. C'est un fait, pas un verdict : la taille (34 à 56 px) place ce texte dans la catégorie « grand texte », dont le seuil AA est 3,0.

Deux copies figées de l'ancien gris ont été rattrapées lors de ce commit (`CoachTabBar`, et une assertion de test qui pointait un hexadécimal au lieu d'un jeton). **`AppTabBar` n'a pas été rattrapée** : son onglet inactif reste sur `#54545C` codé en dur, que je mesure à **2,43–2,72 selon le fond** — donc sous le seuil 3,0, et hors de portée du test puisque ce n'est pas un jeton.

#### Les autres garde-fous en place

Un scanner statique, `scripts/check-accessibility.ts`, signale tout `<Pressable>` ayant un `onPress` mais pas d'`accessibilityRole`, avec une échappatoire annotée `// accessibility: not-applicable`. Je l'ai exécuté : **222 fichiers `.tsx` scannés dans `app/`, zéro manquement**. Il tourne en CI en mode `--strict` (`.github/workflows/check.yml`), c'est-à-dire bloquant, aux côtés du typecheck, d'ESLint, de Prettier, de la suite Jest complète et du scanner doctrinal des verbes interdits. Il faut connaître ses limites : il ne regarde que la balise `<Pressable>` littérale, donc il ne voit pas les composants dérivés — mais dans ce dépôt cela suffit, puisque `PressScale` pose lui-même `accessibilityRole="button"` par défaut, et qu'il y a **zéro `TouchableOpacity` dans tout `app/`** contre 298 `<Pressable>`.

Le dénombrement des attributs d'accessibilité par espace donne l'image suivante (à lire avec précaution : le kit V2 porte les rôles à la source, donc les écrans (app2) en déclarent moins sans être moins couverts) :

| Espace | Fichiers | `accessibilityLabel` | `accessibilityRole` | `accessibilityState` | `role="header"` |
|---|---|---|---|---|---|
| `(app2)` | 38 | 233 | 65 | 18 | 45 |
| `(app)` | 83 | 238 | 242 | 44 | 58 |
| `(coach)` | 37 | 131 | 161 | 33 | 60 |
| `(admin)` | 30 | 49 | 68 | 18 | 25 |
| `(partner)` | 9 | 17 | 19 | 4 | 12 |
| `(pro)` | 8 | 23 | 16 | 5 | 7 |
| `(auth)` | 3 | 2 | 2 | 0 | 0 |

Le masquage du décor est en place partout : 10 `accessibilityElementsHidden` dans (app2), 55 dans (app), 36 dans (coach). Les APIs plus fines sont employées là où il faut : `accessibilityViewIsModal` et `onAccessibilityEscape` sur le `Sheet` (avec une poignée fermante pressable, parce que le backdrop est inatteignable derrière une vue modale et que VoiceOver doit trouver une sortie **dans** la feuille), `accessibilityActions` sur `PullToRefreshDial` (le chemin non gestuel d'une action qui n'existe qu'au geste) et sur le scrubber de `replay.tsx`, `accessibilityLiveRegion` sur une dizaine de messages d'erreur.

Le redimensionnement du texte système est respecté par défaut : **`allowFontScaling={false}` n'apparaît que 7 fois dans tout le dépôt**, exclusivement là où la géométrie casserait — la valeur centrale et le libellé du `Dial`, les cellules du `RollingCounter`, le `RecordFlash`, le libellé du bouton central, et le `KingNumber` de l'ancien système. Tout le reste du texte grossit avec le réglage système.

#### Ce qui reste ouvert, factuellement

Les cinq espaces non pilotes (`(app)`, `(admin)`, `(partner)`, `(pro)`, `(auth)`) et les deux onboarding n'ont pas reçu de passe d'accessibilité depuis les commits « polish » de juin 2026 ; la passe du 25/07 ne les a pas couverts. L'onglet inactif de `AppTabBar` est sous le seuil de contraste et hors du verrou de test. Les couleurs sémantiques sont, par décision explicite, hors du test — l'arbitrage de leur contraste vous revient. Enfin, la part des 81 constats du 25/07 qui n'a pas été appliquée n'est documentée nulle part que j'aie trouvé.

---

### Les polices et leur chargement

Tout passe par un point unique, `src/theme/fonts.ts`, qui expose `useAppFonts()` — un simple `useFonts()` d'`expo-font` chargeant **29 graisses issues de 9 familles** :

| Famille | Graisses chargées | Statut réel |
|---|---|---|
| Hanken Grotesk | 7 (300, 400, 400 italique, 500, 600, 700, 800) | active — texte et titres de l'ancien système |
| JetBrains Mono | 4 (400, 500, 600, 700) | active — données, chiffres, eyebrows, dans **les deux** systèmes |
| Inter | 4 (400, 400 italique, 500, 600) | active — corps du kit V2 et lot Profil |
| Syncopate | 2 (400, 700) | active — display des écrans Profil et Panel de cartes |
| Michroma | 1 (400) | active — display de tous les écrans (app2) |
| Geist | 5 (300 à 700) | **une seule utilisation vivante** : `src/components/DebriefMirror.tsx` |
| Geist Mono | 2 (400, 500) | **aucune utilisation vivante trouvée** |
| Rajdhani | 2 (500, 600) | **aucune utilisation vivante** — seule mention restante : un commentaire disant « plus de Rajdhani » |
| Instrument Serif | 2 (400, 400 italique) | **aucune utilisation vivante** |

Les cinq dernières lignes du fichier les gardent explicitement « en secours (anciens tokens éventuels non migrés) ». En pratique, **six graisses sur 29 (Geist Mono, Rajdhani, Instrument Serif) ne sont référencées nulle part** dans le code applicatif, et cinq autres (Geist) ne servent qu'à un seul composant.

Le chargement est bloquant et lié au splash : `app/_layout.tsx` appelle `SplashScreen.preventAutoHideAsync()` au module, puis `if (!fontsLoaded && !fontError) return null;` — l'application ne rend rien tant que les polices ne sont pas prêtes. Le splash n'est masqué que lorsque les polices sont chargées **et** que l'état d'authentification est résolu. Le commentaire explique l'intention : éviter un flash en police système. Notez que ce commentaire mentionne encore « avant bascule sur Geist / Geist Mono », vestige de deux refontes en arrière.

---

### Ce que je n'ai pas pu vérifier

Je n'ai **rien vu s'afficher**. Aucun simulateur, aucun appareil, aucune capture n'a été produit dans cette session : tout ce qui précède est lu dans les fichiers, calculé, ou mesuré par exécution de tests et de scanners en ligne de commande. Concrètement, je ne peux affirmer ni que le flou iOS de la barre d'onglets et du `Sheet` rend correctement, ni que le repli opaque Android est visuellement équivalent, ni que les gestes (tirer pour rafraîchir, fermeture du sheet au doigt, morphing carte → écran) se comportent comme leur code le décrit, ni que VoiceOver et TalkBack énoncent réellement les libellés que le code leur passe. Le rapport `roadmap/rapports/v2-l0.md` signale d'ailleurs le même angle mort et désigne l'écran `app/(app2)/dev-galerie.tsx` (accessible en `__DEV__` uniquement) comme la porte de validation visuelle prévue sur build de développement.

Je n'ai pas lu les 222 écrans un par un. J'ai lu intégralement les deux fichiers de jetons, les 18 composants du kit V2, ses 11 primitives de mouvement, ses modules de logique pure, le test de contraste, les deux scanners, le workflow de CI, les layouts racine, (app2) et (coach), et j'ai échantillonné l'ancien kit (`src/ui/`, en-têtes des 14 composants principaux) ainsi que quelques écrans. Les affirmations sur les espaces `(app)`, `(admin)`, `(partner)` et `(pro)` reposent donc sur des comptages automatisés et sur la lecture de leurs barres de navigation et de leurs en-têtes de composants, pas sur une revue écran par écran.

Je n'ai pas exécuté la suite Jest complète : j'ai exécuté les 8 suites couvrant `src/theme` et `src/ui/v2`, soit **153 tests, tous verts**. Le total de 1846 tests évoqué en repère n'a pas été revérifié par moi. Enfin, je n'ai pas ouvert `docs/refonte-app/DESIGN_SYSTEM.md`, `docs/refonte-app/04_DESIGN_CANON.md`, `docs/refonte-app/HANDOFF_CLAUDE_DESIGN.md` ni `docs/screens/01_DESIGN_TOKENS.md` : je les ai seulement datés par leur dernier commit (respectivement 25/06/2026 et 07/06/2026 pour les deux que j'ai datés), ce qui suffit à établir qu'ils sont antérieurs au programme V2 du 18/07 et au relèvement de contraste du 25/07, mais pas à décrire ce qu'ils contiennent.

---

## Dette, angles morts et ce qui ne marche pas

Cette section ne juge pas le code : elle constate. Chaque affirmation a été vérifiée en ouvrant le fichier cité, en exécutant la commande citée, ou en interrogeant la base de production. Ce que je n'ai pas pu vérifier est listé à la fin.

---

### 1. Les deux arbres pilote — et le fait que le neuf n'est pas celui qui tourne

C'est le point le plus lourd de l'état des lieux, et il est plus sévère qu'une simple coexistence.

**L'arbre V2 est inaccessible en production.** Le fichier `app/(app2)/_layout.tsx`, lignes 66 à 68, contient une garde de build explicite :

```tsx
if (!__DEV__) {
  return <Redirect href="/" />;
}
```

Tout le groupe `(app2)` — les 38 fichiers, soit 36 écrans de production plus le layout et la galerie de développement — redirige vers la racine dès que l'application n'est pas en mode développeur. Deep links compris. Le commentaire au-dessus le dit sans détour : « le groupe est réellement orphelin en production ». Le retrait de cette garde est le lot L6.

**Le routeur racine envoie le pilote sur la V1.** Dans `app/index.tsx`, ligne 103, la dernière instruction du routage par rôle est `return <Redirect href="/(app)" />`. Un pilote authentifié et onboardé arrive donc sur l'arbre V1, jamais sur `(app2)`.

**Aucun chemin de navigation ne relie les deux arbres.** Une recherche de la chaîne `app2` dans tout `app/(app)/` ne rend qu'une seule occurrence, et c'est un commentaire (`app/(app)/insight/[reading].tsx`, ligne 136). Le seul lien `__DEV__` posé sur l'accueil V1 (`app/(app)/index.tsx`, ligne 196) mène à `/(app)/debug-capture`, pas à la V2. Aucun fichier du dépôt ne pointe vers `/(app2)/dev-galerie` — l'écran de validation fondateur n'a pas de porte d'entrée écrite ; on n'y accède qu'en tapant l'URL à la main en développement.

**Ce que ça coûte aujourd'hui.**

| Arbre | Fichiers `.tsx` | Écrans réels | Lignes |
|---|---:|---:|---:|
| `app/(app)` — V1, celui qui tourne | 83 | 80 (+ 3 layouts) | 38 274 |
| `app/(app2)` — V2, gelée hors `__DEV__` | 38 | 36 (+ layout + galerie) | 27 666 |

Soit près de 66 000 lignes d'écrans pilote maintenues en parallèle. Le coût ne s'arrête pas au volume :

- **Les deep links de notification sont câblés sur la V1 uniquement.** Dans `app/_layout.tsx`, lignes 99 à 143, les huit branches de routage (`debrief`, `session_reminder`, `media_ready`, `coach_annotation`, `session_analyzed`, `coach_assigned`, `friend_request`, `friend_accepted`) pointent toutes vers `/(app)/…`. Une bascule L6 casserait tous les taps de notification tant que cette table n'est pas réécrite — le prompt L6 le prévoit, mais le travail n'est pas fait.
- **Deux systèmes de tokens visuels cohabitent.** `app/(app)`, `app/(coach)`, `app/(admin)`, `app/(partner)`, `app/(pro)` importent `@/theme/v2` ; `app/(app2)` importe `@/ui/v2/tokens`. Le layout racine lui-même (`app/_layout.tsx`, ligne 25) charge `@/theme/v2` — l'ancien langage est donc le langage du châssis.
- **Le kit V1 (`src/ui`, 68 fichiers) et le kit V2 (`src/ui/v2`, 48 fichiers) sont maintenus tous les deux.**

**La liste de suppression n'existe pas.** Le prompt de clôture (`design-retours/programme-v2/PROMPT_CLAUDE_CODE_LOTS_CLOTURE.md`, point 3 du lot L6) renvoie à « la liste §9 du dossier maître ». Or le §9 de `design-retours/programme-v2/OXV_APP_V2_DOSSIER_MAITRE.md` (ligne 234) s'intitule « BACKEND — RÉCAPITULATIF DES NOUVEAUTÉS » : c'est un tableau de tables et de RLS, pas une liste d'écrans à supprimer. Le §11 affirme bien qu'un mapping v1→v2 a été « contrôlé ligne à ligne » (14/14 Miroir, 12/12 Data Lab, etc.), mais ce mapping n'est pas écrit dans le dépôt sous forme de table exploitable. Le jour du L6, la liste sera à reconstituer.

**Les gates du L6 ne sont pas franchies.** Le même document les énonce : validation fondateur sur device des lots L0 à L5, smoke test terrain complet en V2, et taux de sessions sans crash ≥ 99,5 % sur deux semaines de build interne. Aucun rapport `roadmap/rapports/v2-l6.md` n'existe (`roadmap/rapports/` contient `v2-l0` à `v2-l5b`, puis `bio-2.md` et `live-b.md`).

---

### 2. Ce qui affiche encore de la matière non réelle

J'ai cherché `DemoBanner`, `DEMO_`, `isDemo`, `demoMode`. Voici ce qui reste, écran par écran.

**Dans l'arbre V1 — donc visible aujourd'hui.**

`app/(app)/insights.tsx` et `app/(app)/insight/[reading].tsx` sont les deux écrans qui portent encore de la donnée fabriquée. Le second importe `DEMO_SESSION_INSIGHTS` depuis `src/circuit/sessionInsights.ts` (ligne 33) et alimente les six visualisations avec ce jeu figé : sept virages de Haute Saintonge, `apex_speed_kmh` 95/72/130/88/65/110/78, `engine_version: 'mirror-insights-demo'`. Un bandeau `DemoBanner` est affiché en tête (ligne 66), portant le texte défini dans `src/components/insights/catalogue.ts` ligne 54 : « Démonstration — données réelles dès Valence ».

Ces écrans sont **atteignables** : `src/lib/appMap.ts` range `insights` parmi les `DATA_LAB_SCREENS` (ligne 150) et `app/(app)/data-lab.tsx` ligne 356 en fait une carte de la famille « constats », avec la promesse « Ce que la donnée raconte de votre séance ». Un pilote qui ouvre le Data Lab tombe donc dessus.

`app/(app)/debug-circuit.tsx` consomme aussi `DEMO_SESSION_INSIGHTS`, mais il est gardé par `if (!__DEV__) return <Redirect href={'/(app)'} />` (ligne 24).

**Dans l'arbre V2.**

Le travail de câblage a été fait : `app/(app2)/data/session/[id].tsx` alimente cinq des six lectures avec la vraie tranche `SessionInsights` et le vrai nuage g-g (lignes 1562 à 1578). **Une seule reste en démonstration** : `flow`. Le commentaire ligne 1556-1560 est explicite — « aucune source d'insight "fluidité" n'existe » — et le `DemoBanner` n'est monté que pour cette lecture (ligne 1623). Le composant `src/components/insights/FlowViz.tsx` contient deux polylignes en dur (lignes 33 à 37) et un nuage de 18 points figés (lignes 40 à 59), avec les chronos inventés « 1:42.8 / 1:45.1 ».

`app/(app2)/dev-galerie.tsx` porte huit constantes `DEMO_*` (photo, chrono 91 724 ms, QDI, biométrie, tracé, marqueurs) mais redirige hors `__DEV__` (ligne 579).

Hors ces cas, une recherche de `maquette`, `exemple`, `fictif`, `simulé`, `en dur` dans `app/(app2)/` ne rend que trois commentaires, tous affirmant l'inverse (« jamais un /4 codé en dur », « jamais un "12/30" codé en dur »).

**À ne pas confondre.** `src/services/eventContextLogic.ts` définit aussi un type `DemoBanner`, mais ce n'est pas de la donnée fausse : c'est un bandeau d'honnêteté affiché sur `app/(app)/bilan.tsx` quand l'`event_type` vaut `balade_decouverte`, `test_alpha`, `partenaire` ou `corporate` — pour dire que les analyses ne se comparent pas à une séance de circuit calibrée.

**Ce que dit la base de production.** J'ai interrogé le projet Supabase `fouvuqkdxarjpjbqnsjq` :

| Table | Lignes |
|---|---:|
| `telemetry_frames` | **53** |
| `telemetry_sessions` | 18 |
| `session_insights` | **1** |
| `app_session_analyses` | 13 |
| `users` | 14 |
| `events` | 1 |

Les 53 trames appartiennent toutes à **une seule** séance (`7f40d5ad-4697-44ac-861c-13b7d0cc9878`). L'unique ligne de `session_insights` porte `engine_version = 'mirror-insights-demo'`, annonce `n_frames = 11800`, et pointe vers une **autre** séance (`b62ab3af-5d6a-4e88-b316-73a0729933ae`) — celle-là même que le fixture `DEMO_SESSION_INSIGHTS` référence dans le code. Autrement dit : la seule lecture d'insights présente en production est une donnée de démonstration semée à la main, qui ne correspond à aucune trame réelle. Les commentaires du code qui disent « `telemetry_frames` est vide » sont donc justes en substance : il n'y a pas de matière télémétrique exploitable.

L'unique événement en base est la « Balade Découverte OXV — 5 juillet 2026 ».

---

### 3. Les no-op, les orphelins et les coquilles vides

**Services qui ne font rien, volontairement.**

`src/ble/flic2Service.ts` (89 lignes) porte en tête « V1 STUB intentionnel ». La méthode `scan()` (ligne 50) n'ouvre aucun scan BLE : elle logue un avertissement et pose un `setTimeout` de 1,5 s qui repasse le statut à `idle` — « simule un scan court qui ne trouve rien ». `connect()` se contente d'enregistrer l'identifiant et de passer en `connected`. Seul `simulateClick()` produit un événement. L'intégration réelle exigerait le SDK natif Flic.

`src/services/offlineQueue.ts` contient deux branches vides dans le `switch` de rejeu : `mark_notification_read` (ligne 177, « le wiring effectif viendra avec l'écran #23, sem. 10 ») et `register_lap_marker` (ligne 184, « viendra avec le bouton Flic en sem. 4 »). Une action mise en file sur ces deux types est consommée sans effet serveur.

`src/services/v2/healthKitService.ts` est câblé sur `react-native-health` mais ne fonctionnera qu'après recompilation native : `loadHealthModule()` (ligne 74) fait un `require` dynamique dans un `try/catch` et retombe sur `null`. Conséquence en cascade dans `src/features/rec/bio1Trigger.ts` ligne 123 : `readHeartRate` rend `[]`, on sort avec `reason: 'no-samples'` et on ne pose pas la garde d'idempotence. Le drapeau `biometry` est pourtant le seul actif en base ; sa description en production dit elle-même « Reste non tenu à la levée : smoke test 2 appareils réels ».

**Services sans aucun consommateur.** J'ai vérifié chacun individuellement par recherche de son nom dans `src/` et `app/`, hors tests et hors le fichier lui-même :

| Fichier | Lignes | Constat |
|---|---:|---|
| `src/services/flowService.ts` | 93 | Livré le 25/07 (lot A-FLOW-1). **Aucun écran ne l'importe.** `flowLogic.ts` ne le cite que dans un commentaire. Le calcul de jerk existe, testé, mais n'atteint aucune surface. `FlowViz` continue d'afficher ses polylignes en dur. |
| `src/services/coachConsoleService.ts` | 99 | Aucun consommateur. Il est le **seul** importateur de `src/services/coachConsoleLogic.ts` — la branche entière est morte. |
| `src/services/coachBusinessService.ts` | 44 | Aucun consommateur. `app/(coach)/business.tsx` appelle directement `listMyPilots`, `listMyRoulages`, `listMyRoulageInvitationStatuses` et `computeCoachBusinessSummary` — le service intermédiaire a été contourné. |
| `src/services/brakingPointsService.ts` | 115 | Aucun consommateur. |
| `src/services/placesService.ts` | 115 | Marqué `@deprecated` en tête (décision Gabin 2026-06) ; « suppression définitive planifiée », jamais faite. |
| `src/services/v2/videoOverlayService.ts` | 84 | Aucun consommateur. Il est le seul importateur de `videoOverlayLogic.ts`. Le drapeau `video_overlay` est OFF. |

**Composants morts.** Une passe sur les 118 fichiers `.tsx` de `src/components` et `src/ui` a isolé ceux dont le nom n'apparaît nulle part ailleurs :

| Fichier | Lignes |
|---|---:|
| `src/components/LapScrubber.tsx` | 313 |
| `src/components/signature/RadarEmpreinte.tsx` | 226 |
| `src/components/DataConfidenceBanner.tsx` | 78 |
| `src/components/OXVPromiseBlock.tsx` | 57 |
| `src/ui/KpiCard.tsx` | 46 |
| `src/ui/DoctrineFooter.tsx` | 31 |

À quoi il faut ajouter **`src/components/DebriefMirror.tsx`, 1 212 lignes** : le nom n'apparaît que dans un commentaire de `app/(app)/debrief-presentiel.tsx` (ligne 19), aucun `import` réel dans tout le dépôt. C'est le plus gros mort du dossier. Il entraîne avec lui `src/services/debriefRenderGuard.ts`, dont il est le seul importateur en dehors de son propre test.

Cela fait environ **1 960 lignes d'interface** qui ne s'affichent jamais.

**Neuf familles de polices chargées au démarrage, dont quatre inutilisées.** `src/theme/fonts.ts` charge 29 graisses via `useFonts` : Hanken Grotesk (7), JetBrains Mono (4), Syncopate (2), Inter (4), Michroma (1), puis — commentées « conservées en secours (anciens tokens éventuels non migrés) » — Geist (5), Geist Mono (2), Rajdhani (2), Instrument Serif (2). J'ai vérifié : `GeistMono_`, `Rajdhani_` et `InstrumentSerif_` n'apparaissent **nulle part** ailleurs dans `src/` ou `app/` ; `Geist_` n'apparaît que dans `src/components/DebriefMirror.tsx` lignes 54-55 — le composant mort. Ce sont donc **11 graisses chargées pour rien**, et `app/_layout.tsx` ligne 148 garde le splash affiché tant que le lot entier n'est pas résolu (`if (!fontsLoaded && !fontError) return null;`).

**Placeholders assumés.** `app/(partner)/facturation.tsx` (104 lignes) est un « placeholder honnête » déclaré en tête : il affiche « Rien à régler ici » et explique que Stripe viendra plus tard. `app/(coach)/ar.tsx` monte une `WebView` sur `https://app.oxvehicle.fr/ar-view` (ligne 99) avec un commentaire disant « route pas encore servie » — l'écran a des états de chargement et d'erreur honnêtes, mais la page qu'il affiche n'existe pas dans ce dépôt.

---

### 4. Les tests : la moitié du sujet n'est pas couverte

**Ce qui tourne.** J'ai exécuté la suite : **1 846 tests verts, 140 suites passées**. Mais la ligne suivante du rapport dit aussi : **18 suites ignorées, 98 tests non exécutés**.

Ces 18 suites sont exactement les 18 fichiers de `src/__tests__/rls/`. Elles couvrent les policies de sécurité : accès coach gradué, télémétrie, amitiés, notes pilote, partenaire, modération, support, matrice de rôles, biométrie (BE-1), rapports B2B, cycles de développement… Toutes s'auto-désactivent via `const describeIf = RLS_TEST_ENABLED ? describe : describe.skip`, et `RLS_TEST_ENABLED` (dans `src/__tests__/rls/setup.ts` ligne 23) exige `TEST_SUPABASE_URL` et `TEST_SUPABASE_SERVICE_KEY`. Sans ces variables — c'est le cas ici — **toute la surface de sécurité de la base n'est jamais vérifiée localement**. Le workflow `.github/workflows/check.yml` a bien un job `rls` dédié qui échoue explicitement si les secrets manquent, mais ce workflow ne se déclenche que sur `push` vers `main` ou `pull_request` vers `main` (voir point 7).

**Ce qui n'est pas couvert du tout.** La configuration `jest.config.js` est décisive :

- `testMatch: ['**/__tests__/**/*.test.ts']` — **seulement `.ts`, jamais `.tsx`**. J'ai vérifié : `git ls-files "*.test.tsx"` ne rend **aucun fichier**.
- `testEnvironment: 'node'`, `preset: 'ts-jest'` — pas de rendu React Native, aucun DOM.

Conséquences vérifiées par recherche dans les 158 fichiers de test :

| Domaine | Fichiers | Tests qui l'exercent |
|---|---:|---|
| `src/ui` (kit V1 / coach) | 68 | **0** — aucun test n'importe `@/ui/…` |
| `src/components` (transverses) | 84 | **0** — aucun test n'importe `@/components/…` |
| `src/store` (Zustand, 5 stores) | 5 | **1 seul** — `src/services/__tests__/captureSessionService.test.ts` |
| `src/hooks` | 7 | **1** — `useDetailLevel.test.ts`, sur la logique pure `detailLevelLogic` |
| Écrans (`app/`, 222 fichiers `.tsx`) | 222 | **0** |

Autrement dit : **aucun écran, aucun composant, aucune barre d'onglets, aucun formulaire, aucun store n'est jamais monté par un test.** Les 1 846 tests portent tous sur des fonctions pures et sur des services dont les entrées/sorties Supabase sont simulées (10 fichiers seulement font un `jest.mock` de Supabase). Ce qui est bien couvert : `src/services` (69 fichiers de tests pour 167 sources), `src/features/rec` (10/12), `src/features/club` (9/16), `src/features/vous` (8/19), `src/circuit`, `src/utils`, `src/ubx`, `src/lib`.

Le seuil de couverture de 70 % déclaré dans `jest.config.js` ne s'applique qu'à quatre chemins (`collectCoverageFrom`) : `src/ubx/**`, `src/utils/**`, `src/types/state.ts`, `src/types/domain.ts`. Il ne dit rien du reste.

**Les autres garde-fous.** Trois barrières complètent les tests, et l'une est rouge :

| Contrôle | Commande | Résultat vérifié |
|---|---|---|
| Types | `npx tsc --noEmit` | **vert** (aucune sortie) |
| Accessibilité | `npx tsx scripts/check-accessibility.ts --strict` | **vert** — 222 fichiers scannés, toutes les `Pressable` ont un `accessibilityRole` |
| Doctrine | `npx tsx scripts/check-doctrine.ts` | **rouge — code de sortie 1, 75 violations** |
| Lint / format | `npm run lint`, `npm run format:check` | rouge **localement seulement** (voir ci-dessous) |

Sur les 75 violations doctrinales : **70 sont le mot « tap » et 5 le mot « swipe »**, détectés comme anglicismes par les règles des lignes 64-65 du script. Aucun verbe prescriptif interdit (« freinez », « accélérez », « vous devriez ») n'est trouvé — la doctrine de fond tient. Ce sont des faux positifs structurels : la liste d'exceptions (ligne 112) ne blanchit que `haptics.tap`, alors que le code écrit `haptic="tap"` et `haptic('tap')`. Mais le script exit 1, donc **l'étape « Scan doctrinal » de la CI échouerait aujourd'hui** sur cette branche.

Sur le lint : les 751 erreurs sont toutes des `Delete ␍` (fins de ligne Windows) et proviennent d'**un seul fichier**, `app/(app)/profil.tsx`. J'ai vérifié l'objet Git lui-même : `git cat-file blob HEAD:app/(app)/profil.tsx` ne contient **aucun** caractère `\r`. C'est donc un artefact du poste de travail (`core.autocrlf=true`), pas une dette du dépôt : sur la CI Linux, le lint serait propre. Restent deux avertissements réels : quatre `react-hooks/exhaustive-deps` sur `app/(app)/cartes.tsx` ligne 98, et un `import/first` sur `src/services/sessionTelemetryService.ts` ligne 27.

---

### 5. Les espaces hors périmètre app — et le fait qu'ils n'ont personne dedans

Trois espaces sont, par décision écrite, destinés à basculer sur le web.

`docs/refonte-app/18_APP_VS_WEB.md` pose la ligne. Sur le partenaire (§1) : « l'inscription/édition d'une fiche partenaire est une opération longue → portail web partenaire ». Sur l'admin (§1.4) : « garder l'admin terrain en mobile, construire l'admin lourd en web (saisie longue, tableaux, exports, multi-fenêtres) », avec la conséquence « on ne gonfle pas l'admin mobile avec du reporting/facturation ». Le §148 du même dossier ajoute qu'aucun CRM ni gestion de leads partenaires ne doit vivre dans l'app.

| Espace | Écrans | Lignes | Garde du layout |
|---|---:|---:|---|
| `app/(admin)` | 30 | 8 776 | `profile.is_admin` — sinon `Redirect /(app)` |
| `app/(partner)` | 9 | 2 472 | `profile.role === 'partner'` |
| `app/(pro)` | 8 | 1 870 | `profile.role === 'pro_pilot'` |

**Ce qui ne marche pas, mesuré en base.** La répartition réelle des 14 comptes de production :

| `role` | `is_admin` | Comptes |
|---|---|---:|
| `pilot` | false | 10 |
| `admin` | **false** | 2 |
| `pilot` | true | 1 |
| `partner` | false | 1 |

Trois constats en découlent, tous vérifiables :

1. **Il n'existe aucun compte `role='coach'` en production.** Les 37 écrans de `app/(coach)` — 26 371 lignes, le deuxième plus gros espace du dépôt — ne sont atteignables par personne aujourd'hui, puisque `app/(coach)/_layout.tsx` ligne 33 renvoie tout ce qui n'est pas `role === 'coach'` vers `/(app)`.
2. **Il n'existe aucun compte `role='pro_pilot'`.** Les 8 écrans de `app/(pro)` sont dans le même cas.
3. **Les deux comptes `role='admin'` ont `is_admin = false`.** Or l'espace admin est gardé par `is_admin`, pas par `role`. Ces deux comptes atterrissent donc dans l'arbre pilote V1 (la branche finale de `app/index.tsx`) sans accès admin. Le double système `users.role` / `users.is_admin` produit ici une incohérence de fait.

**Un lien qui ne mène nulle part.** `src/components/SpaceSwitcher.tsx` n'apparaît que si `profile.is_admin === true` (ligne 32) et propose alors « Espace coach » vers `/(coach)`. Mais le layout coach exige `role === 'coach'`. Le seul compte `is_admin=true` en base est un `pilot` : le bouton « Espace coach » le renverrait immédiatement sur `/(app)`. Le lien existe, la destination le rejette.

**L'espace coach n'a jamais été refondu.** Il utilise `@/theme/v2` (le langage précédent), là où l'arbre pilote V2 utilise `@/ui/v2/tokens`. Le plan de lots du dossier maître (`OXV_APP_V2_DOSSIER_MAITRE.md`, dernière ligne du §10) inscrit « Coach/Admin v2 — propagation design system » comme lot sans numéro, « après pilote ». Aucun rapport de lot correspondant n'existe.

---

### 6. Ce qui vit hors de ce dépôt

**L'écran TV du paddock n'existe pas ici.** Le rapport `roadmap/rapports/live-b.md` ligne 133 le dit franchement : « **L'écran TV n'existe pas.** Le Livrable 2 (`/board/<sessionId>`) vit dans le repo `oxv-site`, pas ici. Sans lui, aucun écran de paddock n'est servi. » J'ai vérifié : `app/board` n'existe pas dans l'arborescence. Côté app, tout le transport est là — `openBoardBroadcast` dans `src/services/liveSessionService.ts` ligne 374, `BOARD_MODE = 'A'` verrouillé dans `src/services/boardLogic.ts` ligne 57, le filtre `stripHealth` dans `src/services/v2/liveHealthGate.ts` — mais rien ne consomme le canal.

**La vue AR non plus.** `app/(coach)/ar.tsx` charge `https://app.oxvehicle.fr/ar-view` dans une WebView. La route est web.

**Deux fonctions Edge tournent en production sans source ici.** Le dépôt contient 32 dossiers sous `supabase/functions/`. La production en déclare 34 actives. Les deux qui manquent sont **`capture-membre-fondateur`** et **`yousign-webhook`** — elles n'existent nulle part dans ce dépôt. Le fichier `roadmap/AUDIT_CABLAGE_2026-07.md` §5 documente la répartition historique (14 fonctions du repo app, 18 du repo site) ; le dépôt a depuis rapatrié la plupart des sources, mais pas ces deux-là.

**Le schéma de la base n'est pas non plus dans ce dépôt.** `supabase/migrations/` contient **125 fichiers**. La table `supabase_migrations.schema_migrations` en production compte **215 migrations appliquées**. Le décalage est double : il manque environ 90 migrations, et les horodatages ne correspondent pas — par exemple le fichier `20260719140000_be1_feature_flags.sql` du dépôt face à la version `20260719020940 be1_feature_flags` appliquée. Le dépôt n'est donc pas la source de vérité du schéma, et un `supabase db push` depuis ici ne serait pas idempotent. Les 24 fichiers nommés `00NN_*.sql` (sans horodatage) ne correspondent à aucune convention de version Supabase.

**Les documents légaux publics.** `docs/app_store/KIT_APP_STORE_OXV_MIRROR.md` (lignes 402 et 410) exige `https://oxvehicle.fr/confidentialite` et `https://oxvehicle.fr/cgu` publiées, ce qui relève du site.

---

### 7. Le travail n'est pas poussé, et la CI ne l'a jamais vu

C'est un angle mort qui recouvre tous les autres.

| Comparaison | Écart |
|---|---|
| `HEAD` vs `origin/main` | **247 commits d'avance**, 0 de retard |
| `HEAD` vs `origin/feat/site-document-emails` | **126 commits d'avance** |
| Dernier commit sur `origin/main` | `1a803f3`, **29 juin 2026** |
| Dernier commit sur `HEAD` | `29d5cfd`, 26 juillet 2026 |

`origin/main` est figé depuis le 29 juin. Les 247 commits qui suivent — tout le programme V2 (L0 à L5b), BE-1, SEC-1, BIO-1, BIO-2, LIVE-B, A-FLOW-1 — ne sont pas sur la branche principale. **126 d'entre eux ne sont sur aucun serveur** : ils n'existent que dans ce clone local.

Le workflow `.github/workflows/check.yml` se déclenche uniquement `on: push: branches: [main]` et `on: pull_request: branches: [main]`. Aucun de ces 247 commits n'a donc été passé par le typecheck, le lint, les tests, le scan doctrinal ni surtout le job `rls` obligatoire. Les tests RLS de la biométrie (`be1RLS.test.ts`) et du board n'ont jamais tourné contre un vrai projet Supabase.

Par ailleurs, six worktrees Git obsolètes traînent sur le disque (`.claude/worktrees/crazy-heyrovsky-f302c7`, `fervent-black-ee881d`, `frosty-sutherland-a88223`, `infallible-hofstadter-9810df`, `musing-swirles-ea04b5`, `trusting-albattani-d94548`). Ils sont exclus de Git via `.git/info/exclude`, mais leur existence a déjà causé un problème : `jest.config.js` ligne 24 porte un `testPathIgnorePatterns` explicite sur `/\\.claude/worktrees/` avec le commentaire « sinon jest exécute les mêmes suites en double ».

---

### 8. Les autres inachèvements, avec leurs preuves

**Six drapeaux sur sept sont éteints en base.** Vérifié sur `app_feature_flags` :

| Drapeau | État | Ce qu'il ferme |
|---|---|---|
| `biometry` | **ON** | levé le 25/07 après validation avocat |
| `app_payments` | OFF | les 3 écrans `app/(app2)/reserver/*` — `resolveBookingAccess` (`src/services/bookingCatalogLogic.ts` ligne 71) rend `'closed'`, aucun jour n'est chargé |
| `pilot_waivers` | OFF | `app/(app2)/vous/decharge.tsx` et `app/(app)/decharge.tsx` ; `waiverService.ts` ligne 68 refuse toute signature |
| `founders` | OFF | `app/(app2)/vous/fondateur.tsx` (fail-closed ligne 83), la jauge fondateurs du catalogue |
| `convoys` | OFF | la section convoi de `app/(app2)/club/territoire.tsx` et de `rec/preparation.tsx` |
| `video_overlay` | OFF | la vidéo synchronisée dans `useGalerie` et `useBilan` (lot B1) |
| `coach_billing` | OFF | `app/(coach)/facturation.tsx` et le bloc facturation du hub coach |

Sur les 36 écrans de production de l'arbre V2, **cinq sont intégralement fermés** par un drapeau éteint (les 3 `reserver`, `vous/decharge`, `vous/fondateur`) — en plus des 36 déjà inatteignables hors `__DEV__`.

**Les marqueurs laissés dans le code.** 20 au total (16 `TODO`, 4 `TODO_L3`), aucun `FIXME` ni `HACK` :

- `app/(app2)/reserver/paiement.tsx` ligne 152 — `TODO_AVOCAT CGV` : « texte des Conditions générales de vente à rédiger ». L'écran de paiement n'a pas de mention légale.
- `app/(app2)/bilan/[sessionId].tsx` lignes 358 et 523 — `TODO_L3_TARGET`, « DETTE CONSIGNÉE » : deux cibles de navigation renvoient provisoirement vers `/(app2)/data` au lieu de leur destination réelle.
- `app/(app2)/club/roulages.tsx` ligne 570 — `TODO_L3` : le comparateur entre amis retombe sur `/(app2)/data` (`openCompare`), la route dédiée `?friend=<id>` n'existe pas.
- Cinq `TODO device-tune` (`data/comparer.tsx` lignes 792 et 885, `data/index.tsx` ligne 120, `data/saison.tsx` ligne 117, `data/session/[id].tsx` lignes 1187 et 1508) : scrubbing « version DE BASE » en `PanResponder`, animation en boucle JS, cadran de progression indéterminé, et un fan-out de N requêtes `fetchSessionLaps` faute de service dédié. Tous attendent une mesure sur appareil réel.
- Trois `TODO_ARBITRAGE` (`src/features/miroir/signatureLogic.ts` lignes 8 et 278, `app/(app)/profil.tsx` ligne 385) : libellé provisoire du pilier physiologique BIO-4, et statut Fondateur dont l'emplacement en base reste à trancher.

**Le point de blocage structurel du direct.** `roadmap/rapports/live-b.md` lignes 138 à 145 énonce deux décisions qui appartiennent au fondateur et qui bloquent le tableau de marche : le chaînon séance → journée (une colonne `telemetry_sessions.day_session_id` vers `public.sessions`), sans laquelle « le tableau de marche restera lisible par le seul binôme » ; et le compte de service du téléviseur de paddock, qui « n'est pas un utilisateur authentifié » et n'a donc aucun chemin d'autorisation.

**Les notifications distantes.** `src/services/pushNotificationsService.ts` annonce en tête une « Stratégie V1 » de notifications **locales** pour le débrief J+1 et la veille de séance. `app/(app)/notifications.tsx` (lignes 17-20) le confirme et en tire la conséquence : la ligne « Message de ton coach » de la maquette est **masquée** parce qu'« aucun canal push coach n'est câblé » côté app. Les fonctions Edge `notify-*` sont bien déployées côté serveur, mais l'app ne programme elle-même que deux canaux.

**Les avis de sécurité Supabase.** J'ai récupéré le rapport `security` complet : **83 avis, aucun de niveau ERROR**. Répartition : 57 `authenticated_security_definer_function_executable`, 19 `anon_security_definer_function_executable`, 4 `rls_enabled_no_policy` (sur `_backup_sessions_20260719`, `app_pairing_redeem_attempts`, `founding_members`, `invoice_counters`), 2 `public_bucket_allows_listing` (buckets `coach-media` et `partner-media`, qui permettent de lister tous les fichiers), 1 `rls_policy_always_true` (`corporate_leads`, policy `corp_insert_public` en INSERT sans restriction). À noter la table `_backup_sessions_20260719` : un vestige de sauvegarde laissé en base.

**Un audit de câblage périmé.** `roadmap/AUDIT_CABLAGE_2026-07.md` est daté du 4 juillet 2026 et sert de « base de vérité des lots M ». Il décrit un espace coach de 23 écrans (il en a 37 aujourd'hui), un espace pilote d'environ 74 écrans, et 32 fonctions Edge déployées (il y en a 34). Son verdict « l'app est massivement câblée sur données réelles » reste globalement juste, mais ses chiffres ne le sont plus.

---

### Ce que je n'ai pas pu vérifier

Je n'ai **rien exécuté sur un appareil** : aucune de mes affirmations sur le comportement à l'écran n'est une observation, ce sont des lectures de code. En particulier, je n'ai pas pu confirmer que la garde `!__DEV__` de `app/(app2)/_layout.tsx` se comporte comme annoncé dans un binaire de production, ni que HealthKit reste indisponible sur les builds en circulation — je n'ai pas ouvert les six builds EAS évoqués dans `docs/ETAT_APP_2026-07-26.md` et je n'ai aucun moyen de savoir lequel est installé sur quel téléphone.

Je **n'ai pas ouvert le dépôt du site** (`oxv-site`). Tout ce que je dis de la route `/board/<sessionId>`, de `app.oxvehicle.fr/ar-view`, des fonctions `capture-membre-fondateur` et `yousign-webhook`, et des ~90 migrations manquantes, repose soit sur des affirmations écrites dans ce dépôt, soit sur ce que la production déclare — jamais sur le code source correspondant.

Je **n'ai pas relu les 83 écrans V1 un par un**. Mon inventaire des écrans en démonstration s'appuie sur une recherche exhaustive des marqueurs `DemoBanner`, `DEMO_`, `isDemo`, `demoMode` et des mots « maquette / exemple / fictif / simulé / en dur ». Un écran qui afficherait de la donnée fabriquée **sans** aucun de ces marqueurs m'aurait échappé.

Je **n'ai pas croisé le mapping v1 → v2 fonctionnalité par fonctionnalité**. Le §11 du dossier maître affirme que les 83 fonctionnalités pilote ont une destination V2 ; je constate seulement que la table de correspondance n'est pas écrite dans le dépôt, je n'ai pas refait le contrôle.

Ma détection de code mort est **conservatrice** : elle cherche le nom du module dans le reste du dépôt, donc une simple mention en commentaire suffit à sortir un fichier de la liste (c'est exactement ce qui s'est passé pour `DebriefMirror.tsx`, que j'ai dû vérifier à la main). Il y a donc probablement **plus** de code mort que les sept fichiers et six services que je liste, pas moins. Je n'ai pas passé d'outil dédié (`knip`, `ts-prune`) sur l'ensemble.

Enfin, je **n'ai pas pu exécuter les 98 tests RLS ignorés** : cela demanderait les secrets d'un projet Supabase de test que je n'ai pas. Je ne peux donc pas dire si les policies de sécurité passeraient ou échoueraient — seulement qu'elles ne sont pas vérifiées.
