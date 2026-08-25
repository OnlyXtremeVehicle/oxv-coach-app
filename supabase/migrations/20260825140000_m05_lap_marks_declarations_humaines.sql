-- =============================================================================
-- M05 · `lap_marks` — la déclaration humaine sur un tour, et son audit.
-- Décision fondateur du 25/08/2026 : table dédiée, pas une colonne jsonb.
-- =============================================================================
--
-- POURQUOI UNE TABLE, ET PAS `laps.marques jsonb`
--
-- Le cahier de veille exige, pour M05 : « chaque inclusion/exclusion conserve
-- un motif audité ». Un jsonb sur `laps` ne porte ni auteur, ni horodatage, et
-- deux acteurs qui marquent le même tour s'écrasent l'un l'autre. Une ligne par
-- décision donne l'audit gratuitement, et le retrait d'une marque reste une
-- trace (la ligne disparaît, l'autre reste).
--
-- CE QUE L'INSPECTION DES POLITIQUES RÉELLES A DICTÉ, AVANT ÉCRITURE
--
--   1. `laps` n'a PAS la politique « ami » que porte `telemetry_sessions`
--      (`telemetry_sessions_select_friend`). Un ami voit donc la séance, pas
--      les tours. Les marques suivent les TOURS, pas la séance : aucun accès
--      ami ici. Supposer la symétrie aurait ouvert une porte de trop.
--
--   2. `purge_user_data` ÉNUMÈRE ses tables (le dépôt a déjà connu des
--      « tables oubliées », migration rgpd_purge_tables_oubliees_v2). Le
--      cascade depuis `telemetry_sessions` couvre le pilote effacé ; il ne
--      couvre PAS un coach effacé dont les marques vivent chez d'autres.
--      La ligne est donc ajoutée explicitement à la purge, en bas de fichier.
--
--   3. Le coach est en LECTURE SEULE sur les données du pilote. Une marque de
--      coach n'est pas une modification du tour : c'est SA ligne, signée, à
--      côté — exactement le modèle de `coach_annotations`. Le tour, lui, n'est
--      jamais touché.
--
-- CE QUI EST VOLONTAIREMENT ABSENT
--
--   • Aucune politique UPDATE. Une marque ne se corrige pas : elle se retire
--     et se repose. C'est ce qui rend l'audit vrai — une ligne dit ce que
--     quelqu'un a déclaré à un instant, et personne ne peut la réécrire après.
--
--   • Aucun statut « validé ». La machine doute (`validationToursLogic` dit
--     « suspect » avec son fait) ; l'humain déclare. Les deux cohabitent sans
--     que l'un arbitre l'autre.
--
-- =============================================================================

-- 1 · LE VOCABULAIRE, CLOS -----------------------------------------------------
-- Les cinq motifs du cahier (« trafic, chauffe, essai, incident ou tour
-- représentatif ») plus `ecarte`, la mise à l'écart nue. Un enum plutôt qu'un
-- texte libre : ce qui se compte doit se nommer d'avance.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'lap_mark_kind_enum') then
    create type public.lap_mark_kind_enum as enum (
      'gene_par_le_trafic',
      'tour_de_chauffe',
      'essai_reglage',
      'incident',
      'representatif',
      'ecarte'
    );
  end if;
end $$;

-- 2 · LA TABLE ----------------------------------------------------------------
create table if not exists public.lap_marks (
  id          uuid primary key default gen_random_uuid(),
  lap_id      uuid not null references public.laps(id)               on delete cascade,
  session_id  uuid not null references public.telemetry_sessions(id) on delete cascade,
  author_id   uuid not null references public.users(id)              on delete cascade,
  kind        public.lap_mark_kind_enum not null,
  motif       text,
  created_at  timestamptz not null default now(),
  constraint lap_marks_motif_non_vide check (motif is null or length(btrim(motif)) > 0)
);

comment on table public.lap_marks is
  'Déclarations humaines sur un tour (trafic, chauffe, essai, incident, représentatif, écarté). '
  'Une ligne = une décision signée et horodatée. Sans UPDATE : une marque se retire, elle ne se réécrit pas.';
comment on column public.lap_marks.author_id is
  'Qui déclare. Le pilote de la séance, ou son coach. La marque du coach est SA ligne — le tour n''est pas touché.';
comment on column public.lap_marks.motif is
  'Le mot de l''auteur, libre et facultatif. Le fait mesuré, lui, vient de validationToursLogic — il ne se range pas ici.';

-- Une même personne ne déclare pas deux fois la même chose sur le même tour.
create unique index if not exists lap_marks_unicite_auteur_tour_type
  on public.lap_marks (lap_id, author_id, kind);

-- Les deux lectures réelles : « les marques de ce tour », « les marques de
-- cette séance » (l'écran Tours les charge d'un coup pour toute la séance).
create index if not exists lap_marks_lap_idx     on public.lap_marks (lap_id);
create index if not exists lap_marks_session_idx on public.lap_marks (session_id, lap_id);

-- 3 · COHÉRENCE ---------------------------------------------------------------
-- `session_id` est dénormalisé pour que la RLS et l'écran ne joignent pas
-- `laps` à chaque ligne. Dénormaliser sans garde, c'est inviter la dérive :
-- le trigger refuse une marque dont la séance ne serait pas celle du tour.
create or replace function public.lap_marks_verifie_session()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.laps l
    where l.id = new.lap_id and l.session_id = new.session_id
  ) then
    raise exception 'lap_marks : le tour % n''appartient pas à la séance %', new.lap_id, new.session_id;
  end if;
  return new;
end $$;

revoke execute on function public.lap_marks_verifie_session() from public, anon, authenticated;

drop trigger if exists lap_marks_verifie_session_trg on public.lap_marks;
create trigger lap_marks_verifie_session_trg
  before insert on public.lap_marks
  for each row execute function public.lap_marks_verifie_session();

-- 4 · RLS ---------------------------------------------------------------------
alter table public.lap_marks enable row level security;

-- LECTURE. Le pilote de la séance voit tout ce qui est déclaré sur ses tours —
-- y compris par son coach : une marque cachée qui déplacerait sa référence
-- serait une donnée qu'on lui oppose sans le lui dire.
drop policy if exists lap_marks_select on public.lap_marks;
create policy lap_marks_select on public.lap_marks
  for select to authenticated
  using (
    session_id in (select s.id from public.telemetry_sessions s where s.user_id = auth.uid())
    or author_id = auth.uid()
    or session_id in (select s.id from public.telemetry_sessions s where is_coach_of(s.user_id))
    or is_admin()
  );

-- ÉCRITURE. On signe ce qu'on déclare, et seulement chez soi ou chez son
-- pilote. `with check` porte les deux conditions : l'identité de l'auteur ET
-- son droit sur la séance.
drop policy if exists lap_marks_insert on public.lap_marks;
create policy lap_marks_insert on public.lap_marks
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      session_id in (select s.id from public.telemetry_sessions s where s.user_id = auth.uid())
      or session_id in (select s.id from public.telemetry_sessions s where is_coach_of(s.user_id))
    )
  );

-- RETRAIT. On ne retire que sa propre déclaration. Le pilote ne peut pas
-- effacer la marque de son coach, ni l'inverse : chacun répond de la sienne.
drop policy if exists lap_marks_delete on public.lap_marks;
create policy lap_marks_delete on public.lap_marks
  for delete to authenticated
  using (author_id = auth.uid());

-- Aucune politique UPDATE : voir l'en-tête. C'est délibéré.

revoke all on public.lap_marks from anon;
grant select, insert, delete on public.lap_marks to authenticated;

-- 5 · RGPD --------------------------------------------------------------------
--
-- `purge_user_data` ANONYMISE la ligne `users` — elle ne la supprime pas. Le
-- `on delete cascade` de `author_id` ne se déclenche donc JAMAIS pour un compte
-- purgé : il ne reste qu'un filet pour une vraie suppression de ligne.
--
-- Le cascade depuis `telemetry_sessions` couvre les marques du pilote sur SES
-- tours. Il ne couvre pas celles qu'un coach a déposées chez ses pilotes. Sans
-- la ligne ci-dessous, elles survivraient à son effacement — c'est exactement
-- le défaut qu'a corrigé `rgpd_purge_tables_oubliees_v2`.
--
-- La fonction fait 9 Ko. La retranscrire pour ajouter une ligne, c'est risquer
-- d'en perdre une autre au passage : on l'édite donc à l'ancre, et on ÉCHOUE
-- BRUYAMMENT si l'ancre a bougé. Un patch silencieux qui ne s'applique pas
-- serait pire que pas de patch du tout.
do $$
declare
  v_def text;
  v_ancre constant text := '  update public.users' || chr(10) || '     set email';
  -- Le corps de purge_user_data est dollar-quoté ($function$) : les quotes y
  -- sont simples. Ici, en littéral SQL, chacune s'écrit donc doublée.
  v_ajout constant text :=
    '  -- M05 : les marques déposées par cette personne CHEZ D''AUTRES.' || chr(10) ||
    '  if to_regclass(''public.lap_marks'') is not null then' || chr(10) ||
    '    execute ''delete from public.lap_marks where author_id = $1'' using p_user;' || chr(10) ||
    '  end if;' || chr(10) || chr(10);
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'purge_user_data';

  if v_def is null then
    raise exception 'purge_user_data introuvable : la purge RGPD ne couvrirait pas lap_marks.';
  end if;

  -- Idempotence : rejouer la migration ne doit pas empiler le patch.
  if position('lap_marks' in v_def) > 0 then
    raise notice 'purge_user_data couvre déjà lap_marks — rien à faire.';
    return;
  end if;

  if position(v_ancre in v_def) = 0 then
    raise exception
      'purge_user_data : ancre d''anonymisation introuvable. Ajouter à la main '
      '« delete from public.lap_marks where author_id = p_user; » avant la mise à jour de public.users.';
  end if;

  execute replace(v_def, v_ancre, v_ajout || v_ancre);
end $$;
