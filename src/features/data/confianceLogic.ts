/**
 * CONFIANCE PAR ZONE — la qualité de mesure, zone par zone du tour. Logique PURE.
 *
 * M03+ : un tour n'est pas mesuré uniformément. Le GPS se dégrade sous les
 * arbres du fond de circuit, la liaison BLE perd des trames dans une poche
 * radio, la fréquence réelle décroche des 25 Hz nominaux. Un score de
 * confiance GLOBAL moyenne tout cela et cache l'essentiel : OÙ la lecture est
 * solide, et où elle ne l'est pas.
 *
 * Ce module découpe le tour en zones de distance et rend, pour chacune, un
 * niveau de confiance de mesure ('haute' | 'moyenne' | 'faible') accompagné de
 * ses MOTIFS. Jamais une note seule : un score opaque n'apprend rien et ne se
 * conteste pas. Chaque note dit pourquoi.
 *
 * ===========================================================================
 * TROIS RÈGLES D'HONNÊTETÉ
 * ===========================================================================
 *
 * 1. **Un canal absent n'est pas un canal dégradé.** Une trame sans pdop ne
 *    compte ni pour ni contre : elle est inconnue. Mais quand une zone entière
 *    n'a AUCUN canal de qualité renseigné, la note ne peut pas être 'haute' —
 *    on ne certifie pas ce qu'on n'a pas pu vérifier.
 *
 * 2. **Une zone sans trame n'a pas de note.** Son niveau est `null`, avec le
 *    motif qui le dit. Lui donner 'faible' confondrait « mal mesuré » et
 *    « pas mesuré du tout ». Sa couverture, elle, vaut 0 — c'est un vrai
 *    zéro : rien n'a été couvert, et cela se mesure.
 *
 * 3. **Les trames se trient sur `elapsed_ms`, jamais sur l'ordre d'arrivée.**
 *    `telemetry_frames.created_at` est un ordre d'INSERTION (piège documenté
 *    du dépôt) : le tri est refait ici, systématiquement.
 *
 * ===========================================================================
 * LA COUVERTURE, TELLE QU'ELLE SE MESURE ICI
 * ===========================================================================
 *
 * Deux trames exploitables consécutives dans le temps, sans trou de liaison
 * entre elles, couvrent le segment de distance qui les sépare. La couverture
 * d'une zone est l'UNION de ces petits segments, rapportée à la longueur de la
 * zone — jamais leur somme (deux recouvrements donneraient plus de 100 %), et
 * jamais un remplissage : un trou de liaison casse la chaîne, et une zone dont
 * seules les extrémités sont mesurées reste une zone à moitié couverte.
 */

// ===========================================================================
// Seuils — conventions nommées, À VALIDER SUR PISTE (le cahier l'exige).
// Aucun de ces chiffres n'est une mesure : ce sont des choix de lecture,
// remplaçables dès qu'une campagne sur circuit dira mieux.
// ===========================================================================

/** Version du calcul — à incrémenter à chaque changement de seuil ou de méthode. */
export const VERSION_CONFIANCE_ZONE = '1.0.0';

/** Fréquence nominale du RaceBox Mini, en Hz (décision fondateur : 25 Hz). */
export const FREQUENCE_NOMINALE_HZ = 25;

/** Période nominale entre deux trames, en ms (1000 / 25). */
export const PERIODE_NOMINALE_MS = 1000 / FREQUENCE_NOMINALE_HZ;

/**
 * Au-delà de cet écart entre deux trames consécutives, c'est un TROU de
 * liaison, plus une simple gigue. 2,5 périodes nominales : une trame perdue
 * isolée (2 périodes) passe encore, deux d'affilée non. À valider sur piste.
 */
export const SEUIL_TROU_MS = 2.5 * PERIODE_NOMINALE_MS;

/** hAcc (gps_accuracy_m) au-delà duquel la précision GPS est dite dégradée. À valider sur piste. */
export const SEUIL_HACC_DEGRADE_M = 5;

/** PDOP au-delà duquel la géométrie satellitaire est dite défavorable. À valider sur piste. */
export const SEUIL_PDOP_DEGRADE = 4;

/** En deçà de ce nombre de satellites, la constellation est dite insuffisante. À valider sur piste. */
export const SEUIL_SATELLITES_MIN = 8;

/**
 * Part de trames dégradées (parmi les trames dont au moins un canal de
 * qualité est renseigné) au-delà de laquelle la zone tombe à 'faible'.
 * À valider sur piste.
 */
export const SEUIL_PART_DEGRADEE_FAIBLE = 0.5;

/** Couverture (en %) en deçà de laquelle la zone tombe à 'faible'. À valider sur piste. */
export const SEUIL_COUVERTURE_FAIBLE_PCT = 50;

/** Couverture (en %) exigée pour que la zone puisse être 'haute'. À valider sur piste. */
export const SEUIL_COUVERTURE_HAUTE_PCT = 90;

/**
 * Fréquence observée en deçà de laquelle le décrochage vaut motif, en
 * fraction du nominal (0,8 × 25 Hz = 20 Hz). À valider sur piste.
 */
export const SEUIL_FREQUENCE_BASSE_FRACTION = 0.8;

/** Nombre minimal de trames pour qu'une fréquence observée soit dérivable. */
export const MIN_TRAMES_POUR_FREQUENCE = 5;

/** Découpage par défaut du tour, en nombre de zones. À valider sur piste. */
export const NB_ZONES_DEFAUT = 10;

// ===========================================================================
// Types
// ===========================================================================

export type NiveauConfiance = 'haute' | 'moyenne' | 'faible';

/**
 * Le strict nécessaire d'une trame pour être jugée — colonnes réelles de
 * `telemetry_frames`. Tout canal peut manquer : `null` vaut « non mesuré »,
 * jamais « mauvais ».
 */
export interface TrameQualite {
  /** Horloge de la capture, en ms — LA clé de tri (jamais l'ordre d'insertion). */
  elapsedMs: number;
  /**
   * Position curviligne dans le tour, en mètres (dérivée en amont, ∫ v dt).
   * `null` quand elle n'est pas dérivable — la trame est alors non située.
   */
  distanceM: number | null;
  /** `gps_accuracy_m` (hAcc), en mètres. */
  gpsAccuracyM: number | null;
  /** `pdop` — dilution de précision de la géométrie satellitaire. */
  pdop: number | null;
  /** `satellites` — satellites utilisés dans la solution. */
  satellites: number | null;
  /** `fix_valid` — validité du fix annoncée par le boîtier. */
  fixValid: boolean | null;
}

/** Une zone du tour, en distance curviligne. */
export interface ZoneDistance {
  /** Début de la zone, en mètres, inclus. */
  debutM: number;
  /** Fin de la zone, en mètres, exclue (incluse pour la dernière zone du découpage). */
  finM: number;
  /** Nom affichable (« Z3 »), jamais inventé au-delà. */
  nom: string;
}

export interface ConfianceZone {
  zone: ZoneDistance;
  /** `null` quand la zone n'a aucune trame : non mesurée, pas mal mesurée. */
  niveau: NiveauConfiance | null;
  /** Les causes, factuelles et comptées. Jamais une note sans ses motifs. */
  motifs: string[];
  /** Part de la zone couverte par des trames exploitables, en % (union, pas somme). */
  couverturePct: number;
  /** Trames situées dans la zone. */
  nbTrames: number;
  /** Trous de liaison observés dans la zone (écarts > SEUIL_TROU_MS). */
  nbTrous: number;
  /** Fréquence observée, en Hz — `null` quand trop peu de trames pour la dériver. */
  frequenceHzObservee: number | null;
}

export interface ConfianceTour {
  version: string;
  /** Agrégat : la pire des zones mesurées. Une chaîne vaut son maillon le plus fragile. */
  confiance: NiveauConfiance;
  zones: ConfianceZone[];
  /** Motifs agrégés du tour (zones sans trame, trames non situées…). */
  motifs: string[];
  /** Couverture du tour : moyenne des couvertures de zone, pondérée par leur longueur. */
  couverturePct: number;
  /** Trames écartées faute de position dérivable — à annoncer, jamais à taire. */
  tramesNonSituees: number;
}

// ===========================================================================
// Découpage
// ===========================================================================

/**
 * Découpe le tour en zones de distance égales, nommées « Z1 » … « Zn ».
 *
 * Rend `[]` si la longueur n'est pas exploitable : un découpage de rien
 * n'existe pas, et le rendre vide vaut mieux qu'inventer des bornes.
 */
export function decouperZones(
  longueurTourM: number,
  nbZones: number = NB_ZONES_DEFAUT
): ZoneDistance[] {
  if (!Number.isFinite(longueurTourM) || longueurTourM <= 0) return [];
  if (!Number.isInteger(nbZones) || nbZones <= 0) return [];

  const pas = longueurTourM / nbZones;
  const zones: ZoneDistance[] = [];
  for (let i = 0; i < nbZones; i++) {
    zones.push({
      debutM: i * pas,
      finM: i === nbZones - 1 ? longueurTourM : (i + 1) * pas,
      nom: `Z${i + 1}`,
    });
  }
  return zones;
}

// ===========================================================================
// Évaluation d'une zone
// ===========================================================================

/** Formatage français d'une fréquence : « 12,5 Hz ». */
function formatHz(hz: number): string {
  return `${hz.toFixed(1).replace('.', ',')} Hz`;
}

function estSituee(t: TrameQualite): t is TrameQualite & { distanceM: number } {
  return typeof t.distanceM === 'number' && Number.isFinite(t.distanceM);
}

/** La trame appartient-elle à la zone ? Fin exclue, sauf pour fermer le tour. */
function dansZone(d: number, zone: ZoneDistance, finIncluse: boolean): boolean {
  return d >= zone.debutM && (finIncluse ? d <= zone.finM : d < zone.finM);
}

/**
 * Une trame est EXPLOITABLE pour la couverture tant que le boîtier ne déclare
 * pas son fix invalide. Un `fix_valid` absent n'invalide pas : inconnu n'est
 * pas mauvais — mais il ne certifie rien non plus (voir canaux absents).
 */
function estExploitable(t: TrameQualite): boolean {
  return t.fixValid !== false;
}

interface CompteurCanal {
  mesurees: number;
  degradees: number;
}

function compter(
  trames: readonly TrameQualite[],
  valeur: (t: TrameQualite) => number | null,
  degradee: (v: number) => boolean
): CompteurCanal {
  let mesurees = 0;
  let degradees = 0;
  for (const t of trames) {
    const v = valeur(t);
    if (typeof v === 'number' && Number.isFinite(v)) {
      mesurees++;
      if (degradee(v)) degradees++;
    }
  }
  return { mesurees, degradees };
}

/**
 * Évalue une zone. Le niveau ne sort JAMAIS sans ses motifs : une note sans
 * cause ne se vérifie pas, donc ne se corrige pas.
 *
 * `finIncluse` : passer `true` pour la dernière zone du tour, afin que la
 * trame posée exactement sur la longueur totale ne tombe dans aucun trou.
 */
export function evaluerZone(
  trames: readonly TrameQualite[],
  zone: ZoneDistance,
  finIncluse = false
): ConfianceZone {
  const longueurZone = zone.finM - zone.debutM;
  if (!Number.isFinite(longueurZone) || longueurZone <= 0) {
    return {
      zone,
      niveau: null,
      motifs: ['zone sans étendue (début ≥ fin) — rien à évaluer'],
      couverturePct: 0,
      nbTrames: 0,
      nbTrous: 0,
      frequenceHzObservee: null,
    };
  }

  // Tri sur elapsed_ms, systématique — created_at est un ordre d'insertion.
  const dansLaZone = trames
    .filter(estSituee)
    .filter((t) => dansZone(t.distanceM, zone, finIncluse))
    .sort((a, b) => a.elapsedMs - b.elapsedMs);

  if (dansLaZone.length === 0) {
    return {
      zone,
      niveau: null,
      motifs: ['aucune trame dans cette zone'],
      couverturePct: 0,
      nbTrames: 0,
      nbTrous: 0,
      frequenceHzObservee: null,
    };
  }

  const motifs: string[] = [];

  // ---- Trous de liaison et couverture ------------------------------------
  let nbTrous = 0;
  const deltas: number[] = [];
  let couvertM = 0;
  for (let i = 1; i < dansLaZone.length; i++) {
    const avant = dansLaZone[i - 1];
    const apres = dansLaZone[i];
    const dt = apres.elapsedMs - avant.elapsedMs;
    if (dt <= 0) continue; // doublon d'horloge — sans étendue, sans trou
    deltas.push(dt);
    if (dt > SEUIL_TROU_MS) {
      nbTrous++;
      continue; // un trou ne couvre rien
    }
    if (estExploitable(avant) && estExploitable(apres)) {
      // Distances triées par le temps d'un tour : l'écart absolu suffit.
      couvertM += Math.abs(apres.distanceM - avant.distanceM);
    }
  }
  const couverturePct = Math.min(100, (couvertM / longueurZone) * 100);

  if (nbTrous > 0) {
    motifs.push(`trous de liaison (${nbTrous})`);
  }
  if (couverturePct < SEUIL_COUVERTURE_HAUTE_PCT) {
    motifs.push(`couverture partielle de la zone (${Math.round(couverturePct)} %)`);
  }

  // ---- Fréquence observée --------------------------------------------------
  let frequenceHzObservee: number | null = null;
  if (dansLaZone.length >= MIN_TRAMES_POUR_FREQUENCE && deltas.length > 0) {
    // Médiane des écarts : un trou isolé ne doit pas tirer la fréquence vers le bas.
    const tries = [...deltas].sort((a, b) => a - b);
    const m = tries.length;
    const medianeDt = m % 2 === 1 ? tries[(m - 1) / 2] : (tries[m / 2 - 1] + tries[m / 2]) / 2;
    if (medianeDt > 0) {
      frequenceHzObservee = 1000 / medianeDt;
      if (frequenceHzObservee < FREQUENCE_NOMINALE_HZ * SEUIL_FREQUENCE_BASSE_FRACTION) {
        motifs.push(
          `fréquence observée ${formatHz(frequenceHzObservee)} au lieu de ${FREQUENCE_NOMINALE_HZ} Hz nominaux`
        );
      }
    }
  }

  // ---- Canaux de qualité ---------------------------------------------------
  const hAcc = compter(
    dansLaZone,
    (t) => t.gpsAccuracyM,
    (v) => v > SEUIL_HACC_DEGRADE_M
  );
  const pdop = compter(
    dansLaZone,
    (t) => t.pdop,
    (v) => v > SEUIL_PDOP_DEGRADE
  );
  const sats = compter(
    dansLaZone,
    (t) => t.satellites,
    (v) => v < SEUIL_SATELLITES_MIN
  );
  const fixInvalides = dansLaZone.filter((t) => t.fixValid === false).length;
  const fixMesures = dansLaZone.filter((t) => t.fixValid !== null).length;

  if (hAcc.degradees > 0) {
    motifs.push(
      `précision GPS dégradée (hAcc > ${SEUIL_HACC_DEGRADE_M} m sur ${hAcc.degradees} des ${hAcc.mesurees} trames mesurées)`
    );
  }
  if (pdop.degradees > 0) {
    motifs.push(
      `géométrie satellitaire défavorable (PDOP > ${SEUIL_PDOP_DEGRADE} sur ${pdop.degradees} des ${pdop.mesurees} trames mesurées)`
    );
  }
  if (sats.degradees > 0) {
    motifs.push(
      `satellites insuffisants (moins de ${SEUIL_SATELLITES_MIN} sur ${sats.degradees} des ${sats.mesurees} trames mesurées)`
    );
  }
  if (fixInvalides > 0) {
    motifs.push(`fix GPS non valide (${fixInvalides} trames)`);
  }

  const canauxMesures = hAcc.mesurees + pdop.mesurees + sats.mesurees + fixMesures;
  const aucunCanal = canauxMesures === 0;
  if (aucunCanal) {
    motifs.push('canaux de qualité non renseignés — note plafonnée, rien à certifier');
  }

  // ---- Niveau -------------------------------------------------------------
  // Part de trames dégradées, parmi celles où au moins un canal est renseigné.
  let tramesAvecCanal = 0;
  let tramesDegradees = 0;
  for (const t of dansLaZone) {
    const aUnCanal =
      t.gpsAccuracyM != null || t.pdop != null || t.satellites != null || t.fixValid != null;
    if (!aUnCanal) continue;
    tramesAvecCanal++;
    const degradee =
      (t.gpsAccuracyM != null && t.gpsAccuracyM > SEUIL_HACC_DEGRADE_M) ||
      (t.pdop != null && t.pdop > SEUIL_PDOP_DEGRADE) ||
      (t.satellites != null && t.satellites < SEUIL_SATELLITES_MIN) ||
      t.fixValid === false;
    if (degradee) tramesDegradees++;
  }
  const partDegradee = tramesAvecCanal > 0 ? tramesDegradees / tramesAvecCanal : null;

  let niveau: NiveauConfiance;
  if (
    couverturePct < SEUIL_COUVERTURE_FAIBLE_PCT ||
    (partDegradee !== null && partDegradee > SEUIL_PART_DEGRADEE_FAIBLE)
  ) {
    niveau = 'faible';
  } else if (motifs.length > 0) {
    niveau = 'moyenne';
  } else {
    niveau = 'haute';
  }

  return {
    zone,
    niveau,
    motifs,
    couverturePct,
    nbTrames: dansLaZone.length,
    nbTrous,
    frequenceHzObservee,
  };
}

// ===========================================================================
// Agrégat par tour
// ===========================================================================

const RANG: Record<NiveauConfiance, number> = { faible: 0, moyenne: 1, haute: 2 };

/** Le plus fragile des deux niveaux. */
export function pireNiveau(a: NiveauConfiance, b: NiveauConfiance): NiveauConfiance {
  return RANG[a] <= RANG[b] ? a : b;
}

/**
 * Évalue le tour entier, zone par zone.
 *
 * L'agrégat est LA PIRE des zones mesurées — jamais une moyenne : une moyenne
 * laisserait une zone aveugle se cacher derrière neuf zones propres, et c'est
 * précisément ce que ce module existe pour empêcher. Une zone sans trame ne
 * vote pas (elle n'a pas de note), mais elle pèse : son absence est un motif
 * du tour, et sa couverture nulle tire la couverture globale vers le bas.
 *
 * Sans aucune zone mesurée, l'agrégat vaut 'faible' : la confiance dans la
 * mesure est le seul objet de ce score, et l'absence totale de mesure est,
 * factuellement, le cas où cette confiance est la plus basse.
 */
export function evaluerConfianceTour(
  trames: readonly TrameQualite[],
  zones: readonly ZoneDistance[]
): ConfianceTour {
  const tramesNonSituees = trames.filter((t) => !estSituee(t)).length;

  const evaluations = zones.map((zone, i) => evaluerZone(trames, zone, i === zones.length - 1));

  const motifs: string[] = [];

  const zonesSansTrame = evaluations.filter((z) => z.niveau === null).length;
  if (zonesSansTrame > 0) {
    motifs.push(`${zonesSansTrame} zone(s) sans trame`);
  }
  if (tramesNonSituees > 0) {
    motifs.push(`${tramesNonSituees} trame(s) sans position dérivable, écartée(s)`);
  }

  let confiance: NiveauConfiance | null = null;
  for (const z of evaluations) {
    if (z.niveau === null) continue;
    confiance = confiance === null ? z.niveau : pireNiveau(confiance, z.niveau);
  }
  if (confiance === null) {
    confiance = 'faible';
    motifs.push('aucune zone mesurée');
  } else if (confiance !== 'haute') {
    motifs.push('au moins une zone en confiance réduite — voir ses motifs');
  }

  // Couverture globale : pondérée par la longueur des zones, zones vides comprises
  // (leur 0 est un vrai zéro : rien n'y a été couvert).
  let longueurTotale = 0;
  let couvertPondere = 0;
  for (const z of evaluations) {
    const l = Math.max(0, z.zone.finM - z.zone.debutM);
    longueurTotale += l;
    couvertPondere += l * z.couverturePct;
  }
  const couverturePct = longueurTotale > 0 ? couvertPondere / longueurTotale : 0;

  return {
    version: VERSION_CONFIANCE_ZONE,
    confiance,
    zones: evaluations,
    motifs,
    couverturePct,
    tramesNonSituees,
  };
}
