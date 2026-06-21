/**
 * Points de vue remarquables via Overpass API (OpenStreetMap) — doc 09 §2.2.
 *
 * Gratuit, sans clé (fair use ; self-host en phase 2). On liste les lieux
 * tagués viewpoint / water / mountain_pass / peak dans un rayon, pour les
 * injecter comme waypoints « beaux » d'un itinéraire, ou les afficher sur la carte.
 */

import type { GeoPoint, ScenicPoi, ScenicPoiKind } from './types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Filtre Overpass par type de point.
const KIND_FILTER: Record<ScenicPoiKind, string> = {
  viewpoint: '[tourism=viewpoint]',
  water: '[natural=water]',
  pass: '[mountain_pass=yes]',
  peak: '[natural=peak]',
};

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface OverpassResponse {
  elements?: OverpassElement[];
}

function classify(tags: Record<string, string> | undefined): ScenicPoiKind | null {
  if (!tags) return null;
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.mountain_pass) return 'pass';
  if (tags.natural === 'peak') return 'peak';
  if (tags.natural === 'water') return 'water';
  return null;
}

function buildQuery(center: GeoPoint, radiusM: number, kinds: ScenicPoiKind[]): string {
  const around = `(around:${Math.round(radiusM)},${center.lat},${center.lon})`;
  const clauses = kinds.map((k) => `nwr${around}${KIND_FILTER[k]};`).join('\n  ');
  return `[out:json][timeout:25];\n(\n  ${clauses}\n);\nout center 120;`;
}

/**
 * Liste les points remarquables autour d'un centre. Renvoie `[]` en cas
 * d'erreur réseau (l'UI tombe alors sur un état vide propre).
 */
export async function findScenicPois(
  center: GeoPoint,
  radiusM = 50000,
  kinds: ScenicPoiKind[] = ['viewpoint', 'water', 'pass', 'peak']
): Promise<ScenicPoi[]> {
  if (kinds.length === 0) return [];
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: buildQuery(center, radiusM, kinds),
    });
    if (!res.ok) {
      console.warn(`[overpass] HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as OverpassResponse;
    const out: ScenicPoi[] = [];
    for (const el of json.elements ?? []) {
      const kind = classify(el.tags);
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!kind || typeof lat !== 'number' || typeof lon !== 'number') continue;
      out.push({
        id: `${el.type}/${el.id}`,
        kind,
        name: el.tags?.name ?? null,
        point: { lat, lon },
      });
    }
    return out;
  } catch (e) {
    console.warn('[overpass] échec findScenicPois', e);
    return [];
  }
}
