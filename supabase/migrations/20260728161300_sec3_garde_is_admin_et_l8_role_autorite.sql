-- ============================================================================
-- SEC-3 (garde is_admin) + LOT 8 OPTION B (role fait autorité)
--
-- APPLIQUÉE EN PRODUCTION le 28/07/2026 à 16:13:00 UTC, sur accord explicite du
-- fondateur (choix « SEC-3 + option B + coach_payout_details »).
--
-- Note de nommage : une migration `20260726152108_sec3_coach_pilots_colonnes`
-- porte déjà l'étiquette SEC-3 pour un autre sujet. Les deux coexistent ; ce
-- fichier-ci traite la garde de `users.is_admin`.
--
-- ---------------------------------------------------------------------------
-- PARTIE 1 — SEC-3 : LA GARDE N'AVAIT JAMAIS ÉTÉ ARMÉE
-- ---------------------------------------------------------------------------
-- Le corps de `guard_users_privileged_columns` couvrait bien les trois colonnes,
-- `is_admin` comprise. Le DÉCLENCHEUR, lui, se lisait :
--
--   BEFORE UPDATE OF role, kyc_status ON public.users
--
-- `is_admin` n'y figurait pas. En PostgreSQL, `UPDATE OF <liste>` ne déclenche
-- que si une colonne de la liste est au SET : un ordre ne touchant que
-- `is_admin` passait à côté.
--
-- `20260726152049_sec2_guard_is_admin.sql` a fait `create or replace function`
-- sans jamais recréer le déclencheur. Le correctif était inerte depuis le jour
-- de sa pose, le 26/07.
--
-- Chaîne vérifiée maillon par maillon avant correction : `authenticated`
-- détenait UPDATE sur la colonne ; `users_update_own_or_admin` autorisait sa
-- propre ligne en USING comme en WITH CHECK ; la garde ne se déclenchait pas ;
-- `is_admin()` rendait role='admin' OR is_admin=true. Donc
-- `update users set is_admin = true where id = auth.uid()` passait. Le dépôt
-- est public et la RLS est la seule barrière.
--
-- La requête n'a PAS été exécutée : la chaîne se lit dans le catalogue, et la
-- jouer aurait été l'attaque.
--
-- Aucune trace d'exploitation : `admin_audit` ne portait aucune ligne
-- `user_is_admin_change` depuis le 26/07 (date de pose de l'audit, lui
-- correctement armé), et un seul compte portait la colonne.
--
-- LEÇON. Le protocole de SEC-2 prévoyait deux contrôles. Le premier, sur la
-- définition de la FONCTION, passe et ne prouve rien. Le second, un essai réel
-- depuis une session pilote, l'aurait attrapé. C'est celui qui n'a pas été fait.
--
-- ---------------------------------------------------------------------------
-- PARTIE 2 — LOT 8, OPTION B : SUPPRIMER LE CAS PARTICULIER
-- ---------------------------------------------------------------------------
-- `administration@oxvehicle.fr` portait role='pilot' + is_admin=true : il roule
-- (7 séances) ET administre. Le plan de montage proposait un déclencheur miroir
-- avec une exemption nominative — c'est-à-dire d'inscrire une adresse e-mail en
-- dur dans le schéma, à maintenir pour toujours.
--
-- Option B retenue : le compte devient administrateur par son RÔLE, la fonction
-- cesse de consulter la colonne, et il n'y a plus de cas particulier.
--
-- CE QUE J'AVAIS ANNONCÉ À TORT, et qui a été vérifié avant d'écrire :
--
--   * « préalable obligatoire : scinder le compte (lot 9bis) » — FAUX. Aucune
--     policy ne conditionne quoi que ce soit à users.role='pilot' ; les données
--     du pilote sont gardées par auth.uid() = user_id. Et `app/index.tsx`
--     envoie `admin` et `pilot` vers le même arbre `(app2)`. Le compte garde ses
--     7 séances, son espace et son parcours.
--
--   * « 167 policies, aucune ne lit la colonne » — FAUX deux fois. 162 appellent
--     `is_admin()` (154 public + 8 storage) ; CINQ lisaient la colonne en
--     direct. Elles sont réalignées ici, sans quoi l'annotation « inerte » de
--     l'étape 4 aurait été un mensonge.
--
-- Le seul coût réel tenait dans deux lignes de TypeScript — `detailLevelLogic`
-- traitait l'admin comme un coach, lui imposant le mode détaillé sans
-- commutateur sur quatre écrans pilote. Corrigé dans le même lot.
--
-- BÉNÉFICE DE BORD : `public.oxv_is_admin()` était une seconde définition, plus
-- étroite (role='admin' seul), qui gardait `corporate_leads`,
-- `demandes_inscription` et `admin_validate_inscription`. Les deux définitions
-- rivales convergent désormais : « qui est administrateur » n'a plus qu'une
-- réponse dans toute la base.
--
-- VÉRIFIÉ APRÈS APPLICATION : trois comptes administrateurs, tous en
-- role='admin', aucun n'ayant perdu l'accès. Déclaration du déclencheur sans
-- clause OF. Zéro policy lisant encore la colonne.
--
-- Réversible : restaurer l'ancienne `is_admin()` et remettre role='pilot'.
-- ============================================================================

-- ÉTAPE 1 — le compte d'administration devient administrateur par son rôle.
-- DOIT précéder l'étape 2 : après elle, is_admin=true n'ouvre plus rien.
do $$
declare n int;
begin
  update public.users set role = 'admin'
   where email = 'administration@oxvehicle.fr';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'attendu 1 ligne mise à jour, obtenu % — migration abandonnée', n;
  end if;
end $$;

-- ÉTAPE 2 — `is_admin()` cesse de consulter la colonne.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select role = 'admin' from public.users where id = auth.uid()),
    false
  );
$function$;

comment on function public.is_admin() is
  'Vrai si le compte courant porte role = admin. La colonne users.is_admin '
  'n est plus consultée depuis le 28/07/2026 (lot 8, option B).';

-- ÉTAPE 3 — les cinq policies qui lisaient la colonne EN DIRECT.
-- Effet assumé : ces cinq tables (toutes vides, aucun écran) s'ouvrent aux
-- comptes role='admin' qui en étaient exclus faute de porter la colonne.
drop policy if exists ai_safety_reviews_admin_select on public.ai_safety_reviews;
create policy ai_safety_reviews_admin_select on public.ai_safety_reviews
  for select to authenticated using (public.is_admin());

drop policy if exists coach_annotations_admin_select on public.coach_annotations;
create policy coach_annotations_admin_select on public.coach_annotations
  for select to authenticated using (public.is_admin());

drop policy if exists coach_queue_admin_select on public.coach_queue;
create policy coach_queue_admin_select on public.coach_queue
  for select to authenticated using (public.is_admin());

drop policy if exists device_health_logs_admin_all on public.device_health_logs;
create policy device_health_logs_admin_all on public.device_health_logs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists media_exports_admin_select on public.media_exports;
create policy media_exports_admin_select on public.media_exports
  for select to authenticated using (public.is_admin());

-- ÉTAPE 4 — la colonne est conservée, inerte.
-- Pas supprimée : le site (dépôt oxv-site) n'a pas pu être vérifié d'ici.
comment on column public.users.is_admin is
  'INERTE depuis le 28/07/2026 (lot 8, option B) — role fait seule autorité. '
  'Conservée le temps de vérifier le site web. Ne plus s en servir.';

-- ÉTAPE 5 — SEC-3 : armer la garde.
-- SANS clause OF, délibérément. Lister des colonnes est exactement ce qui a
-- produit le défaut ; la fonction se garde déjà par `is distinct from`. On
-- supprime la classe du défaut, pas son instance.
drop trigger if exists trg_guard_users_privileged_columns on public.users;
create trigger trg_guard_users_privileged_columns
  before update on public.users
  for each row execute function public.guard_users_privileged_columns();

-- ============================================================================
-- VÉRIFICATION QUI RESTE À FAIRE, ET QUI SEULE PROUVE QUELQUE CHOSE
-- ============================================================================
-- Depuis une session PILOTE réelle (jeton `authenticated` — pas la console SQL,
-- qui tourne en `postgres` et serait exemptée) :
--
--   update public.users set is_admin = true where id = auth.uid();
--
-- doit échouer avec 42501. C'est le contrôle que SEC-2 avait omis.
-- ============================================================================
