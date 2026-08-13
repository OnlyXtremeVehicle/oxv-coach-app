/**
 * LA LONGUEUR D'UN TOUR, DE L'ODOMÈTRE JUSQU'À CE QUE LE PILOTE LIT.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * `compterTour` remettait l'odomètre à zéro sans que personne n'ait lu sa
 * valeur. La longueur du tour — mesurée à la trame près, la seule grandeur qui
 * dise si deux tours couvrent le même parcours — était effacée à l'instant
 * exact où elle devenait connue.
 *
 * La chaîne complète, telle qu'elle se lit dans le dépôt :
 *
 *   odomètre  →  RecordedLap  →  laps.distance_meters  →  etatSeanceService
 *             →  compteToursComparables  →  etatNiveau('delta')  →  écran
 *
 * Le premier maillon était rompu, et TOUS les suivants existaient, testés,
 * verts. `laps.distance_meters` est documenté « jamais écrite » depuis le
 * 26/07/2026 ; `compteToursComparables` n'accepte que des longueurs
 * strictement positives et rendait donc invariablement zéro ; et le niveau
 * « Le delta et la trace » ne pouvait s'ouvrir SUR AUCUNE SÉANCE, jamais.
 *
 * ===========================================================================
 * CE QUE LE PILOTE LISAIT, ET POURQUOI C'ÉTAIT PIRE QU'UN NIVEAU FERMÉ
 * ===========================================================================
 *
 * La nuit du 13/08/2026, à Bouteville : trois tours de 5 873, 5 874 et 5 877 m.
 * Quatre mètres d'écart sur près de six kilomètres — les tours les plus
 * comparables qu'on puisse rouler. L'application lui annonçait :
 *
 *     « Aucun tour comparable. Cette lecture en demande deux qui couvrent la
 *       même distance. »
 *
 * Une affirmation fausse sur ses propres données, formulée avec l'assurance
 * d'un constat. C'est la garde posée, non armée, poussée jusqu'à l'écran.
 *
 * ===========================================================================
 * CE QUE CE TEST FAIT
 * ===========================================================================
 *
 * Il EXÉCUTE le détecteur réel sur la géométrie réelle du relevé fondateur, et
 * porte son assertion sur ce que le pilote voit — l'état du niveau — et non
 * sur la plomberie qui y mène. Un test qui n'aurait vérifié que « le champ est
 * renseigné » serait passé au vert pendant que l'écran continue de mentir.
 *
 * Source géométrie : `src/circuit/data/bouteville.geojson`.
 */

import fs from 'fs';
import path from 'path';

import { createLapDetector, processGpsPoint } from '@/utils/lapDetection';

import { ECART_LONGUEUR_TOLERE } from '../adaptation';
import { compteToursComparables, etatDepuisSeance, etatNiveau, type TourComptable } from '../niveaux';

// ---------------------------------------------------------------------------
// Géométrie réelle — même source que `lapDetectionDistance.test.ts`
// ---------------------------------------------------------------------------

interface Geo {
  features: {
    properties: Record<string, string | undefined>;
    geometry: { type: string; coordinates: unknown };
  }[];
}

const GEO = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'circuit', 'data', 'bouteville.geojson'),
    'utf8'
  )
) as Geo;

const TRACE = GEO.features.find((f) => f.geometry.type === 'LineString')!.geometry.coordinates as [
  number,
  number,
][];
const [FINISH_LON, FINISH_LAT] = GEO.features.find((f) => f.properties.type === 'start_finish')!
  .geometry.coordinates as [number, number];

const CAP_DEG = 336.6;
const LONGUEUR_M = 5913;
const SEUIL_M = LONGUEUR_M * 0.2;

const DEG = Math.PI / 180;
const PHI = FINISH_LAT * DEG;
const M = {
  lat: 111132.92 - 559.82 * Math.cos(2 * PHI) + 1.175 * Math.cos(4 * PHI),
  lon: 111412.84 * Math.cos(PHI) - 93.5 * Math.cos(3 * PHI),
};

/** Un tour du tracé échantillonné comme le ferait un RaceBox. */
function tour(vitesseKmh: number, hz = 25): [number, number][] {
  const pasM = vitesseKmh / 3.6 / hz;
  const pts: [number, number][] = [];
  for (let i = 1; i < TRACE.length; i++) {
    const [lon0, lat0] = TRACE[i - 1];
    const [lon1, lat1] = TRACE[i];
    const L = Math.hypot((lon1 - lon0) * M.lon, (lat1 - lat0) * M.lat);
    const n = Math.max(1, Math.ceil(L / pasM));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push([lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t]);
    }
  }
  return pts;
}

/**
 * Rejoue une séance et rend les longueurs des tours CHRONOMÉTRÉS, exactement
 * comme `lapDetectionRunner` les collecte : la valeur figée par `compterTour`,
 * lue au franchissement, et seulement à partir du deuxième (le premier clôt
 * l'outlap et n'est pas un tour).
 */
function longueursDesTours(allures: number[]): (number | null)[] {
  const etat = createLapDetector(FINISH_LAT, FINISH_LON, 25, CAP_DEG, SEUIL_M);
  const longueurs: (number | null)[] = [];
  let ts = 0;
  let premierPassageVu = false;

  for (const v of allures) {
    for (const [lon, lat] of tour(v)) {
      const franchi = processGpsPoint(etat, lat, lon, ts, v);
      if (franchi) {
        if (premierPassageVu) longueurs.push(etat.derniereLongueurTourM);
        premierPassageVu = true;
      }
      ts += 40;
    }
  }
  return longueurs;
}

// ---------------------------------------------------------------------------

describe('la longueur du tour survit au franchissement', () => {
  /** Outlap + trois tours — la séance réelle du 13/08. */
  const SEANCE = [60, 95, 105, 110];

  it('chaque tour chronométré porte une longueur, et c’est celle du circuit', () => {
    const longueurs = longueursDesTours(SEANCE);
    expect(longueurs).toHaveLength(3);
    for (const l of longueurs) {
      expect(l).not.toBeNull();
      // La mesure intègre la vitesse Doppler : elle ne peut pas coller au mètre
      // près à la longueur géométrique. Deux pour cent suffisent à prouver que
      // c'est bien le circuit qui est mesuré, et pas autre chose.
      expect(Math.abs((l as number) - LONGUEUR_M) / LONGUEUR_M).toBeLessThan(0.02);
    }
  });

  /**
   * LE POINT QUE `compterTour` DOIT TENIR : la valeur est celle du tour qui
   * VIENT de se clore, pas celle du tour en cours. Une ligne d'écart dans
   * l'ordre des opérations, et tous les tours vaudraient zéro.
   */
  it('la valeur lue est celle du tour clos, pas un odomètre déjà reparti', () => {
    const longueurs = longueursDesTours(SEANCE);
    for (const l of longueurs) {
      expect(l as number).toBeGreaterThan(SEUIL_M);
    }
  });

  /**
   * ZÉRO N'EST PAS UNE MESURE. Un odomètre resté à zéro dit « je n'ai rien pu
   * mesurer », pas « ce tour fait zéro mètre ». Écrire 0 en base le ferait
   * passer pour une mesure, et un 0 traverse `Number.isFinite` sans broncher.
   */
  it('un tour sans distance mesurable rend null, jamais zéro', () => {
    const etat = createLapDetector(FINISH_LAT, FINISH_LON, 25, CAP_DEG, null);
    let ts = 0;
    // Aucune vitesse fournie ET aucun déplacement : l'odomètre reste à zéro.
    for (let i = 0; i < 3; i++) {
      for (const [lon, lat] of tour(100)) {
        processGpsPoint(etat, lat, lon, ts, 0);
        ts += 40;
      }
    }
    expect(etat.derniereLongueurTourM).toBeNull();
  });
});

describe('ce que le pilote lit au bout de la chaîne', () => {
  /** Ce que `etatSeanceService` construit depuis les lignes `laps`. */
  function tours(longueurs: (number | null)[]): TourComptable[] {
    return longueurs.map((longueurM) => ({ longueurM, estOutlap: false, estInlap: false }));
  }

  const CANAUX = { tramesAvecLacet: 0, tramesAvecAcceleration: 0 };

  /**
   * L'ASSERTION QUI COMPTE. Trois tours réels de Bouteville ouvrent le niveau
   * « Le delta et la trace ». Avant la correction, il restait fermé sur toute
   * séance jamais roulée.
   */
  it('trois tours réels ouvrent « Le delta et la trace »', () => {
    const longueurs = longueursDesTours([60, 95, 105, 110]);
    const etat = etatDepuisSeance(tours(longueurs), CANAUX);
    expect(etat.toursComparables).toBe(3);
    expect(etatNiveau('delta', etat)).toEqual({ ouvert: true });
  });

  /**
   * LE TÉMOIN DU DÉFAUT. On rejoue l'état d'avant — toutes les longueurs à
   * `null`, ce que la base portait réellement — et on constate le message que
   * le pilote a lu après avoir bouclé trois tours à quatre mètres d'écart.
   *
   * Il est ici pour qu'une régression sur le premier maillon se lise comme ce
   * qu'elle est : une phrase fausse à l'écran, pas un champ vide en base.
   */
  it('sans longueur, le niveau se ferme sur une phrase FAUSSE — c’est l’état d’avant', () => {
    const etat = etatDepuisSeance(tours([null, null, null]), CANAUX);
    expect(etat.toursChronometres).toBe(3);
    expect(etat.toursComparables).toBe(0);
    expect(etatNiveau('delta', etat)).toEqual({
      ouvert: false,
      compteur:
        'Aucun tour comparable. Cette lecture en demande deux qui couvrent la même distance.',
    });
  });

  /**
   * La tolérance fait son travail dans les deux sens : un tour raccourci — une
   * sortie de piste, un retour aux stands à mi-parcours — n'est comparable à
   * rien, et ne doit pas être compté comme s'il l'était.
   */
  it('un tour amputé n’est comparable à rien', () => {
    const complet = LONGUEUR_M;
    const ampute = LONGUEUR_M * (1 - ECART_LONGUEUR_TOLERE - 0.05);
    expect(compteToursComparables([complet, complet, ampute])).toBe(2);
  });

  it('deux tours suffisent, un seul ne suffit pas', () => {
    const l = LONGUEUR_M;
    expect(etatNiveau('delta', etatDepuisSeance(tours([l, l]), CANAUX))).toEqual({ ouvert: true });
    expect(etatNiveau('delta', etatDepuisSeance(tours([l]), CANAUX))).toEqual({
      ouvert: false,
      compteur:
        'Aucun tour comparable. Cette lecture en demande deux qui couvrent la même distance.',
    });
  });

  /**
   * UNE BRANCHE DE MESSAGE QUE RIEN NE PEUT ATTEINDRE — constaté en écrivant le
   * test ci-dessus, qui attendait « Un seul tour comparable ».
   *
   * `compteToursComparables` apparie SYMÉTRIQUEMENT : si A trouve un voisin B,
   * alors B trouve A. Le compte vaut donc toujours 0 ou au moins 2, jamais 1 —
   * et la phrase « Un seul tour comparable » de `etatNiveau` est inatteignable.
   *
   * On la laisse en place : elle est défensive et ne coûte rien, et la
   * définition de « comparable » pourrait devenir asymétrique un jour. Mais on
   * la NOMME ici, pour que personne ne perde une heure à chercher comment
   * l'afficher — et pour qu'une refonte de l'appariement trouve la question
   * déjà posée.
   */
  it('le compte de tours comparables ne vaut jamais un — la phrase associée est morte', () => {
    const l = LONGUEUR_M;
    const isole = LONGUEUR_M * 0.5;
    for (const cas of [[l], [l, isole], [l, l, isole], [isole, isole, l], []]) {
      expect(compteToursComparables(cas)).not.toBe(1);
    }
  });
});
