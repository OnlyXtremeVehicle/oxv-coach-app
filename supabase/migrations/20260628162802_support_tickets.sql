-- 0020_support_tickets.sql — Support pilote ⇄ admin (PR-09)
--
-- Le pilote crée/suit SES tickets et y répond ; l'admin traite (statut/priorité)
-- et répond. Lead consenti côté partenaire mis à part, c'est le seul canal de
-- contact intégré. AUCUNE télémétrie n'est exposée : un ticket porte au plus une
-- référence (session_id / device_id), jamais de trame.

-- Énumérations -------------------------------------------------------------
create type public.support_ticket_category as enum (
  'equipement', 'bilan', 'data', 'coach', 'rgpd'
);
create type public.support_ticket_status as enum (
  'nouveau', 'ouvert', 'en_cours', 'resolu', 'ferme'
);
create type public.support_ticket_priority as enum ('p0', 'p1', 'p2', 'p3');

-- Tables -------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category public.support_ticket_category not null,
  subject text not null check (length(btrim(subject)) between 1 and 200),
  status public.support_ticket_status not null default 'nouveau',
  priority public.support_ticket_priority not null default 'p2',
  session_id uuid references public.telemetry_sessions (id) on delete set null,
  device_id uuid references public.devices (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status, priority);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- updated_at automatique sur le ticket ------------------------------------
create or replace function public.touch_support_ticket_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_support_tickets_touch
before update on public.support_tickets
for each row execute function public.touch_support_ticket_updated_at();

-- RLS ----------------------------------------------------------------------
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- Tickets : le pilote voit/crée les SIENS ; l'admin voit tout.
create policy support_tickets_select on public.support_tickets
for select using (auth.uid() = user_id or public.is_admin());

create policy support_tickets_insert on public.support_tickets
for insert with check (auth.uid() = user_id);

-- Statut/priorité : ADMIN uniquement (le pilote n'édite pas son ticket ;
-- il interagit via les messages).
create policy support_tickets_update_admin on public.support_tickets
for update using (public.is_admin()) with check (public.is_admin());

-- Messages : lisibles par le propriétaire du ticket et l'admin.
create policy support_messages_select on public.support_messages
for select using (
  public.is_admin()
  or exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  )
);

-- Insertion : le pilote répond à SON ticket (is_admin=false) ; l'admin répond
-- partout (is_admin=true). L'auteur est toujours l'appelant.
create policy support_messages_insert on public.support_messages
for insert with check (
  author_id = auth.uid()
  and (
    (
      is_admin = false
      and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    )
    or (is_admin = true and public.is_admin())
  )
);
