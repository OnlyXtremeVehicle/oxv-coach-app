/**
 * Ce qu'on dit au coach après avoir écrit un créneau — logique PURE.
 *
 * ---
 *
 * LE MESSAGE QUE CE MODULE REMPLACE
 *
 * L'écran disait, après création :
 *
 *     « Créneau ouvert. Il apparaît désormais sur votre fiche. »
 *
 * Les deux phrases étaient fausses. Le déclencheur
 * `oxv_coach_availability_open_gate` (migration `20260718111150`) rabat `open`
 * sur `closed` pour tout appelant non administrateur, et `getCoachProfile` ne
 * lit que `open` / `full` — le créneau n'apparaissait donc nulle part.
 *
 * Le motif du déclencheur est légitime : une ouverture passe par une validation
 * OXV. **Le silence ne l'est pas.** L'écriture réussit, la valeur diffère,
 * personne n'est prévenu. Le coach croyait avoir ouvert un créneau ; il avait
 * déposé une demande.
 *
 * ---
 *
 * LA RÈGLE TENUE ICI
 *
 * On ne parle jamais du statut DEMANDÉ. On parle du statut RETENU par la base,
 * relu après écriture. Un message se déduit d'un fait, pas d'une intention.
 *
 * Ton OXV : vouvoiement, descriptif, aucune prescription, aucun emoji. On dit
 * ce qui est, on ne dit pas quoi faire.
 */

import type { AvailabilityStatus } from './coachMarketplaceService';

export interface MessageCreneau {
  /** Ligne principale. */
  titre: string;
  /** Précision factuelle. Absente quand il n'y a rien à préciser. */
  detail?: string;
  /**
   * Vrai quand la base n'a pas retenu ce qui était demandé. L'écran s'en sert
   * pour choisir un ton neutre plutôt qu'un ton de réussite — ce n'est pas un
   * échec, mais ce n'est pas non plus ce qui a été demandé.
   */
  ecart: boolean;
}

/** Message après CRÉATION d'un créneau. `open` est toujours ce qui est demandé. */
export function messageCreation(statusEffectif: AvailabilityStatus): MessageCreneau {
  if (statusEffectif === 'open') {
    return {
      titre: 'Créneau ouvert.',
      detail: 'Il apparaît sur votre fiche.',
      ecart: false,
    };
  }

  // Le cas courant depuis le 29/07 : la base retient `pending_validation`, et
  // l'attente se nomme. Auparavant elle se déguisait en `closed`, et le coach
  // lisait « fermé » là où rien n'était refusé.
  if (statusEffectif === 'pending_validation') {
    return {
      titre: 'Créneau proposé.',
      detail: 'Il attend une validation OXV avant d’apparaître sur votre fiche.',
      ecart: true,
    };
  }

  return {
    titre: 'Créneau proposé.',
    detail: 'Il apparaîtra sur votre fiche après validation par OXV.',
    ecart: true,
  };
}

/** Message après CHANGEMENT de statut d'un créneau existant. */
export function messageChangement(
  demande: AvailabilityStatus,
  effectif: AvailabilityStatus
): MessageCreneau {
  if (demande === effectif) {
    return { titre: LIBELLES[effectif], ecart: false };
  }

  // Demander l'ouverture depuis un autre statut : le déclencheur restaure
  // l'ancien. L'écran de disponibilités n'offre pas ce chemin aujourd'hui, mais
  // le service est appelable ailleurs — et un « c'est fait » serait faux.
  if (demande === 'open') {
    return {
      titre: 'Créneau non rouvert.',
      detail: 'La réouverture passe par OXV. Le créneau reste ' + ETATS[effectif] + '.',
      ecart: true,
    };
  }

  return {
    titre: 'Créneau ' + ETATS[effectif] + '.',
    detail: 'La base a retenu un autre statut que celui demandé.',
    ecart: true,
  };
}

/** Titre au passé, pour une action qui vient d'aboutir. */
const LIBELLES: Record<AvailabilityStatus, string> = {
  open: 'Créneau ouvert.',
  full: 'Créneau marqué complet.',
  closed: 'Créneau fermé.',
  cancelled: 'Créneau annulé.',
  pending_validation: 'Créneau proposé.',
};

/** Adjectif d'état, pour une phrase qui décrit la situation. */
const ETATS: Record<AvailabilityStatus, string> = {
  open: 'ouvert',
  full: 'complet',
  closed: 'fermé',
  cancelled: 'annulé',
  // « en attente » : le créneau existe et rien n'est refusé.
  pending_validation: 'en attente de validation',
};
