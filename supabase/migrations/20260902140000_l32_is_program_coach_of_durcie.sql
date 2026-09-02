-- LA TROISIEME SOEUR, OUBLIEE PAR L32.
--
-- Le 02/08/2026, la migration 20260802183047_l32_affiliation_acceptee_exigee a
-- durci les fonctions d acces coach : `is_coach_of` et `is_detailed_coach_of`
-- exigent desormais `cp.status = 'active'` EN PLUS de `cp.active = true`, et
-- `u.role = 'coach'`. La seconde porte meme le commentaire qui dit pourquoi :
-- « Cette fonction ouvre la lecture DETAILLEE : elle ne doit pas etre plus
-- permissive que is_coach_of. Elle omettait aussi le controle du role. »
--
-- `is_program_coach_of`, posee le 28/06 par 20260628201319_0027, n a jamais ete
-- revisitee. Relue en production le 02/09/2026, elle ne verifiait NI le statut,
-- NI le role. Elle etait donc LA PLUS PERMISSIVE DES TROIS — alors qu elle
-- ouvre le niveau le PLUS eleve, celui du programme.
--
-- Consequence concrete : `demoteToPilot` (coachAdminService.ts:286) coupe les
-- affiliations d un ex-coach par `update({active:false})`. `is_coach_of` et
-- `is_detailed_coach_of` le retiennent par `u.role = 'coach'` ;
-- `is_program_coach_of` ne retenait rien. Les politiques `dev_cycles_coach_all`
-- et `cycle_steps_coach_all` s appuient dessus : un coach retrograde gardait le
-- droit d ECRIRE dans les cycles de developpement de ses anciens pilotes.
--
-- CE QUE CE GESTE FERME AUJOURD HUI : rien. Mesure avant application —
-- `coach_pilots` porte UNE ligne, status='pending', active=false ; la fonction
-- rendait deja false pour tout le monde par la clause `active = true`, et
-- `cycle_steps` compte zero ligne. C est precisement pour cela que c est le bon
-- moment : on aligne un predicat sur ses soeurs pendant qu il ne porte aucun
-- acces vivant.

create or replace function public.is_program_coach_of(pilot_uuid uuid)
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
      -- Ajoutes le 02/09/2026, sur le modele exact de `is_detailed_coach_of` :
      -- `declined` et `ended` donnaient le meme acces qu `active`, et un
      -- ex-coach dont le role a change gardait l ecriture des cycles.
      and cp.status = 'active'
      and u.role = 'coach'
      and cp.pilot_consent_at is not null
      and cp.level = 'programme'
  );
$function$;

comment on function public.is_program_coach_of(uuid) is
  'Ouvre le niveau PROGRAMME (cycles de developpement). Durcie le 02/09/2026 : '
  'elle omettait status et role, ce qui la rendait plus permissive que '
  'is_detailed_coach_of alors qu elle ouvre davantage. Les trois soeurs sont '
  'desormais alignees.';
