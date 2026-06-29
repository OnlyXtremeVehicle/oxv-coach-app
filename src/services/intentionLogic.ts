/**
 * Intention de séance (V9 §7) — normalisation PURE du texte saisi.
 *
 * L'intention est ce que le pilote choisit d'explorer, écrit DE SA MAIN. L'app
 * ne pré-remplit ni ne suggère jamais (doctrine) : ici on borne seulement la
 * saisie (trim + longueur max), sans rien ajouter. Pur → testable.
 */

export const INTENTION_MAX = 2000;

/**
 * Fenêtre de fraîcheur d'une intention « en attente » (24 h). Au-delà, une
 * intention écrite mais jamais rattachée n'est plus « celle du jour » : on ne la
 * rattache pas à une séance ultérieure (sinon le Bilan présenterait comme
 * intention du jour un texte vieux de plusieurs jours).
 */
export const PENDING_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/**
 * Nettoie une intention pour persistance : retourne le texte borné, ou null si
 * vide (rien à enregistrer). Ne complète, ni ne reformule, ni ne suggère.
 */
export function normalizeIntention(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > INTENTION_MAX ? trimmed.slice(0, INTENTION_MAX) : trimmed;
}

/**
 * Une intention en attente est-elle encore « du moment » (créée dans la fenêtre
 * de fraîcheur) ? Pur, testable.
 */
export function isPendingFresh(createdAtIso: string, nowMs: number): boolean {
  const t = Date.parse(createdAtIso);
  // Borne haute seule : un created_at légèrement « futur » (horloge serveur en
  // avance sur le client) reste frais, on ne rejette pas une intention qu'on
  // vient d'écrire.
  return Number.isFinite(t) && nowMs - t <= PENDING_FRESHNESS_MS;
}
