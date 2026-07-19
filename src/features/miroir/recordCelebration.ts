/**
 * recordCelebration — garde PARTAGÉE de célébration record (contrat V2-L1).
 *
 * UN record personnel se célèbre UNE seule fois par séance, TOUS écrans
 * confondus : l'accueil Miroir et le Bilan lisent et posent la MÊME garde
 * MMKV. Un record célébré à l'accueil ne se re-célèbre pas au bilan, et
 * inversement — le premier écran qui célèbre pose la garde.
 *
 * Clé : `record-celebrated:{sessionId}` (valeur = ISO de l'instant célébré).
 * SOURCE UNIQUE : aucune autre clé de garde record ne doit exister dans
 * l'app (l'ancienne clé accueil `miroir:recordFlash:{id}` est supprimée).
 *
 * IMPORTANT (règle données réelles) : ne poser la garde (markCelebrated)
 * que sur un record ÉTABLI sur données complètes — jamais sur un record
 * indéterminé (panne partielle), sinon la vraie célébration devient
 * définitivement injouable pour cette séance.
 */

import { storage } from '@/lib/mmkv';

export const RECORD_CELEBRATED_PREFIX = 'record-celebrated:';

/** Clé MMKV de la garde de célébration d'une séance. */
export function recordCelebratedKey(sessionId: string): string {
  return `${RECORD_CELEBRATED_PREFIX}${sessionId}`;
}

/** La célébration de cette séance a-t-elle déjà joué (quel que soit l'écran) ? */
export function hasCelebrated(sessionId: string): boolean {
  return typeof storage.getString(recordCelebratedKey(sessionId)) === 'string';
}

/** Scelle la célébration de cette séance (horodatage ISO). Idempotent. */
export function markCelebrated(sessionId: string): void {
  storage.set(recordCelebratedKey(sessionId), new Date().toISOString());
}
