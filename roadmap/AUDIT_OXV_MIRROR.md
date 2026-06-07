# Audit OXV Mirror — code vs Cahier des charges (juin 2026)

> Document de suivi de l'alignement du code sur le **Cahier des charges OXV Mirror v1.0**.
> Référence : `Cahier_des_Charges_App_OXV_Mirror.docx`.
> Dernière mise à jour : 7 juin 2026 — **J−28 avant l'alpha de Bouteville (5 juillet 2026)**.

---

## 0. Synthèse en une page

Le virage doctrinal de juin 2026 (« OXV Coach » → **OXV Mirror**, abandon du coaching au profit de la restitution factuelle) a été **intégré dans le code**. Les contradictions majeures sont résolues, les 4 piliers factuels qui remplacent le QDI sont livrés, et le risque juridique principal (debrief IA) est couvert par un garde-fou déterministe.

**Faits depuis** : volet social (liste §7.1 + carte native §7.2), fondation permissions modulaires coach (§8.1), mesure d'audience RGPD type Plausible (§9). **Décidé** : §4 WebView écarté, l'app reste tout natif.

**Restent** : application des corrections juridiques proposées (en attente validation Gabin), et le **§8 avancé** (tableau de bord business : revenus, remises dégressives, gestion des roulages) — en attente des règles commerciales de Gabin.

---

## 1. Ce qui est FAIT (aligné cahier)

### §1-2 — Doctrine miroir / restitution factuelle
- ✅ Rebrand complet « OXV Coach » → « OXV Mirror » (PR #45, 62 fichiers)
- ✅ Vouvoiement, ton sec, zéro emoji — garanti par scanner CI `check-doctrine.ts` (24 patterns)
- ✅ Silence en piste (aucun écran pendant le pilotage)
- ✅ Un seul chiffre central par écran
- ✅ Comparaison entre amis repositionnée « Côte à côte » entre copains, pas du coaching (PR #46)

### §3 — Les 4 piliers factuels (remplacement du QDI)
- ✅ **3.1 Signature de pilotage** (PR #49) — service pur + 9 tests + écran. Le différenciateur marché.
- ✅ **3.2 Régularité / consistance** (PR #50) — écart-type chronos, fait statistique, + écran.
- ✅ **3.3 Évolution personnelle** — écran progression existant (vs soi, jamais aux autres).
- ✅ **3.4 Carte de chaleur** (PR #51) — heatmap vitesse le long du tracé.
- ✅ QDI retiré côté app (migration 0007 `drop qdi_scores`).

### §4 — Architecture technique
- ✅ React Native + Expo + TypeScript, Supabase Frankfurt
- ✅ RaceBox Mini BLE + parser UBX (réutilisés V1)
- ✅ Tables `app_session_analyses`, `app_segment_analyses`
- ✅ Client Supabase unifié
- ✅ Bundle ID / slug déjà neutres (`fr.oxvehicle.app`, `oxv-app`)

### §8 — Espace coach partenaire (partiel)
- ✅ Rôle `coach` distinct, RLS `is_coach_of` + consentement
- ✅ Annotations textuelles coach sur sessions
- ✅ Onboarding coach + pacte de coaching distinct
- ✅ Email invitation Resend
- ✅ Vue coach « comparer 2 pilotes » (PR #47)

### §11 — Éléments retirés (cohérence doctrine)
- ✅ Classement pilotes : jamais implémenté
- ✅ Score sécurité public : jamais implémenté
- ✅ Gamification (badges, succès) : jamais implémentée
- ✅ Notifs `rank_change` / `new_record` / `new_follower` : jamais implémentées
- ✅ **Debrief IA recadré strictement descriptif** (PR #48) : garde-fou déterministe sur la sortie GPT (scan verbes interdits + retry + refus 422 → fallback local). Rien de prescriptif ne peut atteindre le pilote.

---

## 2. Ce qui RESTE (avant alpha)

### 🟠 Conformité juridique (≈ 3 h, prépare le brief avocat)
- [ ] Relecture des 5 docs juridiques au prisme « restitution vs coaching » :
  - Pacte de pilotage
  - CGU app (renommé `02_CGU_APP_OXV_MIRROR.md`)
  - CGV
  - Politique de confidentialité (RGPD)
  - Synthèse avocat (à produire)
- [ ] Repérer les formulations qui parlent encore de « coaching » / « conseil » côté pilote.

### 🟠 Table mentionnée au cahier, non créée
- [ ] `app_circuit_zones` (§4) — utilité réelle à trancher : redondante avec `BELTOISE_CORNERS` + `app_segment_analyses` ? Si zones de freinage/accélération de référence par circuit nécessaires pour la heatmap V1.1, la créer ; sinon documenter qu'on s'en passe.

### 🟠 Déploiement (côté Gabin, après le 1er juin — quotas)
- [ ] Déployer les Edge Functions (generate-debrief-ai mis à jour, send-coach-invitation, notify-*, cron-analyze-pending-sessions)
- [ ] Créer le bucket Storage `session-media` (cf. PR #42)
- [ ] Appliquer les migrations en attente (0027 → 0031)
- [ ] Compte Expo/EAS dédié `oxv@oxvehicle.fr`
- [ ] Build EAS production iOS + Android
- [ ] Smoke test device avec vrais RaceBox à Bouteville

---

## 3. Différé POST-alpha (gros chantiers, hors périmètre 5 juillet)

### 🟢 §7 — Volet social : carte interactive
- [x] **FAIT** : liste des pings (§7.1, PR #58) + carte interactive native `react-native-maps` (§7.2, PR #59). Pings événements OXV/partenaires/soirées/tournages/hôtes, réservés aux membres validés (RLS `is_validated_member`, migration 0033). Fallback liste en Expo Go.

### 🟢 §8 — Espace coach : SaaS complet
- [x] **Permissions modulaires** à la carte (PR #56) : table `coach_permissions`, helper `coach_has_permission()`, hook `useCoachPermissions`. Le rôle coach n'est plus binaire.
- [x] **Gestion des roulages** (migration 0034) : le coach crée ses roulages et invite ses pilotes (gating `manage_own_sessions`) ; le pilote accepte/décline. Décision Gabin 2026-06-07.
- [ ] ~~Remise dégressive -5/-10/-15 %~~ — **ABANDONNÉE** (décision Gabin 2026-06-07, confirmée après relecture cahier v3).
- [x] **Tableau de bord business CÔTÉ COACH** (migration 0035, cahier v3 §10.2 sans remise) : nombre de pilotes, roulages, présences confirmées, revenu cumulé = prix/place × présences. Gating `can_view_business_dashboard`. Revenu réel uniquement (pas de chiffre fabriqué, pas de CA OXV global, pas de commission).
- [ ] Paramètres contextuels coach (niveau, objectif, matériel, météo vécue)
- [ ] Méthodes/repères du coach appliqués à la restitution
- [ ] Propriété partagée de la donnée enrichie (à formaliser au contrat SaaS)

### 🟢 §4 — Option B : WebView
- [x] **DÉCISION GABIN (2026-06-07) : tout natif, pas de WebView.** L'app reste 100 % native (garage / documents / progression compris). On conserve la cohérence UX et l'offline-first ; l'évolution de contenu passe par un build. L'option WebView est écartée.

### 🟢 §9 — Mesure d'audience
- [x] **FAIT (PR #57)** : `analyticsService.trackEvent()` vers Plausible (cookieless, sans PII, opt-out MMKV). Inactif tant que `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` n'est pas renseigné.

---

## 4. Features livrées AU-DELÀ du cahier (valeur ajoutée)

Ces fonctionnalités ne sont pas dans le cahier mais ont été construites et restent cohérentes doctrine :
- Page contenus média (photos/vidéos sur piste par session) — PR #42-44
- Comparaison virage par virage entre amis — PR #40
- Throttling notifications (anti-spam) — PR #39
- Export PDF du bilan
- Replay scrubber tactile
- Objectifs personnels pilote
- Tests RLS automatisés (21 tests)

---

## 5. Risques & points de vigilance

| Risque | État | Mitigation |
|---|---|---|
| Debrief IA prescriptif (juridique) | ✅ Couvert | Garde-fou déterministe PR #48 |
| Comparaison sociale (doctrine §2) | ✅ Recadré | « Entre copains », opt-in mutuel, pas de classement |
| Nom de repo GitHub encore `oxv-coach-app` | ⚠️ Cosmétique | Renommer via Settings GitHub (redirige 6 mois) |
| `app_circuit_zones` non créée | ⚠️ À trancher | Probablement non bloquant pour l'alpha |
| Volet social absent | 🟢 Hors périmètre | Post-alpha assumé |

---

## 6. Recommandation de priorisation (J−28 → J0)

1. **Semaine 1** : relecture juridique 5 docs + brief avocat (le seul vrai bloquant légal restant)
2. **Semaine 2** : déploiement Supabase complet + compte EAS dédié
3. **Semaine 3** : builds EAS prod + soumissions stores (délai review ~1 sem)
4. **Semaine 4 / jour J** : smoke test device Bouteville, ajustements de dernière minute

Les 4 piliers, la doctrine et le garde-fou IA étant faits, **l'app est fonctionnellement prête pour l'alpha**. Le chemin critique restant est juridique + déploiement, pas développement.
