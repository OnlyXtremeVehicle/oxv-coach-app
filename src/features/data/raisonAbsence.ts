/**
 * POURQUOI CE CHIFFRE EST ABSENT — pour les quatre nombres du résumé.
 *
 * ===========================================================================
 * CE QUI EXISTAIT DÉJÀ, ET OÙ IL S'ARRÊTAIT
 * ===========================================================================
 *
 * Le mécanisme est LIVRÉ : `src/components/insights/disponibilite.ts` rend six
 * raisons nommées, et l'écran de séance les affiche vraiment à la place d'un
 * tiret — pour les LECTURES.
 *
 * Les quatre nombres du résumé, eux — le chrono, les tours, la distance, la
 * vitesse maxi — imprimaient « — » sans un mot. Ce sont pourtant les premiers
 * que le pilote regarde en rouvrant sa séance, et les seuls qu'il verra si la
 * capture a mal tourné.
 *
 * Le kit partagé grave même la règle inverse : `StatCell`, `PillarBar` et
 * `Dial` disent tous « non mesuré ». C'est un CONSTAT, pas une raison. Le
 * pilote sait déjà qu'il n'y a rien ; ce qu'il ignore, c'est pourquoi.
 *
 * ===========================================================================
 * AUCUNE RAISON N'EST DEVINÉE
 * ===========================================================================
 *
 * Chaque phrase est adossée à un champ réel de la séance — `total_frames`,
 * `lap_count`, le nombre de lignes `laps`, `status`. Quand aucune règle ne
 * s'applique, la fonction rend `null` et l'écran se contente du tiret :
 * inventer une explication serait pire que le silence.
 *
 * C'est la même exigence que pour les valeurs elles-mêmes — **on ne fabrique
 * pas une raison qu'on n'a pas mesurée.**
 */

export interface SeanceMinimale {
  /** Nombre de trames reçues du boîtier. */
  total_frames: number;
  /** Compteur de tours porté par la séance. */
  lap_count: number;
  status: 'recording' | 'completed' | 'aborted' | 'processing';
}

export interface RaisonsResume {
  chrono: string | null;
  tours: string | null;
  distance: string | null;
  vmax: string | null;
}

/**
 * La cause RACINE, quand elle explique tout le reste.
 *
 * Sans trame, aucun des quatre nombres ne peut exister : inutile de répéter
 * quatre fois la même phrase, mais chaque cellule doit pouvoir la dire si on
 * l'interroge (lecteur d'écran, cellule isolée).
 */
function causeRacine(s: SeanceMinimale, nbTours: number): string | null {
  if (s.status === 'recording') return 'La séance est encore en cours.';
  if (s.total_frames === 0) return 'Le boîtier n’a envoyé aucune trame pour cette séance.';
  if (s.status === 'aborted') return 'La séance a été interrompue.';
  if (nbTours === 0 && s.lap_count === 0) {
    return 'Aucun passage sur la ligne d’arrivée n’a été enregistré.';
  }
  return null;
}

/**
 * Les raisons des quatre nombres du résumé.
 *
 * `nbTours` est le nombre de lignes `laps` réellement lues — distinct de
 * `lap_count`, qui est un compteur porté par la séance et peut le devancer
 * quand la file de synchro n'a pas encore vidé.
 */
export function raisonsResume(
  s: SeanceMinimale,
  nbTours: number,
  presents: { chrono: boolean; tours: boolean; distance: boolean; vmax: boolean }
): RaisonsResume {
  const racine = causeRacine(s, nbTours);

  return {
    // Un chrono demande un tour CLOS. Une séance peut porter des trames et
    // aucun tour — c'est le cas ordinaire d'une sortie sans franchissement.
    chrono: presents.chrono
      ? null
      : (racine ??
        'Aucun tour complet n’a été chronométré : le chrono demande un passage à l’arrivée.'),
    tours: presents.tours ? null : racine,
    distance: presents.distance
      ? null
      : (racine ?? 'La distance se calcule sur les trames de position, qui manquent ici.'),
    vmax: presents.vmax
      ? null
      : (racine ?? 'La vitesse maximale se lit sur les trames, qui manquent ici.'),
  };
}
