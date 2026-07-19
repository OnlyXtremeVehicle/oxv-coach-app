# SEC-1 — Mutations prod à approuver (chantier 5 : actions 2/3/4/8)

> Préparé le 2026-07-19, inspection MCP lecture seule du projet
> `fouvuqkdxarjpjbqnsjq`. **RIEN n'a été appliqué.** Chaque étape ci-dessous
> attend l'approbation et l'exécution du fondateur, dans l'ordre.
> Les migrations vivent dans `supabase/migrations/20260719*_sec1_*.sql`
> (en-tête « PRÉPARÉE, NON APPLIQUÉE » — à retirer au moment de l'application).

---

## Ordre d'application

### Étape 1 — Redeploy edge `notify-pilot-coach-assigned` avec `verify_jwt=true`

- État vérifié en prod : `verify_jwt=false` (fail-open, risque HAUTE du bilan).
- Commande : `supabase functions deploy notify-pilot-coach-assigned --no-verify-jwt=false`
  (ou depuis le dashboard : Functions → notify-pilot-coach-assigned → Enforce JWT).
- Avant : vérifier l'appelant réel (trigger/edge interne → service_role, qui
  porte un JWT valide : rien ne casse). Test après : appel anonyme → **401**.
- Rollback : redeploy sans enforce JWT.

### Étape 2 — Redeploy edge `notify-coach-consent-received` avec `verify_jwt=true`

- Identique à l'étape 1 (`verify_jwt=false` vérifié en prod). Test : anonyme → 401.

### Étape 3 — Migration `20260719120000_sec1_a_views.sql` (vues DEFINER)

- Les 8 vues ERROR advisors passent en `security_invoker=true` et lisent
  chacune une fonction SECURITY DEFINER STABLE à `search_path` épinglé
  (`<vue>_rows()`), EXECUTE limité aux rôles lecteurs actuels.
- **Pourquoi pas invoker pur** : aucune policy `anon` sur les tables
  sous-jacentes, policies `authenticated` own/admin → les vues se videraient
  pour le site (clé anon) et la TV Pavillon.
- Droits conservés à l'identique : 7 vues lisibles anon+authenticated,
  `pavillon_pilotes_jour` reste authenticated+service_role SANS anon.
- Hygiène : suppression des GRANTs INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/
  REFERENCES aberrants d'anon/authenticated sur les vues → SELECT seul.
- **À vérifier juste après** (10 min) :
  - site oxvehicle.fr déconnecté : calendrier (sessions_public +
    session_availability), témoignages, plateau, compteur QDI, équipages ;
  - écran TV Pavillon : pilotes du jour + météo ;
  - **selects imbriqués PostgREST** : si le site fait
    `registrations?select=...,sessions_public(...)` (embed), cela casse —
    rollback de la vue concernée (définitions d'origine en Annexe A).
- Rollback (par vue, indépendant) : recréer la vue d'origine (Annexe A) puis
  `drop function public.<vue>_rows();`.

### Étape 4 — Migration `20260719121000_sec1_b_pii.sql` (PII privatisation)

- Constat : la policy `sessions_select_authenticated` est DÉJÀ
  `is_admin() OR is_private IS NOT TRUE` (le « résidu assumé » du bilan n'est
  plus l'état de prod) ; 0 session privée, 0 PII en base aujourd'hui.
- La migration ajoute la contrainte `sessions_private_client_pii_only_private`
  (PII uniquement sur lignes privées, elles-mêmes admin-only) + active la RLS
  sur `_backup_sessions_20260719`.
- Lecture admin des PII : RPC `get_session_private_client` (existe, gardée
  `is_admin()`). L'« intéressé » (client privatisation) n'a pas de compte →
  admin-only par construction.
- **Décision fondateur en plus** : `DROP TABLE public._backup_sessions_20260719;`
  (44 lignes avec colonnes PII, créée le 19/07 — à supprimer quand son utilité
  est passée ; ligne fournie commentée dans la migration).
- Rollback : `DROP CONSTRAINT sessions_private_client_pii_only_private`.

### Étape 5 — Migration `20260719122000_sec1_c_payout.sql` (IBAN coach)

- Crée `coach_payout_details` (iban/bic/account_holder), RLS owner+admin,
  aucun GRANT anon. **Aucune donnée à migrer** (payment_link : 0 valeur en
  prod, vérifié).
- Côté repo (déjà commité dans ce lot) : `coachBillingService` refuse toute
  valeur non-URL (dont IBAN) dans `payment_link` — le champ publié ne peut
  plus servir de fourre-tout bancaire.
- Rollback : `DROP TABLE public.coach_payout_details;`.

### Étape 6 — Migration `20260719123000_sec1_d_search_path.sql` (fonctions)

- `search_path=''` sur les 2 fonctions WARN (`email_templates_touch`,
  `set_pavilion_optin_at` — triggers sans accès table, sans risque).
- Vérifié : **toutes** les fonctions DEFINER de `public` ont déjà un
  search_path épinglé (aucune avec `proconfig IS NULL`).
- REVOKE anon (avec re-grant authenticated/service*role explicite) sur 9
  DEFINER sensibles sans usage anonyme : `admin_validate_inscription`,
  `pilot_sessions_for_coach`, `pilot_sheet_for_coach`, `measure_metric_now`,
  `objective_progress_for_pilot`, `ping_attendees` + 3 fonctions gate de
  trigger. Conservées anon (usages légitimes documentés dans la migration) :
  `oxv_founding_count` (compteur landing), `get_shared_progression(_values)`
  (lien public par token), `coach_public_card`, et les helpers `is*\*`référencés
par des policies à rôle`{public}`.
- Rollback : `GRANT EXECUTE ... TO anon` par fonction.

### Étape 7 — Migration `20260719124000_sec1_e_storage.sql` (storage incidents)

- Recrée `pilot_media_select` : le coach ne lit plus
  `pilot-media/{uid}/incidents/**` (pilote + admin seulement) ; le reste de
  `pilot-media` inchangé. Écritures déjà owner-only (rien à changer).
- Test après : compte coach → liste des médias d'un pilote OK, un objet sous
  `incidents/` → 403/objet absent.
- Rollback : recréer la policy d'origine (Annexe B).

### Étape 8 — Relancer les advisors + régénérer les types

- `get_advisors(security)` attendu : **0 ERROR** (les 8 `security_definer_view`
  disparaissent), WARN `function_search_path_mutable` : 0.
- WARN attendus restants (assumés/documentés) :
  - `anon_security_definer_function_executable` : les 7 nouvelles `*_rows()`
    accessibles anon (c'est le canal voulu du site), + celles conservées
    (founding_count, shared_progression, coach_public_card, helpers policies) ;
  - `public_bucket_allows_listing` coach-media / partner-media (vitrines
    publiques du site, par design) ;
  - `rls_policy_always_true` corporate_leads (hors périmètre SEC-1 chantier 5 —
    à traiter dans un lot dédié) ;
  - INFO `rls_enabled_no_policy` : `app_pairing_redeem_attempts`,
    `invoice_counters` (RLS deny-all volontaire).
- `supabase gen types typescript` → rafraîchir `src/types/database.types.ts`
  (les 8 fonctions `*_rows()` + `coach_payout_details` apparaissent ; les vues
  gardent les mêmes colonnes).

---

## Annexe A — Définitions d'origine des 8 vues (rollback)

Relevées en prod le 2026-07-19 (`pg_get_viewdef`). Recréer avec
`CREATE OR REPLACE VIEW public.<nom> AS ...` puis
`ALTER VIEW public.<nom> RESET (security_invoker);`.

```sql
-- sessions_public
SELECT s.id, s.date, s.start_time, s.end_time, s.format, s.season_type,
       s.status, s.weather_status, s.is_private, s.max_capacity,
       s.capacity_access, s.capacity_morning, s.capacity_afternoon,
       s.capacity_promotion, s.capacity_signature, s.available_offers,
       s.notes, s.created_at, s.circuit_id, c.name AS circuit_name
FROM sessions s LEFT JOIN circuits c ON c.id = s.circuit_id
WHERE s.is_private IS NOT TRUE;

-- session_availability
SELECT s.id AS session_id,
       count(r.id) FILTER (WHERE r.status <> 'cancelled') AS taken_total,
       count(r.id) FILTER (WHERE r.status <> 'cancelled' AND r.offer_type = 'access') AS taken_access,
       count(r.id) FILTER (WHERE r.status <> 'cancelled' AND r.offer_type = 'signature') AS taken_signature,
       count(r.id) FILTER (WHERE r.status <> 'cancelled' AND r.offer_type = 'promotion') AS taken_promotion,
       count(r.id) FILTER (WHERE r.status <> 'cancelled' AND r.offer_type = 'heritage') AS taken_heritage
FROM sessions s LEFT JOIN registrations r ON r.session_id = s.id
WHERE s.is_private IS NOT TRUE GROUP BY s.id;
-- (casts d'enum omis pour lisibilité : registration_status_enum / offer_type_enum)

-- qdi_public
SELECT CASE WHEN u.community_visibility = 'nominative'
            THEN COALESCE(NULLIF(u.public_handle, ''), u.first_name, 'Pilote OXV')
            ELSE 'Pilote OXV' END AS display_name,
       u.community_visibility = 'nominative' AS nominative,
       a.margin_global, a.margin_zone, a.computed_at, a.sessions_count
FROM users u
JOIN LATERAL (SELECT s.margin_global, s.margin_zone, s.computed_at,
                     (SELECT count(*) FROM app_session_analyses c
                       WHERE c.user_id = u.id AND c.margin_global IS NOT NULL) AS sessions_count
              FROM app_session_analyses s
              WHERE s.user_id = u.id AND s.margin_global IS NOT NULL
              ORDER BY s.computed_at DESC LIMIT 1) a ON true
WHERE u.community_visibility <> 'private' AND u.suspended_at IS NULL;

-- testimonials_public
SELECT COALESCE(NULLIF(u.public_handle, ''), u.first_name, 'Pilote OXV') AS display_name,
       f.rating, f.comment, s.date AS session_date
FROM session_feedback f
JOIN users u ON u.id = f.user_id
JOIN sessions s ON s.id = f.session_id
WHERE f.publish_ok = true AND f.published = true AND f.comment IS NOT NULL;

-- crews_public
SELECT c.name,
       count(*) FILTER (WHERE m.referral_validated OR m.role = 'captain') AS validated_members,
       c.created_at
FROM crews c JOIN crew_members m ON m.crew_id = c.id
WHERE c.name IS NOT NULL
GROUP BY c.id, c.name, c.created_at
HAVING count(*) FILTER (WHERE m.referral_validated OR m.role = 'captain') >= 20;

-- plateau_members_public
SELECT first_name, "left"(COALESCE(last_name, ''), 1) AS last_initial,
       address_city AS city
FROM users u
WHERE community_visibility = 'nominative' AND COALESCE(first_name, '') <> '';

-- pavillon_meteo
SELECT DISTINCT ON (session_id) session_id, captured_at, temperature_c,
       wind_speed_kmh, wind_direction_deg, precipitation_mm, weather_label
FROM weather_snapshots ws
WHERE captured_at::date = CURRENT_DATE
ORDER BY session_id, captured_at DESC;

-- pavillon_pilotes_jour (security_invoker=false explicite à l'origine)
SELECT u.id AS user_id, u.car_number, u.public_handle,
       CASE WHEN u.pavilion_name_optin
            THEN ((u.first_name || ' ') || "left"(u.last_name, 1)) || '.'
            ELSE NULL END AS display_name,
       (v.brand || ' ') || v.model AS vehicle_label,
       ts.id AS telemetry_session_id, ts.status AS session_status, ts.started_at
FROM telemetry_sessions ts
JOIN users u ON u.id = ts.user_id
LEFT JOIN vehicles v ON v.id = ts.vehicle_id
WHERE ts.started_at::date = CURRENT_DATE;
```

## Annexe B — Policy storage d'origine (rollback étape 7)

```sql
CREATE POLICY pilot_media_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pilot-media' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_coach_of(((storage.foldername(name))[1])::uuid)
    OR is_admin()
  )
);
```

## Annexe C — Recommandations hors approbation immédiate

1. **`pavillon_pilotes_jour.user_id`** : la TV n'a probablement pas besoin de
   l'UUID pilote. Après vérification du code du site : retirer la colonne
   (DROP + CREATE de la vue, colonnes ≠). Non inclus dans le lot A pour ne pas
   casser la TV à l'aveugle.
2. **`corporate_leads` (WARN rls_policy_always_true)** : policy permissive à
   revoir dans un lot dédié.
3. **Coordination site** : le dossier `supabase/_pending_site_coordination/`
   (migration SUPERSEDED de masquage colonne) peut être supprimé — la
   contrainte du lot B rend l'approche par REVOKE de colonnes inutile.
