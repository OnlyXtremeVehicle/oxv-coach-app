/**
 * Garde-fou DOCTRINAL du live santé (lot BIO-2) — module PUR, testable sans réseau.
 *
 * Contexte : les données de santé (fréquence cardiaque, variabilité RR, contact
 * capteur…) relèvent de l'article 9 RGPD (données sensibles). La doctrine OXV est
 * stricte : le coach JUGE, l'app NE DIAGNOSTIQUE PAS. La biométrie ne peut donc
 * partir QUE vers le canal coach, et seulement sous triple verrou ; elle ne doit
 * JAMAIS fuiter vers un canal non-coach (roster / board / LIVE-B).
 *
 * Ce module ne contient AUCUN I/O (ni Supabase, ni React, ni RN) : uniquement
 * deux fonctions déterministes qui matérialisent la barrière. L'appelant (service)
 * les invoque à chaque tick. Les deux règles sont volontairement FAIL-CLOSED :
 *   - `stripHealth` : liste blanche stricte (on ne laisse passer que le connu-sain) ;
 *   - `canEmitBiometry` : émission autorisée SEULEMENT si les trois verrous sont
 *     strictement vrais — tout doute vaut refus.
 */

/**
 * Charge utile réduite, sûre pour un canal NON-coach : uniquement les champs
 * factuels d'identité publique, de position et de chrono, jamais de santé.
 * Toutes les clés sont optionnelles car seules celles réellement présentes dans
 * l'entrée sont recopiées.
 */
export type SafeLivePayload = {
  position?: unknown;
  lapMs?: unknown;
  sector?: unknown;
  ts?: unknown;
  pilotHandle?: unknown;
  carNo?: unknown;
  lastLapMs?: unknown;
  bestLapMs?: unknown;
};

/**
 * Liste BLANCHE des seules clés autorisées à quitter l'app vers un canal
 * non-coach. Elle énumère le PUBLIABLE, jamais l'interdit : c'est une liste
 * blanche, pas une liste noire. Conséquence directe — brancher demain un capteur
 * santé quelconque (hr, rr, contact, spo2, température, n'importe quoi) ne crée
 * AUCUNE fuite tant que sa clé n'est pas explicitement inscrite ici. L'oubli joue
 * en faveur du pilote, jamais contre lui.
 *
 * Lot LIVE-B : les quatre clés du tableau de marche (pilotHandle, carNo,
 * lastLapMs, bestLapMs) rejoignent la liste. Ce sont des faits publics de
 * roulage — un numéro de voiture et des durées de tour — au même titre qu'un
 * panneau au bord de la piste ; aucune n'est un signe vital.
 *
 * ATTENTION à qui modifie ce tableau : depuis LIVE-B, cette barrière a un
 * appelant RÉEL en production (l'émission `board`, canal `live:board:<sessionId>`
 * lisible sur l'écran TV du paddock), ce qui n'était pas le cas quand elle a été
 * écrite au lot BIO-2. Toute clé ajoutée ici devient donc immédiatement visible
 * d'un public, pas seulement du coach du binôme consenti.
 */
const LIVE_WHITELIST = [
  'position',
  'lapMs',
  'sector',
  'ts',
  'pilotHandle',
  'carNo',
  'lastLapMs',
  'bestLapMs',
] as const;

/**
 * Retire toute donnée de santé d'une charge utile destinée à un canal NON-coach.
 *
 * Renvoie un NOUVEL objet ne contenant QUE les clés de la liste blanche
 * réellement présentes dans l'entrée. Toute autre clé (hr, rr, rrMs, contact,
 * heartRate, bpm, ou n'importe quoi d'autre) est écartée. On applique cette
 * fonction à chaque payload partant vers roster/board/LIVE-B, afin qu'aucune
 * biométrie ne puisse fuiter hors du canal coach.
 *
 * Entrée non-objet (null, undefined, primitive) → objet vide : fail-closed.
 */
export function stripHealth(payload: Record<string, unknown>): SafeLivePayload {
  const result: SafeLivePayload = {};
  if (payload === null || typeof payload !== 'object') return result;

  for (const key of LIVE_WHITELIST) {
    // Recopie seulement les clés PRÉSENTES : une clé blanche absente reste absente
    // (pas de `undefined` parasite), pour que « tout-santé » donne bien {}.
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      result[key] = payload[key];
    }
  }
  return result;
}

/** État des trois verrous conditionnant l'émission de biométrie vers le coach. */
export interface BiometryGate {
  /** Consentement biométrie explicite du pilote, actif à cet instant. */
  consentCapture: boolean;
  /** Binôme pilote↔coach détaillé (lien nominatif établi et actif). */
  detailedBinome: boolean;
  /** Flag serveur d'activation biométrie (matériel + juridique validés). */
  flagBiometry: boolean;
}

/**
 * Décide si la biométrie peut être émise vers le canal coach — FAIL-CLOSED.
 *
 * Renvoie `true` UNIQUEMENT si les trois verrous valent STRICTEMENT `true` :
 * consentement de capture biométrie actif ET binôme détaillé ET flag biométrie.
 * Toute valeur `false`, `undefined`, `null` — ou un `gate` absent — donne `false`.
 *
 * Modélise le triple verrou : une révocation en vol (un des trois bascule à
 * `false`) doit couper l'émission. C'est l'appelant qui l'assure en re-vérifiant
 * ce prédicat à CHAQUE tick, jamais une seule fois en début de flux.
 */
export function canEmitBiometry(gate: BiometryGate): boolean {
  if (gate === null || typeof gate !== 'object') return false;
  return gate.consentCapture === true && gate.detailedBinome === true && gate.flagBiometry === true;
}

/** Un coach candidat à recevoir la biométrie, avec son niveau d'accès. */
export interface CoachCandidat {
  coachId: string;
  /** true si le pilote lui a accordé la lecture détaillée (ou le programme). */
  detailed: boolean;
}

/**
 * Destinataires de la biométrie — UN CANAL PAR COACH (jalon 6, lot 27a-bis).
 *
 * ---
 *
 * CE QUE CETTE FONCTION REMPLACE
 *
 * La biométrie voyageait sur le canal de séance, PARTAGÉ. Impossible d'y
 * réserver un message à certains : la seule position tenable était le TOUT OU
 * RIEN — n'émettre que si CHAQUE coach à l'écoute était au niveau détaillé.
 *
 * Elle protégeait, mais son prix était absurde : un coach détaillé perdait le
 * cardio parce qu'un confrère en lecture simple s'était connecté. La donnée la
 * plus sensible du produit était la seule à dépendre de qui d'autre regardait.
 *
 * ---
 *
 * LA RÈGLE, MAINTENANT
 *
 * Les deux verrous du PILOTE — son consentement, le flag serveur — valent pour
 * tout le monde : s'ils tombent, la liste est vide, personne ne reçoit. Le
 * troisième, le niveau du binôme, s'évalue COACH PAR COACH.
 *
 * Le prédicat reste `canEmitBiometry`, appelé une fois par candidat : la règle
 * fail-closed n'a pas changé, seul son grain. Un coach non retenu n'est pas
 * filtré à la réception — le message ne part pas vers lui.
 */
export function destinatairesBiometrie(
  coaches: readonly CoachCandidat[],
  socleConsenti: boolean,
  flagBiometry: boolean
): CoachCandidat[] {
  if (!Array.isArray(coaches)) return [];
  return coaches.filter(
    (c) =>
      c !== null &&
      typeof c === 'object' &&
      typeof c.coachId === 'string' &&
      c.coachId.length > 0 &&
      canEmitBiometry({
        consentCapture: socleConsenti,
        detailedBinome: c.detailed,
        flagBiometry,
      })
  );
}
