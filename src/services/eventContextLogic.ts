/**
 * Dérivation du bandeau « mode démo » du Bilan (PR-20b, pur).
 *
 * Doctrine d'HONNÊTETÉ (test_alpha/02 §5.2) : les algorithmes de marge sont
 * calibrés pour le circuit. Sur un événement HORS circuit (balade, test alpha,
 * partenaire, corporate), les analyses sont expérimentales — l'app le DIT plutôt
 * que de laisser croire à une lecture comparable. Le message se DÉRIVE de
 * `event_type` (pas de colonne `context` séparée).
 *
 * Pur, testable. Voir `eventsService.getEventLite`.
 */

export interface DemoBanner {
  title: string;
  body: string;
}

/** Types d'événements qui ne sont PAS une session de circuit calibrée. */
const NON_CIRCUIT_EVENT_TYPES = new Set([
  'balade_decouverte',
  'test_alpha',
  'partenaire',
  'corporate',
]);

/**
 * Renvoie le bandeau d'honnêteté à afficher pour un `event_type`, ou `null`
 * quand la session est une session de circuit normale (`session` ou non rattachée
 * à un événement).
 */
export function demoBannerForEventType(eventType: string | null | undefined): DemoBanner | null {
  if (!eventType || !NON_CIRCUIT_EVENT_TYPES.has(eventType)) return null;
  return {
    title: 'Cet événement n’est pas une session de circuit.',
    body: 'Les analyses présentées ci-dessous sont expérimentales et ne se comparent pas à vos sessions de circuit. Vos données sont préservées pour votre information.',
  };
}
