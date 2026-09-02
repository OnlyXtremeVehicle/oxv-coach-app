-- LA TRANSITION QUE PERSONNE N AVAIT ECRITE.
--
-- Depuis L32 (02/08/2026), `status = 'active'` commande l acces coach : les
-- trois fonctions is_coach_of / is_detailed_coach_of / is_program_coach_of
-- l exigent. Mesure du 02/09/2026 : AUCUN chemin d ecriture ne pose jamais
-- `status`. Les huit sites du depot ecrivent `pilot_consent_at`, `level`,
-- `live_sharing_at`, `notes` ou `active` — jamais `status`. Et
-- `redeem_affiliation_code` insere explicitement 'pending'.
--
-- Consequence, verifiee en base : l unique ligne de `coach_pilots` est
-- `status='pending'` depuis le 22/06, refermee par le balayage du 02/08, et
-- rien depuis n a pu la rouvrir. AUCUNE AFFILIATION COACH N ETAIT ACTIVABLE
-- PAR L APPLICATION. `toggleAssignmentActive` ecrivait `active`, colonne
-- DERIVEE, que `trg_aligner_active_sur_status` reecrivait aussitot : l UPDATE
-- reussissait, l ecran affichait un succes, rien ne changeait.
--
-- LE SCHEMA PORTAIT DEJA LA REPONSE. `coach_pilots` a DEUX colonnes de
-- consentement — `coach_consent_at` et `pilot_consent_at` — et `initiated_by`.
-- Le modele est a deux cotes : celui qui initie consent en creant, l autre
-- consent ensuite. Ce qui manquait n est pas une regle a inventer, c est la
-- transition qui reunit les deux.
--
-- POURQUOI UN DECLENCHEUR ET NON DU CODE CLIENT : parce que le defaut qu on
-- repare EST le mode de defaillance du code client — une obligation confiee a
-- chaque chemin d ecriture est tenue par celui qui y pense et oubliee par les
-- sept autres. C est le raisonnement que L32 a deja applique en faisant
-- d `active` une vue de `status`. On reprend son motif plutot que d en
-- inventer un second.
--
-- ORDRE DE DECLENCHEMENT. Postgres declenche les BEFORE dans l ordre
-- ALPHABETIQUE de leur nom. `trg_activer_...` precede `trg_aligner_...`, qui
-- precede `trg_guard_...`. L enchainement est donc : on pose `status`, puis
-- `active` en est derivee, puis le garde de colonnes verifie les droits. C est
-- le seul ordre qui fonctionne, et le nom a ete choisi pour l obtenir.
--
-- EPREUVE FAITE AVANT DE CONCLURE, sur la vraie ligne, dans un bloc rétracté :
--     avant  : pending / active=false
--     apres  : active  / active=true      (des que coach_consent_at est pose)
-- La ligne a ete relue apres coup : inchangee.
--
-- CE QUE LE DECLENCHEUR NE FAIT PAS :
--   - il ne va QUE de 'pending' vers 'active'. Un 'declined' ou un 'ended' ne
--     se rouvre pas tout seul ;
--   - il ne referme rien. Une revocation de consentement est deja couverte :
--     les trois fonctions d acces exigent `pilot_consent_at is not null`, et
--     `revokeConsent` le remet a NULL. Ecrire ici une transition inverse
--     inventerait une semantique entre 'declined' et 'ended' que rien ne
--     tranche aujourd hui.
--
-- CE QUE CE GESTE OUVRE : rien immediatement. La seule ligne existante n a pas
-- de `coach_consent_at` (elle date du 22/06, avant que la colonne ne serve),
-- donc elle reste 'pending'. Le declencheur agit sur les affiliations a venir.

create or replace function public.activer_affiliation_au_double_consentement()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Les deux cotes ont consenti, et l affiliation attend encore : elle est
  -- acceptee. Un seul sens, jamais l inverse.
  if new.status = 'pending'::affiliation_status
     and new.coach_consent_at is not null
     and new.pilot_consent_at is not null then
    new.status := 'active'::affiliation_status;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_activer_affiliation_au_double_consentement on public.coach_pilots;

create trigger trg_activer_affiliation_au_double_consentement
  before insert or update on public.coach_pilots
  for each row execute function public.activer_affiliation_au_double_consentement();

comment on function public.activer_affiliation_au_double_consentement() is
  'Passe une affiliation de pending a active des que coach_consent_at ET '
  'pilot_consent_at sont poses. Ecrite le 02/09/2026 : depuis L32, status '
  'commande l acces, et aucun chemin d ecriture du depot ne le posait — aucune '
  'affiliation n etait activable. Nomme pour se declencher AVANT '
  'trg_aligner_active_sur_status, qui derive active de status.';
