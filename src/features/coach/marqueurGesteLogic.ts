/**
 * POSER UN MARQUEUR — la décision, pure (jalon 6, phase 5).
 *
 * *« Le coach voit quelque chose et marque : geste du Neural Band sur les
 * lunettes, doigt sur le plateau, ou dans le focus. »* — Arbre Coach, II.2.
 *
 * Module sans I/O. Il répond à une seule question : quel instant de la capture
 * ce geste désigne-t-il, et est-il seulement posable ?
 *
 * ---
 *
 * L'HORLOGE DU PILOTE, JAMAIS CELLE DU COACH
 *
 * Le marqueur pourrait se dater sur la montre du coach — ce serait faux. Deux
 * téléphones ne sont jamais d'accord à la seconde près, et le résolveur ne
 * tolère qu'une seconde d'écart avec la trame la plus proche : un décalage
 * d'horloge rendrait la vitesse et le freinage muets, sans qu'on sache pourquoi.
 *
 * La trame du direct porte `atMs`, posé par **l'appareil du pilote** — le même
 * qui a horodaté le début de la capture. La soustraction des deux est donc
 * exacte par construction, quel que soit l'état de l'horloge du coach.
 *
 * Et l'inverse vaut pour la FRAÎCHEUR : elle se juge entre deux instants de
 * l'horloge DU COACH — la réception de la trame, et maintenant. Mélanger les
 * deux mesures ne donnerait pas un âge, mais un âge plus le décalage entre les
 * appareils.
 *
 * ---
 *
 * ON NE POSE RIEN SUR DU VIDE
 *
 * Sans trame récente, il n'y a pas d'instant à désigner. Le bouton doit alors
 * être éteint plutôt que de produire un marqueur qui ne résoudra rien.
 */

/**
 * Âge maximal de la dernière trame pour qu'un marqueur soit posable.
 *
 * Le flux tourne à ~3 Hz. Au-delà de trois secondes, on n'est plus en direct
 * mais sur un reste d'affichage : dater le geste sur cette trame le placerait
 * là où le pilote était, pas là où il est.
 */
export const TRAME_FRAICHE_MAX_MS = 3000;

export interface ContexteMarqueur {
  /** Horodatage de la dernière trame, posé par l'appareil DU PILOTE. */
  derniereTrameAtMs: number | null;
  /**
   * Instant de RÉCEPTION de cette trame, sur l'horloge DU COACH.
   *
   * C'est le seul terme comparable à `maintenantMs` : les deux viennent du même
   * appareil. Une première version soustrayait `maintenantMs` à
   * `derniereTrameAtMs` — deux horloges différentes — et ne mesurait donc pas un
   * âge mais un âge PLUS le décalage entre deux téléphones. Le bouton pouvait
   * rester éteint toute une séance pendant que l'en-tête affichait « en direct »,
   * ou laisser poser un marqueur sur une trame morte depuis des minutes.
   *
   * La règle est déjà écrite ailleurs dans le dépôt (`useRosterBiometry`) : on
   * périme sur l'horloge du coach, jamais sur `atMs`. Relevé par la revue
   * adversariale du 02/08/2026.
   */
  receptionMs: number | null;
  /** Début de la capture, ISO — même appareil que `derniereTrameAtMs`. */
  debutCaptureIso: string | null;
  /** Horloge locale DU COACH, injectée pour rester pur et testable. */
  maintenantMs: number;
}

export type RefusMarqueur = 'pas-de-trame' | 'trame-perimee' | 'debut-inconnu' | 'avant-le-debut';

export type DecisionMarqueur =
  | { posable: true; elapsedMs: number }
  | { posable: false; motif: RefusMarqueur };

/**
 * Quel instant de la capture ce geste désigne-t-il ?
 *
 * Rend `posable: false` avec un MOTIF quand rien ne peut être posé — l'appelant
 * peut alors dire pourquoi le bouton est éteint, plutôt que de le laisser inerte
 * sans explication.
 */
export function decideMarqueur(ctx: ContexteMarqueur): DecisionMarqueur {
  if (ctx === null || typeof ctx !== 'object') return { posable: false, motif: 'pas-de-trame' };

  const at = ctx.derniereTrameAtMs;
  if (typeof at !== 'number' || !Number.isFinite(at)) {
    return { posable: false, motif: 'pas-de-trame' };
  }

  // FRAÎCHEUR — mesurée entre DEUX instants de la MÊME horloge, celle du coach :
  // la réception de la trame, et maintenant. Jamais `at`, qui vient du pilote.
  const recu = ctx.receptionMs;
  if (typeof recu !== 'number' || !Number.isFinite(recu)) {
    // Sans instant de réception, on ne sait pas juger l'âge. Fail-closed.
    return { posable: false, motif: 'pas-de-trame' };
  }
  if (
    typeof ctx.maintenantMs === 'number' &&
    Number.isFinite(ctx.maintenantMs) &&
    ctx.maintenantMs - recu > TRAME_FRAICHE_MAX_MS
  ) {
    return { posable: false, motif: 'trame-perimee' };
  }

  if (typeof ctx.debutCaptureIso !== 'string' || ctx.debutCaptureIso.length === 0) {
    return { posable: false, motif: 'debut-inconnu' };
  }
  const debut = Date.parse(ctx.debutCaptureIso);
  if (!Number.isFinite(debut)) return { posable: false, motif: 'debut-inconnu' };

  const elapsed = at - debut;
  // Un instant antérieur au début de la capture ne désigne rien : c'est le signe
  // que les deux valeurs ne viennent pas de la même horloge. Mieux vaut refuser
  // que d'écrire un marqueur négatif que personne ne saura relire.
  if (elapsed < 0) return { posable: false, motif: 'avant-le-debut' };

  return { posable: true, elapsedMs: Math.round(elapsed) };
}

/** Ce que l'écran dit quand le geste n'est pas posable. Jamais un reproche. */
export function motifLisible(motif: RefusMarqueur): string {
  switch (motif) {
    case 'pas-de-trame':
      return 'Aucune trame reçue pour l’instant.';
    case 'trame-perimee':
      return 'Le flux s’est interrompu — rien à marquer.';
    case 'debut-inconnu':
      return 'Le début de la capture n’est pas connu.';
    case 'avant-le-debut':
      return 'Les horloges ne concordent pas.';
  }
}
