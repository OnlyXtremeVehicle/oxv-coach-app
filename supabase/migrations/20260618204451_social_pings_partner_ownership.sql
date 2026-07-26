-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Donne aux partenaires la gestion de LEURS propres pings, calquée sur les tables de lieux.
-- Additif : la lecture publique reste (is_published AND is_validated_member()) OR is_admin().
alter table public.social_pings add column if not exists owner_id uuid;
comment on column public.social_pings.owner_id is 'Partenaire propriétaire (RLS partner_manage). Null = ping admin/OXV.';

create policy "social_pings_partner_manage" on public.social_pings
  for all to authenticated
  using (is_partner() and owner_id = auth.uid())
  with check (is_partner() and owner_id = auth.uid());
