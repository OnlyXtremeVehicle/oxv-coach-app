# Setup push notif session analysée → coachs

> Notifie tous les coachs actifs+consentis d'un pilote en push quand une nouvelle analyse de session est complétée. Symétrique de la notif annotation coach → pilote (PR-J).

## Architecture

```
Pilote termine une session → analyzeTrackVizSession insère app_session_analyses
        ↓
Trigger Postgres session_analyses_notify_trigger (migration 0022)
        ↓ (best-effort)
pg_net POST → Edge Function notify-coach-session-analyzed
        ↓
Lookup coach_pilots WHERE pilot_id=X AND active=true AND pilot_consent_at IS NOT NULL
        ↓
Pour chaque coach : POST Expo Push API
        ↓
Push reçu sur l'iPhone du coach
        ↓ (tap)
Deep-link → /(coach)/pilote/[pilotId]
```

## Côté Gabin — actions requises

### 1. Déployer l'Edge Function

```bash
cd supabase
supabase functions deploy notify-coach-session-analyzed
```

### 2. Appliquer la migration 0022

```bash
supabase db push
# ou via Dashboard SQL Editor : coller migrations/0022_*.sql
```

### 3. Vérifier les variables Postgres

Les mêmes que pour PR-J (déjà configurées si PR-J est active) :

```sql
SELECT current_setting('app.edge_functions_base_url', true);
-- Doit renvoyer https://<ref>.functions.supabase.co
SELECT current_setting('app.edge_functions_invoke_secret', true);
-- Doit renvoyer un secret non vide
```

## Test end-to-end

1. Pilote (compte test A) termine une session sur RaceBox
2. `analyzeTrackVizSession` tourne (UBX → app_session_analyses)
3. Trigger Postgres fire → Edge Function
4. Tous les coachs assignés au pilote A (avec consentement actif) reçoivent une notif :
   - Titre : « Nouveau bilan de {prénom A} »
   - Corps : « {circuit} · marge X % »
5. Tap → ouvre `/(coach)/pilote/{pilotId}` — la nouvelle session est en tête de liste

## Vérification

```sql
SELECT id, created_at, action, payload
FROM admin_audit
WHERE action = 'session_analysis_notified'
ORDER BY created_at DESC
LIMIT 10;
```

Chaque ligne contient :
- `user_id` : le pilote
- `payload.analysis_id`
- `payload.telemetry_session_id`
- `payload.edge_request_id` (pour debugger côté logs Edge Function)

## Doctrine

- **Filtrage strict** : seuls les coachs `active=true` ET `pilot_consent_at IS NOT NULL` reçoivent la notif
- **Best-effort** : si l'envoi à un coach fail, les autres reçoivent quand même
- **Pas de notif au pilote** : c'est sa session, il sait qu'il vient de la terminer
- **Audit RGPD** : chaque envoi loggué pour traçabilité

## Évolutions possibles

- Throttling : ne notifier qu'une fois par heure max (si pilote enchaîne 10 sessions, ne pas spammer)
- Quiet hours coach : ne pas notifier entre 22h et 8h heure coach
- Préférence opt-out coach : table `coach_notif_preferences` (V2)
