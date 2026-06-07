/**
 * Logique métier pure de la carte écosystème (§8 étape A OXV Mirror).
 *
 * Aucune dépendance Supabase / RN : module unitairement testable (Jest).
 * Le service `ecosystemService.ts` y branche les accès base de données.
 *
 * Voir migration 20260526210000_0036_circuit_services.sql.
 */

export type ServiceKind = 'restaurant' | 'lodging' | 'entertainment' | 'roulage' | 'other';

/** Service de l'écosystème autour d'un circuit (modèle domaine). */
export interface CircuitService {
  id: string;
  circuitId: string;
  kind: ServiceKind;
  name: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  organizer: string | null;
  isPremium: boolean;
}

/** Circuit pour l'annuaire national (sous-ensemble géographique + infos). */
export interface DirectoryCircuit {
  id: string;
  name: string;
  officialName: string | null;
  city: string | null;
  region: string | null;
  lengthKm: number | null;
  turnsCount: number | null;
  finishLineLat: number | null;
  finishLineLon: number | null;
  bboxMinLat: number | null;
  bboxMaxLat: number | null;
  bboxMinLon: number | null;
  bboxMaxLon: number | null;
}

/** Libellés FR sobres des types de service (doctrine OXV). */
export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  restaurant: 'Restauration',
  lodging: 'Hébergement',
  entertainment: 'Loisirs',
  roulage: 'Journées de roulage',
  other: 'Autres services',
};

/** Ordre d'affichage des groupes de services (cahier §8.1). */
const SERVICE_KIND_ORDER: ServiceKind[] = [
  'roulage',
  'lodging',
  'restaurant',
  'entertainment',
  'other',
];

/**
 * Regroupe les services par type, dans l'ordre d'affichage, en ne gardant
 * que les groupes non vides. Chaque groupe est trié par nom.
 */
export function groupServicesByKind(
  services: CircuitService[]
): { kind: ServiceKind; items: CircuitService[] }[] {
  return SERVICE_KIND_ORDER.map((kind) => ({
    kind,
    items: services.filter((s) => s.kind === kind).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

/**
 * Position d'un circuit sur la carte : centre de la bounding box si elle est
 * disponible, sinon la ligne d'arrivée. Retourne `null` si aucune donnée
 * géographique exploitable.
 */
export function circuitCenter(circuit: DirectoryCircuit): { lat: number; lon: number } | null {
  const { bboxMinLat, bboxMaxLat, bboxMinLon, bboxMaxLon } = circuit;
  if (bboxMinLat != null && bboxMaxLat != null && bboxMinLon != null && bboxMaxLon != null) {
    return { lat: (bboxMinLat + bboxMaxLat) / 2, lon: (bboxMinLon + bboxMaxLon) / 2 };
  }
  if (circuit.finishLineLat != null && circuit.finishLineLon != null) {
    return { lat: circuit.finishLineLat, lon: circuit.finishLineLon };
  }
  return null;
}

/** Sous-titre factuel d'un circuit (ville/région · longueur · virages). */
export function circuitSubtitle(circuit: DirectoryCircuit): string {
  const parts: string[] = [];
  const place = [circuit.city, circuit.region].filter(Boolean).join(', ');
  if (place) parts.push(place);
  if (circuit.lengthKm != null) parts.push(`${circuit.lengthKm} km`);
  if (circuit.turnsCount != null) parts.push(`${circuit.turnsCount} virages`);
  return parts.join(' · ');
}
