/**
 * La sortie d'écurie — la part qui se teste.
 *
 * ===========================================================================
 * CE QUE CE MODULE ARME
 * ===========================================================================
 *
 * `convoysService.inviter`, `.repondre` et `.utiliserSeanceHeritage` ont été
 * écrites sans appelant — le motif exact que ce dépôt se reproche depuis
 * `nameMyCrew`. Ce module et l'écran `club/sortie` les arment.
 *
 * ===========================================================================
 * LA RÈGLE QUI TIENT L'ÉCRAN : ON N'AFFICHE PAS UN GESTE QUI SERA REFUSÉ
 * ===========================================================================
 *
 * Trois politiques serveur décident réellement — `convoys_crew_insert_capitaine`
 * (RESTRICTIVE), `convoy_participants_invite_capitaine`,
 * `convoy_participants_repond_pour_soi`. Ce module ne les redouble PAS pour
 * protéger quoi que ce soit : il les reproduit pour ne pas peindre un bouton qui
 * échouerait. Un bouton refusé est le défaut que ce lot corrige ailleurs.
 *
 * Si les deux divergeaient, c'est le serveur qui aurait raison, et l'écran qui
 * aurait un bouton mort — jamais l'inverse.
 */

import type { Convoy, StatutParticipant } from '@/services/v2/convoysService';

/** Un membre de l'écurie, tel que l'écran doit le proposer à l'invitation. */
export interface MembreInvitable {
  readonly userId: string;
  readonly nom: string;
  /** `null` = jamais convié. Sinon, sa réponse. */
  readonly statut: StatutParticipant | null;
}

/**
 * Les membres de l'écurie, chacun avec son état sur CETTE sortie.
 *
 * Le capitaine est inclus : il sort avec son écurie, et l'exclure de la liste
 * donnerait à croire qu'il n'y participe pas.
 *
 * L'ordre suit celui des membres reçu — jamais un tri par statut. Regrouper les
 * « décliné » en bas dresserait une liste de mauvais élèves, et l'écurie affiche
 * des faits, pas des verdicts.
 */
export function membresAvecStatut(
  membres: readonly { userId: string; nom: string }[],
  convoi: Convoy | null
): MembreInvitable[] {
  const par = new Map<string, StatutParticipant>();
  for (const p of convoi?.participants ?? []) par.set(p.userId, p.statut);
  return membres.map((m) => ({ ...m, statut: par.get(m.userId) ?? null }));
}

/**
 * Qui reste à convier. Un pilote déjà `invite` n'est pas reproposé : le
 * réinviter n'ajouterait rien (`ignoreDuplicates` côté service) et laisserait
 * croire au capitaine que son geste n'avait pas pris.
 *
 * Un pilote qui a DÉCLINÉ reste invitable — un refus sur une sortie n'est pas un
 * refus pour toujours, et c'est au capitaine d'en juger, pas à l'écran.
 */
export function aConvier(membres: readonly MembreInvitable[]): MembreInvitable[] {
  return membres.filter((m) => m.statut === null || m.statut === 'decline');
}

/** Ceux qui ont dit oui. C'est le seul chiffre que l'écran met en avant. */
export function comptePresents(membres: readonly MembreInvitable[]): number {
  return membres.filter((m) => m.statut === 'present').length;
}

/**
 * Le lecteur peut-il organiser cette sortie ?
 *
 * Reproduit `convoys_crew_insert_capitaine`. Une écurie sans capitaine identifié
 * rend `false` — dans le doute, on n'affiche pas le geste.
 */
export function peutOrganiser(
  membres: readonly { userId: string; role: string }[],
  userId: string | null
): boolean {
  if (!userId) return false;
  return membres.some((m) => m.userId === userId && m.role === 'captain');
}

/** L'invitation du lecteur sur cette sortie, s'il en a une. */
export function monStatut(convoi: Convoy | null, userId: string | null): StatutParticipant | null {
  if (!convoi || !userId) return null;
  return convoi.participants.find((p) => p.userId === userId)?.statut ?? null;
}

/**
 * Le lecteur doit-il répondre ? Uniquement s'il est convié et n'a pas tranché.
 * `present` ne redemande pas — il a déjà dit oui, lui remontrer deux boutons
 * lui ferait croire que sa réponse s'est perdue.
 */
export function doitRepondre(convoi: Convoy | null, userId: string | null): boolean {
  return monStatut(convoi, userId) === 'invite';
}

/**
 * Résumé de la sortie, en une ligne factuelle.
 *
 * AUCUN CHRONO, comme partout dans l'écurie : ni durée, ni distance, ni « le
 * plus rapide ». La garde `ecurieSansChrono` vérifie l'écran ; la règle est
 * répétée ici parce que c'est ici qu'on serait tenté d'ajouter « 45 min de
 * route ».
 */
export function resumeSortie(membres: readonly MembreInvitable[], avecRestaurant: boolean): string {
  const n = comptePresents(membres);
  const gens = n === 0 ? 'Personne n’a encore répondu' : n === 1 ? '1 pilote' : `${n} pilotes`;
  return avecRestaurant ? `${gens} · une étape en route` : gens;
}
