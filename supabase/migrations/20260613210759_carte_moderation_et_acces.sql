-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 13 juin 2026 a 21:07 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- 1. Statut de modération sur circuits (privé → soumis → approuvé / rejeté)
alter table public.circuits
  add column review_status text not null default 'private'
  check (review_status in ('private','submitted','approved','rejected'));

-- cohérence : les circuits déjà officiels passent 'approved'
update public.circuits set review_status = 'approved' where is_official = true;

-- 2. FAILLE CORRIGÉE : un utilisateur ne peut plus se promouvoir en officiel
drop policy "Users can update own circuits" on public.circuits;
create policy "Users update own circuits (non official)" on public.circuits
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and is_official = false);

-- 3. Politiques admin sur circuits (voir les soumissions, promouvoir, rejeter)
create policy "Admin view all circuits"  on public.circuits
  for select to authenticated using (public.is_admin());
create policy "Admin update any circuit" on public.circuits
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin delete any circuit" on public.circuits
  for delete to authenticated using (public.is_admin());
create policy "Admin insert circuits"     on public.circuits
  for insert to authenticated with check (public.is_admin());

-- 4. Écriture des lieux réservée à l'admin (lecture déjà en place)
create policy partners_admin_write   on public.partners
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lodgings_admin_write    on public.lodgings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy restaurants_admin_write on public.restaurants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
