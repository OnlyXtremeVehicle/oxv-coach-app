-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 a 23:56:01, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Cadrer les repères par circuit (table vide -> pas de backfill)
alter table public.coach_corner_reference
  drop constraint if exists coach_corner_reference_coach_id_corner_index_key;

alter table public.coach_corner_reference
  add column circuit_id uuid not null references public.circuits(id) on delete cascade;

comment on column public.coach_corner_reference.circuit_id is 'Circuit auquel se rapporte le repère (le numéro de virage seul est ambigu en multi-circuits).';

alter table public.coach_corner_reference
  add constraint coach_corner_reference_coach_circuit_corner_key unique (coach_id, circuit_id, corner_index);
