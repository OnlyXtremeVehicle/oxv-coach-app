# Throttling des push notifications

> Empêche le spam : si une notif a déjà été envoyée à la même personne, pour la même source, du même type dans la dernière heure, la suivante est skippée silencieusement.

## Pourquoi

Scénario typique : un pilote enchaîne 5 sessions courtes dans la même heure (entre 2 manches d'un track day). Chaque analyse complétée déclenche une notif au coach via PR-O. Sans throttle : 5 notifs en 30 minutes pour le même coach = irritation, possibly désabonnement.

Solution : table `notif_throttle_log` + fonction `should_send_notif()` qui check + insert atomique.

## Architecture

```
Edge Function notify-coach-session-analyzed reçoit le payload
        ↓
Pour chaque coach candidat :
   supabase.rpc('should_send_notif', {
     recipient: coachId,
     source: pilotId,
     notif: 'session_analyzed',
     window_seconds: 3600
   })
        ↓
Postgres function should_send_notif() :
   SELECT MAX(sent_at) FROM notif_throttle_log
   WHERE recipient = coachId AND source = pilotId AND type = 'session_analyzed'
        ↓
   Si dernière notif > 1h ago OU jamais → INSERT log + RETURN true
   Sinon → RETURN false
        ↓
Edge Function n'envoie qu'aux coachs où allowed === true
```

## Fenêtres de throttle actuelles

| Type de notif | Fenêtre | Justification |
| --- | --- | --- |
| `session_analyzed` | 1 h | Pilote peut enchaîner 5 manches en track day, 1 notif par heure suffit |
| `coach_annotation` | **15 min** | Si le coach annote 5 virages d'une même session d'affilée, on ne notifie qu'une fois. L'annotation reste visible dans l'écran virage à chaque ouverture |
| `friend_request` | **24 h** | Filet de sécurité contre un initiator qui révoquerait/recréerait sa demande. La contrainte UNIQUE(pilot_a, pilot_b) bloque déjà la plupart des cas |
| `coach_assigned` | Pas de throttle | Événement unique |
| `consent_received` | Pas de throttle | Événement unique |
| `friend_accepted` | Pas de throttle | Événement unique (réponse à une demande spécifique) |

À ajuster selon les retours alpha — typiquement on peut tester avec un throttle plus long (4h sur session_analyzed) si encore trop spammant.

## Activation

### 1. Appliquer la migration

```bash
supabase db push
# ou via Dashboard SQL Editor : coller migrations/0024_*.sql
```

### 2. Vérifier

```sql
-- La table et la fonction existent
SELECT relname FROM pg_class WHERE relname = 'notif_throttle_log';
SELECT proname FROM pg_proc WHERE proname = 'should_send_notif';

-- Test rapide
SELECT should_send_notif(
  'recipient-uuid'::UUID,
  'source-uuid'::UUID,
  'session_analyzed',
  3600
);
-- 1er appel : TRUE (et insert log)
-- 2e appel < 1h plus tard : FALSE
```

### 3. Re-déployer l'Edge Function

```bash
supabase functions deploy notify-coach-session-analyzed
```

Pas besoin de re-déployer `notify-pilot-coach-annotated` (pas de throttle sur les annotations).

## Cleanup périodique

La table peut grossir si on a beaucoup d'utilisateurs. Une fonction de purge est fournie :

```sql
SELECT cleanup_old_notif_logs();
-- Supprime les logs > 7 jours, renvoie le count
```

À planifier via pg_cron une fois par jour :

```sql
SELECT cron.schedule(
  'cleanup-notif-throttle-log',
  '0 3 * * *',  -- chaque jour à 3h du matin
  $$ SELECT cleanup_old_notif_logs(); $$
);
```

## Doctrine

- **Silencieux** : un coach qui est throttlé ne le sait pas. Il verra la nouvelle session dans son hub (PR-M dashboard) à sa prochaine ouverture.
- **Pas de throttle inter-pilotes** : si un coach suit 3 pilotes qui terminent tous une session, il reçoit bien 3 notifs (1 par pilote). Le throttle est par {coach, pilote, type}.
- **Best-effort** : si `should_send_notif` plante, l'Edge Function attrape l'exception et continue (la notif n'est pas envoyée mais l'analyse n'est pas bloquée).

## Évolution

Pour V2 : exposer la fenêtre dans les préférences coach (« recevez les notifs au max toutes les X heures »).
