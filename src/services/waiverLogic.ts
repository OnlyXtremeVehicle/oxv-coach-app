/**
 * Waivers — logique pure (P3, décharge e-sign). Décisions fondateur 2026-07-12 :
 * signature SIMPLE (case + nom + horodatage + empreinte du texte), timing À LA
 * RÉSERVATION, périmètre PILOTE. Pas de valeur probante sur-promise : on scelle
 * seulement quelle version du texte a été acceptée, quand, par qui.
 *
 * Pur et testé — aucune I/O ici (cf. waiverService pour l'écriture).
 */

export interface WaiverSignatureLite {
  waiverVersion: string;
  bookingId: string | null;
}

/** Un nom de signataire est valide s'il est renseigné (2..120 caractères utiles). */
export function isValidSignerName(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && n.length <= 120;
}

/**
 * Le signataire a-t-il déjà signé la version courante ? Si `bookingId` est fourni
 * (timing « à la réservation »), la signature doit concerner CETTE réservation.
 */
export function hasCurrentSignature(
  signatures: WaiverSignatureLite[],
  version: string,
  bookingId?: string | null
): boolean {
  return signatures.some(
    (s) => s.waiverVersion === version && (bookingId == null || s.bookingId === bookingId)
  );
}
