/**
 * Petits multiples — un profil de tours par séance, TOUS À LA MÊME ÉCHELLE.
 *
 * ===========================================================================
 * CE QUI DÉFINIT UN PETIT MULTIPLE, ET CE QUI LE DÉTRUIT
 * ===========================================================================
 *
 * Un petit multiple n'est pas « plusieurs petits graphiques ». C'est **une
 * seule échelle, répétée**. Si chaque panneau se met à son propre min/max, deux
 * séances de rythmes très différents dessinent exactement la même courbe, et la
 * grille devient un mensonge : elle donne à comparer ce qui n'est plus
 * comparable.
 *
 * C'est le piège que portaient les primitives existantes.
 * `normalizeSparkline` (`src/ui/v2/vizMath.ts`) calcule son min et son max
 * **série par série** — parfait pour la bande biométrique, qui n'affiche qu'une
 * série à la fois, et faux ici. On ne la réutilise donc pas ; on réutilise
 * `pointsToSvgPath`, qui, lui, ne décide d'aucune échelle.
 *
 * Le domaine est calculé UNE FOIS sur tous les tours de toutes les séances, et
 * passé à chaque panneau.
 *
 * ===========================================================================
 * LE SENS DE L'AXE
 * ===========================================================================
 *
 * `y` croît avec le temps au tour : le tour le plus rapide de la saison est en
 * HAUT du cadre, le plus lent en bas. Une ligne qui descend est donc une série
 * de tours qui s'alourdissent — description, pas verdict.
 *
 * ===========================================================================
 * ON NE COUPE AUCUN TOUR, ET C'EST UN CHOIX
 * ===========================================================================
 *
 * Un tour de sortie de stand peut valoir trois fois un tour lancé, et il écrase
 * l'échelle : tous les panneaux s'aplatissent en haut du cadre. L'usage courant
 * est de rogner les extrêmes. On ne le fait pas — rogner en silence retire au
 * pilote des tours qu'il a réellement roulés, et il ne peut pas savoir lesquels.
 *
 * On rend donc le domaine à l'appelant (`domaineCommun`) pour qu'il l'AFFICHE.
 * Une grille aplatie sous une échelle annoncée reste lisible : on voit pourquoi.
 * Une grille aplatie sans échelle est un défaut.
 */

import { pointsToSvgPath, type XY } from '@/ui/v2/vizMath';

export interface SerieSeance {
  sessionId: string;
  /** Libellé court du panneau — date, ou circuit. */
  libelle: string;
  /** Temps au tour en millisecondes, dans l'ordre où ils ont été roulés. */
  toursMs: readonly number[];
}

export interface DomaineCommun {
  minMs: number;
  maxMs: number;
}

export interface PanneauMultiple {
  sessionId: string;
  libelle: string;
  /** Chemin SVG ouvert. `''` quand la séance n'a pas de quoi tracer une ligne. */
  chemin: string;
  /** Tours exploitables retenus — 0 ou 1 explique un chemin vide. */
  tours: number;
  /** Meilleur tour de LA SÉANCE, en ms. `null` si aucun tour exploitable. */
  meilleurMs: number | null;
}

/**
 * Les tours qu'on peut porter sur un axe : finis et strictement positifs.
 *
 * Un `0` n'est pas un tour rapide, c'est une mesure absente — et PostgREST rend
 * les `numeric` en CHAÎNES, d'où la coercition explicite plutôt qu'un
 * `Number.isFinite` sur une valeur supposée déjà numérique.
 */
export function toursExploitables(toursMs: readonly unknown[]): number[] {
  const out: number[] = [];
  for (const v of toursMs) {
    const n = typeof v === 'string' ? Number(v) : v;
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/**
 * Le domaine partagé par tous les panneaux.
 *
 * `null` quand aucune séance n'a le moindre tour exploitable : il n'y a alors
 * pas d'échelle à annoncer, et l'appelant doit rendre un état vide plutôt
 * qu'une grille de cadres muets.
 */
export function domaineCommun(series: readonly SerieSeance[]): DomaineCommun | null {
  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const s of series) {
    for (const t of toursExploitables(s.toursMs)) {
      if (t < minMs) minMs = t;
      if (t > maxMs) maxMs = t;
    }
  }
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return null;
  return { minMs, maxMs };
}

/**
 * Projette une séance dans un cadre, SUR LE DOMAINE REÇU.
 *
 * Cette fonction ne regarde jamais les extrêmes de la série qu'elle trace :
 * c'est toute la différence avec une sparkline. Un panneau dont les tours
 * occupent le tiers haut du cadre dit quelque chose de vrai — cette séance
 * était dans le tiers rapide de la saison.
 *
 * Domaine plat (`maxMs === minMs`, une seule valeur roulée partout) : la ligne
 * se pose à mi-hauteur. Elle ne peut ni monter ni descendre, et la coller en
 * haut suggérerait une performance que la donnée ne porte pas.
 */
export function panneauDeSerie(
  serie: SerieSeance,
  domaine: DomaineCommun,
  largeur: number,
  hauteur: number,
  pad = 2
): PanneauMultiple {
  const tours = toursExploitables(serie.toursMs);
  const base = {
    sessionId: serie.sessionId,
    libelle: serie.libelle,
    tours: tours.length,
    meilleurMs: tours.length > 0 ? Math.min(...tours) : null,
  };

  if (tours.length < 2 || largeur <= 0 || hauteur <= 0) {
    return { ...base, chemin: '' };
  }

  const spanX = Math.max(0, largeur - 2 * pad);
  const spanY = Math.max(0, hauteur - 2 * pad);
  const etendue = domaine.maxMs - domaine.minMs;

  const points: XY[] = tours.map((t, i) => ({
    x: pad + (i / (tours.length - 1)) * spanX,
    y: etendue === 0 ? hauteur / 2 : pad + ((t - domaine.minMs) / etendue) * spanY,
  }));

  return { ...base, chemin: pointsToSvgPath(points, false) };
}

/**
 * Combien de panneaux tiennent avant que la grille cesse d'être lisible.
 *
 * Quatre lignes de trois. Au-delà, chaque tracé devient un trait de quelques
 * pixels et la comparaison ne se fait plus à l'œil — elle se fait au hasard.
 */
export const PANNEAUX_MAX = 12;

export interface SelectionSeances {
  /** Les séances retenues, dans l'ordre reçu. */
  retenues: SerieSeance[];
  /** Le total AVANT coupe — pour l'annoncer, jamais pour le taire. */
  total: number;
}

/**
 * Les `max` dernières séances de la liste.
 *
 * L'appelant passe ses séances **de la plus ancienne à la plus récente** : la
 * coupe garde donc la fin. Et elle rend `total` — une grille qui montre douze
 * séances sur vingt-sept doit le dire, sinon elle se lit comme une saison
 * entière de douze séances.
 */
export function dernieresSeances(
  series: readonly SerieSeance[],
  max = PANNEAUX_MAX
): SelectionSeances {
  const total = series.length;
  if (!Number.isFinite(max) || max <= 0) return { retenues: [], total };
  return { retenues: series.slice(Math.max(0, total - max)), total };
}

/** Tous les panneaux, dans l'ordre reçu, sur le domaine reçu. */
export function construirePanneaux(
  series: readonly SerieSeance[],
  domaine: DomaineCommun,
  largeur: number,
  hauteur: number,
  pad = 2
): PanneauMultiple[] {
  return series.map((s) => panneauDeSerie(s, domaine, largeur, hauteur, pad));
}
