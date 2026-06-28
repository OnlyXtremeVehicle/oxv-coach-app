# Tests RLS — Setup & exécution

> Tests d'intégration qui vérifient les Row-Level Security policies Supabase de
> tout le périmètre (coach, pilote, partenaire, admin, modération). Filet de
> sécurité RGPD : ils valident qu'aucun rôle ne voit ce qu'il ne doit pas voir.

## État actuel

- **16 fichiers de tests RLS** dans `src/__tests__/rls/` (+ `setup.ts`).
- **CI déjà câblée** : `.github/workflows/check.yml` a un job dédié **`tests RLS`**
  qui exécute la suite si les secrets sont présents, et reste vert (avec un message)
  sinon. Les tests tournent aussi, skippés en silence, dans le job principal.
- **Par défaut : SKIP.** Sans `TEST_SUPABASE_URL` + `TEST_SUPABASE_SERVICE_KEY`, les
  suites sont `describe.skip` — la CI standard tourne sans secret Supabase.
- Script local dédié : **`npm run test:rls`** (= `jest src/__tests__/rls --runInBand`).

> ⚠️ Ces tests ne peuvent PAS être exécutés par un assistant : ils ont besoin de la
> clé **service_role** d'une branche de test (création d'utilisateurs via l'API
> admin), que le MCP Supabase n'expose jamais. La provision ci-dessous est manuelle.

## Fichiers (16)

| Fichier | Périmètre |
|---|---|
| `setup.ts` | Helpers (createTestUser, assignCoachToPilot, userClient, adminClient…) |
| `coachSessionsRLS` / `coachAnnotationsRLS` / `coachGradedAccessRLS` | Accès coach gradué (sessions, annotations, niveaux) |
| `coachAiRLS` | Assistant IA coach (brouillons, anti-auto-validation, garde-fou) |
| `developmentCyclesRLS` | Programmes adaptatifs (niveau `programme`, re-scan au partage) |
| `pilotNotesRLS` | Carnet pilote (own-row, partage opt-in par note) |
| `signatureSnapshotsRLS` | Empreinte consolidée (own-row, partage opt-in) |
| `vehicleSetupsRLS` | Garage (réglages, own-row dérivé du véhicule) |
| `supportRLS` | Support tickets (pilote/admin) |
| `moderationRLS` | Modération (signaleur confidentiel, review admin-only, trigger intégrité) |
| `eventsRLS` / `eventPartnersRLS` / `b2bReportRLS` | Événements, partenaires d'événement, rapports B2B |
| `partnerRLS` / `pilotFriendshipsRLS` / `adminTablesRLS` / `roleMatrixRLS` | Partenaires, amitiés, tables admin, matrice rôle×télémétrie (règle cardinale §148) |

## Activer les tests (provision manuelle — Gabin)

### 1. Créer une Supabase Branch de test

Dashboard Supabase du projet OXV (`fouvuqkdxarjpjbqnsjq`) :
1. Onglet **Branches** → **Create branch** → nom `ci-rls-tests` (sans copie des données).
2. La branche applique automatiquement **toutes les migrations** (jusqu'à `0029`).
3. Récupérer, côté **Settings → API** de la branche :
   - **Project URL** (`https://<branch-ref>.supabase.co`)
   - **anon key**
   - **service_role key** (⚠️ SECRET — ne jamais committer)

### 2. Exécuter en local

Créer `.env.test.local` (déjà couvert par `.gitignore`) :

```bash
TEST_SUPABASE_URL=https://<branch-ref>.supabase.co
TEST_SUPABASE_ANON_KEY=eyJ...
TEST_SUPABASE_SERVICE_KEY=eyJ...
```

```bash
set -a; source .env.test.local; set +a
npm run test:rls
```

### 3. Activer en CI

Repo GitHub → **Settings → Secrets and variables → Actions** → ajouter :
`TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_KEY`.

Le job **`tests RLS`** de `check.yml` les lit automatiquement et exécute la suite à
chaque push/PR. Sans les secrets, il reste vert avec une notice.

## Précautions

- **Toujours une branche de test, JAMAIS la prod** : les tests créent/suppriment des
  comptes (`rls-test-<role>-<timestamp>@oxv.test`).
- `cleanupTestUsers` tourne en `afterAll` (best-effort). En cas de crash, nettoyer :
  ```sql
  DELETE FROM auth.users WHERE email LIKE '%@oxv.test';
  ```
- `--runInBand` (script `test:rls`) sérialise les suites pour éviter les collisions
  d'utilisateurs entre fichiers.

## Quand re-exécuter

Obligatoire dès qu'on modifie : une migration RLS, une fonction SECURITY DEFINER
(`is_coach_of`, `is_detailed_coach_of`, `is_program_coach_of`, `is_admin`,
`coach_ai_consent`…), ou un service touchant un périmètre couvert ci-dessus.

## Note doctrine

Ces tests vérifient la sécurité technique, pas l'UX ni la doctrine. Le contrôle
doctrinal reste `scripts/check-doctrine.ts` + revue manuelle.
