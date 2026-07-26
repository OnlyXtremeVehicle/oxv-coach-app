-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 a 23:41:12, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Code d'affiliation privé porté par le pilote (partagé hors app au coach)
alter table public.users add column if not exists affiliation_code text unique;
comment on column public.users.affiliation_code is 'Code privé que le pilote communique à un coach pour l''inviter. Régénérable. Aucun annuaire de pilotes.';

-- Générateur : 8 caractères, alphabet sans ambiguïté (pas de 0/O/1/I/L)
create or replace function public._gen_aff_code()
returns text language sql volatile set search_path to 'public','pg_temp' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random()*31)::int)+1, 1), '')
  from generate_series(1,8);
$$;

-- Le pilote récupère (ou crée à la volée) son code
create or replace function public.get_or_create_my_affiliation_code()
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_id uuid := auth.uid(); v_code text; v_try text; i int := 0;
begin
  if v_id is null then raise exception 'Session requise.'; end if;
  select affiliation_code into v_code from public.users where id = v_id;
  if v_code is not null then return v_code; end if;
  loop
    i := i + 1; v_try := public._gen_aff_code();
    begin
      update public.users set affiliation_code = v_try where id = v_id;
      return v_try;
    exception when unique_violation then
      if i > 12 then raise exception 'Génération du code impossible.'; end if;
    end;
  end loop;
end; $$;

-- Le pilote régénère son code (invalide l'ancien)
create or replace function public.rotate_my_affiliation_code()
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_id uuid := auth.uid(); v_try text; i int := 0;
begin
  if v_id is null then raise exception 'Session requise.'; end if;
  loop
    i := i + 1; v_try := public._gen_aff_code();
    begin
      update public.users set affiliation_code = v_try where id = v_id;
      return v_try;
    exception when unique_violation then
      if i > 12 then raise exception 'Génération du code impossible.'; end if;
    end;
  end loop;
end; $$;

-- Le coach saisit le code -> crée une invitation EN ATTENTE (le pilote confirmera dans l'app)
create or replace function public.redeem_affiliation_code(p_code text)
returns table(link_id uuid, pilot_id uuid, first_name text, last_name text, public_handle text, avatar_url text)
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_coach uuid := auth.uid(); v_pilot uuid; v_link uuid; v_norm text;
begin
  if v_coach is null then raise exception 'Session requise.'; end if;
  if not public.is_coach() then raise exception 'Réservé aux coachs.'; end if;
  v_norm := regexp_replace(upper(coalesce(p_code,'')), '[^A-Z0-9]', '', 'g');
  if length(v_norm) = 0 then raise exception 'Code vide.'; end if;
  select id into v_pilot from public.users where affiliation_code = v_norm;
  if v_pilot is null then raise exception 'Code inconnu.'; end if;
  if v_pilot = v_coach then raise exception 'Code invalide.'; end if;
  if exists (select 1 from public.coach_pilots cp where cp.coach_id = v_coach and cp.pilot_id = v_pilot and cp.status in ('pending','active')) then
    raise exception 'Lien déjà existant avec ce pilote.';
  end if;
  insert into public.coach_pilots (coach_id, pilot_id, initiated_by, status, coach_consent_at, active)
  values (v_coach, v_pilot, 'coach', 'pending', now(), false)
  returning id into v_link;
  return query
    select v_link, u.id, u.first_name, u.last_name, u.public_handle, u.avatar_url
    from public.users u where u.id = v_pilot;
end; $$;

grant execute on function public.get_or_create_my_affiliation_code() to authenticated;
grant execute on function public.rotate_my_affiliation_code() to authenticated;
grant execute on function public.redeem_affiliation_code(text) to authenticated;
