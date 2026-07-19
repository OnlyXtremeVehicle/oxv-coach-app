# Cadrage V3 — Espace Coach

> Établi le 2026-07-11 par cartographie (workflow `coach-cadrage-v3` : handoff
> **OXV Coach** tablette + **OXV Coach Mobile** + les 31 écrans `app/(coach)/`).
> Le **canon couleur V3 est déjà appliqué** à la zone coach (marge §7.6, or=chrono,
> dataColors, ambre neutralisé). Ce cadrage couvre la **reskin V3 complète** qui
> reste (nav, kit, sémantique couleur propre au coach) — après tes arbitrages.

## 1. Deux surfaces, une identité

Le handoff décrit **deux surfaces** :

- **Téléphone** (`OXV Coach Mobile`) — au bord de piste. **C'est la surface de la
  reskin RN V3** (l'app est mobile). Tab bar basse 5 onglets, actif **rouge doux
  coach `#E2685A`** (jamais le blanc pilote), inactif `faint #55555C`, labels
  9-10px JetBrains Mono, logo « OXV **coach** » (mot _coach_ en `#E2685A`).
- **Tablette** (`OXV Coach`) — console au stand, rail vertical 198px. **Hors scope
  reskin RN immédiate** (paysage, non prioritaire alpha juillet 2026). Cible future.

**Nav actuelle** : `app/(coach)/_layout.tsx` = bare Stack sans shell (les 31 écrans
s'atteignent en pile). **Premier chantier reskin** : poser la tab bar 5 onglets +
brancher les routes existantes dessous.

### Répartition des 31 écrans sous les 5 onglets

| Onglet        | Actif                     | Écrans                                                                                                                                                                                             |
| ------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **En direct** | live P5 (reporté) + états | live (placeholder), vide, hors-ligne                                                                                                                                                               |
| **Pilotes**   | cœur métier               | index (Poste), pilote/[id], file-lecture, studio, triage, debrief, comparer, comparer-pilotes, priorites, annoter, lecture, rapport, gabarits, assistant, contexte, plan, cycles(+[id]), repere(s) |
| **Messages**  | à créer (PR live)         | messagerie coach↔pilote attribuée, sans coordonnées                                                                                                                                                |
| **Agenda**    | planning                  | calendrier, disponibilites, demandes, roulages(index/nouveau/[id])                                                                                                                                 |
| **Moi**       | compte pro                | profil, business, facturation, ar, abonnement Pro                                                                                                                                                  |

## 2. Sémantique couleur propre au coach

Les **branches QDI** (traj bleu · frein rouge · accél vert · flui jaune · régul
violet) et la **marge §7.6** sont **identiques au pilote** quand le coach regarde
la donnée d'un pilote. Le reste :

| Sujet                                                                                               | Décision                                                                                                                                                                                                                                                           | Statut                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **Rouge de RÔLE coach** (`roleColors.coach #C8102E` · `coachAccent #E23A4E` · `coachAlert #E2685A`) | Légitime, distinct du rouge-donnée `#F65B5B`. Réservé à l'**identité** (RoleBadge, onglet actif, logo) et au **prescriptif** (CTA d'action, bande des notes/priorités attribuées au pilote, rec vocal actif, suppression). **Jamais** sur un instrument de donnée. | Canon                                                  |
| **`palette.coach` (#E6E6E8 crème)**                                                                 | Reste UNIQUEMENT la **citation coach neutre** (bande de texte montrée au pilote, sobre).                                                                                                                                                                           | Canon                                                  |
| **Branches QDI en vue coach**                                                                       | Identiques au pilote, sans exception.                                                                                                                                                                                                                              | ✅ conforme (pilote/[id], comparer×2, studio, debrief) |
| **heritageGold #C4A459 du n° de virage (`reperes`)**                                                | Gardé (registre « référence » décoratif). Les **contrôles** de repère (sliders) portent les couleurs QDI : freinage `brake`, apex/vitesse `trajectory`.                                                                                                            | Garder + brancher sliders                              |
| **Montant facturé / CA / revenus**                                                                  | **Recommandation : crème neutre** (canon strict : or = chrono seul ; l'argent n'est pas un chrono).                                                                                                                                                                | ⚠ ARBITRAGE Gabin                                      |
| **Tarifs d'offre** (formules coach, abonnement Pro 750 €/an)                                        | **Recommandation : heritageGold `#C4A459`** (registre offre/heritage, distinct de l'or système).                                                                                                                                                                   | ⚠ ARBITRAGE Gabin                                      |

## 3. Deux bugs de canon à corriger (sans arbitrage)

1. **`KingNumber` de la marge globale (studio, debrief)** appelé **sans** prop
   `color` → tombe sur le défaut **OR**, ce qui viole §7.6 (la marge = dégradé
   rouge-donnée→or→vert selon la zone). → brancher `color` sur le dégradé §7.6.
   L'or ne reste légitime que sur le **chrono/record** (best tour, courbe de rythme).
2. ~~Eyebrows/accents d'identité crème → rouge~~ **TRANCHÉ (Gabin 2026-07-11) :
   GARDER LE CRÈME NEUTRE `palette.coach` #E6E6E8** sur les ~18 écrans coach
   (eyebrows d'identité, bordures de sélection). Ce n'était PAS un bug mais un
   choix NG assumé (« accent coach = crème neutre » documenté partout). Split
   assumé : **rouge de rôle réservé à la nav (tab bar active), au RoleBadge et
   aux CTA/bandes prescriptives** ; contenu d'écran en neutre sobre. Aucun sweep.
   NE PAS re-flaguer (une vérif « cohérence identité » le proposera sans ce
   contexte).
3. **Couleur d'entité pilote sur comparatifs** : ne PAS emprunter le rouge de rôle
   (`#E23A4E`) comme couleur d'acteur A sur un écran data (confusion avec le rouge
   freinage). Couleur d'entité neutre (or/blanc, ou traj bleu/cyan).

## 4. Live temps réel (P5) — DANS LE SCOPE (décision Gabin 2026-07-11)

Le live (En direct vue d'ensemble, cockpit focus pilote, multi-live, comparatif
live, note express) est **inclus dans la V3 coach**. Doctrine OK : c'est le
**coach** qui regarde le direct (il ne conduit pas) ; le **pilote** reste en
silence en piste (aucun HUD au volant).

### Architecture proposée — Supabase Realtime, sans nouveau schéma

Transport = **Supabase Realtime** (déjà dans la stack), en deux canaux :

1. **Presence** `live:roster` — le « qui est en piste ». L'app **pilote**, quand
   une capture démarre, rejoint la presence (`{pilotId, prénom, sessionId,
circuit, since}`) ; à l'arrêt/déconnexion, la quitte. Le **coach** lit la
   presence → liste des pilotes live + statut au stand/en piste. Éphémère, zéro
   table.
2. **Broadcast** `live:session:<sessionId>` — le flux télémétrique. L'app
   **pilote** relaie les trames BLE (RaceBox) **throttlées** (~2-4 Hz, pas 25 Hz)
   en broadcast : `{lap, sector, speedKmh, gLat, gLong, chrono, cornerAlert?}`.
   Le **coach** (focus pilote) s'abonne → cockpit défilant. Éphémère, zéro table.

**Aucune migration Supabase** (presence + broadcast sont éphémères). Une table
`live_sessions` optionnelle (persistance/reprise) serait un +, à valider si
besoin — **STOP schéma** avant toute DDL.

### Découpage buildable (app-side, non bloqué)

- **Pur** : `liveSessionLogic.ts` (throttle des trames, réduction de la presence
  en roster, machine d'états de connexion vivant/reconnexion/coupé, dérivation
  d'alerte « virage à surveiller » factuelle) + tests.
- **Service** : `liveSessionService.ts` (canaux presence + broadcast ; `join/
leaveRoster`, `publishFrame` côté pilote ; `subscribeRoster`, `subscribePilot`
  côté coach). Simulateur de flux pour le dev (aucun RaceBox requis).
- **Store** : `useLiveStore` (roster, flux courant, état de connexion).
- **UI coach** : onglet En direct (roster + états vide/hors-ligne robustes),
  cockpit focus pilote, note express (réutilise l'enregistrement vocal +
  attribution existants).
- **Relais pilote** : pendant une capture, brancher `publishFrame` sur le flux
  BLE existant (bluetoothService) — throttlé.

### Dépendance externe (la seule)

Le rendu **end-to-end réel** exige que le RaceBox émette pendant la séance et que
le réseau circuit porte le broadcast. L'**app-side se construit et se teste dès
maintenant** (simulateur de flux) ; la validation matériel/réseau se fait avec
Gabin sur circuit. **Hors-ligne robuste = non négociable** (réseau circuit
instable ; reconnexion BLE déjà faite `0b602c8`) : état « Flux coupé —
reconnexion auto, télémétrie gardée sur le boîtier ».

## 5. Priorités de reskin

| Prio      | Écran                                                    | Action clé                                                                                                                |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **P0**    | `studio.tsx`                                             | Lecture dense (cœur valeur coach) : KingNumber marge OR→§7.6 ; wording Skia→SVG. Donne le ton (QdiRadar+KingNumber).      |
| **Haute** | `debrief.tsx`                                            | Miroir montré au pilote : KingNumber marge §7.6 ; calme, RoleBadge seul, aucun rouge de rôle sur le contenu.              |
| **Haute** | `index.tsx` (Poste)                                      | Hub d'entrée : cartes pilotes (record or / régul violet / à-lire rouge doux), fil 24h à pastilles de rôle, CTA `#E23A4E`. |
| Moyenne   | `triage.tsx`                                             | zoneByIndex sur §7.6 ; commentaire « ambre » obsolète.                                                                    |
| Moyenne   | `annoter.tsx`                                            | Accents contrôles crème→coachAccent ; rouge de rôle sur notes partagées.                                                  |
| Basse     | `pilote/[id]`, `comparer`(×2), `file-lecture`, `lecture` | Eyebrows/bordures crème→rouge de rôle ; couleur d'entité A ; RoleBadge en tête.                                           |
| Basse     | `facturation`, `business`, `profil`, `reperes`           | **Dépendent des arbitrages money/tarifs** avant reskin définitive.                                                        |

## 6. Garde-fous doctrine coach (à conserver)

« L'app est un miroir, jamais un coach » régit le **contenu généré par l'app côté
PILOTE**. Le **coach HUMAIN prescrit légitimement** (repères, consignes, note
pondérée, plan, priorités). Garde-fous inchangés :

- Voix coach **toujours attribuée** (« jamais comme une consigne de l'app »).
- **Aucune coordonnée** pilote visible (RGPD).
- **Aucun classement** entre pilotes.
- **Assistant IA** ne publie rien seul (Valider / Modifier / Rejeter).
- **Vue AR** jamais pour le pilote au volant (sécurité).
- **Vouvoiement** : le handoff coach TUTOIE (« Bonjour Julien », « tes pilotes ») →
  conversion intégrale au **vous** au portage (doctrine premium, non négociable).

## 7. Arbitrages fondateur (à trancher avant la reskin de l'onglet Moi)

1. **Montant facturé / CA** : crème neutre (recommandé) ou or ?
2. **Tarifs d'offre** (formules, abonnement 750 €/an) : heritageGold (recommandé) ou or/crème ?
3. **Scope** : confirmer live P5 reporté post-alpha + tablette hors scope + vouvoiement intégral.
