/**
 * Rampe de couleur perceptuelle, interpolée en Oklab.
 *
 * Socle de rendu T1, module 3. Sert à colorer une trace par une grandeur
 * continue — vitesse, marge, régularité.
 *
 * ---
 *
 * POURQUOI OKLAB, ET PAS UNE INTERPOLATION EN sRGB
 *
 * Interpoler deux couleurs composante par composante en sRGB est le réflexe, et
 * c'est faux. sRGB n'est pas perceptuellement uniforme : le milieu arithmétique
 * de deux teintes n'est pas la teinte que l'œil voit à mi-chemin. Deux défauts
 * en découlent, tous deux visibles sur une trace :
 *
 *   — des BANDES SOMBRES au passage entre deux teintes vives, parce que le
 *     chemin droit en sRGB traverse une zone de luminance plus basse ;
 *   — une PROGRESSION IRRÉGULIÈRE : la couleur semble stagner sur une plage de
 *     valeurs puis basculer d'un coup sur une autre.
 *
 * Sur un ruban qui code la marge, une bande sombre parasite se lit comme une
 * information. Elle n'en est pas une. Oklab est construit pour que la distance
 * euclidienne y approche la différence perçue : l'interpolation y est régulière,
 * et la trace ne raconte que ce que la donnée dit.
 *
 * ---
 *
 * CE MODULE NE CHOISIT AUCUNE COULEUR
 *
 * Il reçoit ses arrêts. Le canon couleur — l'or réservé au chrono, le rouge de
 * marque proscrit sur une donnée de performance — vit dans le thème, et c'est
 * l'appelant qui y puise. Un module de rendu qui déciderait des teintes rendrait
 * le canon incontrôlable.
 */

export interface Rgb {
  /** Composantes sRGB dans `[0, 1]`. */
  r: number;
  g: number;
  b: number;
}

export interface RampStop {
  /** Position dans la rampe, dans `[0, 1]`. */
  at: number;
  color: Rgb;
}

// ============================================================================
// Conversions — sRGB ↔ Oklab
// Coefficients de Björn Ottosson (2020).
// ============================================================================

interface Oklab {
  L: number;
  a: number;
  b: number;
}

/** sRGB encodé → linéaire. La courbe de transfert n'est pas une simple gamma. */
function versLineaire(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linéaire → sRGB encodé. */
function versEncode(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

const borne = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export function rgbVersOklab(c: Rgb): Oklab {
  const r = versLineaire(c.r);
  const g = versLineaire(c.g);
  const b = versLineaire(c.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabVersRgb(c: Oklab): Rgb {
  const l_ = c.L + 0.3963377774 * c.a + 0.2158037573 * c.b;
  const m_ = c.L - 0.1055613458 * c.a - 0.0638541728 * c.b;
  const s_ = c.L - 0.0894841775 * c.a - 1.291485548 * c.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: borne(versEncode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: borne(versEncode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: borne(versEncode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  };
}

// ============================================================================
// Rampe
// ============================================================================

export interface Ramp {
  /** Échantillonne la rampe. `t` hors de `[0, 1]` est ramené aux bornes. */
  at(t: number): Rgb;
  /** Les arrêts retenus, triés — utile pour dessiner une légende fidèle. */
  readonly stops: readonly RampStop[];
}

/**
 * Construit une rampe à partir d'au moins deux arrêts.
 *
 * Les arrêts sont triés par position. Rend `null` s'il en manque : une rampe
 * d'un seul arrêt n'est pas une rampe, et en fabriquer une masquerait une
 * erreur d'appel derrière une couleur plausible.
 */
export function buildRamp(stops: readonly RampStop[]): Ramp | null {
  if (stops.length < 2) return null;

  const tries = [...stops].sort((x, y) => x.at - y.at);
  // Pré-conversion : chaque échantillon coûte alors deux cubes et une matrice,
  // pas une conversion complète des deux bornes.
  const enOklab = tries.map((s) => rgbVersOklab(s.color));

  const at = (t: number): Rgb => {
    if (!Number.isFinite(t)) return tries[0].color;
    if (t <= tries[0].at) return tries[0].color;
    const dernier = tries.length - 1;
    if (t >= tries[dernier].at) return tries[dernier].color;

    let i = 0;
    while (i < dernier && tries[i + 1].at < t) i++;

    const a = tries[i];
    const b = tries[i + 1];

    // Sur la position exacte d'un arrêt, on rend SA couleur, sans passer par la
    // conversion. L'aller-retour sRGB → Oklab → sRGB introduit une dérive de
    // l'ordre du millionième : invisible sur un dégradé, mais elle ferait qu'une
    // légende dessinée depuis `stops` ne correspondrait jamais tout à fait au
    // tracé dessiné depuis `at()`.
    if (t === a.at) return a.color;
    if (t === b.at) return b.color;

    const span = b.at - a.at;
    // Deux arrêts à la même position : la rampe y saute franchement plutôt que
    // de diviser par zéro.
    const f = span === 0 ? 0 : (t - a.at) / span;

    const ca = enOklab[i];
    const cb = enOklab[i + 1];
    return oklabVersRgb({
      L: ca.L + (cb.L - ca.L) * f,
      a: ca.a + (cb.a - ca.a) * f,
      b: ca.b + (cb.b - ca.b) * f,
    });
  };

  return { at, stops: tries };
}

// ============================================================================
// Utilitaires de format
// ============================================================================

/** `#rrggbb` → `Rgb`. Rend `null` si la chaîne n'est pas un hexadécimal valide. */
export function hexVersRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

/** `Rgb` → `#rrggbb`. */
export function rgbVersHex(c: Rgb): string {
  const o = (x: number) =>
    Math.round(borne(x) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${o(c.r)}${o(c.g)}${o(c.b)}`;
}
