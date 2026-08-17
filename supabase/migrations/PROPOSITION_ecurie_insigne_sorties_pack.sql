-- =============================================================================
-- PROPOSITION — NON APPLIQUÉE. Décisions fondateur du 17/08/2026.
-- =============================================================================
--
-- Ce fichier n'est PAS passé en base. Il attend une validation explicite, puis
-- un `apply_migration` sous un horodatage réel. Tant qu'il porte le préfixe
-- PROPOSITION_, il ne doit être repris par aucun `db push`.
--
-- -----------------------------------------------------------------------------
-- CE QUI EXISTE DÉJÀ, ET QU'ON NE REFAIT PAS
-- -----------------------------------------------------------------------------
--
-- L'écurie est en production depuis le 04/07/2026. `crews` (captain_id, name,
-- named_at), `crew_members` (role, referred_by, referral_validated), la vue
-- `crews_public` et le RPC `crews_public_rows()` existent et fonctionnent.
-- `heritage_packs` compte déjà les séances (sessions_total / sessions_used /
-- valid_from / valid_until / status), et `registrations.heritage_pack_id` relie
-- déjà une inscription à un pack. `convoys` porte meeting_point, rdv_at et
-- route_id, avec `convoy_participants` et un service create/join/leave.
--
-- Cette migration n'ajoute donc QUE ce qui manque, et se garde d'inventer une
-- table `crew_outings` qui dupliquerait `convoys` colonne pour colonne.
--
-- -----------------------------------------------------------------------------
-- DÉCISION : UNE SEULE ÉCURIE POUR TOUS LES USAGES
-- -----------------------------------------------------------------------------
--
-- L'écurie sert aujourd'hui au parrainage (referred_by, referral_validated,
-- annuaire au seuil de 20 membres). Elle servira aussi à organiser les sorties.
-- Le fondateur a tranché : un seul objet, pas deux. `crews` est donc étendue,
-- pas dupliquée.
--
-- -----------------------------------------------------------------------------
-- TABLES PARTAGÉES AVEC LE SITE — RÈGLE 4 DU README
-- -----------------------------------------------------------------------------
--
-- Aucune des tables touchées ici n'est dans la liste partagée (users, sessions,
-- circuits, media, app_settings, admin_audit). MAIS `registrations` est lue par
-- le site pour l'espace client : l'ajout de la fonction de consommation de pack
-- doit lui être signalé avant application, car elle écrit dans `registrations`
-- et `heritage_packs`.
--
-- =============================================================================

begin;

-- =============================================================================
-- 1 · L'INSIGNE — catalogue OU image téléversée, jamais les deux
-- =============================================================================
--
-- Le fondateur veut les deux voies ouvertes : un catalogue pour le capitaine qui
-- veut un insigne en trois gestes, un téléversement pour celui qui a déjà son
-- emblème. Ce sont deux voies, pas deux insignes : une écurie en porte UN.
--
-- La contrainte l'écrit plutôt que de faire confiance à l'app. Une écurie sans
-- insigne reste valide — l'insigne n'est pas obligatoire, et une écurie fraîche
-- n'en a pas.

alter table public.crews
  add column if not exists insigne_catalogue_key text,
  add column if not exists insigne_image_path    text,
  add column if not exists insigne_updated_at    timestamptz;

-- Une seule voie à la fois. `num_nonnulls` dit exactement ce qu'on veut vérifier
-- et se lit sans effort, là où un OR/AND imbriqué se relit mal dans six mois.
alter table public.crews
  drop constraint if exists crews_insigne_une_seule_voie;
alter table public.crews
  add constraint crews_insigne_une_seule_voie
  check (num_nonnulls(insigne_catalogue_key, insigne_image_path) <= 1);

-- -----------------------------------------------------------------------------
-- La modération ne concerne QUE le téléversement
-- -----------------------------------------------------------------------------
--
-- Une clé de catalogue est choisie dans une liste qu'on maîtrise : rien à
-- modérer. Une image téléversée devient du contenu affiché à d'autres pilotes
-- dans l'annuaire public, et doit donc être vue avant de l'être.
--
-- FAIL-CLOSED : le défaut est 'en_attente'. Une image tout juste téléversée
-- n'est PAS publique. C'est l'inverse du défaut confortable, et c'est voulu —
-- un insigne inapproprié visible une heure coûte plus qu'un insigne validé avec
-- une heure de retard.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'crew_insigne_status_enum') then
    create type public.crew_insigne_status_enum as enum ('en_attente', 'valide', 'refuse');
  end if;
end $$;

alter table public.crews
  add column if not exists insigne_status public.crew_insigne_status_enum,
  add column if not exists insigne_reviewed_at timestamptz,
  add column if not exists insigne_reviewed_by uuid references public.users(id);

-- Le statut n'a de sens QUE pour une image. Une clé de catalogue avec un statut
-- « en attente » laisserait croire qu'un insigne du catalogue peut être refusé.
alter table public.crews
  drop constraint if exists crews_insigne_statut_si_image;
alter table public.crews
  add constraint crews_insigne_statut_si_image
  check (
    (insigne_image_path is null and insigne_status is null)
    or (insigne_image_path is not null and insigne_status is not null)
  );

comment on column public.crews.insigne_catalogue_key is
  'Clé d''un insigne du catalogue app. Exclusif avec insigne_image_path. Aucune modération : la liste est maîtrisée.';
comment on column public.crews.insigne_image_path is
  'Chemin Storage d''un insigne téléversé. Exclusif avec insigne_catalogue_key. Public UNIQUEMENT si insigne_status = ''valide''.';

-- =============================================================================
-- 2 · LA SORTIE D'ÉCURIE — deux colonnes sur `convoys`, pas une table de plus
-- =============================================================================
--
-- `convoys` a déjà tout : session_id, created_by, meeting_point, rdv_at,
-- route_id, ses participants et son service. Il lui manque de savoir QUELLE
-- écurie sort, et OÙ elle mange.
--
-- `crew_id` est NULLABLE : un convoi entre pilotes qui ne sont pas d'une même
-- écurie reste possible, et c'est le cas qui existe aujourd'hui. Rendre la
-- colonne obligatoire invaliderait toutes les lignes en base.

alter table public.convoys
  add column if not exists crew_id       uuid references public.crews(id) on delete set null,
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;

create index if not exists convoys_crew_id_idx on public.convoys (crew_id) where crew_id is not null;

-- Seul le capitaine organise — décision fondateur. La contrainte ne peut pas
-- l'exprimer (elle porterait sur une autre table), c'est donc la politique RLS
-- plus bas qui la tient.
comment on column public.convoys.crew_id is
  'Écurie qui sort. NULL = convoi libre. Création réservée au capitaine (cf. politique convoys_crew_insert_capitaine).';
comment on column public.convoys.restaurant_id is
  'Restaurant choisi par le capitaine. Devient un waypoint de la requête GraphHopper, côté app.';

-- =============================================================================
-- 3 · L'INVITATION — un statut sur les participants existants
-- =============================================================================
--
-- `convoy_participants` ne portait que (convoy_id, user_id, joined_at) : on y
-- était, ou on n'y était pas. Une invitation demande un troisième état — convié,
-- pas encore répondu.
--
-- LE DÉFAUT EST 'present', PAS 'invite'. Toutes les lignes déjà en base sont des
-- gens qui ont rejoint un convoi de leur propre chef. Un défaut 'invite' les
-- transformerait rétroactivement en invitations sans réponse, et le convoi de
-- samedi se viderait à l'écran.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'convoy_participant_status_enum') then
    create type public.convoy_participant_status_enum as enum ('invite', 'present', 'decline');
  end if;
end $$;

alter table public.convoy_participants
  add column if not exists status public.convoy_participant_status_enum not null default 'present',
  add column if not exists invited_by uuid references public.users(id),
  add column if not exists responded_at timestamptz;

-- =============================================================================
-- 4 · LE PACK HERITAGE — la seule vraie difficulté du lot
-- =============================================================================
--
-- « Si un pilote est invité par son écurie, il peut utiliser l'une de ses 4
-- séances du pack Heritage. »
--
-- Rien à ajouter au schéma : `heritage_packs.sessions_used` et
-- `registrations.heritage_pack_id` existent. Ce qui manque est la GARANTIE que
-- deux inscriptions simultanées sur le dernier crédit n'en consomment pas deux.
--
-- Un `update ... set sessions_used = sessions_used + 1` depuis l'app ne suffit
-- pas : entre la lecture du solde et l'écriture, une seconde requête passe. La
-- fonction verrouille donc la ligne du pack (`for update`) avant de décider, et
-- refait TOUTES les vérifications côté serveur — l'app n'est jamais l'autorité
-- sur un crédit.
--
-- SECURITY DEFINER avec `search_path` figé : sans cela, un schéma temporaire
-- dans le chemin de recherche permettrait de détourner les tables appelées.

create or replace function public.oxv_use_heritage_session(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id   uuid;
  v_pack      public.heritage_packs%rowtype;
  v_session   uuid;
  v_invite    boolean;
begin
  -- 1. L'inscription appartient-elle à l'appelant ?
  select r.user_id, r.session_id into v_user_id, v_session
  from public.registrations r
  where r.id = p_registration_id;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'inscription_introuvable');
  end if;
  if v_user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'non_autorise');
  end if;

  -- 2. Le pilote a-t-il bien été INVITÉ par son écurie pour cette séance ?
  --    C'est la condition posée par le fondateur : le crédit s'ouvre sur une
  --    invitation d'écurie, pas sur une inscription libre.
  select exists (
    select 1
    from public.convoy_participants cp
    join public.convoys c on c.id = cp.convoy_id
    join public.crew_members cm on cm.crew_id = c.crew_id and cm.user_id = v_user_id
    where cp.user_id = v_user_id
      and c.session_id = v_session
      and c.crew_id is not null
      and cp.status in ('invite', 'present')
  ) into v_invite;

  if not v_invite then
    return jsonb_build_object('ok', false, 'error', 'pas_invite_par_ecurie');
  end if;

  -- 3. Le pack, VERROUILLÉ avant toute décision. `for update` sérialise les
  --    appels concurrents : le second attend, relit un solde à jour, et se voit
  --    refuser si le dernier crédit vient de partir.
  -- `status = 'active'` — valeur RÉELLE de heritage_pack_status_enum
  -- ('active' | 'completed' | 'expired'), vérifiée dans database.types.ts le
  -- 17/08. Le français 'actif' avait été écrit d'instinct : la fonction aurait
  -- compilé, ne serait jamais entrée dans cette branche, et aurait répondu
  -- « aucun pack utilisable » à un pilote qui en avait un.
  select * into v_pack
  from public.heritage_packs
  where user_id = v_user_id
    and status = 'active'
    and now() >= valid_from
    and now() <= valid_until
    and sessions_used < sessions_total
  order by valid_until asc
  limit 1
  for update;

  if v_pack.id is null then
    return jsonb_build_object('ok', false, 'error', 'aucun_pack_utilisable');
  end if;

  -- 4. Une inscription ne consomme qu'UNE fois. Sans ce garde-fou, un double
  --    appel depuis un écran qui rejoue sa requête décrémenterait deux crédits.
  if exists (
    select 1 from public.registrations
    where id = p_registration_id and heritage_pack_id is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'deja_consomme');
  end if;

  update public.heritage_packs
     set sessions_used = sessions_used + 1
   where id = v_pack.id;

  update public.registrations
     set heritage_pack_id = v_pack.id
   where id = p_registration_id;

  return jsonb_build_object(
    'ok', true,
    'pack_id', v_pack.id,
    'sessions_restantes', v_pack.sessions_total - v_pack.sessions_used - 1
  );
end $$;

revoke all on function public.oxv_use_heritage_session(uuid) from public, anon;
grant execute on function public.oxv_use_heritage_session(uuid) to authenticated;

comment on function public.oxv_use_heritage_session(uuid) is
  'Consomme une séance du pack Heritage pour une inscription, si le pilote a été invité par son écurie. Verrouille le pack (for update) : deux appels concurrents sur le dernier crédit n''en consomment qu''un.';

-- =============================================================================
-- 5 · RLS — le capitaine organise, les membres répondent
-- =============================================================================
--
-- À VÉRIFIER AVANT APPLICATION : les politiques existantes sur `convoys` et
-- `convoy_participants` n'ont pas été relues au moment d'écrire ce fichier.
-- Celles qui suivent AJOUTENT une voie ; elles ne remplacent rien, et il faut
-- s'assurer qu'aucune politique permissive existante ne rende la première
-- inutile.

-- Seul le capitaine attache un convoi à son écurie.
drop policy if exists convoys_crew_insert_capitaine on public.convoys;
create policy convoys_crew_insert_capitaine
  on public.convoys for insert
  to authenticated
  with check (
    crew_id is null
    or exists (
      select 1 from public.crews c
      where c.id = crew_id and c.captain_id = auth.uid()
    )
  );

-- Un membre répond pour LUI, et pour personne d'autre.
drop policy if exists convoy_participants_repond_pour_soi on public.convoy_participants;
create policy convoy_participants_repond_pour_soi
  on public.convoy_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- =============================================================================
-- CE QUI RESTE À FAIRE AVANT D'APPLIQUER
-- =============================================================================
--
-- 1. Relire les politiques RLS existantes de `convoys` et `convoy_participants`
--    (section 5), et les tests RLS par rôle — qui, rappel, ne s'exécutent
--    toujours pas faute de TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY.
-- 2. Créer le bucket Storage des insignes et sa politique de lecture (publique
--    seulement si insigne_status = 'valide').
-- 3. Prévenir l'équipe du site : la fonction écrit dans `registrations`.
-- 4. Confirmer que `restaurants` et `users` portent bien une clé primaire `id`
--    (supposé par les références des sections 1 à 3, non relu en base).
