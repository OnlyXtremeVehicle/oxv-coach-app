/**
 * Nuage g-g — accélération longitudinale contre accélération latérale.
 *
 * Socle de rendu T1, module 5. Chaque échantillon d'une séance devient un point
 * du plan : freinage et relance en ordonnée, appuis gauche et droite en abscisse.
 *
 * ---
 *
 * CE QUE CE MODULE DIT, ET CE QU'IL NE DIT PAS
 *
 * Il décrit **ce qui s'est passé**. Il ne décrit pas ce qui aurait été possible.
 *
 * La littérature appelle « cercle d'adhérence » ou « limite du pneu » l'enveloppe
 * qu'on devine autour d'un tel nuage. Ce vocabulaire est écarté ici, et pas par
 * pudeur de langage : affirmer une limite exigerait un modèle de pneu, une masse,
 * une charge aérodynamique et un état de piste que l'application n'a pas. Ce
 * qu'on peut mesurer, c'est l'ENVELOPPE ATTEINTE — le plus loin que le pilote est
 * allé, dans chaque direction, ce jour-là.
 *
 * La distinction n'est pas cosmétique. Une « limite » invite à s'en approcher.
 * Une enveloppe atteinte constate. La doctrine est explicite : l'application est
 * un miroir, et elle parle de MARGE, jamais de limite.
 *
 * ---
 *
 * CONVENTION D'AXES
 *
 * `long` : positif en accélération, négatif en freinage.
 * `lat`  : positif vers la droite du véhicule, négatif vers la gauche.
 *
 * Cette convention est celle du reste du dépôt et elle est VERROUILLÉE par test.
 * L'inverser retournerait le nuage sans qu'aucune erreur ne soit levée — un
 * freinage se lirait comme une relance.
 */

export interface GgSample {
  /** Accélération longitudinale, en g. Positif = accélère, négatif = freine. */
  long: number;
  /** Accélération latérale, en g. Positif = appui à droite. */
  lat: number;
}

export interface GgBin {
  /** Indices de case, depuis le coin bas-gauche du domaine. */
  ix: number;
  iy: number;
  /** Centre de la case, en g. */
  lat: number;
  long: number;
  /** Nombre d'échantillons tombés dans la case. */
  count: number;
}

export interface GgCloud {
  /** Cases NON VIDES seulement — une case vide n'a rien à dire. */
  bins: GgBin[];
  /** Nombre d'échantillons retenus (les non finis sont écartés). */
  total: number;
  /** Nombre d'échantillons écartés parce que non finis. */
  rejected: number;
  /** Occupation de la case la plus dense — sert à normaliser un rendu. */
  peak: number;
  /** Demi-étendue du domaine, en g. */
  range: number;
  /** Nombre de cases par côté. */
  resolution: number;
}

export interface GgOptions {
  /**
   * Demi-étendue du domaine, en g. Défaut 2 : couvre largement une voiture de
   * série sur piste sèche. Les échantillons au-delà sont RABATTUS sur la case de
   * bord — ils existent, on ne les efface pas.
   */
  range?: number;
  /** Nombre de cases par côté. Défaut 48. */
  resolution?: number;
}

const DEFAUT_RANGE = 2;
const DEFAUT_RESOLUTION = 48;

/**
 * Agrège des échantillons en une grille de densité.
 *
 * Rend `null` si aucun échantillon exploitable n'est fourni : **l'absence de
 * mesure n'est pas un nuage vide, c'est une absence**, et l'appelant doit
 * pouvoir la distinguer d'une séance où le pilote n'a rien sollicité.
 */
export function buildGgCloud(
  samples: readonly GgSample[],
  options: GgOptions = {}
): GgCloud | null {
  const range = options.range ?? DEFAUT_RANGE;
  const resolution = Math.max(1, Math.floor(options.resolution ?? DEFAUT_RESOLUTION));
  if (range <= 0) return null;

  const taille = (2 * range) / resolution;
  const compte = new Map<number, number>();
  let total = 0;
  let rejected = 0;

  for (const s of samples) {
    if (!Number.isFinite(s.long) || !Number.isFinite(s.lat)) {
      rejected++;
      continue;
    }
    // Rabattage sur le bord plutôt que rejet : un échantillon hors domaine reste
    // un fait mesuré. L'écarter maquillerait la séance.
    const ix = Math.min(resolution - 1, Math.max(0, Math.floor((s.lat + range) / taille)));
    const iy = Math.min(resolution - 1, Math.max(0, Math.floor((s.long + range) / taille)));
    const cle = iy * resolution + ix;
    compte.set(cle, (compte.get(cle) ?? 0) + 1);
    total++;
  }

  if (total === 0) return null;

  const bins: GgBin[] = [];
  let peak = 0;
  for (const [cle, count] of compte) {
    const ix = cle % resolution;
    const iy = Math.floor(cle / resolution);
    if (count > peak) peak = count;
    bins.push({
      ix,
      iy,
      lat: -range + (ix + 0.5) * taille,
      long: -range + (iy + 0.5) * taille,
      count,
    });
  }
  // Ordre stable : le rendu ne doit pas dépendre de l'ordre d'itération d'une Map.
  bins.sort((a, b) => a.iy - b.iy || a.ix - b.ix);

  return { bins, total, rejected, peak, range, resolution };
}

export interface EnvelopeSector {
  /** Cap du secteur, en degrés dans `[0, 360)`. 0 = plein freinage. */
  angle: number;
  /** Plus grande magnitude ATTEINTE dans ce secteur, en g. 0 si jamais sollicité. */
  reached: number;
  /** Nombre d'échantillons tombés dans ce secteur. */
  count: number;
}

/**
 * Enveloppe atteinte, secteur par secteur.
 *
 * Pour chaque secteur angulaire, la plus grande magnitude effectivement
 * enregistrée. Ce n'est PAS une limite d'adhérence — voir l'en-tête du module.
 *
 * Un secteur jamais sollicité rend `reached: 0` avec `count: 0` : les deux
 * ensemble permettent à l'appelant de distinguer « jamais allé par là » de
 * « allé par là tout doucement », ce qu'une magnitude seule confondrait.
 */
export function reachedEnvelope(
  samples: readonly GgSample[],
  sectors: number = 36
): EnvelopeSector[] | null {
  const n = Math.max(1, Math.floor(sectors));
  const atteint = new Array<number>(n).fill(0);
  const compte = new Array<number>(n).fill(0);
  let vus = 0;

  for (const s of samples) {
    if (!Number.isFinite(s.long) || !Number.isFinite(s.lat)) continue;
    const magnitude = Math.hypot(s.lat, s.long);
    vus++;
    if (magnitude === 0) continue; // à l'arrêt : aucune direction sollicitée
    // 0° = plein freinage (long négatif), puis sens horaire vers l'appui droit.
    const deg = (Math.atan2(s.lat, -s.long) * 180) / Math.PI;
    const cap = (deg + 360) % 360;
    const i = Math.min(n - 1, Math.floor((cap / 360) * n));
    compte[i]++;
    if (magnitude > atteint[i]) atteint[i] = magnitude;
  }

  if (vus === 0) return null;

  return Array.from({ length: n }, (_, i) => ({
    angle: (360 / n) * (i + 0.5),
    reached: atteint[i],
    count: compte[i],
  }));
}
