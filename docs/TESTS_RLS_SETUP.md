# Tests RLS coach — Setup & exécution

> Tests d'intégration automatisés qui vérifient les Row-Level Security policies
> Supabase du périmètre coach (sessions, annotations).

## Objectif

Garantir qu'un coach ne peut PAS accéder aux données d'un pilote qu'il ne suit pas, et que la consentement du pilote est strictement respecté. Ces tests sont un **filet de sécurité RGPD** : ils tournent en CI à chaque PR qui touche aux RLS ou aux services coach.

## Architecture

```
src/__tests__/rls/
├── setup.ts                       ← helpers (createTestUser, assignCoachToPilot…)
├── coachSessionsRLS.test.ts       ← policies telemetry_sessions coach
└── coachAnnotationsRLS.test.ts    ← policies coach_annotations
```

Les tests utilisent **Jest** (déjà setup), pas Vitest, pour rester cohérents avec l'existant.

## Comportement par défaut : SKIP

Si les variables d'environnement Supabase test ne sont pas définies, les tests sont **skippés silencieusement** (via `describe.skip`) :

```
RLS — coach access to pilot sessions
  ↓
  (5 tests skipped — TEST_SUPABASE_URL manquant)
```

Cela permet à la CI standard de tourner sans avoir besoin de secrets Supabase.

## Activer les tests RLS

### 1. Créer une Supabase Branch de test

Sur le Dashboard Supabase du projet OXV :
1. Onglet **Branches** > **Create branch** > nommer `ci-rls-tests`
2. Cocher « copy data » non (on veut une DB vide)
3. Attendre que la branche soit prête (~30 s)

Récupérer côté UI :
- **Project URL** (ex `https://abcd1234.supabase.co`)
- **anon key** (Settings > API)
- **service_role key** (Settings > API — ⚠️ **SECRET**)

### 2. Appliquer les migrations sur la branche

```bash
# Avec supabase CLI lié à la branche ci-rls-tests
supabase link --project-ref <branch-ref>
supabase db push
```

Vérifier que les migrations 0016 (coach_pilots + RLS) et 0020 (coach_annotations) sont bien appliquées :

```sql
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

### 3. Définir les variables d'environnement

#### En local

Créer `.env.test.local` (NON commité, dans `.gitignore`) :

```bash
TEST_SUPABASE_URL=https://abcd1234.supabase.co
TEST_SUPABASE_ANON_KEY=eyJhbGc...
TEST_SUPABASE_SERVICE_KEY=eyJhbGc...
```

Lancer les tests :

```bash
# Source l'env puis lance Jest
set -a; source .env.test.local; set +a
npm test src/__tests__/rls
```

#### En CI GitHub Actions

Dans le repo GitHub :
1. **Settings > Secrets and variables > Actions**
2. Ajouter 3 secrets :
   - `TEST_SUPABASE_URL`
   - `TEST_SUPABASE_ANON_KEY`
   - `TEST_SUPABASE_SERVICE_KEY`

Le workflow CI lit automatiquement ces secrets et les expose à Jest via `env:` (voir `.github/workflows/ci.yml`).

## Scénarios couverts (12 tests)

### Sessions (5 tests)

- ✅ Coach non-assigné ne voit pas les sessions d'un pilote
- ✅ Coach assigné mais pilote **non-consentant** ne voit pas
- ✅ Coach assigné + pilote consentant VOIT les sessions
- ✅ Coach ne peut PAS UPDATE une session d'un pilote suivi
- ✅ Pilote autre ne voit pas les sessions d'un autre pilote

### Annotations (6 tests)

- ✅ Coach assigné peut INSERT une annotation partagée
- ✅ Coach non-assigné ne peut PAS INSERT (RLS WITH CHECK)
- ✅ Pilote voit les annotations `visibility='shared'` de ses coachs
- ✅ Pilote ne voit PAS les annotations `private` (brouillons)
- ✅ Pilote ne voit PAS les annotations soft-deleted
- ✅ Coach B ne voit pas les annotations du coach A sur le même pilote

## Précautions

- **Toujours utiliser une branch ci-rls-tests**, JAMAIS le projet de prod
- Les helpers `createTestUser` génèrent des emails uniques (`rls-test-<role>-<timestamp>@oxv.test`) pour éviter les collisions entre runs
- `cleanupTestUsers` est exécuté en `afterAll` même si un test fail (best-effort)
- Si un test crashe en plein milieu, certains users peuvent rester. Nettoyer manuellement :
  ```sql
  DELETE FROM auth.users WHERE email LIKE '%@oxv.test';
  ```

## Quand re-exécuter

Obligatoirement quand on modifie :
- Une migration de RLS (`supabase/migrations/00XX_*rls*.sql`)
- `is_coach_of()` ou autre fonction SECURITY DEFINER
- Le service coachAnnotationsService
- Le service coachService

Recommandé sur chaque PR touchant le périmètre coach (annotations, sessions, etc.).

## Note doctrine

Ces tests ne vérifient pas l'UX ou la doctrine, uniquement la sécurité technique. Le contrôle doctrinal reste manuel + le scanner `scripts/check-doctrine.ts`.
