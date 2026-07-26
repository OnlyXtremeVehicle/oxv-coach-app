-- 0025_pilot_notes.sql — Carnet pilote (notes libres post-session, M3)
--
-- Espace de notes LIBRES du pilote : ressenti après session, propriété du pilote.
-- Texte libre, horodaté, lié OPTIONNELLEMENT à une session (on delete set null :
-- effacer une session ne détruit jamais le ressenti écrit).
--
-- Doctrine (V5_ECRANS_PAR_ROLE, P-E Carnet pilote) : l'app ne pré-remplit ni ne
-- suggère JAMAIS le contenu. Pas de template, pas de placeholder suggestif, pas
-- de score, pas d'IA qui rédige. Le carnet est à vous. L'app affiche, n'interprète pas.
--
-- Confidentialité : own-row strict (espace intime, calqué sur pilot_goals 0023).
-- Le PARTAGE est OPT-IN PAR NOTE : le pilote peut marquer une note
-- `shared_with_coach = true` ; son coach actif ET consenti (is_coach_of, qui
-- vérifie déjà coach_pilots.active + pilot_consent_at) la lit alors EN LECTURE
-- SEULE. Révocable immédiatement : repasser le flag à false coupe l'accès.
-- Le partenaire n'accède JAMAIS (règle cardinale §148 — aucune policy partenaire).
-- L'admin n'a pas de SELECT (pas un objet d'administration). L'accès coach est
-- journalisé applicativement via log_coach_view (RGPD, consultable par le pilote).

create table public.pilot_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.telemetry_sessions (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 5000),
  shared_with_coach boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pilot_notes_user on public.pilot_notes (user_id, created_at desc);

-- Trigger updated_at (les notes s'éditent). search_path durci (standard maison
-- 20260615190000) pour neutraliser l'advisor function_search_path_mutable.
create or replace function public.pilot_notes_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pilot_notes_updated_at on public.pilot_notes;
create trigger pilot_notes_updated_at
  before update on public.pilot_notes
  for each row execute function public.pilot_notes_set_updated_at();

alter table public.pilot_notes enable row level security;

-- Own-row strict : le pilote gère SES notes, et lui seul. Le lien session est
-- borné à SES propres sessions (intégrité, pas de rattachement cross-pilote).
create policy pilot_notes_owner_all on public.pilot_notes
for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    session_id is null
    or session_id in (select id from public.telemetry_sessions where user_id = auth.uid())
  )
);

-- Coach EN LECTURE SEULE, uniquement sur les notes que le pilote a explicitement
-- partagées (shared_with_coach) ET dont il est le coach actif/consenti (is_coach_of).
-- Aucune écriture coach. Révocation = flag à false → la note disparaît de sa vue.
create policy pilot_notes_coach_select on public.pilot_notes
for select
to authenticated
using (shared_with_coach = true and public.is_coach_of(user_id));

comment on table public.pilot_notes is
  'Carnet pilote : notes libres post-session, propriete du pilote. Espace intime own-row. Partage opt-in par note (shared_with_coach) en lecture seule vers le coach consente ; jamais visible des partenaires ni admins. L app ne pre-remplit ni ne suggere jamais le contenu.';
