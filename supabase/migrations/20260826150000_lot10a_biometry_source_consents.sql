-- =============================================================================
-- LOT 10a · `biometry_source_consents` — le consentement biométrie PAR SOURCE.
-- =============================================================================
--
-- NON APPLIQUÉE. Fichier préfixé `PROPOSITION_` : il n'entre pas dans la chaîne
-- `schema_migrations`, il attend la relecture du fondateur. Aucun apply_migration
-- n'a été exécuté.
--
-- -----------------------------------------------------------------------------
-- CE QUI EXISTE DÉJÀ, ET QUI NE SUFFIT PAS
-- -----------------------------------------------------------------------------
--
-- La base porte trois colonnes horodatées sur `users`, et elles sont correctes :
--
--   biometry_capture_consent_at      — capter la fréquence cardiaque en séance
--   biometry_coach_share_consent_at  — la partager au coach binôme détaillé
--   biometry_asked_at                — la question A ÉTÉ POSÉE (lot L21)
--
-- Rien à y reprendre : NULL vaut refus, une date vaut preuve horodatée, la
-- révocation est un retour à NULL, et `consentService` tient l'invariant
-- « partage ⇒ capture » dans les deux sens.
--
-- Mais ces trois colonnes sont par USAGE, jamais par SOURCE. Or le document
-- validé par le conseil le 25/07/2026 (docs/juridique/consentement_biometrie.md)
-- décrit deux régimes distincts, et le dit noir sur blanc :
--
--   « Apple Watch (tous les pilotes, SUR OPTION) […] Mesure au poignet,
--     indicative. »
--   « Ceinture Polar (pilotes accompagnés d'un coach, SUR OPTION RENFORCÉE)
--     […] fréquence cardiaque ET VARIABILITÉ, mesure de précision. La ceinture
--     est appairée au paddock par le staff. »
--
-- Deux options de portée différente, un seul interrupteur en base. Un pilote qui
-- accepte que sa montre relise son cardio après le run accepte, du même geste et
-- sans qu'on puisse l'en distinguer, qu'une ceinture thoracique le mesure en
-- continu avec sa variabilité. Le texte qu'il a lu distinguait les deux ; la
-- base ne le peut pas.
--
-- Et l'on ne peut pas non plus RETIRER une source seule. « Retirer en un geste,
-- sans justification » ne peut aujourd'hui s'exercer que sur les deux à la fois.
--
-- -----------------------------------------------------------------------------
-- POURQUOI UNE TABLE, ET NON DEUX COLONNES DE PLUS SUR `users`
-- -----------------------------------------------------------------------------
--
-- Deux colonnes (`biometry_belt_consent_at`, `biometry_watch_consent_at`)
-- auraient suivi le patron existant, et c'était la piste la plus courte. Trois
-- raisons y ont fait renoncer :
--
--   1. CHAQUE SOURCE NOUVELLE DEVIENDRAIT UNE MIGRATION. Le registre applicatif
--      (`src/features/biometrie/sourcesBiometrie.ts`) est extensible par nature ;
--      une ceinture d'une autre marque, un autre dossier de santé, et il faudrait
--      une DDL pour un consentement de plus.
--
--   2. L'AUDIT DE L'ARTICLE 9 VEUT UNE HISTOIRE, PAS UN ÉTAT. Une colonne remise
--      à NULL efface la preuve qu'un accord a existé. Ici, la révocation ÉCRIT
--      (`revoked_at`), elle n'efface pas : on peut montrer qu'un accord a été
--      donné le 12, retiré le 14, et que rien n'a été mesuré après.
--
--   3. LE DÉPÔT A DÉJÀ TRANCHÉ CE CAS. M05 (`lap_marks`, 25/08/2026) a choisi la
--      table contre le jsonb pour exactement ce motif : « une ligne par décision
--      donne l'audit gratuitement ». Même problème, même réponse.
--
-- -----------------------------------------------------------------------------
-- CE QUI EST VOLONTAIREMENT ABSENT
-- -----------------------------------------------------------------------------
--
--   • AUCUNE POLITIQUE UPDATE. Un consentement ne se corrige pas : il se retire
--     (une ligne de révocation) et se redonne (une ligne neuve). C'est ce qui
--     rend l'audit vrai — personne ne peut réécrire après coup ce que quelqu'un
--     a déclaré à un instant. Même raison qu'en M05.
--
--   • AUCUN ACCÈS COACH. Le coach lit des mesures sous condition de partage ; il
--     n'a rien à faire dans le registre des accords du pilote.
--
--   • AUCUNE VALEUR SEMÉE. La table naît vide. Le code lit alors
--     `jamais_recueilli`, et `decisionCapture` autorise sur le SOCLE SEUL en le
--     NOMMANT (motif `socle_seul`). On ne fabrique aucun accord rétroactif : on
--     dit lequel porte réellement la décision, jusqu'à ce que l'écran de recueil
--     soit posé.
--
-- =============================================================================

-- 1 · LE VOCABULAIRE DES SOURCES, CLOS ----------------------------------------
-- Miroir du CHECK déjà en place sur `biometry_raw.source`. Les deux mêmes
-- valeurs, pour qu'un accord et une mesure parlent de la même source. Un enum
-- plutôt qu'un texte libre : ce qui se compte doit se nommer d'avance.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'biometry_source_enum') then
    create type public.biometry_source_enum as enum ('polar_h10', 'apple_watch');
  end if;
end $$;

-- 2 · LA TABLE ----------------------------------------------------------------
create table if not exists public.biometry_source_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  source      public.biometry_source_enum not null,
  -- L'instant de l'accord. Jamais NULL : une ligne EXISTE parce qu'un accord a
  -- été donné. L'absence de ligne est l'absence d'accord.
  granted_at  timestamptz not null default now(),
  -- L'instant du retrait. NULL tant que l'accord tient. Renseigné, la ligne
  -- devient une trace historique et cesse d'autoriser quoi que ce soit.
  revoked_at  timestamptz null,
  created_at  timestamptz not null default now(),
  constraint biometry_source_consents_ordre_chronologique
    check (revoked_at is null or revoked_at >= granted_at)
);

comment on table public.biometry_source_consents is
  'Lot 10a : accord de CAPTURE par SOURCE biométrique (santé, RGPD art. 9). '
  'Complète le socle users.biometry_capture_consent_at, ne le remplace pas : '
  'la mesure exige les DEUX. Une ligne = un accord donné ; revoked_at = son '
  'retrait, conservé comme trace. Aucune ligne = aucun accord pour cette source.';

comment on column public.biometry_source_consents.revoked_at is
  'Retrait de l''accord. La ligne est CONSERVÉE (audit art. 9) et n''autorise '
  'plus rien dès que cette colonne est renseignée.';

-- Un seul accord ACTIF par (pilote, source) à la fois. L'index partiel autorise
-- autant de lignes révoquées qu'il y a eu de cycles accord/retrait — c'est
-- justement l'historique qu'on veut garder.
create unique index if not exists biometry_source_consents_actif_unique
  on public.biometry_source_consents (user_id, source)
  where revoked_at is null;

create index if not exists biometry_source_consents_user
  on public.biometry_source_consents (user_id);

-- 3 · RLS ---------------------------------------------------------------------
alter table public.biometry_source_consents enable row level security;

-- Le pilote LIT ses accords.
drop policy if exists biometry_source_consents_own_select on public.biometry_source_consents;
create policy biometry_source_consents_own_select on public.biometry_source_consents
  for select to authenticated
  using (auth.uid() = user_id);

-- Le pilote DONNE un accord — pour lui-même, jamais pour un autre.
drop policy if exists biometry_source_consents_own_insert on public.biometry_source_consents;
create policy biometry_source_consents_own_insert on public.biometry_source_consents
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Le RETRAIT est la seule écriture autorisée sur une ligne existante, et c'est
-- pour cela qu'il passe par une fonction (§4) plutôt que par une policy UPDATE :
-- une policy UPDATE laisserait aussi réécrire `granted_at` ou `source`, donc
-- réécrire l'histoire. La fonction ne touche QUE `revoked_at`.
--
-- AUCUNE policy DELETE : on ne supprime pas une trace de consentement. La purge
-- du compte s'en charge (§5).
-- AUCUNE policy coach, staff, partner, anon.

-- 4 · LE RETRAIT, EN UN GESTE -------------------------------------------------
-- « Vous pouvez retirer l'un ou l'autre à tout moment, en un geste, sans
-- justification. » — document validé, 25/07/2026.
create or replace function public.revoke_biometry_source_consent(
  p_source public.biometry_source_enum
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.biometry_source_consents
     set revoked_at = now()
   where user_id = auth.uid()
     and source = p_source
     and revoked_at is null;
$$;

comment on function public.revoke_biometry_source_consent(public.biometry_source_enum) is
  'Lot 10a : retire l''accord ACTIF du pilote appelant pour une source. '
  'Écrit revoked_at, ne supprime jamais la ligne (audit art. 9). Idempotent : '
  'sans accord actif, ne fait rien.';

revoke all on function public.revoke_biometry_source_consent(public.biometry_source_enum)
  from public, anon;
grant execute on function public.revoke_biometry_source_consent(public.biometry_source_enum)
  to authenticated;

-- 5 · PURGE DU COMPTE ---------------------------------------------------------
-- `purge_user_data` ÉNUMÈRE ses tables — le dépôt a déjà connu des « tables
-- oubliées » (migration rgpd_purge_tables_oubliees). Le cascade sur `users`
-- couvre la suppression du compte ; il ne couvre PAS la purge, qui ANONYMISE
-- `users` au lieu de le supprimer (piège connu : aucun cascade ne se déclenche
-- alors). La ligne doit donc être ajoutée explicitement à la fonction, à côté du
-- `delete from public.biometry_raw where user_id = p_user;` déjà présent :
--
--   delete from public.biometry_source_consents where user_id = p_user;
--
-- Elle n'est PAS écrite ici : `purge_user_data` est réécrite en entier à chaque
-- migration qui la touche, et la recopier de mémoire risquerait d'en perdre une
-- branche. À intégrer à la prochaine réécriture, ou dans une migration dédiée
-- reprenant le corps EXACT de la version en production au moment de l'écriture.
--
-- Rétention : `purge_old_biometry()` (30 jours) porte sur les MESURES. Un
-- consentement n'est pas une mesure — il est la base légale qui l'autorise, et
-- il se conserve tant que le compte existe. Aucune rétention n'est posée ici.

-- =============================================================================
-- 6 · ARBITRAGE FONDATEUR DU 26/08/2026 — DEUX ACCORDS, ET LA CEINTURE LIÉE
-- =============================================================================
--
-- « deux acceptations différentes et la ceinture seulement si coach affilié
--   durant sessions »
--
-- Le premier point était déjà tenu : une ligne par source, donc deux accords
-- distincts, chacun révocable seul. Rien à ajouter.
--
-- Le second est neuf, et il change la nature de l'accord ceinture. La ceinture
-- thoracique mesure en continu et porte la variabilité cardiaque — la donnée de
-- santé la plus fine du dispositif. Le fondateur la subordonne à la présence
-- d'un coach affilié : elle n'existe pas comme équipement de confort, elle
-- existe parce qu'un professionnel l'accompagne.
--
-- DEUX ENDROITS, ET C'EST VOULU :
--
--   • ICI, à la pose de l'accord — un accord ceinture sans affiliation active
--     est REFUSÉ. Fail fast : mieux vaut un refus net au moment du geste qu'un
--     accord qui dort et qu'on croit valide.
--   • DANS LE CODE (`consentementSource.ts`) à chaque séance — parce qu'une
--     affiliation peut cesser APRÈS l'accord. La base ne peut pas rejouer sa
--     garde à chaque battement ; le module, lui, décide séance par séance.
--
-- On ne RÉVOQUE pas l'accord quand l'affiliation cesse : révoquer serait
-- décider à la place du pilote. L'accord dort, la capture s'arrête, et il
-- reprend si un coach revient. La distinction compte — l'un est un fait
-- d'usage, l'autre serait une volonté qu'on lui prête.

create or replace function public.biometry_ceinture_exige_un_coach()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.source = 'polar_h10' then
    if not exists (
      select 1 from public.coach_pilots cp
      where cp.pilot_id = new.user_id
        and cp.active
        and cp.pilot_consent_at is not null
        and cp.coach_consent_at is not null
    ) then
      raise exception
        'La ceinture cardio demande un coach affilié. Aucune affiliation active pour ce pilote.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.biometry_ceinture_exige_un_coach() from public, anon, authenticated;

drop trigger if exists biometry_ceinture_exige_un_coach_trg on public.biometry_source_consents;
create trigger biometry_ceinture_exige_un_coach_trg
  before insert on public.biometry_source_consents
  for each row execute function public.biometry_ceinture_exige_un_coach();

comment on function public.biometry_ceinture_exige_un_coach() is
  'Arbitrage du 26/08/2026 : la ceinture cardio n''est consentable que si le '
  'pilote a une affiliation coach ACTIVE et doublement consentie. La montre, '
  'elle, ne dépend de personne. Le module consentementSource rejoue la règle '
  'à chaque séance, car une affiliation peut cesser après l''accord.';
