/**
 * LA GARDE DE DISTANCE MINIMALE — éprouvée sur la géométrie RÉELLE de Bouteville.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * `MAX_STEP_M` bornait le pas PAR LE HAUT : après un trou de données, le
 * segment entre deux points n'est pas une trajectoire, on ne l'évalue pas.
 * Rien ne le bornait PAR LE BAS — et c'est l'autre extrémité du même défaut.
 *
 * Un véhicule À L'ARRÊT sur la ligne d'arrivée n'est pas immobile pour le GPS :
 * il dérive de quelques mètres, en permanence. Chaque oscillation qui traverse
 * la porte dans le sens du cap comptait un tour, à la cadence exacte du
 * cooldown — un toutes les dix secondes.
 *
 * Mesuré sur ce tracé avant le premier essai terrain du 12/08/2026 : cinq
 * minutes d'arrêt sur la ligne avec une dérive de ±2 m produisaient **30 tours**.
 *
 * Le coût n'est pas cosmétique : ces tours de dix secondes deviennent le
 * MEILLEUR TOUR de la séance, et tout le bilan se lit par rapport à lui. Sur
 * une boucle de 5,9 km, c'est une donnée fabriquée qui contamine l'écran
 * central du produit.
 *
 * ===========================================================================
 * CE QUE CE TEST FAIT, ET POURQUOI IL LE FAIT AINSI
 * ===========================================================================
 *
 * Il EXÉCUTE le détecteur sur des trajectoires construites à partir du tracé
 * réel — jamais sur une abstraction, jamais en relisant le code. Le défaut
 * ci-dessus était invisible à la lecture : l'algorithme était correct, c'est le
 * monde physique qui ne l'était pas.
 *
 * Les deux propriétés sont éprouvées ENSEMBLE, parce qu'une garde qui ne
 * refuse rien et une garde qui refuse tout se ressemblent quand on n'en teste
 * qu'un côté :
 *   - le véhicule arrêté ne fabrique plus de tours ;
 *   - une séance entière de tours RÉELS est comptée sans en perdre un seul.
 *
 * Source géométrie : relevé fondateur, `src/circuit/data/bouteville.geojson`.
 */

import fs from 'fs';
import path from 'path';

import { createLapDetector, processGpsPoint } from '../lapDetection';

// ---------------------------------------------------------------------------
// Géométrie réelle
// ---------------------------------------------------------------------------

interface Geo {
  features: {
    properties: Record<string, string | undefined>;
    geometry: { type: string; coordinates: unknown };
  }[];
}

const GEO = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'circuit', 'data', 'bouteville.geojson'), 'utf8')
) as Geo;

const TRACE = GEO.features.find((f) => f.geometry.type === 'LineString')!.geometry.coordinates as [
  number,
  number,
][];
const [FINISH_LON, FINISH_LAT] = GEO.features.find((f) => f.properties.type === 'start_finish')!
  .geometry.coordinates as [number, number];

/** Relevé sur le segment porteur de la ligne (sommets 44→45). */
const CAP_DEG = 336.6;
/**
 * Longueur mesurée de la boucle, et le seuil qu'en tire `captureFinishLineFor`.
 *
 * UN CINQUIÈME, et pas la moitié : l'odomètre se replie sur la corde pendant un
 * trou de données, et cette corde minore la distance parcourue. À 50 %, une
 * coupure BLE de quelques minutes faisait refuser un tour RÉEL — et un tour
 * refusé fabrique un chrono double, parce que le runner ne déplace pas sa borne.
 * À l'arrêt, la vitesse Doppler sous la bande morte fait avancer l'odomètre de
 * zéro : les tours fantômes tombent aussi bien à 20 % qu'à 50 %.
 */
const LONGUEUR_M = 5913;
const SEUIL_M = LONGUEUR_M * 0.2;

const DEG = Math.PI / 180;
function metresParDegre(latDeg: number) {
  const phi = latDeg * DEG;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    lon: 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  };
}
const M = metresParDegre(FINISH_LAT);

/**
 * Bruit déterministe. `Math.random` rendrait ce test capable d'échouer un jour
 * sur deux sans qu'on sache lequel des deux résultats était le vrai.
 */
let graine = 20260812;
function alea(): number {
  graine = (graine * 1103515245 + 12345) & 0x7fffffff;
  return graine / 0x7fffffff;
}
/** Approximation gaussienne (somme d'uniformes), écart-type `sigma` mètres. */
function bruit(sigma: number): number {
  let s = 0;
  for (let i = 0; i < 6; i++) s += alea();
  return sigma * (s - 3);
}

/**
 * Un tour du tracé, échantillonné comme le ferait un RaceBox : pas constant
 * déduit de la vitesse et de la fréquence, plus un bruit de position.
 */
function tour(vitesseKmh: number, hz: number, sigmaM: number): [number, number][] {
  const pasM = vitesseKmh / 3.6 / hz;
  const pts: [number, number][] = [];
  for (let i = 1; i < TRACE.length; i++) {
    const [lon0, lat0] = TRACE[i - 1];
    const [lon1, lat1] = TRACE[i];
    const L = Math.hypot((lon1 - lon0) * M.lon, (lat1 - lat0) * M.lat);
    const n = Math.max(1, Math.ceil(L / pasM));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push([
        lon0 + (lon1 - lon0) * t + bruit(sigmaM) / M.lon,
        lat0 + (lat1 - lat0) * t + bruit(sigmaM) / M.lat,
      ]);
    }
  }
  return pts;
}

function detecteur(seuil: number | null) {
  return createLapDetector(FINISH_LAT, FINISH_LON, 25, CAP_DEG, seuil);
}

// ---------------------------------------------------------------------------

describe("le véhicule à l'arrêt sur la ligne ne fabrique plus de tours", () => {
  /**
   * LE CŒUR DU SUJET. Sans seuil, cette trajectoire — cinq minutes d'immobilité
   * à l'endroit exact où passe la piste — compte des dizaines de tours. C'est
   * la situation la plus banale d'une fin de séance.
   */
  const ARRET_LAT = 45.5971374;
  const ARRET_LON = -0.1334345; // projection exacte de la ligne sur le tracé

  /**
   * `vitesseKmh` reproduit ce que renvoie le boîtier : à l'arrêt, la vitesse
   * Doppler oscille sous le km/h — elle ne suit PAS la dérive de la position.
   * C'est toute la différence entre les deux odomètres.
   */
  function immobile(seuil: number | null, vitesseKmh?: number): number {
    const etat = detecteur(seuil);
    // 25 Hz pendant 5 minutes, dérive de ±2 m
    for (let i = 0; i < 25 * 300; i++) {
      processGpsPoint(
        etat,
        ARRET_LAT + bruit(2) / M.lat,
        ARRET_LON + bruit(2) / M.lon,
        i * 40,
        vitesseKmh
      );
    }
    return etat.lapEndTimestamps.length;
  }

  it('SANS seuil, la dérive du GPS compte des tours en série', () => {
    graine = 20260812;
    const sans = immobile(null, 0.4);
    // On ne fige pas le nombre exact (il dépend du bruit) : on fige le FAIT.
    // Plusieurs tours comptés à l'arrêt, c'est déjà le bilan corrompu.
    expect(sans).toBeGreaterThan(5);
  });

  it('AVEC le seuil, il en reste au plus un — celui qui clôt l’outlap', () => {
    graine = 20260812;
    const avec = immobile(SEUIL_M, 0.4);
    // Au plus UN : le premier franchissement n'est jamais soumis à la garde
    // (c'est la fin de l'outlap, cf. `distanceSuffisante`). Tous les suivants
    // sont refusés faute de distance parcourue.
    expect(avec).toBeLessThanOrEqual(1);
  });

  /**
   * LA RAISON POUR LAQUELLE L'ODOMÈTRE NE PEUT PAS SE FAIRE SUR LES POSITIONS.
   *
   * Première écriture de la garde : cumuler la distance entre points. Ce test
   * est la mesure qui l'a condamnée — sans vitesse fournie, le seuil ne change
   * presque rien, parce que la dérive du GPS EST une distance et qu'en cinq
   * minutes elle en totalise des dizaines de kilomètres.
   *
   * Le repli sur les positions reste écrit (appelant sans vitesse, trou de
   * données), et il faut savoir ce qu'il ne protège pas.
   */
  it('le repli par positions ne protège PAS de l’arrêt — c’est mesuré, pas supposé', () => {
    graine = 20260812;
    const sansVitesse = immobile(SEUIL_M, undefined);
    expect(sansVitesse).toBeGreaterThan(1);
  });
});

describe('une séance entière de tours réels est comptée sans perte', () => {
  /**
   * LE CONTRE-TEST, et il n'est pas décoratif. Une garde qui refuserait tout
   * passerait le test précédent haut la main. Ce qui distingue une garde utile
   * d'une garde nuisible, c'est ce qu'elle laisse passer.
   *
   * Huit passages de ligne : outlap, six tours à des allures différentes, inlap.
   */
  const PROGRAMME = [60, 95, 105, 110, 100, 115, 108, 55];

  it.each([
    [0, 25],
    [1.5, 25],
    [3, 25],
    [1.5, 10],
    [1.5, 5],
  ])('bruit σ=%s m à %s Hz — les 8 franchissements sont comptés', (sigma, hz) => {
    graine = 20260812;
    const etat = detecteur(SEUIL_M);
    let ts = 0;
    const dt = 1000 / (hz as number);
    for (const v of PROGRAMME) {
      for (const [lon, lat] of tour(v, hz as number, sigma as number)) {
        processGpsPoint(etat, lat, lon, ts, v);
        ts += dt;
      }
    }
    expect(etat.lapEndTimestamps).toHaveLength(PROGRAMME.length);
  });

  it('le seuil ne change RIEN au décompte des tours réels', () => {
    graine = 20260812;
    const avec = detecteur(SEUIL_M);
    graine = 20260812;
    const sans = detecteur(null);
    let ts = 0;
    for (const v of PROGRAMME) {
      graine = 20260812 + v;
      const pts = tour(v, 25, 1.5);
      for (const [lon, lat] of pts) {
        processGpsPoint(avec, lat, lon, ts, v);
        processGpsPoint(sans, lat, lon, ts, v);
        ts += 40;
      }
    }
    expect(avec.lapEndTimestamps).toEqual(sans.lapEndTimestamps);
  });
});

describe('un trou de liaison ne fait pas perdre le tour SUIVANT', () => {
  /**
   * La précaution la moins évidente des trois, et celle qui casse en silence
   * si on l'oublie : les pas écartés par `MAX_STEP_M` alimentent QUAND MÊME
   * l'odomètre. Sans cela, une coupure BLE de trente secondes en pleine ligne
   * droite retirerait du compteur la distance réellement parcourue, et le tour
   * suivant — parfaitement réel — serait refusé faute de kilomètres à son actif.
   *
   * On coupe donc le flux sur 30 % du deuxième tour — dans une portion qui ne
   * contient PAS la ligne (elle est à 31,6 % du tracé, la coupure court de 50 %
   * à 80 %) — et on vérifie que les quatre passages sont comptés.
   */
  it('la distance parcourue pendant la coupure reste acquise', () => {
    graine = 20260812;
    const etat = detecteur(SEUIL_M);
    let ts = 0;
    for (let n = 0; n < 4; n++) {
      const pts = tour(100, 25, 1);
      pts.forEach(([lon, lat], i) => {
        const dansLeTrou = n === 1 && i > pts.length * 0.5 && i < pts.length * 0.8;
        if (!dansLeTrou) processGpsPoint(etat, lat, lon, ts, 100);
        ts += 40;
      });
    }
    // Quatre passages de ligne, coupure comprise : aucun tour perdu.
    expect(etat.lapEndTimestamps).toHaveLength(4);
  });

  /**
   * Le pendant du précédent, et il dit ce que la garde NE fait PAS : quand la
   * coupure avale la ligne elle-même, le tour n'est pas compté. C'est
   * `MAX_STEP_M` qui parle, et c'est voulu — un tour manqué se voit, un tour
   * inventé corrompt le bilan en silence.
   */
  /**
   * LE CAS QUI A CONDAMNÉ LE SEUIL À 50 %. Une coupure qui avale la MOITIÉ du
   * tour laisse l'odomètre sous les 2 956 m qu'exigeait l'ancien seuil, et le
   * tour suivant — parfaitement réel — était refusé. À 20 % (1 183 m), il passe.
   */
  it('une coupure de la MOITIÉ du tour ne fait pas refuser le tour suivant', () => {
    graine = 20260812;
    const etat = detecteur(SEUIL_M);
    let ts = 0;
    for (let n = 0; n < 3; n++) {
      const pts = tour(100, 25, 1);
      pts.forEach(([lon, lat], i) => {
        // 50 % du tour jeté, hors de la zone de la ligne (31,6 %).
        const dansLeTrou = n === 1 && i > pts.length * 0.4 && i < pts.length * 0.9;
        if (!dansLeTrou) processGpsPoint(etat, lat, lon, ts, 100);
        ts += 40;
      });
    }
    expect(etat.lapEndTimestamps).toHaveLength(3);
  });

  it("une coupure QUI AVALE la ligne fait perdre ce passage, et c'est le bon choix", () => {
    graine = 20260812;
    const etat = detecteur(SEUIL_M);
    let ts = 0;
    for (let n = 0; n < 3; n++) {
      const pts = tour(100, 25, 1);
      pts.forEach(([lon, lat], i) => {
        // 31,6 % = la ligne. La coupure court de 25 % à 40 %.
        const dansLeTrou = n === 1 && i > pts.length * 0.25 && i < pts.length * 0.4;
        if (!dansLeTrou) processGpsPoint(etat, lat, lon, ts, 100);
        ts += 40;
      });
    }
    expect(etat.lapEndTimestamps).toHaveLength(2);
  });
});

describe('le contrat de configuration', () => {
  it('un seuil absent, nul ou négatif laisse le comportement historique', () => {
    for (const valeur of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(detecteur(valeur).minLapDistanceM).toBeNull();
    }
  });

  it("l'odomètre repart de zéro à chaque tour compté", () => {
    graine = 20260812;
    const etat = detecteur(SEUIL_M);
    let ts = 0;
    for (const [lon, lat] of tour(100, 25, 0)) {
      processGpsPoint(etat, lat, lon, ts, 100);
      ts += 40;
    }
    expect(etat.lapEndTimestamps).toHaveLength(1);
    // Juste après le franchissement, l'odomètre a repris à zéro et n'a
    // accumulé que la fin du tour.
    expect(etat.distanceSinceLapM).toBeLessThan(LONGUEUR_M);
  });
});

describe('la zone de garde elle-même, approchée par les deux côtés', () => {
  /**
   * CE QUE LE CONTRE-TEST NE FAISAIT PAS.
   *
   * « Aucun tour réel perdu » était certifié par des trajectoires qui
   * accumulaient 5 913 m — vingt fois le seuil. Elles ne s'approchaient JAMAIS
   * de la frontière, et n'auraient donc rien vu si le seuil avait dérivé.
   *
   * On encadre ici la décision de part et d'autre, en pilotant directement
   * l'odomètre : juste sous le seuil elle refuse, juste au-dessus elle accepte.
   * C'est la seule façon de savoir où la frontière se trouve VRAIMENT.
   */
  const SEUIL = 1000;

  /** Pousse l'odomètre à `metres` sans franchir la ligne, puis rend l'état. */
  function odometreA(metres: number) {
    const etat = detecteur(SEUIL);
    // Premier franchissement (fin d'outlap) : jamais soumis à la garde.
    let ts = 0;
    for (const [lon, lat] of tour(100, 25, 0)) {
      processGpsPoint(etat, lat, lon, ts, 100);
      ts += 40;
    }
    expect(etat.lapEndTimestamps).toHaveLength(1);
    // On remet l'odomètre exactement où on veut l'éprouver.
    etat.distanceSinceLapM = metres;
    return { etat, ts };
  }

  it('un mètre SOUS le seuil : le tour est refusé', () => {
    graine = 20260812;
    const { etat, ts } = odometreA(SEUIL - 1);
    let t = ts;
    // Deuxième passage de ligne, sans laisser l'odomètre grandir (vitesse nulle
    // sous la bande morte : il n'avance pas).
    for (const [lon, lat] of tour(100, 25, 0)) {
      processGpsPoint(etat, lat, lon, t, 0);
      t += 40;
    }
    expect(etat.lapEndTimestamps).toHaveLength(1);
  });

  it('un mètre AU-DESSUS du seuil : le tour est compté', () => {
    graine = 20260812;
    const { etat, ts } = odometreA(SEUIL + 1);
    let t = ts;
    for (const [lon, lat] of tour(100, 25, 0)) {
      processGpsPoint(etat, lat, lon, t, 0);
      t += 40;
    }
    expect(etat.lapEndTimestamps).toHaveLength(2);
  });

  /** Exactement au seuil : la comparaison est un `>=`, donc il passe. */
  it('exactement au seuil, le tour passe', () => {
    graine = 20260812;
    const { etat, ts } = odometreA(SEUIL);
    let t = ts;
    for (const [lon, lat] of tour(100, 25, 0)) {
      processGpsPoint(etat, lat, lon, t, 0);
      t += 40;
    }
    expect(etat.lapEndTimestamps).toHaveLength(2);
  });
});
