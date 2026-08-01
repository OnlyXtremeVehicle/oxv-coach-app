/**
 * RÉCONCILIATION DES ABONNEMENTS BIOMÉTRIE — faut-il garder celui-ci ?
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * `changement de compte`. Le lot 27a-bis a donné à chaque coach son canal de
 * santé, `live:bio:<coachId>:<sessionId>`. Un commentaire annonçait alors que
 * changer de compte referait tous les abonnements — mais la réconciliation ne
 * comparait que la SÉANCE. Un abonnement ouvert sous le coach A, sur une séance
 * qui n'avait pas bougé, était conservé tel quel après passage au coach B :
 * l'application restait branchée sur le canal du coach précédent.
 *
 * La garde était posée, elle ne se déclenchait pas — le motif récurrent de ce
 * dépôt. Relevé par la revue adversariale du 01/08/2026.
 *
 * ---
 *
 * CE QUE CE TEST NE PROUVE PAS
 *
 * Qu'un coach puisse lire le canal d'un autre. Il n'y arrive pas : la RLS
 * `realtime.messages` l'en empêche, appliquée le 01/08/2026. Ce qui est en jeu
 * ici est plus modeste et bien réel : un abonnement laissé sur un topic auquel
 * on n'a plus droit ne reçoit plus rien, et la pastille cardio du roster
 * resterait muette sans qu'on sache pourquoi.
 */

import { abonnementAGarder } from '@/hooks/rosterBiometryLogic';

const sousA = { sessionId: 'S1', coachId: 'coach-A' };

describe('abonnementAGarder', () => {
  it('changement de compte — l’abonnement du coach précédent TOMBE', () => {
    // Même pilote, même séance : seul le compte a changé.
    expect(abonnementAGarder(sousA, 'S1', 'coach-B')).toBe(false);
  });

  it('garde l’abonnement quand rien n’a bougé', () => {
    expect(abonnementAGarder(sousA, 'S1', 'coach-A')).toBe(true);
  });

  it('le pilote est reparti sur une autre séance → on refait l’abonnement', () => {
    expect(abonnementAGarder(sousA, 'S2', 'coach-A')).toBe(false);
  });

  it('le pilote n’est plus attendu → on ferme', () => {
    // `undefined` = absent de la liste des partageurs (parti, ou révoqué).
    expect(abonnementAGarder(sousA, undefined, 'coach-A')).toBe(false);
  });

  it('plus de compte connu → on ferme, on ne garde pas « au cas où »', () => {
    // Un canal de santé ne reste pas ouvert sur un compte déconnecté.
    expect(abonnementAGarder(sousA, 'S1', null)).toBe(false);
  });
});
