-- session_intentions — Intention de séance (V9 §7)
--
-- Ce que le pilote choisit d'EXPLORER, posé AVANT la séance (en préparation,
-- quand la séance n'existe pas encore : session_id null), puis rattaché à la
-- séance à sa création. Sert ensuite à juxtaposer « ce que je voulais » et « ce
-- que la trace raconte » — le pilote conclut, l'app ne juge pas.
--
-- Calqué sur pilot_notes (0025) : own-row strict + coach EN LECTURE SEULE sur
-- les intentions partagées (shared_with_coach) ET seulement si coach actif et
-- consenti (is_coach_of). Partenaire et admin n'accèdent jamais (cardinale §148).
-- Doctrine : l'app ne pré-remplit ni ne suggère JAMAIS le contenu — le pilote écrit.

create table public.session_intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  circuit_id uuid references public.circuits (id) on delete set null,
  session_id uuid references public.telemetry_sessions (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  shared_with_coach boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_session_intentions_user
  on public.session_intentions (user_id, created_at desc);
create index idx_session_intentions_session
  on public.session_intentions (session_id) where session_id is not null;
-- Recherche de l'intention « en attente » (prépa) à rattacher à la séance créée.
create index idx_session_intentions_pending
  on public.session_intentions (user_id, circuit_id, created_at desc) where session_id is null;

-- Trigger updated_at : réutilise la fonction partagée durcie (search_path).
drop trigger if exists session_intentions_updated_at on public.session_intentions;
create trigger session_intentions_updated_at
  before update on public.session_intentions
  for each row execute function public.tg_touch_updated_at();

alter table public.session_intentions enable row level security;

-- Own-row strict : le pilote gère SES intentions. Le lien session est borné à SES
-- propres séances (intégrité, pas de rattachement cross-pilote). circuit libre
-- (l'intention précède la séance).
create policy session_intentions_owner_all on public.session_intentions
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

-- Coach EN LECTURE SEULE, uniquement sur les intentions explicitement partagées
-- ET dont il est le coach actif/consenti. Aucune écriture coach. Partenaire et
-- admin n'accèdent jamais (règle cardinale §148).
create policy session_intentions_coach_select on public.session_intentions
for select
to authenticated
using (shared_with_coach = true and public.is_coach_of(user_id));

comment on table public.session_intentions is
  'Intention de seance (V9) : ce que le pilote choisit d explorer, posee AVANT la seance (session_id null en prepa, rattachee a la creation). Own-row strict. Partage opt-in (shared_with_coach) en lecture seule vers le coach consente ; jamais visible des partenaires ni admins. L app ne pre-remplit ni ne suggere jamais le contenu.';
