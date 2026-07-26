-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 20 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

alter table public.social_pings
  add column if not exists share_token text not null
  default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

create unique index if not exists social_pings_share_token_key
  on public.social_pings(share_token);
