-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 3 juillet 2026 a 20:04:26 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-02 : check-up d'éligibilité pré-circuit. Checklist validée fondateur (2026-07-01) :
-- permis, CNI, attestation assurance circuit, CT, pneus/freins déclaratif, niveau sonore,
-- casque, décharge signée, briefing. Validation ADMIN après chaque réservation.
-- Items lisibles par le pilote (RLS), modifiables par l'admin, créés/synchronisés par le système.

create table public.eligibility_items (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  item_key text not null check (item_key in
    ('permis','cni','assurance_circuit','controle_technique','pneus_freins','niveau_sonore','casque','decharge','briefing')),
  status text not null default 'pending' check (status in ('pending','ok','refused','na')),
  note text,
  document_id uuid references public.documents(id),
  validated_by uuid references public.users(id),
  validated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (registration_id, item_key)
);
comment on table public.eligibility_items is 'PR-HUB-02 — checklist éligibilité par réservation. Écriture admin (validation) + système (seed/sync docs). GO = tout ok · NO-GO = un refus · EN ATTENTE sinon.';
alter table public.eligibility_items enable row level security;

create policy eligibility_select_own on public.eligibility_items
  for select to authenticated
  using (is_admin() or exists (select 1 from public.registrations r where r.id = registration_id and r.user_id = (select auth.uid())));
create policy eligibility_update_admin on public.eligibility_items
  for update to authenticated using (is_admin()) with check (is_admin());
-- INSERT/DELETE : système uniquement (fonctions SECURITY DEFINER / service role)
create index eligibility_reg_idx on public.eligibility_items (registration_id);

-- Seed : crée les 9 items pour une réservation + synchronise les items adossés aux documents
create or replace function public.oxv_seed_eligibility(p_registration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.eligibility_items (registration_id, item_key)
  select p_registration_id, k from unnest(array[
    'permis','cni','assurance_circuit','controle_technique','pneus_freins','niveau_sonore','casque','decharge','briefing']) as k
  on conflict (registration_id, item_key) do nothing;
  perform public.oxv_sync_eligibility_docs(p_registration_id);
end $$;

-- Sync : items documentaires (permis/cni/assurance) suivent l'état de la table documents
create or replace function public.oxv_sync_eligibility_docs(p_registration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.registrations where id = p_registration_id;
  if v_user is null then return; end if;
  update public.eligibility_items ei set
    status = case when d.status = 'validated' then 'ok'
                  when d.status = 'rejected' then 'refused'
                  else 'pending' end,
    document_id = d.id,
    updated_at = now()
  from (
    select distinct on (document_type) id, document_type, status
    from public.documents where user_id = v_user
      and document_type in ('driving_license','id_card','insurance_track')
    order by document_type, uploaded_at desc
  ) d
  where ei.registration_id = p_registration_id
    and ei.item_key = case d.document_type::text
        when 'driving_license' then 'permis'
        when 'id_card' then 'cni'
        when 'insurance_track' then 'assurance_circuit' end
    and ei.validated_by is null; -- une décision admin manuelle prime toujours
end $$;
revoke execute on function public.oxv_seed_eligibility(uuid) from public, anon, authenticated;
revoke execute on function public.oxv_sync_eligibility_docs(uuid) from public, anon, authenticated;

-- Trigger : chaque nouvelle réservation reçoit sa checklist
create or replace function public.trg_fn_seed_eligibility()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.oxv_seed_eligibility(new.id);
  return new;
exception when others then
  raise warning '[seed_eligibility] %', sqlerrm; return new;
end $$;
drop trigger if exists trg_seed_eligibility on public.registrations;
create trigger trg_seed_eligibility after insert on public.registrations
  for each row execute function public.trg_fn_seed_eligibility();

-- Trigger : un document validé/refusé met à jour l'éligibilité des réservations actives du pilote
create or replace function public.trg_fn_docs_to_eligibility()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.registrations
           where user_id = new.user_id and status not in ('cancelled') loop
    perform public.oxv_sync_eligibility_docs(r.id);
  end loop;
  return new;
exception when others then
  raise warning '[docs_to_eligibility] %', sqlerrm; return new;
end $$;
drop trigger if exists trg_docs_eligibility on public.documents;
create trigger trg_docs_eligibility after insert or update of status on public.documents
  for each row execute function public.trg_fn_docs_to_eligibility();

-- Vue agrégée GO / EN ATTENTE / NO-GO (respecte la RLS des tables sous-jacentes)
create or replace view public.registration_eligibility
with (security_invoker = on) as
select r.id as registration_id, r.user_id, r.session_id,
  count(*) filter (where ei.status = 'ok') as ok_count,
  count(*) filter (where ei.status = 'refused') as refused_count,
  count(*) filter (where ei.status = 'pending') as pending_count,
  count(*) as total_count,
  case when count(*) filter (where ei.status = 'refused') > 0 then 'NO_GO'
       when count(*) filter (where ei.status in ('ok','na')) = count(*) then 'GO'
       else 'EN_ATTENTE' end as eligibility_status
from public.registrations r
join public.eligibility_items ei on ei.registration_id = r.id
group by r.id, r.user_id, r.session_id;

-- Backfill : réservations existantes non annulées
do $$ declare r record; begin
  for r in select id from public.registrations where status not in ('cancelled') loop
    perform public.oxv_seed_eligibility(r.id);
  end loop;
end $$;
