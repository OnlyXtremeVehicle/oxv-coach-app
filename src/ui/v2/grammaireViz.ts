/**
 * grammaireViz — la grammaire commune de restitution (banc d'essai du 14/08/2026).
 *
 * Quarante objets visuels, zéro système : quatre implémentations de radar,
 * quatre polyline→path, trois rampes de vitesse sans convention. Ce module
 * pose les QUATRE RÔLES qu'une couleur peut jouer sur une donnée, et rien
 * d'autre. Les composants ne choisissent plus une couleur : ils déclarent un
 * rôle, et le rôle choisit.
 *
 * ===========================================================================
 * LES QUATRE RÔLES — et aucune couleur ne cumule deux rôles
 * ===========================================================================
 *
 *   MAGNITUDE  une grandeur continue (vitesse, intensité, densité).
 *              UNE teinte, du sombre au clair, clair = fort. Jamais un
 *              arc-en-ciel : la rampe à quatre teintes de l'ancien
 *              `speedHeat` s'inversait au milieu (luminosité 0,688 → 0,786
 *              → 0,751 → 0,858 — le 3ᵉ pas plus sombre que le 2ᵉ), donc une
 *              zone à 85 km/h paraissait plus foncée qu'une zone à 70.
 *              La garde `rampeMagnitude.guard.test.ts` CALCULE désormais la
 *              monotonie — une exception écrite à la main resterait juste
 *              par accident.
 *
 *   ORDRE      des éléments ordonnés dans le temps (tours, séances).
 *              La même teinte, en pas discrets. Trois teintes sans rapport
 *              diraient que les tours sont interchangeables ; une rampe dit
 *              que le temps passe.
 *
 *   POLARITÉ   un écart signé (delta, gagné/perdu). Deux pôles chaud/froid
 *              autour d'un NEUTRE GRIS — jamais une teinte au point zéro,
 *              le zéro doit se lire « rien ».
 *
 *   ÉTAT       green/yellow/red de la marge. Déjà porté par
 *              `marginZoneColorLogic` — on ne le redéfinit pas ici, on s'y
 *              adosse. Un état n'est JAMAIS recyclé en série, une série
 *              n'est jamais recyclée en état.
 *
 * Le rouge de marque `#C8102E` n'a AUCUN rôle ici. Invariant déjà tenu et
 * testé par `marginZoneColorLogic` — reproduit, pas réinventé.
 *
 * ===========================================================================
 * L'ABSENCE N'EST PAS UN ZÉRO
 * ===========================================================================
 *
 * Règle données réelles (fondateur) : un zéro MESURÉ et une grandeur NON
 * MESURÉE ne se dessinent jamais pareil. `Number.isFinite(0)` vaut `true` —
 * c'est exactement le trou par lequel « Freinage sur 0 m » est passé dans
 * AnatomieViz. Le type `Mesure<T>` rend la confusion impossible à écrire :
 * un composant qui reçoit `absent()` ne PEUT PAS le tracer comme une valeur.
 *
 * Zéro dépendance React Native : testé en node (grammaireViz.test.ts).
 */

// ---------------------------------------------------------------------------
// Mesuré / non mesuré — la distinction que le radar ne sait pas dessiner
// ---------------------------------------------------------------------------

/** Une grandeur restituable : soit mesurée (y compris zéro), soit absente. */
export type Mesure<T> =
  | { readonly mesuree: true; readonly valeur: T }
  | { readonly mesuree: false };

export function mesure<T>(valeur: T): Mesure<T> {
  return { mesuree: true, valeur };
}

export const ABSENT: Mesure<never> = { mesuree: false };

/**
 * Convertit le `number | null` des services en `Mesure<number>`.
 * `0` devient une mesure — c'est le point : un zéro mesuré est une donnée.
 */
export function depuisNullable(v: number | null | undefined): Mesure<number> {
  return v === null || v === undefined || !Number.isFinite(v) ? ABSENT : mesure(v);
}

/** Libellé unique de l'état absent — un seul texte, partout le même. */
export const LIBELLE_ABSENT = 'non mesuré sur cette séance';

// ---------------------------------------------------------------------------
// MAGNITUDE — une teinte, clair = fort
// ---------------------------------------------------------------------------

/**
 * Rampe de magnitude par défaut (bleu instrument, 4 pas, sombre → clair).
 * Validée le 14/08/2026 : luminosité strictement croissante, écart de teinte
 * 9°, pas sombre à 2,18:1 sur bg.card (#1B1D24). Même longueur que l'ancien
 * `speedHeat` pour que TrackStage / TrajectoryLayer / cardioZoneLogic
 * indexent [0..3] sans changer.
 */
export const RAMPE_MAGNITUDE = ['#1E5178', '#2C7CAE', '#4AA3D8', '#7FC4EE'] as const;

/**
 * Couleur d'un ratio [0..1] sur une rampe sombre → clair.
 * Hors bornes : serré aux bornes (un ratio n'invente pas de pas).
 */
export function couleurMagnitude(
  ratio: number,
  rampe: readonly string[] = RAMPE_MAGNITUDE
): string {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return rampe[Math.min(rampe.length - 1, Math.floor(r * rampe.length))];
}

// ---------------------------------------------------------------------------
// ORDRE — les tours ne sont pas des catégories
// ---------------------------------------------------------------------------

/** Rampe des tours (premier → dernier). Validée en ordinal le 14/08/2026. */
export const RAMPE_ORDRE = ['#184F95', '#2A78D6', '#86B6EF'] as const;

/**
 * Couleur du i-ème élément (0-indexé) parmi n. Au-delà de la rampe, le
 * dernier pas se répète — on ne GÉNÈRE jamais une teinte : au-delà de
 * `RAMPE_ORDRE.length` éléments, le bon geste est l'emphase (un élément en
 * avant, le reste en retrait), pas une teinte de plus.
 */
export function couleurOrdre(i: number, rampe: readonly string[] = RAMPE_ORDRE): string {
  return rampe[Math.max(0, Math.min(rampe.length - 1, i))];
}

// ---------------------------------------------------------------------------
// POLARITÉ — un écart signé autour d'un neutre
// ---------------------------------------------------------------------------

/**
 * Pôles du delta : perd (chaud) / reprend (froid), neutre gris au zéro.
 * ΔE 31,8 en vision normale, 26,8 sous protanopie (validé 14/08/2026).
 */
export const POLES_DELTA = {
  perd: '#D95926',
  neutre: '#2A2E32',
  reprend: '#3987E5',
} as const;

/** Couleur d'un écart signé. `bandeMorte` : sous ce seuil absolu, neutre. */
export function couleurDelta(ecart: number, bandeMorte = 0): string {
  if (!Number.isFinite(ecart) || Math.abs(ecart) <= bandeMorte) return POLES_DELTA.neutre;
  return ecart > 0 ? POLES_DELTA.perd : POLES_DELTA.reprend;
}
