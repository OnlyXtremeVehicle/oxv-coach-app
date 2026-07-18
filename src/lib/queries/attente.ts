/**
 * Garde-fou réseau du lot PROFIL_CARTES : délai maximal de 10 s sur les
 * requêtes des écrans Profil et Panel de cartes (spec §7.2 — jamais de
 * spinner infini ; l'écran affiche alors le bandeau « Réessayer »).
 */

export const DELAI_REQUETE_MS = 10_000;

/** Erreur levée quand une requête dépasse le délai garde-fou. */
export class DelaiDepasseError extends Error {
  constructor() {
    super('DELAI_DEPASSE');
    this.name = 'DelaiDepasseError';
  }
}

/**
 * Enveloppe une promesse d'un délai maximal. Au-delà, rejette avec
 * DelaiDepasseError — la promesse d'origine n'est pas annulée (fetch RN ne
 * s'annule pas proprement), son résultat tardif est simplement ignoré.
 */
export function avecDelaiGarde<T>(
  travail: PromiseLike<T>,
  delaiMs: number = DELAI_REQUETE_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const minuteur = setTimeout(() => reject(new DelaiDepasseError()), delaiMs);
    Promise.resolve(travail).then(
      (valeur) => {
        clearTimeout(minuteur);
        resolve(valeur);
      },
      (erreur: unknown) => {
        clearTimeout(minuteur);
        reject(erreur instanceof Error ? erreur : new Error(String(erreur)));
      }
    );
  });
}
