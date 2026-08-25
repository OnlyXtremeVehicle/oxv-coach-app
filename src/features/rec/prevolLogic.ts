/**
 * PRÉVOL RACEBOX (M02) — la chaîne de mesure avant d'entrer en piste. Logique PURE.
 *
 * Cahier veille télémétrie (docs/produit/CAHIER_VEILLE_TELEMETRIE_2026-08-25.md,
 * fiche M02) : « Éviter une session sans donnée exploitable. » Le prévol est un
 * test court (15–30 s) qui passe en revue les postes de la chaîne — boîtier,
 * GNSS, téléphone, réseau — et rend un verdict avant que la piste n'ouvre.
 * Découvrir au débrief que rien n'a été mesuré est le pire des scénarios : la
 * session est passée, la donnée n'existe pas.
 *
 * ===========================================================================
 * TROIS RÈGLES D'HONNÊTETÉ
 * ===========================================================================
 *
 * 1. **Un poste non mesuré est DIT non mesuré.** Jamais vert par défaut : un
 *    canal que personne n'a lu (mémoire du boîtier aujourd'hui, batterie avant
 *    la première trame) s'affiche `non_mesure`, avec une phrase qui le dit.
 *    La mémoire du boîtier, notamment, n'est pas encore lue par le parser UBX
 *    du dépôt : son entrée existe pour le jour où elle le sera, et d'ici là
 *    elle dit la vérité — non mesurée.
 *
 * 2. **Le direct indisponible n'empêche pas l'enregistrement.** Le réseau ne
 *    sert qu'au direct (coach connecté) : son absence dégrade le mode
 *    (`enregistrement_seul`), elle ne bloque jamais la captation. Le cahier :
 *    « accepter explicitement l'enregistrement seul si direct indisponible ».
 *
 * 3. **Les phrases sont des FAITS.** « Batterie du boîtier : 82 % »,
 *    « Fix GPS non acquis » — jamais un ordre, jamais une consigne. Le pilote
 *    décide ; l'écran montre. Et un prévol vert décrit des conditions
 *    techniques, jamais une activité sans risque (rappel exporté ci-dessous).
 *
 * ===========================================================================
 * BLOQUANT ≠ AVERTISSEMENT (exigence du cahier)
 * ===========================================================================
 *
 * Chaque poste mesurable a DEUX seuils distincts : au-delà du premier le poste
 * est `a_verifier` (la captation reste possible, le fait est affiché) ; au-delà
 * du second il est `bloquant` (la donnée produite ne serait pas exploitable).
 * Les seuils sont des conventions nommées, à valider sur piste — aucun n'est
 * une mesure.
 */

import { FREQUENCE_NOMINALE_HZ } from '@/features/data/confianceLogic';

// ===========================================================================
// Seuils — conventions nommées, À VALIDER SUR PISTE. Remplaçables dès qu'une
// campagne sur circuit dira mieux.
// ===========================================================================

/** Version du prévol — à incrémenter à chaque changement de seuil ou de règle. */
export const VERSION_PREVOL = '1.0.0';

/** Durée du test de prévol, en secondes (fiche M02 : « Test 15–30 s »). */
export const DUREE_TEST_MIN_S = 15;
export const DUREE_TEST_MAX_S = 30;

/** Batterie du boîtier en deçà de laquelle la captation est bloquée, en %. À valider sur piste. */
export const SEUIL_BATTERIE_BOITIER_BLOQUANT_PCT = 10;
/** Batterie du boîtier en deçà de laquelle le poste passe à vérifier, en %. À valider sur piste. */
export const SEUIL_BATTERIE_BOITIER_A_VERIFIER_PCT = 30;

/** Mémoire LIBRE du boîtier en deçà de laquelle la captation est bloquée, en %. À valider sur piste. */
export const SEUIL_MEMOIRE_LIBRE_BLOQUANT_PCT = 5;
/** Mémoire LIBRE du boîtier en deçà de laquelle le poste passe à vérifier, en %. À valider sur piste. */
export const SEUIL_MEMOIRE_LIBRE_A_VERIFIER_PCT = 15;

/** hAcc au-delà duquel la position n'est pas exploitable, en mètres. À valider sur piste. */
export const SEUIL_HACC_BLOQUANT_M = 10;
/** hAcc au-delà duquel la précision est à vérifier, en mètres — aligné sur SEUIL_HACC_DEGRADE_M (confianceLogic). À valider sur piste. */
export const SEUIL_HACC_A_VERIFIER_M = 5;

/** En deçà de ce nombre de satellites, la solution n'est pas exploitable. À valider sur piste. */
export const SEUIL_SATELLITES_BLOQUANT = 5;
/** En deçà de ce nombre de satellites, le poste passe à vérifier — aligné sur SEUIL_SATELLITES_MIN (confianceLogic). À valider sur piste. */
export const SEUIL_SATELLITES_A_VERIFIER = 8;

/** Fréquence observée en deçà de laquelle la captation est bloquée, en Hz (la moitié du nominal). À valider sur piste. */
export const SEUIL_FREQUENCE_BLOQUANT_HZ = 0.5 * FREQUENCE_NOMINALE_HZ;
/** Fréquence observée en deçà de laquelle le poste passe à vérifier, en Hz (0,8 × nominal, comme confianceLogic). À valider sur piste. */
export const SEUIL_FREQUENCE_A_VERIFIER_HZ = 0.8 * FREQUENCE_NOMINALE_HZ;

/** Batterie du téléphone en deçà de laquelle la captation est bloquée, en % (c'est lui qui enregistre). À valider sur piste. */
export const SEUIL_BATTERIE_TELEPHONE_BLOQUANT_PCT = 5;
/** Batterie du téléphone en deçà de laquelle le poste passe à vérifier, en %. À valider sur piste. */
export const SEUIL_BATTERIE_TELEPHONE_A_VERIFIER_PCT = 20;

/**
 * Rappel doctrinal de la fiche M02, à afficher tel quel près du verdict :
 * le vert décrit l'état de la chaîne technique, rien d'autre.
 */
export const RAPPEL_PREVOL =
  'Un prévol vert décrit des conditions techniques, jamais une activité sans risque.';

// ===========================================================================
// Types
// ===========================================================================

/**
 * Les états disponibles au moment du prévol. TOUS nullables : `null` vaut
 * « non mesuré », jamais « bon » ni « mauvais ». Sources réelles du dépôt :
 * `RaceBoxData.battery.level`, `gps.fix` / `gps.accuracy` / `gps.satellites`
 * (types/telemetry), `bluetoothService.getCurrentRate()` pour la fréquence,
 * l'état de connexion BLE — et le téléphone/réseau côté OS.
 */
export interface EtatsPrevol {
  /** Batterie du boîtier, en % (RaceBoxData.battery.level). */
  batteriePct: number | null;
  /** Mémoire interne LIBRE du boîtier, en % — non lue par le parser à ce jour. */
  memoirePct: number | null;
  /** Fix GNSS exploitable annoncé par le boîtier (Fix3D). */
  fixValide: boolean | null;
  /** hAcc — précision horizontale annoncée, en mètres (gps.accuracy). */
  hAccM: number | null;
  /** Satellites utilisés dans la solution. */
  satellites: number | null;
  /** Fréquence de trames observée, en Hz (bluetoothService.getCurrentRate). */
  frequenceHz: number | null;
  /** Liaison BLE avec le boîtier établie. */
  connexionEtablie: boolean | null;
  /** Batterie du téléphone, en % — c'est lui qui enregistre les trames. */
  batterieTelephonePct: number | null;
  /** Réseau de données disponible — ne sert qu'au direct, jamais à l'enregistrement. */
  reseauDisponible: boolean | null;
}

export type EtatPoste = 'pret' | 'a_verifier' | 'bloquant' | 'non_mesure';

export type PosteId =
  | 'connexion'
  | 'batterie_boitier'
  | 'memoire_boitier'
  | 'fix_gnss'
  | 'precision_gnss'
  | 'satellites'
  | 'frequence'
  | 'batterie_telephone'
  | 'reseau';

export interface PostePrevol {
  poste: PosteId;
  etat: EtatPoste;
  /** Un FAIT, formulé en français — jamais un ordre, jamais une valeur inventée. */
  fait: string;
}

export type ModePrevol = 'complet' | 'enregistrement_seul' | 'indisponible';

export interface VerdictPrevol {
  /** La chaîne d'enregistrement est saine : la captation peut partir. */
  partirPossible: boolean;
  modeDegrade: ModePrevol;
  /** Le verdict en une phrase factuelle. */
  phrase: string;
}

export interface BilanPrevol {
  version: string;
  postes: PostePrevol[];
  verdict: VerdictPrevol;
}

/** Libellés humains des postes — pour les listes du verdict. */
export const LIBELLES_POSTES: Record<PosteId, string> = {
  connexion: 'liaison avec le boîtier',
  batterie_boitier: 'batterie du boîtier',
  memoire_boitier: 'mémoire du boîtier',
  fix_gnss: 'fix GPS',
  precision_gnss: 'précision GPS',
  satellites: 'satellites',
  frequence: 'fréquence de mesure',
  batterie_telephone: 'batterie du téléphone',
  reseau: 'réseau',
};

/**
 * Les postes qui portent l'ENREGISTREMENT. Le réseau n'y figure pas : il ne
 * sert qu'au direct, et son absence ne bloque jamais la captation.
 */
export const POSTES_ENREGISTREMENT: readonly PosteId[] = [
  'connexion',
  'batterie_boitier',
  'memoire_boitier',
  'fix_gnss',
  'precision_gnss',
  'satellites',
  'frequence',
  'batterie_telephone',
] as const;

// ===========================================================================
// Formats français
// ===========================================================================

/** « 82 % » — pourcentage entier. */
function formatPct(v: number): string {
  return `${Math.round(v)} %`;
}

/** « 3,2 » — une décimale, virgule française. */
function format1(v: number): string {
  return v.toFixed(1).replace('.', ',');
}

/** La valeur est-elle un nombre exploitable ? NaN et ±Infinity valent non mesuré. */
function estMesure(v: number | null): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ===========================================================================
// Évaluation poste par poste
// ===========================================================================

/**
 * Un poste numérique où PLUS BAS est PIRE (batteries, mémoire libre,
 * satellites, fréquence). Les seuils sont stricts : la valeur exactement au
 * seuil bloquant reste `a_verifier` — le doute ne fabrique pas un blocage.
 */
function posteBas(
  poste: PosteId,
  valeur: number | null,
  seuilBloquant: number,
  seuilAVerifier: number,
  fait: (v: number) => string,
  faitAbsent: string
): PostePrevol {
  if (!estMesure(valeur)) return { poste, etat: 'non_mesure', fait: faitAbsent };
  const etat: EtatPoste =
    valeur < seuilBloquant ? 'bloquant' : valeur < seuilAVerifier ? 'a_verifier' : 'pret';
  return { poste, etat, fait: fait(valeur) };
}

/** Un poste numérique où PLUS HAUT est PIRE (hAcc). Mêmes conventions strictes. */
function posteHaut(
  poste: PosteId,
  valeur: number | null,
  seuilBloquant: number,
  seuilAVerifier: number,
  fait: (v: number) => string,
  faitAbsent: string
): PostePrevol {
  if (!estMesure(valeur)) return { poste, etat: 'non_mesure', fait: faitAbsent };
  const etat: EtatPoste =
    valeur > seuilBloquant ? 'bloquant' : valeur > seuilAVerifier ? 'a_verifier' : 'pret';
  return { poste, etat, fait: fait(valeur) };
}

/**
 * Passe la chaîne en revue, poste par poste, et rend le bilan complet.
 *
 * Chaque poste sort avec son état ET son fait — jamais un état seul. Un poste
 * dont la valeur manque (`null`, NaN) est `non_mesure`, et sa phrase le dit :
 * on ne certifie pas ce qu'on n'a pas lu.
 */
export function evaluerPrevol(etats: EtatsPrevol): BilanPrevol {
  const postes: PostePrevol[] = [];

  // ---- Liaison BLE : le socle. Sans elle, rien d'autre n'est lisible. ----
  if (etats.connexionEtablie === true) {
    postes.push({ poste: 'connexion', etat: 'pret', fait: 'Liaison avec le boîtier établie' });
  } else if (etats.connexionEtablie === false) {
    postes.push({
      poste: 'connexion',
      etat: 'bloquant',
      fait: 'Liaison avec le boîtier non établie',
    });
  } else {
    postes.push({
      poste: 'connexion',
      etat: 'non_mesure',
      fait: 'Liaison avec le boîtier : non mesurée',
    });
  }

  postes.push(
    posteBas(
      'batterie_boitier',
      etats.batteriePct,
      SEUIL_BATTERIE_BOITIER_BLOQUANT_PCT,
      SEUIL_BATTERIE_BOITIER_A_VERIFIER_PCT,
      (v) => `Batterie du boîtier : ${formatPct(v)}`,
      'Batterie du boîtier : non mesurée'
    )
  );

  postes.push(
    posteBas(
      'memoire_boitier',
      etats.memoirePct,
      SEUIL_MEMOIRE_LIBRE_BLOQUANT_PCT,
      SEUIL_MEMOIRE_LIBRE_A_VERIFIER_PCT,
      (v) => `Mémoire libre du boîtier : ${formatPct(v)}`,
      'Mémoire du boîtier : non mesurée'
    )
  );

  // ---- Fix GNSS : booléen annoncé par le boîtier. ----
  if (etats.fixValide === true) {
    postes.push({ poste: 'fix_gnss', etat: 'pret', fait: 'Fix GPS acquis' });
  } else if (etats.fixValide === false) {
    postes.push({ poste: 'fix_gnss', etat: 'bloquant', fait: 'Fix GPS non acquis' });
  } else {
    postes.push({ poste: 'fix_gnss', etat: 'non_mesure', fait: 'Fix GPS : non mesuré' });
  }

  postes.push(
    posteHaut(
      'precision_gnss',
      etats.hAccM,
      SEUIL_HACC_BLOQUANT_M,
      SEUIL_HACC_A_VERIFIER_M,
      (v) => `Précision GPS : ${format1(v)} m`,
      'Précision GPS : non mesurée'
    )
  );

  postes.push(
    posteBas(
      'satellites',
      etats.satellites,
      SEUIL_SATELLITES_BLOQUANT,
      SEUIL_SATELLITES_A_VERIFIER,
      (v) => `Satellites utilisés : ${Math.round(v)}`,
      'Satellites : non mesurés'
    )
  );

  postes.push(
    posteBas(
      'frequence',
      etats.frequenceHz,
      SEUIL_FREQUENCE_BLOQUANT_HZ,
      SEUIL_FREQUENCE_A_VERIFIER_HZ,
      (v) => `Fréquence observée : ${format1(v)} Hz (${FREQUENCE_NOMINALE_HZ} Hz nominaux)`,
      'Fréquence de mesure : non mesurée'
    )
  );

  postes.push(
    posteBas(
      'batterie_telephone',
      etats.batterieTelephonePct,
      SEUIL_BATTERIE_TELEPHONE_BLOQUANT_PCT,
      SEUIL_BATTERIE_TELEPHONE_A_VERIFIER_PCT,
      (v) => `Batterie du téléphone : ${formatPct(v)}`,
      'Batterie du téléphone : non mesurée'
    )
  );

  // ---- Réseau : le direct seulement. Jamais bloquant. ----
  if (etats.reseauDisponible === true) {
    postes.push({ poste: 'reseau', etat: 'pret', fait: 'Réseau disponible' });
  } else if (etats.reseauDisponible === false) {
    postes.push({ poste: 'reseau', etat: 'a_verifier', fait: 'Réseau indisponible' });
  } else {
    postes.push({ poste: 'reseau', etat: 'non_mesure', fait: 'Réseau : non mesuré' });
  }

  return { version: VERSION_PREVOL, postes, verdict: verdictDe(postes) };
}

// ===========================================================================
// Verdict
// ===========================================================================

function libelles(postes: readonly PostePrevol[]): string {
  return postes.map((p) => LIBELLES_POSTES[p.poste]).join(', ');
}

/**
 * Le verdict se déduit des postes, et d'eux seuls.
 *
 *   • un poste d'ENREGISTREMENT bloquant → captation `indisponible` ;
 *   • la liaison non mesurée → `indisponible` aussi : « partir seulement
 *     chaîne saine » (M02), et une chaîne qu'on n'a pas lue n'est pas saine ;
 *   • sinon la captation part — `complet` si le réseau est là pour le direct,
 *     `enregistrement_seul` sinon (réseau absent OU non mesuré) ;
 *   • les postes à vérifier et non mesurés restants sont NOMMÉS dans la
 *     phrase : le verdict ne les recouvre pas de vert.
 */
function verdictDe(postes: readonly PostePrevol[]): VerdictPrevol {
  const enregistrement = postes.filter((p) => POSTES_ENREGISTREMENT.includes(p.poste));
  const bloquants = enregistrement.filter((p) => p.etat === 'bloquant');

  if (bloquants.length > 0) {
    const n = bloquants.length;
    const phrase =
      n === 1
        ? `Captation indisponible : 1 poste bloquant (${libelles(bloquants)}).`
        : `Captation indisponible : ${n} postes bloquants (${libelles(bloquants)}).`;
    return { partirPossible: false, modeDegrade: 'indisponible', phrase };
  }

  const connexion = postes.find((p) => p.poste === 'connexion');
  if (connexion === undefined || connexion.etat !== 'pret') {
    return {
      partirPossible: false,
      modeDegrade: 'indisponible',
      phrase: 'Captation indisponible : liaison avec le boîtier non mesurée.',
    };
  }

  const aVerifier = enregistrement.filter((p) => p.etat === 'a_verifier');
  const nonMesures = enregistrement.filter((p) => p.etat === 'non_mesure');

  const prefixe =
    aVerifier.length === 0 && nonMesures.length === 0
      ? 'Chaîne de mesure prête.'
      : 'Aucun poste bloquant.';

  const reseau = postes.find((p) => p.poste === 'reseau');
  const reseauPret = reseau !== undefined && reseau.etat === 'pret';
  const direct = reseauPret
    ? 'Direct disponible.'
    : reseau !== undefined && reseau.etat === 'non_mesure'
      ? 'Réseau non mesuré : enregistrement seul.'
      : 'Réseau indisponible : enregistrement seul.';

  let phrase = `${prefixe} ${direct}`;
  if (aVerifier.length > 0) phrase += ` À vérifier : ${libelles(aVerifier)}.`;
  if (nonMesures.length > 0) phrase += ` Non mesuré : ${libelles(nonMesures)}.`;

  return {
    partirPossible: true,
    modeDegrade: reseauPret ? 'complet' : 'enregistrement_seul',
    phrase,
  };
}
