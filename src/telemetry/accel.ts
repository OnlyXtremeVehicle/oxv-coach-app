/**
 * Accélération et sortie de virage — module T1bis.
 *
 * ---
 *
 * L'INDICATEUR CENTRAL EST UN FAIT MESURÉ
 *
 * Le dossier est net : la **vitesse minimale en virage** est *« l'indicateur le
 * plus discriminant du niveau »*, et elle est TRÈS ROBUSTE parce qu'elle sort du
 * canal vitesse — le plus fiable du boîtier. Aucune dérivation, aucun modèle.
 *
 * Tout le reste de ce module est dérivé, et donc plus fragile. La distinction
 * est portée dans le type : `VitesseMini` est une mesure, `throttleOnIndex` une
 * estimation.
 *
 * ---
 *
 * LE POINT DE REMISE DES GAZ EST UNE ESTIMATION, PAS UNE MESURE
 *
 * Il n'existe aucun canal papillon sur le boîtier. On observe que
 * l'accélération longitudinale redevient positive — ce qui arrive aussi en
 * descente, ou simplement quand le pilote lève le pied du frein sans accélérer.
 *
 * Le module le nomme `estimated` et ne le présente jamais autrement.
 */

export interface CornerExit {
  /** Indice de vitesse minimale — MESURE. `null` si rien d'exploitable. */
  apexIndex: number | null;
  /** Vitesse minimale, en m/s — MESURE. */
  minSpeed: number | null;
  /**
   * Indice estimé de remise des gaz — DÉRIVATION. `null` si l'accélération ne
   * redevient jamais franchement positive après l'apex.
   */
  throttleOnIndexEstimated: number | null;
  /** Vitesse de sortie du segment, en m/s — MESURE. */
  exitSpeed: number | null;
  /**
   * Accélération moyenne de relance entre l'apex et la sortie, en g —
   * DÉRIVATION. `null` si la fenêtre ne porte rien d'exploitable.
   */
  meanAccelG: number | null;
}

export interface CornerExitOptions {
  /**
   * Seuil de remise des gaz, en g. Défaut 0,1.
   *
   * Symétrique du seuil de freinage dans son intention : au-dessus du simple
   * roulement, en dessous d'une accélération franche. Un seuil à zéro
   * attraperait la moindre oscillation du signal.
   */
  seuilRelanceG?: number;
}

/**
 * Défaut du seuil de remise des gaz, en g.
 *
 * IL EST EXPORTÉ, ET CE N'EST PAS COSMÉTIQUE. `docs/T1BIS_CALCUL.md:136`
 * annonce que « les seuils sont tous paramétrables précisément pour cela » —
 * pour la calibration au premier jeu de données réel. Jusqu'au 04/08/2026,
 * celui-ci était une constante privée sans objet d'options : le document
 * affirmait une capacité que le code n'avait pas. Le seul des trois modules à
 * seuils qui ne suivait pas le patron de `braking.ts` et de `segment.ts`.
 */
export const SEUIL_RELANCE_DEFAUT_G = 0.1;

/**
 * Analyse la sortie d'un segment de virage.
 *
 * `from`/`to` sont les bornes du segment, telles que `segmentLap` les rend.
 */
export function analyzeCornerExit(
  speed: readonly number[],
  aLong: readonly (number | null)[],
  from: number,
  to: number,
  options: CornerExitOptions = {}
): CornerExit {
  const seuilRelance = options.seuilRelanceG ?? SEUIL_RELANCE_DEFAUT_G;
  const lo = Math.max(0, from);
  const hi = Math.min(to, speed.length - 1);

  if (hi < lo) {
    return {
      apexIndex: null,
      minSpeed: null,
      throttleOnIndexEstimated: null,
      exitSpeed: null,
      meanAccelG: null,
    };
  }

  // 1) L'apex — vitesse minimale. Mesure.
  let apexIndex: number | null = null;
  let minSpeed: number | null = null;
  for (let i = lo; i <= hi; i++) {
    const v = speed[i];
    if (!Number.isFinite(v)) continue;
    if (minSpeed === null || v < minSpeed) {
      minSpeed = v;
      apexIndex = i;
    }
  }

  // 2) La remise des gaz — estimation, cherchée APRÈS l'apex seulement. Avant,
  // une accélération positive n'est pas une relance de virage.
  let throttleOn: number | null = null;
  if (apexIndex !== null) {
    for (let i = apexIndex; i <= hi; i++) {
      const a = aLong[i];
      if (a === null || !Number.isFinite(a)) continue;
      if (a >= seuilRelance) {
        throttleOn = i;
        break;
      }
    }
  }

  // 3) Relance moyenne, de l'apex à la sortie.
  let somme = 0;
  let compte = 0;
  if (apexIndex !== null) {
    for (let i = apexIndex; i <= hi; i++) {
      const a = aLong[i];
      if (a === null || !Number.isFinite(a)) continue;
      somme += a;
      compte++;
    }
  }

  return {
    apexIndex,
    minSpeed,
    throttleOnIndexEstimated: throttleOn,
    exitSpeed: Number.isFinite(speed[hi]) ? speed[hi] : null,
    meanAccelG: compte > 0 ? somme / compte : null,
  };
}

/**
 * Régularité d'une série — écart-type, coefficient de variation, médiane, MAD.
 *
 * Le dossier recommande **médiane et MAD** quand l'échantillon est petit ou
 * porte des tours aberrants dus au trafic : un seul tour bloqué derrière une
 * voiture lente décale la moyenne et gonfle l'écart-type, alors qu'il laisse la
 * médiane presque intacte.
 *
 * Les quatre sont rendus ; l'appelant choisit selon son échantillon. Rend `null`
 * sous deux valeurs — une dispersion d'un point n'existe pas.
 */
export function consistency(
  valeurs: readonly number[]
): { mean: number; stdDev: number; cv: number | null; median: number; mad: number } | null {
  const xs = valeurs.filter((x) => Number.isFinite(x));
  if (xs.length < 2) return null;

  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const stdDev = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);

  const tri = [...xs].sort((a, b) => a - b);
  const median = mediane(tri);
  const mad = mediane(tri.map((x) => Math.abs(x - median)).sort((a, b) => a - b));

  return {
    mean,
    stdDev,
    // Le coefficient de variation n'a pas de sens autour d'une moyenne nulle :
    // on rend `null` plutôt qu'une division qui explose.
    cv: Math.abs(mean) > 1e-9 ? stdDev / Math.abs(mean) : null,
    median,
    mad,
  };
}

function mediane(trie: readonly number[]): number {
  const m = trie.length >> 1;
  return trie.length % 2 === 0 ? (trie[m - 1] + trie[m]) / 2 : trie[m];
}
