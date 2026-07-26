-- ============================================================================
-- SEC-1 — PRÉPARÉE, NON APPLIQUÉE — approbation fondateur requise
-- ============================================================================
-- Lot A — Les 8 vues SECURITY DEFINER (advisors : 8 ERROR « security_definer_view »)
--
-- Constat prod (inspection 2026-07-19, lecture seule) :
--   - sessions_public, qdi_public, testimonials_public, crews_public,
--     session_availability, plateau_members_public, pavillon_meteo,
--     pavillon_pilotes_jour sont des vues DEFINER (pas de security_invoker).
--   - Les tables sous-jacentes (sessions, users, registrations, crews,
--     session_feedback, weather_snapshots, telemetry_sessions) n'ont AUCUNE
--     policy anon et des policies authenticated restreintes (own/admin).
--     → passer simplement security_invoker=true VIDERAIT ces vues pour leurs
--     lecteurs réels : le SITE oxvehicle.fr (calendrier public, témoignages,
--     compteurs — clé anon) et l'écran TV Pavillon. Aucun usage dans l'app
--     (grep src/ : seulement les types générés).
--   - GRANTS actuels aberrants : anon/authenticated ont INSERT/UPDATE/DELETE/
--     TRUNCATE/TRIGGER/REFERENCES sur les vues (sauf pavillon_pilotes_jour,
--     déjà limitée à authenticated SELECT).
--
-- Remède retenu (pattern « vue invoker + fonction DEFINER search_path figé ») :
--   chaque vue devient security_invoker=true et lit une fonction SECURITY
--   DEFINER STABLE à search_path épinglé qui porte la même requête. Résultat :
--   mêmes colonnes, mêmes lignes, mêmes lecteurs — mais plus aucune vue
--   DEFINER (advisors security_definer_view : 0 ERROR attendu) et un GRANT
--   minimal documenté par objet.
--
-- ⚠ RISQUE RÉSIDUEL À VÉRIFIER APRÈS APPLICATION (côté site) : PostgREST ne
--   saura plus « embarquer » ces vues dans des selects imbriqués
--   (ex. registrations?select=...,sessions_public(...)) car la vue ne référence
--   plus directement la table. Si le site utilise ce type d'embed, préférer le
--   rollback de la vue concernée (définitions d'origine en fin de fichier).
--
-- Rollback (une ligne par objet) : recréer la vue d'origine (§ ROLLBACK en fin
-- de fichier) puis DROP FUNCTION public.<vue>_rows().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. sessions_public — calendrier public du site (lecteur : anon + authenticated)
--    Justification definer : sessions/circuits sans policy anon.
-- ----------------------------------------------------------------------------
create or replace function public.sessions_public_rows()
returns table (
  id uuid,
  date date,
  start_time time without time zone,
  end_time time without time zone,
  format character varying,
  season_type public.season_type_enum,
  status public.session_status_enum,
  weather_status public.weather_status_enum,
  is_private boolean,
  max_capacity integer,
  capacity_access integer,
  capacity_morning integer,
  capacity_afternoon integer,
  capacity_promotion integer,
  capacity_signature integer,
  available_offers jsonb,
  notes text,
  created_at timestamptz,
  circuit_id uuid,
  circuit_name text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id, s.date, s.start_time, s.end_time, s.format, s.season_type,
         s.status, s.weather_status, s.is_private, s.max_capacity,
         s.capacity_access, s.capacity_morning, s.capacity_afternoon,
         s.capacity_promotion, s.capacity_signature, s.available_offers,
         s.notes, s.created_at, s.circuit_id, c.name as circuit_name
  from sessions s
  left join circuits c on c.id = s.circuit_id
  where s.is_private is not true
$$;

create or replace view public.sessions_public
with (security_invoker = true) as
select * from public.sessions_public_rows();
alter view public.sessions_public set (security_invoker = true);

revoke all on function public.sessions_public_rows() from public;
grant execute on function public.sessions_public_rows() to anon, authenticated, service_role;
revoke all on public.sessions_public from public, anon, authenticated;
grant select on public.sessions_public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. session_availability — jauges de places du site (lecteur : anon + auth.)
--    Justification definer : registrations est en RLS own/admin ; les comptes
--    seraient faux en invoker pur.
-- ----------------------------------------------------------------------------
create or replace function public.session_availability_rows()
returns table (
  session_id uuid,
  taken_total bigint,
  taken_access bigint,
  taken_signature bigint,
  taken_promotion bigint,
  taken_heritage bigint
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id as session_id,
         count(r.id) filter (where r.status <> 'cancelled'::registration_status_enum) as taken_total,
         count(r.id) filter (where r.status <> 'cancelled'::registration_status_enum and r.offer_type = 'access'::offer_type_enum) as taken_access,
         count(r.id) filter (where r.status <> 'cancelled'::registration_status_enum and r.offer_type = 'signature'::offer_type_enum) as taken_signature,
         count(r.id) filter (where r.status <> 'cancelled'::registration_status_enum and r.offer_type = 'promotion'::offer_type_enum) as taken_promotion,
         count(r.id) filter (where r.status <> 'cancelled'::registration_status_enum and r.offer_type = 'heritage'::offer_type_enum) as taken_heritage
  from sessions s
  left join registrations r on r.session_id = s.id
  where s.is_private is not true
  group by s.id
$$;

create or replace view public.session_availability
with (security_invoker = true) as
select * from public.session_availability_rows();
alter view public.session_availability set (security_invoker = true);

revoke all on function public.session_availability_rows() from public;
grant execute on function public.session_availability_rows() to anon, authenticated, service_role;
revoke all on public.session_availability from public, anon, authenticated;
grant select on public.session_availability to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. qdi_public — vitrine sociale du site (lecteur : anon + authenticated)
--    Justification definer : users et app_session_analyses en RLS own/admin.
--    Opt-in déjà strict dans la vue : community_visibility <> 'private',
--    nom réel seulement si 'nominative', comptes suspendus exclus.
-- ----------------------------------------------------------------------------
create or replace function public.qdi_public_rows()
returns table (
  display_name text,
  nominative boolean,
  margin_global numeric,
  margin_zone text,
  computed_at timestamptz,
  sessions_count bigint
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    case
      when u.community_visibility = 'nominative'::community_visibility
        then coalesce(nullif(u.public_handle, ''), u.first_name, 'Pilote OXV')
      else 'Pilote OXV'
    end as display_name,
    u.community_visibility = 'nominative'::community_visibility as nominative,
    a.margin_global,
    a.margin_zone,
    a.computed_at,
    a.sessions_count
  from users u
  join lateral (
    select s.margin_global, s.margin_zone, s.computed_at,
           (select count(*) from app_session_analyses c
             where c.user_id = u.id and c.margin_global is not null) as sessions_count
    from app_session_analyses s
    where s.user_id = u.id and s.margin_global is not null
    order by s.computed_at desc
    limit 1
  ) a on true
  where u.community_visibility <> 'private'::community_visibility
    and u.suspended_at is null
$$;

create or replace view public.qdi_public
with (security_invoker = true) as
select * from public.qdi_public_rows();
alter view public.qdi_public set (security_invoker = true);

revoke all on function public.qdi_public_rows() from public;
grant execute on function public.qdi_public_rows() to anon, authenticated, service_role;
revoke all on public.qdi_public from public, anon, authenticated;
grant select on public.qdi_public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. testimonials_public — témoignages du site (lecteur : anon + authenticated)
--    Justification definer : session_feedback/users en RLS own/admin.
--    Opt-in déjà strict : publish_ok (consentement pilote) ET published (admin).
-- ----------------------------------------------------------------------------
create or replace function public.testimonials_public_rows()
returns table (
  display_name text,
  rating integer,
  comment text,
  session_date date
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(nullif(u.public_handle, ''), u.first_name, 'Pilote OXV') as display_name,
         f.rating,
         f.comment,
         s.date as session_date
  from session_feedback f
  join users u on u.id = f.user_id
  join sessions s on s.id = f.session_id
  where f.publish_ok = true and f.published = true and f.comment is not null
$$;

create or replace view public.testimonials_public
with (security_invoker = true) as
select * from public.testimonials_public_rows();
alter view public.testimonials_public set (security_invoker = true);

revoke all on function public.testimonials_public_rows() from public;
grant execute on function public.testimonials_public_rows() to anon, authenticated, service_role;
revoke all on public.testimonials_public from public, anon, authenticated;
grant select on public.testimonials_public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. crews_public — équipages agrégés du site (lecteur : anon + authenticated)
--    Justification definer : crews/crew_members en RLS membre/admin.
--    Agrégat sans PII (nom d'équipage + compteur, seuil >= 20).
-- ----------------------------------------------------------------------------
create or replace function public.crews_public_rows()
returns table (
  name text,
  validated_members bigint,
  created_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.name,
         count(*) filter (where m.referral_validated or m.role = 'captain') as validated_members,
         c.created_at
  from crews c
  join crew_members m on m.crew_id = c.id
  where c.name is not null
  group by c.id, c.name, c.created_at
  having count(*) filter (where m.referral_validated or m.role = 'captain') >= 20
$$;

create or replace view public.crews_public
with (security_invoker = true) as
select * from public.crews_public_rows();
alter view public.crews_public set (security_invoker = true);

revoke all on function public.crews_public_rows() from public;
grant execute on function public.crews_public_rows() to anon, authenticated, service_role;
revoke all on public.crews_public from public, anon, authenticated;
grant select on public.crews_public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. plateau_members_public — plateau du site (lecteur : anon + authenticated)
--    Justification definer : users en RLS own/admin.
--    Opt-in déjà strict : community_visibility = 'nominative' uniquement,
--    nom limité à prénom + initiale + ville.
-- ----------------------------------------------------------------------------
create or replace function public.plateau_members_public_rows()
returns table (
  first_name text,
  last_initial text,
  city text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select u.first_name,
         left(coalesce(u.last_name, ''), 1) as last_initial,
         u.address_city as city
  from users u
  where u.community_visibility = 'nominative'::community_visibility
    and coalesce(u.first_name, '') <> ''
$$;

create or replace view public.plateau_members_public
with (security_invoker = true) as
select * from public.plateau_members_public_rows();
alter view public.plateau_members_public set (security_invoker = true);

revoke all on function public.plateau_members_public_rows() from public;
grant execute on function public.plateau_members_public_rows() to anon, authenticated, service_role;
revoke all on public.plateau_members_public from public, anon, authenticated;
grant select on public.plateau_members_public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. pavillon_meteo — météo du jour, écran TV Pavillon (lecteur : anon + auth.)
--    Justification definer : weather_snapshots en RLS own — la TV est anonyme.
--    Aucune PII (relevés météo du jour uniquement).
-- ----------------------------------------------------------------------------
create or replace function public.pavillon_meteo_rows()
returns table (
  session_id uuid,
  captured_at timestamptz,
  temperature_c numeric,
  wind_speed_kmh numeric,
  wind_direction_deg integer,
  precipitation_mm numeric,
  weather_label text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select distinct on (ws.session_id)
         ws.session_id, ws.captured_at, ws.temperature_c, ws.wind_speed_kmh,
         ws.wind_direction_deg, ws.precipitation_mm, ws.weather_label
  from weather_snapshots ws
  where ws.captured_at::date = current_date
  order by ws.session_id, ws.captured_at desc
$$;

create or replace view public.pavillon_meteo
with (security_invoker = true) as
select * from public.pavillon_meteo_rows();
alter view public.pavillon_meteo set (security_invoker = true);

revoke all on function public.pavillon_meteo_rows() from public;
grant execute on function public.pavillon_meteo_rows() to anon, authenticated, service_role;
revoke all on public.pavillon_meteo from public, anon, authenticated;
grant select on public.pavillon_meteo to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. pavillon_pilotes_jour — pilotes en piste, écran TV Pavillon
--    (lecteur ACTUEL : authenticated + service_role UNIQUEMENT — pas d'anon ;
--     on CONSERVE exactement ces droits.)
--    Justification definer : users/telemetry_sessions/vehicles en RLS own.
--    Opt-in vérifié : le nom réel (prénom + initiale) n'apparaît que si
--    users.pavilion_name_optin = true (décision fondateur, migration
--    20260717000000_profil_pavillon) ; sinon display_name est NULL.
--    Colonnes conservées à l'identique (user_id compris) pour ne pas casser la
--    TV — recommandation séparée : retirer user_id après vérif côté site.
-- ----------------------------------------------------------------------------
create or replace function public.pavillon_pilotes_jour_rows()
returns table (
  user_id uuid,
  car_number smallint,
  public_handle text,
  display_name text,
  vehicle_label text,
  telemetry_session_id uuid,
  session_status text,
  started_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select u.id as user_id,
         u.car_number,
         u.public_handle,
         case
           when u.pavilion_name_optin
             then ((u.first_name || ' ') || left(u.last_name, 1)) || '.'
           else null
         end as display_name,
         (v.brand || ' ') || v.model as vehicle_label,
         ts.id as telemetry_session_id,
         ts.status as session_status,
         ts.started_at
  from telemetry_sessions ts
  join users u on u.id = ts.user_id
  left join vehicles v on v.id = ts.vehicle_id
  where ts.started_at::date = current_date
$$;

create or replace view public.pavillon_pilotes_jour
with (security_invoker = true) as
select * from public.pavillon_pilotes_jour_rows();
alter view public.pavillon_pilotes_jour set (security_invoker = true);

revoke all on function public.pavillon_pilotes_jour_rows() from public;
grant execute on function public.pavillon_pilotes_jour_rows() to authenticated, service_role;
revoke all on public.pavillon_pilotes_jour from public, anon, authenticated;
grant select on public.pavillon_pilotes_jour to authenticated, service_role;

-- ============================================================================
-- ROLLBACK — définitions d'origine (exécuter la vue voulue, puis
-- DROP FUNCTION public.<vue>_rows(); — une vue à la fois, indépendantes)
-- ============================================================================
-- create or replace view public.sessions_public as
--   select s.id, s.date, s.start_time, s.end_time, s.format, s.season_type,
--          s.status, s.weather_status, s.is_private, s.max_capacity,
--          s.capacity_access, s.capacity_morning, s.capacity_afternoon,
--          s.capacity_promotion, s.capacity_signature, s.available_offers,
--          s.notes, s.created_at, s.circuit_id, c.name as circuit_name
--   from sessions s left join circuits c on c.id = s.circuit_id
--   where s.is_private is not true;
--   alter view public.sessions_public reset (security_invoker);
-- (idem pour les 7 autres : reprendre la définition dans
--  docs/architecture/SEC1_PROD_APPLY.md §Annexe, qui archive les 8 pg_get_viewdef
--  relevés en prod le 2026-07-19.)
