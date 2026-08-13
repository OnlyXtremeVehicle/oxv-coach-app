-- =============================================================================
-- PROPOSITION — `coach_activity_facts()`, pour remplacer `coach_testimonials`
-- =============================================================================
--
-- NON APPLIQUÉE. C'est une fonction SECURITY DEFINER : elle contourne la RLS
-- par construction, et cela vous revient.
--
-- -----------------------------------------------------------------------------
-- CE QUE LE PLAN DEMANDE
--
-- *« Suppression de coach_testimonials. Remplacée par la vérification OXV et
-- les faits d'activité dérivés de coaching_bookings — un relevé que le coach ne
-- peut pas écrire lui-même. »* — jalon 6, phase 5.
--
-- L'intention est juste : un témoignage est un propos ; un relevé d'activité est
-- un fait. Le second ne se fabrique pas.
--
-- -----------------------------------------------------------------------------
-- POURQUOI UNE FONCTION, ET PAS UNE LECTURE CÔTÉ APPLICATION
--
-- Vérifié le 14/08/2026 : `coaching_bookings` n'expose que
--
--     coaching_bookings_pilot_select  →  pilot_id = auth.uid()
--     coaching_bookings_coach_select  →  coach_id = auth.uid()
--
-- Un pilote qui consulte la fiche d'un coach ne peut donc PAS lire les
-- réservations de ce coach — et c'est très bien ainsi. Dériver les faits côté
-- application supposerait d'ouvrir la table, c'est-à-dire d'exposer qui roule
-- avec qui. La fonction rend des COMPTES, jamais des lignes.
--
-- -----------------------------------------------------------------------------
-- CE QU'ELLE NE REND PAS, ET C'EST LE POINT
--
--   • aucune identité de pilote, aucun identifiant, aucune date de séance ;
--   • aucune note, aucune moyenne, aucun rang, aucun superlatif ;
--   • aucun montant.
--
-- Trois nombres et une date de début. Le coach ne peut pas les écrire, et
-- personne ne peut en déduire qui a roulé.
--
-- -----------------------------------------------------------------------------
-- ABSENCE ≠ ZÉRO
--
-- Un coach sans séance accompagnée rend `seances = 0`. L'écran doit écrire
-- « aucune séance accompagnée pour l'instant », jamais afficher un « 0 » nu à
-- côté d'un libellé — c'est la règle A-WEATHER-1 appliquée à un relevé.
--
-- -----------------------------------------------------------------------------
-- L'APPLICATION N'APPELLE PAS ENCORE CETTE FONCTION, DÉLIBÉRÉMENT
--
-- Écrire l'appelant d'une RPC qui n'existe pas produit une erreur à
-- l'exécution ; écrire la logique sans appelant produit du code inerte. Ce
-- dépôt a payé les deux. Le câblage suit l'application de cette migration, et
-- il tient en une vingtaine de lignes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.coach_activity_facts(p_coach_id uuid)
RETURNS TABLE (
  seances_accompagnees integer,
  pilotes_distincts    integer,
  depuis               date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    count(*) filter (where b.status = 'completed')::integer,
    count(distinct b.pilot_id) filter (where b.status = 'completed')::integer,
    min(b.created_at) filter (where b.status = 'completed')::date
  from public.coaching_bookings b
  where b.coach_id = p_coach_id;
$function$;

COMMENT ON FUNCTION public.coach_activity_facts(uuid) IS
  'Relevé FACTUEL d''activité d''un coach, dérivé de coaching_bookings. '
  'Remplace coach_testimonials (jalon 6). Rend des comptes, jamais des lignes : '
  'aucune identité de pilote, aucune note, aucun rang, aucun montant. '
  'SECURITY DEFINER parce que la RLS de coaching_bookings réserve la lecture '
  'aux deux parties, et qu''il ne faut pas l''ouvrir pour compter.';

REVOKE ALL ON FUNCTION public.coach_activity_facts(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.coach_activity_facts(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- VÉRIFICATION APRÈS APPLICATION
--
--   select * from public.coach_activity_facts(
--     (select coach_id from public.coaching_bookings limit 1));
--
-- Attendu au 14/08/2026 : 1 séance, 1 pilote — la base porte deux réservations
-- dont une complétée, pour un seul coach. Et zéro témoignage : le remplacement
-- ne fait perdre aucun contenu.
--
-- ANNULATION
--   DROP FUNCTION IF EXISTS public.coach_activity_facts(uuid);
-- -----------------------------------------------------------------------------
