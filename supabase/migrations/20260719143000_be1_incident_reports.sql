-- ============================================================================
-- BE-1 · Livrable 4 — Déclarations d'incident (D4).
-- ============================================================================
-- Valeur probatoire assurantielle : IMMUABLE après envoi. Le pilote INSÈRE et
-- LIT les siennes ; l'admin LIT ; PERSONNE ne peut UPDATE/DELETE (pas de policy
-- → refusé par défaut RLS). La photo vit dans pilot-media/{uid}/incidents/ (SEC-1
-- a déjà retiré l'accès coach à ce sous-dossier).
--
-- RGPD art. 17 (droit à l'effacement) : purge-deleted-accounts ANONYMISE
-- (user_id → NULL) au lieu de supprimer — TODO_AVOCAT E5 (déjà posé en SEC-1
-- dans purge_user_data via la garde to_regclass, activée dès cette création).
-- ============================================================================

create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null references public.telemetry_sessions(id),
  user_id uuid null references public.users(id),   -- NULL après anonymisation
  occurred_at timestamptz not null,
  description text not null check (char_length(description) between 10 and 4000),
  photo_path text null,                             -- pilot-media/{uid}/incidents/…
  created_at timestamptz not null default now()
);

alter table public.incident_reports enable row level security;

-- Le pilote DÉCLARE (insert) — occurred_at et description contrôlés par CHECK.
drop policy if exists incident_insert_own on public.incident_reports;
create policy incident_insert_own on public.incident_reports
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Le pilote LIT ses déclarations ; l'admin lit tout.
drop policy if exists incident_select_own_or_admin on public.incident_reports;
create policy incident_select_own_or_admin on public.incident_reports
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- AUCUNE policy UPDATE ni DELETE : immuabilité (valeur probatoire).
-- (Le service_role — purge — passe outre RLS pour l'anonymisation art. 17.)

create index if not exists incident_reports_user on public.incident_reports(user_id);
create index if not exists incident_reports_session on public.incident_reports(session_id);
