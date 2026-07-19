/**
 * Logique PURE du Support (lot V2-L4, mission D, écran 8/8).
 *
 * Libellés de statut et « ton » de la pastille — sans couleur ici (la logique
 * reste testable sans tokens ni RN). L'écran traduit le ton en couleur v2 :
 * accent RÉSERVÉ à l'état actif (en cours de traitement), le reste en gris.
 */

import type { SupportStatus } from '@/services/supportService';

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

/** Ton de la pastille de statut, sans couleur (traduit en token par l'écran). */
export type SupportTone = 'active' | 'done' | 'muted';

/**
 * Ton d'un statut : `active` (en attente/en cours → accent), `done` (résolu),
 * `muted` (fermé). Un seul accent par écran : seul `active` le porte.
 */
export function supportStatusTone(status: SupportStatus): SupportTone {
  if (status === 'resolu') return 'done';
  if (status === 'ferme') return 'muted';
  return 'active';
}

/** Un ticket fermé n'accepte plus de réponse. */
export function isTicketClosed(status: SupportStatus): boolean {
  return status === 'ferme';
}
