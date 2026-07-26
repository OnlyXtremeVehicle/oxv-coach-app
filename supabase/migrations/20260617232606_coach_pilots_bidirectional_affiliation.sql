-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 à 23:26:06, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Extensions : qui initie, statut, consentement du coach (symétrique du pilote), prix snapshot
alter table public.coach_pilots
  add column if not exists initiated_by public.affiliation_initiator not null default 'coach',
  add column if not exists status public.affiliation_status not null default 'pending',
  add column if not exists coach_consent_at timestamptz,
  add column if not exists affiliation_price_eur integer;

comment on column public.coach_pilots.initiated_by is 'Qui a initié l''affiliation (coach ou pilote).';
comment on column public.coach_pilots.status is 'pending -> active (deux consentements) -> declined | ended.';
comment on column public.coach_pilots.coach_consent_at is 'Acceptation du coach (symétrique de pilot_consent_at).';
comment on column public.coach_pilots.affiliation_price_eur is 'Snapshot du prix d''affiliation au moment du lien (0/NULL = gratuit).';

-- Le coach peut inviter un pilote
create policy coach_pilots_insert_by_coach on public.coach_pilots
  for insert with check (coach_id = auth.uid() and public.is_coach() and initiated_by = 'coach');

-- Le pilote peut inviter un coach
create policy coach_pilots_insert_by_pilot on public.coach_pilots
  for insert with check (pilot_id = auth.uid() and initiated_by = 'pilot');

-- Le coach peut mettre à jour sa propre relation (accepter, clore) -> pose coach_consent_at / status
create policy coach_pilots_update_by_coach on public.coach_pilots
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
