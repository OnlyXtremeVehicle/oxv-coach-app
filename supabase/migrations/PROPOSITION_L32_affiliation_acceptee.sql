-- =============================================================================
-- PROPOSITION — UNE AFFILIATION NON ACCEPTÉE NE DONNE AUCUN ACCÈS
--
--   *** NON APPLIQUÉE. NE PAS EXÉCUTER SANS DÉCISION FONDATEUR. ***
--
-- Fichier volontairement NON horodaté : `supabase db push` l'ignore.
--
-- Rédigé le 02/08/2026, après la cartographie adversariale de l'espace admin.
-- =============================================================================
--
-- LE DÉFAUT — IL EST VIVANT, PAS THÉORIQUE
--
-- `is_coach_of()` commande l'accès du coach aux séances, aux tours et aux
-- analyses d'un pilote. Elle vérifie quatre choses :
--
--     cp.active = true
--     cp.pilot_consent_at IS NOT NULL
--     u.role = 'coach'
--
-- Elle ne regarde JAMAIS `coach_pilots.status`. `is_detailed_coach_of()` non
-- plus — et celle-là ouvre en plus la lecture DÉTAILLÉE.
--
-- Or la colonne `active` vaut `true` PAR DÉFAUT : toute affiliation naît active,
-- quel que soit son statut. Et l'énumération `affiliation_status` compte quatre
-- valeurs : `pending`, `active`, `declined`, `ended`.
--
-- MESURÉ EN PRODUCTION LE 02/08/2026 : l'unique ligne de `coach_pilots` porte
--
--     status = 'pending'   active = true   pilot_consent_at renseigné
--
-- Ce coach-là n'a jamais vu son affiliation acceptée. Il lit pourtant les
-- séances de son pilote. Une affiliation REFUSÉE (`declined`) ou TERMINÉE
-- (`ended`) donnerait exactement le même accès tant que personne ne pense à
-- repasser `active` à `false` à la main.
--
-- ---------------------------------------------------------------------------
-- POURQUOI DEUX COLONNES DISENT LA MÊME CHOSE
--
-- `active` et `status` portent la même idée, et rien ne les tient d'accord : ni
-- contrainte, ni déclencheur. `trg_guard_coach_pilots_colonnes` est le seul
-- déclencheur de la table et ne s'occupe pas de cela.
--
-- Deux sources pour une même vérité finissent toujours par diverger. Elles ont
-- déjà divergé : la seule ligne existante est incohérente.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION FAIT
--
-- 1. Les deux fonctions exigent `status = 'active'` EN PLUS du reste. C'est le
--    correctif d'accès, et il est immédiat.
-- 2. Un déclencheur tient `active` aligné sur `status`, dans les deux sens, à
--    l'insertion comme à la mise à jour. La divergence devient impossible.
--
-- ON NE SUPPRIME PAS `active`. La colonne est lue ailleurs dans le code
-- applicatif ; la retirer demanderait un balayage complet, et la règle D-24 dit
-- assez ce que coûte une suppression mal balayée. Elle devient une VUE de
-- `status`, entretenue par la base.
--
-- ---------------------------------------------------------------------------
-- CE QUI CHANGE POUR LA SEULE LIGNE EXISTANTE
--
-- Elle passe de « accès ouvert » à « accès fermé », puisque son statut est
-- `pending`. **C'est le comportement correct**, et c'est un changement visible :
-- si ce coach doit avoir accès, il faut ACCEPTER son affiliation
-- (`status = 'active'`), pas contourner la règle.
--
-- Aucune donnée n'est détruite. Le geste est réversible : repasser le statut à
-- `active` rouvre l'accès.
-- =============================================================================

-- VOLET 1 — LES DEUX FONCTIONS D'ACCÈS -------------------------------------

create or replace function public.is_coach_of(pilot_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.coach_pilots cp
    join public.users u on u.id = cp.coach_id
    where cp.coach_id = auth.uid()
      and cp.pilot_id = pilot_uuid
      and cp.active = true
      -- L'AFFILIATION DOIT ÊTRE ACCEPTÉE. Sans cette ligne, `pending`,
      -- `declined` et `ended` donnaient le même accès qu'`active` : `active`
      -- vaut true par défaut et rien ne le remet à false.
      and cp.status = 'active'
      and cp.pilot_consent_at is not null
      -- D-1 : le rôle doit être ENCORE coach. Sans cette ligne, une
      -- rétrogradation ne retire aucun accès tant qu'une affiliation reste
      -- active — et rien n'oblige l'écrivain du rôle à s'en occuper.
      and u.role = 'coach'
  );
$function$;

create or replace function public.is_detailed_coach_of(pilot_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.coach_pilots cp
    join public.users u on u.id = cp.coach_id
    where cp.coach_id = auth.uid()
      and cp.pilot_id = pilot_uuid
      and cp.active = true
      and cp.status = 'active'
      and cp.pilot_consent_at is not null
      -- Cette fonction ouvre la lecture DÉTAILLÉE : elle ne doit pas être plus
      -- permissive que `is_coach_of`. Elle omettait aussi le contrôle du rôle.
      and u.role = 'coach'
      and cp.level in ('lecture_detaillee', 'programme')
  );
$function$;

-- VOLET 2 — LES DEUX COLONNES NE PEUVENT PLUS DIVERGER ----------------------

create or replace function public.aligner_active_sur_status()
returns trigger
language plpgsql
as $function$
begin
  -- `active` devient une VUE de `status`, entretenue par la base. Deux sources
  -- pour une même vérité finissent toujours par diverger — elles avaient déjà
  -- divergé le 02/08/2026, sur la seule ligne existante.
  new.active := (new.status = 'active');
  return new;
end;
$function$;

drop trigger if exists trg_aligner_active_sur_status on public.coach_pilots;

create trigger trg_aligner_active_sur_status
  before insert or update on public.coach_pilots
  for each row execute function public.aligner_active_sur_status();

comment on column public.coach_pilots.active is
  'DÉRIVÉE de `status` par trg_aligner_active_sur_status — ne pas écrire à la '
  'main. Jusqu''au 02/08/2026 les deux colonnes vivaient séparément, `active` '
  'valait true par défaut, et une affiliation `pending` ou `declined` donnait '
  'le même accès qu''une affiliation acceptée.';

-- =============================================================================
-- APRÈS APPLICATION — CE QU'IL FAUT VÉRIFIER
--
--   -- 1. plus aucune incohérence
--   select count(*) from public.coach_pilots where active <> (status = 'active');
--   -- attendu : 0  (le déclencheur ne réaligne PAS les lignes existantes :
--   --               il faut un UPDATE de balayage, ci-dessous)
--
--   -- 2. balayage des lignes déjà en base
--   update public.coach_pilots set status = status;   -- déclenche l'alignement
--
--   -- 3. l'accès est bien fermé pour une affiliation non acceptée
--   --    (à jouer avec le jeton du coach concerné, pas en service_role)
--
-- L'étape 2 est VOLONTAIREMENT séparée : elle modifie des lignes, et je ne veux
-- pas qu'elle passe inaperçue au milieu d'une migration de définition.
-- =============================================================================
