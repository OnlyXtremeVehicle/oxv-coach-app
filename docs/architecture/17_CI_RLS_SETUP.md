# 17 — CI RLS : provision du projet de test et des secrets GitHub

> SEC-1 · ACTION 6 — procédure fondateur (~10 minutes).
> Depuis SEC-1, le job CI `tests RLS (projet Supabase de test)` est **fail-closed** :
> sans les secrets, il ÉCHOUE avec le message « Secrets CI RLS manquants — voir
> docs/architecture/17_CI_RLS_SETUP.md ». Fini le skip silencieux.

---

## Pourquoi

- **85 tests RLS** (17 suites, `src/__tests__/rls/`) vérifient que chaque rôle
  (pilote, coach, partenaire, admin) ne voit que ce qu'il doit voir. C'est le
  filet de sécurité RGPD du projet.
- Ils exigent une base Supabase **live** (création de comptes éphémères via
  l'API admin). Sans secrets, ils sont `describe.skip` — ils n'ont donc **jamais
  tourné en CI** jusqu'ici.
- Le job échoue désormais si les secrets manquent. Seule exception : PRs de
  forks et dependabot (GitHub n'injecte pas les secrets dans ces contextes) —
  skip **explicite et loggé** en warning, jamais silencieux.

## Coût

**0 €.** Un projet Supabase **Free** suffit (500 Mo, largement assez : les tests
créent puis suppriment quelques comptes `@oxv.test`). Créer le projet dans une
**organisation Free séparée** pour ne pas consommer le compute du plan Pro.

Note plan Free : un projet inactif ~1 semaine est mis en pause. La CI qui tourne
régulièrement le maintient actif ; s'il est en pause, bouton **Restore** dans le
dashboard (2 min) puis relancer le run.

## AVERTISSEMENT

> **Ne JAMAIS pointer ces secrets sur la prod (`fouvuqkdxarjpjbqnsjq`).**
> Les tests créent et **suppriment** des utilisateurs via la clé `service_role`
> (`DELETE FROM auth.users …`). Sur la prod, ce serait une perte de données
> clients. Avant de poser les secrets, vérifier deux fois que la ref dans
> `TEST_SUPABASE_URL` est celle du projet de TEST.

---

## Procédure (10 minutes)

### Pré-requis

- Supabase CLI (`supabase --version`) et `psql` (ou Docker pour `supabase db dump`).
- GitHub CLI authentifié (`gh auth status`).

### 1. Créer le projet Supabase de TEST (2 min)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New organization**
   (plan **Free**) → **New project**, nom `oxv-ci-rls-tests`, région `eu-west-1`
   (cohérence avec la prod). Noter le **mot de passe base de données**.
2. Une fois le projet créé, relever dans **Settings → API** :
   - **Project URL** : `https://<REF_TEST>.supabase.co`
   - **anon key**
   - **service_role key** (secret — ne jamais committer)

### 2. Répliquer le schéma prod sur le projet de TEST (4 min)

Voie recommandée : **dump du schéma prod (lecture seule)** puis restauration.
C'est fidèle au schéma réellement en production (policies comprises), ce qui est
exactement ce que les tests RLS doivent valider.

```bash
# 1) Dump schéma prod — LECTURE SEULE, ne modifie rien en prod
supabase db dump \
  --db-url "postgresql://postgres:<MDP_PROD>@db.fouvuqkdxarjpjbqnsjq.supabase.co:5432/postgres" \
  -f schema_prod.sql

# 2) Restauration sur le projet de TEST
psql "postgresql://postgres:<MDP_TEST>@db.<REF_TEST>.supabase.co:5432/postgres" \
  -f schema_prod.sql
```

Dépannage restauration :

- Erreurs sur `pg_cron` / `pg_net` / `vault` (triggers de notification) :
  activer d'abord les extensions dans le dashboard TEST (**Database →
  Extensions**) puis rejouer ; les erreurs résiduelles sur les jobs cron sont
  sans impact pour les tests RLS.
- Ne pas committer `schema_prod.sql` (il peut contenir des définitions
  sensibles) — le supprimer après usage.

Pourquoi pas `supabase db push` ? Les 108 fichiers de `supabase/migrations/`
mélangent deux nommages (`0007_*` et `20260524*`) : l'ordre lexicographique du
CLI ne correspond pas à l'ordre d'application réel en prod, et le push casse
sur les dépendances. Le dump évite le problème.

### 3. Poser les 3 secrets GitHub (2 min)

Les noms EXACTS lus par le harnais (`src/__tests__/rls/setup.ts`) et par
`.github/workflows/check.yml` :

```bash
gh secret set TEST_SUPABASE_URL         --repo OnlyXtremeVehicle/oxv-coach-app --body "https://<REF_TEST>.supabase.co"
gh secret set TEST_SUPABASE_ANON_KEY    --repo OnlyXtremeVehicle/oxv-coach-app --body "<anon key du projet TEST>"
gh secret set TEST_SUPABASE_SERVICE_KEY --repo OnlyXtremeVehicle/oxv-coach-app --body "<service_role key du projet TEST>"
```

Variante sans clé dans l'historique shell : omettre `--body`, la commande lit
la valeur au clavier (`gh secret set TEST_SUPABASE_SERVICE_KEY --repo …` puis
coller).

Vérifier :

```bash
gh secret list --repo OnlyXtremeVehicle/oxv-coach-app
# doit lister TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_KEY
```

### 4. Vérifier le run vert (2 min)

```bash
# Relancer le dernier run du workflow check (ou pousser un commit)
gh run list  --repo OnlyXtremeVehicle/oxv-coach-app --workflow=check.yml --limit 1
gh run rerun --repo OnlyXtremeVehicle/oxv-coach-app <RUN_ID>
gh run watch --repo OnlyXtremeVehicle/oxv-coach-app <RUN_ID>
```

Attendu : le job **`tests RLS (projet Supabase de test)`** est **vert** et son
log montre `Tests: 85 passed` (17 suites, 0 skipped). S'il est rouge avec
« Secrets CI RLS manquants », un des 3 secrets manque ou est mal nommé.

### 5. Rendre le job requis pour merger (1 min — à faire à la main)

Pour que le badge vert soit **exigé** avant tout merge de lot v2 :

GitHub → repo `oxv-coach-app` → **Settings → Branches → Branch protection
rules** → règle sur `main` (la créer si absente) → cocher **Require status
checks to pass before merging** → chercher et ajouter le check
**`tests RLS (projet Supabase de test)`** (il n'apparaît dans la liste qu'après
avoir tourné au moins une fois — faire l'étape 4 d'abord). Ajouter aussi
**`typecheck + lint + format`** tant qu'on y est.

Aucune commande ne fait ça à votre place ici : action dashboard volontairement
manuelle (elle change les règles de merge du repo).

---

## Récapitulatif du comportement CI

| Contexte                | Secrets                    | Résultat du job `rls`                                                                    |
| ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| Push / PR interne       | présents                   | Tests RLS exécutés — leur échec **casse le build**                                       |
| Push / PR interne       | absents                    | **Job ROUGE** : « Secrets CI RLS manquants — voir docs/architecture/17_CI_RLS_SETUP.md » |
| PR de fork / dependabot | jamais injectés par GitHub | Skip **explicite** loggé en warning (jaune, jamais silencieux)                           |

## Entretien

- **Nettoyage** en cas de crash d'un run (comptes orphelins) — sur le projet de
  TEST uniquement :
  ```sql
  DELETE FROM auth.users WHERE email LIKE '%@oxv.test';
  ```
- **Après toute migration prod touchant RLS** : rejouer l'étape 2 (nouveau dump
  → restauration) pour que le projet de test reflète la prod, sinon les tests
  valident un schéma périmé.
- **Rotation** : si la `service_role` du projet TEST fuite, la régénérer dans le
  dashboard TEST et re-poser le secret (étape 3). Impact limité au projet de
  test — aucune donnée réelle.
- Exécution locale : voir `docs/TESTS_RLS_SETUP.md` (mêmes variables dans
  `.env.test.local`, `npm run test:rls`).
