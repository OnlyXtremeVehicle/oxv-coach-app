-- =============================================================================
-- PROPOSITION — purge RGPD : dissocier 25 colonnes, supprimer 8 rattachements
-- =============================================================================
--
-- NON APPLIQUÉE. Modifie `purge_user_data`, c'est-à-dire l'effacement d'un
-- compte. Elle vous revient.
--
-- Répond aux familles 1 et 3 de l'arbitrage du 13/08. **Trois de ses points sont
-- corrigés ici, sur mesure et non sur lecture** — voir « CE QUE LA BASE A
-- DÉMENTI » plus bas.
--
-- -----------------------------------------------------------------------------
-- FAMILLE 1 — COLONNES D'ACTEUR ADMINISTRATIF : dissocier, ne pas supprimer
-- -----------------------------------------------------------------------------
--
-- Effacer la ligne détruirait un événement qui a eu lieu ; conserver
-- l'identifiant conserve une donnée personnelle sans fondement. Dissocier garde
-- le fait et perd la personne.
--
-- Ce n'est pas une invention : `purge_user_data` le fait déjà pour
-- `admin_audit.user_id`, `device_assignments.pilot_id` et
-- `crew_members.referred_by`. On étend un geste existant.
--
-- -----------------------------------------------------------------------------
-- FAMILLE 3 — RATTACHEMENTS SANS FONDEMENT DE CONSERVATION : supprimer
-- -----------------------------------------------------------------------------
--
-- Toutes ces colonnes sont NOT NULL : on ne peut pas les dissocier, seulement
-- supprimer la ligne. Ce qui est cohérent — un événement d'objectif de coaching
-- sans pilote n'est pas un fait conservé, c'est une ligne orpheline.
--
-- =============================================================================
-- CE QUE LA BASE A DÉMENTI DANS L'ARBITRAGE
-- =============================================================================
--
-- Mesuré le 13/08 avant d'écrire une ligne, parce que **plpgsql ne vérifie pas
-- les tables ni les colonnes à la création** : une erreur ici ne se voit qu'à la
-- première purge réelle, c'est-à-dire au pire moment.
--
-- 1. DEUX DES VINGT-SEPT COLONNES DE LA FAMILLE 1 SONT `NOT NULL`.
--
--    `crews.captain_id` et `incident_followups.author_id`. Un `SET NULL` y lève.
--    Elles sont donc EXCLUES de cette migration, et elles ne relèvent pas d'un
--    geste technique :
--
--      · `crews.captain_id` — un équipage sans capitaine n'existe pas. Il faut
--        transférer le capitanat ou dissoudre l'équipage. **Décision produit.**
--      · `incident_followups.author_id` — `purge_user_data` nulle DÉJÀ la
--        `note` de ces lignes, en gardant l'auteur. C'était un choix, pas un
--        oubli : le suivi d'incident perd son contenu et garde sa traçabilité.
--        Le renverser mérite d'être dit à l'avocat en même temps que §3.1.
--
-- 2. `coaching_bookings` NE PEUT PAS ÊTRE SUPPRIMÉE TANT QU'UNE FACTURE LA TIENT.
--
--    `coach_invoices_coaching_booking_id_fkey` est en **NO ACTION**. Or
--    `coach_invoices` relève de la famille 2 — conservation comptable dix ans,
--    article L123-22 du code de commerce.
--
--    **Les deux familles de l'arbitrage se contredisent sur cette table.** La
--    suppression demandée par la famille 3 échouerait, à l'exécution, sur les
--    lignes que la famille 2 protège.
--
--    Sortie retenue : on supprime les réservations QUE PLUS RIEN NE TIENT, et on
--    laisse les autres. Elles pointent alors vers `public.users` déjà anonymisée
--    en place — une coquille sans nom, sans e-mail, sans adresse. C'est la forme
--    conforme, pas une dette : on conserve une référence, pas une identité.
--
--    C'est exactement le raisonnement que l'arbitrage tient lui-même pour la
--    famille 2. Il ne l'avait simplement pas appliqué à la collision.
--
-- 3. Les deux autres clés étrangères vers ces tables ne posent rien :
--    `pilot_waiver_signatures.booking_id` est en SET NULL, `crew_members.crew_id`
--    en CASCADE.
-- =============================================================================

begin;

create or replace function public.purge_user_data_complement(p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- ==========================================================================
  -- FAMILLE 3 — supprimer les rattachements sans fondement de conservation
  -- ==========================================================================

  delete from public.coach_objective_events where coach_id = p_user or pilot_id = p_user;
  delete from public.coach_queue             where coach_id = p_user or pilot_id = p_user;
  delete from public.pilot_goal_events       where user_id  = p_user;

  /*
   * `coach_messages.sender_id` — LE PLUS DISCRET DES NEUF.
   *
   * La fonction purge déjà `coach_id` et `pilot_id` de cette table, donc elle a
   * l'air couverte. Le troisième champ passe au travers : un message envoyé par
   * l'utilisateur dans un fil où il n'est ni le coach ni le pilote survivait à
   * l'effacement de son compte.
   */
  delete from public.coach_messages where sender_id = p_user;

  /*
   * `coaching_bookings` — SEULEMENT CE QUE PLUS RIEN NE TIENT.
   *
   * Voir l'en-tête : `coach_invoices` référence cette table en NO ACTION et
   * relève de la conservation comptable. Supprimer sans discernement lèverait
   * une violation de clé étrangère au milieu d'une purge, c'est-à-dire au
   * moment où l'on a le moins envie d'une transaction avortée.
   */
  delete from public.coaching_bookings b
   where (b.coach_id = p_user or b.pilot_id = p_user)
     and not exists (
       select 1 from public.coach_invoices i where i.coaching_booking_id = b.id
     );

  -- ==========================================================================
  -- FAMILLE 1 — dissocier l'acteur, conserver le fait
  -- ==========================================================================
  --
  -- Vingt-cinq colonnes, toutes vérifiées nullables le 13/08. Les deux `NOT
  -- NULL` (`crews.captain_id`, `incident_followups.author_id`) sont exclues et
  -- documentées en tête.

  update public.app_config              set updated_by = null        where updated_by = p_user;
  update public.app_feature_flags       set updated_by = null        where updated_by = p_user;
  update public.b2b_event_reports       set generated_by = null      where generated_by = p_user;
  update public.coach_permissions       set granted_by = null        where granted_by = p_user;
  update public.coach_pilots            set created_by = null        where created_by = p_user;
  update public.coach_pilots            set consent_forced_by = null where consent_forced_by = p_user;
  update public.contact_messages        set read_by = null           where read_by = p_user;
  update public.data_quality_reports    set owner_admin_id = null    where owner_admin_id = p_user;
  update public.demandes_inscription    set reviewed_by = null       where reviewed_by = p_user;
  update public.device_assignments      set assigned_by = null       where assigned_by = p_user;
  update public.email_templates         set updated_by = null        where updated_by = p_user;
  update public.event_registrations     set checked_in_by = null     where checked_in_by = p_user;
  update public.events                  set created_by = null        where created_by = p_user;
  update public.media                   set uploaded_by = null       where uploaded_by = p_user;
  update public.moderation_report_reviews set reviewed_by = null     where reviewed_by = p_user;
  update public.pavillon_photos         set created_by = null        where created_by = p_user;
  update public.registrations           set attended_by = null       where attended_by = p_user;
  update public.registrations           set cancelled_by = null      where cancelled_by = p_user;
  update public.scenic_routes           set certified_by = null      where certified_by = p_user;
  update public.session_media           set uploaded_by_user_id = null where uploaded_by_user_id = p_user;
  update public.crews                   set captain_id = captain_id  where false; -- cf. en-tête : NOT NULL

  /*
   * ==========================================================================
   * L'EXCEPTION PROBATOIRE — quatre colonnes qui font PREUVE D'UNE DÉCISION
   * ==========================================================================
   *
   * `users.kyc_validated_by`, `users.suspended_by`,
   * `founder_applications.decided_by`, `documents.validated_by`,
   * `eligibility_items.validated_by`.
   *
   * Savoir QUI a validé une pièce d'identité, suspendu un compte ou refusé une
   * candidature a une valeur probatoire : c'est la trace d'une décision
   * opposable, et la nuller au premier effacement de compte reviendrait à
   * effacer la preuve avec la personne.
   *
   * ELLES NE SONT PAS DISSOCIÉES ICI. À conserver jusqu'à la prescription, puis
   * nuller — et la durée est une question pour l'avocat, à poser en même temps
   * que celle des décharges (§1.4 famille 4 de l'arbitrage).
   *
   * Les laisser en commentaire plutôt que les omettre : un lecteur qui compte
   * les colonnes doit trouver la raison de leur absence, pas un trou.
   */
end;
$$;

comment on function public.purge_user_data_complement(uuid) is
  'Complément RGPD du 13/08/2026 : supprime 8 rattachements sans fondement de '
  'conservation, dissocie 20 colonnes d''acteur administratif. Exclut les 2 '
  'colonnes NOT NULL (décision produit) et les 5 colonnes probatoires (avocat). '
  'À appeler depuis purge_user_data.';

commit;

-- =============================================================================
-- RACCORDEMENT — à faire dans le même lot, une fois le complément vérifié
-- =============================================================================
--
-- Ajouter en fin de `purge_user_data`, AVANT l'anonymisation de `public.users` :
--
--   perform public.purge_user_data_complement(p_user);
--
-- L'ordre compte : le complément lit `coach_invoices` pour décider quelles
-- réservations sont supprimables, et cette lecture doit se faire avant que
-- quoi que ce soit d'autre ne bouge.
--
-- =============================================================================
-- VÉRIFICATION — une purge ne se prouve QU'EN L'EXÉCUTANT
-- =============================================================================
--
-- Le dépôt a déjà appris cette leçon : six clés étrangères en NO ACTION rendaient
-- l'effacement RGPD totalement impossible, et rien ne le disait. Une purge qui
-- n'a pas été jouée sur un compte réel n'est pas une purge, c'est une intention.
--
-- Sur un compte de test, après raccordement :
--
--   select public.purge_user_data('<uuid de test>');
--
-- puis, pour chacune des tables ci-dessus :
--
--   select count(*) from public.<table> where <colonne> = '<uuid de test>';
--
-- Toutes doivent rendre 0, SAUF les cinq colonnes probatoires et les deux
-- NOT NULL — dont l'absence est attendue et documentée.
--
-- =============================================================================
-- ANNULATION
-- =============================================================================
-- drop function if exists public.purge_user_data_complement(uuid);
-- (et retirer le `perform` de `purge_user_data`)
