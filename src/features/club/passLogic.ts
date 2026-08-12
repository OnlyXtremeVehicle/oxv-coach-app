/**
 * Logique pure de l'écran PASS OXV (V2-L5, mission C, écran 7/7) — porte CLUB.
 *
 * Aucune dépendance React ni react-native : testée sous ts-jest/node
 * (src/features/club/__tests__/passLogic.test.ts). Ne porte plus que la
 * destination du bouton quand le pilote n'a aucune journée, et la charge utile
 * du QR — RÉUTILISÉE telle quelle du flux pass-oxv v1 (source unique :
 * preparationLogic.qrCheckinPayload).
 *
 * Le partage des journées, les libellés et l'éligibilité du QR vivent dans
 * `passJourneeLogic`, qui parle le vocabulaire de `registrations`.
 *
 * Doctrine : faits, jamais de classement ni de chrono d'autrui. Un pass est une
 * inscription du pilote à SA journée — aucune comparaison à quiconque. Données
 * réelles câblées : une inscription sans événement lisible (RLS) n'invente rien.
 */

import { qrCheckinPayload } from '@/features/rec/preparationLogic';

// Source unique de la charge utile du QR de présence (flux pass-oxv v1).
export { qrCheckinPayload };

// ---------------------------------------------------------------------------
// CE QUI VIVAIT ICI, ET POURQUOI IL N'Y EST PLUS
// ---------------------------------------------------------------------------
//
// `splitPasses`, `isActiveStatus`, `canShowQr`, `offerLabel`, `statusLabel`,
// `PASS_OFFER_LABELS`, `PASS_STATUS_LABELS`, `PassLike` et `PassEventLike` ont
// été SUPPRIMÉS le 12/08/2026, avec leurs tests.
//
// Ils parlaient le vocabulaire de `events` et `event_registrations` — une table
// à ZÉRO ligne, jamais écrite, que le Pass lisait depuis toujours. Le Pass lit
// maintenant `registrations` + `sessions` (les tables du site), dont
// l'énumération des statuts compte six valeurs au lieu de quatre et dont les
// offres n'ont aucun nom en commun avec les anciens types d'événement.
//
// Les garder aurait laissé, au même endroit et sous les mêmes noms, une
// machinerie complète et testée qui range des inscriptions qui n'existent pas.
// C'est `src/features/club/passJourneeLogic.ts` qui porte la suite.
//
// Ce qui reste ici sert encore : la destination du bouton quand le pilote n'a
// aucune journée, et la charge utile du QR — commune au flux v1.

// ---------------------------------------------------------------------------
// État vide — destination du CTA (fail-closed sur le drapeau paiement)
// ---------------------------------------------------------------------------

export type PassEmptyCta = 'reserve' | 'site';

/**
 * Espace du pilote sur le site, où ses journées se réservent et se paient.
 *
 * **Ce n'est PAS l'URL de paiement d'une demande donnée.** Celle-là est une
 * demande ouverte au site — D-06 du dossier de raccordement : *« Ce qu'il faut
 * du site : l'URL exacte et stable de la page de paiement d'une demande
 * donnée. »* Tant qu'elle n'est pas fournie, on mène le pilote à son espace,
 * pas à une adresse inventée.
 *
 * Ce chemin-ci est vérifié : les courriels de retour de journée l'emploient
 * déjà (`supabase/functions/feedback-request`).
 */
export const URL_JOURNEES_SITE = 'https://www.oxvehicle.fr/compte-sessions';

/**
 * Aucune inscription → où mène le CTA ?
 *
 * Paiements ARMÉS : le flux de réservation de l'application.
 *
 * Paiements FERMÉS : **le site**, pas la porte Club. Le repli précédent
 * renvoyait vers `/(app2)/club` — c'est-à-dire l'écran d'où le pilote venait
 * d'arriver. Un aller-retour n'est pas un bouton mort, mais il ne vaut guère
 * mieux : le pilote voulait réserver une journée, et l'application le ramenait
 * à son point de départ.
 *
 * Le plan tranche : *« Paiement fermé : un lien vers le site avec le chemin
 * exact, jamais un bouton mort. »*
 */
export function passEmptyCta(paymentsEnabled: boolean): PassEmptyCta {
  return paymentsEnabled === true ? 'reserve' : 'site';
}
