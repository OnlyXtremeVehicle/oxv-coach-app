-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 00:10:57 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-07 : retours clients post-session. Un retour par réservation EFFECTUÉE.
-- Boucle : retour → moyenne/alertes admin → témoignage autorisé + publié → page Preuves.
create table public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id),
  rating int not null check (rating between 1 and 5),
  nps int check (nps between 0 and 10),
  comment text,
  publish_ok boolean not null default false,   -- autorisation du pilote (prénom + verbatim)
  published boolean not null default false,    -- curation admin (jamais publié sans les DEUX)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.session_feedback is 'PR-HUB-07 — retours post-session. Publication publique = publish_ok (pilote) ET published (admin). Alertes admin si rating < 3.';
alter table public.session_feedback enable row level security;

-- Le pilote écrit/lit SON retour, uniquement pour une réservation à lui et EFFECTUÉE
create policy feedback_insert_own on public.session_feedback
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.registrations r
                where r.id = registration_id and r.user_id = (select auth.uid())
                  and r.status = 'attended')
  );
create policy feedback_select_own on public.session_feedback
  for select to authenticated using (user_id = (select auth.uid()) or is_admin());
create policy feedback_update_own on public.session_feedback
  for update to authenticated
  using (user_id = (select auth.uid()) or is_admin())
  with check (user_id = (select auth.uid()) or is_admin());
create index feedback_session_idx on public.session_feedback (session_id);

-- Le pilote ne peut pas s'auto-publier : published est réservé à l'admin
create or replace function public.trg_fn_feedback_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.published is distinct from old.published and not is_admin() then
    raise exception 'published est réservé à l''admin';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_feedback_guard before update on public.session_feedback
  for each row execute function public.trg_fn_feedback_guard();

-- Témoignages publics (page Preuves) : autorisés par le pilote ET publiés par l'admin. Sans user_id.
create or replace view public.testimonials_public as
select coalesce(nullif(u.public_handle,''), u.first_name, 'Pilote OXV') as display_name,
       f.rating, f.comment, s.date as session_date
from public.session_feedback f
join public.users u on u.id = f.user_id
join public.sessions s on s.id = f.session_id
where f.publish_ok = true and f.published = true and f.comment is not null;
comment on view public.testimonials_public is 'PR-HUB-07 — témoignages publiables (double accord pilote+admin). Sans user_id.';
grant select on public.testimonials_public to anon, authenticated;
