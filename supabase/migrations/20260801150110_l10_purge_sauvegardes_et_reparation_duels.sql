-- L10 — deux sauvegardes entrent dans la purge, et RÉPARATION d'une casse.
-- Accord du fondateur : 01/08/2026.
--
-- ============================================================================
-- CE QUI ÉTAIT CASSÉ, ET DEPUIS VINGT MINUTES
-- ============================================================================
--
-- La migration `20260801141032_l21s_drop_duels` a supprimé la table `duels`.
-- `purge_user_data` la référençait DEUX fois :
--
--     delete from public.duels where challenger_id = p_user;
--     update public.duels set opponent_id = null where opponent_id = p_user;
--
-- plpgsql ne vérifie pas l'existence d'une table à la création de la fonction :
-- la casse ne se serait vue qu'à la PREMIÈRE demande d'effacement réelle, et
-- elle l'aurait fait échouer entièrement.
--
-- La vérification faite avant la suppression portait sur le code applicatif et
-- sur les clés étrangères entrantes. **Elle ne couvrait pas les fonctions de la
-- base.** C'est le trou de la méthode, pas un oubli d'attention : un `drop table`
-- doit désormais être précédé d'un balayage de `pg_get_functiondef`.
--
-- Dégât réel : nul. Aucune demande d'effacement n'a été exercée entre-temps
-- (0 compte supprimé, rien en production réelle).
--
-- ============================================================================
-- CE QUE LE FONDATEUR A DÉCIDÉ
-- ============================================================================
--
-- Les cinq tables `_backup_*_20260719` sont CONSERVÉES. Deux d'entre elles
-- portent des données personnelles et entrent dans la purge :
--
--     _backup_registrations_20260719   5 lignes, colonne user_id
--     _backup_payments_20260719        2 lignes, colonne user_id
--
-- Les trois autres n'en portent pas et restent hors purge :
-- `_backup_sessions` (calendrier prévisionnel, 44 journées — voir D-01),
-- `_backup_weather`, `_backup_session_feedback` (vide).
--
-- Ce n'était pas une exposition : aucune de ces tables n'accorde SELECT à `anon`
-- ni à `authenticated` (revérifié le 01/08/2026), donc PostgREST ne les sert
-- pas. C'était un trou d'EFFACEMENT — un compte purgé y survivait.
--
-- Les deux `delete` sont gardés par `to_regclass` : le jour où ces sauvegardes
-- seront supprimées, la purge continuera de fonctionner. On ne refait pas deux
-- fois la même erreur dans la même journée.
-- ============================================================================

create or replace function public.purge_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  delete from public.coach_payout_details   where coach_id = p_user;
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
  delete from public.coach_testimonials        where author_user_id = p_user or coach_id = p_user;
  delete from public.pilot_sheets              where pilot_id = p_user;

  delete from public.session_intentions where user_id = p_user;
  delete from public.session_feedback   where user_id = p_user;
  delete from public.scenic_routes      where user_id = p_user;
  delete from public.ping_rsvps         where user_id = p_user;
  delete from public.social_pings       where created_by = p_user;
  -- `duels` supprimée le 01/08/2026 (L21s, doctrine : pas de vainqueur).
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

  delete from public.biometry_raw          where user_id = p_user;
  delete from public.video_overlays        where user_id = p_user;
  delete from public.founder_applications  where user_id = p_user;
  delete from public.convoy_participants   where user_id = p_user;
  delete from public.convoys               where created_by = p_user;

  -- SAUVEGARDES DU 19/07 qui portent des données personnelles (décision
  -- fondateur du 01/08/2026). Gardées par `to_regclass` : leur suppression
  -- éventuelle ne doit pas casser la purge, comme `duels` vient de le faire.
  if to_regclass('public._backup_registrations_20260719') is not null then
    execute 'delete from public._backup_registrations_20260719 where user_id = $1'
      using p_user;
  end if;
  if to_regclass('public._backup_payments_20260719') is not null then
    execute 'delete from public._backup_payments_20260719 where user_id = $1'
      using p_user;
  end if;

  update public.coaching_bookings  set pilot_first_name = null where pilot_id = p_user;
  update public.crew_members       set referred_by = null      where referred_by = p_user;
  update public.device_assignments set pilot_id = null         where pilot_id = p_user;
  update public.admin_audit        set user_id = null          where user_id = p_user;
  update public.email_log
     set user_id = null, subject = null, metadata = null
   where user_id = p_user;

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
         biometry_capture_consent_at    = null,
         biometry_coach_share_consent_at = null
   where id = p_user;
end;
$function$;
