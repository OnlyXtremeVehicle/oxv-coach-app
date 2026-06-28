# Checklist de validation — build device iOS (1er juillet 2026)

> Objectif : valider sur iPhone toute la pile livrée cette session (M1 + M2 + M3),
> brancher ce qui n'est testable que sur device (caméra), et confirmer le fix
> qui motive le build (détection de tours Charente/Haute-Saintonge).
>
> Le build #18 installé est **antérieur** à la plupart de ces livraisons.

---

## 0. Prérequis du build

- [ ] **Quota EAS réinitialisé** (plan gratuit, reset 1er juillet). Sinon : upgrade plan.
- [ ] Lancer : `eas build -p ios --profile preview` (ou `npm run build:ios:preview`).
      Account EAS `oxv` ; credentials OK (cert exp. 2027-05-16) ; iPhone Gabin
      provisionné (UDID `00008120-001024823E0B401E`).
- [ ] **Deps natives ajoutées cette session → rebuild obligatoire** (pas d'OTA) :
      `react-native-qrcode-svg`, `expo-camera` (+ plugin permission `app.json`).
- [ ] `.env` device : `EXPO_PUBLIC_*` (Supabase URL/anon, Plausible domaine).
- [ ] Installer le build sur l'iPhone, se connecter avec un compte de test.

---

## 1. Régression CLÉ — détection de tours (PR-H, la raison du build)

- [ ] Aller au **Circuit de Charente** (ou Haute-Saintonge), lancer une session.
- [ ] Choisir le circuit AVANT le roulage (`placement.tsx` passe `captureFinishLineFor`).
- [ ] Rouler quelques tours → vérifier que **les tours sont détectés et comptés**
      (avant le fix : repli sur un point codé en dur = 0 tour).
- [ ] Bilan : best_lap, nombre de tours, segments analysés cohérents.

---

## 2. M1 — fondations alpha (déjà en prod, à confirmer sur device)

- [ ] **Garde-fou IA** : un débrief J+1 reste descriptif (aucun verbe prescriptif),
      le fallback local fonctionne hors-ligne (`generateSafeDebrief`).
- [ ] **Silence en piste** : pendant le roulage, aucun écran/notif/son ; « LIEN
      INTERROMPU/PERDU » sobre si le boîtier décroche (pas de REC fantôme).
- [ ] **Support** : pilote crée un ticket (`/(app)/support`) ; admin le voit, change
      statut/priorité, répond (`/(admin)/support`).
- [ ] **Admin Utilisateurs** : rôle, suspension, consentements en lecture.

---

## 3. M2 — public-ready (events / Pass / partenaires)

- [ ] **Admin Événements** : créer un événement, voir les inscriptions, **check-in
      manuel** (« Pointer l'arrivée »).
- [ ] **Pass OXV pilote** : s'inscrire à un événement ouvert ; le pass affiche un
      **QR de présence** (`oxv:checkin:<id>`, fond clair) — *dépend du rebuild qrcode*.
- [ ] **Scan check-in caméra** (`/(admin)/scan-checkin`) : scanner le QR d'un pass →
      `checked_in`. **Testable uniquement sur device** (permission caméra).
- [ ] **Bandeau démo** sur le Bilan pour un événement non-circuit (balade/test_alpha).
- [ ] **B2B Report** : admin génère/partage un rapport ; le partenaire voit l'agrégat
      figé si `status='shared'` (`/(partner)/rapports`).

---

## 4. M3 — innovation V4 (livrée cette session, série nue 0024→0029)

### 4.1 Garage (PR-44)
- [ ] `/(app)/garage` : ajouter un véhicule, ouvrir sa fiche, consigner un réglage
      (pneus/freins/pressions/notes). Visible aussi depuis le hub Pilote pro.

### 4.2 Carnet pilote (PR-45)
- [ ] `/(app)/carnet` (zone Progression) : page blanche, écrire une note, **partager
      une note** avec le coach (toggle), supprimer.
- [ ] Côté coach : le bloc « Carnet partagé » n'affiche QUE les notes partagées.
- [ ] Lien « Noter mon ressenti » depuis le Bilan (pré-remplit le lien séance, pas le texte).

### 4.3 Assistant IA coach (PR-46) — **prérequis : opt-in pilote**
- [ ] Le pilote active **« Assistant IA de mon coach »** dans Réglages (défaut OFF).
- [ ] Le pilote accorde au coach le niveau **lecture détaillée** (sinon 403).
- [ ] Coach `/(coach)/assistant` : choisir pilote/séance/virage → « Proposer une
      observation » → un brouillon descriptif apparaît (edges déployées).
- [ ] Éditer le brouillon → **Valider** → l'observation devient une annotation visible
      au pilote (zoom virage) avec la mention **« Assistée par IA, validée par votre coach »**.
- [ ] Vérifier qu'un brouillon édité en **prescriptif** est refusé à la validation
      (re-filtre serveur + trigger DB).
- [ ] Si le pilote n'a pas l'opt-in : message « Consentement IA-coach requis ».

### 4.4 Programmes adaptatifs (PR-47) — **prérequis : niveau `programme`**
- [ ] Le pilote accorde au coach le niveau **`programme`** (cran au-dessus de détaillée).
- [ ] Coach `/(coach)/cycles` : créer un programme, ajouter des axes, basculer le statut
      d'un axe (en_cours/atteint), **Partager au pilote**.
- [ ] Vérifier qu'un axe **prescriptif** bloque le partage (re-scan au flip `is_shared`).
- [ ] Pilote `/(app)/programme` (Progression) : lit le programme en lecture seule
      (ne coche rien).

### 4.5 Empreinte consolidée (PR-48)
- [ ] `/(app)/signature` après ≥ 2 séances analysées : section « Votre empreinte dans
      le temps » (constats juxtaposés, **aucune flèche/courbe/score**).
- [ ] Partager une empreinte (toggle) ; côté coach, bloc « Empreinte partagée » lecture seule.

### 4.6 Modération (PR-49)
- [ ] Lien **« Signaler »** discret sur un avis coach (`/(app)/coach/[id]`) et une offre
      partenaire (`/(app)/partenaires`) → modale motif + précision si « autre ».
- [ ] Doublon refusé (« déjà signalé ») ; cible non visible refusée.
- [ ] Admin `/(admin)/moderation` : file (nouveaux d'abord), prise en charge, résolution
      (note interne), rejet. Le signaleur ne voit jamais la résolution.

---

## 5. À faire HORS code (Gabin / juriste)

- [ ] **Clause CGU « Modération / Signalement »** avant mise en avant publique du bouton
      Signaler (RGPD 6.1.c, conservation, contact@oxvehicle.fr).
- [ ] **Opt-in IA explicite** : confirmer la bascule opt-out→opt-in (arbitrage juridique).
- [ ] Réconciliation réservations SITE ↔ events app (privé/slug) si pertinent.

---

## 6. Notes / pièges connus

- Les **tests RLS** (`src/__tests__/rls/*`) sont *skippés* sans `TEST_SUPABASE_URL` /
  `TEST_SUPABASE_SERVICE_KEY` — à câbler dans une branche CI pour les exécuter pour de vrai.
- Migrations appliquées en prod jusqu'à **`0029`** (série nue 0020→0029, appliquées en
  *live* via MCP — le dépôt ne dépend pas de l'ordre `db reset`).
- 2 **edges** déployées : `coach-ai-draft`, `coach-ai-validate` (verify_jwt=true) — dormantes
  tant qu'aucun pilote n'a activé l'opt-in IA-coach.
- Advisor sécurité préexistant non lié à cette session : `security_definer_view` sur
  `public.sessions_public` (à traiter séparément).
