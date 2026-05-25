# Setup push notif annotations coach

> Notifie le pilote en push quand un coach laisse une note partagée sur un de ses virages.

## Architecture

```
Coach insère une coach_annotation (visibility='shared')
        ↓
Trigger Postgres coach_annotations_notify_trigger (migration 0021)
        ↓ (best-effort, n'empêche pas l'insert)
pg_net POST → Edge Function notify-pilot-coach-annotated
        ↓
Lookup users.expo_push_token du pilote
        ↓
POST https://exp.host/--/api/v2/push/send
        ↓
Push reçu sur l'iPhone du pilote
        ↓ (tap)
Deep-link → /(app)/virage?index=X&sessionId=Y
```

## Côté Gabin — actions requises pour activer

### 1. Déployer l'Edge Function

```bash
cd supabase
supabase functions deploy notify-pilot-coach-annotated
```

### 2. Vérifier les secrets Edge Functions

```bash
supabase secrets list
```

Doit contenir :
- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)

### 3. Appliquer la migration 0021

```bash
supabase db push
# Ou via Dashboard > SQL Editor → coller migrations/0021_*.sql
```

### 4. Configurer les secrets via Supabase Vault

⚠️ Supabase managed ne permet PAS `ALTER DATABASE postgres SET ...` (permissions superuser refusées au user `postgres` du Dashboard). On utilise donc le **Vault Supabase** — la convention officielle.

**Pré-requis** : la migration `0025_notif_triggers_use_vault.sql` doit être appliquée (elle patche les triggers pour lire le Vault).

Dans Supabase Dashboard > SQL Editor :

```sql
-- 1. Stocke l'URL des Edge Functions dans le Vault
SELECT vault.create_secret(
  'https://<TON-REF>.functions.supabase.co',
  'edge_functions_base_url',
  'URL de base des Edge Functions OXV'
);

-- 2. Optionnel : secret bearer pour authentifier les appels pg_net
-- (V1 alpha : on peut laisser tomber, l'URL Edge Function suffit)
SELECT vault.create_secret(
  gen_random_uuid()::text,
  'edge_functions_invoke_secret',
  'Secret bearer pour authentifier pg_net → Edge Functions'
);

-- 3. Vérification
SELECT name FROM vault.decrypted_secrets WHERE name LIKE 'edge_functions_%';
-- Doit lister edge_functions_base_url (et invoke_secret si créé)
```

### 5. Vérifier que pg_net est activé

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- Si vide : CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Test en local

Une fois la migration appliquée et l'Edge Function déployée :

1. Se connecter en tant que coach
2. Aller sur le détail d'un pilote suivi → tap sur une session → bouton « Détails par virage »
3. Tap sur « Annoter ce virage »
4. Écrire une note + « Partagée avec le pilote » + « Enregistrer »
5. Sur l'iPhone du pilote (connecté avec un compte ayant `expo_push_token` non-null), la notif devrait apparaître

## Vérification trigger

```sql
SELECT
  id, created_at, action, metadata
FROM admin_audit
WHERE action = 'coach_annotation_notified'
ORDER BY created_at DESC
LIMIT 10;
```

Chaque ligne contient :
- `user_id` : le coach
- `metadata.pilot_id` : le pilote notifié
- `metadata.annotation_id` : la note source
- `metadata.corner_index` : le virage
- `metadata.edge_request_id` : id de l'appel pg_net (pour debugger côté logs Edge Function)

## Doctrine

- **Visibility filter** : seules les annotations `visibility='shared'` déclenchent une notif. Les brouillons (`private`) restent silencieux.
- **Best-effort** : si l'Edge Function échoue ou si le pilote n'a pas de token, l'insert réussit quand même (le pilote verra la note la prochaine fois qu'il ouvre l'écran virage).
- **Audit RGPD** : chaque envoi est loggé dans `admin_audit` pour traçabilité.
- **Silencieux brouillon** : le coach peut rédiger en `private`, puis bascule en `shared` quand prêt → notif envoyée à ce moment-là.
- **Une notif par insert** : le toggle private → shared via UPDATE n'envoie pas de notif (trigger AFTER INSERT only). À ajouter si demandé.

## Évolutions possibles

- Trigger AFTER UPDATE quand `visibility` passe de `private` à `shared`
- Notif batchée si le coach annote 3+ virages en moins de 5 minutes (« 3 nouvelles notes »)
- Désactivation par le pilote via Settings (déjà toggle `push_notif_enabled` sur users)
