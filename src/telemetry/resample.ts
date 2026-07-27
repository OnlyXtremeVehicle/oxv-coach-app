/**
 * Ré-échantillonnage sur grille de distance commune.
 *
 * Socle de calcul T1bis. C'est **la règle la plus structurante du dossier** :
 * *toute comparaison se fait en base distance, jamais en base temps.*
 *
 * ---
 *
 * POURQUOI LA BASE TEMPS EST FAUSSE POUR COMPARER
 *
 * Deux tours du même circuit ne durent pas la même chose. Comparer leur
 * dixième seconde revient à comparer deux endroits DIFFÉRENTS de la piste : à
 * t = 10 s, le tour rapide est déjà au virage 3 quand le tour lent aborde le 2.
 * Le graphique montrerait alors un écart de vitesse qui n'est qu'un décalage de
 * position, et le pilote lirait une différence de pilotage là où il n'y a qu'une
 * différence de chrono.
 *
 * En base distance, l'abscisse est la même portion de piste pour tous les tours.
 * Ce qui reste après ré-échantillonnage est un écart réel.
 *
 * ---
 *
 * CE MODULE N'INVENTE RIEN ENTRE DEUX POINTS
 *
 * L'interpolation est linéaire, et bornée : au-delà de la distance couverte par
 * la trace, on ne prolonge pas — on rend `null`. Extrapoler produirait des
 * valeurs plausibles et fausses, exactement ce que la doctrine interdit.
 */

/** Une trace échantillonnée le long d'une distance croissante. */
export interface DistanceSeries {
  /** Abscisse curviligne en mètres, croissante. */
  distance: readonly number[];
  /** Valeur associée. `null` = absence, propagée telle quelle. */
  values: readonly (number | null)[];
}

/**
 * Construit une grille régulière de `pas` mètres couvrant `[0, longueur]`.
 *
 * Rend une liste vide si les paramètres n'ont pas de sens — une grille inventée
 * ferait croire à une couverture qui n'existe pas.
 */
export function buildGrid(longueur: number, pas: number): number[] {
  if (!Number.isFinite(longueur) || !Number.isFinite(pas)) return [];
  if (longueur <= 0 || pas <= 0) return [];
  const n = Math.floor(longueur / pas);
  const out: number[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) out[i] = i * pas;
  return out;
}

/**
 * Ré-échantillonne une série sur une grille de distance donnée.
 *
 * Hors de l'emprise de la trace → `null`. Une borne dont la valeur d'origine est
 * `null` propage `null` : on n'interpole pas à travers un trou, ce qui
 * comblerait une absence par une moyenne inventée.
 */
export function resampleOnGrid(
  serie: DistanceSeries,
  grille: readonly number[]
): (number | null)[] {
  const { distance, values } = serie;
  const n = distance.length;
  if (n === 0 || values.length !== n) return grille.map(() => null);

  const out: (number | null)[] = new Array(grille.length).fill(null);
  let j = 0;

  for (let k = 0; k < grille.length; k++) {
    const d = grille[k];
    if (d < distance[0] || d > distance[n - 1]) continue;

    // La grille étant croissante, le curseur ne recule jamais : O(n + m).
    while (j < n - 2 && distance[j + 1] < d) j++;

    const d0 = distance[j];
    const d1 = distance[j + 1];
    const v0 = values[j];
    const v1 = values[j + 1];
    if (v0 === null || v1 === null) continue;

    const span = d1 - d0;
    // Deux points à la même abscisse : on prend le premier plutôt que diviser
    // par zéro. Cela arrive à l'arrêt, où la distance n'avance plus.
    if (span <= 0) {
      out[k] = v0;
      continue;
    }
    const f = (d - d0) / span;
    out[k] = v0 + (v1 - v0) * f;
  }

  return out;
}

/**
 * Aligne deux traces sur une grille commune, bornée à leur emprise PARTAGÉE.
 *
 * La longueur retenue est la plus courte des deux : au-delà, l'une des traces
 * n'a rien à dire, et une comparaison contre du vide n'est pas une comparaison.
 */
export function alignPair(
  a: DistanceSeries,
  b: DistanceSeries,
  pas: number
): { grille: number[]; a: (number | null)[]; b: (number | null)[] } {
  const finA = a.distance.length > 0 ? a.distance[a.distance.length - 1] : 0;
  const finB = b.distance.length > 0 ? b.distance[b.distance.length - 1] : 0;
  const grille = buildGrid(Math.min(finA, finB), pas);
  return {
    grille,
    a: resampleOnGrid(a, grille),
    b: resampleOnGrid(b, grille),
  };
}
