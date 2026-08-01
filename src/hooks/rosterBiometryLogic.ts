/**
 * Décisions PURES de la réconciliation des abonnements biométrie.
 *
 * Module sans I/O — ni Supabase, ni React, ni RN. Il existe pour que la règle
 * qui garde ouvert un canal de santé soit vérifiable en test : le dépôt ne monte
 * pas de composants, et cette décision mérite mieux qu'une relecture.
 */

/**
 * Un abonnement en cours doit-il être CONSERVÉ ?
 *
 * Trois raisons de le laisser tomber : le pilote n'est plus attendu, il est
 * reparti sur une AUTRE séance, ou on le lit désormais sous un AUTRE compte
 * coach.
 *
 * Ce dernier cas manquait. Depuis le lot 27a-bis, chaque coach a son canal
 * (`live:bio:<coachId>:<sessionId>`), et un commentaire annonçait que changer de
 * compte referait les abonnements — mais la réconciliation ne comparait que la
 * séance. Un abonnement ouvert sous le coach A, sur une séance inchangée, était
 * conservé après passage au coach B : l'application restait branchée sur le
 * canal du précédent. La garde était posée, elle ne se déclenchait pas.
 * Relevé par la revue adversariale du 01/08/2026.
 */
export function abonnementAGarder(
  existant: { sessionId: string; coachId: string },
  sessionVoulue: string | undefined,
  coachCourant: string | null
): boolean {
  if (sessionVoulue === undefined) return false;
  if (existant.sessionId !== sessionVoulue) return false;
  return existant.coachId === coachCourant;
}
