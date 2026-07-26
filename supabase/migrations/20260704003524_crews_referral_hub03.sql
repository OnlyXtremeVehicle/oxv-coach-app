-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 00:35:24 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-03 : Parrainage modèle « Écuries » (décision fondateur Q5 option C).
-- Pas de réduction. Code parrain (users.affiliation_code, colonne existante réutilisée) →
-- le filleul rejoint l'écurie du parrain. La hiérarchie = TAILLE de l'écurie
-- (membres validés = 1er paiement validé, anti-abus) : 5 → priorité résa collective ·
-- 10 → box dédié un jour de session · 20 → écurie nommée sur le plateau.
-- Capitaine = parrain d'origine. Fast-track : code capté dès la demande d'inscription.

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null unique references public.users(id),
  name text,
  named_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.crews is 'PR-HUB-03 — écuries de parrainage. Capitaine = parrain d''origine. Nommée publiquement au palier 20 membres validés.';

create table public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid primary key references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('captain','member')),
  referred_by uuid references public.users(id),
  referral_validated boolean not null default false,
  joined_at timestamptz not null default now()
);
comment on table public.crew_members is 'PR-HUB-03 — un pilote appartient à une seule écurie. referral_validated = premier paiement validé du filleul (anti-abus : seuls les validés comptent dans les paliers).';
create index crew_members_crew_idx on public.crew_members (crew_id);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
-- Lecture : les membres voient leur écurie ; admin tout. Écriture : fonctions definer uniquement.
create policy crews_select_member on public.crews for select to authenticated
  using (is_admin() or exists (select 1 from public.crew_members m where m.crew_id = id and m.user_id = (select auth.uid())));
create policy crew_members_select_own_crew on public.crew_members for select to authenticated
  using (is_admin() or exists (select 1 from public.crew_members me where me.crew_id = crew_members.crew_id and me.user_id = (select auth.uid())));
create policy crews_admin_all on public.crews for all to authenticated using (is_admin()) with check (is_admin());
create policy crew_members_admin_all on public.crew_members for all to authenticated using (is_admin()) with check (is_admin());

-- Mon code parrain (réutilise users.affiliation_code) : OXV-PRENOM-XXXX, généré une fois.
create or replace function public.oxv_get_my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_first text;
begin
  select affiliation_code, coalesce(nullif(regexp_replace(upper(coalesce(first_name,'PILOTE')), '[^A-Z]', '', 'g'), ''), 'PILOTE')
    into v_code, v_first from public.users where id = (select auth.uid());
  if v_code is not null then return v_code; end if;
  loop
    v_code := 'OXV-' || left(v_first, 8) || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    begin
      update public.users set affiliation_code = v_code where id = (select auth.uid());
      return v_code;
    exception when unique_violation then null; -- collision improbable : on retente
    end;
  end loop;
end $$;
revoke execute on function public.oxv_get_my_referral_code() from public, anon;
grant execute on function public.oxv_get_my_referral_code() to authenticated;
create unique index if not exists users_affiliation_code_key on public.users (affiliation_code) where affiliation_code is not null;

-- Rejoindre l'écurie d'un parrain via son code. Anti-abus : pas soi-même, une seule écurie par pilote.
create or replace function public.oxv_redeem_referral(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); v_referrer uuid; v_crew uuid;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select id into v_referrer from public.users where affiliation_code = upper(trim(p_code));
  if v_referrer is null then return jsonb_build_object('ok', false, 'error', 'code_invalide'); end if;
  if v_referrer = v_me then return jsonb_build_object('ok', false, 'error', 'auto_parrainage_interdit'); end if;
  if exists (select 1 from public.crew_members where user_id = v_me) then
    return jsonb_build_object('ok', false, 'error', 'deja_dans_une_ecurie');
  end if;
  -- Écurie du parrain : celle où il est membre, sinon on la crée (il en devient capitaine)
  select crew_id into v_crew from public.crew_members where user_id = v_referrer;
  if v_crew is null then
    insert into public.crews (captain_id) values (v_referrer) returning id into v_crew;
    insert into public.crew_members (crew_id, user_id, role) values (v_crew, v_referrer, 'captain');
  end if;
  insert into public.crew_members (crew_id, user_id, role, referred_by)
  values (v_crew, v_me, 'member', v_referrer);
  return jsonb_build_object('ok', true, 'crew_id', v_crew);
end $$;
revoke execute on function public.oxv_redeem_referral(text) from public, anon;
grant execute on function public.oxv_redeem_referral(text) to authenticated;

-- Anti-abus : un filleul compte dans les paliers après son PREMIER paiement validé.
create or replace function public.trg_fn_referral_validate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'succeeded' and old.status is distinct from 'succeeded' then
    update public.crew_members set referral_validated = true where user_id = new.user_id;
  end if;
  return new;
exception when others then
  raise warning '[referral_validate] %', sqlerrm; return new;
end $$;
drop trigger if exists trg_referral_validate on public.payments;
create trigger trg_referral_validate after update of status on public.payments
  for each row execute function public.trg_fn_referral_validate();

-- Écuries publiques (plateau) : nommées ET palier 20 atteint. Sans identités.
create or replace view public.crews_public as
select c.name,
       count(*) filter (where m.referral_validated or m.role = 'captain') as validated_members,
       c.created_at
from public.crews c join public.crew_members m on m.crew_id = c.id
where c.name is not null
group by c.id, c.name, c.created_at
having count(*) filter (where m.referral_validated or m.role = 'captain') >= 20;
grant select on public.crews_public to anon, authenticated;

-- Le capitaine nomme son écurie (le palier d'affichage public reste contrôlé par la vue)
create or replace function public.oxv_name_my_crew(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_crew uuid;
begin
  select id into v_crew from public.crews where captain_id = (select auth.uid());
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'pas_capitaine'); end if;
  if length(trim(p_name)) < 3 or length(trim(p_name)) > 40 then
    return jsonb_build_object('ok', false, 'error', 'nom_invalide');
  end if;
  update public.crews set name = trim(p_name), named_at = now() where id = v_crew;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.oxv_name_my_crew(text) from public, anon;
grant execute on function public.oxv_name_my_crew(text) to authenticated;

-- Fast-track : le code parrain est capté dès la demande d'inscription (badge admin)
alter table public.demandes_inscription add column if not exists referral_code text;
comment on column public.demandes_inscription.referral_code is 'PR-HUB-03 — code parrain déclaré : la demande est prioritaire (fast-track), badge dans l''admin.';
