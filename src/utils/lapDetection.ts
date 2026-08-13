/**
 * Algorithme de détection des tours OXV
 *
 * Deux modes, selon ce que le circuit renseigne :
 *
 * ── MODE PORTE (dès qu'un cap de franchissement est fourni) ───────────────────
 * La porte est un SEGMENT perpendiculaire à la piste, centré sur la ligne
 * d'arrivée, de demi-longueur `finishLineRadius`. Un tour est compté quand le
 * segment [point précédent → point courant] COUPE ce segment, dans le sens du cap.
 * C'est le fonctionnement des vraies boucles de chronométrage.
 *
 * Pourquoi : les VOIES DES STANDS longent les lignes droites d'arrivée et leur
 * sont PARALLÈLES. Mesuré sur la géométrie réelle (relevés fondateur) :
 *   - Haute Saintonge : stands à 22,9 m de la ligne, cap 300,8° contre 298,5° → 2,3° d'écart ;
 *   - Ricardo Tormo (Valence) : stands à 16,2 m, cap 55,6° contre 55,2° → 0,4° d'écart.
 * En mode rayon, la fenêtre admissible à Valence est [13,0 ; 13,2] m — 20 cm, et
 * vide dès que la voie des stands fait sa largeur standard (10-12 m) : AUCUN rayon
 * ne peut à la fois couvrir la piste et exclure les stands. Un filtre de cap n'y
 * changerait rien (0,4° d'écart). Une voie parallèle décalée latéralement ne coupe
 * JAMAIS une porte qui ne s'étend pas jusqu'à elle : c'est structurel, pas un seuil.
 *
 * ── MODE RAYON (repli, quand aucun cap n'est renseigné) ───────────────────────
 * Comportement historique, conservé à l'identique : entrée dans un disque de
 * `finishLineRadius` autour de la ligne → tour. Sert aux tracés dont le cap
 * n'est pas relevé, et au repli `BELTOISE_FINISH`. Aucune vérification de
 * direction dans ce mode.
 *
 * DEPUIS LE 03/08/2026, PLUS AUCUN CIRCUIT DE PRODUCTION NE L'EMPRUNTE. Les
 * trois restants portent un cap. « La charade », qui était l'exemple cité ici,
 * a été retirée au jalon 0.H. Le mode reste pour les tracés pilote nouvellement
 * dessinés — mais il n'est plus exercé par personne, et c'est le genre de
 * chemin où un défaut s'installe sans bruit.
 *
 * Communs aux deux modes :
 *   - cooldown de 10 s minimum entre deux tours (anti-double-comptage) ;
 *   - premier passage de ligne = outlap (arbitré par `lapDetectionRunner`) ;
 *   - DISTANCE MINIMALE de tour, quand le circuit renseigne sa longueur.
 *
 * ── POURQUOI UNE DISTANCE MINIMALE (posée le 12/08/2026) ──────────────────────
 * `MAX_STEP_M` borne le pas PAR LE HAUT — un trou de données ne fabrique pas de
 * franchissement. Rien ne le bornait PAR LE BAS, et c'est l'autre extrémité du
 * même défaut : un véhicule À L'ARRÊT sur la ligne dérive de quelques mètres au
 * gré du GPS, et chaque oscillation qui traverse la porte dans le sens du cap
 * compte un tour. Simulé sur le tracé de Bouteville avant le premier essai :
 * cinq minutes d'arrêt sur la ligne, dérive de ±2 m → **30 tours comptés**, un
 * toutes les dix secondes, exactement la cadence du cooldown.
 *
 * Le coût n'est pas cosmétique. Ces tours de dix secondes deviennent le
 * MEILLEUR TOUR de la séance, et tout le bilan se lit ensuite par rapport à eux.
 * Un tour de 10 s sur une boucle de 5,9 km est une donnée fabriquée.
 *
 * La garde est physique : on ne boucle pas un circuit sans le parcourir. On
 * cumule donc la distance parcourue depuis le dernier tour compté, et on refuse
 * un franchissement qui n'en a pas assez à son actif.
 *
 * ── L'ODOMÈTRE SE FAIT SUR LA VITESSE, PAS SUR LES POSITIONS ─────────────────
 * Première écriture de cette garde : cumuler la distance entre points
 * successifs. Elle ne servait À RIEN, et le test l'a montré tout de suite —
 * l'arrêt de cinq minutes comptait encore sept tours.
 *
 * La raison est que **la dérive du GPS est une distance**. À 25 Hz, un véhicule
 * immobile saute de deux ou trois mètres à chaque point ; en cinq minutes, la
 * somme de ces sauts dépasse vingt kilomètres. L'odomètre par positions mesure
 * le bruit avec autant de zèle que le mouvement, et le seuil était franchi bien
 * avant que la voiture n'ait bougé d'un mètre.
 *
 * La vitesse Doppler du RaceBox, elle, lit ~0 à l'arrêt : elle vient du décalage
 * de fréquence des porteuses, pas d'une différence de positions bruitées. On
 * intègre donc `vitesse × durée`, avec une bande morte sous 3 km/h.
 *
 * Les positions restent le repli pour DEUX cas où la vitesse ne dit rien :
 * l'appelant qui ne la fournit pas, et le TROU de données — pendant une coupure
 * il n'y a aucun échantillon de vitesse à intégrer, et la corde entre les deux
 * points encadrant le trou est la meilleure estimation disponible (elle minore
 * la distance réellement parcourue, ce qui est le bon sens de l'erreur).
 *
 * Trois précautions, et chacune protège un tour RÉEL :
 *   - le PREMIER franchissement n'est jamais soumis à la garde. C'est la fin de
 *     l'outlap, et le pilote peut avoir armé dix mètres avant la ligne : l'y
 *     soumettre retarderait le tour 1 d'une boucle entière ;
 *   - le seuil vaut la MOITIÉ de la longueur du circuit, pas sa longueur. On
 *     cherche à écarter des tours de quelques mètres, pas à arbitrer au mètre
 *     près une trajectoire qui coupe court ;
 *   - un pas écarté par `MAX_STEP_M` compte QUAND MÊME dans la distance. Après
 *     un trou de liaison, le véhicule a bien roulé ; ne pas le compter ferait
 *     refuser le tour suivant, qui lui est vrai. Dans le doute, on penche du
 *     côté qui garde les tours réels.
 *
 * Circuit sans longueur renseignée → aucun seuil, comportement inchangé.
 */

import { haversineDistance } from './geo';

/**
 * Géométrie de la porte, précalculée à la création du détecteur.
 * Repère local en mètres, origine = la ligne d'arrivée, x vers l'est, y vers le nord.
 */
interface GateGeometry {
  /** Mètres par degré de latitude, à la latitude de la ligne. */
  metersPerDegLat: number;
  /** Mètres par degré de longitude, à la latitude de la ligne. */
  metersPerDegLon: number;
  /** Extrémité A de la porte (côté cap − 90°), en mètres locaux. */
  ax: number;
  ay: number;
  /** Extrémité B de la porte (côté cap + 90°), en mètres locaux. */
  bx: number;
  by: number;
  /** Vecteur unitaire du cap — donne le SENS obligatoire de franchissement. */
  headingX: number;
  headingY: number;
}

export interface LapDetectorState {
  // Configuration
  finishLineLat: number;
  finishLineLon: number;
  /** Mode rayon : rayon du disque. Mode porte : DEMI-LARGEUR de la porte. Mètres. */
  finishLineRadius: number;
  /** Cap de la piste au franchissement (degrés, 0 = nord). null → mode rayon. */
  finishLineHeadingDeg: number | null;
  /** Porte précalculée. null → mode rayon (repli). */
  gate: GateGeometry | null;
  /**
   * Distance minimale (m) à parcourir entre deux tours comptés. null → aucune
   * garde (circuit sans longueur renseignée), comportement historique.
   */
  minLapDistanceM: number | null;

  // État interne — mode rayon uniquement (inutilisés en mode porte)
  isInsideZone: boolean; // actuellement dans la zone d'arrivée
  enteredZoneAt: number | null; // timestamp ms d'entrée dans la zone

  // État interne — mode porte uniquement
  /** Dernier point reçu, en mètres locaux. null tant qu'aucun point n'est arrivé. */
  previousPointM: [number, number] | null;

  // Commun
  lastLapEndAt: number | null; // timestamp ms de fin du dernier tour
  /**
   * Odomètre depuis le dernier tour COMPTÉ (m). Alimenté à chaque point reçu,
   * dans les deux modes, et remis à zéro quand un tour est compté.
   */
  distanceSinceLapM: number;
  /**
   * Distance TOTALE de la séance (m). Même mesure que ci-dessus, mais elle ne
   * se remet JAMAIS à zéro : `distanceSinceLapM` repart à chaque tour compté et
   * ne peut donc pas servir de kilométrage de séance.
   *
   * `telemetry_sessions.distance_km` n'a jamais reçu de valeur jusqu'au
   * 13/08/2026 — la colonne existait, le bilan et la Saison la lisaient, et
   * elle valait `null` partout. La mesure était pourtant là, à la trame près.
   */
  distanceTotaleM: number;
  /** Dernier point reçu, en degrés — sert uniquement à l'odomètre. */
  lastOdoLat: number | null;
  lastOdoLon: number | null;
  /** Instant du dernier point reçu — base de temps de l'intégration en vitesse. */
  lastOdoAt: number | null;

  // Tours détectés (timestamps de fin de tour)
  lapEndTimestamps: number[];
}

const COOLDOWN_MS = 10000; // 10 sec minimum entre 2 tours

/**
 * Écart maximal admis entre deux points consécutifs pour évaluer un franchissement.
 *
 * À 25 Hz, un pas de temps vaut ~2,2 m à 200 km/h : le segment [précédent → courant]
 * est court et l'intersection est fiable. Après un TROU de données (reconnexion BLE,
 * perte de fix), les deux points encadrent plusieurs centaines de mètres et le segment
 * qui les relie n'est pas une trajectoire : il pourrait couper la porte sans que le
 * véhicule y soit passé. Au-delà de ce seuil on n'évalue donc PAS le franchissement.
 * Un tour manqué se voit ; un faux tour corrompt le bilan en silence.
 */
const MAX_STEP_M = 50;

/**
 * Sous cette vitesse, l'odomètre n'avance pas.
 *
 * La vitesse Doppler d'un boîtier à l'arrêt n'est pas exactement nulle — elle
 * oscille sous le km/h. Intégrée sur une journée elle finirait par franchir
 * n'importe quel seuil. 3 km/h est très au-dessus de ce plancher de bruit et
 * très en dessous de toute allure de roulage, fût-ce au pas dans la voie de
 * décélération.
 */
const ODO_SPEED_DEADBAND_KMH = 3;

/**
 * Au-delà de cet intervalle entre deux points, on cesse d'intégrer la vitesse :
 * il n'y a pas eu d'échantillon pendant l'intervalle, et prolonger la dernière
 * vitesse connue sur un trou de trente secondes inventerait des centaines de
 * mètres. On se rabat alors sur la corde entre les deux points.
 */
const ODO_MAX_DT_MS = 2_000;

const DEG_TO_RAD = Math.PI / 180;

/**
 * Projection locale équirectangulaire autour de la ligne d'arrivée : exacte à
 * cette échelle (quelques centaines de mètres). Même convention que
 * `src/circuit/__tests__/hauteSaintongeCalibration.test.ts`.
 */
function metersPerDegree(latDeg: number): { metersPerDegLat: number; metersPerDegLon: number } {
  const phi = latDeg * DEG_TO_RAD;
  return {
    metersPerDegLat: 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    metersPerDegLon: 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  };
}

function buildGate(lat: number, lon: number, halfWidthM: number, headingDeg: number): GateGeometry {
  const { metersPerDegLat, metersPerDegLon } = metersPerDegree(lat);
  const h = headingDeg * DEG_TO_RAD;
  // Cap 0° = nord, sens horaire → vecteur (sin, cos) dans le repère (est, nord).
  const headingX = Math.sin(h);
  const headingY = Math.cos(h);
  // La porte est perpendiculaire au cap (cap + 90°) : sin(h+90) = cos h, cos(h+90) = −sin h.
  const perpX = headingY;
  const perpY = -headingX;
  return {
    metersPerDegLat,
    metersPerDegLon,
    ax: -halfWidthM * perpX,
    ay: -halfWidthM * perpY,
    bx: halfWidthM * perpX,
    by: halfWidthM * perpY,
    headingX,
    headingY,
  };
}

export function createLapDetector(
  finishLineLat: number,
  finishLineLon: number,
  finishLineRadius: number = 30,
  /**
   * Cap de la piste au franchissement (degrés). Fourni → mode PORTE.
   * Absent/null/non fini → mode RAYON (repli rétrocompatible).
   */
  finishLineHeadingDeg: number | null = null,
  /**
   * Distance minimale (m) entre deux tours comptés. Absent/null/non fini/≤ 0 →
   * aucune garde, comportement historique strictement inchangé.
   */
  minLapDistanceM: number | null = null
): LapDetectorState {
  const headingDeg =
    typeof finishLineHeadingDeg === 'number' && Number.isFinite(finishLineHeadingDeg)
      ? finishLineHeadingDeg
      : null;

  return {
    finishLineLat,
    finishLineLon,
    finishLineRadius,
    finishLineHeadingDeg: headingDeg,
    gate:
      headingDeg === null
        ? null
        : buildGate(finishLineLat, finishLineLon, finishLineRadius, headingDeg),
    minLapDistanceM:
      typeof minLapDistanceM === 'number' && Number.isFinite(minLapDistanceM) && minLapDistanceM > 0
        ? minLapDistanceM
        : null,
    isInsideZone: false,
    enteredZoneAt: null,
    previousPointM: null,
    lastLapEndAt: null,
    distanceSinceLapM: 0,
    distanceTotaleM: 0,
    lastOdoLat: null,
    lastOdoLon: null,
    lastOdoAt: null,
    lapEndTimestamps: [],
  };
}

/**
 * Le franchissement a-t-il assez de distance à son actif ?
 *
 * Toujours vrai sans seuil, et toujours vrai pour le PREMIER franchissement —
 * celui-ci clôt l'outlap, dont la longueur ne dépend que de l'endroit où le
 * pilote a armé.
 */
function distanceSuffisante(state: LapDetectorState): boolean {
  if (state.minLapDistanceM === null) return true;
  if (state.lastLapEndAt === null) return true;
  return state.distanceSinceLapM >= state.minLapDistanceM;
}

/** Un tour est compté : on repart d'un odomètre vierge. */
function compterTour(state: LapDetectorState, timestamp: number): void {
  state.lastLapEndAt = timestamp;
  state.distanceSinceLapM = 0;
  state.lapEndTimestamps.push(timestamp);
}

/**
 * Avance l'odomètre d'un point. Appelé pour TOUS les points, y compris ceux
 * qu'un trou de données fera écarter de l'arbitrage : après une coupure le
 * véhicule a bien roulé, et ne pas le compter ferait refuser le tour suivant,
 * qui lui est réel.
 */
function accumulerOdometre(
  state: LapDetectorState,
  lat: number,
  lon: number,
  timestamp: number,
  speedKmh?: number
): void {
  const lastLat = state.lastOdoLat;
  const lastLon = state.lastOdoLon;
  const lastAt = state.lastOdoAt;
  state.lastOdoLat = lat;
  state.lastOdoLon = lon;
  state.lastOdoAt = timestamp;

  if (lastLat === null || lastLon === null || lastAt === null) return; // premier point

  const dtMs = timestamp - lastAt;
  const vitesseUtilisable =
    typeof speedKmh === 'number' && Number.isFinite(speedKmh) && speedKmh >= 0;

  if (vitesseUtilisable && dtMs > 0 && dtMs <= ODO_MAX_DT_MS) {
    // Régime nominal. La bande morte écarte le plancher de bruit du Doppler.
    const v = (speedKmh as number) < ODO_SPEED_DEADBAND_KMH ? 0 : (speedKmh as number);
    const avance = (v / 3.6) * (dtMs / 1000);
    state.distanceSinceLapM += avance;
    state.distanceTotaleM += avance;
    return;
  }

  // Vitesse absente, ou trou de données : la corde entre les deux points est la
  // seule estimation disponible, et elle MINORE la distance réellement
  // parcourue — le bon sens de l'erreur pour une garde qui ne doit jamais
  // refuser un tour réel.
  const corde = haversineDistance(lastLat, lastLon, lat, lon);
  state.distanceSinceLapM += corde;
  state.distanceTotaleM += corde;
}

/** Produit vectoriel 2D (composante z). */
function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * Le pas [prev → curr] coupe-t-il le segment de porte ?
 *
 * Paramétrage : prev + t·(curr−prev) = A + u·(B−A), franchissement si
 * t ∈ ]0,1] et u ∈ [0,1]. La borne t = 0 est exclue pour qu'un point posé
 * exactement SUR la porte ne soit pas recompté au pas suivant.
 */
function crossesGate(prev: [number, number], curr: [number, number], gate: GateGeometry): boolean {
  const rx = curr[0] - prev[0];
  const ry = curr[1] - prev[1];
  const sx = gate.bx - gate.ax;
  const sy = gate.by - gate.ay;

  const denom = cross(rx, ry, sx, sy);
  // Trajectoire parallèle à la porte (ou pas immobile) : pas de franchissement franc.
  // Dans le doute, on ne compte pas.
  if (denom === 0) return false;

  const qpx = gate.ax - prev[0];
  const qpy = gate.ay - prev[1];
  const t = cross(qpx, qpy, sx, sy) / denom;
  const u = cross(qpx, qpy, rx, ry) / denom;

  return t > 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Mode PORTE — franchissement du segment, dans le sens du cap. */
function processGateCrossing(
  state: LapDetectorState,
  gate: GateGeometry,
  lat: number,
  lon: number,
  timestamp: number
): boolean {
  const curr: [number, number] = [
    (lon - state.finishLineLon) * gate.metersPerDegLon,
    (lat - state.finishLineLat) * gate.metersPerDegLat,
  ];
  const prev = state.previousPointM;
  // Le point courant devient la référence du pas suivant, quoi qu'il advienne
  // ci-dessous : un pas écarté ne doit pas allonger indéfiniment le suivant.
  state.previousPointM = curr;

  if (prev === null) return false; // premier point : aucun pas à évaluer

  const dx = curr[0] - prev[0];
  const dy = curr[1] - prev[1];

  // Trou de données : le segment ne représente pas une trajectoire (cf. MAX_STEP_M).
  if (dx * dx + dy * dy > MAX_STEP_M * MAX_STEP_M) return false;

  // SENS OBLIGATOIRE : seul un franchissement dans le sens du cap compte. Une
  // voiture qui recule, ou qui franchit la porte à contresens (retour stands,
  // manœuvre), ne boucle pas un tour.
  if (dx * gate.headingX + dy * gate.headingY <= 0) return false;

  if (!crossesGate(prev, curr, gate)) return false;

  // Cooldown : anti-double-comptage (même règle qu'en mode rayon).
  if (state.lastLapEndAt !== null && timestamp - state.lastLapEndAt < COOLDOWN_MS) {
    return false;
  }

  // Garde de distance : on ne boucle pas un circuit sans le parcourir.
  if (!distanceSuffisante(state)) return false;

  compterTour(state, timestamp);
  return true;
}

/** Mode RAYON — comportement historique, inchangé (repli sans cap). */
function processRadiusZone(
  state: LapDetectorState,
  lat: number,
  lon: number,
  timestamp: number
): boolean {
  // Distance à la ligne d'arrivée
  const distance = haversineDistance(lat, lon, state.finishLineLat, state.finishLineLon);

  const isCurrentlyInside = distance < state.finishLineRadius;

  // Transition : entrée dans la zone
  if (isCurrentlyInside && !state.isInsideZone) {
    state.isInsideZone = true;
    state.enteredZoneAt = timestamp;

    // Vérifier le cooldown
    if (state.lastLapEndAt !== null) {
      const sinceLastLap = timestamp - state.lastLapEndAt;
      if (sinceLastLap < COOLDOWN_MS) {
        // Trop tôt, on ignore
        return false;
      }
    }

    // Garde de distance : même règle qu'en mode porte (un véhicule immobile
    // dans le disque n'entre et ne sort qu'au gré de la dérive du GPS).
    if (!distanceSuffisante(state)) return false;

    // C'est un nouveau passage → fin du tour précédent (si tour en cours)
    compterTour(state, timestamp);
    return true;
  }

  // Transition : sortie de la zone
  if (!isCurrentlyInside && state.isInsideZone) {
    state.isInsideZone = false;
    state.enteredZoneAt = null;
  }

  return false;
}

/**
 * Traite une nouvelle position GPS
 * @returns true si un tour vient d'être complété
 */
export function processGpsPoint(
  state: LapDetectorState,
  lat: number,
  lon: number,
  timestamp: number,
  /**
   * Vitesse instantanée (km/h) mesurée par le boîtier. Fournie → l'odomètre
   * l'intègre, et un véhicule à l'arrêt n'avance pas. Absente → repli sur la
   * distance entre points, qui confond le bruit du GPS avec du mouvement (cf.
   * l'en-tête). Le flux BLE la fournit toujours.
   */
  speedKmh?: number
): boolean {
  /**
   * `!lat || !lon` REJETTE AUSSI LE ZÉRO EXACT — et c'est délibéré.
   *
   * Une latitude ou une longitude exactement nulle désigne le point (0,0), au
   * large du golfe de Guinée : c'est la valeur qu'un boîtier rend AVANT son
   * premier fix, jamais une position réelle sur un circuit. La confondre avec
   * une position ferait entrer un point à des milliers de kilomètres dans
   * l'odomètre et dans l'évaluation du franchissement.
   *
   * Le coût théorique — un circuit posé sur l'équateur ou le méridien de
   * Greenwich au mètre près — n'existe pas ; celui d'accepter le point nul se
   * paierait à chaque démarrage.
   */
  if (!lat || !lon) return false;

  accumulerOdometre(state, lat, lon, timestamp, speedKmh);

  if (state.gate !== null) {
    return processGateCrossing(state, state.gate, lat, lon, timestamp);
  }
  return processRadiusZone(state, lat, lon, timestamp);
}

/**
 * Avance l'odomètre SANS évaluer de franchissement.
 *
 * ── POURQUOI CETTE PORTE SÉPARÉE (13/08/2026) ────────────────────────────────
 *
 * `lapDetectionRunner` écarte les trames sous `Fix3D` AVANT d'appeler
 * `processGpsPoint` : elles n'atteignaient donc pas l'odomètre. Or un fix 2D
 * porte une position ET une vitesse Doppler parfaitement exploitables — le
 * véhicule roule, et le compteur de distance restait immobile.
 *
 * Conséquence : après une zone de mauvaise réception, la garde de distance
 * minimale voyait moins de kilomètres que la réalité et pouvait refuser un tour
 * VRAI. On alimente donc l'odomètre pour toutes les trames, et on réserve
 * l'arbitrage du franchissement à celles qui portent un fix complet.
 *
 * Ce qui n'est délibérément PAS fait ici : toucher à `previousPointM`. Le pas
 * évalué au prochain fix 3D doit relier deux positions de bonne qualité, pas
 * s'appuyer sur une position dégradée.
 */
export function avancerOdometre(
  state: LapDetectorState,
  lat: number,
  lon: number,
  timestamp: number,
  speedKmh?: number
): void {
  if (!lat || !lon) return;
  accumulerOdometre(state, lat, lon, timestamp, speedKmh);
}

/**
 * Réinitialise le détecteur (à la fin d'une session)
 */
export function resetLapDetector(state: LapDetectorState): void {
  state.isInsideZone = false;
  state.enteredZoneAt = null;
  state.previousPointM = null;
  state.lastLapEndAt = null;
  state.distanceSinceLapM = 0;
  state.distanceTotaleM = 0;
  state.lastOdoLat = null;
  state.lastOdoLon = null;
  state.lastOdoAt = null;
  state.lapEndTimestamps = [];
}

/**
 * Format un temps au tour en mm:ss.SSS
 */
export function formatLapTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const min = Math.floor(totalMs / 60000);
  const sec = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${min}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Format un delta de temps : +5.234s ou -1.123s
 */
export function formatLapDelta(seconds: number): string {
  const abs = Math.abs(seconds);
  const sign = seconds >= 0 ? '+' : '-';
  return `${sign}${abs.toFixed(3)}s`;
}
