-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 19 juillet 2026 a 01:10:27 UTC, elle n avait jamais ete
-- versionnee dans ce depot sous sa version reelle. Source : colonne statements, recollee
-- dans l ordre d execution. Le formatage d origine et les commentaires hors instruction
-- sont perdus ; le SQL, lui, est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- SEC-1 lot A — 8 vues DEFINER → invoker + fonctions DEFINER search_path figé
-- (v2 : DROP VIEW + CREATE VIEW — CREATE OR REPLACE refuse le changement de
--  type de colonne (format varchar(30) → varchar) ; aucun objet ne dépend des
--  vues, les GRANTs sont recréés explicitement ci-dessous.)

create or replace function public.sessions_public_rows()
returns table (
  id uuid, date date, start_time time without time zone, end_time time without time zone,
  format character varying, season_type public.season_type_enum, status public.session_status_enum,
  weather_status public.weather_status_enum, is_private boolean, max_capacity integer,
  capacity_access integer, capacity_morning integer, capacity_afternoon integer,
  capacity_promotion integer, capacity_signature integer, available_offers jsonb,
  notes text, created_at timestamptz, circuit_id uuid, circuit_name text
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

drop view if exists public.sessions_public;
create view public.sessions_public
with (security_invoker = true) as
select * from public.sessions_public_rows();

revoke all on function public.sessions_public_rows() from public;
grant execute on function public.sessions_public_rows() to anon, authenticated, service_role;
revoke all on public.sessions_public from public, anon, authenticated;
grant select on public.sessions_public to anon, authenticated, service_role;

create or replace function public.session_availability_rows()
returns table (
  session_id uuid, taken_total bigint, taken_access bigint,
  taken_signature bigint, taken_promotion bigint, taken_heritage bigint
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

drop view if exists public.session_availability;
create view public.session_availability
with (security_invoker = true) as
select * from public.session_availability_rows();

revoke all on function public.session_availability_rows() from public;
grant execute on function public.session_availability_rows() to anon, authenticated, service_role;
revoke all on public.session_availability from public, anon, authenticated;
grant select on public.session_availability to anon, authenticated, service_role;

create or replace function public.qdi_public_rows()
returns table (
  display_name text, nominative boolean, margin_global numeric,
  margin_zone text, computed_at timestamptz, sessions_count bigint
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
    a.margin_global, a.margin_zone, a.computed_at, a.sessions_count
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

drop view if exists public.qdi_public;
create view public.qdi_public
with (security_invoker = true) as
select * from public.qdi_public_rows();

revoke all on function public.qdi_public_rows() from public;
grant execute on function public.qdi_public_rows() to anon, authenticated, service_role;
revoke all on public.qdi_public from public, anon, authenticated;
grant select on public.qdi_public to anon, authenticated, service_role;

create or replace function public.testimonials_public_rows()
returns table (display_name text, rating integer, comment text, session_date date)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(nullif(u.public_handle, ''), u.first_name, 'Pilote OXV') as display_name,
         f.rating, f.comment, s.date as session_date
  from session_feedback f
  join users u on u.id = f.user_id
  join sessions s on s.id = f.session_id
  where f.publish_ok = true and f.published = true and f.comment is not null
$$;

drop view if exists public.testimonials_public;
create view public.testimonials_public
with (security_invoker = true) as
select * from public.testimonials_public_rows();

revoke all on function public.testimonials_public_rows() from public;
grant execute on function public.testimonials_public_rows() to anon, authenticated, service_role;
revoke all on public.testimonials_public from public, anon, authenticated;
grant select on public.testimonials_public to anon, authenticated, service_role;

create or replace function public.crews_public_rows()
returns table (name text, validated_members bigint, created_at timestamptz)
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

drop view if exists public.crews_public;
create view public.crews_public
with (security_invoker = true) as
select * from public.crews_public_rows();

revoke all on function public.crews_public_rows() from public;
grant execute on function public.crews_public_rows() to anon, authenticated, service_role;
revoke all on public.crews_public from public, anon, authenticated;
grant select on public.crews_public to anon, authenticated, service_role;

create or replace function public.plateau_members_public_rows()
returns table (first_name text, last_initial text, city text)
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

drop view if exists public.plateau_members_public;
create view public.plateau_members_public
with (security_invoker = true) as
select * from public.plateau_members_public_rows();

revoke all on function public.plateau_members_public_rows() from public;
grant execute on function public.plateau_members_public_rows() to anon, authenticated, service_role;
revoke all on public.plateau_members_public from public, anon, authenticated;
grant select on public.plateau_members_public to anon, authenticated, service_role;

create or replace function public.pavillon_meteo_rows()
returns table (
  session_id uuid, captured_at timestamptz, temperature_c numeric,
  wind_speed_kmh numeric, wind_direction_deg integer, precipitation_mm numeric,
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

drop view if exists public.pavillon_meteo;
create view public.pavillon_meteo
with (security_invoker = true) as
select * from public.pavillon_meteo_rows();

revoke all on function public.pavillon_meteo_rows() from public;
grant execute on function public.pavillon_meteo_rows() to anon, authenticated, service_role;
revoke all on public.pavillon_meteo from public, anon, authenticated;
grant select on public.pavillon_meteo to anon, authenticated, service_role;

create or replace function public.pavillon_pilotes_jour_rows()
returns table (
  user_id uuid, car_number smallint, public_handle text, display_name text,
  vehicle_label text, telemetry_session_id uuid, session_status text, started_at timestamptz
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

drop view if exists public.pavillon_pilotes_jour;
create view public.pavillon_pilotes_jour
with (security_invoker = true) as
select * from public.pavillon_pilotes_jour_rows();

revoke all on function public.pavillon_pilotes_jour_rows() from public;
grant execute on function public.pavillon_pilotes_jour_rows() to authenticated, service_role;
revoke all on public.pavillon_pilotes_jour from public, anon, authenticated;
grant select on public.pavillon_pilotes_jour to authenticated, service_role;
