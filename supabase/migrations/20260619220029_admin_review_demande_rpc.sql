-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 19 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Revue admin d'une demande d'inscription, depuis l'app.
-- SECURITY DEFINER + garde is_admin() (vérifie l'appelant via auth.uid()).
-- - reject : passe la demande à 'refusee'.
-- - accept : si le compte existe déjà (par e-mail) -> fixe son rôle + 'acceptee'.
--            sinon -> renvoie 'needs_account_creation' (création Auth impossible en SQL).
create or replace function public.admin_review_demande(
  p_demande_id uuid,
  p_action     text,
  p_note       text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d         public.demandes_inscription;
  v_role    public.user_role;
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_action not in ('accept','reject') then
    raise exception 'invalid_action';
  end if;

  select * into d from public.demandes_inscription where id = p_demande_id;
  if not found then
    raise exception 'demande_not_found';
  end if;
  if d.statut <> 'en_attente'::public.oxv_demande_statut then
    return jsonb_build_object('ok', false, 'reason', 'already_processed', 'statut', d.statut);
  end if;

  if p_action = 'reject' then
    update public.demandes_inscription
       set statut='refusee'::public.oxv_demande_statut, admin_note=p_note,
           reviewed_by=auth.uid(), reviewed_at=now()
     where id=p_demande_id;
    return jsonb_build_object('ok', true, 'action','reject', 'statut','refusee');
  end if;

  -- accept
  v_role := case d.type_demande
              when 'coach'::public.oxv_demande_type      then 'coach'::public.user_role
              when 'partenaire'::public.oxv_demande_type then 'partner'::public.user_role
              else 'pilot'::public.user_role
            end;

  select id into v_user_id from public.users where lower(email) = lower(d.email) limit 1;

  if v_user_id is null then
    -- aucun compte : la création Auth ne peut pas se faire ici
    return jsonb_build_object('ok', false, 'reason', 'needs_account_creation', 'type', d.type_demande);
  end if;

  update public.users set role = v_role where id = v_user_id;
  update public.demandes_inscription
     set statut='acceptee'::public.oxv_demande_statut, admin_note=p_note,
         reviewed_by=auth.uid(), reviewed_at=now(), created_user_id=v_user_id
   where id=p_demande_id;

  return jsonb_build_object('ok', true, 'action','accept', 'statut','acceptee',
                            'role', v_role, 'user_id', v_user_id, 'mode','existing');
end;
$$;

revoke all on function public.admin_review_demande(uuid, text, text) from public, anon;
grant execute on function public.admin_review_demande(uuid, text, text) to authenticated;
