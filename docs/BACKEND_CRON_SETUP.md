# Backend Cron Setup — Edge Functions périodiques

> Configurations cron à activer dans Supabase Dashboard pour les Edge Functions périodiques.
> Action manuelle (1 fois) — pg_cron + pg_net doivent être activés au préalable.

---

## 1. Activer les extensions Postgres (1 fois)

Dashboard Supabase → **Database** → **Extensions** :

- [ ] **pg_cron** : ON
- [ ] **pg_net** : ON

---

## 2. Configurer les secrets Edge Functions

Dashboard Supabase → **Project Settings** → **Edge Functions** → **Secrets** :

| Variable | Valeur | Utilisé par |
|---|---|---|
| `OPENAI_API_KEY` | `sk-proj-...` (votre clé OpenAI) | `generate-debrief-ai` |
| `CRON_TOKEN` | Token aléatoire (ex: `openssl rand -hex 32`) | `cron-analyze-pending-sessions` |
| `RESEND_API_KEY` | Déjà configuré (pour Resend OXV web) | `send-coach-invitation` |
| `SUPABASE_URL` | Auto-set par Supabase | toutes |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set par Supabase | toutes |

---

## 3. Cron : analyse de rattrapage (toutes les heures)

Dashboard Supabase → **SQL Editor** → exécuter :

```sql
-- Schedule : toutes les heures à la minute 0
SELECT cron.schedule(
  'analyze-pending-sessions',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/cron-analyze-pending-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Token', current_setting('app.cron_token', true)
    )
  );
  $$
);
```

⚠️ **Avant de lancer ce SQL**, posez le secret `app.cron_token` :

```sql
ALTER DATABASE postgres SET app.cron_token = 'votre-token-secret-aléatoire';
SELECT pg_reload_conf();
```

Le token doit être **identique** au `CRON_TOKEN` configuré dans les secrets Edge Functions (voir étape 2).

---

## 4. Vérifier que le cron tourne

```sql
SELECT * FROM cron.job;
-- Doit afficher analyze-pending-sessions

SELECT * FROM cron.job_run_details
WHERE jobname = 'analyze-pending-sessions'
ORDER BY start_time DESC
LIMIT 10;
-- Doit afficher des entrées toutes les heures
```

Pour voir les logs Edge Function :
- Dashboard → **Edge Functions** → `cron-analyze-pending-sessions` → onglet **Logs**

---

## 5. Désactiver / re-activer un cron

```sql
-- Désactiver temporairement
UPDATE cron.job SET active = false WHERE jobname = 'analyze-pending-sessions';

-- Re-activer
UPDATE cron.job SET active = true WHERE jobname = 'analyze-pending-sessions';

-- Supprimer définitivement
SELECT cron.unschedule('analyze-pending-sessions');
```

---

## 6. Test manuel d'une Edge Function

```bash
# Cron retry sessions (avec token)
curl -X POST 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/cron-analyze-pending-sessions' \
  -H 'X-Cron-Token: votre-token-secret-aléatoire'

# Generate debrief AI (avec auth JWT user)
curl -X POST 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/generate-debrief-ai' \
  -H 'Authorization: Bearer <jwt-utilisateur>' \
  -H 'Content-Type: application/json' \
  -d '{"sessionId": "abc-123"}'
```

---

## Edge Functions actives (récap)

| Slug | verify_jwt | Déclencheur | Fonction |
|---|---|---|---|
| `notify-pilot-coach-assigned` | ✅ | App admin après assignPilotToCoach | Push notif pilote |
| `notify-coach-consent-received` | ✅ | App pilote après giveConsent | Push notif coach |
| `send-coach-invitation` | ✅ | App admin bouton "Envoyer invitation" | Email Resend coach |
| `generate-debrief-ai` | ✅ | App après analyzeAndPersistSession | Debrief J+1 OpenAI |
| **`cron-analyze-pending-sessions`** | ❌ + token | **Cron toutes les heures** | Rattrapage marge globale |
| `ritual_dispatcher` | ❌ | Cron OXV web existant | Rituals (legacy OXV web) |
| `resend_webhook` | ❌ | Resend webhook OXV web | Status emails (legacy OXV web) |

---

— Setup backend OXV Coach, sem 16
