/**
 * L'armement est refusé si le boîtier n'est pas connecté — jalon 3, phase 4bis.
 * Logique PURE.
 *
 * ---
 *
 * LE DÉFAUT QUE CETTE GARDE FERME
 *
 * `placement.tsx` passait `disabled={starting}` à son bouton d'armement.
 * `starting` est un garde de ré-entrance — il empêche un double appui. **L'état
 * de la liaison Bluetooth n'était consulté nulle part.**
 *
 * Conséquence sur la piste : boîtier éteint, hors de portée, ou Bluetooth coupé —
 * le pilote maintient six cents millisecondes, sent l'haptique d'armement, voit
 * la jauge se remplir, arrive sur `roulage`, roule sa séance entière. Et
 * n'enregistre rien.
 *
 * Rien n'aurait levé d'erreur : `startCaptureSession` s'abonne au flux BLE, et un
 * flux qui ne vient jamais n'est pas une panne, c'est un silence. La séance se
 * serait close, vide, découverte au bilan — c'est-à-dire trop tard.
 *
 * ---
 *
 * REFUSER N'EST PAS BLOQUER LA JOURNÉE
 *
 * Le dossier est explicite : « l'armement est refusé si le boîtier est
 * déconnecté. Retour à l'appairage. Cela ne bloque pas la journée : cela la
 * **route par le diagnostic**, où "rouler sans mesure" reste ouvert. »
 *
 * D'où une garde qui rend une ACTION, pas seulement un booléen. Un refus sans
 * porte de sortie est un cul-de-sac, et un cul-de-sac au paddock se contourne en
 * désinstallant l'application.
 */

import type { BleStatus } from '@/types/telemetry';

/** Ce que l'écran doit faire du refus. */
export type ActionArmement =
  | 'armer' // la voie normale
  | 'patienter' // une connexion est en cours, rien à faire qu'attendre
  | 'diagnostic' // aller régler l'appairage
  | 'choisir_circuit'; // aucun tracé retenu : sans lui, aucun tour ne peut être compté

export interface VerdictArmement {
  peutArmer: boolean;
  /** Pourquoi, au vouvoiement, descriptif. Absent quand l'armement est ouvert. */
  raison?: string;
  action: ActionArmement;
}

/**
 * Peut-on armer la capture ?
 *
 * @param statut     état de la liaison au boîtier (`bluetoothService.getStatus()`)
 * @param enCours    un démarrage est déjà lancé (garde de ré-entrance)
 * @param sansMesure le pilote a choisi DÉLIBÉRÉMENT de rouler sans mesure
 *
 * `sansMesure` ne se déduit jamais : il vient d'un geste explicite, après que le
 * refus a été montré. Le déduire d'un échec transformerait une panne en décision
 * du pilote, ce qu'elle n'est pas.
 */
export function verdictArmement(
  statut: BleStatus,
  enCours: boolean,
  sansMesure = false,
  /**
   * Un circuit est-il retenu ? `false` → refus.
   *
   * ── POURQUOI CE QUATRIÈME ARGUMENT (posé le 13/08/2026) ────────────────────
   *
   * `startCaptureSession` accepte un `circuitId` nul et retombe alors sur
   * `BELTOISE_FINISH` — des coordonnées qui ne correspondent à AUCUN circuit
   * réel. La capture démarre, le voyant s'allume, et pas un tour ne peut être
   * compté : la ligne d'arrivée est à des centaines de mètres de la piste.
   *
   * Le garde-fou prévu pour ce cas est un `console.warn`, que personne ne lit
   * au paddock. Une séance sans circuit est une séance sans chrono ; il vaut
   * mieux le dire avant de rouler que de le découvrir au bilan.
   *
   * Le défaut est resté invisible tant que l'écran pré-sélectionnait TOUJOURS
   * un circuit. Il s'arme dès que la liste peut être vide — hors-ligne, au
   * premier lancement, ou sur une lecture filtrée par la RLS.
   */
  circuitRetenu = true
): VerdictArmement {
  if (enCours) {
    return { peutArmer: false, raison: 'Démarrage en cours.', action: 'patienter' };
  }

  // AVANT le raccourci `sansMesure` : rouler sans mesure reste un choix
  // légitime, mais il ne fabrique pas un circuit pour autant. Sans tracé, la
  // séance n'a pas de ligne d'arrivée — et aucun geste ne peut y suppléer.
  if (!circuitRetenu) {
    return {
      peutArmer: false,
      raison: 'Aucun circuit retenu. Sans tracé, aucun tour ne sera compté.',
      action: 'choisir_circuit',
    };
  }

  if (sansMesure) return { peutArmer: true, action: 'armer' };

  switch (statut) {
    case 'connected':
      return { peutArmer: true, action: 'armer' };

    // Une liaison en train de s'établir n'est pas un échec : on attend.
    case 'connecting':
      return { peutArmer: false, raison: 'Connexion au boîtier en cours.', action: 'patienter' };

    case 'scanning':
      return { peutArmer: false, raison: 'Recherche du boîtier en cours.', action: 'patienter' };

    case 'disconnected':
      return { peutArmer: false, raison: 'Boîtier déconnecté.', action: 'diagnostic' };

    case 'error':
      return { peutArmer: false, raison: 'La liaison Bluetooth a échoué.', action: 'diagnostic' };

    // `idle` = le service n'a jamais rien tenté. C'est le cas d'un pilote qui
    // arrive directement sur `placement` sans passer par l'appairage.
    case 'idle':
      return { peutArmer: false, raison: 'Aucun boîtier appairé.', action: 'diagnostic' };

    default:
      // Fail-closed : un statut inconnu ne vaut pas une autorisation.
      return { peutArmer: false, raison: 'État du boîtier inconnu.', action: 'diagnostic' };
  }
}

/**
 * Le libellé du bouton secondaire, quand il y en a un.
 *
 * `patienter` n'en propose pas : proposer une action pendant qu'une connexion
 * s'établit invite à l'interrompre.
 */
export function libelleAction(action: ActionArmement): string | null {
  if (action === 'diagnostic') return 'Régler l’appairage';
  // Le refus « aucun circuit » n'a pas d'ailleurs où aller : le choix est SUR
  // cet écran. Proposer une navigation ferait sortir le pilote de la seule page
  // qui porte la réponse.
  if (action === 'choisir_circuit') return null;
  return null;
}
