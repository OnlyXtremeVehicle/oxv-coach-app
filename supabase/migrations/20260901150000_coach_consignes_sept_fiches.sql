-- LA CONSIGNE DU COACH — la source que sept fiches attendaient.
--
-- Decision du fondateur, 01/09/2026, prise en QCM contre deux alternatives :
-- laisser les sept fiches fermees, ou les ouvrir sur une NOTE. La note a ete
-- ecartee, et c'est le bon arbitrage — `coach_annotations` etablit qu'un coach
-- a ECRIT sur la seance, pas qu'il a nomme quelque chose a suivre. Les ouvrir
-- dessus aurait change ce qu'elles montrent sans changer leur titre.
--
-- CE QU'UNE CONSIGNE EST ICI, ET CE QU'ELLE N'EST PAS
--
-- Elle nomme UN endroit et UNE chose a observer au prochain run. Elle ne dit
-- pas quoi faire du volant : le declencheur doctrinal ci-dessous le refuse, et
-- c'est ce qui tient OXV hors du champ de l'enseignement du pilotage. Le
-- vocabulaire proscrit est celui de `public.is_prescriptive`, deja employe par
-- les notes de coach et les programmes — on le reutilise, on ne le double pas.
--
-- UNE SEULE OUVERTE A LA FOIS, et c'est P39 « Mode un seul changement » qui
-- l'exige : « Que dois-je modifier, et rien d'autre ? » Un index unique
-- partiel le fait tenir en base plutot qu'en TypeScript.
--
-- DEUX SEANCES, PAS UNE. `session_id` est celle qui l'a motivee ; `observee_
-- session_id` celle ou le resultat se lit. P43 « Est-ce que l'action a
-- fonctionne ? » et P44 « Pourquoi ne peut-on pas conclure ? » ont besoin des
-- deux, et P44 existe precisement pour le cas ou la seconde ne tranche rien.

create table if not exists public.coach_consignes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  pilot_id uuid not null references public.users(id) on delete cascade,

  -- La seance qui l'a motivee. NULL = consigne de programme, hors seance.
  session_id uuid references public.telemetry_sessions(id) on delete set null,

  -- Le virage vise, en base 1. NULL = la consigne porte sur la seance entiere.
  -- Aucune borne haute : elle decrirait un circuit, et c'est l'erreur que
  -- `app_segment_analyses_segment_index_check` a coutee jusqu'au 01/09.
  corner_index integer check (corner_index is null or corner_index >= 1),

  -- Ce que le coach nomme. Passe le filtre doctrinal (trigger ci-dessous).
  body text not null check (length(btrim(body)) > 0),

  -- P37 : le pilote confirme avoir compris. C'est LUI qui l'ecrit, personne
  -- d'autre — d'ou sa politique propre.
  comprise_le timestamptz,

  -- P43/P44 : la seance ou le resultat s'observe, et ce que le coach en a lu.
  observee_session_id uuid references public.telemetry_sessions(id) on delete set null,
  observee_le timestamptz,

  -- Fermee : le travail est conclu, une autre consigne peut s'ouvrir.
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_consignes is
  'Consigne du coach : UN endroit, UNE chose a observer au prochain run. Jamais un geste de pilotage — le trigger doctrinal le refuse. Source des fiches P22, P35, P37, P39, P40, P43, P44.';
comment on column public.coach_consignes.session_id is
  'La seance qui a motive la consigne. NULL = consigne de programme.';
comment on column public.coach_consignes.observee_session_id is
  'La seance ou le resultat se lit (P43/P44). Distincte de session_id.';
comment on column public.coach_consignes.comprise_le is
  'P37 : instant ou le PILOTE a confirme avoir compris. Ecrit par lui seul.';

-- UNE SEULE CONSIGNE OUVERTE PAR PILOTE — P39.
create unique index if not exists coach_consignes_une_ouverte_par_pilote
  on public.coach_consignes (pilot_id)
  where closed_at is null;

create index if not exists coach_consignes_par_seance
  on public.coach_consignes (session_id)
  where session_id is not null;

-- ---------------------------------------------------------------------------
-- LE FILTRE DOCTRINAL — le meme que pour les notes partagees.
-- ---------------------------------------------------------------------------
create or replace function public.coach_consigne_doctrine_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.is_prescriptive(new.body) then
    raise exception
      'doctrine_violation: une consigne contient un terme prescriptif (verbe directif interdit)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_coach_consigne_doctrine on public.coach_consignes;
create trigger trg_coach_consigne_doctrine
  before insert or update of body on public.coach_consignes
  for each row execute function public.coach_consigne_doctrine_guard();

-- ---------------------------------------------------------------------------
-- RLS — le coach ecrit pour SES pilotes affilies, le pilote lit les siennes.
-- ---------------------------------------------------------------------------
alter table public.coach_consignes enable row level security;

create policy coach_consignes_pilote_select on public.coach_consignes
  for select using (pilot_id = auth.uid());

create policy coach_consignes_coach_select on public.coach_consignes
  for select using (coach_id = auth.uid());

create policy coach_consignes_coach_insert on public.coach_consignes
  for insert with check (coach_id = auth.uid() and public.is_coach_of(pilot_id));

create policy coach_consignes_coach_update on public.coach_consignes
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy coach_consignes_pilote_update on public.coach_consignes
  for update using (pilot_id = auth.uid()) with check (pilot_id = auth.uid());

create or replace function public.coach_consigne_pilote_ne_change_que_comprise()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = new.pilot_id and auth.uid() <> new.coach_id then
    if new.body is distinct from old.body
       or new.corner_index is distinct from old.corner_index
       or new.session_id is distinct from old.session_id
       or new.observee_session_id is distinct from old.observee_session_id
       or new.closed_at is distinct from old.closed_at then
      raise exception 'Le pilote ne modifie que sa confirmation de comprehension.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_coach_consigne_pilote on public.coach_consignes;
create trigger trg_coach_consigne_pilote
  before update on public.coach_consignes
  for each row execute function public.coach_consigne_pilote_ne_change_que_comprise();

create policy coach_consignes_delete_admin on public.coach_consignes
  for delete using (public.is_admin());
