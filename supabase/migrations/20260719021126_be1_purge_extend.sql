-- ============================================================================
-- BE-1 · Extension de la purge RGPD aux tables BE-1.
-- ============================================================================
-- purge_user_data() (SEC-1) portait déjà des gardes to_regclass pour
-- biometry_raw (→ purge) et incident_reports (→ anonymisation, TODO_AVOCAT E5),
-- désormais actives puisque ces tables existent. On AJOUTE ici les autres
-- tables BE-1 (video_overlays, founder_applications, convoy_participants,
-- convoys créés par soi) au corps de la fonction — matrice 14_PURGE_MATRIX.md.
--
-- Note : biometry_raw et video_overlays sont CASCADE sur users, donc déjà
-- couverts par la suppression finale ; on les purge explicitement AVANT le
-- scrub pour ne rien laisser derrière si la stratégie users passe un jour de
-- « anonymiser » à « conserver la ligne ». founder_applications est aussi
-- CASCADE ; on le purge explicitement (motivation = donnée personnelle).
-- ============================================================================

create or replace function public.purge_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.telemetry_sessions   where user_id = p_user;
  delete from public.vehicles             where user_id = p_user;
  delete from public.documents            where user_id = p_user;
  delete from public.app_session_analyses where user_id = p_user;
  delete from public.app_segment_analyses where user_id = p_user;
  delete from public.app_progression_shares where user_id = p_user;
  delete from public.circuits             where user_id = p_user;
  delete from public.heritage_packs       where user_id = p_user;
  delete from public.ritual_dispatches    where user_id = p_user;
  delete from public.pilot_goals          where user_id = p_user;
  delete from public.session_media        where pilot_user_id = p_user;
  delete from public.coach_permissions    where user_id = p_user;
  delete from public.coach_pilots         where pilot_id = p_user or coach_id = p_user;
  delete from public.coach_session_context where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_corner_reference where coach_id = p_user;
  delete from public.coach_reading_weights  where coach_id = p_user;
  delete from public.coach_roulages         where coach_id = p_user;
  delete from public.roulage_invitations    where pilot_id = p_user;
  delete from public.pilot_friendships
    where initiator_id = p_user or pilot_a = p_user or pilot_b = p_user;

  delete from public.coach_profiles            where coach_id = p_user;
  delete from public.coach_annotations         where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_annotation_template where coach_id = p_user;
  delete from public.coach_availability        where coach_id = p_user;
  delete from public.coach_objectives          where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_pilot_highlight     where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_messages            where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_reviews             where pilot_id = p_user or coach_id = p_user;
  delete from public.pilot_sheets              where pilot_id = p_user;

  delete from public.session_intentions where user_id = p_user;
  delete from public.session_feedback   where user_id = p_user;
  delete from public.scenic_routes      where user_id = p_user;
  delete from public.ping_rsvps         where user_id = p_user;
  delete from public.social_pings       where created_by = p_user;
  delete from public.duels              where challenger_id = p_user;
  delete from public.crew_members       where user_id = p_user;

  delete from public.demandes_inscription where created_user_id = p_user;
  delete from public.contact_messages     where user_id = p_user;
  delete from public.support_messages
    where author_id = p_user
       or ticket_id in (select id from public.support_tickets where user_id = p_user);
  delete from public.support_tickets      where user_id = p_user;

  delete from public.media               where user_id = p_user;
  delete from public.media_exports       where user_id = p_user;
  delete from public.event_registrations where pilot_id = p_user;
  delete from public.partner_accounts    where profile_id = p_user;
  delete from public.partner_leads       where pilot_id = p_user;
  delete from public.app_pairing_codes   where user_id = p_user;

  -- ── BE-1 : nouvelles tables (données personnelles effaçables) ──────────────
  delete from public.biometry_raw          where user_id = p_user;   -- santé (art. 9)
  delete from public.video_overlays        where user_id = p_user;   -- métadonnées vidéo privées
  delete from public.founder_applications  where user_id = p_user;   -- motivation = personnel
  delete from public.convoy_participants   where user_id = p_user;
  delete from public.convoys               where created_by = p_user;

  update public.coaching_bookings  set pilot_first_name = null where pilot_id = p_user;
  update public.duels              set opponent_id = null      where opponent_id = p_user;
  update public.crew_members       set referred_by = null      where referred_by = p_user;
  update public.device_assignments set pilot_id = null         where pilot_id = p_user;
  update public.admin_audit        set user_id = null          where user_id = p_user;
  update public.email_log
     set user_id = null, subject = null, metadata = null
   where user_id = p_user;

  -- incident_reports : ANONYMISER (art. 17 vs valeur probatoire) — TODO_AVOCAT E5.
  if to_regclass('public.incident_reports') is not null then
    execute 'update public.incident_reports set user_id = null where user_id = $1'
      using p_user;
  end if;

  update public.users
     set email                      = 'deleted-' || p_user::text || '@oxv.invalid',
         first_name                 = null,
         last_name                  = null,
         birth_date                 = null,
         phone                      = null,
         address_line               = null,
         address_zip                = null,
         address_city               = null,
         address_country            = null,
         emergency_contact_name     = null,
         emergency_contact_phone    = null,
         emergency_contact_relation = null,
         blood_type                 = null,
         medical_notes              = null,
         ffsa_license               = null,
         experience_years           = null,
         avatar_url                 = null,
         public_handle              = null,
         admin_notes                = null,
         expo_push_token            = null,
         notification_preferences   = null,
         push_notif_enabled         = false,
         bio                        = null,
         socials                    = null,
         media                      = null,
         livery                     = null,
         vehicle                    = null,
         car_number                 = null,
         affiliation_code           = null,
         suspension_reason          = null,
         pavilion_name_optin        = false,
         pavilion_name_optin_at     = null,
         accepts_marketing          = false,
         -- BE-1 : consentements biométrie révoqués à la suppression.
         biometry_capture_consent_at    = null,
         biometry_coach_share_consent_at = null
   where id = p_user;
end;
$$;

revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;
