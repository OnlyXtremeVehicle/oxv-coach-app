-- =============================================================================
-- LOT 10c · Les trois pièces que le moteur de composition n'a pas en base.
-- ÉCRITE, NON APPLIQUÉE. À relire, puis à décider.
-- =============================================================================
--
-- CE QUI A ÉTÉ VÉRIFIÉ AVANT D'ÉCRIRE UNE SEULE LIGNE
--
-- `compositionLogic` (lot 9a) nomme six entrées sans source. Chacune a été
-- cherchée dans `src/types/database.types.ts` ET dans la base de production
-- (26/08/2026, `fouvuqkdxarjpjbqnsjq`). Deux existaient :
--
--   `faits.acquis`     EXISTE — `cycle_steps.status = 'atteint'`, dont le
--                      commentaire en base dit « statut en_cours/atteint
--                      observe par le coach, aucun score chiffre ». Lu par
--                      `src/features/presentations/sourcesCompositionService.ts`.
--   `faits.voixCoach`  EXISTE — `coach_annotations.audio_url` (PR-59), écrite
--                      par `coachAudioService`, que personne ne relisait.
--
-- Cette migration n'y touche pas. Elle n'ajoute QUE ce qui manque vraiment.
--
-- CE QU'ELLE AJOUTE, ET POURQUOI RIEN D'EXISTANT NE SUFFIT
--
--   1. `pilot_presentation_views` — `experience.presentationsVues`.
--      Aucune table du dépôt ne retient ce qu'un pilote a OUVERT. La recherche
--      a été faite sur les colonnes, pas sur les noms : les seuls `viewed`,
--      `opened_at` et `last_viewed_at` de la base appartiennent aux liens de
--      partage (`app_progression_shares`), aux emails (`email_log`) et aux
--      rituels (`ritual_dispatches`) — des ouvertures de MESSAGES, pas de
--      lectures. Sans cette table, `plafondNiveau` perd sa règle « l'usage vaut
--      le compteur » : un pilote qui a déjà ouvert une lecture de niveau preuve
--      redescendrait au flash à chaque séance jusqu'à sa troisième.
--
--   2. `pilot_presentation_work` — `travailActif`.
--      Le §00 du cahier : « une seule opportunité : les autres restent cachées
--      jusqu'à ce que le travail actif soit terminé ». `pilot_goals`,
--      `coach_objectives` et `cycle_steps` portent des SUJETS de travail
--      (freinage, virage 7) ; aucun ne porte l'identifiant de la PRÉSENTATION
--      ouverte, qui est ce que la règle du §00 gouverne. Sans cette table,
--      `choisirOpportunite` reçoit toujours `null` et rouvre un chantier
--      différent à chaque run — le pilote n'en termine aucun.
--      La règle « une seule » est tenue par un index unique partiel, en base :
--      une garde applicative se contourne, une contrainte non.
--
--   3. `pilot_corner_landmarks` — `faits.reperePiste` (P38 « Repère mémoire »).
--      `coach_corner_reference` porte le mot « repère » et pas la chose : point
--      de freinage en mètres, vitesse cible, note de trajectoire. P38 demande
--      « Photo, panneau, vibreur ou objet réel associé » — un ancrage utilisable
--      au volant, validé par le coach, un par virage. Servir P38 depuis les
--      mètres et les km/h du coach ouvrirait la fiche sur autre chose qu'elle.
--
-- CE QU'ELLE N'AJOUTE PAS, DÉLIBÉRÉMENT
--
--   `faits.referencePartagee` (P59 « Gestionnaire de références ») MANQUE aussi
--   — `app_progression_shares` publie les chiffres de progression d'un pilote
--   vers le web, pas une référence à laquelle se comparer ; `pilot_friendships`
--   ouvre les séances d'un ami sans rien publier. Mais M09 exige de cette table
--   « provenance, date, véhicule, conditions et compatibilité visibles » et un
--   partage « autorisé, équitable, révocable et anonymisable ». C'est un modèle
--   de CONSENTEMENT inter-pilotes, donc une décision fondateur, pas de la
--   plomberie de lot. Une demi-table de consentement serait pire que rien : on
--   la nomme ici, on ne l'invente pas.
--
--   Aucune colonne photo sur `pilot_corner_landmarks`. La photo de P38 suppose
--   un bucket et sa RLS storage — même raison. Le libellé (« le panneau 100 m »,
--   « le vibreur bleu ») fait tenir la fiche ; la photo s'ajoutera avec son
--   bucket, en une colonne.
--
-- CE QUE L'INSPECTION DES POLITIQUES RÉELLES A DICTÉ
--
--   1. Les présentations ouvertes sont un ESPACE INTIME. Le modèle suivi est
--      celui de `pilot_goals` (« jamais visible des coachs ni admins »), pas
--      celui de `pilot_notes` (partage opt-in). Savoir ce qu'un pilote a
--      regardé, et combien de fois, c'est de l'observation de comportement :
--      elle n'a aucune raison de remonter à qui que ce soit. Aucune politique
--      coach, aucune politique admin sur `pilot_presentation_views`.
--
--   2. Le TRAVAIL, lui, est partagé : P39 « Le coach choisit le changement ».
--      Le coach consenti (`is_coach_of`, la même fonction que `lap_marks`) y
--      lit, y ouvre et y clôt. Il ne peut pas signer à la place d'un autre :
--      `closed_by` est contraint à `auth.uid()`.
--
--   3. Sur un repère, « le coach valide le repère » — il ne le réécrit pas. La
--      RLS ne sait pas dire « ces colonnes-là seulement » : un trigger le dit,
--      et refuse au coach toute modification hors validation. Sans lui, la
--      politique UPDATE du coach lui aurait donné le libellé du pilote.
--
--   4. `purge_user_data` ANONYMISE la ligne `users` au lieu de la supprimer :
--      aucun `on delete cascade` vers `users` ne se déclenche jamais. Les trois
--      tables sont donc ÉNUMÉRÉES dans la purge, en bas de fichier — c'est le
--      défaut qu'a corrigé `rgpd_purge_tables_oubliees_v2`, et que `lap_marks`
--      a documenté le 25/08.
--
-- =============================================================================

-- Les identifiants du catalogue, P01 à P65 (registrePresentations.ts). Un
-- domaine plutôt qu'un texte libre : un `presentation_id` mal recopié doit
-- échouer à l'écriture, pas rendre une ligne que plus rien ne retrouve.
-- Délimiteur TAGUÉ : le motif se termine par `$'`, et un `$$` nu obligerait le
-- relecteur à vérifier lui-même que le lexer ne s'y arrête pas.
do $domaine$ begin
  if not exists (select 1 from pg_type where typname = 'presentation_id_domain') then
    create domain public.presentation_id_domain as text
      check (value ~ '^P(0[1-9]|[1-5][0-9]|6[0-5])$');
  end if;
end $domaine$;

comment on domain public.presentation_id_domain is
  'Identifiant du catalogue des 65 présentations (P01–P65). Miroir en base de src/features/presentations/registrePresentations.ts.';

-- =============================================================================
-- 1 · CE QUE LE PILOTE A OUVERT
-- =============================================================================

create table if not exists public.pilot_presentation_views (
  user_id         uuid not null references public.users(id) on delete cascade,
  presentation_id public.presentation_id_domain not null,
  first_opened_at timestamptz not null default now(),
  last_opened_at  timestamptz not null default now(),
  primary key (user_id, presentation_id),
  constraint pilot_presentation_views_ordre_des_dates
    check (last_opened_at >= first_opened_at)
);

comment on table public.pilot_presentation_views is
  'Ce que le pilote a déjà ouvert dans le catalogue des présentations. Espace intime own-row : '
  'ni coach, ni admin. Sert le plafond de lecture (« l''usage vaut le compteur ») et l''ordre du débrief.';
comment on column public.pilot_presentation_views.first_opened_at is
  'La première fois. Ce que P48 appelle « au prochain événement » se lit contre cette date, pas contre un compteur.';

-- AUCUN COMPTEUR D'OUVERTURES. Une ligne dit « déjà vue », et c'est tout ce que
-- le moteur demande. Compter les regards, c'est fabriquer un chiffre que
-- quelqu'un finirait par afficher — la doctrine n'en veut pas.

alter table public.pilot_presentation_views enable row level security;

drop policy if exists pilot_presentation_views_own on public.pilot_presentation_views;
create policy pilot_presentation_views_own on public.pilot_presentation_views
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Le DELETE est volontairement ouvert au pilote : il doit pouvoir oublier une
-- lecture sans passer par l'effacement de tout son compte.

revoke all on public.pilot_presentation_views from anon;
grant select, insert, update, delete on public.pilot_presentation_views to authenticated;

-- =============================================================================
-- 2 · LE TRAVAIL EN COURS, ET UN SEUL
-- =============================================================================

create table if not exists public.pilot_presentation_work (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  presentation_id public.presentation_id_domain not null,
  -- La séance qui a ouvert le chantier. `set null` : effacer une capture ne
  -- doit pas effacer le travail qu'elle a déclenché.
  session_id      uuid references public.telemetry_sessions(id) on delete set null,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  closed_by       uuid references public.users(id) on delete set null,
  motif_cloture   text,
  constraint pilot_presentation_work_signataire_apres_cloture
    check (closed_by is null or closed_at is not null),
  constraint pilot_presentation_work_motif_apres_cloture
    check (motif_cloture is null or closed_at is not null),
  constraint pilot_presentation_work_motif_non_vide
    check (motif_cloture is null or length(btrim(motif_cloture)) > 0),
  constraint pilot_presentation_work_cloture_apres_ouverture
    check (closed_at is null or closed_at >= opened_at)
);

comment on table public.pilot_presentation_work is
  'Le chantier ouvert sur une opportunité, et sa clôture. §00 du cahier : une seule opportunité à la fois, '
  'les autres restent cachées jusqu''à ce que le travail actif soit terminé. La règle est l''index unique partiel ci-dessous.';
comment on column public.pilot_presentation_work.closed_by is
  'Qui a conclu. NULL avec closed_at renseigné = conclu par le résultat observé, sans que personne ait tranché.';
comment on column public.pilot_presentation_work.motif_cloture is
  'Le mot de celui qui conclut, libre et facultatif. Descriptif : ce qui a été observé, jamais une consigne.';

-- LA RÈGLE DU §00, TENUE PAR LA BASE. Un seul chantier ouvert par pilote.
create unique index if not exists pilot_presentation_work_un_seul_ouvert
  on public.pilot_presentation_work (user_id)
  where closed_at is null;

-- L'historique d'un pilote, du plus récent au plus ancien (P48, rétention).
create index if not exists pilot_presentation_work_historique_idx
  on public.pilot_presentation_work (user_id, opened_at desc);

alter table public.pilot_presentation_work enable row level security;

-- LECTURE. Le pilote, et son coach consenti — le coach doit voir le chantier
-- qu'il a ouvert, sinon il en ouvre un second sans le savoir.
drop policy if exists pilot_presentation_work_select on public.pilot_presentation_work;
create policy pilot_presentation_work_select on public.pilot_presentation_work
  for select to authenticated
  using (user_id = auth.uid() or is_coach_of(user_id));

-- OUVERTURE. Chez soi, ou chez son pilote. L'index unique partiel arbitre le
-- reste : si le pilote a déjà un chantier ouvert, le coach ne peut pas en
-- superposer un second, et c'est exactement la règle.
drop policy if exists pilot_presentation_work_insert on public.pilot_presentation_work;
create policy pilot_presentation_work_insert on public.pilot_presentation_work
  for insert to authenticated
  with check (
    (user_id = auth.uid() or is_coach_of(user_id))
    and (closed_by is null or closed_by = auth.uid())
  );

-- CLÔTURE. On signe de son propre nom, jamais de celui d'un autre.
drop policy if exists pilot_presentation_work_update on public.pilot_presentation_work;
create policy pilot_presentation_work_update on public.pilot_presentation_work
  for update to authenticated
  using (user_id = auth.uid() or is_coach_of(user_id))
  with check (
    (user_id = auth.uid() or is_coach_of(user_id))
    and (closed_by is null or closed_by = auth.uid())
  );

-- RETRAIT. Au pilote seul : le chantier est le sien, même ouvert par le coach.
drop policy if exists pilot_presentation_work_delete on public.pilot_presentation_work;
create policy pilot_presentation_work_delete on public.pilot_presentation_work
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.pilot_presentation_work from anon;
grant select, insert, update, delete on public.pilot_presentation_work to authenticated;

-- =============================================================================
-- 3 · LE REPÈRE MÉMOIRE (P38)
-- =============================================================================

create table if not exists public.pilot_corner_landmarks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id)    on delete cascade,
  circuit_id   uuid not null references public.circuits(id) on delete cascade,
  corner_index integer not null,
  label        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  -- Le même plafond que partout ailleurs (migration corner_index_plafond_30).
  constraint pilot_corner_landmarks_corner_index
    check (corner_index >= 1 and corner_index <= 30),
  constraint pilot_corner_landmarks_label_non_vide
    check (length(btrim(label)) >= 1 and length(btrim(label)) <= 200),
  constraint pilot_corner_landmarks_validation_coherente
    check ((validated_by is null) = (validated_at is null))
);

comment on table public.pilot_corner_landmarks is
  'P38 « Repère mémoire » : l''objet réel auquel le pilote rattache une action — panneau, vibreur, bâtiment. '
  'Un repère par virage (« TEXTE 1 repère »). Le coach VALIDE ; il ne réécrit pas — trigger ci-dessous.';
comment on column public.pilot_corner_landmarks.label is
  'Le repère dit avec les mots du pilote. Descriptif, jamais une consigne : « le panneau 100 m », pas « freiner au 100 m ».';
comment on column public.pilot_corner_landmarks.validated_by is
  'Le coach qui a confirmé que le repère existe et tombe au bon endroit. NULL = pas encore regardé, pas « refusé ».';

-- « 1 repère » par virage, par pilote, par circuit.
create unique index if not exists pilot_corner_landmarks_un_par_virage
  on public.pilot_corner_landmarks (user_id, circuit_id, corner_index);

-- LE COACH VALIDE, IL NE RÉÉCRIT PAS.
-- La RLS ne sait pas restreindre des COLONNES. Sans ce trigger, la politique
-- UPDATE du coach lui donnerait le libellé du pilote — c'est-à-dire le droit de
-- changer le souvenir de quelqu'un d'autre.
create or replace function public.pilot_corner_landmarks_coach_valide_seulement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() est NULL côté serveur (purge, tâche de fond) : la comparaison
  -- rend NULL, la garde ne s'applique pas. C'est voulu — elle protège d'un
  -- coach connecté, pas d'une opération d'administration.
  if new.user_id is distinct from auth.uid() and auth.uid() is not null then
    if new.label        is distinct from old.label
    or new.circuit_id   is distinct from old.circuit_id
    or new.corner_index is distinct from old.corner_index
    or new.user_id      is distinct from old.user_id then
      raise exception
        'pilot_corner_landmarks : le coach valide un repère, il ne le réécrit pas.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke execute on function public.pilot_corner_landmarks_coach_valide_seulement()
  from public, anon, authenticated;

drop trigger if exists pilot_corner_landmarks_coach_valide_seulement_trg
  on public.pilot_corner_landmarks;
create trigger pilot_corner_landmarks_coach_valide_seulement_trg
  before update on public.pilot_corner_landmarks
  for each row execute function public.pilot_corner_landmarks_coach_valide_seulement();

alter table public.pilot_corner_landmarks enable row level security;

drop policy if exists pilot_corner_landmarks_select on public.pilot_corner_landmarks;
create policy pilot_corner_landmarks_select on public.pilot_corner_landmarks
  for select to authenticated
  using (user_id = auth.uid() or is_coach_of(user_id));

-- Le repère est celui du pilote : lui seul le pose.
drop policy if exists pilot_corner_landmarks_insert on public.pilot_corner_landmarks;
create policy pilot_corner_landmarks_insert on public.pilot_corner_landmarks
  for insert to authenticated
  with check (user_id = auth.uid() and validated_by is null);

drop policy if exists pilot_corner_landmarks_update on public.pilot_corner_landmarks;
create policy pilot_corner_landmarks_update on public.pilot_corner_landmarks
  for update to authenticated
  using (user_id = auth.uid() or is_coach_of(user_id))
  with check (
    (user_id = auth.uid() or is_coach_of(user_id))
    and (validated_by is null or validated_by = auth.uid())
  );

drop policy if exists pilot_corner_landmarks_delete on public.pilot_corner_landmarks;
create policy pilot_corner_landmarks_delete on public.pilot_corner_landmarks
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.pilot_corner_landmarks from anon;
grant select, insert, update, delete on public.pilot_corner_landmarks to authenticated;

-- =============================================================================
-- 4 · RGPD — LA PURGE ÉNUMÈRE, ELLE NE CASCADE PAS
-- =============================================================================
--
-- `purge_user_data` ANONYMISE la ligne `users` : elle ne la supprime pas. Les
-- `on delete cascade` posés plus haut ne se déclenchent donc JAMAIS pour un
-- compte purgé — ils ne restent qu'un filet pour une vraie suppression de
-- ligne. Les trois tables sont ajoutées explicitement, et les deux références
-- CROISÉES (`closed_by`, `validated_by`) sont dénouées : un coach effacé ne
-- doit pas laisser son identifiant dans le dossier de ses pilotes.
--
-- La fonction fait 9 Ko. La retranscrire pour ajouter cinq lignes, c'est
-- risquer d'en perdre une autre au passage : on l'édite à l'ancre, et on ÉCHOUE
-- BRUYAMMENT si l'ancre a bougé. Un patch silencieux qui ne s'applique pas
-- serait pire que pas de patch du tout.
do $$
declare
  v_def text;
  v_ancre constant text := '  update public.users' || chr(10) || '     set email';
  -- Le corps de purge_user_data est dollar-quoté ($function$) : les quotes y
  -- sont simples. Ici, en littéral SQL, chacune s'écrit donc doublée.
  v_ajout constant text :=
    '  -- LOT 10c : presentations ouvertes, chantier en cours, reperes memoire.' || chr(10) ||
    '  if to_regclass(''public.pilot_presentation_views'') is not null then' || chr(10) ||
    '    execute ''delete from public.pilot_presentation_views where user_id = $1'' using p_user;' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if to_regclass(''public.pilot_presentation_work'') is not null then' || chr(10) ||
    '    execute ''delete from public.pilot_presentation_work where user_id = $1'' using p_user;' || chr(10) ||
    '    execute ''update public.pilot_presentation_work set closed_by = null where closed_by = $1'' using p_user;' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if to_regclass(''public.pilot_corner_landmarks'') is not null then' || chr(10) ||
    '    execute ''delete from public.pilot_corner_landmarks where user_id = $1'' using p_user;' || chr(10) ||
    '    execute ''update public.pilot_corner_landmarks set validated_by = null, validated_at = null where validated_by = $1'' using p_user;' || chr(10) ||
    '  end if;' || chr(10) || chr(10);
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'purge_user_data';

  if v_def is null then
    raise exception 'purge_user_data introuvable : la purge RGPD ne couvrirait pas le lot 10c.';
  end if;

  -- Idempotence : rejouer la migration ne doit pas empiler le patch.
  if position('pilot_presentation_views' in v_def) > 0 then
    raise notice 'purge_user_data couvre déjà le lot 10c — rien à faire.';
    return;
  end if;

  if position(v_ancre in v_def) = 0 then
    raise exception
      'purge_user_data : ancre d''anonymisation introuvable. Ajouter à la main les '
      'suppressions de pilot_presentation_views, pilot_presentation_work et '
      'pilot_corner_landmarks avant la mise à jour de public.users.';
  end if;

  execute replace(v_def, v_ancre, v_ajout || v_ancre);
end $$;
