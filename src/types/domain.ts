/**
 * Types métier OXV Mirror — concepts produits transversaux.
 *
 * Sépare le métier OXV (marge, zone, étiquette humaine, mode hub) du
 * BLE/télémétrie (src/types/telemetry.ts) et de la state machine
 * (src/types/state.ts).
 */

// ============================================================
// MARGE (le chiffre central des bilans)
// ============================================================

/** Pourcentage de marge composite, 0..100. */
export type MarginPercent = number;

/** Zone qualitative de la marge — couleur et étiquette humaine. */
export type MarginZone = 'green' | 'yellow' | 'red';

/** Étiquette humaine affichée à côté du chiffre, en français. */
export type MarginLabel = 'Confortable' | 'À explorer' | 'Terrain serré';

/** Seuils par défaut. Calibrables par pilote via app_user_progression. */
export const DEFAULT_MARGIN_THRESHOLDS = {
  /** Au-dessus = zone verte (Confortable). */
  greenAbove: 30,
  /** Entre greenAbove et redBelow = zone jaune (À explorer). */
  redBelow: 15,
} as const;

export interface MarginThresholds {
  greenAbove: number;
  redBelow: number;
}

export function marginZoneOf(
  percent: MarginPercent,
  thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS
): MarginZone {
  if (percent >= thresholds.greenAbove) return 'green';
  if (percent >= thresholds.redBelow) return 'yellow';
  return 'red';
}

export function marginLabelOf(zone: MarginZone): MarginLabel {
  switch (zone) {
    case 'green':
      return 'Confortable';
    case 'yellow':
      return 'À explorer';
    case 'red':
      return 'Terrain serré';
  }
}

// ============================================================
// MODE DU HUB (#20)
// ============================================================

/**
 * #20 a 3 modes selon le contexte :
 *   A — compte à rebours (session à venir)
 *   B — en route (variante = #21)
 *   C — passif (accueil sans contexte fort)
 */
export type HomeHubMode = 'countdown' | 'enroute' | 'passive';

// ============================================================
// PALIERS HERITAGE
// ============================================================

/** Paliers commerciaux OXV — utiles pour les écrans Heritage et la
 *  page progression du site (oxvehicle.fr). */
export type HeritageTier = 'access' | 'signature' | 'promotion' | 'heritage';

export interface HeritageProgress {
  sessionsAttended: number;
  tier: HeritageTier;
  /** Sessions restantes pour atteindre le tier suivant. 0 si déjà Heritage. */
  sessionsToNextTier: number;
  /** Étiquette du tier suivant, null si déjà Heritage. */
  nextTier: HeritageTier | null;
}

export function heritageProgressFor(sessionsAttended: number): HeritageProgress {
  if (sessionsAttended >= 3) {
    return { sessionsAttended, tier: 'heritage', sessionsToNextTier: 0, nextTier: null };
  }
  if (sessionsAttended >= 2) {
    return { sessionsAttended, tier: 'promotion', sessionsToNextTier: 1, nextTier: 'heritage' };
  }
  if (sessionsAttended >= 1) {
    return { sessionsAttended, tier: 'signature', sessionsToNextTier: 1, nextTier: 'promotion' };
  }
  return { sessionsAttended, tier: 'access', sessionsToNextTier: 1, nextTier: 'signature' };
}

// ============================================================
// MARQUEURS PISTE (bouton Flic 2)
// ============================================================

export type LapMarkerKind = 'good' | 'incident' | 'question';

export interface LapMarker {
  /** Timestamp précis du marquage (ms epoch). */
  at: number;
  kind: LapMarkerKind;
  /** Numéro de tour au moment du marquage (peut être null si hors-tour). */
  lapNumber: number | null;
}
