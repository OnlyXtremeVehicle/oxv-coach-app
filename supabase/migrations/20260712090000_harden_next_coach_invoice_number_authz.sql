-- Durcissement autorisation (P2) — VALIDÉ par le fondateur (2026-07-12).
-- next_coach_invoice_number est SECURITY DEFINER et utilisait p_coach TEL QUEL :
-- un authentifié pouvait faire avancer / lire le compteur d'un AUTRE coach. On
-- force la numérotation sur l'appelant authentifié (p_coach ignoré) + révoque anon.
create or replace function public.next_coach_invoice_number(p_coach uuid, p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cur record;
  alloc int;
  v_coach uuid := auth.uid();
begin
  if v_coach is null then
    raise exception 'not_authenticated';
  end if;
  -- p_coach est ignoré au profit de l'appelant authentifié (garde-fou d'autorisation).
  insert into coach_invoice_counters (coach_id, year, next_number)
    values (v_coach, p_year, 1)
    on conflict (coach_id) do nothing;
  select * into cur from coach_invoice_counters where coach_id = v_coach for update;
  if cur.year <> p_year then
    alloc := 1;
  else
    alloc := cur.next_number;
  end if;
  update coach_invoice_counters set year = p_year, next_number = alloc + 1 where coach_id = v_coach;
  return alloc;
end;
$$;

revoke execute on function public.next_coach_invoice_number(uuid, int) from public;
revoke execute on function public.next_coach_invoice_number(uuid, int) from anon;
grant execute on function public.next_coach_invoice_number(uuid, int) to authenticated;
