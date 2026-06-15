# purge-deleted-accounts — droit à l'effacement RGPD (art. 17)

> **⚠️ DRAFT — NON DÉPLOYÉ.** Cette fonction **supprime des données utilisateur de
> façon irréversible**. À **valider juridiquement** et à **tester sur une branche
> Supabase de dev** (données de seed) avant tout déploiement en production.

## Ce qu'elle fait

Pour chaque compte dont la demande de suppression a passé le délai de grâce de
30 jours (`deletion_scheduled_at <= now()`), elle applique une stratégie
**anonymiser-et-purger** (et non un hard-delete, car `payments.user_id` est
`NO ACTION` → la facturation est légalement conservée et bloquerait un `DELETE`
de la ligne `users`) :

1. Supprime les **données personnelles** (télémétrie → cascade frames/laps/météo,
   véhicules, documents, analyses, partages, circuits perso, données coach,
   amitiés, objectifs, médias pilote, push).
2. Supprime les **objets Storage** du pilote (buckets `vehicles`, `documents`,
   `avatars`, `audio_briefings`), par préfixe `userId/`.
3. **Scrubbe le PII** de la ligne `users` (email → `deleted-<id>@oxv.invalid` ;
   noms, adresse, contacts d'urgence, **données médicales**, handle, avatar →
   null). La ligne reste pour le lien facturation.
4. **Anonymise + bannit** l'utilisateur Auth (empêche la reconnexion).

Idempotente : un compte déjà purgé (email = placeholder) est ignoré aux runs
suivants.

## Points à trancher AVANT déploiement (juridique + produit)

- **Conservés (facturation)** : `payments`, `registrations`, `stripe_customer_id`.
  Confirmer la durée de rétention et l'**effacement côté Stripe** (appel API
  séparé, non couvert ici).
- **`medical_notes` / `blood_type`** : données de santé → scrub confirmé.
- **`email_log`** : garde les emails envoyés (PII résiduel) → suppression vs
  rétention pour audit de délivrabilité ?
- Revoir **`PERSONAL_TABLES`** de façon exhaustive à chaque nouvelle table
  portant de la donnée personnelle.

## Déploiement (quand validé)

1. **Secret d'invocation interne** (si pas déjà en Vault, comme les `notify-*`) :
   ```sql
   select vault.create_secret('<secret-aléatoire-long>', 'edge_functions_invoke_secret');
   ```
2. **Déployer** la fonction avec `verify_jwt = false` (auto-auth par secret) :
   ```bash
   supabase functions deploy purge-deleted-accounts --no-verify-jwt
   ```
   Variables requises (déjà présentes sur un projet Supabase standard) :
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, et `EDGE_FUNCTIONS_INVOKE_SECRET`
   (= le secret ci-dessus).
3. **Tester d'abord sur une branche de dev** avec des comptes de seed marqués
   `deletion_scheduled_at` dans le passé. Vérifier par rôle que rien d'autre
   n'est touché et que `payments` subsiste.
4. **Planifier le cron** (via `apply_migration`, **uniquement après** déploiement
   + validation) :
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

`src/services/accountService.ts` pose déjà la demande (`deletion_requested_at` +
`deletion_scheduled_at` à J+30). Cette fonction est l'**effacement réel** que ce
service annonce mais qui n'existait pas — d'où l'infraction actuelle à l'art. 17.
