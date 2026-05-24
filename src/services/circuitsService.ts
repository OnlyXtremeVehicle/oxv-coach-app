/**
 * Service circuits — lit la table `circuits` Supabase avec cache MMKV.
 *
 * Pattern : cache-first avec TTL 24h (les circuits évoluent rarement),
 * fallback en cache stale si Supabase répond avec erreur.
 *
 * En sem. 5, utilisé par l'écran #20 (greeting + référence circuit) et
 * par lapDetectionRunner (finish line dynamique). En sem. 6, utilisé
 * par #14 (Carte du circuit) pour récupérer le SVG du tracé.
 */

import { cacheGet, cacheSet, STORAGE_KEYS } from '@/lib/mmkv';
import { supabase } from '@/lib/supabase';

export interface Circuit {
  id: string;
  name: string;
  isOfficial: boolean;
  finishLineLat: number;
  finishLineLon: number;
  finishLineRadiusM: number;
  finishLineHeading: number | null;
  lengthKm: number | null;
  turnsCount: number | null;
  trackSvgPath: string | null;
  bboxMinLat: number | null;
  bboxMaxLat: number | null;
  bboxMinLon: number | null;
  bboxMaxLon: number | null;
}

const CIRCUITS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

export async function fetchCircuits(forceRefresh = false): Promise<Circuit[]> {
  if (!forceRefresh) {
    const cached = cacheGet<Circuit[]>(STORAGE_KEYS.CIRCUITS);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('circuits')
    .select(
      'id, name, is_official, finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading, length_km, turns_count, track_svg_path, bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon'
    )
    .order('is_official', { ascending: false })
    .order('name');

  if (error) {
    console.warn('[OXV] fetchCircuits erreur, fallback cache stale :', error.message);
    return cacheGet<Circuit[]>(STORAGE_KEYS.CIRCUITS) ?? [];
  }

  const circuits: Circuit[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? '',
    isOfficial: row.is_official ?? false,
    finishLineLat: Number(row.finish_line_lat ?? 0),
    finishLineLon: Number(row.finish_line_lon ?? 0),
    finishLineRadiusM: Number(row.finish_line_radius_m ?? 30),
    finishLineHeading: row.finish_line_heading !== null ? Number(row.finish_line_heading) : null,
    lengthKm: row.length_km !== null ? Number(row.length_km) : null,
    turnsCount: row.turns_count ?? null,
    trackSvgPath: row.track_svg_path ?? null,
    bboxMinLat: row.bbox_min_lat !== null ? Number(row.bbox_min_lat) : null,
    bboxMaxLat: row.bbox_max_lat !== null ? Number(row.bbox_max_lat) : null,
    bboxMinLon: row.bbox_min_lon !== null ? Number(row.bbox_min_lon) : null,
    bboxMaxLon: row.bbox_max_lon !== null ? Number(row.bbox_max_lon) : null,
  }));

  cacheSet(STORAGE_KEYS.CIRCUITS, circuits, CIRCUITS_CACHE_TTL_MS);
  return circuits;
}

/**
 * Renvoie le circuit officiel principal (Haute Saintonge, sans suffixe "BACKUP").
 * Utilisé comme circuit par défaut en V1.
 */
export async function getDefaultCircuit(): Promise<Circuit | null> {
  const all = await fetchCircuits();
  return (
    all.find((c) => c.isOfficial && !c.name.toUpperCase().includes('BACKUP')) ??
    all.find((c) => c.isOfficial) ??
    all[0] ??
    null
  );
}
