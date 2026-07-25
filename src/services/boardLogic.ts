/**
 * boardLogic — logique PURE du canal board (lot LIVE-B), sans aucun I/O.
 *
 * Le board est la couche PUBLIQUE du direct : l'écran TV du paddock, lisible par
 * quiconque passe devant. Deux contraintes le gouvernent, et elles ne sont pas
 * négociables :
 *
 * 1. JURIDIQUE — aucun classement. Un ordre par performance affiché publiquement
 *    peut requalifier un track day en compétition (assurance, réglementation).
 *    L'ordre d'affichage est donc celui des NUMÉROS DE VOITURE, jamais celui des
 *    chronos. Cf. BOARD_MODE ci-dessous.
 * 2. DOCTRINE — aucune donnée de santé ne franchit ce canal. Ce module ne produit
 *    que des faits de roulage ; la barrière technique est `stripHealth`
 *    (src/services/v2/liveHealthGate.ts), appliquée par l'émetteur à CHAQUE
 *    payload board. Les champs de BoardEvent sont exactement des clés de sa liste
 *    blanche : un BoardEvent traverse la barrière intact.
 *
 * Règle de véracité : une donnée absente vaut `null` et se rendra « — » à
 * l'écran. Jamais de 0 de repli, jamais de valeur fabriquée — un chiffre affiché
 * est toujours une mesure.
 */

/**
 * Une ligne du tableau de marche. Rien d'autre : pas de rang, pas d'écart au
 * meilleur temps du plateau, pas d'indicateur de progression relative — ce sont
 * autant de formes déguisées de classement.
 */
export interface BoardEvent {
  /** Pseudo public du pilote (public_handle). Jamais l'état civil. */
  pilotHandle: string;
  /** Numéro de voiture, ou null si aucun numéro n'est attribué. */
  carNo: number | null;
  /** Dernier tour mesuré (ms), ou null si aucun tour n'a encore été bouclé. */
  lastLapMs: number | null;
  /** Meilleur tour PERSONNEL mesuré (ms), ou null. Référence à soi, pas au plateau. */
  bestLapMs: number | null;
  /** Secteur en cours (1..n), ou null si indéterminé. */
  sector: number | null;
  /** Horodatage de l'événement (ms epoch). */
  ts: number;
}

/**
 * Mode d'affichage du board.
 *
 * 'A' = TABLEAU DE MARCHE : liste ordonnée par numéro de voiture, aucun rang,
 * aucune couleur de podium. C'est le DÉFAUT, tranché par le fondateur le
 * 25/07/2026, et le seul mode conforme au manifeste (« Vous ne pilotez contre
 * personne d'autre que vous-même »).
 *
 * 'B' = CLASSEMENT (tri par meilleur tour, rangs affichés) : spécifié mais
 * DÉSACTIVÉ. Il ne peut être activé qu'après un avis d'avocat explicite sur le
 * risque de requalification juridique de l'événement en compétition. Ce n'est pas
 * un réglage produit : basculer cette constante engage l'assurance de la
 * plateforme. Un test verrouille la valeur 'A'.
 */
export const BOARD_MODE: 'A' | 'B' = 'A';

/** Une durée de tour n'est réelle que si elle est finie et strictement positive. */
function isRealLap(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0;
}

/**
 * Construit la ligne board d'une voiture à partir de ses tours MESURÉS.
 *
 * Renvoie `null` — donc aucune émission — si l'identité publiable manque
 * (pilotHandle vide) ou si l'horodatage n'est pas une valeur réelle : mieux vaut
 * une ligne absente qu'une ligne anonyme ou datée de nulle part.
 *
 * `carNo` à null est en revanche ACCEPTABLE : un pilote sans numéro attribué
 * roule quand même, sa ligne s'affiche avec un « — » en colonne numéro.
 */
export function buildBoardEvent(input: {
  pilotHandle: string;
  carNo: number | null;
  /** Durées des tours mesurés, dans l'ordre de roulage. */
  lapsMs: readonly number[];
  sector: number | null;
  nowMs: number;
}): BoardEvent | null {
  const handle = typeof input.pilotHandle === 'string' ? input.pilotHandle.trim() : '';
  if (handle.length === 0) return null;
  if (!Number.isFinite(input.nowMs)) return null;

  // On écarte les durées non mesurables : un tour de 0 ms, négatif ou NaN n'est
  // pas un tour, c'est un artefact de capture. Il ne doit ni s'afficher, ni
  // devenir « meilleur tour ».
  const laps = Array.isArray(input.lapsMs) ? input.lapsMs.filter(isRealLap) : [];

  // Aucun tour bouclé : les deux chronos restent null. Surtout pas 0, qui se
  // lirait comme une mesure — et comme un tour imbattable.
  const lastLapMs = laps.length > 0 ? laps[laps.length - 1] : null;
  const bestLapMs = laps.length > 0 ? Math.min(...laps) : null;

  const carNo =
    typeof input.carNo === 'number' && Number.isFinite(input.carNo) ? input.carNo : null;
  const sector =
    typeof input.sector === 'number' && Number.isFinite(input.sector) ? input.sector : null;

  return { pilotHandle: handle, carNo, lastLapMs, bestLapMs, sector, ts: input.nowMs };
}

/** Ce qu'il faut savoir d'une ligne pour l'ordonner : son numéro, et de quoi
 *  départager les ex æquo. Rien d'autre — surtout aucun chrono. */
export interface CarOrdered {
  /** Numéro de voiture, ou null s'il n'y en a pas. */
  carNo: number | null;
  /** Départage stable et NON performant à numéro égal ou absent (pseudo, prénom). */
  tieBreak: string;
}

/**
 * LA règle d'ordre du lot LIVE-B, et la seule : numéro de voiture croissant.
 *
 * Elle est isolée ici pour n'exister qu'à UN endroit — l'écran TV du paddock et
 * le roster coach doivent ordonner à l'identique, et une seconde implémentation
 * serait une seconde occasion de laisser filer un tri par performance.
 *
 * Les voitures sans numéro passent en fin (elles n'ont pas de place dans une
 * séquence de numéros), départagées par `tieBreak` — un ordre stable, arbitraire
 * et non performant.
 */
export function compareCarNo(a: CarOrdered, b: CarOrdered): number {
  const aHasNo = a.carNo !== null;
  const bHasNo = b.carNo !== null;
  if (aHasNo !== bHasNo) return aHasNo ? -1 : 1;
  if (aHasNo && bHasNo && a.carNo !== b.carNo) {
    return (a.carNo as number) - (b.carNo as number);
  }
  return a.tieBreak.localeCompare(b.tieBreak);
}

/**
 * Ordonne les lignes du board par NUMÉRO DE VOITURE croissant — JAMAIS par
 * chrono. Aucune fonction de ce module ne doit savoir trier par performance :
 * l'ordre d'affichage ne raconte rien du roulage, il sert seulement à retrouver
 * sa voiture d'un coup d'œil sur l'écran du paddock. Ne mute pas l'entrée.
 */
export function sortBoard(rows: readonly BoardEvent[]): BoardEvent[] {
  return [...rows].sort((a, b) =>
    compareCarNo(
      { carNo: a.carNo, tieBreak: a.pilotHandle },
      { carNo: b.carNo, tieBreak: b.pilotHandle }
    )
  );
}

/** Nombre fini, ou null. Une valeur douteuse devient une absence, jamais un 0. */
function finiteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Relit une charge utile board REÇUE (canal public) en BoardEvent, ou null.
 *
 * Le board est le seul canal du direct dont l'émetteur n'est pas le lecteur : ce
 * qui arrive est une donnée ÉTRANGÈRE, jamais une valeur de confiance. On la
 * reconstruit donc champ par champ plutôt que de la caster :
 *   - une ligne sans identité publiable ou sans horodatage réel est REJETÉE
 *     (mieux vaut une ligne absente qu'une ligne anonyme) ;
 *   - toute clé hors des six attendues — dont n'importe quelle clé de santé
 *     qu'un émetteur mal intentionné aurait glissée — n'est tout simplement pas
 *     recopiée : l'objet rendu est neuf. C'est le pendant, à la réception, de la
 *     liste blanche appliquée à l'émission (stripHealth).
 * Aucune valeur n'est réparée ni complétée : un champ douteux devient `null`.
 */
export function parseBoardEvent(payload: unknown): BoardEvent | null {
  if (payload === null || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;

  const handle = typeof raw.pilotHandle === 'string' ? raw.pilotHandle.trim() : '';
  if (handle.length === 0) return null;
  const ts = finiteOrNull(raw.ts);
  if (ts === null) return null;

  const lastLapMs = finiteOrNull(raw.lastLapMs);
  const bestLapMs = finiteOrNull(raw.bestLapMs);
  return {
    pilotHandle: handle,
    carNo: finiteOrNull(raw.carNo),
    // Même exigence qu'à la construction : un tour nul ou négatif n'est pas une
    // mesure, il ne s'affiche pas.
    lastLapMs: lastLapMs !== null && isRealLap(lastLapMs) ? lastLapMs : null,
    bestLapMs: bestLapMs !== null && isRealLap(bestLapMs) ? bestLapMs : null,
    sector: finiteOrNull(raw.sector),
    ts,
  };
}

/**
 * Faut-il émettre une ligne board ? Cadence publique plafonnée à 1 Hz : l'écran
 * TV se lit à six mètres, il n'a aucun besoin du flux brut, et une cadence basse
 * limite mécaniquement ce qui transite sur un canal public. Même contrat que
 * shouldEmitFrame : premier tick toujours autorisé, puis espacement minimal.
 */
export function shouldEmitBoard(
  lastEmitMs: number | null,
  atMs: number,
  minIntervalMs = 1000
): boolean {
  if (lastEmitMs === null) return true;
  return atMs - lastEmitMs >= minIntervalMs;
}
