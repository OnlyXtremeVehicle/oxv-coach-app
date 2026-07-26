-- P3 durcissement (vérif adversariale 2026-07-12) : idempotence + scoping anon +
-- intégrité du rattachement + nom non vide. Table gatée OFF (flag pilot_waivers).

-- Idempotence : une signature par (pilote, version, réservation). COALESCE car
-- Postgres traite les NULL comme distincts (sinon pas de dédoublonnage hors résa).
create unique index if not exists pilot_waiver_uniq
  on public.pilot_waiver_signatures
  (user_id, waiver_version, coalesce(booking_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Nom de signataire non vide (garde-fou base, en plus de la validation app).
alter table public.pilot_waiver_signatures
  drop constraint if exists pilot_waiver_name_chk;
alter table public.pilot_waiver_signatures
  add constraint pilot_waiver_name_chk check (char_length(btrim(signed_full_name)) >= 2);

-- Policies : scoper à `authenticated` (anon exclu — la clé anon est dans l'APK
-- décompilable) + l'insert ne peut rattacher qu'une réservation/séance DU pilote.
drop policy if exists waiver_owner_select on public.pilot_waiver_signatures;
drop policy if exists waiver_owner_insert on public.pilot_waiver_signatures;
drop policy if exists waiver_admin_select on public.pilot_waiver_signatures;

create policy waiver_owner_select on public.pilot_waiver_signatures
  for select to authenticated using (user_id = auth.uid());

create policy waiver_owner_insert on public.pilot_waiver_signatures
  for insert to authenticated with check (
    user_id = auth.uid()
    and (booking_id is null or booking_id in (
      select id from public.coaching_bookings where pilot_id = auth.uid()
    ))
    and (session_id is null or session_id in (
      select id from public.telemetry_sessions where user_id = auth.uid()
    ))
  );

create policy waiver_admin_select on public.pilot_waiver_signatures
  for select to authenticated using (is_admin());
