# PROMPT CLAUDE CODE — LOT SEC-1 · SÉCURITÉ & MONITORING (à exécuter EN PREMIER, avant BE-1)
### Repo oxv-app + prod Supabase · corrige les risques hérités du bilan · un lot = un commit — 18/07/2026

---

## CONTEXTE
Audit du 18/07 : la refonte v2 ne doit pas se construire sur des risques connus. Ce lot ferme les 8 points hérités du bilan AVANT tout écran v2. Aucune fonctionnalité nouvelle. Inspection MCP systématique avant toute modification prod.

## ACTION 1 — MONITORING (bloque tout le reste)
- `SENTRY_DSN` en secret EAS + `eas.json` (les 3 profils) ; vérifier l'init existante ; test : erreur volontaire en dev-client → visible Sentry.
- Remonter les échecs silencieux critiques : `captureException` dans les échecs de sync de la file (quarantaines), échec HealthKit, échec upload — SANS modifier la logique des services (wrappers aux points d'appel).

## ACTION 2 — EDGES FAIL-OPEN (risque HAUTE bilan)
`notify-pilot-coach-assigned` + `notify-coach-consent-received` : redéployer `verify_jwt=true` OU garde interne stricte (vérif appelant service_role + validation payload). Test : appel anonyme → 401. Vérifier qu'aucun flux légitime ne casse (elles sont appelées par triggers/edges internes — inspecter d'abord).

## ACTION 3 — PII
- `sessions.private_client_*` : policy resserrée — lecture admin + intéressé uniquement (inspecter les usages réels avant : grep + logs).
- IBAN coach : décision fondateur appliquée = **colonne dédiée** `coach_payout_details` table séparée RLS owner+admin, migration + code de `payment_link` nettoyé ; si le fondateur n'a pas tranché à l'exécution : à minima retirer l'IBAN de toute vue/policy `published`.

## ACTION 4 — VUES SECURITY DEFINER (6 en ERROR advisors)
Pour chacune (`crews_public`, `posts_with_engagement`, …) : `security_invoker = true` si le modèle RLS le permet, sinon conversion en fonction SECURITY DEFINER à `search_path` figé + REVOKE public + GRANT ciblé. Advisors relancés = 0 ERROR.

## ACTION 5 — PURGE SANTÉ COHÉRENTE
Auditer `purge-deleted-accounts` contre TOUTES les colonnes/tables sensibles (médicales existantes + à venir biometry_raw) : liste exhaustive dans `docs/architecture/14_PURGE_MATRIX.md` (table × colonnes × purge oui/non/anonymisation) ; combler les manques par migration. `incident_reports` : NE PAS purger — **anonymiser** (user_id NULL, gel) `// TODO_AVOCAT E5` en attendant l'arbitrage juridique.

## ACTION 6 — CI RLS RÉELLE
Poser les secrets CI (`SUPABASE_TEST_URL/KEY` projet de test) — documenter la procédure 10 min fondateur si les secrets ne peuvent être posés par Claude Code ; workflow : les 85+ tests RLS s'exécutent (plus de skip) ; badge vert exigé pour merger tout lot v2.

## ACTION 7 — EDGES HORS REPO (18, dont pair-app)
Rapatrier les sources dans `supabase/functions/` (download prod → commit, diff documenté) ; celles appartenant au site : les référencer (`docs/architecture/15_EDGES_REGISTRY.md` : nom, repo, rôle, auth, dernière vérif). Plus aucune edge anonyme.

## ACTION 8 — STORAGE & DIVERS
Policies storage explicites `pilot-media/{uid}/incidents/**` (write own, read own+admin) · `founders_count()` et toute fonction DEFINER : search_path figé + REVOKE PUBLIC · garde analytics : assertion dev qu'aucun événement ne contient email/nom/handle (liste de clés interdites).

## PREUVES
Sentry reçoit une erreur test · appels anonymes notify → 401 · advisors 0 ERROR · CI : tests RLS exécutés et verts · `14_PURGE_MATRIX.md` + `15_EDGES_REGISTRY.md` livrés · captures avant/après policies · commit `sec: SEC1 — monitoring, fail-closed, PII, purge, CI RLS`.
