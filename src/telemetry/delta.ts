/**
 * Delta-temps en base distance — module T1bis.
 *
 * *« La pente de la courbe est le gain ou la perte instantané. C'est l'objet
 * central du coaching. »* La courbe elle-même dit OÙ le temps se fait ; sa pente
 * dit à quelle vitesse il se fait.
 *
 * ---
 *
 * LA FORME RETENUE, ET POURQUOI PAS L'AUTRE
 *
 * L'écriture naturelle est `Δt(d) = ∫ [1/v_courant − 1/v_référence] dd`. Elle est
 * juste, et numériquement mauvaise : chaque terme diverge quand sa vitesse tend
 * vers zéro, et l'erreur explose là où les deux vitesses diffèrent le plus —
 * c'est-à-dire exactement là où le coach regarde.
 *
 * La forme MoTeC met la MOYENNE des deux vitesses au dénominateur :
 *
 *     Δt = (d_courant − d_référence) / ((v_courant + v_référence) / 2)
 *
 * En base distance, sur un pas commun, cela devient l'écart de temps mis à
 * parcourir CE pas :
 *
 *     δt = pas × (1/v_c − 1/v_r) = pas × (v_r − v_c) / (v_c × v_r)
 *
 * et la stabilisation consiste à borner les vitesses par un plancher plutôt
 * qu'à laisser la division partir. C'est ce que fait ce module.
 *
 * ---
 *
 * LE CRITÈRE D'ACCEPTATION DU LOT
 *
 * *Le delta cumulé se referme à zéro sur un tour comparé à lui-même.* S'il ne le
 * fait pas, le ré-échantillonnage ou l'intégration sont faux — et tout ce qui
 * s'appuiera dessus le sera aussi. Ce test est dans la suite, pas seulement ici.
 */

import { alignPair, type DistanceSeries } from './resample';

export interface DeltaResult {
  /** Abscisse curviligne commune, en mètres. */
  distance: number[];
  /**
   * Delta cumulé en secondes. Positif = le tour courant a PERDU du temps.
   * `null` là où l'une des deux traces ne dit rien.
   */
  cumulative: (number | null)[];
  /** Delta instantané par pas, en secondes. La pente de la courbe. */
  instant: (number | null)[];
  /** Delta final, en secondes. `null` si aucun pas exploitable. */
  total: number | null;
  /** Pas de la grille, en mètres. */
  step: number;
  /** Nombre de pas écartés faute de vitesse exploitable des deux côtés. */
  skipped: number;
}

/**
 * Plancher de vitesse, en m/s.
 *
 * Sous ce seuil, `1/v` part vers l'infini et un unique point à l'arrêt
 * dominerait tout le tour. Le pas concerné est ÉCARTÉ et compté, jamais borné
 * en silence : un delta amputé qui s'annonce vaut mieux qu'un delta complet qui
 * ment.
 */
const V_MIN_MS = 1;

/** Pas de grille par défaut, en mètres. Compromis lisibilité / coût. */
const PAS_DEFAUT_M = 5;

/**
 * Delta-temps entre un tour courant et un tour de référence.
 *
 * Les deux séries portent la VITESSE en fonction de la distance. Elles sont
 * alignées sur une grille commune bornée à leur emprise partagée.
 */
export function computeDelta(
  courant: DistanceSeries,
  reference: DistanceSeries,
  pas: number = PAS_DEFAUT_M
): DeltaResult {
  const { grille, a: vC, b: vR } = alignPair(courant, reference, pas);

  const instant: (number | null)[] = new Array(grille.length).fill(null);
  const cumulative: (number | null)[] = new Array(grille.length).fill(null);
  let cumul = 0;
  let vus = 0;
  let skipped = 0;

  for (let i = 0; i < grille.length; i++) {
    // Le premier point n'a pas de pas derrière lui : le delta y est nul par
    // construction, pas absent.
    if (i === 0) {
      instant[0] = 0;
      cumulative[0] = 0;
      continue;
    }

    const a = vC[i];
    const b = vR[i];
    if (a === null || b === null || a < V_MIN_MS || b < V_MIN_MS) {
      skipped++;
      // Le cumul ne recule pas : on reporte la dernière valeur connue plutôt
      // que d'ouvrir un trou au milieu d'une courbe cumulative.
      cumulative[i] = vus > 0 ? cumul : null;
      continue;
    }

    const largeur = grille[i] - grille[i - 1];
    // δt = pas × (1/v_courant − 1/v_référence), écrit sans deux divisions.
    const dt = (largeur * (b - a)) / (a * b);
    instant[i] = dt;
    cumul += dt;
    vus++;
    cumulative[i] = cumul;
  }

  return {
    distance: grille,
    cumulative,
    instant,
    total: vus > 0 ? cumul : null,
    step: pas,
    skipped,
  };
}

/**
 * Tour idéal — somme des meilleurs micro-secteurs.
 *
 * **Ce n'est jamais un tour réel**, et le dossier insiste : un tour idéal à
 * trois secteurs masque les erreurs À L'INTÉRIEUR d'un secteur. D'où le défaut
 * à 100 micro-secteurs, dans la fourchette 50–200 que le dossier retient.
 *
 * Rend `null` si aucun tour n'est exploitable — une cible théorique bâtie sur
 * rien serait une invention.
 *
 * ---
 *
 * CE QUE LE CAHIER DE VEILLE DEMANDE, ET QUE CETTE FONCTION NE FAIT PAS.
 *
 * Audit M10 du 26/08/2026. Le cahier (§03 « Tour optimal réaliste », fiche M10)
 * pose le contraire de ce découpage :
 *
 *   « Assembler les meilleurs micro-secteurs produit souvent un tour
 *     impossible. Mirror doit assembler des BLOCS COMPLETS entrée–virage–sortie,
 *     vérifier la CONTINUITÉ vitesse/position/accélération aux jonctions, puis
 *     nommer le résultat potentiel démontré. »
 *
 * Cette fonction prend le minimum indice par indice sur une grille uniforme :
 * elle ignore où commencent et finissent les virages, et ne regarde aucune
 * jonction. Un minimum pris juste avant un point de corde et le suivant pris
 * juste après peuvent venir de deux tours dont les vitesses d'entrée diffèrent
 * de vingt km/h ; la somme n'en sait rien.
 *
 * Elle N'A AUCUN APPELANT DE PRODUCTION — l'écran « Potentiel démontré » lit le
 * bloc `ideal_lap` de `session_insights`, pas cette fonction. Elle est donc
 * laissée INTACTE : la réécrire en assemblage par blocs est une décision de
 * produit (découpage des blocs, tolérances de jonction, que faire d'un bloc
 * rejeté), pas une correction. `src/telemetry/__tests__/idealLapNonBranche.
 * guard.test.ts` fige l'absence d'appelant, pour que le jour où quelqu'un la
 * branche, la décision soit prise sciemment.
 */
export function idealLapTime(
  tours: readonly (readonly (number | null)[])[],
  secteurs = 100
): { total: number | null; parSecteur: (number | null)[] } {
  const n = Math.max(1, Math.floor(secteurs));
  const meilleurs: (number | null)[] = new Array(n).fill(null);

  for (const tour of tours) {
    if (tour.length !== n) continue;
    for (let i = 0; i < n; i++) {
      const t = tour[i];
      if (t === null || !Number.isFinite(t)) continue;
      const m = meilleurs[i];
      if (m === null || t < m) meilleurs[i] = t;
    }
  }

  let total = 0;
  for (const m of meilleurs) {
    // Un seul micro-secteur manquant rend le total impossible : additionner en
    // ignorant le trou donnerait une cible ARTIFICIELLEMENT basse.
    if (m === null) return { total: null, parSecteur: meilleurs };
    total += m;
  }
  return { total, parSecteur: meilleurs };
}
