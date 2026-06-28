/**
 * Mapping pur statut de lien capture → message d'écran (PR-08).
 *
 * Doctrine d'HONNÊTETÉ (cf. captureSessionService) : ne JAMAIS laisser croire
 * qu'on enregistre alors que le boîtier a décroché. L'écran de roulage (silence
 * en piste) affiche le voyant REC tant que le lien tient ; si le lien BLE tombe,
 * il doit le DIRE — sobrement, sans son ni HUD, juste un constat. Ce n'est pas
 * une entorse au silence : c'est l'app qui reste honnête sur ce qu'elle fait.
 *
 * Pur (pas de React Native) → testable. `import type` n'embarque aucun runtime.
 */

import type { CaptureLinkStatus } from './captureSessionService';

export interface CaptureLinkMessage {
  /** Eyebrow mono (état). */
  title: string;
  /** Phrase factuelle. */
  sub: string;
  /** Registre visuel : `rec` (nominal, rouge REC) n'a pas de message ; sinon neutre. */
  tone: 'warn' | 'lost';
}

/**
 * Renvoie le message à afficher pour un statut de lien, ou `null` quand le
 * lien est nominal (`recording`/`idle`) — l'écran garde alors son rendu de
 * silence habituel.
 */
export function captureLinkMessage(status: CaptureLinkStatus): CaptureLinkMessage | null {
  switch (status) {
    case 'interrupted':
      return {
        title: 'LIEN INTERROMPU',
        sub: 'Reconnexion au boîtier en cours. L’enregistrement reprend dès le lien rétabli.',
        tone: 'warn',
      };
    case 'lost':
      return {
        title: 'LIEN PERDU',
        sub: 'Le boîtier ne répond plus. Votre session a été enregistrée jusqu’ici.',
        tone: 'lost',
      };
    case 'recording':
    case 'idle':
      return null;
  }
}
