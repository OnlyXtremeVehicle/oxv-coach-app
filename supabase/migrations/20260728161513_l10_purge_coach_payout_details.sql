-- ============================================================================
-- LOT 10 — `coach_payout_details` rejoint la purge RGPD.
--
-- APPLIQUÉE EN PRODUCTION le 28/07/2026 à 16:15:13 UTC, sur accord explicite du
-- fondateur.
--
-- LE DÉFAUT. La table porte `coach_id, iban, bic, account_holder`. Elle était
-- absente de `purge_user_data` ET de la matrice de purge. Un coach exerçant son
-- droit à l'effacement laissait derrière lui ses coordonnées bancaires
-- complètes et le nom du titulaire du compte.
--
-- Aucune rétention ne le justifiait : contrairement à `payments` et `invoices`,
-- ce n'est pas une pièce comptable — c'est un moyen de versement, sans objet dès
-- que la relation cesse.
--
-- 0 ligne au moment de l'application, aucun coach en base : le défaut était réel
-- et pas encore exercé.
--
-- COMMENT IL A ÉTÉ TROUVÉ. Vérification colonne par colonne, et non table par
-- table — 88 couples (table, colonne) référencent `public.users`. Un premier
-- essai comparait des noms de tables et rendait `registrations` « couverte »
-- parce que `event_registrations` contient la chaîne : faux positif silencieux,
-- sur la table la plus sensible du lot. Requête corrigée et rejouable :
-- `supabase/verifications/couverture_purge.sql`.
--
-- Sur les 28 couples non couverts, la matrice de purge en justifiait 27 —
-- rétention comptable de dix ans, colonnes d'acteur administratif conservées,
-- capitanat d'équipe. Ce document est solide. Le vingt-huitième était celui-ci.
--
-- MÉTHODE. La fonction fait 90 lignes. La recopier pour y ajouter une ligne,
-- c'est risquer d'en perdre une autre en silence — et chaque ligne perdue est
-- une table qui cesse d'être purgée, sans que rien ne le signale. On part donc
-- de la définition VIVANTE, on y insère la ligne à une ancre, et on abandonne si
-- l'ancre a disparu.
--
-- VÉRIFIÉ APRÈS APPLICATION : 51 `delete` et 8 `update` dans la fonction (un de
-- plus qu'avant, aucun perdu) ; `coach_testimonials`, `telemetry_sessions` et
-- `biometry_raw` toujours présentes ; couverture passée de 60/28 à 60/27.
-- ============================================================================

do $do$
declare
  src text;
  ancre constant text := 'delete from public.coach_reading_weights  where coach_id = p_user;';
  ajout constant text := 'delete from public.coach_payout_details   where coach_id = p_user;';
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'purge_user_data';

  if src is null then
    raise exception 'purge_user_data introuvable — migration abandonnée';
  end if;

  -- Idempotence : rejouer la migration ne doit rien casser.
  if position('coach_payout_details' in src) > 0 then
    raise notice 'coach_payout_details déjà purgée — rien à faire';
    return;
  end if;

  -- Fail-closed : sans l'ancre, on ne devine pas où insérer.
  if position(ancre in src) = 0 then
    raise exception 'ancre introuvable dans purge_user_data — migration abandonnée';
  end if;

  src := replace(src, ancre, ancre || E'\n  ' || ajout);

  execute src;
end
$do$;

comment on function public.purge_user_data(uuid) is
  'Purge RGPD dun compte. Vérification de couverture colonne par colonne : '
  'supabase/verifications/couverture_purge.sql. coach_payout_details ajoutée '
  'le 28/07/2026 (lot 10) — un IBAN survivait à la suppression du compte.';
