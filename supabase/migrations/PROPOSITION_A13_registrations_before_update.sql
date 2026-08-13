-- =============================================================================
-- PROPOSITION — un pilote peut aujourd'hui valider son propre paiement
-- =============================================================================
--
-- NON APPLIQUÉE. Écriture en production, sur le contrôle d'accès de la journée.
-- Elle vous revient.
--
-- -----------------------------------------------------------------------------
-- LE DÉFAUT, MESURÉ SUR LA BASE LE 13/08/2026
-- -----------------------------------------------------------------------------
--
-- Trois faits qui se combinent :
--
--   1. `authenticated` détient UPDATE sur onze colonnes nommées de
--      `registrations`, dont `status`, `attended_at`, `attended_by` et
--      `attendance_updated_at` ;
--   2. la policy `registrations_update_own_or_admin` autorise
--      `user_id = auth.uid()` — donc chaque pilote sur SES lignes ;
--   3. aucun trigger `BEFORE UPDATE` ne garde la table. Les trois triggers
--      existants — `trg_registration_emails`, `trg_seed_eligibility`,
--      `trg_registrations_schedule_rituals` — sont tous en AFTER, et un AFTER
--      ne peut rien refuser.
--
-- Conséquence, depuis n'importe quel client porteur d'un jeton pilote :
--
--   update public.registrations
--      set status = 'confirmed', attended_at = now(), attended_by = auth.uid()
--    where user_id = auth.uid();
--
-- Le pilote passe de `pending_payment` à `confirmed` et se pointe présent
-- lui-même. Sans portail, sans admin, sans passer par l'application.
--
-- `status` est un enum borné (`registration_status_enum` : pending, confirmed,
-- cancelled, attended, no_show, pending_payment) — mais `confirmed` et
-- `attended` en font partie, ce qui suffit.
--
-- -----------------------------------------------------------------------------
-- POURQUOI UN TRIGGER, ET PAS UN REVOKE
-- -----------------------------------------------------------------------------
--
-- Le REVOKE est la bonne fin, pas le bon début. `cancelled_at`, `cancelled_by`
-- et `cancellation_reason` sont eux aussi dans le grant : **le pilote annule
-- légitimement ses propres inscriptions, et cette annulation écrit `status`.**
-- Révoquer la colonne casserait ce parcours le jour même.
--
-- Le trigger ferme l'abus et laisse passer l'usage. Il ne demande ni RPC, ni
-- bascule applicative, ni revue App Store — donc il peut être posé aujourd'hui,
-- pendant que la séquence longue (RPC `mark_attendance` + `cancel_registration`,
-- puis REVOKE) se prépare tranquillement.
--
-- Quand le REVOKE viendra, GARDEZ le trigger : une ceinture par-dessus des
-- bretelles ne coûte rien, et c'est elle qui tiendra le jour où quelqu'un
-- rétablira un GRANT « juste pour tester ».
--
-- -----------------------------------------------------------------------------
-- CE QUE CE TRIGGER NE FAIT PAS
-- -----------------------------------------------------------------------------
--
-- Il ne touche PAS au chemin administrateur (`is_admin()` passe), ni aux
-- écritures serveur : une fonction `SECURITY DEFINER` s'exécute avec un rôle qui
-- n'est pas `authenticated`, et `auth.uid()` y est nul — la garde ne s'y
-- applique donc pas. Les webhooks de paiement et le portail continuent d'écrire.
--
-- Il ne prétend pas non plus remplacer la RPC : la garde « on ne pointe pas une
-- inscription annulée » vit aujourd'hui dans l'application, donc n'importe quel
-- jeton l'ignore. Elle appartient à `mark_attendance`, et reste à écrire.
-- =============================================================================

begin;

create or replace function public.registrations_garde_pilote()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- L'administration passe. C'est elle qui pointe, confirme et corrige.
  if public.is_admin() then
    return new;
  end if;

  /*
   * ÉCRITURE SERVEUR — `auth.uid()` est nul hors d'une session authentifiée
   * (fonctions SECURITY DEFINER, webhooks, tâches planifiées). On ne bride que
   * ce qui vient d'un porteur de jeton.
   */
  if auth.uid() is null then
    return new;
  end if;

  -- Le pointage n'appartient qu'à l'administration, sans exception.
  if new.attended_at is distinct from old.attended_at
     or new.attended_by is distinct from old.attended_by
     or new.attendance_updated_at is distinct from old.attendance_updated_at then
    raise exception
      'Le pointage de présence ne peut pas être modifié depuis un compte pilote.'
      using errcode = '42501';
  end if;

  /*
   * LE STATUT NE PEUT ALLER QUE VERS L'ANNULATION.
   *
   * C'est le seul mouvement que le pilote a une raison légitime de provoquer,
   * et il est déjà câblé dans l'application. Tout le reste — confirmer, pointer,
   * marquer un no-show — relève du portail ou d'un encaissement.
   *
   * On borne aussi le statut de DÉPART : annuler une journée déjà courue ou
   * déjà annulée n'a pas de sens, et laisser passer `attended → cancelled`
   * offrirait un moyen d'effacer sa propre présence.
   */
  if new.status is distinct from old.status then
    if new.status <> 'cancelled' then
      raise exception
        'Un compte pilote ne peut que passer une inscription en « cancelled » (demandé : %).',
        new.status
        using errcode = '42501';
    end if;
    if old.status not in ('pending', 'pending_payment', 'confirmed') then
      raise exception
        'Une inscription au statut « % » ne peut plus être annulée depuis un compte pilote.',
        old.status
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.registrations_garde_pilote() is
  'Interdit à un compte pilote de modifier son pointage de présence et de faire '
  'évoluer son statut ailleurs que vers « cancelled ». Posée le 13/08/2026 : le '
  'grant UPDATE et la policy own_or_admin le permettaient, et aucun trigger '
  'BEFORE UPDATE ne gardait la table.';

drop trigger if exists trg_registrations_garde_pilote on public.registrations;

create trigger trg_registrations_garde_pilote
  before update on public.registrations
  for each row
  execute function public.registrations_garde_pilote();

commit;

-- =============================================================================
-- VÉRIFICATION — à exécuter APRÈS, avec un jeton pilote, pas en tant que postgres
-- =============================================================================
--
-- Les deux doivent ÉCHOUER :
--
--   update public.registrations set attended_at = now() where user_id = auth.uid();
--   update public.registrations set status = 'confirmed'  where user_id = auth.uid();
--
-- Celle-ci doit RÉUSSIR (le parcours d'annulation reste ouvert) :
--
--   update public.registrations
--      set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
--    where user_id = auth.uid() and status in ('pending','pending_payment','confirmed');
--
-- Une garde qui n'a pas été éprouvée dans les deux sens n'est pas une garde.
--
-- =============================================================================
-- ANNULATION
-- =============================================================================
-- drop trigger if exists trg_registrations_garde_pilote on public.registrations;
-- drop function if exists public.registrations_garde_pilote();
