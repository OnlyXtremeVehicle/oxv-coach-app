-- Durcissement sécurité post-distribution APK (audit RLS sem 14)
--
-- Contexte : la clé EXPO_PUBLIC_SUPABASE_ANON_KEY est désormais dans le
-- bundle APK distribuable. Toute personne décompilant peut requêter
-- Supabase avec cette clé. Les RLS sont la seule défense.
--
-- L'audit complet (advisors + scan policies) a confirmé que :
--   - Les 22 tables public/ ont RLS activé avec policies own-row
--   - Les buckets Storage sont private (sauf avatars, intentionnel)
--   - Toutes les données pilote sont protégées
--
-- Cette migration corrige les zones grises restantes :
--   1. 2 vues SECURITY DEFINER → INVOKER (bypassaient RLS)
--   2. 11 fonctions SECURITY DEFINER non-revoke (exposées via /rpc)
--   3. 12 fonctions sans search_path fixé (risque injection)
--   4. Bucket avatars : retire la policy de listing (les URLs publiques
--      restent fonctionnelles via bucket.public = true)
--   5. Bucket legacy telemetry-raw (hyphen) supprimé (vide, doublon de
--      telemetry_raw)
--   6. Doublons cosmétiques de policies sur users nettoyés

-- ============================================================================
-- 1. Vues SECURITY DEFINER → INVOKER
-- ============================================================================

-- stats_dashboard : dashboard admin OXV web. En INVOKER, respecte les
-- RLS des tables sous-jacentes (users, sessions, payments, etc.) qui
-- ont déjà des policies admin SELECT. Pour anon : 0 partout. Pour
-- pilote authenticated : voit ses propres stats (inoffensif).
ALTER VIEW public.stats_dashboard SET (security_invoker = on);

-- admin_ritual_dispatches_view : idem, restreint admin via RLS amont.
ALTER VIEW public.admin_ritual_dispatches_view SET (security_invoker = on);

-- ============================================================================
-- 2. REVOKE EXECUTE sur fonctions internes/admin
-- ============================================================================
-- IMPORTANT : sur Postgres, les fonctions sont GRANT EXECUTE TO PUBLIC par
-- défaut. Il faut REVOKE FROM PUBLIC (pas juste FROM anon, authenticated)
-- pour effectivement bloquer l'accès — sinon les rôles héritent via PUBLIC.

-- Triggers internes : 0 accès public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_session_best_lap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_generate_payment_reference() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ritual_dispatches_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_schedule_rituals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_oxv_reference() FROM PUBLIC, anon, authenticated;

-- Fonctions admin/system : accessible uniquement service_role (backend OXV web)
REVOKE EXECUTE ON FUNCTION public.schedule_rituals_for_registration(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_pending_rituals_for_registration(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_resend_event(uuid, text, timestamptz, text) FROM PUBLIC, anon, authenticated;

-- admin_ritual_stats : authenticated OK (panel admin web vérifie is_admin()
-- à l'intérieur), interdit à anon et PUBLIC.
REVOKE EXECUTE ON FUNCTION public.admin_ritual_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ritual_stats(integer) TO authenticated;

-- is_admin : authenticated OK (utile côté client mobile pour check rapide),
-- retire anon et PUBLIC.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- 3. SET search_path sur toutes les fonctions (anti-injection)
-- ============================================================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_session_best_lap() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_oxv_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_generate_payment_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.ritual_dispatches_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.schedule_rituals_for_registration(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_pending_rituals_for_registration(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_schedule_rituals() SET search_path = public, pg_temp;
ALTER FUNCTION public.apply_resend_event(uuid, text, timestamptz, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_ritual_stats(integer) SET search_path = public, pg_temp;

-- ============================================================================
-- 4. Bucket avatars : retirer la policy de listing
-- ============================================================================
-- Les URLs publiques /storage/v1/object/public/avatars/{path} continuent
-- de fonctionner grâce à bucket.public = true. Cette policy n'était
-- nécessaire que pour `supabase.storage.from('avatars').list()` côté JS,
-- ce que l'app ne fait pas.

DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

-- ============================================================================
-- 5. Bucket legacy telemetry-raw (hyphen) — supprimé
-- ============================================================================
-- Le code (src/services/telemetryStorage.ts) utilise 'telemetry_raw'
-- (underscore). Le bucket 'telemetry-raw' (hyphen) est un legacy vide.

DROP POLICY IF EXISTS "Users read own raw telemetry" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own raw telemetry" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'telemetry-raw';

-- ============================================================================
-- 6. Doublons cosmétiques policies users
-- ============================================================================
-- Trois variantes équivalentes existaient sur SELECT/INSERT/UPDATE :
--   * "Users can X own profile"  (V1 historique)
--   * "users_X"                  (sem 8)
--   * "users_X_own_or_admin"     (sem 8, version finale)
-- On garde la version "own_or_admin" qui couvre les besoins admin.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;

DROP POLICY IF EXISTS "users_delete" ON public.users;
