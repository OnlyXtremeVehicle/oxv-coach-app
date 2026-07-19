# OXV V2 — RAPPORT D'AUDIT · EXHAUSTIVITÉ & SÉCURITÉ DE LA DONNÉE
### Croisement : 10 prompts × dossier maître × bilan 171 écrans × classes de données — 18/07/2026

---

## 1. MÉTHODE
Contrôle ligne à ligne : (a) les 15 nouveautés A1-D4 + BIO ont-elles un lot ? (b) les 38 écrans ont-ils un prompt ? (c) chaque classe de donnée (santé, PII, paiement, télémétrie, médias, sociale) est-elle protégée à l'écriture, à la lecture, au transport, à la purge ? (d) les risques sécurité HÉRITÉS du bilan sont-ils adressés ?

## 2. EXHAUSTIVITÉ — COUVERTURE CONFIRMÉE
✅ 38/38 écrans prompts L1-L5 · ✅ A1 (L4+A1-ON) · A2/A3 (BE-1+L4+L5) · B1 (clôture) · B2 (L2-B) · B4/B5 (L3) · BIO-0→4 (BE-1/L2/BIO-2/BIO-3/L6) · C1/C2 (L2/L5) · C3 (L5) · D1 (LIVE-B) · D4 (BE-1+L2) · ✅ les 4 gates externes posées · ✅ doctrine testable (greps, comparateur sans gagnant, board sans santé, groupe sans chrono d'autrui).

## 3. EXHAUSTIVITÉ — 6 ÉCARTS TROUVÉS (et leur correction)

| # | Écart | Gravité | Correction |
|---|---|---|---|
| E1 | **Onboarding/auth (11 écrans) restés en design v1** — or c'est la PREMIÈRE impression du nouvel inscrit et des reviewers App Store | Haute (produit) | Ajouté au lot **L6** (patch appliqué) : habillage v2 des écrans auth/onboarding — tokens, HeroPhoto, insigne trait, PressScale ; logique d'auth INTACTE |
| E2 | **Aucun lot n'adresse les risques sécurité hérités du bilan** (2 edges fail-open, PII, IBAN, vues SECURITY DEFINER, purge médicale, CI RLS) | **Critique (sécurité)** | Nouveau lot **SEC-1** créé (fichier dédié), placé AVANT L1 dans l'ordre |
| E3 | **DSN Sentry absent de la série** — or L6 exige 99,5 % crash-free, immesurable sans monitoring | Haute | Intégré à **SEC-1** (première action) |
| E4 | **Buffer biométrique local (BIO-2) non chiffré/non purgé** : données santé en SQLite claire sur le device | Haute (santé) | Patch **BIO-2** appliqué : protection fichier iOS complète + purge locale post-upload |
| E5 | **incident_reports vs droit à l'effacement RGPD** : immuabilité probatoire ↔ suppression de compte non tranchées | Moyenne (juridique) | Question AJOUTÉE au dossier avocat (patch) : anonymisation (user_id → NULL + gel) plutôt que suppression ? Décision avocat requise |
| E6 | **D2 (séquences coach) et D3 partiel (rapport B2B enrichi)** sans prompt | Basse (assumé) | Consignés explicitement : série coach/admin v2 (post-pilote), PAS oubliés — reportés |

## 4. SÉCURITÉ — MATRICE PAR CLASSE DE DONNÉE

| Classe | Écriture | Lecture | Transport | Purge | Verdict |
|---|---|---|---|---|---|
| **Santé** (biometry_raw) | own-row + idempotence | own + coach détaillé consenti, JAMAIS staff/partner/board (stripHealth testée) | Realtime privé RLS, 0,5 Hz coach seul | 30 j + suppression compte + 🆕 purge buffer local | ✅ après patch E4 |
| **Santé locale** (buffer device) | SQLite | device only | — | 🆕 post-upload + file protection | ✅ patché |
| **PII** (private_client_*, IBAN coach) | v1 | ⚠ lisible authentifié (héritée) | — | ⚠ incohérence colonnes médicales | → **SEC-1** |
| **Paiement** | Stripe/IAP (aucun PAN chez OXV) | serveur | 🆕 signature webhook + idempotence exigées (patch A1-ON) | n/a | ✅ après patch |
| **Télémétrie** | write-path durci v1 (52 tests) | RLS 58/58 | file offline éprouvée | purge compte v1 | ✅ |
| **Médias/incidents** | bucket {uid}/ | own + admin | — | compte | ✅ + policy storage explicitée SEC-1 |
| **Sociale** (présence, crews, convois) | opt-in colonne + RLS | opt-in only | — | compte | ✅ (inspection prod crews avant tout) |
| **Live board** | relais pilote capture only | inscrits + 🆕 token device à rotation lecture seule (patch LIVE-B) | topic dédié, whitelist | éphémère | ✅ après patch |

## 5. RISQUES HÉRITÉS DU BILAN → TOUS ROUTÉS
notify-* fail-open ×2 → SEC-1 · vues SECURITY DEFINER ERROR ×6 → SEC-1 · purge colonnes médicales → SEC-1 · secrets CI (85 tests RLS jamais exécutés) → SEC-1 · 18 edges hors repo (dont pair-app) → SEC-1 (rapatriement/référencement) · PII/IBAN → SEC-1 · types `as never` → BE-1 (déjà) · catch muets pilote → StateView v2 (déjà).

## 6. DURCISSEMENTS MINEURS APPLIQUÉS EN PATCH
`founders_count()` : search_path figé + REVOKE public (SEC-1) · privacy **nutrition labels** App Store (données santé/localisation) ajoutés à L6 · analytics funnel : rappel zéro PII dans les événements (L4 concerné, garde analyticsService) · storage policy `pilot-media/{uid}/incidents/` écrite (SEC-1).

## 7. VERDICT
Après SEC-1 + les 4 patchs : **couverture 100 % du périmètre pilote v2, chaîne de la donnée santé fermée de bout en bout (capteur → device chiffré → RLS → coach consenti → purge), risques hérités tous adressés.** Restent 2 dépendances humaines déjà connues : validation avocat (consentement, décharge, E5) et exécution réelle des tests RLS en CI (secrets à poser — action fondateur 10 min, listée SEC-1).

**Nouvel ordre : SEC-1 → BE-1 → L0 → L1 → L2 → L4 → L5 → [PISTE] → L3 → BIO-2 → [CLASSEMENT] → LIVE-B → BIO-3 → B1 → [SIRET] → A1-ON → L6.**
