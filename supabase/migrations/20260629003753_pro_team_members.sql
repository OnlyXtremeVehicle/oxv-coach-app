-- PR-74 : Espace Equipe du pilote pro. DECLARATION de l'entourage (coach,
-- preparateur, assistant) avec un niveau d'acces reserve. IMPORTANT : cette table
-- n'accorde PAR ELLE-MEME aucun acces a la telemetrie — le partage reel de donnees
-- sera une etape RLS dediee et consentie. Ici, on declare et on revoque, point.
create table if not exists public.pro_team_members (
  id uuid primary key default gen_random_uuid(),
  pro_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  member_email text,
  member_name text,
  role_label text not null default 'Membre',
  access_level text not null default 'none' check (access_level in ('none', 'view')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pro_team_member_identifier check (member_user_id is not null or member_email is not null)
);

alter table public.pro_team_members enable row level security;

-- Le pro pilote gere SES membres (et doit etre pro_pilot pour en creer).
drop policy if exists pro_team_owner_all on public.pro_team_members;
create policy pro_team_owner_all on public.pro_team_members
  for all
  using (pro_user_id = auth.uid())
  with check (pro_user_id = auth.uid() and public.is_pro_pilot());

-- Le membre voit, en lecture seule, les lignes ou il figure.
drop policy if exists pro_team_member_read on public.pro_team_members;
create policy pro_team_member_read on public.pro_team_members
  for select using (member_user_id = auth.uid());

-- Admin supervise (lecture).
drop policy if exists pro_team_admin_read on public.pro_team_members;
create policy pro_team_admin_read on public.pro_team_members
  for select using (public.is_admin());

grant select, insert, update, delete on public.pro_team_members to authenticated;

drop trigger if exists pro_team_members_touch_trg on public.pro_team_members;
create trigger pro_team_members_touch_trg before update on public.pro_team_members
  for each row execute function public.tg_touch_updated_at();
