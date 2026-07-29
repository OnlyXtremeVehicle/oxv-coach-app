-- ============================================================================
-- L-27bis : un créneau proposé par un coach ATTEND, il n'est plus « fermé »
-- ============================================================================
--
-- APPLIQUÉE EN PRODUCTION le 29/07/2026, sur accord du fondateur.
--
-- ----------------------------------------------------------------------------
-- LE DÉFAUT : LE SCHÉMA MENTAIT SUR L'INTENTION
-- ----------------------------------------------------------------------------
--
-- Le déclencheur transformait tout créneau ouvert par un non-admin en
-- `closed`. Le coach lisait donc « fermé » là où la vérité est « en attente de
-- validation ». Le plan de montage en fait le préalable de TOUT le jalon 6 :
-- sans état d'attente, aucun test de l'économie coach n'est possible.
--
-- ----------------------------------------------------------------------------
-- CE QUE JE N'AI PAS CHANGÉ, ET POURQUOI
-- ----------------------------------------------------------------------------
--
-- L'UPDATE conserve `NEW.status := OLD.status`. La proposition suggérait de le
-- faire basculer lui aussi en attente ; cela permettrait à un coach de faire
-- remonter N'IMPORTE QUEL créneau, même annulé, dans la file de validation.
--
-- C'est une décision produit — **un créneau annulé peut-il être re-proposé ?** —
-- qui n'a pas été prise. L'annulation reste donc terminale.
--
-- ----------------------------------------------------------------------------
-- CE QUI MANQUE ENCORE, ET QU'IL FAUT SAVOIR
-- ----------------------------------------------------------------------------
--
-- **Aucun écran ne permet de valider un créneau.** L'état existe désormais et
-- se nomme honnêtement, mais sa seule sortie passe par la console Supabase
-- tant que la file de validation n'est pas bâtie.
--
-- C'est le vrai préalable de l'économie coach, et il dépasse ce lot. Le dire
-- ici plutôt que de laisser croire que le sujet est clos.
-- ============================================================================

ALTER TABLE public.coach_availability
  DROP CONSTRAINT IF EXISTS coach_availability_status_check;

ALTER TABLE public.coach_availability
  ADD CONSTRAINT coach_availability_status_check
  CHECK (status IN ('open', 'full', 'closed', 'cancelled', 'pending_validation'));

CREATE OR REPLACE FUNCTION public.oxv_coach_availability_open_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
      -- L'attente se nomme. « closed » disait une fermeture qui n'existait pas.
      NEW.status := 'pending_validation';
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'open' THEN
      -- Inchangé : une réouverture par un non-admin est annulée, pas mise en
      -- attente. Un créneau annulé reste annulé.
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.oxv_coach_availability_open_gate() IS
  'Hors admin : un créneau créé « open » devient « pending_validation » (il attend, il n''est pas fermé) ; une réouverture est annulée par restauration du statut précédent. Voir L-27bis.';
