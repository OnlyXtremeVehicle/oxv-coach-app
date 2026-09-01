-- UNE SEANCE NE PEUT PAS ROULER LE VEHICULE D'UN AUTRE COMPTE.
--
-- Constate le 01/09/2026 : DEUX seances de production portaient le
-- `vehicle_id` d'une Porsche 911 GT3 inscrite a un autre compte que leur
-- proprietaire. La cle etrangere ne dit rien de cela — elle verifie que le
-- vehicule EXISTE, pas a qui il est.
--
-- La consequence se voit a l'ecran : sous RLS, le pilote ne lit pas le
-- vehicule d'un tiers, la resolution rend `null`, et l'ecran affiche
-- « Vehicule non rattache ». Le pilote lit une absence la ou il y a une
-- incoherence de rattachement.
--
-- Le declencheur refuse le rattachement plutot que de le laisser passer. Il ne
-- touche AUCUNE ligne existante : les seances deja ecrites restent telles
-- quelles, et ne seront refusees qu'a leur prochaine ecriture — ce qui est le
-- moment ou quelqu'un s'en occupe.
--
-- `vehicle_id` NUL reste licite : une seance sans vehicule declare est un etat
-- normal, et le dire vaut mieux que de deviner.
create or replace function public.seance_vehicule_du_meme_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proprietaire uuid;
begin
  if new.vehicle_id is null then
    return new;
  end if;

  select v.user_id into proprietaire from public.vehicles v where v.id = new.vehicle_id;

  if proprietaire is null then
    return new; -- la cle etrangere s'en charge, on ne double pas sa faute
  end if;

  if proprietaire <> new.user_id then
    raise exception
      'Vehicule % inscrit au compte %, seance au compte % : rattachement refuse.',
      new.vehicle_id, proprietaire, new.user_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_seance_vehicule_du_meme_compte on public.telemetry_sessions;

create trigger trg_seance_vehicule_du_meme_compte
  before insert or update of vehicle_id, user_id on public.telemetry_sessions
  for each row
  execute function public.seance_vehicule_du_meme_compte();

comment on function public.seance_vehicule_du_meme_compte() is
  'Refuse une seance dont le vehicule appartient a un autre compte. Pose le 01/09/2026 apres deux cas reels ; ne touche aucune ligne existante.';
