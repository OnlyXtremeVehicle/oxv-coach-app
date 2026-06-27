-- Belles routes sauvegardées + certification OXV (doc architecture/09).
--
-- Un pilote enregistre une belle route (balade/découverte). Il peut demander
-- sa certification par un admin OXV. Seul un admin peut certifier/rejeter
-- (verrou trigger, même logique que T10). Les routes certifiées sont visibles
-- par les membres validés (communauté).
--
-- Additive : nouvelle table isolée, ne touche aucune table existante.

create type public.scenic_route_status as enum ('draft', 'pending_review', 'certified', 'rejected');

create table public.scenic_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  start_lat double precision not null,
  start_lon double precision not null,
  distance_km double precision,
  curviness text,
  sinuosity double precision,
  ascent_m double precision,
  geometry jsonb, -- polyligne [{lat,lon}]
  pois jsonb, -- points de vue [{kind,name,lat,lon}]
  provider text,
  status public.scenic_route_status not null default 'draft',
  certified_by uuid references public.users(id),
  certified_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_scenic_routes_user on public.scenic_routes (user_id);
create index idx_scenic_routes_status on public.scenic_routes (status);

alter table public.scenic_routes enable row level security;

-- Propriétaire : CRUD complet sur ses propres routes.
create policy scenic_routes_owner_all on public.scenic_routes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin : gestion de toutes les routes (pour certifier/rejeter).
create policy scenic_routes_admin_all on public.scenic_routes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Membres validés : lecture des routes certifiées (communauté).
create policy scenic_routes_certified_read on public.scenic_routes
  for select to authenticated
  using (status = 'certified' and public.is_validated_member());

-- updated_at automatique.
create or replace function public.scenic_routes_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
revoke execute on function public.scenic_routes_set_updated_at() from public, anon, authenticated;

drop trigger if exists trg_scenic_routes_updated_at on public.scenic_routes;
create trigger trg_scenic_routes_updated_at
  before update on public.scenic_routes
  for each row
  execute function public.scenic_routes_set_updated_at();

-- Verrou : seul un admin (ou le backend) peut passer une route en certified/rejected.
-- Un pilote ne peut que faire draft <-> pending_review sur sa route.
create or replace function public.guard_scenic_route_certification()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if (new.status is distinct from old.status)
     and new.status in ('certified', 'rejected')
     and current_user not in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
     and not coalesce(public.is_admin(), false) then
    raise exception 'OXV: la certification d''une route est réservée aux administrateurs'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke execute on function public.guard_scenic_route_certification() from public, anon, authenticated;

drop trigger if exists trg_guard_scenic_route_cert on public.scenic_routes;
create trigger trg_guard_scenic_route_cert
  before update of status on public.scenic_routes
  for each row
  execute function public.guard_scenic_route_certification();
