/**
 * Service tableau de bord business du coach (§10.2 OXV Mirror).
 *
 * Décision Gabin (2026-06-07) : dashboard CÔTÉ COACH, sans remise dégressive.
 * Il montre le suivi factuel de l'activité du coach :
 *   - nombre de pilotes suivis ;
 *   - nombre de roulages organisés ;
 *   - présences confirmées ;
 *   - revenu cumulé de ses roulages tarifés (prix/place × présences).
 *
 * Aucune donnée fabriquée : le revenu n'existe que si le coach a renseigné
 * un prix sur ses roulages. Aucune commission, aucun CA OXV global, aucune
 * remise (tous écartés par décision Gabin).
 *
 * Gating UI : permission can_view_business_dashboard (§8.1 / migration 0032).
 * Données lues via les RLS coach existantes (roulages + invitations propres).
 */

import { listMyPilots } from './coachService';
import { type CoachBusinessSummary, computeCoachBusinessSummary } from './roulagesLogic';
import { listMyRoulages, listMyRoulageInvitationStatuses } from './roulagesService';

/**
 * Charge le résumé business du coach courant. Compose la liste des pilotes,
 * les roulages et les présences confirmées, puis délègue le calcul à la
 * logique pure `computeCoachBusinessSummary`.
 */
export async function loadCoachBusinessSummary(): Promise<CoachBusinessSummary> {
  const [pilots, roulages, statuses] = await Promise.all([
    listMyPilots(),
    listMyRoulages(),
    listMyRoulageInvitationStatuses(),
  ]);

  // Présences confirmées par roulage.
  const acceptedByRoulage = new Map<string, number>();
  for (const s of statuses) {
    if (s.status === 'accepted') {
      acceptedByRoulage.set(s.roulageId, (acceptedByRoulage.get(s.roulageId) ?? 0) + 1);
    }
  }

  return computeCoachBusinessSummary(pilots.length, roulages, acceptedByRoulage);
}
