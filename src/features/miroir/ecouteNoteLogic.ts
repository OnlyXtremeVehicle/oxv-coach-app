/**
 * La lecture d'une note vocale de coach — la part qui se teste.
 *
 * Le composant tient le lecteur audio (un hook, donc React) ; ce module tient
 * ce qu'on AFFICHE de son état. La séparation n'est pas cosmétique : c'est
 * exactement ici que les valeurs fabriquées apparaissent — une barre de
 * progression pleine sur une durée inconnue, un « 0:00 » qui ressemble à une
 * mesure.
 *
 * Règle du fondateur appliquée telle quelle : *toute valeur affichée trace vers
 * une source réelle.* Un lecteur qui n'a pas encore chargé le fichier ne
 * connaît pas sa durée. Il ne l'invente pas.
 */

/** `m:ss`. Négatif et non-fini sont ramenés à zéro plutôt que rendus. */
export function formatSecondes(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return '0:00';
  const total = Math.floor(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export interface EtatLecteur {
  isLoaded: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
}

export interface VueLecture {
  /** Fraction jouée, ou `null` si la durée n'est pas connue. Jamais 0 par défaut. */
  progression: number | null;
  /** Position / durée, ou `null` tant que la durée est inconnue. */
  chrono: string | null;
  /** Le fichier est allé jusqu'au bout : la prochaine pression doit rembobiner. */
  termine: boolean;
  /** Intitulé du bouton, dit à la personne qui écoute. */
  libelle: string;
}

/**
 * Marge de fin, en secondes.
 *
 * Les lecteurs natifs s'arrêtent rarement pile sur la durée annoncée : un écart
 * de quelques dizaines de millisecondes est ordinaire. Sans cette marge, la
 * dernière pression relancerait la lecture pour un reliquat inaudible au lieu
 * de rembobiner.
 */
const MARGE_FIN_S = 0.25;

export function vueLecture(e: EtatLecteur): VueLecture {
  const dureeConnue = Number.isFinite(e.duration) && e.duration > 0;
  const position = Number.isFinite(e.currentTime) && e.currentTime > 0 ? e.currentTime : 0;

  const termine = dureeConnue && !e.playing && position >= e.duration - MARGE_FIN_S;

  return {
    progression: dureeConnue ? Math.min(1, Math.max(0, position / e.duration)) : null,
    chrono: dureeConnue ? `${formatSecondes(position)} / ${formatSecondes(e.duration)}` : null,
    termine,
    libelle: !e.isLoaded
      ? 'Chargement'
      : e.playing
        ? 'Pause'
        : termine
          ? 'Réécouter'
          : position > 0
            ? 'Reprendre'
            : 'Écouter',
  };
}
