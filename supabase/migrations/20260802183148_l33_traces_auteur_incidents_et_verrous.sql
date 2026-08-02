-- =============================================================================
-- CE QUI ENGAGE DOIT LAISSER UNE TRACE, ET CE QUI EST CERTIFIÉ
-- DOIT LE RESTER
--
--   *** APPLIQUÉE EN PRODUCTION LE 02/08/2026 (version 20260802183148). ***
--
-- Décision fondateur : appliquer les quatre volets.
--
-- ÉPROUVÉ APRÈS APPLICATION, dans une transaction ANNULÉE :
--   • créer une route déjà certifiée      → REFUSÉ (correct)
--   • réécrire le contenu d'une certifiée → REFUSÉ (correct)
--   • toucher un champ HORS contenu       → ACCEPTÉ (le verrou n'est pas trop strict)
--
-- Le premier essai de réécriture avait échoué pour une AUTRE raison
-- (`start_lat` obligatoire) : il ne prouvait rien, et a été refait avec une
-- route complète. Un test qui échoue pour le mauvais motif ne vérifie rien.
--
-- Le suivi d'incident n'a pas pu être éprouvé : aucun signalement n'existe en
-- base. La table et ses policies sont créées, leur comportement réel reste à
-- constater au premier incident.
--
-- Rédigé le 02/08/2026, après la cartographie adversariale de l'espace admin.
-- Trois défauts sans rapport entre eux, réunis parce qu'ils demandent tous une
-- migration et qu'aucun ne se corrige côté application.
-- =============================================================================


-- =============================================================================
-- VOLET 1 — LE POINTAGE DE PRÉSENCE N'A PAS D'AUTEUR
-- =============================================================================
--
-- `attendanceService.setAttendance` écrit `registrations.attended_at`. C'est la
-- SEULE écriture de l'administration dans cette table, et le cahier en dit la
-- portée : *« l'admin écrit dans registrations, avec une table d'audit : une
-- inscription vaut un paiement, et sans trace un désaccord de facturation est
-- insoluble. »*
--
-- Vérifié le 02/08/2026 : la table porte `cancelled_by` — donc l'idée d'un
-- auteur y existe déjà — mais PAS d'`attended_by`. Aucun déclencheur d'audit ne
-- couvre l'UPDATE.
--
-- Concrètement : un pilote conteste avoir roulé, la ligne dit qu'il était
-- présent, et rien ne dit qui l'a cochée ni à quelle heure. Personne ne peut
-- trancher.

alter table public.registrations
  add column if not exists attended_by uuid references auth.users(id) on delete set null;

comment on column public.registrations.attended_by is
  'Qui a pointé cette présence. Sans auteur, une contestation de facturation '
  'est insoluble : la ligne affirme une présence que personne n''assume. '
  'Ajoutée le 02/08/2026 — la colonne symétrique `cancelled_by` existait déjà.';

-- Le pointage se fait au portail, souvent à plusieurs mains. On veut donc aussi
-- QUAND la ligne a été touchée pour la dernière fois, pas seulement quand la
-- présence a eu lieu.
alter table public.registrations
  add column if not exists attendance_updated_at timestamptz;


-- =============================================================================
-- VOLET 2 — LE CONSENTEMENT FORCÉ N'A PAS D'AUTEUR NON PLUS
-- =============================================================================
--
-- `coachAdminService.forcePilotConsent` écrit `coach_pilots.pilot_consent_at`
-- au nom d'un pilote, sur la foi d'un papier signé. Aucune colonne ne dit qui
-- l'a posé ; aucun déclencheur d'audit ne couvre `coach_pilots` — le seul
-- déclencheur de la table est `trg_guard_coach_pilots_colonnes`, qui fait autre
-- chose.
--
-- L'application AVERTIT désormais l'administrateur de cette absence avant
-- d'écrire (commit du 02/08/2026). C'est un pansement : l'avertissement dit la
-- vérité, il ne la corrige pas.
--
-- Un consentement au traitement de données personnelles dont on ignore l'auteur
-- ne vaut rien devant qui le conteste.

alter table public.coach_pilots
  add column if not exists consent_forced_by uuid references auth.users(id) on delete set null;

alter table public.coach_pilots
  add column if not exists consent_forced_at timestamptz;

comment on column public.coach_pilots.consent_forced_by is
  'Administrateur ayant inscrit le consentement sur présentation d''un papier '
  'signé. `null` = consentement donné par le pilote lui-même dans '
  'l''application. Un consentement sans auteur ne vaut rien devant qui le '
  'conteste.';


-- =============================================================================
-- VOLET 3 — L'INCIDENT N'A PAS D'ÉTAT
-- =============================================================================
--
-- Le cahier : *« L'incident a un état suivi — reçu, traité, clos, avec auteur
-- et date. »*
--
-- `incident_reports` porte aujourd'hui : `id`, `session_id`, `user_id`,
-- `occurred_at`, `description`, `photo_path`, `created_at`. Rien d'autre. Et la
-- migration d'origine (`20260719021027_be1_incident_reports.sql`, ligne 38)
-- interdit EXPLICITEMENT toute policy UPDATE ou DELETE : le choix était que
-- rien ne puisse être réécrit après coup.
--
-- Ce choix protège le récit du pilote — et c'est juste. Mais il empêche aussi
-- l'organisateur de dire « j'ai vu, j'ai traité ». D'où un SUIVI SÉPARÉ : on ne
-- touche pas au signalement, on lui adjoint des actes.
--
-- La table du récit reste donc en écriture unique. Ce qui est modifiable, c'est
-- le suivi — et lui porte son auteur.

create table if not exists public.incident_followups (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incident_reports(id) on delete cascade,
  -- reçu → traité → clos. Aucune valeur ne se supprime : on ajoute un acte.
  state text not null check (state in ('recu', 'traite', 'clos')),
  note text check (note is null or length(note) between 1 and 2000),
  author_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.incident_followups is
  'Actes de suivi d''un signalement. Le SIGNALEMENT lui-même reste en écriture '
  'unique — la migration BE-1 interdit UPDATE et DELETE dessus, et c''est '
  'voulu : le récit du pilote ne se réécrit pas. Le suivi s''ajoute à côté, et '
  'chaque acte porte son auteur.';

create index if not exists idx_incident_followups_incident
  on public.incident_followups (incident_id, created_at desc);

alter table public.incident_followups enable row level security;

-- L'administration suit. Personne d'autre n'écrit ici.
create policy incident_followups_admin_all on public.incident_followups
  for all using (public.is_admin()) with check (public.is_admin());

-- Le pilote qui a signalé voit où en est son signalement. Il ne peut rien y
-- écrire : ce sont les actes de l'organisateur, pas les siens.
create policy incident_followups_reporter_read on public.incident_followups
  for select using (
    exists (
      select 1 from public.incident_reports ir
      where ir.id = incident_followups.incident_id
        and ir.user_id = auth.uid()
    )
  );


-- =============================================================================
-- VOLET 4 — UNE ROUTE CERTIFIÉE PEUT ÊTRE RÉÉCRITE PAR SON PROPRIÉTAIRE
-- =============================================================================
--
-- Le verrou de certification est le déclencheur `trg_guard_scenic_route_cert`,
-- posé `BEFORE UPDATE OF status`. Il ne se déclenche donc QUE si la colonne
-- `status` est touchée.
--
-- Or la policy `scenic_routes_owner_all` est un `FOR ALL ... USING (user_id =
-- auth.uid())`, sans restriction de statut. Le propriétaire d'une route déjà
-- CERTIFIÉE peut donc en réécrire `name`, `geometry` et `pois` sans jamais
-- toucher à `status` : aucune garde ne s'arme, et la route reste marquée
-- certifiée avec un contenu que personne n'a validé.
--
-- L'INSERT n'est pas couvert non plus : rien n'empêche de créer directement une
-- ligne avec `status = 'certified'`.

create or replace function public.guard_scenic_route_contenu()
returns trigger
language plpgsql
as $function$
begin
  -- À la CRÉATION : personne ne naît certifié. Seule l'administration certifie,
  -- et elle le fait par une mise à jour que le déclencheur d'origine surveille.
  if tg_op = 'INSERT' then
    if new.status = 'certified' and not public.is_admin() then
      raise exception 'Une route ne peut pas être créée déjà certifiée.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- À la MISE À JOUR : le contenu d'une route certifiée est figé, sauf pour
  -- l'administration. Le déclencheur d'origine ne regardait que `status` ; on
  -- surveille ici ce qui fait la route elle-même.
  if old.status = 'certified' and not public.is_admin() then
    if new.name is distinct from old.name
       or new.geometry is distinct from old.geometry
       or new.pois is distinct from old.pois then
      raise exception 'Le contenu d''une route certifiée ne peut plus être modifié.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_scenic_route_contenu on public.scenic_routes;

create trigger trg_guard_scenic_route_contenu
  before insert or update on public.scenic_routes
  for each row execute function public.guard_scenic_route_contenu();


-- =============================================================================
-- APRÈS APPLICATION — CE QU'IL FAUT VÉRIFIER, ET COMMENT
--
-- Les colonnes ajoutées ne prouvent RIEN tant que le code applicatif ne les
-- renseigne pas. Elles sont nullables exprès : une migration ne doit pas casser
-- l'existant. Le câblage suit, dans un lot séparé :
--
--   • `setAttendance` doit écrire `attended_by` et `attendance_updated_at` ;
--   • `forcePilotConsent` doit écrire `consent_forced_by` et
--     `consent_forced_at` — et l'avertissement de l'écran pourra alors être
--     retiré, puisqu'il ne dira plus vrai.
--
-- Les deux verrous, eux, s'éprouvent tout de suite — dans une transaction
-- ANNULÉE, avec le jeton d'un propriétaire non administrateur :
--
--   update public.scenic_routes set name = 'essai'
--    where status = 'certified' and user_id = auth.uid();
--   -- attendu : exception « le contenu d'une route certifiée ne peut plus… »
--
--   insert into public.scenic_routes (user_id, name, status)
--   values (auth.uid(), 'essai', 'certified');
--   -- attendu : exception « une route ne peut pas être créée déjà certifiée. »
--
-- Une définition de déclencheur ne prouve pas qu'il se déclenche.
-- =============================================================================
