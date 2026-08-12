/**
 * Le Pass d'une JOURNÉE DE CIRCUIT — logique pure.
 *
 * ===========================================================================
 * POURQUOI CE MODULE EXISTE
 * ===========================================================================
 *
 * *« À corriger : il lit `eventsService`, donc `events`. Un pass de journée de
 * circuit doit lire `registrations` et `sessions`. »*
 *
 * Ce n'était pas une préférence d'architecture. **`event_registrations` est
 * vide en production — zéro ligne, jamais écrite.** Le Pass affichait donc
 * « aucune inscription » à tous les pilotes, y compris à ceux qui avaient
 * réservé et payé leur journée sur le site. L'écran fonctionnait, ses tests
 * passaient, et il ne pouvait rien montrer.
 *
 * Les journées se réservent sur oxvehicle.fr, qui écrit dans `registrations`
 * (l'inscription du pilote) et lit `sessions` (la journée). L'application lit
 * les mêmes tables — un seul projet Supabase pour le site et l'application.
 *
 * ===========================================================================
 * LE VOCABULAIRE CHANGE, ET IL EST PLUS PRÉCIS
 * ===========================================================================
 *
 * `events` connaissait un `event_type` libre. `registrations` porte un
 * `offer_type` contraint par une énumération Postgres — access, signature,
 * promotion, heritage — et un statut à six valeurs au lieu de quatre. Les
 * libellés ci-dessous suivent l'énumération réelle ; un statut inconnu se rend
 * tel quel plutôt que d'être masqué.
 *
 * ===========================================================================
 * L'HEURE QU'ON N'A PAS
 * ===========================================================================
 *
 * `sessions` porte une DATE et deux heures NULLABLES. Une journée sans heure
 * de fin ne doit pas basculer dans l'historique à minuit UTC — le pilote la
 * verrait disparaître pendant qu'il roule. La borne de fin retombe donc sur la
 * fin du jour local, et l'affichage ne montre que ce qui existe : pas d'heure
 * inventée pour faire joli.
 *
 * ===========================================================================
 * LA JOURNÉE PRIVÉE QU'ON NE PEUT PAS LIRE
 * ===========================================================================
 *
 * `sessions_select_authenticated` n'ouvre la journée que si `is_private` n'est
 * pas vrai. Un pilote inscrit à une journée privée lit donc SON inscription
 * sans pouvoir lire la journée : la jointure rend `null`.
 *
 * L'ancien `splitPasses` écartait ces lignes des deux listes — silencieusement.
 * Le pilote payait une journée privée et ne voyait rien. Ici elles forment un
 * troisième groupe, `illisibles`, que l'écran montre en disant ce qu'il ne
 * sait pas.
 */

/** Ce que le Pass affiche d'une journée. */
export interface JourneeLike {
  /** ISO `YYYY-MM-DD` — `sessions.date`, jamais nul en base. */
  date: string;
  /** `HH:MM:SS` ou `null` — l'heure n'est pas garantie. */
  startTime: string | null;
  endTime: string | null;
  /** Nom du circuit, ou `null` quand il n'est pas renseigné. */
  circuitName: string | null;
  format: string | null;
}

/** Une inscription du pilote à une journée. */
export interface InscriptionLike {
  registrationId: string;
  /** `registration_status_enum`. */
  status: string;
  /** `offer_type_enum`. */
  offerType: string;
  /** Créneau choisi (`slot_choice`), ou `null`. */
  slot: string | null;
  /** `null` quand la journée n'est pas lisible (journée privée, RLS). */
  journee: JourneeLike | null;
}

// ---------------------------------------------------------------------------
// Les bornes de la journée
// ---------------------------------------------------------------------------

/**
 * Instant de fin de la journée, en ms epoch — `null` si la date est illisible.
 *
 * Sans heure de fin, la borne est la fin du JOUR LOCAL. Prendre minuit UTC
 * ferait disparaître la journée du pilote pendant qu'il roule, deux heures
 * avant le coucher du soleil en été.
 */
export function finJourneeMs(j: JourneeLike): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j.date.trim());
  if (!m) return null;
  const [, a, mo, jr] = m;
  const an = Number(a);
  const mois = Number(mo) - 1;
  const jour = Number(jr);

  if (j.endTime !== null) {
    const h = /^(\d{2}):(\d{2})/.exec(j.endTime.trim());
    if (h) {
      const fin = new Date(an, mois, jour, Number(h[1]), Number(h[2]), 0, 0).getTime();
      /**
       * JOURNÉE QUI FRANCHIT MINUIT. Une séance 22h00 → 02h00 porte une heure de
       * fin ANTÉRIEURE à son heure de début : calculée sur la même date, elle
       * plaçait la fin quatre heures AVANT le début, et la journée disparaissait
       * de « à venir » alors qu'elle n'avait pas commencé.
       */
      const debut = debutJourneeMs(j);
      if (debut !== null && fin < debut) return fin + 24 * 60 * 60 * 1000;
      return fin;
    }
  }
  // Fin du jour local : 23:59:59,999.
  return new Date(an, mois, jour, 23, 59, 59, 999).getTime();
}

/** Instant de début, en ms epoch — sert au tri. `null` si la date est illisible. */
export function debutJourneeMs(j: JourneeLike): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j.date.trim());
  if (!m) return null;
  const [, a, mo, jr] = m;
  const h = j.startTime !== null ? /^(\d{2}):(\d{2})/.exec(j.startTime.trim()) : null;
  return new Date(
    Number(a),
    Number(mo) - 1,
    Number(jr),
    h ? Number(h[1]) : 0,
    h ? Number(h[2]) : 0,
    0,
    0
  ).getTime();
}

/**
 * C'EST AUJOURD'HUI QU'ON ROULE — la journée doit-elle ouvrir le jour J ?
 *
 * ===========================================================================
 * POURQUOI CETTE FONCTION EXISTE
 * ===========================================================================
 *
 * La carte d'une journée « à venir » n'avait qu'un seul geste : agrandir le QR
 * de présence. Elle n'importait même pas les routes du flux de capture. Le
 * pilote arrivait au circuit avec, dans la main, la seule page qui parlait de
 * sa journée — et cette page ne pouvait ni appairer, ni lancer, ni arrêter.
 *
 * Relevé au premier essai terrain, le 13/08/2026 : le fondateur a dû quitter
 * son Pass et retrouver l'entrée ailleurs, dans le Paddock.
 *
 * ===========================================================================
 * CE QU'ELLE DÉCIDE
 * ===========================================================================
 *
 * `true` quand l'instant courant tombe DANS la journée, ou qu'il en reste moins
 * de deux heures avant le début. Deux heures : le temps d'arriver, de décharger
 * et de s'installer — pas plus, sinon l'entrée s'affiche la veille et perd son
 * sens d'« aujourd'hui ».
 *
 * Une journée finie rend `false` : le jour J est passé, c'est le bilan qui
 * prend le relais.
 */
const AVANCE_JOUR_J_MS = 2 * 60 * 60 * 1000;

export function estJourJ(j: JourneeLike, maintenantMs: number): boolean {
  const debut = debutJourneeMs(j);
  const fin = finJourneeMs(j);
  if (debut === null || fin === null) return false;
  return maintenantMs >= debut - AVANCE_JOUR_J_MS && maintenantMs <= fin;
}

// ---------------------------------------------------------------------------
// Le partage
// ---------------------------------------------------------------------------

/**
 * Statuts qui laissent la journée « devant soi ».
 *
 * `pending_payment` en fait partie : la journée est réservée, elle n'est pas
 * réglée. Le pilote doit la voir venir — c'est même le seul moment où
 * l'information lui sert.
 */
export function statutActif(status: string): boolean {
  return status === 'pending' || status === 'confirmed' || status === 'pending_payment';
}

export interface PartageJournees<T> {
  /** À venir, de la plus proche à la plus lointaine. */
  aVenir: T[];
  /** Passées, annulées ou absentes — de la plus récente à la plus ancienne. */
  historique: T[];
  /**
   * Inscriptions dont la journée n'est pas lisible (journée privée).
   * **Elles ne sont pas jetées** : le pilote a réservé, il doit le voir.
   */
  illisibles: T[];
}

export function partagerJournees<T extends InscriptionLike>(
  inscriptions: readonly T[],
  now: number
): PartageJournees<T> {
  const aVenir: T[] = [];
  const historique: T[] = [];
  const illisibles: T[] = [];

  for (const i of inscriptions) {
    if (i.journee === null) {
      illisibles.push(i);
      continue;
    }
    const fin = finJourneeMs(i.journee);
    // Une date illisible ne peut pas être située dans le temps : elle rejoint
    // l'historique plutôt que d'être annoncée « à venir » sans fondement.
    const encore = fin !== null && fin >= now && statutActif(i.status);
    if (encore) aVenir.push(i);
    else historique.push(i);
  }

  const debut = (x: T): number => (x.journee ? (debutJourneeMs(x.journee) ?? 0) : 0);
  aVenir.sort((a, b) => debut(a) - debut(b));
  historique.sort((a, b) => debut(b) - debut(a));
  return { aVenir, historique, illisibles };
}

// ---------------------------------------------------------------------------
// Le QR de pointage
// ---------------------------------------------------------------------------

/**
 * Le QR de pointage s'affiche-t-il ?
 *
 * FAIL-CLOSED, et pas seulement par principe. Un QR présenté à l'entrée pour
 * une journée non réglée fait vivre au pilote un refus au portail, devant les
 * autres. Mieux vaut qu'il voie dans l'application ce qui manque, la veille.
 *
 * `attended` conserve son QR : le pointage a eu lieu, le montrer de nouveau ne
 * fait rien de mal et évite de faire douter d'un scan déjà passé.
 */
export function qrAffichable(status: string): boolean {
  return status === 'confirmed' || status === 'attended';
}

/**
 * Ce qui empêche le QR, en une phrase — ou `null` s'il s'affiche.
 *
 * Factuel, sans reproche : l'application ne sait pas pourquoi le règlement
 * n'est pas passé, et le supposer serait déplacé.
 */
export function raisonSansQr(status: string): string | null {
  if (qrAffichable(status)) return null;
  if (status === 'pending_payment') return 'Le règlement de cette journée n’est pas enregistré.';
  if (status === 'pending') return 'Cette inscription n’est pas encore confirmée.';
  if (status === 'cancelled') return 'Cette inscription a été annulée.';
  if (status === 'no_show') return 'Cette journée est passée.';
  return null;
}

// ---------------------------------------------------------------------------
// Libellés — l'énumération réelle, jamais une valeur masquée
// ---------------------------------------------------------------------------

/** `offer_type_enum` → libellé affiché. */
export const LIBELLES_OFFRE: Record<string, string> = {
  access: 'Accès',
  signature: 'Signature',
  promotion: 'Promotion',
  heritage: 'Héritage',
};

export function libelleOffre(offerType: string): string {
  return LIBELLES_OFFRE[offerType] ?? offerType;
}

/** `registration_status_enum` → libellé FR neutre. */
export const LIBELLES_STATUT: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  attended: 'Présent',
  no_show: 'Absent',
  pending_payment: 'Règlement en attente',
};

export function libelleStatut(status: string): string {
  return LIBELLES_STATUT[status] ?? status;
}

/** `slot_choice` → libellé, ou `null` quand aucun créneau n'est choisi. */
export function libelleCreneau(slot: string | null): string | null {
  if (slot === null) return null;
  const s = slot.trim().toLowerCase();
  if (s === '') return null;
  if (s === 'morning' || s === 'matin') return 'Matin';
  if (s === 'afternoon' || s === 'apres-midi' || s === 'après-midi') return 'Après-midi';
  if (s === 'full' || s === 'journee' || s === 'journée') return 'Journée complète';
  return slot.trim();
}

/**
 * L'horaire seul, sans le circuit.
 *
 * DEUX FONCTIONS PARCE QU'IL Y A DEUX CONTEXTES, et l'unique qui existait
 * répétait le circuit sous son propre titre. Vérifié sur la seule inscription
 * réelle de production le 12/08/2026 : la carte affichait « HAUTE SAINTONGE »
 * en titre, puis « Haute Saintonge · 09h00 – 17h30 » juste dessous. Aucun test
 * ne pouvait le voir — chaque fonction était juste, c'est leur composition qui
 * ne l'était pas.
 *
 * Sans heure connue, la chaîne est VIDE et l'appelant n'affiche rien. On ne
 * fabrique pas une plage horaire pour remplir une ligne.
 */
export function ligneHoraire(j: JourneeLike): string {
  const hDeb = j.startTime !== null ? /^(\d{2}):(\d{2})/.exec(j.startTime.trim()) : null;
  const hFin = j.endTime !== null ? /^(\d{2}):(\d{2})/.exec(j.endTime.trim()) : null;
  if (hDeb && hFin) return `${hDeb[1]}h${hDeb[2]} – ${hFin[1]}h${hFin[2]}`;
  if (hDeb) return `à partir de ${hDeb[1]}h${hDeb[2]}`;
  return '';
}

/**
 * Circuit et horaire — pour les lignes d'historique, qui n'ont pas de titre.
 *
 * Sans circuit renseigné, on ne dit pas « Circuit » : ce serait un mot pour
 * cacher une absence. L'horaire porte alors seul la ligne.
 */
export function ligneJournee(j: JourneeLike): string {
  const morceaux: string[] = [];
  if (j.circuitName !== null && j.circuitName.trim() !== '') morceaux.push(j.circuitName.trim());
  const horaire = ligneHoraire(j);
  if (horaire !== '') morceaux.push(horaire);
  return morceaux.join(' · ');
}

/**
 * La journée à présenter au paddock — celle dont le QR est valable.
 *
 * L'écran de préparation affichait un QR dès qu'une inscription était
 * « inscrit » ou « présent », sur le vocabulaire d'`events` — c'est-à-dire
 * jamais, la table étant vide. En reprenant les vraies tables, on reprend
 * aussi la règle : **seule une journée dont le QR est affichable produit un
 * QR au paddock.**
 *
 * La plus proche d'abord. `null` quand aucune ne convient — et l'écran ne
 * montre alors pas de section Pass, plutôt qu'un code qui serait refusé au
 * portail.
 */
export function prochaineJourneeAvecQr<T extends InscriptionLike>(
  inscriptions: readonly T[],
  now: number
): T | null {
  const { aVenir } = partagerJournees(inscriptions, now);
  return aVenir.find((i) => qrAffichable(i.status)) ?? null;
}
