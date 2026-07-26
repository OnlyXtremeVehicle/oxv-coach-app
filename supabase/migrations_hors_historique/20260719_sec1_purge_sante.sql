-- =============================================================================
-- SEC-1 — PRÉPARÉE, NON APPLIQUÉE — approbation fondateur requise
-- =============================================================================
-- Chantier 2 · Action 5 — Purge santé cohérente (audit : docs/architecture/
-- 14_PURGE_MATRIX.md). Cette migration crée la fonction TRANSACTIONNELLE
-- public.purge_user_data(uuid) appelée par l'edge purge-deleted-accounts v5.
--
-- Elle remplace les ~23 DELETE séquentiels de l'edge v4 (non transactionnels,
-- périmètre incomplet) par un DML unique tout-ou-rien qui :
--   - reprend le périmètre v4 (section A de la matrice) ;
--   - comble les écarts (section B) : coach_profiles (SIRET/adresse/payment_link),
--     coach_annotations, messagerie, session_intentions, pilot_sheets,
--     session_feedback, demandes_inscription, contact_messages, support,
--     médias, événements, partenaires, social, duels, crews, pairing ;
--   - anonymise (au lieu d'ignorer) : coaching_bookings.pilot_first_name,
--     email_log, admin_audit.user_id, device_assignments.pilot_id,
--     duels.opponent_id, crew_members.referred_by ;
--   - étend le scrub users aux colonnes post-v4 (bio, socials, media, livery,
--     vehicle, car_number, affiliation_code, suspension_reason, pavillon) ;
--   - pose par avance les politiques des tables FUTURES via to_regclass :
--       incident_reports -> ANONYMISER (user_id NULL), JAMAIS purger,
--                           TODO_AVOCAT E5 ;
--       biometry_raw     -> PURGE (donnée de santé, art. 9).
--
-- ORDRE DE DÉPLOIEMENT (après approbation) : cette migration D'ABORD, puis
-- l'edge v5 (elle appelle rpc('purge_user_data')). Le Storage et l'Auth restent
-- gérés par l'edge (non transactionnels par nature).
-- =============================================================================

create or replace function public.purge_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- ---------------------------------------------------------------------------
  -- 1. Périmètre v4 repris (données personnelles effaçables).
  --    telemetry_sessions -> cascade telemetry_frames / laps / météo.
  -- ---------------------------------------------------------------------------
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

  -- ---------------------------------------------------------------------------
  -- 2. Écarts comblés — PURGE (tables ignorées par la v4, cf. matrice §B).
  -- ---------------------------------------------------------------------------
  -- Coach : profil de facturation (SIRET, adresse, payment_link) + contenus.
  delete from public.coach_profiles            where coach_id = p_user;
  delete from public.coach_annotations         where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_annotation_template where coach_id = p_user;
  delete from public.coach_availability        where coach_id = p_user;
  delete from public.coach_objectives          where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_pilot_highlight     where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_messages            where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_reviews             where pilot_id = p_user or coach_id = p_user;
  delete from public.pilot_sheets              where pilot_id = p_user;

  -- Expression personnelle et social.
  delete from public.session_intentions where user_id = p_user;
  delete from public.session_feedback   where user_id = p_user;
  delete from public.scenic_routes      where user_id = p_user;
  delete from public.ping_rsvps         where user_id = p_user;
  delete from public.social_pings       where created_by = p_user;
  delete from public.duels              where challenger_id = p_user;
  delete from public.crew_members       where user_id = p_user;

  -- Copies de PII et canaux entrants.
  delete from public.demandes_inscription where created_user_id = p_user;
  delete from public.contact_messages     where user_id = p_user;
  delete from public.support_messages
    where author_id = p_user
       or ticket_id in (select id from public.support_tickets where user_id = p_user);
  delete from public.support_tickets      where user_id = p_user;

  -- Médias, événements, partenaires, technique.
  -- (les objets Storage de `media` sont collectés par l'edge AVANT cet appel)
  delete from public.media               where user_id = p_user;
  delete from public.media_exports       where user_id = p_user;
  delete from public.event_registrations where pilot_id = p_user;
  delete from public.partner_accounts    where profile_id = p_user;
  delete from public.partner_leads       where pilot_id = p_user;
  delete from public.app_pairing_codes   where user_id = p_user;

  -- ---------------------------------------------------------------------------
  -- 3. Écarts comblés — ANONYMISATION (la ligne reste, le lien identifiant part).
  -- ---------------------------------------------------------------------------
  update public.coaching_bookings  set pilot_first_name = null where pilot_id = p_user;
  update public.duels              set opponent_id = null      where opponent_id = p_user;
  update public.crew_members       set referred_by = null      where referred_by = p_user;
  update public.device_assignments set pilot_id = null         where pilot_id = p_user;
  update public.admin_audit        set user_id = null          where user_id = p_user;
  -- email_log : délogé du compte ; type/statut/dates conservés (délivrabilité).
  update public.email_log
     set user_id = null, subject = null, metadata = null
   where user_id = p_user;

  -- ---------------------------------------------------------------------------
  -- 4. Tables FUTURES (n'existent pas au 19/07/2026) — politiques posées.
  -- ---------------------------------------------------------------------------
  -- incident_reports : ANONYMISER, JAMAIS PURGER (sécurité/assurance).
  -- TODO_AVOCAT E5 : durée de rétention + périmètre exact du gel à arbitrer.
  -- À la création de la table : colonne anonymized_at + trigger de gel.
  if to_regclass('public.incident_reports') is not null then
    execute 'update public.incident_reports set user_id = null where user_id = $1'
      using p_user;
  end if;

  -- biometry_raw : donnée de santé (art. 9) -> purge totale.
  if to_regclass('public.biometry_raw') is not null then
    execute 'delete from public.biometry_raw where user_id = $1' using p_user;
  end if;

  -- ---------------------------------------------------------------------------
  -- 5. Scrub de la ligne users (conservée pour le lien facturation).
  --    Conservés à dessein : stripe_customer_id (réconciliation), acceptations
  --    pacte/CGU/confidentialité (preuve de consentement), deletion_* (preuve
  --    d'exécution de l'effacement), role/kyc/timestamps (non identifiants).
  -- ---------------------------------------------------------------------------
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
         blood_type                 = null,  -- donnée de SANTÉ
         medical_notes              = null,  -- donnée de SANTÉ
         ffsa_license               = null,
         experience_years           = null,
         avatar_url                 = null,
         public_handle              = null,
         admin_notes                = null,
         expo_push_token            = null,
         notification_preferences   = null,
         push_notif_enabled         = false,
         -- Colonnes post-v4 (écarts matrice §C) :
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
         accepts_marketing          = false
   where id = p_user;
end;
$$;

comment on function public.purge_user_data(uuid) is
  'SEC-1 purge RGPD (art. 17) : DML transactionnel appelé par l''edge '
  'purge-deleted-accounts v5. Matrice : docs/architecture/14_PURGE_MATRIX.md. '
  'incident_reports (future) : anonymisation seulement — TODO_AVOCAT E5.';

-- Fonction DEFINER : accès restreint au service_role uniquement.
revoke all on function public.purge_user_data(uuid) from public;
revoke all on function public.purge_user_data(uuid) from anon;
revoke all on function public.purge_user_data(uuid) from authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;
