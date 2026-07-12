/**
 * Paddock NG (V9 §7) — l'action principale contextuelle de l'accueil.
 *
 * « En moins de 5 secondes, le pilote sait quoi faire. » Une SEULE action, choisie
 * selon l'état pilote (S3..S10) : la séance fraîche mène à la Trace du jour, le
 * lendemain au débrief, au circuit au Pass, l'anticipation à la préparation, le
 * repos au dernier bilan. Logique PURE → testable.
 *
 * Doctrine : l'app DÉCRIT la situation (hint factuel), elle ne dirige pas le
 * pilotage. Le hint situe (« votre séance vient de se terminer »), il ne commande
 * pas. En piste (S5/S6), aucune action : silence. Vouvoiement, pas d'emoji.
 */

import type { PilotState } from '@/types/state';

export interface PaddockAction {
  label: string;
  href: string;
  /** Phrase factuelle situant le moment, ou null. Jamais une consigne. */
  hint: string | null;
}

export interface PaddockHeroInput {
  state: PilotState;
  hasRecentSession: boolean;
  recentSessionId: string | null;
}

function withSession(base: string, sessionId: string | null): string {
  return sessionId ? `${base}?sessionId=${sessionId}` : base;
}

/**
 * L'action principale du Paddock pour l'état courant, ou null en piste (silence).
 */
export function decidePaddockAction(input: PaddockHeroInput): PaddockAction | null {
  const { state, hasRecentSession, recentSessionId } = input;

  switch (state) {
    // Silence en piste / en route : aucune action, l'app se tait.
    case 'S5_approche':
    case 'S6_roulage':
      return null;

    case 'S4_anticipation':
      return {
        label: 'Préparer ma session',
        href: '/(app)/preparation',
        hint: 'Votre prochaine session approche.',
      };

    case 'S7_paddock':
      return {
        label: 'Mon Pass du jour',
        href: '/(app)/pass-oxv',
        hint: 'Vous êtes au circuit.',
      };

    case 'S8_atterrissage':
      return hasRecentSession
        ? {
            label: 'Découvrir ma trace du jour',
            href: withSession('/(app)/trace', recentSessionId),
            hint: 'Votre séance vient de se terminer.',
          }
        : { label: 'Préparer ma session', href: '/(app)/session', hint: null };

    case 'S9_decantation':
      return hasRecentSession
        ? {
            label: 'Mon débrief',
            href: withSession('/(app)/debrief', recentSessionId),
            hint: 'À tête reposée.',
          }
        : { label: 'Préparer ma session', href: '/(app)/session', hint: null };

    // Repos, attente, et tout état hors flux : dernier bilan si présent, sinon
    // la première préparation.
    case 'S10_repos':
    case 'S3_attente':
    default:
      return hasRecentSession
        ? {
            // Copie maquette §7.1 : « Lire le bilan » (sec, direct).
            label: 'Lire le bilan',
            href: withSession('/(app)/bilan', recentSessionId),
            hint: null,
          }
        : { label: 'Préparer ma première session', href: '/(app)/session', hint: null };
  }
}
