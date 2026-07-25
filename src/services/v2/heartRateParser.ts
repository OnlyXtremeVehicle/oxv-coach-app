/**
 * Parser PUR de la caractéristique BLE « Heart Rate Measurement » (0x2A37).
 *
 * BIO-2 — donnée de santé (RGPD art. 9). Ce module ne fait QUE décoder la trame
 * binaire émise par un capteur cardiaque standard (ici Polar H10). Il ne juge
 * rien, ne diagnostique rien, ne déclenche aucune alerte : il transforme des
 * octets en un fait mesuré. L'interprétation appartient au coach humain.
 *
 * Aucun I/O, aucun React/RN, aucun Supabase : logique déterministe testable en
 * ts-jest node. Le transport (BLE), le consentement et l'aiguillage exclusif
 * vers le canal coach vivent ailleurs — jamais ici.
 *
 * Réf : Bluetooth SIG, Heart Rate Measurement characteristic (org.bluetooth
 * .characteristic.heart_rate_measurement). Le document protocole OXV étant
 * absent, l'implémentation dérive de la spec publique ; chaque vecteur de test
 * est dérivé à la main et commenté.
 */

/**
 * État du contact électrode, tel que rapporté par les bits 1-2 du flag.
 *  - "ok"          : capteur supporté ET contact détecté (valeur 3).
 *  - "poor"        : capteur supporté MAIS contact non détecté (valeur 2) —
 *                    électrodes sèches, qualité dégradée.
 *  - "unsupported" : le capteur ne rapporte pas l'état de contact (valeur 0 ou 1).
 */
export type ContactStatus = 'ok' | 'poor' | 'unsupported';

/** Un échantillon cardiaque décodé — fait brut, sans jugement. */
export interface HeartRateSample {
  /** Fréquence cardiaque instantanée (battements par minute). */
  hrBpm: number;
  /** État du contact électrode (voir {@link ContactStatus}). */
  contact: ContactStatus;
  /**
   * Intervalles R-R en millisecondes (temps entre deux battements).
   * Vide `[]` si la trame n'en contient pas — jamais fabriqué.
   */
  rrMs: number[];
}

/** Masque du bit 0 : format de la valeur HR (0 => uint8, 1 => uint16 LE). */
const FLAG_HR_16BIT = 0x01;
/** Masque du bit 3 : présence de l'« energy expended » (2 octets à sauter). */
const FLAG_ENERGY_PRESENT = 0x08;
/** Masque du bit 4 : présence d'un ou plusieurs intervalles R-R. */
const FLAG_RR_PRESENT = 0x10;

/**
 * Décode une trame « Heart Rate Measurement » (0x2A37).
 *
 * Disposition de la trame (octet 0 = flags) :
 *  - bit 0    : format HR — 0 => uint8 en octet 1 ; 1 => uint16 LITTLE-ENDIAN
 *               en octets 1..2.
 *  - bits 1-2 : état contact — 3 => "ok", 2 => "poor", 0|1 => "unsupported".
 *  - bit 3    : energy expended présent — si posé, 2 octets (uint16) APRÈS la
 *               valeur HR, à SAUTER avant les R-R.
 *  - bit 4    : R-R présent — les octets RESTANTS sont une suite d'uint16
 *               LITTLE-ENDIAN en unités de 1/1024 s.
 *
 * Conversion R-R → millisecondes : `ms = valeur * 1000 / 1024`. La précision
 * flottante est CONSERVÉE (aucun arrondi) : 1024 → 1000 ms, 512 → 500 ms exacts,
 * 300 → 292.96875 ms. Arrondir fausserait la variabilité cardiaque (HRV).
 *
 * Retourne `null` sur toute trame malformée / trop courte (vide, HR 16 bits
 * annoncé mais < 3 octets, energy annoncé mais tronqué, R-R tronqué à un octet
 * impair). Aucune valeur n'est jamais inventée.
 */
export function parseHeartRateMeasurement(bytes: Uint8Array): HeartRateSample | null {
  // Minimum viable : 1 octet flags + au moins 1 octet HR (format 8 bits).
  if (!(bytes instanceof Uint8Array) || bytes.length < 2) return null;

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = dv.getUint8(0);

  const hr16bit = (flags & FLAG_HR_16BIT) !== 0;
  const contactBits = (flags >> 1) & 0x03;
  const energyPresent = (flags & FLAG_ENERGY_PRESENT) !== 0;
  const rrPresent = (flags & FLAG_RR_PRESENT) !== 0;

  let offset = 1;

  // --- Valeur HR --------------------------------------------------------
  let hrBpm: number;
  if (hr16bit) {
    if (offset + 2 > bytes.length) return null; // annonce 16 bits mais tronqué
    hrBpm = dv.getUint16(offset, true);
    offset += 2;
  } else {
    if (offset + 1 > bytes.length) return null;
    hrBpm = dv.getUint8(offset);
    offset += 1;
  }
  if (!Number.isFinite(hrBpm)) return null;

  // --- Energy expended (sauté, non exposé) ------------------------------
  if (energyPresent) {
    if (offset + 2 > bytes.length) return null; // annonce energy mais tronqué
    offset += 2;
  }

  // --- Intervalles R-R --------------------------------------------------
  const rrMs: number[] = [];
  if (rrPresent) {
    const remaining = bytes.length - offset;
    // Chaque R-R fait 2 octets : un reste impair = trame tronquée.
    if (remaining % 2 !== 0) return null;
    for (let i = offset; i + 2 <= bytes.length; i += 2) {
      const raw1024 = dv.getUint16(i, true);
      rrMs.push((raw1024 * 1000) / 1024);
    }
  }

  const contact: ContactStatus =
    contactBits === 3 ? 'ok' : contactBits === 2 ? 'poor' : 'unsupported';

  return { hrBpm, contact, rrMs };
}
