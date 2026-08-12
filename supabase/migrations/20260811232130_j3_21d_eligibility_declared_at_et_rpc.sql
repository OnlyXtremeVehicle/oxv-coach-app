-- =============================================================================
-- JALON 3 · LOT 21d — LE PILOTE PEUT DÉCLARER, SANS QU'ON ÉLARGISSE RIEN
--
-- APPLIQUÉE EN PRODUCTION le 11/08/2026 via l'API Supabase. Ce fichier a été
-- écrit APRÈS coup, le 12/08. Le contenu est celui qui a tourné.
--
-- POURQUOI UNE RPC ET NON UNE POLICY.
--
-- La RLS garde la LIGNE, jamais la COLONNE. Une policy d'écriture pour le
-- pilote lui ouvrirait TOUTE la ligne — `status`, `validated_by`,
-- `validated_at` compris. Le pilote pourrait se valider lui-même, ce qui vide
-- l'éligibilité de son sens.
--
-- Restreindre par GRANT de colonne n'aurait pas marché non plus : `anon` et
-- `authenticated` portent déjà UPDATE sur toute la table — défaut Supabase,
-- mesuré le 05/08/2026 — et un grant de colonne s'AJOUTE, il ne retranche pas.
-- Il aurait fallu révoquer d'abord, donc casser l'écriture administrative.
-- C'est exactement le piège que l'équipe du site s'apprêtait à poser sur
-- `registrations`.
--
-- CE QU'ELLE N'EST PAS. Déclarer n'est pas valider. `status` n'est pas touché,
-- `validated_by` non plus : l'administration reste seule à valider.
-- =============================================================================

alter table public.eligibility_items
  add column if not exists declared_at timestamptz;

comment on column public.eligibility_items.declared_at is
  'Quand le pilote a déclaré détenir la pièce. N''est PAS une validation : '
  'seule l''administration écrit `status` et `validated_by`.';

create or replace function public.declare_eligibility_item(
  p_registration_id uuid,
  p_item_key text,
  p_declare boolean default true
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid       uuid := auth.uid();
  v_titulaire uuid;
  v_statut    text;
  v_quand     timestamptz;
begin
  if v_uid is null then
    raise exception 'Session expirée.' using errcode = '42501';
  end if;

  select r.user_id, e.status
    into v_titulaire, v_statut
    from public.eligibility_items e
    join public.registrations r on r.id = e.registration_id
   where e.registration_id = p_registration_id
     and e.item_key = p_item_key;

  if not found then
    raise exception 'Pièce introuvable.' using errcode = 'P0002';
  end if;

  if v_titulaire is distinct from v_uid then
    raise exception 'Cette inscription n''est pas la vôtre.' using errcode = '42501';
  end if;

  -- UNE PIÈCE DÉJÀ VALIDÉE NE SE REDÉCLARE PAS.
  if v_statut = 'validated' then
    raise exception 'Cette pièce est déjà validée.' using errcode = 'P0001';
  end if;

  v_quand := case when p_declare then now() else null end;

  update public.eligibility_items
     set declared_at = v_quand
   where registration_id = p_registration_id
     and item_key = p_item_key;

  return v_quand;
end;
$$;

revoke all on function public.declare_eligibility_item(uuid, text, boolean) from public, anon;
grant execute on function public.declare_eligibility_item(uuid, text, boolean) to authenticated;

comment on function public.declare_eligibility_item(uuid, text, boolean) is
  'Le pilote déclare détenir une pièce d''éligibilité — ou revient sur sa '
  'déclaration. N''écrit QUE `declared_at`, et seulement sur sa propre '
  'inscription. Ne valide rien.';
