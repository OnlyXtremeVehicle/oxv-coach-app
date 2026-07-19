/**
 * Logique PURE des rituels de notification B3 (lot V2-L4, mission D).
 *
 * Les « rituels » sont des préférences fines stockées dans le JSONB réel
 * `users.notification_preferences` (aucune nouvelle colonne), au même endroit
 * que les canaux existants lus par les schedulers. Chaque rituel a une CLÉ
 * dans ce JSONB :
 *   - bilan   → `debrief`       : canal DÉJÀ programmé (« votre bilan est prêt »,
 *                                  J+1, pushNotificationsService) — pas un canal
 *                                  fantôme, la préférence agit vraiment.
 *   - j3      → `ritual_j3`      : le rappel J-3 (bandeau d'accueil B3). La
 *                                  préférence est persistée ici (lot L4, comme
 *                                  annoncé dans l'accueil) ; son branchement au
 *                                  bandeau/scheduler est progressif.
 *   - records → `ritual_records` : note de record personnel — persistée,
 *                                  programmation à venir.
 *
 * Défaut-ON (absent = actif), comme les canaux existants : on ne réduit jamais
 * une notification déjà promise sans choix explicite. Pur (ni RN ni Supabase).
 */

export type RitualId = 'bilan' | 'j3' | 'records';

export interface RitualDef {
  id: RitualId;
  /** Clé réelle dans `users.notification_preferences`. */
  prefKey: string;
  /** Libellé de ligne (vouvoyé, sobre). */
  label: string;
  /** Sous-texte factuel une ligne. */
  caption: string;
  /** true si un scheduler consomme DÉJÀ cette clé (canal réel), false si la
   *  préférence est persistée mais son branchement complet est progressif. */
  scheduled: boolean;
}

/** Les trois rituels B3, dans l'ordre d'affichage. */
export const RITUAL_CHANNELS: RitualDef[] = [
  {
    id: 'bilan',
    prefKey: 'debrief',
    label: 'Votre bilan est prêt',
    caption: 'Le lendemain, quand votre lecture de séance est prête.',
    scheduled: true,
  },
  {
    id: 'j3',
    prefKey: 'ritual_j3',
    label: 'Rappel J-3',
    caption: 'Un rappel calme trois jours avant une journée à venir.',
    scheduled: false,
  },
  {
    id: 'records',
    prefKey: 'ritual_records',
    label: 'Vos records',
    caption: 'Une note quand vous battez l’un de vos temps.',
    scheduled: false,
  },
];

/** Définition d'un rituel par son id (garde-fou : `bilan` par défaut). */
export function ritualDef(id: RitualId): RitualDef {
  return RITUAL_CHANNELS.find((r) => r.id === id) ?? RITUAL_CHANNELS[0];
}

/** Lit l'état d'un rituel depuis le JSONB brut. Absent/non-bool → actif (défaut-ON). */
export function readRitualPref(raw: unknown, id: RitualId): boolean {
  if (!raw || typeof raw !== 'object') return true;
  return (raw as Record<string, unknown>)[ritualDef(id).prefKey] !== false;
}

/**
 * Écrit l'état d'un rituel en PRÉSERVANT toutes les autres clés du JSONB
 * (canaux existants, clés posées par le site). Retourne un nouvel objet.
 */
export function writeRitualPref(
  raw: unknown,
  id: RitualId,
  value: boolean
): Record<string, unknown> {
  const base = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  base[ritualDef(id).prefKey] = value;
  return base;
}
