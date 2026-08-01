-- =============================================================================
-- SAUVEGARDE — table `duels`, capturée le 01/08/2026 AVANT suppression
--
-- Règle 0.5 du plan de montage : aucune suppression destructive ne part avant
-- qu'une sauvegarde vérifiée existe. Ce fichier EST cette sauvegarde.
--
-- Ce n'est pas une migration : il n'est pas horodaté et `supabase db push`
-- l'ignore. Il ne sert qu'à reconstruire la table si la décision était un jour
-- reprise.
-- =============================================================================
--
-- CE QUI A ÉTÉ CAPTURÉ, ET CE QUI NE POUVAIT PAS L'ÊTRE
--
-- La table portait **zéro ligne** au moment de la capture (vérifié, 01/08/2026).
-- Il n'y avait donc aucune donnée à sauvegarder : ce fichier préserve la
-- DÉFINITION — colonnes, défauts, type énuméré, clés étrangères, index et
-- policies. Rien n'a été perdu, et rien ne pouvait l'être.
--
-- ---------------------------------------------------------------------------
-- POURQUOI ELLE A ÉTÉ SUPPRIMÉE — c'est doctrinal, pas technique
--
-- Le schéma décrit un affrontement qui se « résout » : `challenger_lap_s` contre
-- `opponent_lap_s`, un `status` qui passe à `completed`, un `resolved_at`. Un
-- duel qui se résout a un vainqueur, et la doctrine OXV interdit tout classement
-- entre pilotes.
--
-- La laisser vide n'était pas neutre : une table présente rouvre la question à
-- chaque relecture du schéma, et un jour quelqu'un la remplit. Décision du
-- fondateur, 01/08/2026.
--
-- ---------------------------------------------------------------------------
-- VÉRIFIÉ AVANT LA SUPPRESSION
--
--   · 0 ligne ;
--   · AUCUNE table ne référence `duels` (aucune clé étrangère entrante) ;
--   · les six contraintes étaient toutes sortantes (users, circuits,
--     telemetry_sessions) ou la clé primaire ;
--   · aucun code applicatif ne la lit ni ne l'écrit.
--
-- Le type `duel_status` est supprimé avec elle : il n'était utilisé nulle part
-- ailleurs.
-- =============================================================================

create type public.duel_status as enum (
  'pending', 'accepted', 'declined', 'completed', 'expired', 'cancelled'
);

create table public.duels (
  id uuid not null default gen_random_uuid(),
  circuit_id uuid not null,
  challenger_id uuid not null,
  opponent_id uuid,
  status duel_status not null default 'pending'::duel_status,
  challenger_session_id uuid,
  challenger_lap_number integer,
  challenger_lap_s numeric,
  opponent_session_id uuid,
  opponent_lap_number integer,
  opponent_lap_s numeric,
  message text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone,
  constraint duels_pkey primary key (id),
  constraint duels_challenger_id_fkey foreign key (challenger_id)
    references public.users(id) on delete cascade,
  constraint duels_opponent_id_fkey foreign key (opponent_id)
    references public.users(id) on delete set null,
  constraint duels_circuit_id_fkey foreign key (circuit_id)
    references public.circuits(id) on delete cascade,
  constraint duels_challenger_session_id_fkey foreign key (challenger_session_id)
    references public.telemetry_sessions(id) on delete set null,
  constraint duels_opponent_session_id_fkey foreign key (opponent_session_id)
    references public.telemetry_sessions(id) on delete set null
);

create index idx_duels_circuit on public.duels using btree (circuit_id);
create index idx_duels_challenger on public.duels using btree (challenger_id);
create index idx_duels_opponent on public.duels using btree (opponent_id);
create index duels_opponent_session_id_fk_idx on public.duels using btree (opponent_session_id);
create index duels_challenger_session_id_fk_idx on public.duels using btree (challenger_session_id);

alter table public.duels enable row level security;

create policy duels_admin_all on public.duels
  for all to public using (is_admin()) with check (is_admin());

create policy duels_insert_challenger on public.duels
  for insert to public with check (challenger_id = auth.uid());

create policy duels_select_participant on public.duels
  for select to public using (challenger_id = auth.uid() or opponent_id = auth.uid());

create policy duels_update_participant on public.duels
  for update to public
  using (challenger_id = auth.uid() or opponent_id = auth.uid())
  with check (challenger_id = auth.uid() or opponent_id = auth.uid());
