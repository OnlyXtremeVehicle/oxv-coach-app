-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 19 juillet 2026 a 01:11:08 UTC, elle n avait jamais ete
-- versionnee dans ce depot sous sa version reelle. Source : colonne statements, recollee
-- dans l ordre d execution. Le formatage d origine et les commentaires hors instruction
-- sont perdus ; le SQL, lui, est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- SEC-1 lot B — PII clients de privatisation : garantie structurelle
-- (source repo : supabase/migrations/20260719121000_sec1_b_pii.sql)

alter table public.sessions
  add constraint sessions_private_client_pii_only_private
  check (
    is_private is true
    or (private_client_name is null and private_client_contact is null)
  ) not valid;

alter table public.sessions
  validate constraint sessions_private_client_pii_only_private;

comment on constraint sessions_private_client_pii_only_private on public.sessions is
  'SEC-1 : les PII de privatisation ne peuvent exister que sur des lignes is_private=true, elles-mêmes réservées aux admins par la policy sessions_select_authenticated. Lecture admin via RPC get_session_private_client.';

alter table public._backup_sessions_20260719 enable row level security;
