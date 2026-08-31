/**
 * CALIBRATION INERTIELLE — étape 3 de la chaîne de calcul du cahier de veille.
 *
 * ===========================================================================
 * CE QUI MANQUAIT, ET CE QUE ÇA COÛTAIT
 * ===========================================================================
 *
 * Le §03 du cahier demande, avant tout calcul : « orientation conforme,
 * estimation du zéro, compensation de gravité, contrôle à l'arrêt ; conserver
 * brut ET corrigé ». Rien de tout cela n'existait. `sessionTelemetryMapping`
 * lisait les g bruts et se contentait d'inverser un signe.
 *
 * Un boîtier posé de travers mélange le latéral dans le longitudinal. Une
 * inclinaison de dix degrés verse 17 % du freinage dans la branche latérale —
 * et les branches Freinage, Accélération et Fluidité du QDI se calculent
 * précisément là-dessus. Ce n'est pas une correction cosmétique : c'est la
 * différence entre mesurer la voiture et mesurer la fixation.
 *
 * ===========================================================================
 * CE QUE LA GRAVITÉ PEUT DIRE, ET CE QU'ELLE NE PEUT PAS
 * ===========================================================================
 *
 * À l'arrêt, l'accéléromètre ne mesure qu'une chose : la gravité. Sa direction
 * dans le repère du boîtier donne donc DEUX des trois angles — le tangage et le
 * roulis. On sait redresser le boîtier à l'horizontale.
 *
 * Elle ne dit RIEN du troisième, le LACET : un boîtier tourné de 90° autour de
 * la verticale voit exactement la même gravité. Or c'est celui qui échange
 * l'avant et le côté. Il se déduit du mouvement, pas du repos — voir
 * `estimerLacet`.
 *
 * Ce module ne devine jamais l'angle qu'il n'a pas mesuré. Une calibration
 * partielle se dit partielle : `lacet` vaut `null` et `motifs` explique
 * pourquoi. Un redressement inventé serait pire que pas de redressement, parce
 * qu'il aurait l'air d'une correction.
 *
 * ===========================================================================
 * LE BRUT SURVIT
 * ===========================================================================
 *
 * `appliquerCalibration` ne modifie aucune mesure : elle rend un nouvel objet
 * qui porte les valeurs corrigées À CÔTÉ des brutes. Le cahier l'exige, et la
 * doctrine aussi — une donnée réfutable est une donnée dont on peut retrouver
 * l'original.
 *
 * Pur : aucun réseau, aucune horloge, aucun aléa.
 */

/** Une mesure inertielle brute, dans le repère du boîtier. */
export interface MesureBrute {
  elapsedMs: number;
  /** g longitudinal brut (positif = accélération). */
  gLong: number | null;
  /** g latéral brut. */
  gLat: number | null;
  /** g vertical brut. */
  gVert: number | null;
  /** Vitesse en km/h, quand le GPS la donne. Sert à trouver les arrêts. */
  speedKmh: number | null;
  /** Vitesse de lacet en rad/s, quand la centrale la donne. */
  yawRateRadS?: number | null;
}

/** Une mesure corrigée, le brut conservé à côté. */
export interface MesureCalibree extends MesureBrute {
  /** g longitudinal redressé et débiaisé, ou `null` si non calibrable. */
  gLongCorrige: number | null;
  gLatCorrige: number | null;
  /** g vertical redressé, GRAVITÉ RETIRÉE (0 au repos, non 1). */
  gVertCorrige: number | null;
}

export interface Calibration {
  /** Tangage estimé, en degrés. Positif = nez du boîtier vers le haut. */
  tangageDeg: number;
  /** Roulis estimé, en degrés. */
  roulisDeg: number;
  /**
   * Lacet estimé en degrés, ou `null` s'il n'a pas pu l'être. `null` ne veut
   * pas dire zéro : il veut dire inconnu, et rien n'est tourné.
   */
  lacetDeg: number | null;
  /**
   * La direction de la gravité telle que le boîtier la voit, normée. C'EST la
   * calibration ; `tangageDeg` et `roulisDeg` n'en sont que la lecture humaine.
   *
   * On la conserve plutôt que de la reconstruire depuis les angles : deux
   * angles et une norme se recomposent mal, et l'erreur de reconstruction se
   * serait ajoutée à chaque mesure corrigée.
   */
  gravite: readonly [number, number, number];
  /** Norme du vecteur mesuré au repos, en g. Doit valoir 1 ; sinon on refuse. */
  normeAuRepos: number;
  /** Durée cumulée des fenêtres d'arrêt exploitées, en secondes. */
  secondesAuRepos: number;
  /** Ce qui n'a pas pu être établi, dit en clair. Vide = tout est établi. */
  motifs: readonly string[];
}

/**
 * Vitesse au-dessous de laquelle la voiture est considérée à l'arrêt.
 *
 * EXPORTÉE parce que le prévol l'affiche : l'écran qui demande au pilote de
 * s'immobiliser doit poser le MÊME seuil que le calcul qui l'exploitera. Deux
 * copies finiraient par diverger, et c'est l'écran qui mentirait.
 */
export const SEUIL_ARRET_KMH = 2;
/** Durée minimale d'une fenêtre d'arrêt exploitable, en millisecondes. */
export const DUREE_ARRET_MIN_MS = 3_000;
/** Au-delà de ce trou entre deux mesures, la fenêtre est coupée (perte BLE). */
const TROU_MAX_MS = 200;
/** Écart toléré sur la norme au repos. Au-delà, la mesure n'est pas la gravité. */
const TOLERANCE_NORME = 0.25;
/** Sous cette accélération longitudinale, l'échantillon ne dit rien du lacet. */
const SEUIL_LACET_G = 0.15;
/** Au-dessus de cette vitesse de lacet, la voiture tourne : on n'est pas droit. */
const SEUIL_LIGNE_DROITE_RAD_S = 0.05;
/** Nombre minimal d'échantillons droits pour oser une estimation de lacet. */
const ECHANTILLONS_LACET_MIN = 50;

const RAD_VERS_DEG = 180 / Math.PI;

type Vec3 = readonly [number, number, number];

function estFinie(x: number | null | undefined): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function norme(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * Les fenêtres où la voiture est à l'arrêt, assez longtemps pour que la moyenne
 * ait un sens.
 *
 * Une fenêtre se coupe sur un trou d'acquisition : deux arrêts séparés par une
 * minute de roulage manquante ne sont pas un seul arrêt d'une minute.
 */
export function fenetresAuRepos(mesures: readonly MesureBrute[]): MesureBrute[][] {
  const fenetres: MesureBrute[][] = [];
  let courante: MesureBrute[] = [];

  const cloturer = () => {
    if (courante.length >= 2) {
      const duree = courante[courante.length - 1].elapsedMs - courante[0].elapsedMs;
      if (duree >= DUREE_ARRET_MIN_MS) fenetres.push(courante);
    }
    courante = [];
  };

  for (const m of mesures) {
    const arretee = estFinie(m.speedKmh) && m.speedKmh < SEUIL_ARRET_KMH;
    const complete = estFinie(m.gLong) && estFinie(m.gLat) && estFinie(m.gVert);
    if (!arretee || !complete) {
      cloturer();
      continue;
    }
    const precedente = courante[courante.length - 1];
    if (precedente && m.elapsedMs - precedente.elapsedMs > TROU_MAX_MS) cloturer();
    courante.push(m);
  }
  cloturer();
  return fenetres;
}

/**
 * La rotation qui amène le vecteur `depuis` sur le vecteur `vers`, appliquée à
 * `v` — formule de Rodrigues.
 *
 * Deux cas dégénérés traités explicitement : les vecteurs déjà colinéaires (le
 * boîtier est droit, rien à tourner) et l'opposition exacte (le boîtier est à
 * l'envers), où l'axe de rotation n'est pas défini par le produit vectoriel.
 */
function rotationEntre(depuis: Vec3, vers: Vec3, v: Vec3): Vec3 {
  const a = norme(depuis);
  const b = norme(vers);
  if (a === 0 || b === 0) return v;
  const u: Vec3 = [depuis[0] / a, depuis[1] / a, depuis[2] / a];
  const w: Vec3 = [vers[0] / b, vers[1] / b, vers[2] / b];

  const cos = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
  if (cos > 1 - 1e-9) return v; // déjà alignés

  const axe: Vec3 = [
    u[1] * w[2] - u[2] * w[1],
    u[2] * w[0] - u[0] * w[2],
    u[0] * w[1] - u[1] * w[0],
  ];
  const sin = norme(axe);

  if (sin < 1e-9) {
    // Opposés : demi-tour autour de n'importe quel axe perpendiculaire.
    return [-v[0], -v[1], v[2]];
  }
  const k: Vec3 = [axe[0] / sin, axe[1] / sin, axe[2] / sin];
  const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const croix: Vec3 = [
    k[1] * v[2] - k[2] * v[1],
    k[2] * v[0] - k[0] * v[2],
    k[0] * v[1] - k[1] * v[0],
  ];
  return [
    v[0] * cos + croix[0] * sin + k[0] * kv * (1 - cos),
    v[1] * cos + croix[1] * sin + k[1] * kv * (1 - cos),
    v[2] * cos + croix[2] * sin + k[2] * kv * (1 - cos),
  ];
}

/**
 * Le lacet, déduit du mouvement.
 *
 * En ligne droite, toute l'accélération horizontale est LONGITUDINALE. L'angle
 * entre la direction où le boîtier la voit et son axe avant est donc le lacet.
 * On somme les vecteurs horizontaux redressés, orientés dans le sens de
 * l'accélération, et on lit l'angle de la somme.
 *
 * Rend `null` — jamais zéro — quand la matière manque : pas de gyroscope, pas
 * de ligne droite franche, ou trop peu d'échantillons. Un lacet supposé nul
 * serait indiscernable d'un lacet mesuré nul.
 */
export function estimerLacet(
  mesures: readonly MesureBrute[],
  redresser: (v: Vec3) => Vec3
): { lacetDeg: number | null; motif: string | null } {
  let sx = 0;
  let sy = 0;
  let n = 0;

  for (const m of mesures) {
    if (!estFinie(m.gLong) || !estFinie(m.gLat) || !estFinie(m.gVert)) continue;
    // Sans vitesse de lacet, on ne sait pas si la voiture est droite.
    if (!estFinie(m.yawRateRadS)) continue;
    if (Math.abs(m.yawRateRadS) > SEUIL_LIGNE_DROITE_RAD_S) continue;

    const [x, y] = redresser([m.gLong, m.gLat, m.gVert]);
    const amplitude = Math.sqrt(x * x + y * y);
    if (amplitude < SEUIL_LACET_G) continue;

    // Freinage et accélération pointent dans des sens opposés le long du même
    // axe : on replie tout du même côté, sinon la somme s'annule.
    const sens = x >= 0 ? 1 : -1;
    sx += sens * x;
    sy += sens * y;
    n++;
  }

  if (n < ECHANTILLONS_LACET_MIN) {
    return {
      lacetDeg: null,
      motif:
        'lacet non établi : moins de ' +
        String(ECHANTILLONS_LACET_MIN) +
        ' mesures en ligne droite avec une accélération franche',
    };
  }
  return { lacetDeg: Math.atan2(sy, sx) * RAD_VERS_DEG, motif: null };
}

/**
 * Établir la calibration d'une capture.
 *
 * Rend `null` quand elle n'est pas établissable — jamais une calibration neutre
 * qui laisserait croire que le boîtier a été vérifié.
 */
export function etablirCalibration(mesures: readonly MesureBrute[]): Calibration | null {
  const fenetres = fenetresAuRepos(mesures);
  if (fenetres.length === 0) return null;

  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  let ms = 0;
  for (const f of fenetres) {
    ms += f[f.length - 1].elapsedMs - f[0].elapsedMs;
    for (const m of f) {
      sx += m.gLong as number;
      sy += m.gLat as number;
      sz += m.gVert as number;
      n++;
    }
  }
  if (n === 0) return null;

  const gMesure: Vec3 = [sx / n, sy / n, sz / n];
  const normeAuRepos = norme(gMesure);

  // Au repos, l'accéléromètre ne voit QUE la gravité : sa norme vaut 1 g. Si
  // elle s'en écarte, ce qu'on a moyenné n'est pas un arrêt — un boîtier qui
  // glisse, une voiture sur camion, un capteur en défaut. On refuse plutôt que
  // de redresser sur une référence fausse.
  if (Math.abs(normeAuRepos - 1) > TOLERANCE_NORME) return null;

  // Le repère cible : z porte la verticale, x l'avant, y le côté.
  const vertical: Vec3 = [0, 0, gMesure[2] >= 0 ? 1 : -1];
  const redresser = (v: Vec3): Vec3 => rotationEntre(gMesure, vertical, v);

  // Tangage et roulis se lisent directement sur la gravité mesurée. C'est la
  // décomposition classique — tangage contre la NORME du plan (y, z), roulis
  // dans ce plan. Prendre `|gz|` au dénominateur du tangage, comme on est
  // tenté de le faire, donne un angle faux dès que le roulis n'est pas nul :
  // les deux inclinaisons se mélangeraient.
  const tangageDeg =
    Math.atan2(-gMesure[0], Math.sqrt(gMesure[1] * gMesure[1] + gMesure[2] * gMesure[2])) *
    RAD_VERS_DEG;
  const roulisDeg = Math.atan2(gMesure[1], gMesure[2]) * RAD_VERS_DEG;

  const { lacetDeg, motif } = estimerLacet(mesures, redresser);

  const motifs: string[] = [];
  if (motif !== null) motifs.push(motif);
  // LE ZÉRO ET L'INCLINAISON NE SE SÉPARENT PAS AU REPOS. Le cahier demande
  // « estimation du zéro » ET « compensation de gravité » comme deux étapes ;
  // à l'arrêt ce sont la MÊME mesure. Un capteur décalé de 0,03 g sur l'axe
  // avant et un boîtier penché de 1,7° produisent exactement le même vecteur.
  // Les séparer exigerait une seconde référence — un montage connu plat, ou
  // deux orientations du même boîtier. Le module ne prétend donc pas à un
  // biais horizontal : il redresse, et c'est tout ce qu'un arrêt autorise.
  //
  // Une seule composante du zéro reste lisible : l'écart de la NORME à 1 g,
  // conservé ci-dessous, qui ne dépend d'aucune orientation.
  if (Math.abs(normeAuRepos - 1) > 0.02) {
    motifs.push(
      'zéro du capteur suspect : ' +
        (normeAuRepos > 1 ? 'norme au repos supérieure' : 'norme au repos inférieure') +
        ' à 1 g de ' +
        Math.abs(normeAuRepos - 1).toFixed(3),
    );
  }

  return {
    tangageDeg,
    roulisDeg,
    lacetDeg,
    gravite: [gMesure[0] / normeAuRepos, gMesure[1] / normeAuRepos, gMesure[2] / normeAuRepos],
    normeAuRepos,
    secondesAuRepos: ms / 1000,
    motifs,
  };
}

/**
 * Appliquer une calibration à une mesure. Le brut est conservé.
 *
 * Trois corrections dans l'ordre : redressement (tangage/roulis), rotation de
 * lacet SI elle a été établie, puis retrait du biais et de la gravité.
 *
 * `calibration` à `null` rend les trois champs corrigés à `null` : c'est la
 * forme honnête de « on n'a pas pu vérifier », et elle se distingue à l'œil
 * d'un zéro mesuré.
 */
export function appliquerCalibration(
  mesure: MesureBrute,
  calibration: Calibration | null
): MesureCalibree {
  const vide: MesureCalibree = {
    ...mesure,
    gLongCorrige: null,
    gLatCorrige: null,
    gVertCorrige: null,
  };
  if (calibration === null) return vide;
  if (!estFinie(mesure.gLong) || !estFinie(mesure.gLat) || !estFinie(mesure.gVert)) return vide;

  const g = calibration.gravite;
  const vertical: Vec3 = [0, 0, g[2] >= 0 ? 1 : -1];
  const [x0, y0, z0] = rotationEntre(g, vertical, [mesure.gLong, mesure.gLat, mesure.gVert]);

  let x = x0;
  let y = y0;
  if (calibration.lacetDeg !== null) {
    const a = -calibration.lacetDeg / RAD_VERS_DEG;
    const c = Math.cos(a);
    const s = Math.sin(a);
    x = x0 * c - y0 * s;
    y = x0 * s + y0 * c;
  }

  return {
    ...mesure,
    gLongCorrige: x,
    gLatCorrige: y,
    // La gravité part : au repos, le vertical corrigé vaut zéro, pas un. Le
    // signe suit le sens de la verticale mesurée — un boîtier monté à l'envers
    // ne doit pas rendre −2 g au repos.
    gVertCorrige: z0 - vertical[2],
  };
}

/**
 * La phrase que l'écran peut afficher. Descriptive, jamais une consigne : on
 * dit ce qu'on a mesuré du montage, on ne dit pas de le redresser.
 */
export function phraseCalibration(calibration: Calibration | null): string {
  if (calibration === null) {
    return 'Orientation du boîtier non vérifiée : aucun arrêt assez long dans cette capture.';
  }
  const incl = Math.sqrt(
    calibration.tangageDeg * calibration.tangageDeg + calibration.roulisDeg * calibration.roulisDeg
  );
  const degres = incl.toFixed(1).replace('.', ',');
  const base = `Boîtier incliné de ${degres}° au repos, corrigé.`;
  return calibration.lacetDeg === null ? `${base} Orientation avant/arrière non établie.` : base;
}
