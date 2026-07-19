# purge-deleted-accounts — droit à l'effacement RGPD (art. 17)

> **État au 19/07/2026 (audit SEC-1 · Action 5)** :
> - **v4 est ACTIVE en prod** (`verify_jwt = false`, auto-auth par secret) mais
>   **AUCUN cron ne l'invoque** (`cron.job` vérifié) → la purge ne tourne pas.
> - **v5 = ce dossier** : PRÉPARÉE, **NON DÉPLOYÉE** — approbation fondateur
>   requise. Diff complet en tête d'`index.ts` ; audit exhaustif dans
>   `docs/architecture/14_PURGE_MATRIX.md`.
> - Dépend de la migration `supabase/migrations/20260719_sec1_purge_sante.sql`
>   (fonction `public.purge_user_data(uuid)`), elle aussi PRÉPARÉE NON APPLIQUÉE.

## Ce que fait la v5

Pour chaque compte dont la demande de suppression a passé le délai de grâce de
30 jours (`deletion_scheduled_at <= now()`), stratégie **anonymiser-et-purger**
(pas de hard-delete : `payments.user_id` est `NO ACTION`, la facturation est
légalement conservée) :

1. **Collecte** les références storage portées par la DB (audio des annotations
   coach dans `coach-audio/{annotationId}`, `media.file_url`) avant suppression.
2. Supprime les **objets Storage** de façon **récursive** sur 8 buckets préfixés
   `{userId}/` (`vehicles`, `documents`, `avatars`, `audio_briefings`,
   `pilot-media`, `session-media`, `telemetry_raw`, `coach-media`) + les objets
   `coach-audio` collectés. Fail-closed : un échec storage fait échouer le
   compte courant, retenté au run suivant. `invoices` est **conservé**.
3. Appelle **`rpc('purge_user_data')`** : purge + anonymisation DB
   **transactionnelles** (périmètre complet de la matrice, scrub PII + données
   de **santé** de la ligne `users`, email → `deleted-<id>@oxv.invalid`).
   Tables futures gérées par avance : `incident_reports` → **anonymisation
   seulement, jamais de purge** (`TODO_AVOCAT E5`) ; `biometry_raw` → purge.
4. **Anonymise + bannit** l'utilisateur Auth (empêche la reconnexion).

Idempotente : un compte déjà purgé (email = placeholder) est ignoré aux runs
suivants.

## Points restant à trancher (juridique + produit)

- **Conservés (facturation)** : `payments`, `registrations`, `invoices`,
  `subscriptions`, `stripe_customer_id`. Confirmer la durée de rétention et
  l'**effacement côté Stripe** (appel API séparé, non couvert ici).
- **`incident_reports`** (table à venir) : anonymisation + gel, durée de
  rétention à arbitrer — `TODO_AVOCAT E5`.
- Tables `_backup_sessions_20260719` / `_backup_registrations_20260719` :
  copies de PII hors purge → **DROP à faire approuver** séparément.
- Revoir la fonction `purge_user_data` à chaque nouvelle table portant de la
  donnée personnelle (la matrice `14_PURGE_MATRIX.md` fait foi).

## Déploiement (après approbation fondateur, dans CET ordre)

1. **Migration d'abord** (la fonction RPC doit exister avant l'edge) :
   `supabase/migrations/20260719_sec1_purge_sante.sql`.
2. **Secret d'invocation interne** (si pas déjà en Vault, comme les `notify-*`) :
   ```sql
   select vault.create_secret('<secret-aléatoire-long>', 'edge_functions_invoke_secret');
   ```
3. **Déployer** la fonction avec `verify_jwt = false` (auto-auth par secret) :
   ```bash
   supabase functions deploy purge-deleted-accounts --no-verify-jwt
   ```
   Variables requises : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `EDGE_FUNCTIONS_INVOKE_SECRET` (= le secret ci-dessus).
4. **Tester d'abord sur une branche de dev** avec des comptes de seed marqués
   `deletion_scheduled_at` dans le passé. Vérifier par rôle que rien d'autre
   n'est touché, que `payments`/`invoices` subsistent, et que les objets
   imbriqués `session-media/{uid}/{sessionId}/…` sont bien retirés.
5. **Planifier le cron** (absent en prod aujourd'hui — c'est le trou n°1) :
   ```sql
   select cron.schedule(
     'purge-deleted-accounts-daily',
     '30 2 * * *',
     $$
     select net.http_post(
       url := 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/purge-deleted-accounts',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                       where name = 'edge_functions_invoke_secret'),
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

## Lien avec l'app

`src/services/accountService.ts` pose la demande (`deletion_requested_at` +
`deletion_scheduled_at` à J+30). Cette fonction est l'**effacement réel** que ce
service annonce — sans cron planifié, la promesse n'est pas tenue aujourd'hui.
