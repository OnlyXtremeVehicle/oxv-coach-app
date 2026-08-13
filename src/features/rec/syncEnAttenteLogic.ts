/**
 * CE QUI RESTE SUR LE TÉLÉPHONE — logique pure de l'état de synchronisation.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXISTE
 * ===========================================================================
 *
 * `captureSyncQueue` expose `hasPending()`, `pendingSessionIds()` et un dossier
 * de quarantaine. **Aucun de ces trois n'avait le moindre appelant** hors des
 * tests. Une séance entière pouvait donc dormir sur le disque — ou avoir été
 * mise en quarantaine — sans le moindre signe : ni bandeau, ni compteur, ni
 * écran de diagnostic.
 *
 * Le seul symptôme externe était celui qu'on a constaté la nuit du 13/08/2026 :
 * une ligne figée en `recording`, découverte en interrogeant la base à la main.
 * C'est ce silence qui transforme un incident RÉPARABLE — les octets sont là —
 * en perte apparente.
 *
 * ===========================================================================
 * CE QUE CE MODULE DIT, ET CE QU'IL SE REFUSE À DIRE
 * ===========================================================================
 *
 * Il énonce un FAIT — « N opérations attendent d'être envoyées » — et rien de
 * plus. Il ne promet pas que tout est sauvé, il ne dramatise pas non plus : une
 * file non vide est le fonctionnement NORMAL d'une application hors-ligne, et
 * l'alarmer à chaque coupure de réseau apprendrait au pilote à l'ignorer.
 *
 * La quarantaine, elle, est d'une autre nature : elle signale des opérations
 * que plus rien ne rejouera. Elle se distingue, toujours.
 */

export interface EtatSynchro {
  /** Opérations encore en file, tous types confondus. */
  enAttente: number;
  /** Opérations écartées définitivement, hors de portée d'un rejeu. */
  enQuarantaine: number;
  /** Séances concernées par ce qui reste en file. */
  seances: readonly string[];
}

export interface MessageSynchro {
  /** Eyebrow mono. */
  titre: string;
  /** Phrase factuelle, au vouvoiement. */
  corps: string;
  /** `attente` = normal et transitoire ; `bloque` = plus rien ne le rejouera. */
  registre: 'attente' | 'bloque';
  /** Un rejeu manuel a-t-il un sens ? */
  rejeuUtile: boolean;
}

/**
 * Le message à afficher, ou `null` quand tout est parti.
 *
 * `null` est le cas nominal, et il est SILENCIEUX : un écran qui annonce
 * « tout est synchronisé » à chaque séance dilue le seul message qui compte.
 */
export function messageSynchro(etat: EtatSynchro): MessageSynchro | null {
  const { enAttente, enQuarantaine } = etat;
  if (enAttente <= 0 && enQuarantaine <= 0) return null;

  /**
   * LA QUARANTAINE PRIME, même s'il reste aussi des opérations en attente.
   * Elle décrit une perte possible ; l'attente ne décrit qu'un délai. Mettre
   * les deux sur le même plan reviendrait à noyer le grave dans l'ordinaire.
   */
  if (enQuarantaine > 0) {
    return {
      titre: 'SYNCHRONISATION BLOQUÉE',
      corps:
        enQuarantaine === 1
          ? 'Une opération n’a pas pu être envoyée et attend une intervention. Vos données restent sur ce téléphone.'
          : `${enQuarantaine} opérations n’ont pas pu être envoyées et attendent une intervention. Vos données restent sur ce téléphone.`,
      registre: 'bloque',
      // Un rejeu manuel ne sort RIEN de la quarantaine : le dire plutôt que
      // d'offrir un bouton qui ne peut pas tenir sa promesse.
      rejeuUtile: false,
    };
  }

  return {
    titre: 'ENVOI EN ATTENTE',
    corps:
      enAttente === 1
        ? 'Une opération attend le réseau. Elle partira toute seule dès qu’il revient.'
        : `${enAttente} opérations attendent le réseau. Elles partiront toutes seules dès qu’il revient.`,
    registre: 'attente',
    rejeuUtile: true,
  };
}

/**
 * La séance qu'on vient de rouler est-elle concernée ?
 *
 * Sert à ne montrer le message que quand il parle de CE que le pilote a sous
 * les yeux. Une opération d'une séance d'avant-hier n'a rien à faire sur
 * l'écran de fin de celle-ci.
 */
export function concerneLaSeance(etat: EtatSynchro, sessionId: string | null): boolean {
  if (sessionId === null) return false;
  return etat.seances.includes(sessionId);
}
