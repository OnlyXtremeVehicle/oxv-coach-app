/**
 * arbitrageSources — quand DEUX sources ont mesuré le même run (lot 10a).
 *
 * Module PUR : aucune I/O, aucun React, aucun Supabase.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CE MODULE REMPLACE
 * ===========================================================================
 *
 * `biometry_raw` a pour clé naturelle `(session_id, ts, source)` : deux sources
 * PEUVENT écrire sur la même séance, et c'est même le cas nominal d'un pilote
 * qui porte sa montre et enfile une ceinture au paddock.
 *
 * Le bilan faisait alors deux choses, silencieusement :
 *
 *   1. `toBiometrySamples` versait TOUTES les lignes dans une seule courbe,
 *      sans regarder leur `source`. La sparkline mêlait donc deux capteurs,
 *      deux sites de mesure et deux horloges — et plus aucun de ses points
 *      n'avait d'origine identifiable.
 *
 *   2. `biometrySourceOf` posait UN badge, choisi à la MAJORITÉ des lignes. Or
 *      la montre rend ~1 point / 5 s et la ceinture ~1 point / s : la ceinture
 *      gagne le vote presque toujours, non parce qu'elle a été retenue, mais
 *      parce qu'elle est plus bavarde. Le badge disait « Ceinture » au-dessus
 *      d'une courbe qui contenait aussi la montre.
 *
 * Un battement dont on ne sait plus d'où il vient n'est plus une mesure.
 *
 * ===========================================================================
 * LA RÈGLE : ON CHOISIT, ON NE FUSIONNE JAMAIS
 * ===========================================================================
 *
 * Deux séries ne se fondent pas en une. Deux capteurs posés à deux endroits du
 * corps, échantillonnés à deux cadences, sur deux horloges, ne produisent pas
 * une courbe : ils produisent deux courbes. On en RETIENT une, on ÉCARTE
 * l'autre, et on DIT laquelle et pourquoi.
 *
 * Critères, dans l'ordre. Chacun est un FAIT, jamais une préférence :
 *
 *   1. CADENCE ANNONCÉE — la source la plus fine rend la série la plus dense.
 *      C'est une propriété déclarée au registre, pas une supposition.
 *   2. QUALITÉ MESURÉE — à cadence égale, la qualité réellement observée
 *      départage. Une qualité INCONNUE ne perd pas contre une qualité connue :
 *      elle est incomparable, et on passe au critère suivant. Traiter
 *      l'inconnu comme un mauvais score serait inventer une mesure.
 *   3. NOMBRE DE MESURES — à défaut, la série la plus fournie.
 *   4. ORDRE DÉCLARÉ — et si rien ne les sépare, on le dit tel quel plutôt
 *      que de laisser l'ordre d'arrivée des lignes décider en silence.
 */

import {
  type IdSource,
  type SourceBiometrique,
  sourceParCleBase,
  sourceParId,
} from './sourcesBiometrie';

/** Un flux de mesures, tel qu'une séance l'a réellement produit. */
export interface FluxSource {
  id: IdSource;
  /** Nombre de mesures exploitables de cette source sur la séance. */
  nbMesures: number;
  /** Qualité moyenne mesurée (0-100), ou `null` si aucune ligne n'en portait. */
  qualiteMoyenne: number | null;
  /** Cette source est-elle consentie à cet instant (cf. `consentementSource`) ? */
  consentie: boolean;
}

/** Pourquoi une source a été retenue. Vocabulaire fermé. */
export type MotifRetenue =
  | 'seule_source'
  | 'cadence_plus_fine'
  | 'qualite_mesuree_superieure'
  | 'plus_de_mesures'
  | 'ordre_declare';

/** Pourquoi une source a été écartée. Vocabulaire fermé, symétrique du précédent. */
export type MotifEcart =
  | 'non_consentie'
  | 'aucune_mesure'
  | 'source_inconnue'
  | 'cadence_moins_fine'
  | 'qualite_mesuree_inferieure'
  | 'moins_de_mesures'
  | 'ordre_declare';

export interface SourceEcartee {
  id: string;
  motif: MotifEcart;
}

export interface Arbitrage {
  /** La source retenue, ou `null` si aucune n'était éligible. */
  retenue: SourceBiometrique | null;
  /** Ce qui a fait pencher — `null` quand rien n'a été retenu. */
  motif: MotifRetenue | null;
  /** Les autres, chacune avec SA raison. Jamais un écart muet. */
  ecartees: readonly SourceEcartee[];
}

/**
 * Regroupe des lignes `biometry_raw` en flux par source.
 *
 * Une ligne dont la `source` n'est pas au registre est comptée à part, sous son
 * identifiant brut, et écartée avec le motif `source_inconnue` : elle existe,
 * elle est dite, et elle n'entre dans aucune courbe.
 */
export interface LigneSource {
  source: string;
  quality: number | null;
}

export interface Regroupement {
  flux: FluxSource[];
  /** Clés de base rencontrées qui ne sont pas au registre. */
  inconnues: string[];
}

/**
 * Regroupe par source, en n'accordant à chaque flux que ce que les lignes
 * portent réellement. `consentie` est demandé à l'appelant : ce module ne lit
 * aucun consentement, il ne fait qu'en tenir compte.
 */
export function regrouperParSource(
  lignes: readonly LigneSource[],
  consentiePar: (id: IdSource) => boolean
): Regroupement {
  const compte = new Map<IdSource, { n: number; sommeQualite: number; nQualite: number }>();
  const inconnues = new Set<string>();

  for (const l of lignes) {
    const source = sourceParCleBase(l?.source);
    if (source === null) {
      if (typeof l?.source === 'string' && l.source.length > 0) inconnues.add(l.source);
      continue;
    }
    const acc = compte.get(source.id) ?? { n: 0, sommeQualite: 0, nQualite: 0 };
    acc.n += 1;
    if (typeof l.quality === 'number' && Number.isFinite(l.quality)) {
      acc.sommeQualite += l.quality;
      acc.nQualite += 1;
    }
    compte.set(source.id, acc);
  }

  const flux: FluxSource[] = [];
  for (const [id, acc] of compte) {
    flux.push({
      id,
      nbMesures: acc.n,
      // Aucune ligne ne portait de qualité → `null`, jamais un 0 fabriqué : une
      // qualité absente n'est pas une qualité nulle.
      qualiteMoyenne: acc.nQualite > 0 ? acc.sommeQualite / acc.nQualite : null,
      consentie: consentiePar(id) === true,
    });
  }

  return { flux, inconnues: [...inconnues] };
}

/**
 * Compare deux flux et rend le motif qui les sépare, ou `null` si rien ne les
 * sépare selon ce critère. Fonction interne, exportée pour être testée seule.
 *
 * Retourne un couple : le motif de RETENUE du gagnant, et le motif d'ÉCART du
 * perdant. Les deux sont symétriques par construction — c'est ce qui garantit
 * qu'aucune source ne peut être écartée pour une raison différente de celle qui
 * en a retenu une autre.
 */
export function departager(
  a: { flux: FluxSource; source: SourceBiometrique },
  b: { flux: FluxSource; source: SourceBiometrique }
): { gagnant: 'a' | 'b'; retenue: MotifRetenue; ecart: MotifEcart } {
  // 1 · CADENCE ANNONCÉE.
  if (a.source.cadenceNominaleHz !== b.source.cadenceNominaleHz) {
    const gagnant = a.source.cadenceNominaleHz > b.source.cadenceNominaleHz ? 'a' : 'b';
    return { gagnant, retenue: 'cadence_plus_fine', ecart: 'cadence_moins_fine' };
  }

  // 2 · QUALITÉ MESURÉE — seulement si les DEUX sont connues. Une qualité
  // inconnue est incomparable, pas mauvaise : on ne la fait pas perdre.
  const qa = a.flux.qualiteMoyenne;
  const qb = b.flux.qualiteMoyenne;
  if (typeof qa === 'number' && typeof qb === 'number' && qa !== qb) {
    return {
      gagnant: qa > qb ? 'a' : 'b',
      retenue: 'qualite_mesuree_superieure',
      ecart: 'qualite_mesuree_inferieure',
    };
  }

  // 3 · NOMBRE DE MESURES.
  if (a.flux.nbMesures !== b.flux.nbMesures) {
    return {
      gagnant: a.flux.nbMesures > b.flux.nbMesures ? 'a' : 'b',
      retenue: 'plus_de_mesures',
      ecart: 'moins_de_mesures',
    };
  }

  // 4 · ORDRE DÉCLARÉ — dit, jamais subi.
  return {
    gagnant: a.source.rangDeclare <= b.source.rangDeclare ? 'a' : 'b',
    retenue: 'ordre_declare',
    ecart: 'ordre_declare',
  };
}

/**
 * Arbitre entre les flux d'une séance. Ne fusionne JAMAIS.
 *
 * Écarte d'abord ce qui n'est pas éligible, chacun avec son motif :
 * source non consentie, source sans aucune mesure, source hors registre.
 * Puis départage les candidats restants deux à deux.
 *
 * Aucun candidat → `retenue: null`, `motif: null`. L'absence se dit par une
 * absence ; on n'affiche pas une courbe vide sous un badge.
 */
export function arbitrerSources(
  flux: readonly FluxSource[],
  inconnues: readonly string[] = []
): Arbitrage {
  const ecartees: SourceEcartee[] = [];
  for (const cle of inconnues) ecartees.push({ id: cle, motif: 'source_inconnue' });

  const candidats: { flux: FluxSource; source: SourceBiometrique }[] = [];
  for (const f of flux) {
    const source = sourceParId(f?.id);
    if (source === null) {
      ecartees.push({ id: String(f?.id), motif: 'source_inconnue' });
      continue;
    }
    // L'ordre compte : une source non consentie est écartée POUR CELA, même si
    // elle n'a par ailleurs aucune mesure. Le motif rendu au pilote doit être
    // celui qui le concerne.
    if (f.consentie !== true) {
      ecartees.push({ id: source.id, motif: 'non_consentie' });
      continue;
    }
    if (!Number.isFinite(f.nbMesures) || f.nbMesures <= 0) {
      ecartees.push({ id: source.id, motif: 'aucune_mesure' });
      continue;
    }
    candidats.push({ flux: f, source });
  }

  if (candidats.length === 0) return { retenue: null, motif: null, ecartees };
  if (candidats.length === 1) {
    return { retenue: candidats[0].source, motif: 'seule_source', ecartees };
  }

  let tenant = candidats[0];
  let motif: MotifRetenue = 'ordre_declare';
  for (let i = 1; i < candidats.length; i++) {
    const duel = departager(tenant, candidats[i]);
    const perdant = duel.gagnant === 'a' ? candidats[i] : tenant;
    ecartees.push({ id: perdant.source.id, motif: duel.ecart });
    tenant = duel.gagnant === 'a' ? tenant : candidats[i];
    motif = duel.retenue;
  }

  return { retenue: tenant.source, motif, ecartees };
}

/**
 * La phrase qui REND le motif au pilote — factuelle, vouvoiement, sans verbe
 * prescriptif et sans jugement porté sur la source écartée.
 *
 * `null` quand il n'y a rien à expliquer : une source unique retenue ne demande
 * pas de justification, et une absence totale ne s'explique pas par une phrase.
 */
export function phraseArbitrage(arbitrage: Arbitrage): string | null {
  const retenue = arbitrage.retenue;
  if (retenue === null) return null;

  // On ne commente que les sources ÉCARTÉES POUR AVOIR PERDU un duel : une
  // source non consentie ou sans mesure relève d'un autre récit, pas de celui-ci.
  const perdantes = arbitrage.ecartees.filter(
    (e) =>
      e.motif === 'cadence_moins_fine' ||
      e.motif === 'qualite_mesuree_inferieure' ||
      e.motif === 'moins_de_mesures' ||
      e.motif === 'ordre_declare'
  );
  if (perdantes.length === 0) return null;

  const tete = 'Deux sources ont mesuré cette séance. Lecture retenue : ' + retenue.libelle;
  switch (arbitrage.motif) {
    case 'cadence_plus_fine':
      return tete + ' — cadence plus fine.';
    case 'qualite_mesuree_superieure':
      return tete + ' — qualité mesurée plus élevée.';
    case 'plus_de_mesures':
      return tete + ' — davantage de mesures.';
    case 'ordre_declare':
      return tete + ' — rien ne sépare les deux sources.';
    case 'seule_source':
    default:
      return null;
  }
}
