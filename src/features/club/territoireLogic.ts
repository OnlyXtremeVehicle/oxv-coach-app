/**
 * Logique pure de l'écran TERRITOIRE (V2-L5, mission C, écran 4/7) — porte CLUB.
 *
 * Aucune dépendance React ni react-native : testée sous ts-jest/node
 * (src/features/club/__tests__/territoireLogic.test.ts). Tout ce qui décide
 * (pins visibles dans la boîte englobante synchronisée au pan, tri/dédup des
 * routes, gating fail-closed du convoi, libellés factuels) vit ici pour rester
 * vérifiable ; l'écran se contente de rendre.
 *
 * Doctrine : TOURISME / DÉCOUVERTE, jamais performance. La « sinuosité » est
 * une préférence géométrique de balade, JAMAIS une note de conduite ni un
 * classement. Aucune fonction ici ne produit de rang, de gagnant, ni de chrono
 * d'autrui. Données réelles câblées : absent = « — », jamais une valeur inventée.
 */

// ---------------------------------------------------------------------------
// Boîte englobante (bbox) — pins visibles synchronisés au pan de la carte
// ---------------------------------------------------------------------------

export interface LatLon {
  lat: number;
  lon: number;
}

/** Région react-native-maps (centre + deltas). */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Cadre géographique visible à l'écran. */
export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Région (centre + deltas) → cadre englobant. Deltas négatifs tolérés (abs). */
export function regionToBBox(region: MapRegion): BBox {
  const halfLat = Math.abs(region.latitudeDelta) / 2;
  const halfLon = Math.abs(region.longitudeDelta) / 2;
  return {
    minLat: region.latitude - halfLat,
    maxLat: region.latitude + halfLat,
    minLon: region.longitude - halfLon,
    maxLon: region.longitude + halfLon,
  };
}

/** Un point est-il dans le cadre ? Coordonnée non finie → hors cadre (défensif). */
export function isWithinBBox(lat: number, lon: number, bbox: BBox): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

/**
 * Filtre les éléments visibles dans le cadre. `at` extrait le point de chaque
 * élément (circuits en `finishLine*`, pings en `lat/lon`, routes en `start`) —
 * un seul filtre pour tous les repères de la carte.
 */
export function filterInView<T>(items: readonly T[], bbox: BBox, at: (item: T) => LatLon): T[] {
  return items.filter((item) => {
    const p = at(item);
    return isWithinBBox(p.lat, p.lon, bbox);
  });
}

// ---------------------------------------------------------------------------
// Routes — certification & tri (belles routes, hors chrono)
// ---------------------------------------------------------------------------

/** Route certifiée OXV (verrou admin en base — scenic_routes.status). */
export function isCertified(route: { status: string }): boolean {
  return route.status === 'certified';
}

/**
 * Fusionne les routes du pilote et les routes certifiées de la communauté :
 * dédoublonne par id (une route à soi déjà certifiée n'apparaît qu'une fois),
 * place les certifiées en tête (badge OR), l'ordre d'origine étant préservé
 * dans chaque groupe (tri stable). Aucun classement de performance — la
 * certification est un label de curation, pas un rang.
 */
export function mergeRoutes<T extends { id: string; status: string }>(
  mine: readonly T[],
  certified: readonly T[]
): T[] {
  const byId = new Map<string, T>();
  for (const r of mine) byId.set(r.id, r);
  for (const r of certified) if (!byId.has(r.id)) byId.set(r.id, r);
  const all = [...byId.values()];
  return [...all.filter(isCertified), ...all.filter((r) => !isCertified(r))];
}

/** Libellés humains de la préférence de balade (jamais une note de conduite). */
export const CURVINESS_LABELS: Record<string, string> = {
  douce: 'Route douce',
  sinueuse: 'Route sinueuse',
  tres_sinueuse: 'Route très sinueuse',
};

export function curvinessLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return CURVINESS_LABELS[value] ?? value;
}

/** Distance en km, arrondie — « — » si la valeur réelle est absente. */
export function distanceKmLabel(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—';
  return `${Math.round(km)} km`;
}

/**
 * Indice de sinuosité (descripteur GÉOMÉTRIQUE) — « sinuosité 1,42 ». Null si
 * absent (la ligne se masque, jamais un chiffre inventé). Virgule décimale FR.
 */
export function sinuosityLabel(sinuosity: number | null | undefined): string | null {
  if (sinuosity == null || !Number.isFinite(sinuosity)) return null;
  return `sinuosité ${sinuosity.toFixed(2).replace('.', ',')}`;
}

// ---------------------------------------------------------------------------
// C2 Convoi — gating fail-closed & rattachement route ↔ journée
// ---------------------------------------------------------------------------

export interface ConvoyGateInput {
  /** Drapeau `convoys` (fail-closed : absent/false → pas de convoi). */
  flagEnabled: boolean;
  /** Session SITE de la prochaine journée du pilote (null si aucune). */
  daySessionId: string | null;
}

/**
 * Le bloc convoi n'apparaît QUE si : le drapeau est armé, la route est
 * certifiée, ET le pilote a une journée à venir résolue en session. Un seul
 * critère manquant → section absente (jamais teasée).
 */
export function shouldOfferConvoy(route: { status: string }, input: ConvoyGateInput): boolean {
  return (
    input.flagEnabled === true &&
    isCertified(route) &&
    input.daySessionId != null &&
    input.daySessionId !== ''
  );
}

/**
 * Convois de la journée rattachés à CETTE route (`convoysService.getForSession`
 * remonte tous les convois du jour ; on retient ceux liés à la route). Aucune
 * donnée de pilotage n'y transite — coordination avant/après roulage seulement.
 */
export function convoysForRoute<T extends { routeId: string | null }>(
  convoys: readonly T[],
  routeId: string
): T[] {
  return convoys.filter((c) => c.routeId === routeId);
}

/** Le pilote fait-il partie de ce convoi ? (bascule REJOINDRE / QUITTER). */
export function isParticipant(
  convoy: { participants: readonly { userId: string }[] },
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  return convoy.participants.some((p) => p.userId === userId);
}

/** Compte de participants — « 3 participants » / « 1 participant ». */
export function participantsLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `${n} ${n > 1 ? 'participants' : 'participant'}`;
}
