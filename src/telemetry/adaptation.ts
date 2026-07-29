/**
 * Le maillon manquant : des trames de séance vers la banque de calculs.
 * Logique PURE — jalon 4, phase 4septies.
 *
 * ---
 *
 * POURQUOI CE MODULE EXISTE
 *
 * La banque — `kinematics`, `delta`, `braking`, `accel`, `gg`, `resample`,
 * `segment` — a été construite au lot T1bis avec soixante-neuf tests. **Aucun
 * de ces sept modules n'était importé nulle part dans l'application.**
 *
 * Ce n'était pas un oubli de câblage : il manquait la conversion. La banque
 * parle en `Sample` (secondes, mètres par seconde) et en `DistanceSeries`
 * (abscisse curviligne) ; l'application stocke des `telemetry_frames`
 * (millisecondes, kilomètres par heure). Personne n'avait écrit le passage.
 *
 * Il est ici, pur et testé, pour que la conversion soit vérifiée une fois
 * plutôt que refaite à chaque écran.
 *
 * ---
 *
 * LES DEUX CONVERSIONS, ET POURQUOI ELLES SE VÉRIFIENT
 *
 * `elapsedMs → t` : division par mille. Une erreur de facteur mille ferait un
 * tour de quatre-vingt-dix secondes durer vingt-cinq heures, et le delta
 * resterait pourtant « cohérent » avec lui-même — donc invisible au test
 * d'acceptation du jalon.
 *
 * `speedKmh → m/s` : division par 3,6. Le boîtier rend des mm/s que le parseur
 * a déjà multipliés par 3,6/1000 ; on refait le chemin inverse. Une erreur ici
 * fausserait toutes les distances de la même proportion, donc tous les deltas.
 *
 * Règle fondateur : les conversions se vérifient avant le commit. Elles le sont,
 * par `adaptation.test.ts`.
 *
 * ---
 *
 * CE QUI EST ÉCARTÉ, ET POURQUOI PAS ZÉRO
 *
 * Une trame sans vitesse mesurée n'entre pas. Elle ne devient pas une vitesse
 * nulle : zéro serait le fait « le véhicule est à l'arrêt », qui n'est pas ce
 * qu'on sait. L'intégration sauterait alors un morceau de piste en croyant
 * l'avoir parcouru à l'arrêt — et la distance de tous les points suivants
 * serait fausse.
 */

import { cumulativeDistance, type Sample } from './kinematics';
import type { DistanceSeries } from './resample';

/**
 * Ce que la banque consomme d'une trame. Volontairement plus étroit que
 * `SessionFrame` : ce module ne doit rien savoir des services.
 */
export interface TrameBrute {
  /** Millisecondes depuis le début de la séance. */
  elapsedMs: number;
  /** Vitesse en km/h. `null` = non mesurée. */
  speedKmh: number | null;
  /**
   * Vitesse de lacet en RADIANS par seconde. `null` ou absent = pas de
   * gyroscope exploitable sur cette trame.
   *
   * La conversion depuis les degrés que stocke la base est faite en amont, par
   * `frameRowToSessionFrame`. Ce module ne convertit pas d'angle : il reçoit
   * déjà la bonne unité, et le nom du champ le dit.
   */
  yawRateRadS?: number | null;
}

/** Mètres par seconde depuis des kilomètres par heure. */
export function msDepuisKmh(kmh: number): number {
  return kmh / 3.6;
}

/**
 * Trames → `Sample[]`, dans les unités de la banque.
 *
 * Écarte ce qui n'est pas mesurable : vitesse absente, horodatage non fini,
 * vitesse négative (un capteur ne rend pas une vitesse négative ; si c'est le
 * cas, c'est du bruit, pas une marche arrière).
 *
 * Trie par horodatage : `cumulativeDistance` intègre pas à pas et suppose le
 * temps croissant. Une trame arrivée dans le désordre — la file de
 * synchronisation hors ligne peut en produire — retrancherait de la distance.
 */
export function versSamples(trames: readonly TrameBrute[]): Sample[] {
  const out: Sample[] = [];
  for (const f of trames) {
    if (f.speedKmh == null) continue;
    if (!Number.isFinite(f.speedKmh) || f.speedKmh < 0) continue;
    if (!Number.isFinite(f.elapsedMs)) continue;
    const s: Sample = { t: f.elapsedMs / 1000, speed: msDepuisKmh(f.speedKmh) };
    // Le lacet ne se pose que s'il est mesuré. `lateralAcceleration` et
    // `curvature` rendent `null` sur un champ absent — c'est le comportement
    // voulu, et il vaut mieux qu'un zéro qui dirait « la voiture va tout droit ».
    const w = f.yawRateRadS;
    if (w != null && Number.isFinite(w)) s.yawRate = w;
    out.push(s);
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Trames → série vitesse indexée par distance, prête pour `computeDelta`.
 *
 * La distance est INTÉGRÉE depuis la vitesse (`∫ v dt`), pas sommée depuis les
 * positions : la position porte un bruit qui s'accumulerait à chaque pas. C'est
 * la convention enregistrée pour `kinematics.distance`.
 *
 * Moins de deux trames exploitables → série vide. Une série d'un point ne
 * permet aucune intégration, et une série vide se voit ; une série inventée ne
 * se verrait pas.
 */
export function versSerieDistance(trames: readonly TrameBrute[]): DistanceSeries {
  const samples = versSamples(trames);
  if (samples.length < 2) return { distance: [], values: [] };
  return {
    distance: cumulativeDistance(samples),
    values: samples.map((s) => s.speed),
  };
}

/**
 * Longueur exploitable d'un tour, en mètres. `null` si rien n'est mesurable.
 *
 * Sert à décider si deux tours sont comparables : comparer un tour complet à
 * un demi-tour tronqué produirait un delta qui diverge sans jamais se refermer,
 * et le pilote lirait un écart qui n'existe pas.
 */
export function longueurTour(trames: readonly TrameBrute[]): number | null {
  const s = versSerieDistance(trames);
  if (s.distance.length === 0) return null;
  const fin = s.distance[s.distance.length - 1];
  return Number.isFinite(fin) && fin > 0 ? fin : null;
}

/**
 * Écart de longueur toléré entre deux tours qu'on compare.
 *
 * Dix pour cent : au-delà, ce ne sont plus deux fois le même parcours. Le seuil
 * est une convention, pas une mesure — et il est nommé pour cela.
 */
export const ECART_LONGUEUR_TOLERE = 0.1;

/** Deux tours sont-ils assez semblables pour que leur delta veuille dire quelque chose ? */
export function tousDeuxComparables(a: readonly TrameBrute[], b: readonly TrameBrute[]): boolean {
  const la = longueurTour(a);
  const lb = longueurTour(b);
  if (la == null || lb == null) return false;
  const ref = Math.max(la, lb);
  return Math.abs(la - lb) / ref <= ECART_LONGUEUR_TOLERE;
}
