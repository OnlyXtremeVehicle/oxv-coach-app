/**
 * VALIDATION DES TOURS — module M05 (« Tableau des tours »). Logique PURE.
 * Sans React, sans react-native, sans Supabase : testable seule (ts-jest, node).
 *
 * ===========================================================================
 * LE CŒUR : LA MACHINE NE DÉCLARE PAS, ELLE DOUTE À VOIX HAUTE
 * ===========================================================================
 *
 * Un tour lent peut l'être pour dix raisons. Une voiture devant. Un drapeau
 * agité au poste 4. Un freinage manqué. Un essai de trajectoire. Une mesure
 * qui a décroché. Aucune de ces causes n'est LISIBLE dans les données d'un
 * boîtier GPS posé sur un pare-brise.
 *
 * Ce module ne les infère donc JAMAIS. Il ne prononce ni « trafic » ni
 * « drapeau » : ces mots-là désignent une cause, et la cause appartient à
 * quelqu'un qui était dans la voiture. Le module rend un classement à trois
 * valeurs — `propre`, `hors_chrono`, `suspect` — et, pour chaque marque, le
 * FAIT chiffré qui l'a produite : « 8,4 s au-dessus de la médiane des tours
 * propres », « arrêt observé (vitesse sous 5 km/h) ». Le pilote ou le coach
 * lit le fait et tranche la cause. C'est la déclaration humaine qui nomme le
 * trafic, pas l'algorithme.
 *
 * Le cahier de veille l'exige mot pour mot : « employer suspect puis
 * confirmer », et « chaque inclusion/exclusion conserve un motif audité ».
 * D'où la règle de sortie : aucune marque sans son fait, aucun tour écarté
 * sans sa marque.
 *
 * ===========================================================================
 * POURQUOI UNE DÉTECTION ROBUSTE, ET DANS LES DEUX SENS
 * ===========================================================================
 *
 * L'écart se mesure à la MÉDIANE des tours candidats propres, et se compare à
 * leur écart absolu médian (MAD) — pas à une moyenne et un écart-type. Une
 * séance porte par nature quelques tours gâchés : moyenne et écart-type s'en
 * nourrissent et finissent par trouver tout normal. La médiane et le MAD, non.
 *
 * Et l'écart se regarde DANS LES DEUX SENS. Un tour anormalement RAPIDE est
 * tout aussi douteux qu'un tour anormalement lent : une mesure trouée, un
 * franchissement mal détecté ou un raccourci produisent un chrono flatteur qui
 * n'a jamais été roulé. Ne surveiller que le côté lent reviendrait à valider
 * d'office les chiffres qui font plaisir.
 *
 * ===========================================================================
 * CE QUE `hors_chrono` VEUT DIRE
 * ===========================================================================
 *
 * `hors_chrono` couvre deux situations qui ont la même conséquence : le tour
 * ne peut pas servir de référence. Soit il n'a pas de temps exploitable, soit
 * c'est un tour de stands (sortie ou rentrée), qui n'est pas un tour roulé.
 * Un tour `hors_chrono` peut malgré tout porter d'autres faits — un arrêt, une
 * mesure trouée : un fait reste un fait, et le tableau le montre.
 *
 * ===========================================================================
 * CE QUI N'EST PAS ICI
 * ===========================================================================
 *
 * La marque MANUELLE — le tour que le pilote ou le coach déclare gêné, ou
 * choisit comme représentatif — n'est pas écrite par ce module, et n'a à ce
 * jour aucune place en base : `laps` ne porte que `is_outlap`, `is_inlap` et
 * `is_best_lap`, trois booléens calculés, sans colonne de motif ni de tag.
 * Ce module reste donc en LECTURE automatique : il propose une référence et
 * dit ses réserves. Confirmer ou infirmer demandera une décision de schéma.
 */

import type { TourSession } from './progressionLogic';

// ===========================================================================
// Seuils — conventions nommées, À VALIDER SUR PISTE.
// Aucun de ces chiffres n'est une mesure : ce sont des choix de lecture,
// remplaçables dès qu'une campagne sur circuit dira mieux.
// ===========================================================================

/** Estampille du calcul : toute évolution de méthode est un changement tracé. */
export const VERSION_VALIDATION_TOURS = 'validation-tours-1.0.0';

/**
 * Sous cette vitesse minimale relevée dans le tour, on parle d'ARRÊT observé.
 * 5 km/h : au-dessus, une voiture roule encore, même au pas. À valider sur piste.
 */
export const SEUIL_ARRET_KMH = 5;

/**
 * Durée cumulée de trous de mesure tolérée dans un tour, en millisecondes.
 * Un demi-tour de roue de mesure manquante ne change pas un chrono ; une
 * demi-seconde, si. À valider sur piste.
 */
export const SEUIL_TROUS_TOLERES_MS = 500;

/**
 * Nombre de tours candidats propres exigé avant de prononcer un écart net.
 * En deçà, « ce qui est normal » n'est pas établi : aucune marque d'écart
 * n'est émise plutôt qu'une marque devinée. À valider sur piste.
 */
export const MIN_TOURS_BASE_ECART = 4;

/**
 * Nombre d'écarts absolus médians au-delà duquel l'écart est dit NET.
 * 3 MAD normalisés ≈ 3 écarts-types d'une distribution régulière : un tour
 * sur des centaines, pas un tour sur dix. À valider sur piste.
 */
export const FACTEUR_MAD_ECART = 3;

/**
 * Facteur qui met l'écart absolu médian à l'échelle d'un écart-type sur une
 * distribution normale (constante usuelle 1/Φ⁻¹(3/4) ≈ 1,4826).
 */
export const NORMALISATION_MAD = 1.4826;

/**
 * Plancher de l'écart net, en millisecondes. Un pilote très régulier a un MAD
 * de quelques dixièmes : sans plancher, un tour à 0,5 s de la médiane serait
 * déclaré suspect à chaque séance, et « suspect » ne voudrait plus rien dire.
 * À valider sur piste.
 */
export const PLANCHER_ECART_MS = 1500;

// ===========================================================================
// Types
// ===========================================================================

/**
 * Ce qu'un tour doit porter pour être jugé. Le contrat de base — `index`,
 * `tempsMs`, `valide`, `tags` — est celui que la détection amont expose déjà
 * (`TourSession`, module M06) : on l'ÉTEND, on ne le duplique pas.
 *
 * Les deux ajouts sont des mesures, pas des jugements, et valent `null` quand
 * elles n'ont pas pu être relevées — jamais un zéro fabriqué : un `0` de
 * `trousMesureMs` affirme « mesure continue », ce qui est une tout autre
 * information que « on ne sait pas ».
 */
export interface TourMesure extends TourSession {
  /** Vitesse minimale relevée sur le tour, en km/h. `null` = non relevée. */
  vitesseMiniKmh: number | null;
  /** Durée cumulée des trous de mesure du tour, en ms. `null` = non mesurée. */
  trousMesureMs: number | null;
}

export type ClassementTour = 'propre' | 'hors_chrono' | 'suspect';

export type CodeMarque =
  | 'sortie_stands'
  | 'rentree_stands'
  | 'arret_en_piste'
  | 'ecart_net'
  | 'mesure_trouee'
  | 'non_chronometre';

/** Une marque, et le FAIT chiffré qui l'a produite. Jamais l'un sans l'autre. */
export interface MarqueTour {
  code: CodeMarque;
  /** Constat en français, chiffré quand un chiffre existe. Jamais une cause. */
  fait: string;
}

export interface TourEvalue {
  index: number;
  classement: ClassementTour;
  marques: MarqueTour[];
}

export interface ReferenceTour {
  index: number;
  tempsMs: number;
  /**
   * Réserve factuelle quand le meilleur temps BRUT de la séance n'est pas la
   * référence proposée. `null` quand les deux coïncident — rien à réserver.
   */
  reserve: string | null;
}

export interface ValidationTours {
  version: string;
  /** Un verdict par tour reçu, dans l'ordre d'entrée. */
  tours: TourEvalue[];
  /** Index des tours classés `propre`, croissants. */
  toursPropres: number[];
  /**
   * Référence proposée : le meilleur tour PROPRE. `null` quand aucun tour
   * n'est propre — la séance n'a alors pas de référence, et le dire vaut
   * mieux que désigner d'office le moins mauvais.
   */
  reference: ReferenceTour | null;
  /**
   * LA BASE SUR LAQUELLE L'ÉCART SE MESURE — et pourquoi il se tait.
   *
   * Un écart net se mesure contre la médiane des tours PROPRES. En dessous de
   * `MIN_TOURS_BASE_ECART`, cette médiane ne veut rien dire, et la boucle qui
   * pose `ecart_net` n'est jamais atteinte.
   *
   * Le refus est juste ; le SILENCE ne l'était pas. Sur la séance de référence,
   * un tour à +32,9 s de ses voisins ne portait aucune marque, et rien à
   * l'écran ne disait pourquoi — le pilote lisait une absence d'écart là où il
   * y avait une absence de base. C'est la règle des cinq états : un état fermé
   * nomme ce qui manque.
   */
  baseEcart: BaseEcart;
}

/** De quoi dire, à l'écran, si l'écart a pu se mesurer. */
export interface BaseEcart {
  /** Tours propres retenus pour la médiane. */
  tours: number;
  /** Combien il en faudrait. */
  requis: number;
  suffisante: boolean;
}

// ===========================================================================
// Outils
// ===========================================================================

/** Médiane d'une liste non vide. */
function mediane(valeurs: readonly number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  const m = tri.length >> 1;
  return tri.length % 2 === 1 ? tri[m] : (tri[m - 1] + tri[m]) / 2;
}

/** Formatage français d'une durée : 8400 → « 8,4 s ». */
function formatSecondes(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

/** Formatage français d'une vitesse : 4.2 → « 4,2 km/h ». */
function formatKmh(kmh: number): string {
  return `${kmh.toFixed(1).replace('.', ',')} km/h`;
}

/** Un temps au tour exploitable : présent, fini, strictement positif. */
function tempsExploitable(t: TourMesure): number | null {
  const v = t.tempsMs;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function porteTag(t: TourMesure, tag: string): boolean {
  return t.tags?.some((x) => x === tag) === true;
}

// ===========================================================================
// Évaluation
// ===========================================================================

/**
 * Marques indépendantes de la séance : elles ne dépendent que du tour lui-même.
 * Elles sont relevées pour TOUS les tours, y compris ceux qui sont déjà hors
 * chronométrage — un arrêt pendant un tour de rentrée reste un fait observé.
 */
function marquesPropresAuTour(t: TourMesure): MarqueTour[] {
  const marques: MarqueTour[] = [];

  if (porteTag(t, 'outlap')) {
    marques.push({ code: 'sortie_stands', fait: 'tour de sortie des stands' });
  }
  if (porteTag(t, 'inlap')) {
    marques.push({ code: 'rentree_stands', fait: 'tour de rentrée aux stands' });
  }

  const temps = tempsExploitable(t);
  if (temps === null) {
    marques.push({ code: 'non_chronometre', fait: 'aucun temps au tour relevé' });
  } else if (!t.valide) {
    marques.push({
      code: 'non_chronometre',
      fait: 'tour signalé non exploitable par la détection amont',
    });
  }

  const vmin = t.vitesseMiniKmh;
  if (typeof vmin === 'number' && Number.isFinite(vmin) && vmin < SEUIL_ARRET_KMH) {
    marques.push({
      code: 'arret_en_piste',
      fait: `arrêt observé (vitesse descendue à ${formatKmh(vmin)}, sous ${SEUIL_ARRET_KMH} km/h)`,
    });
  }

  const trous = t.trousMesureMs;
  if (typeof trous === 'number' && Number.isFinite(trous) && trous > SEUIL_TROUS_TOLERES_MS) {
    marques.push({
      code: 'mesure_trouee',
      fait: `${formatSecondes(trous)} de mesure manquante`,
    });
  }

  return marques;
}

/** Le tour est-il hors du chronométrage ? Pas de temps exploitable, ou tour de stands. */
function horsChrono(marques: readonly MarqueTour[]): boolean {
  return marques.some(
    (m) => m.code === 'non_chronometre' || m.code === 'sortie_stands' || m.code === 'rentree_stands'
  );
}

/**
 * Évalue les tours d'une séance : un classement et des marques par tour, puis
 * la référence proposée et sa réserve.
 *
 * Déroulé :
 *   1. marques propres à chaque tour (stands, absence de temps, arrêt, trous) ;
 *   2. base de référence = tours chronométrés, hors stands, sans arrêt ni trou ;
 *   3. écart net = |temps − médiane de la base| au-delà de
 *      max(PLANCHER_ECART_MS, FACTEUR_MAD_ECART × MAD normalisé), dans les deux
 *      sens — la base doit compter MIN_TOURS_BASE_ECART tours, sinon rien n'est
 *      prononcé ;
 *   4. classement : `hors_chrono` d'abord, puis `suspect` dès qu'une marque
 *      subsiste, `propre` sinon ;
 *   5. référence = meilleur tour propre, avec réserve si le meilleur temps brut
 *      de la séance est ailleurs.
 */
export function evaluerTours(tours: readonly TourMesure[]): ValidationTours {
  /** État de travail, indexé par POSITION d'entrée — jamais par `index` de tour,
   *  qu'une détection amont bancale pourrait répéter. */
  interface Etat {
    index: number;
    tempsMs: number | null;
    horsChrono: boolean;
    marques: MarqueTour[];
  }

  const etats: Etat[] = tours.map((t) => {
    const marques = marquesPropresAuTour(t);
    return {
      index: t.index,
      tempsMs: tempsExploitable(t),
      horsChrono: horsChrono(marques),
      marques,
    };
  });

  /** Candidats : un temps exploitable, et le tour compte au chronométrage. */
  const candidats = etats.filter(
    (e): e is Etat & { tempsMs: number } => e.tempsMs !== null && !e.horsChrono
  );

  // ---- Base : les candidats qui ne portent encore aucun fait gênant -------
  const base = candidats.filter((e) => e.marques.length === 0);

  const baseEcart: BaseEcart = {
    tours: base.length,
    requis: MIN_TOURS_BASE_ECART,
    suffisante: base.length >= MIN_TOURS_BASE_ECART,
  };

  if (baseEcart.suffisante) {
    const temps = base.map((e) => e.tempsMs);
    const med = mediane(temps);
    const mad = mediane(temps.map((v) => Math.abs(v - med)));
    const seuil = Math.max(PLANCHER_ECART_MS, FACTEUR_MAD_ECART * NORMALISATION_MAD * mad);

    for (const e of candidats) {
      const ecart = e.tempsMs - med;
      if (Math.abs(ecart) <= seuil) continue;
      // Les deux sens : un tour anormalement rapide n'est pas un cadeau.
      const sens = ecart > 0 ? 'au-dessus' : 'en dessous';
      e.marques.push({
        code: 'ecart_net',
        fait: `${formatSecondes(Math.abs(ecart))} ${sens} de la médiane des tours propres`,
      });
    }
  }

  // ---- Classement ---------------------------------------------------------
  const evalues: TourEvalue[] = etats.map((e) => {
    let classement: ClassementTour;
    if (e.horsChrono) {
      classement = 'hors_chrono';
    } else if (e.marques.length > 0) {
      classement = 'suspect';
    } else {
      classement = 'propre';
    }
    return { index: e.index, classement, marques: e.marques };
  });

  const toursPropres = evalues
    .filter((e) => e.classement === 'propre')
    .map((e) => e.index)
    .sort((a, b) => a - b);

  // ---- Référence et réserve -----------------------------------------------
  let meilleurPropre: (Etat & { tempsMs: number }) | null = null;
  for (const e of etats) {
    if (e.tempsMs === null || e.horsChrono || e.marques.length > 0) continue;
    const propre = e as Etat & { tempsMs: number };
    if (meilleurPropre === null || propre.tempsMs < meilleurPropre.tempsMs) {
      meilleurPropre = propre;
    }
  }

  let reference: ReferenceTour | null = null;
  if (meilleurPropre !== null) {
    // Meilleur temps BRUT de la séance : tous tours chronométrés confondus,
    // stands compris — c'est bien le chiffre le plus flatteur du tableau.
    let brut: (Etat & { tempsMs: number }) | null = null;
    for (const e of etats) {
      if (e.tempsMs === null) continue;
      const chrono = e as Etat & { tempsMs: number };
      if (brut === null || chrono.tempsMs < brut.tempsMs) brut = chrono;
    }

    let reserve: string | null = null;
    if (brut !== null && brut !== meilleurPropre) {
      const faits = brut.marques.map((m) => m.fait);
      reserve =
        faits.length > 0
          ? `Le meilleur temps brut (tour ${brut.index}) porte : ${faits.join(' ; ')}.`
          : `Le meilleur temps brut (tour ${brut.index}) n'est pas la référence proposée.`;
    }

    reference = { index: meilleurPropre.index, tempsMs: meilleurPropre.tempsMs, reserve };
  }

  return {
    version: VERSION_VALIDATION_TOURS,
    tours: evalues,
    toursPropres,
    reference,
    baseEcart,
  };
}

// ===========================================================================
// LA HAUTEUR D'UNE BARRE — barre courte = tour rapide
// ===========================================================================

/** Fractions de la hauteur disponible : le plus rapide en bas, le plus lent en haut. */
export const FRACTION_BARRE_MIN = 0.28;
export const FRACTION_BARRE_MAX = 0.9;

/**
 * La hauteur de la barre d'un tour dans l'histogramme.
 *
 * ===========================================================================
 * LA LÉGENDE ET LE CALCUL DISAIENT L'INVERSE L'UN DE L'AUTRE
 * ===========================================================================
 *
 * Relevé le 30/08/2026 par la recette sur la séance de Bouteville : l'écran
 * affichait « Barre courte = tour rapide » pendant que le calcul donnait au
 * tour LE PLUS RAPIDE la barre LA PLUS HAUTE. Le commentaire du code annonçait
 * pourtant « hauteur inversée sur l'écart » — l'intention était juste, son
 * implémentation la retournait.
 *
 * Arbitrage du fondateur, 30/08 : **c'est l'échelle qui s'inverse**, pas la
 * légende. La barre représente une DURÉE ; un temps court fait donc une barre
 * courte, et la lecture reste littérale.
 *
 * Ce calcul vit ici plutôt que dans l'écran pour une raison précise : une règle
 * qui n'existe que dans un `lerp` au milieu d'un rendu Skia ne peut pas être
 * confrontée à la phrase qui la décrit. Elle l'est désormais par un test.
 *
 * `ecart` est la position du tour entre le plus rapide (0) et le plus lent (1).
 * Hors de [0,1] ou non fini, la barre prend sa hauteur minimale : une valeur
 * aberrante ne dessine pas une barre aberrante.
 */
export function hauteurBarreTour(ecart: number, hauteurDisponible: number): number {
  if (!Number.isFinite(hauteurDisponible) || hauteurDisponible <= 0) return 0;
  const t = Number.isFinite(ecart) ? Math.min(1, Math.max(0, ecart)) : 0;
  return hauteurDisponible * (FRACTION_BARRE_MIN + t * (FRACTION_BARRE_MAX - FRACTION_BARRE_MIN));
}
