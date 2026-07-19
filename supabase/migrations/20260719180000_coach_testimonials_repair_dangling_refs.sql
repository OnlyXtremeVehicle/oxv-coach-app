-- V2-L5-B HOTFIX — APPLIQUÉE en prod le 19/07/2026 (fouvuqkdxarjpjbqnsjq).
--
-- La migration 20260719170000 a `drop table coach_reviews` mais DEUX corps
-- PL/pgSQL le référençaient encore. Postgres NE SUIT PAS les dépendances depuis
-- un corps de fonction/trigger (contrairement aux FK et aux vues), donc le DROP a
-- réussi en silence et laissé ces corps pointer vers une table disparue :
--   1. purge_user_data() : `delete from coach_reviews` → 42P01 → la purge RGPD
--      art.17 avortait ENTIÈREMENT (fonction transactionnelle → rollback total).
--      Le correctif repointe sur coach_testimonials, ce qui COUVRE AUSSI le trou
--      de purge du nouveau schéma : author_first_name + body (données perso
--      dénormalisées) survivaient à la suppression de compte, car le CASCADE des
--      FK ne se déclenche jamais (la purge ANONYMISE la ligne users au lieu de la
--      supprimer).
--   2. moderation_validate_target() : `select 1 from coach_reviews` → signaler un
--      témoignage levait un 42P01 brut chez le pilote. Repointé sur coach_testimonials.
-- Durcissement : les 4 policies passent TO authenticated (l'anon ne lit plus
-- author_first_name / body via la clé anon — l'app exige l'authentification).
--
-- Corps re-émis À L'IDENTIQUE (pg_get_functiondef), SEULES les lignes coach_reviews
-- changent. Vérifié en prod : purge probe UUID-zéro sans 42P01, 0 statement
-- `from public.coach_reviews` restant, policies = {authenticated}.

CREATE OR REPLACE FUNCTION public.purge_user_data(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- coach_reviews supprimee -> coach_testimonials (auteur OU coach = p_user).
  delete from public.coach_testimonials        where author_user_id = p_user or coach_id = p_user;
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

  delete from public.biometry_raw          where user_id = p_user;
  delete from public.video_overlays        where user_id = p_user;
  delete from public.founder_applications  where user_id = p_user;
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

CREATE OR REPLACE FUNCTION public.moderation_validate_target()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.target_type = 'coach_review' then
    if not exists (select 1 from public.coach_testimonials where id = new.target_id) then
      raise exception 'moderation: cible coach_review introuvable ou non visible'
        using errcode = 'foreign_key_violation';
    end if;
  elsif new.target_type = 'partner_offer' then
    if not exists (select 1 from public.partner_offers where id = new.target_id) then
      raise exception 'moderation: cible partner_offer introuvable ou non visible'
        using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$function$;

alter policy coach_testimonials_admin_all   on public.coach_testimonials to authenticated;
alter policy coach_testimonials_author_write on public.coach_testimonials to authenticated;
alter policy coach_testimonials_coach_read  on public.coach_testimonials to authenticated;
alter policy coach_testimonials_public_read on public.coach_testimonials to authenticated;
