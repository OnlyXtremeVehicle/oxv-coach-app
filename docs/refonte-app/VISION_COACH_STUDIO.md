# Vision « Studio Coach » — réconciliation avec l'existant et la doctrine

> Vision fondateur (2026-07-04) pour l'espace Coach premium : Studio
> télémétrique, débriefing interactif, CRM, monétisation. Ce document mappe
> chaque brique sur ce qui EXISTE déjà, signale les CONFLITS de doctrine, et
> propose un plan. **Rien n'est construit avant arbitrage des conflits.**

## 1. Ce qui existe déjà (l'espace coach est à ~65 % de cette vision)

| Vision | Déjà en place | Écran / brique |
|--------|---------------|----------------|
| Superposition tour pilote vs référence | ✅ | `comparer.tsx`, `comparer-pilotes.tsx` |
| Analyse data (freinage, G, trajectoire) | ✅ | `carte`, `virage`, GGViz, les 6 lectures |
| Diagramme G-G / enveloppe adhérence | ✅ | `GGViz` (lecture insight) |
| QDI automatique | ✅ | M1 (radar 5 branches, déterministe) |
| Smart Flagging (virages où ça chute) | ✅ partiel | `app_session_analyses.next_focus_corner_index` + key moments |
| Marqueurs / mémos vocaux sur le circuit | ✅ | `annoter.tsx` (texte + audio via expo-av) |
| Consigne ciblée au pilote (post-session) | ✅ | `priorites.tsx` (Focus), CoachBand côté pilote |
| CRM pilote (historique, réglages) | ✅ | `pilote/[id].tsx`, `contexte.tsx` |
| Carnet de notes / blocages | ✅ | `carnet` (pilote), notes coach |
| Business / CA / tarifs | ✅ partiel | `business.tsx` (gaté `can_view_business_dashboard`) |
| Facture PDF | ✅ infra | edge `generate-invoice` (déployée) |
| Gestion parc + batteries | ✅ | `admin/devices`, `device_health_logs`, alias flotte (M7.2) |
| Statut « qui est en piste / stands » | ✅ | `admin/tour-controle` (factuel) |
| Rapport de performance PDF | ✅ infra | `bilanPdfExportService` |

## 2. CONFLITS DURS (à trancher AVANT de construire)

### C1 — Live Leaderboard classant les pilotes par QDI
> **Percute le garde-fou n°1** : « aucune comparaison de deux pilotes par score ;
> tri par récence uniquement ». Un classement live des pilotes par QDI EST la
> comparaison inter-pilotes proscrite.
- **Autorisé** : une console coach montrant *qui est en piste / aux stands /
  nb de tours* (factuel, comme `tour-controle`).
- **Proscrit tel quel** : le *ranking par QDI*. Options : (a) garder proscrit,
  (b) autoriser un affichage COACH-privé non partagé aux pilotes, (c) remplacer
  le rang par un état individuel (« QDI de CHAQUE pilote vs SON propre historique »).

### C2 — Consigne au pilote pendant le run (HUD / radio / broadcast)
> **Percute le Principe 3 « Silence en piste »** : pendant que le véhicule roule,
> aucun écran/notification côté pilote.
- **Autorisé** : « Focus Target » entre deux runs (le pilote lit avant de repartir).
- **Proscrit** : pousser une consigne sur l'app pilote / un HUD PENDANT le run.
- Nuance : le *coach* peut voir des choses en direct sur SA tablette (pas le pilote).
  Le « broadcast fin de session dans 5 min » est une notification pilote **au
  stand**, pas en piste — acceptable si ciblée hors-roulage.

### C3 — Diagnostic causal automatique poussé (« Cause : réaccélération tardive »)
> **Décision 2026-07-04** : l'IA débriefe/calcule mais ne COACHE pas ; les
> conclusions appartiennent au coach humain (ou à une suggestion qu'il valide).
- **Autorisé** : Smart Flagging *factuel* (« Virage 2 : plus forte chute de QDI »).
- **À encadrer** : l'attribution de CAUSE (« réaccélération trop tardive ») doit
  être soit du coach, soit une **suggestion IA validée** (pipeline assistant
  existant), jamais une affirmation automatique présentée comme vérité.

### C4 — « Profil Psychologique » caché au pilote
> **Risque RGPD** : des inférences personnelles (« sur-conduit sous pression »)
> restent des **données personnelles du pilote** ; le droit d'accès s'applique.
> Un profil structurellement « caché » est exposé juridiquement.
- **Autorisé** : notes de travail privées du coach (comme un carnet).
- **À cadrer** : pas de catégorie « profil psychologique » opaque ; les notes
  restent accessibles au pilote sur demande (droit RGPD), et ne stockent pas de
  données sensibles (santé mentale) sans base légale.

### C5 — Sous-virage/survirage « via angle de braquage »
> **Honnêteté capteurs** : le boîtier (RaceBox Mini, GPS+IMU 25 Hz) n'a **pas de
> capteur d'angle volant**. Le lacet (yaw) est mesuré (gyro), pas le braquage.
- **Faisable** : estimer l'équilibre par le lacet vs le lacet attendu
  (vitesse/G latéral) — un proxy honnête.
- **Interdit** : afficher « angle de braquage » comme une mesure. Le bloc méthode
  doit dire que c'est une estimation (comme le proxy QDI).

## 3. DÉPENDANCES (bloquent l'activation, pas la construction)

- **Paiement in-app / déverrouillage / factures** : **SIRET requis** (décision M2 :
  « rien ne s'active avant le SIRET »). On peut construire derrière un feature
  flag ; rien n'encaisse tant que le SIRET n'est pas là. Stripe Connect (marketplace
  Phase 2) partiellement en place.
- **Décharges (waivers) e-sign** : nouveau, **légalement sensible** — nécessite le
  texte juridique validé + capture de signature + stockage horodaté.
- **Split-screen vidéo/data** : nécessite une intégration caméra (non faite) ;
  la banque média existe (`session-media`).
- **Live en direct (leaderboard, G-G live, QDI temps réel)** : le RaceBox
  **enregistre puis synchronise** — le « temps réel via cellulaire » est une
  autre architecture (streaming) non en place. Le « à chaud » actuel = sync à
  l'arrêt moteur (déjà le workflow visé).
- **Balise HUD** : matériel non intégré.

## 4. Plan par phases proposé (après arbitrage des conflits)

- **P0 — Assembler l'existant en « Studio »** (zéro schéma, zéro conflit) : réunir
  comparer + G-G + carte + annoter + Smart Flagging factuel + QDI dans un parcours
  coach fluide (le workflow 6 étapes). Fort ROI, faisable tout de suite.
- **P1 — Débriefing 2.0** : marqueurs sur circuit (existe) + suggestion IA validée
  pour la cause (encadré C3).
- **P2 — Monétisation** : préparer paiement/facture derrière feature flag (gaté SIRET).
- **P3 — Waivers e-sign** (légal à valider).
- **P4 — Console de direction** : version *factuelle* (statut, pas ranking — C1).
- **P5 — Vidéo/HUD/live** : dépendances matérielles + architecture streaming.

## 5. Décisions attendues (fondateur)
1. **C1** — Leaderboard : proscrire le ranking / coach-privé / remplacer par « vs soi » ?
2. **C2** — Consigne pilote : post-run seulement (silence en piste tenu) ?
3. **C3** — Cause automatique : factuel + suggestion IA validée par le coach ?
4. **C4** — Profil psycho : recadrer en notes privées accessibles (RGPD) ?
5. **C5** — Équilibre auto : proxy lacet assumé (pas « angle volant ») ?
6. **Monétisation** : construire derrière flag maintenant (inactif) ou attendre le SIRET ?
