-- =============================================================================
-- RGPD — LA PURGE LAISSAIT DES DONNÉES PERSONNELLES DERRIÈRE ELLE
-- =============================================================================
--
-- Découvert le 12/08/2026 par la chasse aux promesses non tenues.
--
-- -----------------------------------------------------------------------------
-- LE DÉFAUT, ET POURQUOI IL EST STRUCTUREL
-- -----------------------------------------------------------------------------
--
-- L'application affiche au pilote : « Suppression définitive après 30 jours »
-- et « votre compte et vos données seront supprimés ».
--
-- La stratégie retenue est « anonymiser-et-purger » : l'edge
-- `purge-deleted-accounts` bannit le compte `auth.users` au lieu de le
-- SUPPRIMER, parce que `payments.user_id` est en `NO ACTION`
-- (motif écrit à `purge-deleted-accounts/index.ts:43`).
--
-- Conséquence qui n'avait pas été tirée : **toute table dont le seul nettoyage
-- est une clé étrangère `ON DELETE CASCADE` vers `auth.users` n'est jamais
-- nettoyée.** La cascade ne part pas, et `purge_user_data` ne nomme pas ces
-- tables. Elles survivent à une « suppression définitive ».
--
-- Ce n'est pas un oubli isolé : c'est ce que produit mécaniquement le choix de
-- ne pas supprimer la ligne d'authentification. Chaque table ajoutée depuis
-- rejoint le trou par défaut.
--
-- -----------------------------------------------------------------------------
-- CE QUI SURVIVAIT, RELEVÉ EN PRODUCTION
-- -----------------------------------------------------------------------------
--
--   `resend_events`        49 lignes, 11 adresses e-mail DISTINCTES en clair,
--                          du 16/06 au 21/07/2026, avec sujet et en-têtes.
--                          **Seule table du lot qui contient des données
--                          réelles aujourd'hui.**
--   `pilot_notes`          le texte libre écrit par le pilote.
--   `pilot_signature_snapshots`  ses axes de pilotage.
--   `coach_ai_drafts`      des textes générés À SON SUJET.
--   `pilot_development_cycles`   son programme de progression.
--   `ambassador_profiles`  sa fiche d'ambassadeur.
--   `notif_throttle_log`   qui lui a envoyé quoi, et quand.
--   `pro_team_members`     son adresse e-mail et son nom, en clair.
--   `moderation_reports`   ce qu'il a signalé.
--   `incident_followups`   le texte de suivi d'incident et son auteur.
--   `ai_safety_reviews`    des extraits d'entrée et de sortie le concernant.
--
-- Toutes à ZÉRO ligne sauf `resend_events`. Le préjudice est donc réel
-- aujourd'hui sur les adresses e-mail, et le deviendra pour le reste à la
-- première journée de piste.
--
-- -----------------------------------------------------------------------------
-- CE QUI N'EST PAS TRAITÉ ICI, ET POURQUOI
-- -----------------------------------------------------------------------------
--
-- `pilot_waiver_signatures` — la décharge de responsabilité signée, qui porte
-- le nom et le prénom du pilote EN CLAIR.
--
-- **La question n'est pas technique, elle est juridique** : une décharge signée
-- relève-t-elle de la conservation probatoire (auquel cas on ARCHIVE en accès
-- restreint, et on l'écrit dans la politique), ou de l'effacement pur ?
--
-- CORRECTION DU 12/08/2026 — J'AVAIS CITÉ LE MAUVAIS ARTICLE. Une première
-- rédaction de ce commentaire invoquait l'article 2224 du code civil et sa
-- prescription de cinq ans. C'est le droit commun, et ce n'est pas celui qui
-- gouverne l'objet même d'une décharge de circuit.
--
--   Article 2226 : « L'action en responsabilité née à raison d'un événement
--   ayant entraîné un DOMMAGE CORPOREL […] se prescrit par DIX ANS à compter
--   de la date de la CONSOLIDATION du dommage initial ou aggravé. »
--
-- Deux conséquences, et aucune n'est théorique. Le point de départ est la
-- consolidation — une date INCONNUE au moment de la signature, qui peut
-- survenir des années après la séance, et qu'une aggravation rouvre. Et
-- l'article 2232 alinéa 2 EXCLUT expressément l'article 2226 du délai butoir
-- de vingt ans : il n'existe donc aucune borne supérieure calculable.
--
-- Autrement dit : **aucune durée ne se déduit du calcul.** Elle doit être
-- arrêtée forfaitairement, documentée, et alignée sur le contrat d'assurance
-- responsabilité civile d'OXV — qui est la pièce qu'il faut lire, car aucun
-- texte français n'IMPOSE de conserver une décharge de circuit (recherché,
-- non trouvé, y compris au Code du sport).
--
-- Ce n'est donc pas à moi de trancher, et ce n'est pas non plus une question
-- d'opportunité : c'est une lecture de contrat d'assurance.
--
-- La table est à zéro ligne et la fonctionnalité est gatée (drapeau
-- `pilot_waivers` à `false`). Rien ne presse ; la décision revient au conseil.
--
-- =============================================================================
-- L'ORDRE DES INSTRUCTIONS N'EST PAS INDIFFÉRENT
-- =============================================================================
--
-- `resend_events` n'a AUCUNE colonne d'utilisateur — vérifié : ses 49 lignes
-- ont toutes `dispatch_id = NULL`, et l'adresse ne vit que dans
-- `raw_payload->'data'->'to'`, un tableau JSON.
--
-- Le seul rattachement possible est donc l'adresse e-mail elle-même. Or la
-- fonction ANONYMISE `users.email` à sa toute fin. L'adresse est donc LUE ET
-- MÉMORISÉE EN TÊTE, dans une variable, avant que quoi que ce soit ne bouge —
-- plutôt que relue au milieu du corps, où un futur réarrangement la trouverait
-- déjà effacée sans que rien ne le signale.
--
-- =============================================================================

create or replace function public.purge_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  -- Lue AVANT toute écriture : c'est le seul rattachement de `resend_events`,
  -- et la fin de cette fonction efface l'adresse.
  v_email text;
begin
  select email into v_email from public.users where id = p_user;

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

  -- ===========================================================================
  -- AJOUT DU 12/08/2026 — LES TABLES QUE LA CASCADE NE NETTOYAIT PAS
  -- ===========================================================================
  --
  -- Chacune n'était atteinte que par `ON DELETE CASCADE` vers `auth.users`, et
  -- cette ligne n'est jamais supprimée (voir l'en-tête). Toutes portent une
  -- donnée personnelle et sont gardées par `to_regclass` : la disparition
  -- d'une table ne doit PAS casser la purge, comme `duels` l'a fait le 01/08.
  if to_regclass('public.pilot_notes') is not null then
    execute 'delete from public.pilot_notes where user_id = $1' using p_user;
  end if;
  if to_regclass('public.pilot_signature_snapshots') is not null then
    execute 'delete from public.pilot_signature_snapshots where user_id = $1' using p_user;
  end if;
  if to_regclass('public.pilot_development_cycles') is not null then
    execute 'delete from public.pilot_development_cycles where pilot_id = $1 or coach_id = $1'
      using p_user;
  end if;
  if to_regclass('public.coach_ai_drafts') is not null then
    execute 'delete from public.coach_ai_drafts where pilot_id = $1 or coach_id = $1'
      using p_user;
  end if;
  if to_regclass('public.ambassador_profiles') is not null then
    execute 'delete from public.ambassador_profiles where user_id = $1' using p_user;
  end if;
  if to_regclass('public.notif_throttle_log') is not null then
    execute 'delete from public.notif_throttle_log
              where recipient_user_id = $1 or source_user_id = $1' using p_user;
  end if;
  if to_regclass('public.pro_team_members') is not null then
    -- Porte `member_email` et `member_name` en clair, côté membre comme côté
    -- professionnel : les deux rattachements sont couverts.
    execute 'delete from public.pro_team_members
              where member_user_id = $1 or pro_user_id = $1' using p_user;
  end if;
  if to_regclass('public.moderation_reports') is not null then
    execute 'delete from public.moderation_reports where reporter_id = $1' using p_user;
  end if;
  if to_regclass('public.ai_safety_reviews') is not null then
    -- ANONYMISÉE, pas supprimée : c'est un journal de sûreté du modèle, qui
    -- doit survivre pour qu'on puisse expliquer une décision. `pilot_id` est
    -- nullable, et les extraits ne portent pas d'identité directe.
    execute 'update public.ai_safety_reviews set pilot_id = null where pilot_id = $1'
      using p_user;
  end if;

  -- SUIVI D'INCIDENT — anonymisé, jamais purgé, comme `incident_reports`.
  -- La trace d'un incident sur circuit doit survivre à un départ de compte ;
  -- c'est l'identité de son auteur et le texte libre qui disparaissent.
  --
  -- `author_id` est NOT NULL et sa clé étrangère est en ON DELETE RESTRICT :
  -- on ne peut ni l'annuler ni supprimer la ligne référencée. On efface donc
  -- le seul contenu libre, `note`, et l'on CONSIGNE que le lien d'auteur
  -- subsiste — voir la note ci-dessous, qui n'est pas une décision technique.
  if to_regclass('public.incident_followups') is not null then
    execute 'update public.incident_followups set note = null where author_id = $1'
      using p_user;
  end if;

  -- JOURNAL DU PRESTATAIRE D'ENVOI — la charge brute porte l'adresse.
  -- Anonymisée plutôt que supprimée, comme `email_log` : la ligne reste
  -- comptable pour la déliverabilité, l'identité s'en va. `raw_payload` est
  -- NOT NULL, on le remplace par un objet vide de sens.
  if v_email is not null and to_regclass('public.resend_events') is not null then
    execute $q$
      update public.resend_events
         set raw_payload = jsonb_build_object('anonymise', true)
       where raw_payload->'data'->'to' ? $1
    $q$ using v_email;
  end if;

  -- Sauvegardes du 19/07 qui portent des données personnelles (décision du
  -- 01/08). Gardées par `to_regclass` : leur suppression ne doit pas casser la
  -- purge, comme `duels` l'a fait.
  if to_regclass('public._backup_registrations_20260719') is not null then
    execute 'delete from public._backup_registrations_20260719 where user_id = $1'
      using p_user;
  end if;
  if to_regclass('public._backup_payments_20260719') is not null then
    execute 'delete from public._backup_payments_20260719 where user_id = $1'
      using p_user;
  end if;

  -- CANDIDATURE FONDATEUR (D-27) — anonymisée, pas supprimée : la ligne est une
  -- trace de gestion, c'est l'identité qui doit disparaître.
  if to_regclass('public.founding_members') is not null then
    execute 'update public.founding_members
                set prenom = null, nom = null, email = null, user_id = null
              where user_id = $1'
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
         biometry_coach_share_consent_at = null,
         -- Le statut fondateur s'efface avec le compte. Le NUMÉRO n'est pas
         -- réattribué pour autant : la séquence ne recule pas.
         founder_since                  = null,
         founder_number                 = null
   where id = p_user;
end;
$function$;

comment on function public.purge_user_data(uuid) is
  'Effacement RGPD. Étendu le 12/08/2026 à onze tables que la cascade auth.users ne nettoyait pas (la ligne auth n''étant jamais supprimée). resend_events est rattachée par ADRESSE, lue en tête avant anonymisation. Reste ouvert : pilot_waiver_signatures (arbitrage juridique probatoire).';

-- -----------------------------------------------------------------------------
-- CE QUI RESTE À DÉCIDER, ET QUI N'EST PAS TECHNIQUE
-- -----------------------------------------------------------------------------
--
-- 1. `pilot_waiver_signatures` — voir l'en-tête. Effacement ou archivage
--    probatoire ? Le conseil doit trancher, et la politique de confidentialité
--    doit dire ce qui aura été décidé.
--
-- 2. `incident_followups.author_id` — la contrainte est en ON DELETE RESTRICT
--    sur une colonne NOT NULL : le lien vers l'auteur SUBSISTE après effacement.
--    Le texte libre disparaît, pas le fait qu'un compte donné a écrit un suivi.
--    Deux issues possibles, toutes deux hors de ce fichier : un compte système
--    de reprise, ou le relâchement du NOT NULL. À arbitrer.
--
-- 3. `founding_members` — la proposition
--    `PROPOSITION_J6_founding_members_effacement.sql` relâche trois NOT NULL
--    sans lesquels le bras d'anonymisation ci-dessus LÈVERA 23502 dès qu'une
--    candidature sera rattachée à un compte. Elle n'est pas appliquée.
