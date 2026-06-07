# Runbook de déploiement — migrations 0027 → 0040, bucket, Edge Functions

> Procédure pas-à-pas pour mettre en production le travail de juin 2026.
> **À exécuter par Gabin** (modifie la base de production `fouvuqkdxarjpjbqnsjq`).
> Ordre important. Lis tout une fois avant de commencer.

---

## ⚠️ Règles de sécurité (non négociables)

- Ne **jamais** committer `.env`, une `service_role` ou une vraie clé API.
- La `service_role` reste **serveur uniquement** (Edge Functions / Vault), jamais côté client.
- Stocke les secrets dans un gestionnaire (1Password / Bitwarden), pas dans un message.
- La clé Google Maps doit être **restreinte** (package `fr.oxvehicle.app` + empreinte SHA-1).

---

## 0. Prérequis

```bash
# Supabase CLI installé et à jour
supabase --version            # >= 1.180

# Se placer dans le repo
cd oxv-app

# Lier le projet de prod (une seule fois ; demande le mot de passe DB)
supabase link --project-ref fouvuqkdxarjpjbqnsjq
```

---

## 1. Vérifier l'état réel de la base AVANT de pousser

But : savoir quelles migrations sont déjà appliquées, pour ne rien rejouer.

```bash
supabase migration list
```

Tu obtiens deux colonnes (Local / Remote). Les migrations déjà appliquées en
prod ont une date côté **Remote**. Normalement, **0027 → 0040 sont absentes
côté Remote** (ce sont les nouvelles). Si une migration ancienne (0001-0026)
apparaît « Local mais pas Remote » alors qu'elle est en réalité appliquée, **ne
force pas** : on bascule sur l'application manuelle (§2 bis).

> 💾 **Sauvegarde** : Dashboard Supabase → Database → Backups → vérifie qu'un
> backup récent existe (ou déclenche-en un) avant toute migration.

---

## 2. Appliquer les migrations 0027 → 0040 (voie recommandée)

Si `migration list` est propre (seules 0027→0040 sont à appliquer) :

```bash
supabase db push
```

`db push` applique **uniquement les migrations non encore enregistrées**, dans
l'ordre des timestamps. Les 14 nouvelles, dans l'ordre :

| # | Fichier | Contenu |
|---|---------|---------|
| 0027 | `..._0027_pilot_friendships.sql` | Amis pilotes + `are_friends()` |
| 0028 | `..._0028_pilot_friendships_notify_triggers.sql` | Triggers notif amis |
| 0029 | `..._0029_notif_throttle_log_add_friend_request.sql` | Throttle `friend_request` |
| 0030 | `..._0030_friendship_extend_segment_analyses.sql` | RLS segments pour amis |
| 0031 | `..._0031_session_media.sql` | Table `session_media` + Storage RLS |
| 0032 | `..._0032_coach_permissions.sql` | Permissions modulaires coach |
| 0033 | `..._0033_social_pings.sql` | Pings carte sociale + `is_validated_member()` |
| 0034 | `..._0034_coach_roulages.sql` | Roulages + `is_coach()` |
| 0035 | `..._0035_roulage_price.sql` | Prix/place sur roulages |
| 0036 | `..._0036_circuit_services.sql` | Carte écosystème (services circuits) |
| 0037 | `..._0037_coach_session_context.sql` | Contexte coach par session |
| 0038 | `..._0038_coach_corner_references.sql` | Repères coach + `is_my_coach()` |
| 0039 | `..._0039_coach_curation_templates.sql` | Priorisation bilan + gabarits |
| 0040 | `..._0040_coach_reading_weights.sql` | « La lecture de votre coach » |

Vérifie ensuite :

```bash
supabase migration list      # 0027→0040 doivent apparaître côté Remote
```

### 2 bis. Repli manuel (si `db push` refuse / historique désynchronisé)

Dans le Dashboard → **SQL Editor**, ouvre et exécute **chaque fichier dans
l'ordre 0027 → 0040** (copier-coller le contenu, Run, vérifier « Success »).
Les migrations sont idempotentes (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`),
donc une ré-exécution accidentelle ne casse rien.

---

## 3. Créer le bucket Storage `session-media`

La migration 0031 pose les **RLS Storage** mais **ne crée pas le bucket**.
Dashboard → **Storage → New bucket** :

- **Name** : `session-media`
- **Public** : ❌ non (privé)
- **File size limit** : `50 MB`
- **Allowed MIME types** : `image/jpeg, image/png, image/heic, video/mp4`

(Convention de chemin gérée par l'app : `{pilot_user_id}/{session_id}/{media_id}.{ext}`.)

---

## 4. Secrets Vault (pour les triggers de notification)

Les triggers DB (amis, annotations, session analysée) appellent les Edge
Functions via `pg_net` en lisant deux secrets dans le **Vault**
(`oxv_get_secret`). Dashboard → **Database → Vault → New secret** :

| Nom du secret | Valeur |
|---------------|--------|
| `edge_functions_base_url` | `https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1` |
| `edge_functions_invoke_secret` | un jeton long aléatoire (le même que `CRON_TOKEN` ci-dessous, ou un secret dédié partagé avec les functions) |

> Sans ces secrets, les triggers ne plantent pas la transaction (best-effort),
> mais aucune notification push ne partira.

---

## 5. Déployer les Edge Functions

9 functions à déployer :

```bash
supabase functions deploy generate-debrief-ai
supabase functions deploy cron-analyze-pending-sessions
supabase functions deploy send-coach-invitation
supabase functions deploy notify-coach-consent-received
supabase functions deploy notify-coach-session-analyzed
supabase functions deploy notify-pilot-coach-annotated
supabase functions deploy notify-pilot-coach-assigned
supabase functions deploy notify-pilot-friend-accepted
supabase functions deploy notify-pilot-friend-request
```

(ou tout d'un coup : `supabase functions deploy` sans argument.)

### Secrets des Edge Functions

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont **injectés automatiquement**
par Supabase dans le runtime Edge — **ne pas les redéfinir**. À fournir
manuellement :

```bash
supabase secrets set OPENAI_API_KEY=sk-...        # debrief IA (generate-debrief-ai)
supabase secrets set RESEND_API_KEY=re_...        # email invitation coach
supabase secrets set CRON_TOKEN=<jeton-long>      # protège le cron + invoke triggers
```

> Le `CRON_TOKEN` doit correspondre au `edge_functions_invoke_secret` du Vault
> (§4) si tu utilises le même jeton pour authentifier les appels trigger→function.

### Cron (cron-analyze-pending-sessions)

Planifier l'appel (Dashboard → Database → Cron, ou `pg_cron`) — ex. toutes les
15 min, en passant l'en-tête `Authorization: Bearer <CRON_TOKEN>`.

---

## 6. Vérifications post-migration

```bash
# Conseils sécurité/perf automatiques (RLS manquantes, index, etc.)
# Dashboard → Advisors, ou via MCP get_advisors.
```

Checklist rapide en SQL Editor :

```sql
-- Les nouvelles tables existent et ont la RLS activée
select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in (
    'pilot_friendships','session_media','coach_permissions','social_pings',
    'coach_roulages','roulage_invitations','circuit_services',
    'coach_session_context','coach_corner_reference','coach_pilot_highlight',
    'coach_annotation_template','coach_reading_weights'
  )
order by tablename;
-- rowsecurity doit être 'true' partout.

-- Les helpers RLS existent
select proname from pg_proc
where proname in ('is_coach','is_my_coach','is_validated_member',
                  'coach_has_permission','are_friends');
```

---

## 7. Configuration de l'app (avant build EAS)

- **Google Maps Android** : remplacer `REPLACE_WITH_GOOGLE_MAPS_ANDROID_API_KEY`
  dans `app.json` (`android.config.googleMaps.apiKey`).
  - ⚠️ Ne commite pas la vraie clé. Préfère l'injecter via `app.config.ts` +
    variable d'env EAS, et **restreins** la clé (package + SHA-1).
  - iOS utilise Apple Maps (`PROVIDER_DEFAULT`) → aucune clé requise.
- **Plausible** : définir `EXPO_PUBLIC_PLAUSIBLE_DOMAIN=oxvehicle.fr` (ou le
  domaine choisi) dans l'environnement de build EAS. Vide = analytics off.

---

## 8. Activer les permissions coach (au cas par cas)

Une ligne `coach_permissions` est créée automatiquement à la promotion d'un
coach (trigger), avec seulement `can_view_pilots = true`. Pour ouvrir les
features avancées à un coach précis, en SQL Editor :

```sql
update public.coach_permissions
set can_manage_own_sessions = true,        -- roulages
    can_view_business_dashboard = true     -- tableau de bord business
where user_id = '<uuid_du_coach>';
```

(`is_coach()`, `is_my_coach()`, les repères/gabarits/lecture ne dépendent **pas**
de ces permissions — ils sont ouverts à tout coach. Seuls roulages et dashboard
sont gatés.)

---

## 9. Données à saisir (back-office / app coach)

- **§8 écosystème** : renseigner les circuits (`circuits.is_official=true`,
  + `city`, `region`, `bbox_*` ou `finish_line_*` pour le placement carte) et
  les `circuit_services` (kind, nom, contacts). Démarrer Nouvelle-Aquitaine.
- **Carte sociale §7** : insérer des `social_pings` (admin only).
- **Coach** : chaque coach renseigne, depuis l'app, ses **repères** de virage,
  ses **priorités** par pilote, ses **gabarits**, et sa **lecture** (pondérations).

---

## 10. Ordre conseillé (résumé)

1. `supabase link` + backup
2. `supabase migration list` (vérif)
3. `supabase db push` (migrations 0027→0040)
4. Créer le bucket `session-media`
5. Vault : `edge_functions_base_url`, `edge_functions_invoke_secret`
6. `supabase functions deploy` + `supabase secrets set` (OpenAI, Resend, CRON)
7. Planifier le cron
8. Vérifs SQL (§6) + Advisors
9. Config app (Google Maps, Plausible) → build EAS
10. Activer permissions coach + saisir les données

---

## Rollback

- Chaque migration est additive (nouvelles tables / colonnes / policies). En cas
  de souci sur une table précise : `drop table public.<table> cascade;` retire
  la feature sans toucher à l'existant (les tables 0027→0040 sont indépendantes
  du cœur télémétrie).
- Restaurer un backup Dashboard reste l'option ultime.
