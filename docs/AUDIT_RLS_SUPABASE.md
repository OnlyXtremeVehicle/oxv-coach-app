# Audit RLS Supabase — post-distribution APK

**Date** : 25 mai 2026
**Contexte** : la clé `EXPO_PUBLIC_SUPABASE_ANON_KEY` est désormais dans le bundle APK distribuable EAS. Toute personne décompilant l'APK peut requêter Supabase avec cette clé. Les RLS sont la seule défense.

---

## Verdict global

**🟢 SAFE pour l'alpha** après migration `0014_security_hardening`.

Les 22 tables `public/` ont toutes RLS activé avec policies own-row strictes. Aucune donnée pilote n'est exposée à un attaquant qui aurait extrait la clé anon de l'APK.

---

## Résultats détaillés

### Tables (22) — toutes RLS activé

| Catégorie | Tables | État |
|---|---|---|
| Télémétrie pilote | `telemetry_sessions`, `telemetry_frames`, `laps` | Own-row strict via `auth.uid() = user_id` |
| Analyses pilote | `app_session_analyses`, `app_segment_analyses` | Own-row + admin (`is_admin()`) |
| Partages | `app_progression_shares` | Own-row + SELECT par token (intentionnel) |
| Profil | `users` | Own-row strict (3 doublons cosmétiques nettoyés) |
| Documents | `documents`, `media` | Own-row + admin |
| Admin | `admin_audit` | `is_admin()` uniquement |
| Public OXV | `contact_messages` | INSERT public (intentionnel — formulaire web), voir Q ouverte ci-dessous |
| Métier OXV web | `sessions`, `registrations`, `payments`, `vehicles`, `heritage_packs`, `pricing`, `circuits` | RLS own-row + admin |
| Système OXV web | `ritual_dispatches`, `email_log`, `resend_events`, `weather_snapshots` | Admin/system |

### Storage buckets (5 restants après cleanup)

| Bucket | Public | Policies | État |
|---|---|---|---|
| `telemetry_raw` | private | own-folder via `auth.uid()` | ✅ |
| `documents` | private | own-folder | ✅ |
| `vehicles` | private | own-folder | ✅ |
| `audio_briefings` | private | bloqué (`false`) | ✅ |
| `avatars` | **public** | URLs publiques OK, listing désactivé | ✅ |

**Bucket `telemetry-raw` (hyphen)** : legacy doublon vide, **à supprimer manuellement** via Dashboard (voir actions Gabin ci-dessous).

### Fonctions SECURITY DEFINER — REVOKE appliqué

| Fonction | anon | authenticated | service_role |
|---|---|---|---|
| `handle_new_user()` | ❌ | ❌ | ✅ |
| `update_session_best_lap()` | ❌ | ❌ | ✅ |
| `auto_generate_payment_reference()` | ❌ | ❌ | ✅ |
| `ritual_dispatches_set_updated_at()` | ❌ | ❌ | ✅ |
| `trigger_schedule_rituals()` | ❌ | ❌ | ✅ |
| `update_updated_at_column()` | ❌ | ❌ | ✅ |
| `generate_oxv_reference()` | ❌ | ❌ | ✅ |
| `schedule_rituals_for_registration(uuid)` | ❌ | ❌ | ✅ |
| `cancel_pending_rituals_for_registration(uuid)` | ❌ | ❌ | ✅ |
| `apply_resend_event(...)` | ❌ | ❌ | ✅ |
| `admin_ritual_stats(integer)` | ❌ | ✅ (avec check `is_admin()` interne) | ✅ |
| `is_admin()` | ❌ | ✅ (helper client mobile) | ✅ |

**Subtilité Postgres** : par défaut les fonctions sont `GRANT EXECUTE TO PUBLIC`. Le premier REVOKE FROM anon/authenticated n'a rien fait — il fallait `REVOKE FROM PUBLIC` explicitement. Migration corrective appliquée.

**Note advisor** : Supabase advisor flag toujours ces fonctions comme `anon_security_definer_function_executable` car il scanne le bit `SECURITY DEFINER` sans regarder les grants. Les warnings sont **cosmétiques** — l'accès réel est bloqué (vérifié via `has_function_privilege`).

### Vues SECURITY DEFINER → INVOKER

| Vue | Avant | Après |
|---|---|---|
| `stats_dashboard` | DEFINER (bypass RLS) | INVOKER (respecte RLS amont) |
| `admin_ritual_dispatches_view` | DEFINER (bypass RLS) | INVOKER (respecte RLS amont) |

Avec INVOKER, ces vues respectent les RLS des tables sous-jacentes (`users`, `sessions`, `payments`, etc.) qui ont déjà des policies `is_admin() OR ...`. Donc :
- **Anon** : 0 partout (bloqué par RLS amont)
- **Pilote authenticated** : voit ses propres stats (inoffensif)
- **Admin authenticated** : voit tout (grâce aux policies `is_admin()` sur les tables source)

### Fonctions `search_path` — fixé

13 fonctions ont reçu `SET search_path = public, pg_temp` pour prévenir l'injection via détournement du search_path.

### Doublons policies users — nettoyés

7 policies redondantes supprimées sur `users` (variantes V1 historique + sem 8 intermédiaires). Restent les versions finales `users_*_own_or_admin` qui couvrent tous les cas.

---

## Actions restantes pour Gabin

### 1. Supprimer le bucket legacy `telemetry-raw` (hyphen)

Supabase bloque les `DELETE FROM storage.buckets` via SQL (sécurité). Action manuelle :

1. Dashboard Supabase → Storage → onglet Buckets
2. Localiser `telemetry-raw` (avec hyphen, vide, doublon de `telemetry_raw`)
3. Cliquer les 3 points → Delete bucket

Les policies sont déjà supprimées via la migration. Le bucket est vide.

### 2. Activer "Leaked Password Protection"

Dashboard Supabase → Authentication → Policies → Auth Configuration :
- Toggle **"Leaked password protection"** ON
- Active la vérification contre HaveIBeenPwned au signup et password change

### 3. (Optionnel) Documenter / rate-limit `contact_messages_insert_public`

La policy `INSERT WITH CHECK (true)` sur `contact_messages` permet à n'importe quel anon d'insérer un message. C'est **intentionnel** pour le formulaire de contact sur `oxvehicle.fr`, mais sans rate-limit, exposé au spam.

Options :
- Garder tel quel (forme de contact ouvert, modération manuelle)
- Ajouter un rate-limit Edge Function (1 message / IP / heure)
- Migrer vers une Edge Function avec captcha

À votre choix selon le volume de spam observé.

---

## Questions ouvertes (Q43-Q45)

### Q43 — Migration 2 instances Supabase (preview/prod) ?

Actuellement 1 seule instance `fouvuqkdxarjpjbqnsjq` pour preview ET production. Pour V1 alpha c'est OK (les alpha-pilotes peuvent vivre avec une seule DB). Dès la beta ouverte, séparation recommandée pour éviter qu'un bug preview corrompe les données prod.

### Q44 — Stockage des tokens device push

Sem 13 j'ai ajouté `users.expo_push_token`. Ces tokens permettent à un attaquant ayant la clé anon de spammer les pilotes via Expo Push API ? Non, parce que **Expo Push API requiert le token PLUS l'accord du device receveur**. Le token seul est inutile sans le device. Safe.

### Q45 — Rotation périodique des clés ?

L'`anon_key` actuelle a une expiration en 2096 (JWT signed). En cas de fuite massive, rotation possible via Dashboard → Settings → API → Reset Project API Keys. Tout APK distribué cesse de fonctionner jusqu'à un rebuild.

**Procédure d'urgence** :
1. Reset anon_key dans Dashboard
2. Mettre à jour `.env` local + EAS Secret `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Rebuilder l'APK : `eas build --profile production`
4. Notifier les pilotes alpha pour update via TestFlight / nouveau .apk

À documenter dans un runbook incidents si vous avez du temps.

---

## Re-run advisors (état après migration)

**Erreurs** : ✅ **0** (étaient 2 avant : security_definer_view sur stats_dashboard et admin_ritual_dispatches_view)

**Warnings restants** :
- 16 × `security_definer_function_executable` — **cosmétiques** (bit SECURITY DEFINER présent mais REVOKE effectif, vérifié)
- 1 × `rls_policy_always_true` sur `contact_messages_insert_public` — **intentionnel** (formulaire web)
- 1 × `auth_leaked_password_protection` — **action Gabin** (toggle Dashboard)

---

## Conclusion

L'app coach mobile peut être distribuée en alpha juillet 2026. Les données pilote sont protégées par les RLS, le bucket télémétrie est private own-folder, les fonctions sensibles sont accessibles uniquement par `service_role` (backend OXV web).

Les 2 actions manuelles restantes (supprimer bucket legacy + activer leaked password protection) prennent **5 minutes au total** dans le Dashboard.

— Claude Code, audit sem 14
