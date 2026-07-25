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
 * factuels de position/chrono, jamais de santé. Toutes les clés sont optionnelles
 * car seules celles réellement présentes dans l'entrée sont recopiées.
 */
export type SafeLivePayload = {
  position?: unknown;
  lapMs?: unknown;
  sector?: unknown;
  ts?: unknown;
};

/**
 * Liste BLANCHE des seules clés autorisées à quitter l'app vers un canal
 * non-coach. Tout ce qui n'y figure pas est écarté par construction — c'est une
 * liste blanche, jamais une liste noire : ajouter un capteur santé demain ne crée
 * aucune fuite tant que sa clé n'est pas explicitement inscrite ici.
 */
const LIVE_WHITELIST = ['position', 'lapMs', 'sector', 'ts'] as const;

/**
 * Retire toute donnée de santé d'une charge utile destinée à un canal NON-coach.
 *
 * Renvoie un NOUVEL objet ne contenant QUE les clés de la liste blanche
 * ({position, lapMs, sector, ts}) réellement présentes dans l'entrée. Toute autre
 * clé (hr, rr, rrMs, contact, heartRate, bpm, ou n'importe quoi d'autre) est
 * écartée. On applique cette fonction à chaque payload partant vers roster/board/
 * LIVE-B, afin qu'aucune biométrie ne puisse fuiter hors du canal coach.
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
