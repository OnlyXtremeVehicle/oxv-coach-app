/**
 * LE TROU DE BOUCLAGE — ce qu'un anneau qui ne se referme pas fabriquait.
 *
 * ===========================================================================
 * LA MESURE QUI OUVRE CE FICHIER
 * ===========================================================================
 *
 * Un circuit est un anneau. Six tracés vivent en base ; quatre le disaient en
 * répétant leur premier point à la fin, deux ne le disaient pas. Mesuré le
 * 01/09/2026 sur la base de production :
 *
 *     Bouteville        85,3 m      Albi              0,0 m
 *     Haute Saintonge   17,1 m      Bugatti           0,0 m
 *                                   Ricardo Tormo     0,0 m
 *                                   Charente          0,0 m
 *
 * Bouteville était le circuit de LA SÉANCE DE RÉFÉRENCE.
 *
 * ---------------------------------------------------------------------------
 * BOUTEVILLE A ÉTÉ REPRIS LE 02/09/2026 — et ce fichier reste utile
 * ---------------------------------------------------------------------------
 *
 * La CAUSE a été retirée en base : le tracé est refermé (141 points, 0,00 m,
 * 5 906,1 m) et recalé pour démarrer à la ligne. Le point de fermeture n'était
 * pas une route non relevée, c'était un point tombé à l'import — le fichier
 * source `bouteville.geojson` le portait depuis le début.
 *
 * Ces tests ne suivent PAS la base : ils éprouvent la géométrie sur un tracé
 * fabriqué ici. Ils restent donc le cliquet qui empêche le défaut de revenir —
 * par un nouveau circuit importé de travers, ou par Haute Saintonge, qui porte
 * toujours ses 17,1 m et reste le tracé de démonstration.
 *
 * ===========================================================================
 * POURQUOI C'ÉTAIT UNE MARGE FAUSSE, ET PAS UNE IMPRÉCISION
 * ===========================================================================
 *
 * `mapMatchPoint` borne sa projection à chaque segment. Une trame qui tombe
 * dans le trou n'a aucun segment sous elle : elle se projette sur le SOMMET le
 * plus proche, et son « écart latéral » devient la moitié du trou.
 *
 * `computeSegmentMargin` lit le MAXIMUM d'écart latéral du virage et le divise
 * par quatre mètres. UNE trame de trou suffit donc à saturer le terme de
 * trajectoire et à retirer la moitié de la marge du virage entier.
 *
 * MESURÉ ICI, en retirant le correctif : la marge du virage passe de 86,04 à
 * 37,5 sur UNE trame de trou. Quarante-huit points sur quatre-vingt-six.
 *
 * Et le garde de recalage ne pouvait pas le voir : il mesure la MÉDIANE — 1,49 m
 * sur la séance de référence, contre 143 trames de trou à 9,67 m de médiane et
 * 25,3 m au pire. Une queue de 0,5 % ne déplace pas une médiane.
 *
 * ===========================================================================
 * CE QU'ON NE FAIT PAS
 * ===========================================================================
 *
 * On ne referme pas le trou. Tracer une corde de 85 m à travers un bitume
 * qu'aucun relevé ne décrit inventerait la géométrie contre laquelle on prétend
 * mesurer — exactement le défaut qu'on corrige. On nomme le trou, et l'écart
 * latéral des trames qui y tombent ne compte dans aucune statistique.
 */

import { analyzeTrackVizSession, ECART_BOUCLAGE_MAX_M } from '@/trackviz/analysis';
import { buildTrackGeometry, mapMatchPoint } from '@/trackviz/geometry';
import type { PisteAnalysable } from '@/trackviz/pisteDepuisBase';
import type { TrackVizRecordingSample, TrackVizSegmentDefinition } from '@/trackviz/types';

/**
 * Un rectangle de 500 × 300 m aux abords de Bouteville, dont la dernière
 * branche s'arrête 86 m avant le point de départ. Cinq points, quatre segments.
 */
const P0 = { lat: 45.58, lon: -0.12 };
const P1 = { lat: 45.58, lon: -0.113582 };
const P2 = { lat: 45.5827, lon: -0.113582 };
const P3 = { lat: 45.5827, lon: -0.12 };
const P4 = { lat: 45.58077, lon: -0.12 };

const TRACE_OUVERTE = [P0, P1, P2, P3, P4];
const TRACE_REFERMEE = [P0, P1, P2, P3, P4, P0];

/** Un point posé DANS le trou, entre le dernier point du tracé et le premier. */
const DANS_LE_TROU = { lat: 45.5806, lon: -0.12005 };

/** Un point posé à côté du tracé, sur la branche est. */
const A_COTE_DU_TRACE = { lat: 45.5814, lon: -0.11355 };

describe('le tracé mesure son propre bouclage', () => {
  it('un anneau ouvert dit de combien il est ouvert', () => {
    const g = buildTrackGeometry([...TRACE_OUVERTE]);
    expect(g.ecartBouclageM).toBeGreaterThan(80);
    expect(g.ecartBouclageM).toBeLessThan(92);
  });

  it('un anneau refermé mesure zéro', () => {
    expect(buildTrackGeometry([...TRACE_REFERMEE]).ecartBouclageM).toBeCloseTo(0, 6);
  });

  /** Un tracé d'un point ne se referme sur rien : on rend 0, jamais NaN. */
  it('un tracé dégénéré ne rend pas un nombre invalide', () => {
    expect(buildTrackGeometry([P0]).ecartBouclageM).toBe(0);
    expect(buildTrackGeometry([]).ecartBouclageM).toBe(0);
  });

  /**
   * LE SEUIL N'EST PAS CHOISI, IL SE DÉDUIT. Une trame au milieu d'un trou de
   * longueur G est à peu près à G/2 du bout de tracé le plus proche ; au-delà
   * de deux fois le seuil de dispersion du dépôt, cet artefact seul sature le
   * terme de trajectoire.
   */
  it('le seuil vaut deux fois le seuil de dispersion', () => {
    expect(ECART_BOUCLAGE_MAX_M).toBe(8);
  });
});

describe('une trame dans le trou est reconnue comme hors tracé', () => {
  it('elle est marquée, et son écart dépasse le seuil', () => {
    const m = mapMatchPoint(DANS_LE_TROU, buildTrackGeometry([...TRACE_OUVERTE]));
    expect(m.horsTrace).toBe(true);
    expect(m.lateralErrorM).toBeGreaterThan(ECART_BOUCLAGE_MAX_M);
  });

  it('une trame à côté du tracé ne l’est pas — c’est un vrai écart', () => {
    const m = mapMatchPoint(A_COTE_DU_TRACE, buildTrackGeometry([...TRACE_OUVERTE]));
    expect(m.horsTrace).toBe(false);
    expect(m.lateralErrorM).toBeLessThan(10);
  });

  /**
   * LE MÊME POINT, SUR LE MÊME BITUME, CESSE D'ÊTRE HORS TRACÉ dès que l'anneau
   * se referme. C'est la démonstration que le marquage tient à la géométrie du
   * tracé et non à la position de la voiture.
   */
  it('refermer l’anneau suffit à le ramener sur le tracé', () => {
    const m = mapMatchPoint(DANS_LE_TROU, buildTrackGeometry([...TRACE_REFERMEE]));
    expect(m.horsTrace).toBe(false);
    expect(m.lateralErrorM).toBeLessThan(10);
  });
});

// ── La conséquence : une marge qui ne dépend plus d'un trou de carte ────────

function trame(
  ms: number,
  lat: number,
  lon: number,
  over: Partial<TrackVizRecordingSample> = {}
): TrackVizRecordingSample {
  return {
    elapsed_ms: ms,
    latitude: lat,
    longitude: lon,
    altitude_m: 40,
    speed_kmh: 90,
    heading_deg: null,
    g_force_x: 0.1,
    g_force_y: 0.3,
    g_force_z: 1,
    gps_accuracy_m: 0.2,
    gps_fix: 3,
    satellites: 15,
    battery_level: null,
    source: 'ble',
    ...over,
  };
}

const SEGMENT: TrackVizSegmentDefinition = {
  id: 'virage-1',
  order: 1,
  name: 'Virage 1',
  kind: 'turn',
  progressStart: 0,
  progressEnd: 1,
  apexProgress: 0.5,
  coachingFocus: '',
};

const PISTE: PisteAnalysable = { trace: TRACE_OUVERTE, segments: [SEGMENT] };

/** Vingt trames posées le long de la branche est, à un mètre du tracé. */
function surLeTrace(): TrackVizRecordingSample[] {
  return Array.from({ length: 20 }, (_, i) => trame(i * 40, 45.5801 + i * 0.00013, -0.1135835));
}

const AVEC_TROU = () => [...surLeTrace(), trame(800, DANS_LE_TROU.lat, DANS_LE_TROU.lon)];

describe('l’écart latéral d’une trame de trou ne compte nulle part', () => {
  it('une seule trame de trou ne déplace plus l’écart maximal du virage', () => {
    const propre = analyzeTrackVizSession(surLeTrace(), PISTE);
    const avecTrou = analyzeTrackVizSession(AVEC_TROU(), PISTE);
    expect(avecTrou.segments[0]?.maxLateralErrorM).toBeCloseTo(
      propre.segments[0]?.maxLateralErrorM as number,
      2
    );
  });

  it('ni l’écart moyen de la séance', () => {
    const propre = analyzeTrackVizSession(surLeTrace(), PISTE);
    const avecTrou = analyzeTrackVizSession(AVEC_TROU(), PISTE);
    expect(avecTrou.summary.avgLateralErrorM).toBeCloseTo(propre.summary.avgLateralErrorM, 2);
  });

  /**
   * LA MARGE, QUI EST CE QUE LE PILOTE LIT. Sans ce correctif, la trame de trou
   * portait l'écart maximal du virage de 0,12 m à 19,3 m, saturait
   * `trajectoryUsage`, et faisait tomber la marge de 86,04 à 37,5.
   */
  it('et ne retire plus la moitié de la marge du virage', () => {
    const propre = analyzeTrackVizSession(surLeTrace(), PISTE);
    const avecTrou = analyzeTrackVizSession(AVEC_TROU(), PISTE);
    const margeSansTrou = propre.segments[0]?.marginPercent;
    const margeAvecTrou = avecTrou.segments[0]?.marginPercent;
    expect(typeof margeSansTrou).toBe('number');
    expect(margeAvecTrou).toBeCloseTo(margeSansTrou as number, 2);
  });

  /**
   * ET LA TRAME N'EST PAS PERDUE : sa vitesse, ses G, son instant restent
   * comptés. On écarte une grandeur qui ne mesurait rien, pas une trame.
   */
  it('la trame reste dans la séance, seul son écart latéral est écarté', () => {
    const avecTrou = analyzeTrackVizSession(AVEC_TROU(), PISTE);
    expect(avecTrou.segments[0]?.sampleCount).toBe(21);
  });
});
