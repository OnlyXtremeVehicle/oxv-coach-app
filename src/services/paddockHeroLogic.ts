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
 *
 * Lot L6 — les destinations pointent désormais vers l'arbre V2. Trois écrans v1
 * distincts (trace du jour, débrief, bilan) sont servis par le même
 * `/(app2)/bilan/[sessionId]`, qui les réunit en sections. Les libellés restent
 * ceux de la maquette et n'ont pas été retouchés : ils disent au pilote POURQUOI
 * il y va, la section atteinte diffère selon le moment. À confirmer avec Gabin si
 * « Découvrir ma trace du jour » doit viser une ancre plus précise.
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

/**
 * La séance ouverte dans l'arbre V2. Le bilan V2 prend l'identifiant en segment
 * de chemin (`bilan/[sessionId]`) et non en paramètre de requête : sans
 * identifiant, `/(app2)/bilan` n'est pas une route valide. On renvoie alors vers
 * la liste des séances, qui est vraie plutôt que cassée.
 */
function sessionHref(sessionId: string | null): string {
  return sessionId ? `/(app2)/bilan/${sessionId}` : '/(app2)/data';
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
        href: '/(app2)/rec/preparation',
        hint: 'Votre prochaine session approche.',
      };

    case 'S7_paddock':
      return {
        label: 'Mon Pass du jour',
        href: '/(app2)/club/pass',
        hint: 'Vous êtes au circuit.',
      };

    case 'S8_atterrissage':
      return hasRecentSession
        ? {
            label: 'Découvrir ma trace du jour',
            href: sessionHref(recentSessionId),
            hint: 'Votre séance vient de se terminer.',
          }
        : { label: 'Préparer ma session', href: '/(app2)/rec', hint: null };

    case 'S9_decantation':
      return hasRecentSession
        ? {
            label: 'Mon débrief',
            href: sessionHref(recentSessionId),
            hint: 'À tête reposée.',
          }
        : { label: 'Préparer ma session', href: '/(app2)/rec', hint: null };

    // Repos, attente, et tout état hors flux : dernier bilan si présent, sinon
    // la première préparation.
    case 'S10_repos':
    case 'S3_attente':
    default:
      return hasRecentSession
        ? {
            // Copie maquette §7.1 : « Lire le bilan » (sec, direct).
            label: 'Lire le bilan',
            href: sessionHref(recentSessionId),
            hint: null,
          }
        : { label: 'Préparer ma première session', href: '/(app2)/rec', hint: null };
  }
}
