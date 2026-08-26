/**
 * consentementSource — le consentement PAR SOURCE, et ce qui le porte (lot 10a).
 *
 * Module PUR : aucune I/O, aucun React, aucun Supabase. La décision « cette
 * source-là a-t-elle le droit de mesurer, maintenant » mérite d'être lisible et
 * testable sans rien monter.
 *
 * ===========================================================================
 * CE QUI EXISTAIT, ET CE QUI MANQUAIT
 * ===========================================================================
 *
 * Le dépôt porte DEUX consentements, en colonnes horodatées sur `users` :
 * `biometry_capture_consent_at` (capter) et `biometry_coach_share_consent_at`
 * (partager au coach). NULL = refus, une date = preuve. C'est le SOCLE, et il
 * est correct.
 *
 * Mais ce socle est par USAGE, pas par SOURCE. Or le document validé par le
 * conseil le 25/07/2026 distingue déjà les deux sources, et pas seulement par
 * leur matériel :
 *
 *   « Apple Watch (tous les pilotes, sur option) […] Mesure au poignet,
 *     indicative. »
 *   « Ceinture Polar (pilotes accompagnés d'un coach, sur OPTION RENFORCÉE)
 *     […] mesure de précision. »
 *
 * Deux options de portée différente, un seul interrupteur en base. Un pilote
 * qui accepte que sa montre relise son cardio accepte, du même geste, qu'une
 * ceinture thoracique le mesure en continu — alors que le texte qu'il a lu
 * présentait deux régimes distincts.
 *
 * ===========================================================================
 * LA RÈGLE, ET POURQUOI ELLE N'EST PAS « TOUT FERMÉ PAR DÉFAUT »
 * ===========================================================================
 *
 * L'ordre d'évaluation est fixe, et chaque marche a son motif RENDU :
 *
 *   1. drapeau serveur `biometry` absent → refus. La fonction n'existe pas.
 *   2. socle de capture absent → refus. Rien ne s'ouvre sans lui.
 *   3. source explicitement RETIRÉE → refus, même socle en place. C'est tout
 *      l'objet du lot : un retrait par source doit primer sur l'accord global,
 *      sinon « révocable par source » ne veut rien dire.
 *   4. source explicitement ACCORDÉE → autorisée, portée par les DEUX.
 *   5. source jamais recueillie → autorisée, portée par le SOCLE SEUL — et
 *      c'est DIT.
 *
 * La marche 5 est la seule discutable, alors on la motive. Refuser sur
 * « jamais recueilli » couperait aujourd'hui une capture que le pilote a bel et
 * bien acceptée : le texte qu'il a signé nomme les deux sources sous l'unique
 * case « Capter ma fréquence cardiaque en séance ». Le socle les couvre donc
 * réellement, et les couper serait lui retirer un accord qu'il a donné.
 *
 * Ce qui change, c'est qu'on ne PRÉTEND plus avoir un accord par source quand
 * on n'en a pas : la décision NOMME le consentement qui la porte
 * (`socle_seul`). L'affichage peut le dire, l'audit peut le relire. Le jour où
 * la table `biometry_source_consents` sera appliquée et l'écran de recueil
 * posé, les décisions basculeront d'elles-mêmes en `socle_et_source`, sans
 * qu'une ligne de cette règle ne change.
 */

import type { IdSource, SourceBiometrique } from './sourcesBiometrie';

/**
 * L'état du consentement propre à UNE source, tel que la base le rapporte.
 *
 * Trois états, pas deux : « jamais recueilli » n'est PAS « retiré ». Le dépôt a
 * déjà payé cette confusion une fois — `biometry_asked_at` a dû être ajoutée
 * parce qu'un refus et une question jamais posée valaient tous deux NULL, et
 * qu'un flux ne pouvait donc pas savoir qu'il avait déjà demandé.
 */
export type EtatSource = 'accorde' | 'retire' | 'jamais_recueilli';

/** Ce qui PORTE une autorisation, ou ce qui la refuse. Vocabulaire fermé. */
export type MotifDecision =
  /** Le socle ET l'accord propre à cette source. */
  | 'socle_et_source'
  /** Le socle seul : l'accord par source n'a pas encore été recueilli. */
  | 'socle_seul'
  /** Le drapeau serveur `biometry` est retiré. */
  | 'drapeau_absent'
  /** Aucun consentement de capture : rien ne s'ouvre. */
  | 'socle_absent'
  /** Le pilote a retiré CETTE source, socle intact. */
  | 'source_retiree'
  /** L'identifiant de source n'est pas au registre. */
  | 'source_inconnue'
  /**
   * La ceinture demande un coach affilié, et il n'y en a pas — arbitrage
   * fondateur du 26/08/2026. La base refuse déjà de POSER un tel accord ; ce
   * motif couvre le cas où l'affiliation cesse APRÈS l'accord. On ne révoque
   * rien alors : l'accord dort, la capture s'arrête, et elle reprend si un
   * coach revient. Révoquer serait décider à la place du pilote.
   */
  | 'coach_affilie_absent';

export interface DecisionSource {
  /** Cette source peut-elle mesurer, maintenant ? */
  autorisee: boolean;
  /** Ce qui porte la décision — jamais implicite. */
  motif: MotifDecision;
}

export interface EtatConsentements {
  /** Drapeau serveur `biometry`. Fail-closed : tout ce qui n'est pas `true` vaut faux. */
  drapeauActif: boolean;
  /** Socle : `users.biometry_capture_consent_at` non nul. */
  socleCapture: boolean;
  /** Partage au coach : `users.biometry_coach_share_consent_at` non nul. */
  partageCoach: boolean;
  /**
   * Une affiliation coach ACTIVE et doublement consentie existe-t-elle ?
   *
   * Requis, pas optionnel : une source qui EXIGE un coach ne doit pas pouvoir
   * s'autoriser parce que l'appelant a oublié de renseigner le champ.
   */
  coachAffilieActif: boolean;
  /** L'état par source. Une source absente de la table vaut `jamais_recueilli`. */
  parSource: Readonly<Partial<Record<IdSource, EtatSource>>>;
}

/**
 * Lit l'état d'une source dans l'ensemble. Une clé absente, ou une valeur hors
 * du vocabulaire fermé, vaut `jamais_recueilli` — jamais `accorde` : une lecture
 * douteuse ne fabrique pas un consentement.
 */
export function etatDeLaSource(etat: EtatConsentements, id: IdSource): EtatSource {
  const brut = etat?.parSource?.[id];
  if (brut === 'accorde' || brut === 'retire') return brut;
  return 'jamais_recueilli';
}

/**
 * Cette source peut-elle mesurer, maintenant ? FAIL-CLOSED de bout en bout : une
 * entrée non conforme (null, champ absent, source hors registre) refuse.
 *
 * L'ordre des marches est celui documenté en tête de fichier, et il compte : un
 * retrait par source doit être évalué APRÈS le socle (sinon on ne saurait pas
 * dire lequel des deux manque) mais AVANT l'accord (sinon il ne primerait pas).
 */
export function decisionCapture(
  etat: EtatConsentements,
  source: SourceBiometrique | null
): DecisionSource {
  if (source === null || typeof source !== 'object') {
    return { autorisee: false, motif: 'source_inconnue' };
  }
  if (etat === null || typeof etat !== 'object') {
    return { autorisee: false, motif: 'drapeau_absent' };
  }
  if (etat.drapeauActif !== true) return { autorisee: false, motif: 'drapeau_absent' };
  if (etat.socleCapture !== true) return { autorisee: false, motif: 'socle_absent' };

  const propre = etatDeLaSource(etat, source.id);
  if (propre === 'retire') return { autorisee: false, motif: 'source_retiree' };

  // Arbitrage du 26/08/2026. Placée APRÈS le retrait — un pilote qui a retiré
  // sa ceinture l'a retirée, qu'un coach soit là ou non, et c'est SON geste
  // qu'on lui rend. Placée AVANT l'accord, parce qu'une affiliation qui cesse
  // ferme la source même si l'accord tient toujours.
  if (source.exigeCoachAffilie === true && etat.coachAffilieActif !== true) {
    return { autorisee: false, motif: 'coach_affilie_absent' };
  }

  if (propre === 'accorde') return { autorisee: true, motif: 'socle_et_source' };
  return { autorisee: true, motif: 'socle_seul' };
}

/**
 * Cette source peut-elle être PARTAGÉE au coach binôme ?
 *
 * Le partage est un consentement DISTINCT, et il ne se déduit jamais de la
 * capture : on exige d'abord que la capture de CETTE source soit autorisée
 * (mêmes marches, même fail-closed), puis le partage par-dessus. Une source
 * qu'on n'a pas le droit de mesurer n'a évidemment rien à partager.
 */
export function decisionPartageCoach(
  etat: EtatConsentements,
  source: SourceBiometrique | null
): DecisionSource {
  const capture = decisionCapture(etat, source);
  if (!capture.autorisee) return capture;
  if (etat.partageCoach !== true) return { autorisee: false, motif: 'socle_absent' };
  return capture;
}

/**
 * La VARIABILITÉ (intervalles R-R) peut-elle sortir vers le coach ?
 *
 * Le document validé pose une règle que le code ne portait nulle part : « La
 * donnée de variabilité (ceinture) reste réservée à la relation avec votre
 * coach. » Deux conditions, donc, et pas une :
 *   - la source doit RÉELLEMENT porter la variabilité (la montre n'en a pas :
 *     rien à réserver, rien à partager) ;
 *   - le partage au coach doit être autorisé pour cette source.
 *
 * Toute autre destination — écran de paddock, roster, tableau de marche — est
 * hors de portée de cette fonction par construction : elle ne répond qu'à la
 * question du coach. La barrière technique reste `liveHealthGate.stripHealth`,
 * dont la liste blanche ne contient aucune clé de santé.
 */
export function variabilitePartageableAuCoach(
  etat: EtatConsentements,
  source: SourceBiometrique | null
): boolean {
  if (source === null || source.porteVariabilite !== true) return false;
  return decisionPartageCoach(etat, source).autorisee;
}

/**
 * La phrase qui DIT au pilote ce qui porte la décision. Constat factuel,
 * vouvoiement, aucun verbe prescriptif — et surtout, aucune phrase qui affirme
 * un accord par source quand seul le socle existe.
 *
 * `null` quand il n'y a rien d'honnête à dire : une source hors registre ne se
 * commente pas.
 */
export function phraseDecision(source: SourceBiometrique, decision: DecisionSource): string | null {
  switch (decision.motif) {
    case 'socle_et_source':
      return source.libelle + ' : mesure autorisée pour cette source.';
    case 'socle_seul':
      return source.libelle + ' : mesure autorisée par votre accord de capture.';
    case 'drapeau_absent':
      return null;
    case 'socle_absent':
      return source.libelle + ' : aucun accord de capture enregistré.';
    case 'source_retiree':
      return source.libelle + ' : accord retiré pour cette source.';
    case 'source_inconnue':
    default:
      return null;
  }
}
