/**
 * Belles routes / itinéraires sinueux — types communs (doc : architecture/09).
 *
 * Cadre OXV : TOURISME / DÉCOUVERTE. La « sinuosité » est une préférence de
 * balade (géométrie de la route), JAMAIS une mesure de performance. La donnée
 * de conduite (G, freinage) reste sur le circuit. Voir architecture/09 §1.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Un seul fournisseur depuis le 12/08/2026.
 *
 * Kurviger a été retiré : il recevait la position GPS du pilote en PARAMÈTRE
 * D'URL, où elle se journalise chez le tiers. Voir la note dans
 * `scenicRouteService.ts`. Le type reste une union d'une seule valeur pour que
 * l'ajout d'un fournisseur reste une décision explicite.
 */
export type RoutingProvider = 'graphhopper';

/** Préférence de balade (pas une métrique de perf). */
export type Curviness = 'douce' | 'sinueuse' | 'tres_sinueuse';

export interface ScenicRouteRequest {
  start: GeoPoint;
  /** Destination. Si absente, on vise une boucle de `distanceKm`. */
  end?: GeoPoint;
  /** Longueur cible en km (boucle) quand `end` est absent. */
  distanceKm?: number;
  /** Préférence de sinuosité (défaut : 'sinueuse'). */
  curviness?: Curviness;
  /** Étapes imposées (ex. points de vue injectés). */
  waypoints?: GeoPoint[];
  /** Éviter les voies rapides (défaut : true → routes secondaires). */
  avoidMotorways?: boolean;
}

export interface ScenicRoute {
  /** Polyligne du tracé (ordre de parcours). */
  coordinates: GeoPoint[];
  distanceKm: number;
  durationMin: number;
  /** Dénivelé positif cumulé (m) si l'API le fournit. */
  ascentM?: number;
  /**
   * Indice de sinuosité = longueur du tracé / distance à vol d'oiseau.
   * Pur descripteur GÉOMÉTRIQUE (≥ 1). N'a rien d'une mesure de conduite.
   */
  sinuosity: number;
  provider: RoutingProvider;
}

export type ScenicPoiKind = 'viewpoint' | 'water' | 'pass' | 'peak';

export interface ScenicPoi {
  id: string;
  kind: ScenicPoiKind;
  name: string | null;
  point: GeoPoint;
}
