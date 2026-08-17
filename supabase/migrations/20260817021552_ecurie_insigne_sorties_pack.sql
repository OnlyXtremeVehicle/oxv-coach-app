-- =============================================================================
-- APPLIQUÉE EN PRODUCTION le 17/08/2026 — version 20260817021552.
-- =============================================================================
--
-- Écurie : insigne (catalogue OU image), sortie d'écurie sur `convoys`,
-- invitation, et consommation atomique d'une séance du pack Heritage.
-- Décisions fondateur du 17/08/2026 : une seule écurie pour tous les usages,
-- insigne au choix entre catalogue et téléversement.
--
-- -----------------------------------------------------------------------------
-- CE QUE L'INSPECTION DES POLITIQUES A CORRIGÉ, AVANT APPLICATION
-- -----------------------------------------------------------------------------
--
-- La version proposée de ce fichier portait trois défauts, tous trouvés en
-- relisant les politiques RLS réellement en base plutôt qu'en les supposant :
--
--   1. `convoys_crew_insert_capitaine` était PERMISSIVE. Les politiques
--      permissives d'une même commande se combinent en OR : elle aurait été
--      noyée par `convoys_insert_registered`, qui autorise déjà tout inscrit.
--      Elle n'aurait rien restreint. Elle est RESTRICTIVE — donc AND.
--
--   2. `convoy_participants_join` exige `auth.uid() = user_id`. Le capitaine ne
--      pouvait donc inviter personne : il n'a le droit d'insérer que sa propre
--      ligne. Une politique d'invitation manquait.
--
--   3. `convoy_participants_select` exige `is_registered_for_session`. Un pilote
--      invité mais pas encore inscrit ne voyait PAS son invitation — alors
--      qu'elle existe précisément pour qu'il s'inscrive.
--
-- Et `crews` n'a AUCUNE politique UPDATE : l'insigne passe donc par une
-- fonction, comme le baptême (`oxv_name_my_crew`).
--
-- =============================================================================

-- 1 · INSIGNE -----------------------------------------------------------------
alter table public.crews
  add column if not exists insigne_catalogue_key text,
  add column if not exists insigne_image_path    text,
  add column if not exists insigne_updated_at    timestamptz;

do $$ begin
  if not exists (select 1 from pg_type where typname='crew_insigne_status_enum') then
    create type public.crew_insigne_status_enum as enum ('en_attente','valide','refuse');
  end if;
end $$;

alter table public.crews
  add column if not exists insigne_status public.crew_insigne_status_enum,
  add column if not exists insigne_reviewed_at timestamptz,
  add column if not exists insigne_reviewed_by uuid references public.users(id);

-- Une écurie porte UN insigne : catalogue ou image, jamais les deux.
alter table public.crews drop constraint if exists crews_insigne_une_seule_voie;
alter table public.crews add constraint crews_insigne_une_seule_voie
  check (num_nonnulls(insigne_catalogue_key, insigne_image_path) <= 1);

-- Le statut ne vise QUE le téléversement : une clé de catalogue vient d'une
-- liste maîtrisée et n'a rien à modérer.
alter table public.crews drop constraint if exists crews_insigne_statut_si_image;
alter table public.crews add constraint crews_insigne_statut_si_image
  check ((insigne_image_path is null and insigne_status is null)
      or (insigne_image_path is not null and insigne_status is not null));

comment on column public.crews.insigne_image_path is
  'Chemin Storage. Public UNIQUEMENT si insigne_status = ''valide'' (fail-closed).';

-- Une politique UPDATE ouverte donnerait au capitaine le droit d'écrire
-- `captain_id` et `name` par la même porte. La fonction n'expose que l'insigne.
create or replace function public.oxv_set_crew_insigne(
  p_catalogue_key text default null,
  p_image_path    text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_crew uuid;
begin
  if num_nonnulls(p_catalogue_key, p_image_path) > 1 then
    return jsonb_build_object('ok', false, 'error', 'deux_voies');
  end if;

  select id into v_crew from public.crews where captain_id = auth.uid();
  if v_crew is null then
    return jsonb_build_object('ok', false, 'error', 'pas_capitaine');
  end if;

  update public.crews set
    insigne_catalogue_key = p_catalogue_key,
    insigne_image_path    = p_image_path,
    -- FAIL-CLOSED : une image fraîchement téléversée n'est PAS publique.
    insigne_status        = case when p_image_path is not null
                                 then 'en_attente'::public.crew_insigne_status_enum else null end,
    insigne_reviewed_at   = null,
    insigne_reviewed_by   = null,
    insigne_updated_at    = now()
  where id = v_crew;

  return jsonb_build_object('ok', true, 'crew_id', v_crew,
    'moderation_requise', p_image_path is not null);
end $$;

revoke all on function public.oxv_set_crew_insigne(text, text) from public, anon;
grant execute on function public.oxv_set_crew_insigne(text, text) to authenticated;

-- 2 · SORTIE D'ÉCURIE ---------------------------------------------------------
--
-- Deux colonnes sur `convoys`, qui porte déjà meeting_point, rdv_at, route_id,
-- ses participants et son service. Une table `crew_outings` l'aurait dupliquée
-- colonne pour colonne. `crew_id` est NULLABLE : le convoi libre existe déjà.
alter table public.convoys
  add column if not exists crew_id       uuid references public.crews(id) on delete set null,
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;

create index if not exists convoys_crew_id_idx on public.convoys (crew_id) where crew_id is not null;

-- RESTRICTIVE — voir le défaut 1 en tête de fichier.
drop policy if exists convoys_crew_insert_capitaine on public.convoys;
create policy convoys_crew_insert_capitaine on public.convoys
  as restrictive for insert to authenticated
  with check (crew_id is null
    or exists (select 1 from public.crews c where c.id = crew_id and c.captain_id = auth.uid()));

drop policy if exists convoys_crew_update_capitaine on public.convoys;
create policy convoys_crew_update_capitaine on public.convoys
  as restrictive for update to authenticated
  with check (crew_id is null
    or exists (select 1 from public.crews c where c.id = crew_id and c.captain_id = auth.uid()));

-- 3 · INVITATION --------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname='convoy_participant_status_enum') then
    create type public.convoy_participant_status_enum as enum ('invite','present','decline');
  end if;
end $$;

-- Défaut 'present' et NON 'invite' : une ligne existante est un pilote qui a
-- rejoint de lui-même. Un défaut 'invite' l'aurait transformé rétroactivement en
-- invitation sans réponse. (La table était vide à l'application — le choix reste
-- le bon pour toute reprise ultérieure.)
alter table public.convoy_participants
  add column if not exists status public.convoy_participant_status_enum not null default 'present',
  add column if not exists invited_by uuid references public.users(id),
  add column if not exists responded_at timestamptz;

-- Défaut 2 : le capitaine ne pouvait inviter personne.
drop policy if exists convoy_participants_invite_capitaine on public.convoy_participants;
create policy convoy_participants_invite_capitaine on public.convoy_participants
  for insert to authenticated
  with check (status = 'invite' and invited_by = auth.uid()
    and exists (
      select 1 from public.convoys c
      join public.crews cr on cr.id = c.crew_id
      join public.crew_members cm on cm.crew_id = cr.id and cm.user_id = convoy_participants.user_id
      where c.id = convoy_participants.convoy_id and cr.captain_id = auth.uid()));

-- Défaut 3 : l'invité non inscrit ne voyait pas son invitation.
drop policy if exists convoy_participants_voit_ses_invitations on public.convoy_participants;
create policy convoy_participants_voit_ses_invitations on public.convoy_participants
  for select to authenticated using (user_id = auth.uid());

-- Aucune politique UPDATE n'existait : répondre était impossible.
drop policy if exists convoy_participants_repond_pour_soi on public.convoy_participants;
create policy convoy_participants_repond_pour_soi on public.convoy_participants
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4 · PACK HERITAGE -----------------------------------------------------------
--
-- Rien à ajouter au schéma : `heritage_packs.sessions_used` et
-- `registrations.heritage_pack_id` existaient. Ce qui manquait est la GARANTIE
-- que deux inscriptions simultanées sur le dernier crédit n'en consomment pas
-- deux — ce qu'un `update ... set sessions_used + 1` depuis l'app ne donne pas.
create or replace function public.oxv_use_heritage_session(p_registration_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid; v_session uuid; v_pack public.heritage_packs%rowtype; v_invite boolean;
begin
  select r.user_id, r.session_id into v_user_id, v_session
    from public.registrations r where r.id = p_registration_id;
  if v_user_id is null then return jsonb_build_object('ok',false,'error','inscription_introuvable'); end if;
  if v_user_id <> auth.uid() then return jsonb_build_object('ok',false,'error','non_autorise'); end if;

  -- Le crédit s'ouvre sur une invitation d'écurie, pas sur une inscription libre.
  select exists (
    select 1 from public.convoy_participants cp
    join public.convoys c on c.id = cp.convoy_id
    join public.crew_members cm on cm.crew_id = c.crew_id and cm.user_id = v_user_id
    where cp.user_id = v_user_id and c.session_id = v_session
      and c.crew_id is not null and cp.status in ('invite','present')
  ) into v_invite;
  if not v_invite then return jsonb_build_object('ok',false,'error','pas_invite_par_ecurie'); end if;

  -- Une inscription ne consomme qu'UNE fois (rejeu d'écran, double appel).
  if exists (select 1 from public.registrations
             where id = p_registration_id and heritage_pack_id is not null) then
    return jsonb_build_object('ok',false,'error','deja_consomme');
  end if;

  -- `for update` : deux appels concurrents sur le dernier crédit sont sérialisés.
  -- Le second relit un solde à jour et se voit refuser.
  --
  -- `status = 'active'` — valeur RÉELLE de l'enum (active|completed|expired). Le
  -- français 'actif' avait été écrit d'instinct dans la proposition : la fonction
  -- aurait compilé, ne serait jamais entrée dans cette branche, et aurait répondu
  -- « aucun pack utilisable » à un pilote qui en avait un.
  select * into v_pack from public.heritage_packs
   where user_id = v_user_id and status = 'active'
     and now() >= valid_from and now() <= valid_until
     and sessions_used < sessions_total
   order by valid_until asc limit 1 for update;

  if v_pack.id is null then return jsonb_build_object('ok',false,'error','aucun_pack_utilisable'); end if;

  update public.heritage_packs set sessions_used = sessions_used + 1 where id = v_pack.id;
  update public.registrations set heritage_pack_id = v_pack.id where id = p_registration_id;

  return jsonb_build_object('ok', true, 'pack_id', v_pack.id,
    'sessions_restantes', v_pack.sessions_total - v_pack.sessions_used - 1);
end $$;

revoke all on function public.oxv_use_heritage_session(uuid) from public, anon;
grant execute on function public.oxv_use_heritage_session(uuid) to authenticated;

-- 5 · STOCKAGE DES INSIGNES ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('crew-insignes', 'crew-insignes', false)
on conflict (id) do nothing;

-- Le capitaine écrit dans le dossier de SON écurie (chemin : <crew_id>/<nom>).
drop policy if exists crew_insignes_capitaine_ecrit on storage.objects;
create policy crew_insignes_capitaine_ecrit on storage.objects
  for insert to authenticated
  with check (bucket_id = 'crew-insignes'
    and exists (select 1 from public.crews c
                where c.captain_id = auth.uid()
                  and c.id::text = (storage.foldername(name))[1]));

-- Lecture : son écurie toujours, celle des autres seulement si l'insigne est
-- valide. Fail-closed — une image en attente n'est visible que des siens.
drop policy if exists crew_insignes_lecture on storage.objects;
create policy crew_insignes_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'crew-insignes'
    and exists (select 1 from public.crews c
                where c.id::text = (storage.foldername(name))[1]
                  and (c.insigne_status = 'valide' or c.id = public.oxv_my_crew_id())));
